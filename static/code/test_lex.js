

            //// formerly part of LexClient constructor:
            const PI_MILLION = 'https://www.piday.org/million/';
            // THANKS:  Billion pi, https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
            const PI_BILLION = '/meta/static/data/pi-billion.txt';
            if (0) that.fetch_experiment(PI_MILLION);
            if (0) that.fetch_experiment(PI_BILLION);
            that.fetch_experiment(that.url);

            testLinesFromBytes(that.url, [
                1,2,3,4,5,6,7,8,9,
                10, 100, 1000, 10000, 100000, 1000000,
                111111, 11111, 1111, 111, 11, 13
            ]);

        //// former method of LexClient:
        function fetch_experiment(url) {
            var what_it_is = simplified_domain_from_url(url) + " " + extract_file_name(url);
            var fetch_promise = fetch(url);
            console.log("FETCH", what_it_is, "START");
            fetch_promise.catch(function (error_message) {
                console.warn("FETCH", what_it_is, "ERROR", error_message);
            });
            var num_lines = 0;
            var last_line = null;
            var liner = new LinesFromBytes(function (line) {
                num_lines++;
                last_line = line;
            });
            fetch_promise.then(function (response) {
                console.log("FETCH", what_it_is, "RESPONSE", response.status, response.type);
                if (response.ok) {
                    var total = 0;
                    var reader = response.body.getReader();
                    return reader.read().then(incremental_download);

                    function incremental_download(result) {
                        if (result.done) {
                            console.log("FETCH", what_it_is, "DONE", total, "bytes", num_lines, "lines");
                        } else {
                            console.log("FETCH", what_it_is, "CHUNK", result.value.length, "bytes", num_lines, "lines");
                            total += result.value.length;
                            liner.bytes_in(result.value);
                            return reader.read().then(incremental_download);
                        }
                    }
                } else {
                    console.warn("FETCH", what_it_is, "NOT OK", response.status);
                }
            });
        }

    //// supporting functions:

    function chunk(array, chunk_size) {
        // THANKS:  Break array into chunks, https://stackoverflow.com/a/24782004/673991
        chunk_size = Math.max(chunk_size, 1);
        var chunks = [];
        for (var i=0, n=array.length ; i < n ; i+= chunk_size) {
            var each_chunk = array.slice(i, i + chunk_size);
            chunks.push(each_chunk);
        }
        return chunks;
    }

    function lines_from_bytes_in_chunks(bytes, chunk_size) {
        var lines = [];
        var liner = new LinesFromBytes(function (line) {
            lines.push(line);
        })
        var chunks = chunk(bytes, chunk_size);
        looper(chunks, function (_, each_chunk) {
            liner.bytes_in(each_chunk);
            // console.log("\t\t", each_chunk.length, "bytes", lines.length, "lines");
        });
        lines_from_bytes_in_chunks.num_chunks = chunks.length;
        return lines;
    }

    function Uint8Concat(a1, a2) {
        // THANKS:  Simple array buffer concat, https://stackoverflow.com/a/60590943/673991
        return new Uint8Array([...a1, ...a2]);
    }

    function fetch_all_bytes(url, then) {
        var bytes = new Uint8Array(0);
        var fetch_promise = fetch(url);
        fetch_promise.then(function (response) {
            if (response.ok) {
                var reader = response.body.getReader();
                return reader.read().then(incremental_download);

                function incremental_download(result) {
                    if (result.done) {
                        then(bytes);
                    } else {
                        bytes = Uint8Concat(bytes, result.value);
                        console.debug("testLinesFromBytes", bytes.length, "bytes");
                        return reader.read().then(incremental_download);
                    }
                }
            } else {
                console.error("CANNOT fetch_all_bytes", response.status);
            }
        });
    }

    function testLinesFromBytes(url, chunk_sizes) {
        fetch_all_bytes(url, function (bytes_all) {
            var lines_all = lines_from_bytes_in_chunks(bytes_all, bytes_all.length);
            console.log("testLinesFromBytes", bytes_all.length, "bytes", lines_all.length, "lines");
            looper(chunk_sizes, function (_, chunk_size) {
                var lines_chunked = lines_from_bytes_in_chunks(bytes_all, chunk_size);
                if (chunk_size === 13) {   // false flag to prove that failure detection works
                    lines_chunked[13] += "\r";
                }
                var does_match = arrays_equal(lines_all, lines_chunked);
                var verdict = does_match ? "PASS" : "FAIL";
                console.log(
                    "\t",
                    chunk_size, "bytes",
                    lines_from_bytes_in_chunks.num_chunks, "chunks",
                    lines_chunked.length, "lines",
                    verdict
                );
            });
        });
    }

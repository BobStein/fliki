
// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
 * @param listing_words
 * @param listing_words[].is_anonymous - supplied by server
 * @param listing_words[].ip_address - supplied by server
 * @param listing_words[].browser - supplied by server
 * @param listing_words[].platform - supplied by server
 * @param listing_words[].word_class - supplied by server
 * @param listing_words[].iconify - supplied by server
 * @param listing_words[].index_number - computed by client
 * @param MONTY
 * @param MONTY.IDN
 * @param MONTY.IDN.LEX
 * @param MONTY.IDN.VERB
 * @param MONTY.IDN.DEFINE
 * @param MONTY.IDN.LISTING
 * @param MONTY.IDN.NAME
 * @param MONTY.IDN.BROWSE
 * @param MONTY.IDN.SESSION_OBSOLETE
 * @param MONTY.IDN.IP_ADDRESS_OBSOLETE
 * @param MONTY.IDN.PATH
 * @param MONTY.IDN.QUESTION_OBSOLETE
 * @param MONTY.IDN.ANSWER
 * @param MONTY.IDN.TAG
 * @param MONTY.IDN.IP_ADDRESS_TAG
 * @param MONTY.IDN.USER_AGENT_TAG
 * @param MONTY.IDN.REFERRER
 * @param MONTY.IDN.ICONIFY
 * @param MONTY.IDN.GOOGLE_LISTING
 * @param MONTY.IDN.ANONYMOUS_LISTING
 * @param MONTY.NOW
 * @param MONTY.URL_PREFIX_QUESTION
 * @param MONTY.URL_HERE
 */
// TODO:  verb filter checkboxes (show/hide each one, especially may want to hide "questions")
function js_for_meta_lex(window, $, listing_words, MONTY) {

    var UNICODE = {
        NBSP: '\u00A0',
        LEFT_DOUBLE_QUOTE: '\u201C',
        RIGHT_DOUBLE_QUOTE: '\u201D',
        RIGHT_ARROW_UP: '\u2B0F',
        DOWN_ARROW_RIGHT: '\u21B3',
        UPWARDS_WHITE_ARROW: '\u21E7',
        TIMES: '\u00D7',
        CIRCLED_TIMES: '\u2297'
    };
    var session_list = [];   // helps identify session words when they're the vrb or obj
    // var BODY_PADDING_LEFT = parseFloat($('body').css('margin-left'));
    // var LEX_LIST_INDENT = parseFloat($('.lex-list').css('padding-inline-start'));
    var SREND_FONT_SIZE = parseFloat($('.srend').css('font-size'));
    var whn_delta = [];   // Built by sub_whn(), consumed by whn_delta_render().

    var now_date = new Date();
    var now_seconds = now_date.getTime() / 1000.0;
    var load_delay = now_seconds - MONTY.NOW;
    console.log("Load delay", load_delay.toFixed(3));
    // EXAMPLE:  0.874
    // NOTE:  Also includes server/client time discrepancy.
    //        Which should be zero, no matter the time zone,
    //        because both are seconds since 1970 UTC.

    $(document).ready(function() {
        // $('.srend').each(function word_pass() {
        //     render_word(this);
        // });
        console.time('total');
        console.time('render_word');
        array_async($('.srend'), render_word, 6, 100, function() {
            console.timeEnd('render_word');
            // console.log("Sessions", session_list);
            // console.log("numberings", $.map(session_list, value_from_idn));
            console.log("listing_words", listing_words);
            // EXAMPLE:
            //     Sessions (11) ["0q83_044D", "0q83_0460", "0q83_0464", "0q83_046C", "0q83_0470",
            //                    "0q83_047B", "0q83_047E", "0q83_0491", "0q83_04C8", "0q83_04CE", "0q83_04D9"]
            //     numberings (11) ["1101", "1120", "1124", "1132", "1136", "1147", "1150", "1169",
            //                      "1224", "1230", "1241"]
            //     listing_words {0q82_A7__8A059E058E6A6308C8B0_1D0B00: {...},
            //                    0q82_A7__8A05F9A0A1873A14BD1C_1D0B00: {...}, 0q82_A8__82AB_1D0300: {...},
            //                    0q82_A8__830425_1D0400: {...}, 0q82_A8__83044D_1D0400: {...}, ...}
            setTimeout(function() {
                console.time('listing_words_loop');
                // looper(listing_words, function listing_words_loop(idn, listed) {
                //     if (has(listed, 'iconify')) {
                //         // // noinspection HtmlRequiredAltAttribute,RequiredAttributes
                //         // var $img = $('<img>', {
                //         //     class: 'iconify',
                //         //     src: listed.iconify,
                //         //     alt: "icon for " + listed.name,
                //         //     title: "icon for " + listed.name
                //         // });
                //         // // TODO:  Graceful handling if iconify but no name?
                //         // var $words_to_iconify = $data_idn(idn);
                //         // $words_to_iconify.empty().append($img);
                //     } else if (has(listed, 'name')) {
                //         // var $words_to_name = $data_idn(idn);
                //         // $words_to_name.attr('title', listed.name);
                //     } else if (listed.is_anonymous) {
                //         // var parts = [];
                //         // if (has(listed, 'ip_address')) {
                //         //     parts.push(listed.ip_address);
                //         // }
                //         // parts.push('#' + listed.index_number);
                //         // if (has(listed, 'browser')) {
                //         //     parts.push(listed.browser);
                //         // }
                //         // if (has(listed, 'platform')) {
                //         //     parts.push(listed.platform);
                //         // }
                //         // var $anons_to_name = $data_idn(idn);
                //         // $anons_to_name.find('.named').text(parts.join(" "));
                //     }
                // });
                console.timeEnd('listing_words_loop');
                setTimeout(function() {
                    console.time('whn_delta');
                    whn_delta_render();
                    console.timeEnd('whn_delta');
                    console.timeEnd('total');
                }, 6);
            }, 6);
        });
    });

    /**
     * Render the delta-time triangles on the left.
     */
    // TODO:  Instead synthesize triangle parts in render_word()?
    // SEE:  createElement(NS) debacle, https://stackoverflow.com/a/3642265/673991
    // SEE:  createElementNS with jQuery, https://stackoverflow.com/a/20852029/673991
    function whn_delta_render() {

        function point_join(array_of_points) {
            return array_of_points.map(function(p) {
                return p.map(function(x) {
                    return x.toString();
                }).join(',');
            }).join(' ');
        }

        /**
         * Tooltip for BOTH the polygon and text elements.
         */
        function tooltip_delta(between) {
            return between ? between.description_long : "";
        }

        var svg = d3.selectAll('.whn-delta');

        sneak_in_one_last_whn_delta();
        svg.data(whn_delta);

        var triangle = svg.append('polygon');
        triangle.attr('points', function (b) {
            var h = SREND_FONT_SIZE * 1.20;
            var w = log_time_scale(b ? b.num : 0, h*0.33, h*3.00);
            if (isNaN(w)) { w = h*5.0; }   // NOTE:  Negative time busts the logarithm.
            var triangle_array = [[0,0], [0,h], [w,h/2]];
            var triangle_string = point_join(triangle_array);
            return triangle_string;
        });
        var LIGHTEST = 216;   // XXX:  D.R.Y. crime - qoolbar.js .target-environment rgb(216,216,216)
        var DARKEST = 0;
        triangle.attr('fill', function (b) {
            return gray_scale(log_time_scale(b ? b.num : 0, LIGHTEST, DARKEST));
        });

        triangle.append('title').text(tooltip_delta);

        var label = svg.append('text');
        label.text(function (b) { return b ? b.description_short : ""; });
        label.attr('x', '1');
        label.attr('y', '12');
        label.attr('class', function (b) { return (b ? b.num : 0) < 10 ? 'whn-label hide' : 'whn-label'; });
        label.attr('fill', function (b) { return (b ? b.num : 0) < 60 ? 'black' : 'white'; });
        label.append('title').text(tooltip_delta);
    }

    var $word_previous = null;
    function render_word(word) {
        var $word = $(word);

        var idn = $word.attr('id');
        sub($word, 'sbj', UNICODE.DOWN_ARROW_RIGHT);
        var vrb_idn = sub($word, 'vrb');
        var obj_idn = sub($word, 'obj', UNICODE.RIGHT_ARROW_UP);
        sub_num($word);
        var txt = sub_txt($word);
        sub_whn($word_previous, $word);
        $word_previous = $word;

        var $obj;
        var $inner;
        var question_url;
        var $txt;
        var $referrer;

        switch (vrb_idn) {
        // case MONTY.IDN.IP_ADDRESS_TAG:
        //     var ip_address = txt;
        //     if (has(listing_words, sbj_idn)) {
        //         listed = listing_words[sbj_idn];
        //         if (listed.is_anonymous) {
        //             // console.log(
        //             //     "Tagging",
        //             //     $word.attr('value'),
        //             //     sbj_idn,
        //             //     ip_address
        //             // );
        //             listed.ip_address = ip_address;
        //             listed.session_idn = obj_idn;
        //         } else {
        //             // console.log("non-anonymous", $word.attr('value'));
        //             // TODO:  Non-anonymous session tagged, how to reveal this info?
        //         }
        //     } else {
        //         console.log("Unlisted", sbj_idn);
        //     }
        //     break;
        // case MONTY.IDN.ICONIFY:
        //     chronicle(obj_idn, 'img_src', txt);
        //     break;
        // case MONTY.IDN.NAME:
        //     chronicle(obj_idn, 'name', txt);
        //     break;
        case MONTY.IDN.DEFINE:
            if (obj_idn === MONTY.IDN.BROWSE) {
                // NOTE:  These didn't work. Why?
                //        || obj_idn === MONTY.IDN.SESSION_OBSOLETE
                //        || obj_idn === MONTY.IDN.IP_ADDRESS_OBSOLETE) {
                session_list.push(idn);
            }
            break;
        case MONTY.IDN.REFERRER:
            $obj = $word.find('.obj');
            $inner = $obj.find('.named');
            $inner.text("hit #" + value_from_idn(obj_idn));
            $inner.removeClass('empty');
            question_url = $_from_id(obj_idn).data('question_url');

            var txt_encoded = encodeURI(txt);
            // NOTE:  Compare both %-encoded and unencoded versions of the referrer url,
            //        because sometimes it comes encoded, and sometimes it doesn't.
            //        question_url is always encoded.
            // EXAMPLE:  Yes, http://.../python/something%20obscure
            // EXAMPLE:  Not, http://.../python/%

            if (txt === question_url || txt_encoded === question_url) {
                $txt = $word.find('.txt');
                $txt.remove();
                $referrer = $('<span>', {class: 'referrer'}).text("(self)");
                $referrer.attr('title', "That hit was referred from itself.");
                $obj.after($referrer);
            } else if (txt === MONTY.URL_HERE) {
                $txt = $word.find('.txt');
                $txt.remove();
                $referrer = $('<span>', {class: 'referrer'}).text("(here)");
                $referrer.attr('title', "That hit was referred from this page.");
                $obj.after($referrer);
            } else {
                $word.find('.txt').addClass('refer-other');
            }
            break;
        default:
            if (has(session_list, vrb_idn)) {
                $obj = $word.find('.obj');
                $inner = $obj.find('.named');
                question_url = url_from_question($obj.data('txt'));
                var $a = $('<a>', {href: question_url});
                $inner.wrap($a);
                $word.attr('data-question_url', question_url);
            }
        }
    }
    function url_from_question(question) {
        var url = path_join(MONTY.URL_PREFIX_QUESTION, encodeURI(question));
        url = url.replace(/\?$/, "");
        // NOTE:  Flask request.full_path appends a `?` even when there was no query string.
        return url;
    }

    function path_join(left, right) {
        left = left.replace(/\/$/, "");
        right = right.replace(/^\//, "");
        return left + '/' + right;
    }
    console.assert('foo/bar' === path_join('foo', 'bar'));
    console.assert('foo/bar' === path_join('foo/', '/bar'));

    function value_from_idn(idn) {
        return $_from_id(idn).attr('value');
    }
    // function chronicle(idn, field_name, value) {
    //     if (has(listing_words, idn)) {
    //         var listed = listing_words[idn];
    //         if (listed.is_anonymous) {
    //             console.warn(
    //                 "Anonymous chronicle",
    //                 idn,
    //                 field_name,
    //                 value.substr(0, 20)
    //             );
    //             // TODO:  Is this a problem?  Tagging anonymous users?
    //         // } else {
    //         //     console.log(
    //         //         "Chronicle",
    //         //         idn,
    //         //         field_name,
    //         //         value.substr(0, 20)
    //         //     );
    //         }
    //         listed[field_name] = value;
    //     } else {
    //         console.debug(
    //             "Non-listed chronicle",
    //             idn,
    //             field_name,
    //             value.substr(0,20)
    //         );
    //         // TODO:  keep track of non-listing words too
    //     }
    // }

    // function $data_idn(idn) {
    //     return $data('idn', idn);
    // }
    // function $data(name, value) {
    //     return $('[data-' + $.escapeSelector(name) + '=' + $.escapeSelector(value) + ']');
    // }
    function $_from_id(id) {
        return $(selector_from_id(id));
    }
    function selector_from_id(id) {
        return '#' + $.escapeSelector(id);
    }
    function selector_from_class(id) {
        return '.' + $.escapeSelector(id);
    }

    function sub($word, sub) {
        var $span = $word.find(selector_from_class(sub));
        var idn = $span.data('idn');

        // var $inner = $('<span>');
        // $span.append($inner);
        // $inner.addClass('named');
        var $inner = $span.find('.named');
        var title = sub + " = " + idn;
        var value = value_from_idn(idn);
        if (is_defined(value)) {
            title += " (" + value + ")";
        }
        $inner.attr('title', title);

        if (has(listing_words, idn)) {
            var listed = listing_words[idn];
            if (listed.hasOwnProperty('iconify')) {
                // noinspection HtmlRequiredAltAttribute,RequiredAttributes
                var $img = $('<img>', {
                    class: 'iconify',
                    src: listed.iconify,
                    alt: "icon for " + listed.name,
                    title: title + " - " + listed.name
                });
                if (listed.hasOwnProperty('word_class')) {
                    title += " - " + listed.word_class;
                }
                if (listed.hasOwnProperty('name')) {
                    title += " - " + listed.name;
                }
                $img.attr('title', title);
                $inner.replaceWith($img);
            } else if (listed.is_anonymous) {
                $inner.addClass('anonymous');
                var parts = [];
                if (has(listed, 'ip_address')) {
                    parts.push(listed.ip_address);
                }
                parts.push('#' + listed.index_number);
                if (has(listed, 'browser')) {
                    parts.push(listed.browser);
                }
                if (has(listed, 'platform')) {
                    parts.push(listed.platform);
                }
                $inner.text(parts.join(" "));

                if (has(listed, 'word_class')) {
                    title += " - " + listed.word_class;
                }
                $inner.attr('title', title);
            }
        } else {
            var $faraway_word = $_from_id(idn);
            if ($faraway_word.length === 1) {
                if (has(session_list, idn)) {
                    $inner.text("session #" + $faraway_word.attr('value'));
                } else {
                    var faraway_txt = $faraway_word.data('txt');
                    if (is_laden(faraway_txt)) {
                        $inner.text(compress_txt(faraway_txt));
                        $span.data('txt', faraway_txt);
                    } else {
                        $inner.addClass('empty');
                        $inner.text(idn);
                    }
                    if (idn === MONTY.IDN.LEX) {
                        $inner.addClass('lex');
                    }
                }
            } else {
                console.warn("Word neither listed nor lexed:", idn, $faraway_word.length);
                $inner.addClass('un-lexed');
                $inner.text("??? " + idn);
            }
        }
        return idn;
    }

    function sub_num($word) {
        var num = $word.data('num');
        if (typeof num === 'undefined') {
        } else if (typeof num === 'number') {
            if (num !== 1.0) {
                $word.find('.num').text(UNICODE.TIMES + human_number(num));
            }
        } else {
            $word.find('.num').text(UNICODE.CIRCLED_TIMES + " " + num.toString());
        }
        return num;
    }

    function sub_txt($word) {
        var txt = $word.data('txt');
        if (is_laden(txt)) {
            // var $span = $('<span>', {class: 'txt'});
            var $span = $word.find('.txt');
            $span.text(UNICODE.LEFT_DOUBLE_QUOTE + compress_txt(txt) + UNICODE.RIGHT_DOUBLE_QUOTE);
            // $word.append(" ");
            // $word.append($span);
        }
        return txt;
    }

    function sub_whn($word_previous, $word) {
        var whn_seconds = $word.data('whn');
        var word_date = date_from_whn(whn_seconds);
        var delta = delta_format(MONTY.NOW - whn_seconds);
        // var delta = delta_format(delta_seconds(word_date, now_date));
        // var delta = {units_long: "X", description_short: "8X", description_long: "Eight Ex"};
        var $span = $word.find('.whn');   // $('<span>', {class: 'whn'});
        $span.addClass(delta.units_long);
        $span.text(delta.description_short);
        $span.attr(
            'title',
            (
                delta.description_long +
                " ago: " +
                word_date.toUTCString() +
                " -or- " +
                word_date.toLocaleString() +
                " local"
            )
        );
        // $word.append($span);
        if ($word_previous !== null) {
            // var word_previous_date = date_from_whn($word_previous.data('whn'));
            var between = delta_format($word.data('whn') - $word_previous.data('whn'));
            // var between = delta_format(delta_seconds(word_previous_date, word_date));
            // var between = delta_format(60);
            // var between = {num: 60, units_long: "X", description_short: "8X", description_long: "Eight Ex"};

            // $word.addClass('delta-' + between.units_long);
            if (between.num >= 3600) {
                $word.css('border-top-color', gray_scale(log_time_scale(between.num, 333, 0)));
                if (between.num >= 7*24*3600) {
                    $word.css('border-top-width', log_time_scale(between.num, -150, 100));
                }
            }
            // $word.css('border-top-width', line_width);
            whn_delta.push(between);
        }
    }

    /**
     * The bottom triangle shows the time between the last word,
     * and when the page was loaded.
     *
     * This is of course redundant with the whn indication for that last word.
     */
    function sneak_in_one_last_whn_delta() {
        var last_delta_float = MONTY.NOW - $word_previous.data('whn');
        var last_delta_between = delta_format(last_delta_float);
        whn_delta.push(last_delta_between);
    }

    /**
     *
     * @param number {number}
     * @return {*}
     */
    function human_number(number) {
        if (Math.round(number) === number) {
            return number.toFixed(0);
        } else {
            return number.toFixed(3);
        }
    }

    /**
     * Convert seconds to a log scale.
     *
     * @param seconds
     * @param output_1_second - output value to represent 1s or shorter
     * @param output_100_years - output value to represent 100Y or longer
     * @return {*}
     */
    function log_time_scale(seconds, output_1_second, output_100_years) {
        var log_sec = Math.log(seconds);
        var omin = output_1_second;
        var omax = output_100_years;
        var log_min = Math.log(1);
        var log_max = Math.log(3600*24*365*100);
        var output = scale(log_sec, log_min, log_max, omin, omax);
        output = Math.min(output, Math.max(omin, omax));
        output = Math.max(output, Math.min(omin, omax));
        return output;
    }
    function gray_scale(gray) {
        var HH = hex_2_digits(gray);
        return '#' + HH + HH + HH;
    }
    console.assert("#000000" === gray_scale(0));
    console.assert("#ffffff" === gray_scale(255));

    function hex_2_digits(number) {
        return ('00' + Math.round(number).toString(16)).substr(-2);
        // THANKS:  Hex with zero-pad, https://stackoverflow.com/a/9909166/673991
    }
    console.assert("01" === hex_2_digits(1));
    console.assert("ff" === hex_2_digits(255));

    var MAX_TXT_LITERAL = 120;
    var BEFORE_DOTS = 80;
    var AFTER_DOTS = 20;

    function compress_txt(txt) {
        if (txt === null) {
            return "(((null)))";
        }
        if (txt.length > MAX_TXT_LITERAL) {
            var before = txt.substr(0, BEFORE_DOTS);
            var after = txt.substr(-AFTER_DOTS);
            var n_more = txt.length - BEFORE_DOTS - AFTER_DOTS;
            return before + "...(" + n_more.toString() + " characters)..." + after;
        } else {
            return txt;
        }
    }

    /**
     * Process the members of an array asynchronously.
     *
     * Avoid Chrome warnings e.g. 'setTimeout' handler took 1361ms
     *
     * THANKS:  Code derived from 4th option at https://stackoverflow.com/a/45484448/673991
     *
     * @param array - e.g. $('div')
     * @param process - callback function
     * @param delay_ms - milliseconds between calls, 0 to run "immediately" though os intervenes
     *                   (higher value means SLOWER)
     * @param n_chunk - (optional) e.g 10 to handle 10 elements per iteration
     *                  (higher value means FASTER)
     * @param then - (optional) called after array is finished, to do what's next
     * @return {object} setInterval object, pass to clearInterval() to abort early.
     */
    function array_async(array, process, delay_ms, n_chunk, then) {
        console.assert(typeof array.length === 'number', "Cannot async " + typeof array);
        if (typeof n_chunk !== 'number' || n_chunk < 1) {
            n_chunk = 1;
        }
        var i = 0;
        var interval = setInterval(function () {
            var i_chunk;
            for (i_chunk = 0 ; i_chunk < n_chunk ; i_chunk++) {
                process(array[i]);
                if (i++ >= array.length - 1) {
                    clearInterval(interval);
                    if (is_specified(then)) {
                        then();
                    }
                    return;
                }
            }
        }, delay_ms);
        return interval;
    }


    function date_from_whn(whn) {
        return new Date(whn * 1000.0);
    }
    // function delta_seconds(date_early, date_late) {
    //     return (date_late.getTime() - date_early.getTime()) / 1000.0;
    // }
    /**
     * Is a txt field nonempty?
     *
     * That is, not any of the following
     *     "" is literally the contents in the lex.
     *     undefined because the .wrend is missing a data-txt field.
     *     null because null means null
     *
     * THANKS:  Nonnegative synonym for nonempty, https://english.stackexchange.com/a/102788/18673
     *
     * @param txt - e.g. the output of $data_idn(idn, 'txt')
     * @return {boolean}
     */
    function is_laden(txt) {
        // return typeof txt === 'undefined' || txt === null || txt === "";
        return is_specified(txt) && txt !== "";
    }
    console.assert(is_laden(" "));
    console.assert(!is_laden(""));

    function is_specified(x) {
        return is_defined(x) && x !== null;
    }
    console.assert(is_specified('x'));
    console.assert(!is_specified(null));

    function is_defined(x) {
        return typeof x !== 'undefined';
    }
    console.assert(is_defined(42));
    console.assert(!is_defined(undefined));

    var SECOND = 1;
    var MINUTE = 60*SECOND;
    var HOUR = 60*MINUTE;
    var DAY = 24*HOUR;
    var MONTH = 30*DAY;
    var YEAR = 365*DAY;

    var UP_TO_SECOND = 120*SECOND;
    var UP_TO_MINUTE = 120*MINUTE;
    var UP_TO_HOUR = 48*HOUR;
    var UP_TO_DAY = 90*DAY;
    var UP_TO_MONTH = 24*MONTH;

    // CAUTION:  Because these "constants" are defined here,
    //           delta_format() can be called before it works.
    //           If called above this line (not inside a function)
    //           it will return a bunch of NaNs.
    // SEE:  const unavailable in IE10, etc., https://stackoverflow.com/a/130399/673991

    /**
     * Format a period of time in multiple human-readable formats.
     *
     * EXAMPLE:  delta_format(1) == {
     *     "num": 1,
     *     "amount_short": "1",
     *     "amount_long": "1.0",
     *     "units_short": "s",
     *     "units_long": "seconds",
     *     "description_short": "1s",
     *     "description_long": "1.0 seconds"
     * }
     * EXAMPLE:  delta_format(3628800) == {
     *     "num": 3628800,
     *     "amount_short": "42",
     *     "amount_long": "42.0",
     *     "units_short": "d",
     *     "units_long": "days",
     *     "description_short": "42d",
     *     "description_long": "42.0 days"
     * }
     *
     * @param sec - number of seconds
     * @return {{}}
     */
    function delta_format(sec) {
        function div(n, d) {
            return (n/d).toFixed(0);
        }
        function div1(n, d) {
            return (n/d).toFixed(1);
        }

        var word = {num: sec};
        if (sec === 0.0) {
            word.amount_short = "";
            word.amount_long = "";
            word.units_short = "z";
            word.units_long = "zero";
        } else if (sec <=          UP_TO_SECOND) {
            word.amount_short = div(sec, SECOND);
            word.amount_long = div1(sec, SECOND);
            word.units_short = "s";
            word.units_long = "seconds";
        } else if (sec <=          UP_TO_MINUTE) {
            word.amount_short = div(sec, MINUTE);
            word.amount_long = div1(sec, MINUTE);
            word.units_short = "m";
            word.units_long = "minutes";
        } else if (sec <=          UP_TO_HOUR) {
            word.amount_short = div(sec, HOUR);
            word.amount_long = div1(sec, HOUR);
            word.units_short = "h";
            word.units_long = "hours";
        } else if (sec <=          UP_TO_DAY) {
            word.amount_short = div(sec, DAY);
            word.amount_long = div1(sec, DAY);
            word.units_short = "d";
            word.units_long = "days";
        } else if (sec <=          UP_TO_MONTH) {
            word.amount_short = div(sec, MONTH);
            word.amount_long = div1(sec, MONTH);
            word.units_short = "M";
            word.units_long = "months";
       } else {
            word.amount_short = div(sec, YEAR);
            word.amount_long = div1(sec, YEAR);
            word.units_short = "Y";
            word.units_long = "years";
        }
        word.description_short = word.amount_short + word.units_short;
        word.description_long = word.amount_long + " " + word.units_long;

        return word;
    }
    console.assert("1s" === delta_format(1).description_short);
    console.assert("42.0 days" === delta_format(42*24*3600).description_long);

    function scale(x, i_min, i_max, o_min, o_max) {
        return (x - i_min) * (o_max - o_min) / (i_max - i_min) + o_min;
    }
    console.assert(0.5 === scale(50, 0,100, 0,1.0));

    function has(collection, thing) {
        if (typeof collection === 'undefined') {
            return false;
        } else if (collection instanceof Array) {
            return $.inArray(thing, collection) !== -1;
        } else if (collection instanceof Object) {
            return collection.hasOwnProperty(thing);
        } else if (typeof collection === 'string') {
            return collection.indexOf(thing) !== -1;
        } else {
            console.error("Don't understand has(", type_name(collection), ", )");
        }
    }
    console.assert( true === has([1, 2, 3], 2));
    console.assert(false === has([1, 2, 3], 9));
    console.assert( true === has({one:1, two:2, three:3}, 'three'));
    console.assert(false === has({one:1, two:2, three:3}, 3));
    console.assert( true === has('alphabet', 'a'));
    console.assert(false === has('alphabet', 'z'));
    console.assert(false === has(undefined, 'anything'));

    function type_name(z) {
        var the_name = typeof z;
        if (the_name === 'object') {
            the_name = z.constructor.name;
        }
        return the_name;
    }
    console.assert('number' === type_name(3));
    console.assert('Date' === type_name(new Date()));

    /**
     * Loop through object or array.  Call back on each key-value pair.
     *
     * A drop-in replacement for jQuery.each() except:
     *      `this` is the object -- UNLIKE JQUERY.EACH WHERE IT IS EACH VALUE!
     *      SEE jQuery .call():  https://github.com/jquery/jquery/blob/438b1a3e8/src/core.js#L247
     *      Reason for this incompatibility:  the one-line test #3 below
     *                                        that modifies in-place.
     * SEE:  $.each() bug for objects, https://stackoverflow.com/a/49652688/673991
     *
     * @param object - e.g. {a:1, b:2} or [1,2,3]
     * @param callback - function called on each element of the array/object
     *                   `this` is the object (not each value, as it is in jQuery.each())
     *                   key, value are the parameters
     *                       key is the name of the property for { objects }
     *                       key is the index of the array for [ arrays ]
     *                   return false (not just falsy) to prematurely terminate the looping
     * @return {*} - returns the object, a convenience for chaining I guess, maybe $.each is like that.
     */
    // TODO:  Undo incompatibility with $.each() -- could be accomplished with closure.
    // TODO:  async_interval, async_chunk, async_done optional parameters!
    //        Unifying setTimeout() and $.each(), as it were.
    //        async={interval: milliseconds, chunk:iterations_per_interval, done:callback}
    //                         default 0           default 1                     default nothing
    function looper(object, callback) {
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                var return_value = callback.call(
                    object,       // <-- 'this' is the container object
                    key,          // <-- 1st parameter - key or property name
                    object[key]   // <-- 2nd parameter - value
                );
                if (false === return_value) {
                    break;
                }
            }
        }
        return object;
    }
    var looper_test = [];
    looper({foo:1, length:0, bar:2}, function (k,v) { looper_test.push(k+"="+v); });
    console.assert("foo=1,length=0,bar=2" === looper_test.join(","));

    looper_test = [];
    looper([1,2,42,8,9], function (i,v) {looper_test.push(i+"="+v); return v!==42;});
    console.assert("0=1,1=2,2=42" === looper_test.join(","));

    console.assert('11,22,33' === looper([1,2,3], function (i, v) { this[i] = v*11; }).join());   // XXX
}

class Lex {
    constructor(url, word_class, context={}) {
        var that = this;
        that.url = url;
        that.short_name = extract_file_name(that.url);
        that.word_class = word_class;
        that.context = context;
        that.error_message = null;
        that.idn_of = null;
        that.by_idn = null;
        that.line_number = null;
    }
    scan(done, fail) {
        var that = this;
        that.idn_of = {};
        that.by_idn = {};
        var promise_jsonl = $.get({url: that.url, dataType:'text'});
        promise_jsonl.fail(function (jqxhr, settings, exception) {
            console.error("fail loading nits", jqxhr.readyState, jqxhr.status, exception);
        });
        promise_jsonl.done(function (response_body) {
            var response_lines = response_body.split('\n');
            response_lines.pop();   // Remove trailing empty string, from file ending in a newline.
            console.debug("JSONL", response_lines.length, "lines");
            that.error_message = null;
            that.line_number = 0;
            looper(response_lines, function (_, word_json) {
                that.line_number++;
                var word = that.word_from_json(word_json);
                that.each_word(word);
            });
            that.error_message ? fail(that.error_message) : done();
        });
    }
    each_word(word) {
        try{
            var that = this;
            if ( ! is_defined(that.idn_of.lex)) {
                if (
                    word.sbj === word.idn &&
                    word.obj_values[0] === word.idn &&
                    word.obj_values[1] === 'lex'
                ) {
                    that.each_definition_word(word);
                } else {
                    that.scan_fail(
                        "Expecting the word that defines 'lex' itself.  Instead",
                        word
                    );
                }
            } else if ( ! is_defined(that.idn_of.define)) {
                if (
                    word.vrb === word.idn &&
                    word.obj_values[0] === word.idn &&
                    word.obj_values[1] === 'define'
                ) {
                    that.each_definition_word(word);
                } else {
                    that.scan_fail(
                        "Expecting the word that defines 'define' itself.  Instead",
                        word
                    );
                }
            } else {
                if (
                    word.sbj === that.idn_of.lex &&
                    word.vrb === that.idn_of.define
                ) {
                    that.each_definition_word(word);
                } else {
                    that.each_reference_word(word);
                }
            }
        } catch (e) {
            if (e instanceof Lex.ScanFail) {
                that.error_message = e.toString();
            }
        }
    }
    each_definition_word(word) {
        var that = this;
        word.obj = {};
        if (word.obj_values.length !== 3) {
            that.scan_fail("Definition should have 3 objs, not:", word.obj_values);
        }
        word.obj.parent = word.obj_values.shift();   // parent or definition-definer (may be self)
        word.obj.name = word.obj_values.shift();
        word.obj.fields = word.obj_values.shift();   // array of type specifications
        // NOTE:  There are definition words and reference words.  A reference word has a vrb
        //        containing the idn of its definition word.  All words have multiple named obj
        //        parts.  The named obj parts of a definition word are:  parent, name, fields.
        //        The named obj parts of a reference word are specified in its definition
        //        word, inside its obj part named fields.
        //        A caption gives a title to a contribution. The definition word
        //        for the verb "caption" identifies those in its obj part called "fields".
        //        That is an array of the idns for the definition words for contribution and text.
        //        The many caption-reference words all have their vrb as the idn for the single
        //        caption-definition word.  Caption-reference words all have two fields named
        //        "caption" and "text".  The contribution field contains the idn of a contribution-
        //        reference word.  The text field contains text.
        // TODO:  Wouldn't it be cool if somehow this scheme could define itself.  Then the
        //        parts of all definition words would be specified as:  define, text, sequence.
        //        That is, the parts that are now named:  parent, name, fields.
        //        Doing this would require a few new definitions.  (A definition is already defined
        //        as a definition. A fields would need a new explicit definition as a sequence.  A
        //        name is already defined as something applied to a user.)
        //        Then the define-word definition would define its fields as:  parent, name, fields.
        //        Instead of hard-coding them as they are here.
        //        This would break the pattern that all definition fields are only used by
        //        reference words.  Definitions that are used by other definitions all have
        //        empty fields.
        delete word.obj_values;
        if (is_defined(that.idn_of[word.obj.name])) {
            that.scan_fail("Duplicate define", that.by_idn[that.idn_of[word.obj.name]], word);
        }
        that.idn_of[word.obj.name] = word.idn;
        that.by_idn[word.idn] = word;
    }
    each_reference_word(word) {
    }
    word_from_json(word_json) {
        var that = this;
        try {
            var word_array = JSON.parse(word_json);
        } catch (e) {
            that.scan_fail("Word JSONL error", e, word_json);
        }
        if ( ! is_a(word_array, Array)) {
            that.scan_fail("Word JSONL expecting array, not", word_array, word_json);
        }
        if (word_array.length < 4) {
            that.scan_fail("Word JSONL too few sub-nits", word_array, word_json);
        }
        var word = new that.word_class(
            word_array[0],
            word_array[1],
            word_array[2],
            word_array[3],
            null
        );
        word.obj_values = word_array.slice(4);
        return word;
    }
    scan_fail(...args) {
        var that = this;
        var name_line = f("{name}:{line}", {name:that.short_name, line:that.line_number})
        var more_args = [name_line, "-"].concat(args)
        console.error.apply(null, more_args);
        // THANKS:  Pass along arguments, https://stackoverflow.com/a/3914600/673991
        // NOTE:  This console error provides the most relevant stack trace.
        //        Good appearance:  console.error.apply(null, args)
        //        Okay appearance:  console.error(args)
        //        Poor appearance:  console.error(args.join(" "))
        throw new Lex.ScanFail(more_args.join(" "));
        // NOTE:  This error message will get passed also to the scan() function fail() callback.
    }
    static ScanFail = class ScanFail extends Error {
        constructor(message) {
            super(message);
            this.name = this.constructor.name;
        }
    }
    // THANKS:  Custom exception nested in a class, https://stackoverflow.com/a/28784501/673991
    //          Make nested exception static so it doesn't burden every instance, then you have to
    //          throw OuterClass.InnerError.  Otherwise, throw that.InnerError() gets this:
    //          Uncaught TypeError: that.ScanFail is not a constructor
}

function extract_file_name(path_or_url) {
    return path_or_url.split('/').pop().split('\\').pop().split('#')[0].split('?')[0];
}
console.assert("foo.txt" === extract_file_name('https://example.com/dir/foo.txt?q=p#anchor'));
console.assert("foo.txt" === extract_file_name('C:\\program\\barrel\\foo.txt'));

class Word {
    constructor(idn,whn,sbj,vrb,obj) {
        var that = this;
        that.idn = idn;
        that.whn = whn;
        that.sbj = sbj;
        that.vrb = vrb;
        that.obj = obj;
    }
}
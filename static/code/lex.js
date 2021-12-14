// lex.js
// ------
// Parse a .lex.jsonl file into words.  Derive classes from Lex and Word to process the words.
// Requires jQuery

(function (qiki, jQuery) {

    qiki.Lex = class Lex {
        constructor(url, word_class, context={}) {
            var that = this;
            that.url = url;
            that.short_name = url;
            that.word_class = word_class;
            that.context = context;
            that.error_message = null;
            that.idn_of = null;
            that.by_idn = null;
            that.line_number = null;
            that.from_user = {};
            that.num_lines = null;
            if (word_class === qiki.Word) {
                console.error("Derive your own Word class.");
            } else if ( ! is_strict_subclass(word_class, qiki.Word)) {
                console.error("A lex word class should be a subclass of Word:", word_class);
            }
        }
        word_factory(...args) {
            var that = this;
            var shiny_new_word_instance = new that.word_class(...args);
            shiny_new_word_instance.lex = that;
            return shiny_new_word_instance;
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
            var word = that.word_factory(
                word_array[0],
                word_array[1],
                word_array[2],
                word_array[3]
            );
            word.obj_values = word_array.slice(4);
            return word;
        }
        scan(done, fail) {   // derived classes call this to traverse the lex
            var that = this;
            that.idn_of = {};
            that.by_idn = {};
            var promise_jsonl = jQuery.get({url: that.url, dataType:'text'});
            promise_jsonl.fail(function (jqxhr, settings, exception) {
                console.error("fail loading nits", jqxhr.readyState, jqxhr.status, exception);
            });
            promise_jsonl.done(function (response_body) {
                var response_lines = response_body.split('\n');
                response_lines.pop();   // Remove trailing empty string, from file ending in a newline.
                that.error_message = null;
                that.line_number = 0;
                that.num_lines = null;
                looper(response_lines, function (_, word_json) {
                    // var word = that.word_from_json(word_json);
                    // if ( ! that.each_word(word)) {
                    //     return false;
                    //     // NOTE:  Terminate the scanning loop if any word has an error.
                    // }
                    if (that.each_word_json(word_json) === null) {
                        return false;
                        // NOTE:  Terminate the scanning loop if any word has an error.
                    }
                });
                that.num_lines = that.line_number;
                that.line_number = null;
                if (is_specified(that.error_message)) {
                    fail(that.error_message);
                } else {
                    done();
                }
            });
        }
        each_word_json(word_json) {   // callback for derived class
            var that = this;
            that.line_number++;
            that.current_word_json = word_json;
            var word_to_return;
            try {
                word_to_return = that.word_from_json(word_json);
                that.each_word(word_to_return);
                if (is_specified(that.num_lines) && that.line_number > that.num_lines) {
                    that.num_lines = that.line_number;
                    // NOTE:  This only happens if each_word_json() is called outside
                    //        the scan() loop, where num_lines is null.
                    //        We want to keep num_lines null during the scan loop because it's
                    //        not yet know.  We want to increase it here and now because
                    //        (since we got here) an additional line has been added to the lex.
                }
            } catch (e) {
                if (e instanceof qiki.Lex.ScanFail) {
                    // NOTE:  All calls to scan_fail() should end up here.
                    that.error_message = e.toString();
                    word_to_return = null;
                } else {
                    // NOTE:  Something else went wrong, perhaps a data error that should have been
                    //        detected and resulted in scan_fail().  Or perhaps an internal bug.
                    throw e;
                }
            }
            return word_to_return;
        }
        each_word(word) {   // callback for derived class
            var that = this;
            if (that.is_early_in_the_scan()) {
                if (word.is_lex_definition() || word.is_define_definition()) {
                    that.each_definition_word(word);
                } else {
                    that.scan_fail("Expecting the first words to define 'lex' and 'define'.");
                }
            } else {
                if (word.is_define()) {
                    that.each_definition_word(word);
                } else {
                    that.each_reference_word(word);
                }
            }
        }
        is_early_in_the_scan() {
            return ! is_defined(this.idn_of.lex) || ! is_defined(this.idn_of.define)
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
            word.obj_values = null;

            // NOTE:  There are definition words and reference words.  A reference word has a vrb
            //        containing the idn of its definition word.  All words have multiple named obj
            //        parts aka fields.  The named obj parts of a definition word are:  parent, name, fields.
            //        The named obj parts of a reference word are specified in its definition
            //        word, inside its obj part named fields.
            //
            //        For example, a "caption" gives a title to a contribution.
            //        There is one caption definition-word and many caption reference-words.
            //        The vrb of each caption reference-word is the idn of the caption definition-word.
            //        A caption reference-word has 2 obj parts:  contribution, text.
            //        Its contribution field value contains the idn of a contribution reference-word.
            //        Its text field value contains the text of the caption.
            //        The caption definition-word specifies the 2 fields in its obj part "fields".
            //        That is an array of the idns for the definition-words named "contribution" and
            //        "text".
             //
            // TODO:  Wouldn't it be cool if somehow this scheme could define itself.  Then the
            //        parts of all definition words would be specified as:  define, text, sequence.
            //        That is, the parts that are now named:  parent, name, fields.
            //        Maybe intermediate definitions would change these names akin to derived classes.
            //        So a parent is another define word.  A name is text.  (Watch out for name
            //        already being defined as something you apply to a user.)  And fields is
            //        a sequence of idns.
            //        : : : in other words : : :
            //        Doing this would require a few new definitions.  (A definition is already defined
            //        as a definition. A fields would need a new explicit definition as a sequence.  A
            //        name is already defined as something applied to a user.)
            //        Then the define-word definition would define its fields as:  parent, name, fields.
            //        Instead of hard-coding them as they are here.
            //        This would break the convention that definition-word fields are only used by
            //        reference-words.  Definitions that are used by other definitions all have
            //        empty fields.  So some kind of contradiction or special case might emerge.
            //        Like when do a definition-word's fields apply to a child definition, and when
            //        do they apply to a reference-word?  Maybe there's no confusion here.
            //        Then there's the possibility of defining and naming ALL word parts somewhere in
            //        some definition:  idn, whn, sbj, vrb.

            if (is_defined(that.idn_of[word.obj.name])) {
                that.scan_fail("Duplicate define", that.by_idn[that.idn_of[word.obj.name]], word);
            }
            that.idn_of[word.obj.name] = word.idn;
            that.by_idn[word.idn] = word;
        }
        each_reference_word(word) {
            var that = this;
            if ( ! has(that.by_idn, word.vrb)) {
                that.scan_fail("Word", word.idn, "vrb", word.vrb, "is not defined yet");
            }
            var vrb = that.by_idn[word.vrb];
            if (word.obj_values.length !== vrb.obj.fields.length) {
                that.scan_fail(
                    "Field mismatch:",
                    "verb", vrb.obj.name, "calls for", vrb.obj.fields.length, "fields,",
                    "but word", word.idn, "has", word.obj_values.length, "fields"
                );
            }
            word.obj = {};
            looper(word.obj_values, function (field_index_0_based, field_value) {
                var field_idn = vrb.obj.fields[field_index_0_based];
                var field_definition_word = that.by_idn[field_idn];
                if (is_specified(field_definition_word)) {
                    var field_name = field_definition_word.obj.name;
                    word.obj[field_name] = field_value;
                } else {
                    that.scan_fail(
                        "Word", word.idn,
                        "verb", vrb.obj.name,
                        "field", field_idn,
                        "not defined"
                    );
                }
            });
            word.obj_values = null;

            if (word.sbj === word.lex.idn_of.lex) {
                switch (word.vrb) {
                case that.idn_of.name:
                    that.user_remember(word.obj.user, 'name', word.obj.text);
                    break;
                case that.idn_of.iconify:
                    that.user_remember(word.obj.user, 'icon', word.obj.url);
                    break;
                case that.idn_of.admin:
                    that.user_remember(word.obj.user, 'is_admin', true);
                    break;
                default:
                    break;
                }
            }
        }

        user_remember(user, property_name, property_value) {
            var that = this;
            if ( ! has(that.from_user, user)) {
                that.from_user[user] = {};
            }
            that.from_user[user][property_name] = property_value;
        }

        /**
         * Raise a ScanFail exception -- only called by each_word() or subordinates.
         *
         * @param args - text and variables to be passed to console.error().
         */
        scan_fail(...args) {
            var that = this;
            var name_line = f("{name} line {line}", {name:that.short_name, line:that.line_number})
            var more_args = [...args, "\nScan failed on " + name_line +":\n", that.current_word_json]

            console.error.apply(null, more_args);
            // THANKS:  Pass along arguments, https://stackoverflow.com/a/3914600/673991
            // NOTE:  This console error provides the most relevant stack trace.
            //        Good appearance:  console.error.apply(null, args)
            //        Okay appearance:  console.error(args)
            //        Poor appearance:  console.error(args.join(" "))

            throw new qiki.Lex.ScanFail(more_args.join(" "));
            // NOTE:  This error message will get passed also to the scan() function fail() callback.
            //        But since that message is a string, it may be less informative than what
            //        console.error() produced above.
        }
        static ScanFail = class ScanFail extends Error {
            constructor(message) {
                super(message);
                this.name = this.constructor.name;
            }
        }
        // THANKS:  Custom exception nested in a class, https://stackoverflow.com/a/28784501/673991
        //          Make this nested class a static class property, so it doesn't burden every
        //          instance.  This means you have to throw OuterClass.InnerError.
        //          Otherwise, throw that.InnerError() gets this:
        //          Uncaught TypeError: that.ScanFail is not a constructor

        /**
         * Is one idn a sort-of descendent of another?
         *
         * Yes examples:
         *     3504, 3504
         *     [168, 1267], 168
         *
         * This parent-child relationship applies to idns that explicitly identify their basis.
         * So far this is only done for google or anonymous users.
         * This is different from the parent-child relationship created by vrb definitions.
         */
        static is_a(idn_child, idn_parent) {
            if (idn_child === idn_parent) {
                return true;
            }
            // FALSE WARNING:  'if' statement can be simplified
            // noinspection RedundantIfStatementJS
            if (is_a(idn_child, Array) && idn_child.length >= 1 && idn_child[0] === idn_parent) {
                return true;
                // TODO:  Get an ancestry of idn_child and see if parent is anywhere in it.
                //        Right now this will NOT work:  if (lex.is_a(w.sbj, lex.idn_of.user)
            }
            // TODO:  Less alarming name collision between Lex.is_a() and window.is_a().
            return false;
        }
        static is_equal_idn(idn1, idn2) {
            return idn1.toString() === idn2.toString();
            // THANKS:  Compare arrays as strings, https://stackoverflow.com/a/42186143/673991
        }

        is_anonymous(user_idn) {
            return qiki.Lex.is_a(user_idn, this.idn_of.anonymous);
        }
        is_authenticated(user_idn) {
            return this.is_google_user(user_idn);
        }
        is_google_user(user_idn) {
            return qiki.Lex.is_a(user_idn, this.idn_of.google_user);
        }
        is_admin(user_idn) {
            var user_word = this.from_user[user_idn];
            return is_specified(user_word) && user_word.is_admin;
        }
        possessive(user_idn) {
            var user_word = this.from_user[user_idn];
            if (is_specified(user_word) && is_specified(user_word.name)) {
                return user_word.name + "'s";
            } else {
                return "my";
            }
        }

    }
    console.assert(true === qiki.Lex.is_equal_idn([11,"22"], [11,"22"]));

    qiki.Word = class Word {
        lex = null;
        static MILLISECONDS_PER_WHN = 1.0;   // whn is milliseconds since 1970
        static SECONDS_PER_WHN = 0.001;   // whn is milliseconds since 1970
        // NOTE:  Maybe someday to save memory make the lex instance a static property of the derived
        //        Word class.  That way each word instance will know its lex instance but won't be
        //        burdened with storing it in every word instance.  But not today.
        constructor(idn,whn,sbj,vrb,obj=null) {
            var that = this;
            that.idn = idn;
            that.whn = whn;
            that.sbj = sbj;
            that.vrb = vrb;
            that.obj = obj;   // named object values (after word is resolved)
            that.obj_values = null;   // indexed object values (after nit json decoded, before resolved)
        }
        vrb_name() {
            var that = this;
            if ( ! (that.lex instanceof qiki.Lex)) {
                return "LEX NOT DEFINED";
                // NOTE:  Only Lex.word_factory() should instantiate words.
            }
            if ( ! is_specified(that.lex.by_idn)) {
                return "LEX NOT SCANNED";
            }
            if ( ! has(that.lex.by_idn, that.vrb)) {
                return f("VRB {vrb} NOT DEFINED", {vrb: that.vrb})
            }
            return that.lex.by_idn[that.vrb].obj.name;
        }
        field_values() {
            var that = this;
            if (is_specified(that.obj_values)) {
                return that.obj_values;
            } else {
                return Object.values(that.obj);
                // THANKS:  Objects retain insertion order, and Object.values() reflects it.
                //          https://stackoverflow.com/a/23202095/673991
                // CAUTION:  As long as the keys are neither integers NOR strings of decimal digits!
                //           Those always come first and in numerical order, not alpha, not insert.
            }
        }
        is_define() {
            return (
                this.sbj === this.lex.idn_of.lex &&
                this.vrb === this.lex.idn_of.define
            );
        }
        is_lex_definition() {
            var that = this;
            if (is_defined(that.lex.idn_of.lex)) {
                return that.idn === that.lex.idn_of.lex;
            } else {
                return (
                    that.sbj === that.idn &&
                    that.obj_values[0] === that.idn &&
                    that.obj_values[1] === 'lex'
                );
            }
        }
        is_define_definition() {
            var that = this;
            if (is_defined(that.lex.idn_of.define)) {
                return that.idn === that.lex.idn_of.define;
            } else {
                // NOTE:  The following works even when .is_defined() can't be used yet,
                //        because idn_of.define hasn't been set yet,
                //        because the 'define' definition-word hasn't been scanned yet.
                return (
                    that.vrb === that.idn &&
                    that.obj_values[0] === that.idn &&
                    that.obj_values[1] === 'define'
                );
            }
        }
        whn_seconds() {
            return this.whn * qiki.Word.SECONDS_PER_WHN;
        }
        whn_milliseconds() {
            return this.whn * qiki.Word.MILLISECONDS_PER_WHN;
        }
        whn_date() {
            return new Date(this.whn_milliseconds());
        }
        is_sbj_anonymous() {
            return this.lex.is_anonymous(this.sbj);
        }
        is_sbj_google_user() {
            return this.lex.is_google_user(this.sbj);
        }
    }

})(window.qiki = window.qiki || {}, jQuery);

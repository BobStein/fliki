// lex.js
// ------
// Parse a .lex.jsonl file into words.  Derive classes from Lex and Word to process the words.
// Requires jQuery
//
// TODO:  Move to qiki.js

window.qiki ||= {};
(function (qiki, $) {

    /**
     * Lex - a collection of Words
     */

    qiki.Nit = class Nit {
        get bytes() {
            throw new Error("Nit subclass " + this.constructor.name + " should implement bytes()");
        }
        get nits() {
            throw new Error("Nit subclass " + this.constructor.name + " should implement nits()");
        }
    }

    qiki.Lex = class Lex {
        constructor() {
            var that = this;
            that.idn_of = {};
            that.expect_definitions('lex', 'define');
        }
        /**
         * Instantiate a word in this lex.  Expect word_class to be Word or a derived class.
         */

        expect_definitions(...names) {
            var that = this;
            looper(names, function (_, name) {
                if ( ! has(that.idn_of, name)) {
                    that.idn_of[name] = qiki.Lex.IDN_NOT_YET_DEFINED;
                }
            });
        }
        missing_definitions() {
            var that = this;
            var expected_but_undefined_names = [];
            looper(that.idn_of, function(name, idn) {
                if (idn === qiki.Lex.IDN_NOT_YET_DEFINED) {
                    expected_but_undefined_names.push(name);
                }
            });
            return expected_but_undefined_names;
        }

        static is_equal_idn(idn1, idn2) {
            console.assert(qiki.Lex.is_idn_defined(idn1));
            console.assert(qiki.Lex.is_idn_defined(idn2));
            return (
                qiki.Lex.is_idn_defined(idn1) &&
                qiki.Lex.is_idn_defined(idn2) &&
                String(idn1) === String(idn2)
            );
        }
        /**
         * Is one idn a sort-of descendent of another?
         *
         * Yes examples:
         *     3504, 3504
         *     [168, 1267], 168
         *
         * This parent-child relationship applies to idns that explicitly identify their basis.
         * So far, this is only done for google or anonymous users.  But it could also work for
         * detecting that the sequence field in an interaction bot word is a sequence.  E.g.
         *     qiki.Lex.is_a([198,6469,1936,7513,1849,1851,1857], 198)
         *
         * This relationship is different from the parent-child relationship created by vrb
         * definitions, and named explicitly in every definition.obj.parent field.
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

        /**
         * Singleton value for the idn of an expected definition.
         *
         * TODO:  Eventually the app should create these definitions if they don't exist, not
         *        just test for them.  So that a virgin lex will be populated with app-specific
         *        definitions.  By the way, we need to auto-magically create a virgin lex too.
         */
        static IDN_NOT_YET_DEFINED = ['IDN_NOT_YET_DEFINED'];
        static is_idn_defined(idn) {
            return is_defined(idn) && idn !== qiki.Lex.IDN_NOT_YET_DEFINED;
        }
        static presentable(string) {
            if ( ! is_string(string)) {
                string = JSON.stringify(string);
            }
            // noinspection RegExpRedundantEscape
            string = string.replace(/[^\w\s\[\]\.\,\'\"]/g, '*');
            string = string.trim();
            if (string.length > 40) {
                string = string.substring(0, 37) + "...";
            }
            return string;
        }
    }
    console.assert(true === qiki.Lex.is_equal_idn([11,"22"], [11,"22"]));

    /**
     * A Bunch is an ordered container of words.
     *
     * Words will be identified by idn.  Use bunch.get(idn) to retrieve.
     * Words may be identified by name.  Use bunch.by_name.name to retrieve.
     *                                   Only for each word where word.obj.name is a unique string.
     *
     * Dumb stuff calls the .notify callback function.  By default it's a console.warn().
     * This can be changed after instantiation, e.g.:
     *     bunch.notify = function () {} to ignore.
     *     bunch.notify = console.error.bind(console) to elevate the message.
     * Dumb stuff includes:
     *     delete(idn_nonexistent)
     *     add_left_of(w, nonexistent_idn)
     *     replace(nonexistent_idn, new_word)
     * Each case returns false, and explains in notify callback.
     *
     * Any reason to make this a Lex?  A local, in-memory thing?
     */
    qiki.Bunch = class Bunch {
        constructor() {
            var that = this;
            that._words = [];
            that.by_name = {};
            that.notify = console.warn.bind(console);
        }
        num_words() {
            return this._words.length;
        }
        add_rightmost(word) {
            var that = this;
            that._words.push(word);
            that._remember_name_if_any(word, word.obj.name);
        }
        add_leftmost(word) {
            var that = this;
            that._words.unshift(word);
            that._remember_name_if_any(word, word.obj.name);
        }
        add_left_of(word, idn_locus) {
            var that = this;
            var [word_locus, index_locus] = that._get_word_and_index(idn_locus);
            if (word_locus === null) {
                that.notify("Cannot add_left_of", word, idn_locus, that);
                return false;
            } else {
                that._words.splice(index_locus, 0, word);
                return true;
            }
        }
        delete(idn_locus) {
            var that = this;
            var [word_locus, index_locus] = that._get_word_and_index(idn_locus);
            if (word_locus === null) {
                that.notify("Cannot delete", idn_locus, that);
                return false;
            } else {
                that._words.splice(index_locus, 1);
                return true;
            }
        }
        _remember_name_if_any(word, name) {
            var that = this;
            if (is_specified(name)) {
                that.by_name[name] = word;
            }
        }
        has(idn) {
            return this.get(idn) !== null;
        }
        _get_word_and_index(idn) {
            var that = this;
            var word_and_index = [null, null];
            looper(that._words, function (index, word) {
                if (word.idn === idn) {
                    word_and_index = [word, index];
                    return false;
                }
            });
            return word_and_index;
        }
        first() {
            return this._words[0];   // Return `undefined` if the bunch contains no words.
        }
        get(idn) {
            return this._get_word_and_index(idn)[0];
        }
        replace(idn_old, word_new) {
            var that = this;
            var [word_old, index_old] = that._get_word_and_index(idn_old);
            if (word_old === null) {
                that.notify("Cannot replace", idn_old, word_old, that);
                return false;
            } else {
                that._words[index_old] = word_new;
                return true;
            }
        }
        loop(callback) {
            var that = this;
            looper(that._words, function (index, word) {
                return callback(word);
            });
        }
        idn_array() {
            var that = this;
            var array_answer = [];
            that.loop(function (word) {
                array_answer.push(word.idn);
            });
            return array_answer;
        }
    }

    // noinspection SpellCheckingInspection,JSUnusedLocalSymbols
    const GHOST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXR' +
        'FWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQ1JREFUeNqkk0sKwjAQhk2tiiiICO70BB7BlVdw3xs' +
        'InqM7D+ItPIIL1yoigoivpj7jH/gDQ03dKHzk4eSbybRVxpjCP7/QTZRSbtoFQ9ADTXAAczAFSxsgkyq3oKAPxqA' +
        'CHuANAlACKZiAmRQEopoOGIEyg2+ClPsjxnkFA14pATqHkHFeQYuHLVHmYMT9K+O+m2jbAC68e4Fzw323DsX6S5A' +
        'KQcxsrokx/3PN9ApsiWfwJG8hsIeKokdegWYWKXBXKAqB/lWBFbyIrCAQkuRXD07M6BMEIi5XsOJjOoIauPMFsg1' +
        'tgD2r8L4HO7AWouyoOe7yKlgwWx1sQRts+EHZdZXjXQrUv5/zR4ABAPsZavU4qlAlAAAAAElFTkSuQmCC';
    // noinspection SpellCheckingInspection,JSUnusedLocalSymbols
    const PORTRAIT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAA' +
        'BGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAABXUExURWFaUf///wAA' +
        'AO7u7WNcU2hiWc/NyqCcl3JrY7y5tbWxrWVeVYF7dLq3s46JgmpkW5eSjPDv72xmXYqFfoyHgOvq6Ozs656aldLQ' +
        'zpOOiOfm5JWQiuXk4njm0WsAAAC1SURBVHjalNLXFoIwEEXRgZkk9KYUy/9/pxpcKWRi8DzCXtQLeSLIMxOWXUPU' +
        'dCXaYw4YFcE3UmMINgFOYjuCFg61PpB0BCRdgD0E9egABUzKgoU4QIsBFbBVBlx4cDWg4EFhQM2D+jxI3iL5kMnX' +
        'nPkPNZ//1BmK8LxA73eHQP43mPc1/MnJcLS42tGuyKx6nz1AdPZ8GuDA/oxiwB3cJ4g0PTV4QLSbBn0cCA3gRx+Q' +
        '6CXAAPj+Bhc3Y6MSAAAAAElFTkSuQmCC';
    // THANKS:  Image to data conversion, https://ezgif.com/image-to-datauri
    const ICON_FOR_NO_ICON = GHOST_ICON;

    qiki.Agent = class Agent {
        // TODO:  Maybe this should inherit from a more generic qiki.Word() that has idn and lex,
        //        and qiki.Word() should be renamed qiki.Sentence() and derive from qiki.Word too.
        //        Then we could encapsulate idn_presentable(), idn_json(), etc.
        //        Maybe description too, aka name.  With long and short versions, or
        //        with continual variation based on length of characters.
        //        This could help in meta lex describe a contribution briefly by extracting text
        //        or using its caption, or both.
        //        Also, LexClient.agent_cache could be some kind of memory Lex.
        //        Also, Bunch could be a Lex.  Maybe call it a LexCache.
        constructor(lex, idn) {
            var that = this;
            that.lex = lex;
            that.idn = idn;
            that.name = null;
            that.icon = ICON_FOR_NO_ICON;
            that.is_admin = false;
        }
        is_anonymous() {
            return qiki.Lex.is_a(this.idn, this.lex.idn_of.anonymous);
        }
        is_google_user() {
            return qiki.Lex.is_a(this.idn, this.lex.idn_of.google_user);
        }
        is_authenticated() {
            return this.is_google_user(this.idn);
        }
        is_named() {
            return is_laden(this.name);
        }
        name_presentable() {
            var that = this;
            if (that.is_named()) {
                return qiki.Lex.presentable(that.name);
            }
            return that.idn_presentable()
        };
        idn_presentable() {
            return qiki.Lex.presentable(this.idn);
        }
    }

    /**
     * A lex stored on an internet server.
     *
     * TODO:  Give a Lex object ways to read or write words with composition instead of subclassing.
     *        lex.reader(Reader(url))
     *        lex.writer(Writer(url))
     *
     * @property LexClient.idn_of.admin
     * @property LexClient.idn_of.anonymous
     * @property LexClient.idn_of.google_user
     */
    qiki.LexClient = class LexClient extends qiki.Lex {
        constructor(url, event_handlers) {
            super()
            var that = this;
            that.url = url;
            that.event_handlers = event_handlers;
            that.event_handlers.done ||= function () {};
            that.event_handlers.fail ||= error_message => console.error(error_message);
            that.by_idn = {};
            that.agent_cache = {};
            that.agent_representing_lex_itself = null;
            that.error_message = null;
            that.line_number = 0;   // 0-based before each_json(), 1-based after it.
            that.num_lines = null;
            that.expect_definitions(
                'iconify',
                'name',
                'admin',
                'google_user',
                'anonymous',
            );

            var promise_jsonl = $.get({url: that.url, dataType:'text'});
            promise_jsonl.fail(function (jqxhr, settings, exception) {
                console.error("Lex.scan, ajax get:", jqxhr, settings, exception);
                that.event_handlers.fail("Failure to get lex for scan: " + jqxhr.responseText);
                // THANKS:  responseText is the needle in the fail callback haystack,
                //          https://stackoverflow.com/a/12116790/673991
                // SEE:  jqXHR, https://api.jquery.com/jQuery.Ajax/#jqXHR
            });
            promise_jsonl.done(function (response_body) {
                var response_lines = response_body.split('\n');
                response_lines.pop();
                // NOTE:  Remove trailing empty string, because the file ends in a newline.

                looper(response_lines, function (_, word_json) {
                    if (that.each_json(word_json) === null) {
                        return false;
                        // NOTE:  Terminate the scanning loop if any word has an error.
                    }
                });
                that.num_lines = that.line_number;
                that.line_number = null;

                if (is_specified(that.error_message)) {
                    that.event_handlers.fail(that.error_message);
                } else {
                    var no_idn_for = that.missing_definitions();
                    if (no_idn_for.length === 0) {
                        that.event_handlers.done();
                    } else {
                        that.error_message = "Missing definitions: " + no_idn_for.join(", ");
                        that.event_handlers.fail(that.error_message);
                    }
                }
            });
        }
        word_event(word, ...event_names) {
            var that = this;
            type_should_be(word, qiki.Word);
            should_be_array_like(event_names, String);
            var leaf = that.event_handlers;   // event_handler;
            var is_a_hit = true;
            looper(event_names, function (level, event_name) {
                if (/*is_associative_array(leaf) && */has(leaf, event_name)) {
                    leaf = leaf[event_name];
                } else {
                    is_a_hit = false;
                    return false;
                }
            });
            if (is_a_hit) {
                if (is_a(leaf, Function)) {
                    // NOTE:  Supports future finer-grained events.
                    //        Or does that confuse things, and even degrade security?
                    //        If e.g. event_handler.vrb.contribute has a sub-event,
                    //        event_tree.vrb.contribute.superseded.
                    // TODO:  This is all fine and good if event names are created by trusted
                    //        parties, both the triggering and the handling.  How might untrusted
                    //        parties do either?
                    leaf(word);
                } else {
                    console.warn("Event handler is not a function", ...event_names, leaf);
                }
            }
        }
        each_json(word_json) {
            var that = this;
            that.line_number++;
            that.current_word_json = word_json;
            var word_to_return;
            try {
                word_to_return = that.word_from_json(word_json);
                that.each_word(word_to_return);
                if (is_specified(that.num_lines) && that.line_number > that.num_lines) {
                    that.num_lines = that.line_number;
                    // NOTE:  This only happens if each_json() is called outside the scan() loop,
                    //        because num_lines is null inside the scan() loop.
                    //        That happens in the callback of create_word.
                    //        We want to keep num_lines null during the scan loop because it's
                    //        not yet know.  We want to increase it here and now because
                    //        (since we got here) an additional line has been added to the lex.
                    // TODO:  Er, maybe this increase should happen in create_word() and
                    //        create_word() should be a LexClient member.
                }
            } catch (e) {
                if (e instanceof qiki.LexClient.ScanFail) {
                    // NOTE:  All calls to scan_fail() should end up here.
                    that.error_message = String(e);
                    word_to_return = null;
                } else {
                    // NOTE:  Something else went wrong, perhaps a data error that should have been
                    //        detected and resulted in scan_fail().  Or perhaps an internal bug.
                    throw e;
                }
            }
            return word_to_return;
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
            var word = that.word_factory(...word_array);
            return word;
        }
        each_word(word) {   // callback for derived class
        }
        /**
         * Allow a lex-subclass to give words a vrb-dependent word-subclass, e.g.
         *
         * @param idn
         * @param whn
         * @param sbj
         * @param vrb
         * @param obj_values
         * @returns {qiki.Word}
         *
         * TODO:  D.R.Y. - don't pass all this stuff to several different functions.
         */
        word_class(idn, whn, sbj, vrb, ...obj_values) {
            return qiki.Word;
        }
        word_factory(idn, whn, sbj, vrb, ...obj_values) {
            var that = this;
            var the_word_class = that.word_class(idn, whn, sbj, vrb, ...obj_values);
            var the_word_instance = new the_word_class(that, idn, whn, sbj, vrb, ...obj_values);
            return the_word_instance;
        }
       is_early_in_the_scan() {
            return (
                ! this.have_we_processed_the_definition_of('lex') ||
                ! this.have_we_processed_the_definition_of('define')
            );
        }
        have_we_processed_the_definition_of(name) {
            var that = this;
            type_should_be(name, String);
            return qiki.Lex.is_idn_defined(that.idn_of[name]);
        }

        // NOTE:  Hardwired fields for a definition word.
        static I_DEFINITION_PARENT = 0;
        static I_DEFINITION_NAME   = 1;
        static I_DEFINITION_FIELDS = 2;   // Definitions have a field called 'fields'
        static N_DEFINITION        = 3;
        // TODO:  Specify these in the lex, and make the circularity not dumb.

        each_definition_word(word) {
            var that = this;
            word.obj = {};
            if (word.obj_values.length !== qiki.LexClient.N_DEFINITION) {
                that.scan_fail("Definition should have 3 objs, not:", word.obj_values);
            }
            word.obj.parent = word.obj_values[qiki.LexClient.I_DEFINITION_PARENT];
            word.obj.name   = word.obj_values[qiki.LexClient.I_DEFINITION_NAME];
            word.obj.fields = word.obj_values[qiki.LexClient.I_DEFINITION_FIELDS];
            word.obj_values = null;

            // NOTE:  There are definition words and reference words.  A reference word has a vrb
            //        containing the idn of its definition word.  All words have multiple named obj
            //        parts aka fields.  The named obj parts of a definition word are:  parent,
            //        name, fields.  The named obj parts of a reference word are specified in its
            //        definition word, inside its obj part named fields.
            //
            //        For example, for unslumping.org, a "caption" gives a title to a contribution.
            //        There is one caption definition-word and many caption reference-words.
            //        The vrb of each caption reference-word is the idn of the caption
            //        definition-word.  A caption reference-word has 2 obj parts:  contribution,
            //        text.  Its contribution field value contains the idn of a contribution
            //        reference-word.  Its text field value contains the text of the caption.
            //        The caption definition-word specifies the 2 fields in its obj part "fields".
            //        That is an array of the idns for the definition-words named "contribution" and
            //        "text".
             //
            // TODO:  Wouldn't it be cool if somehow this scheme could define itself.  Then the
            //        parts of all definition words would be specified as:  define, text, sequence.
            //        That is, the parts that are now named:  parent, name, fields.
            //        Maybe intermediate definitions would change these names akin to derived
            //        classes.  So a parent is another define word.  A name is text.  (Watch out for
            //        name already being defined as something you apply to a user.)  And fields is
            //        a sequence of idns.
            //        : : : in other words : : :
            //        Doing this would require a few new definitions.  (A definition is already
            //        defined as a definition. A fields would need a new explicit definition as a
            //        sequence.  A name is already defined as something applied to a user.)
            //        Then the define-word definition would define its fields as:  parent, name,
            //        fields.  Instead of hard-coding them as they are here.
            //        This would break the convention that definition-word fields are only used by
            //        reference-words.  Definitions that are used by other definitions all have
            //        empty fields.  So some kind of contradiction or special case might emerge.
            //        Like when do a definition-word's fields apply to a child definition, and when
            //        do they apply to a reference-word?  Maybe there's no confusion here.
            //        Then there's the possibility of defining and naming ALL word parts somewhere
            //        in some definition:  idn, whn, sbj, vrb.

            if (that.have_we_processed_the_definition_of(word.obj.name)) {
                that.scan_fail("Duplicate define", that.by_idn[that.idn_of[word.obj.name]], word);
            }
            that.idn_of[word.obj.name] = word.idn;
            that.by_idn[word.idn] = word;

            var parent = that.by_idn[word.obj.parent];
            that.word_event(word, 'parent', parent.obj.name)
            // TODO:  Wouldn't it be cool if this expression:
            //            that.by_idn[word.obj.parent].obj.name
            //        could be this:
            //            word.parent.name
            //        In other words:
            //            named obj parts were word parts:  parent.name vs parent.obj.name
            //            and word parts were (germinal) words:  parent vs that.by_idn[parent]
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

            // TODO:  The three categories of words should maybe be more distinct:
            //        lex-definition, lex-reference, user-reference.
            //        Maybe one day there will be user-definition words (e.g. custom verbs)
            //        although probably not because we don't want internal code names
            //        and user verb names stepping on each others toes.  So probably there will
            //        always and forever only be these three distinct sets.  Anyway, the following
            //        if-clause is the only place that lex-reference words are processed.
            //        Maybe things would be more secure if they were not munged up with user-
            //        reference words (by derived classes that override each_reference_word().
            //        Name candidates?  That aren't effing confusifying like "user words"?!
            //        definition word, app word, system word.  Yuck.
            //        Hey wait, there could be user-definition words where each pairing of
            //        sbj and obj.parent gets its own name-space.
            //        Nah, maybe each sbj.  (IOW don't use obj.parent for two purposes, as it's now
            //        used for a kind of inheritance type hierarchy.)
            //        But I still think a separate vrb could be defined for users to create custom
            //        qoolbar icons to themselves be used as vrb in user-reference words.
            //        So user "definitions" would in fact be user-reference words, at least in
            //        LexClient.each_word().

            if (word.sbj === word.lex.idn_of.lex) {
                switch (word.vrb) {
                case that.idn_of.name:
                    that.agent_remember(word.obj.user, 'name', word.obj.text);
                    break;
                case that.idn_of.iconify:
                    that.agent_remember(word.obj.user, 'icon', word.obj.url);
                    break;
                case that.idn_of.admin:
                    that.agent_remember(word.obj.user, 'is_admin', true);
                    break;
                default:
                    break;
                }
            }
            that.word_event(word, 'vrb', vrb.obj.name);
        }

        agent_from_idn(agent_idn) {
            var that = this;
            if ( ! has(that.agent_cache, agent_idn)) {
                // TODO:  May one day have to be a lot more selective about whom we cache.
                that.agent_cache[agent_idn] = new qiki.Agent(that, agent_idn);
            }
            return that.agent_cache[agent_idn];
        }
        agent_remember(agent_idn, property_name, property_value) {
            var that = this;
            var agent = that.agent_from_idn(agent_idn);
            agent[property_name] = property_value;
            // TODO:  Limit property names to:  name, icon, is_admin
        }
        // TODO:  Encapsulate in some kind of Agent container.

        /**
         * Raise a ScanFail exception -- only called by each_word() or subordinates.
         *
         * @param args - text and variables to be passed to console.error().
         */
        scan_fail(...args) {
            var that = this;
            var name_line = f("{name} line {line}", {
                name:that.constructor.name,
                line:that.line_number
            });
            var more_args = [
                ...args,
                "\nScan failed on " + name_line + ":\n" + that.current_word_json
            ]

            console.error.apply(null, more_args);
            // THANKS:  Pass along arguments, https://stackoverflow.com/a/3914600/673991
            // NOTE:  This console error provides the most relevant stack trace.
            //        Good appearance:  console.error.apply(null, args)
            //        Okay appearance:  console.error(args)
            //        Poor appearance:  console.error(args.join(" "))

            throw new qiki.LexClient.ScanFail(more_args.join(" "));
            // NOTE:  This error message will get passed also to the scan() function fail()
            //        callback.  But since that message is a string, it may be less informative than
            //        what console.error() produced above.
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
         * Add a word to the lex.
         *
         * TODO:  qoolbar and LexClient should know about each other or merge or something.
         *        Maybe encapsulating ajax calls there, which is good.
         *        Then ajax_url needs to be some app-specific configurable value,
         *        along with LexClient.url used for scanning.
         *        Duh, the REST way is to use the SAME url for both and the method
         *        would be GET or POST.
         *        Huh, including a way to GET the whole lex (async of course) or
         *        one word by idn, or multiple words by search criteria.
         *        So lex.py needs a REST-ful server and lex.js a REST-ful client.
         *
         * @param vrb_name - e.g. 'edit'
         * @param objs_by_name - e.g. {contribute: idn, text: "new contribution text"}
         * @param done_callback
         * @param fail_callback
         */
        create_word(vrb_name, objs_by_name, done_callback, fail_callback) {
            var that = this;
            done_callback = done_callback || function () {};
            fail_callback = fail_callback || function (message) { console.error(message); };
            qoolbar.post(
                'create_word',
                {
                    vrb_name: vrb_name,
                    objs_by_name: JSON.stringify(objs_by_name)
                },
                // NOTE:  jQuery.post() will handle data being a nested object, but it uses weird
                //        bracket scheming to encode the deeper parts.  JSON within MIME type
                //        application/x-www-form-urlencoded is slightly more sane.
                // SEE:  Square brackets in URIs, https://stackoverflow.com/a/30400578/673991
                /**
                 * Handle a valid response from the create-word ajax.
                 *
                 * @param response_object
                 * @param response_object.jsonl - JSON of array of the created word's bytes & nits.
                 */
                function done_creating_a_word(response_object) {
                    var word_json = response_object.jsonl;
                    var word_created = that.each_json(word_json);
                    if (word_created === null) {
                        fail_callback("JSONL error");
                    } else {
                        done_callback(word_created);
                    }
                },
                fail_callback
            );
        }
    }

    qiki.Word = class Word {
        static MILLISECONDS_PER_WHN = 1.0;   // whn is milliseconds since 1970
        static SECONDS_PER_WHN = 0.001;   // whn is milliseconds since 1970

        /**
         * Word constructor
         *
         * @param lex - every word knows the lex it belongs to
         * @param idn - identifier, probably an integer
         * @param whn - milliseconds since 1970 when the word was stored in the lex
         * @param sbj - idn of the subject or owner or user responsible for the word
         * @param vrb - idn of the verb
         * @param obj_values - unnamed values of the word's objects.
         *                     The verb definition leads to the names.
         *
         * TODO:  Make lex a static property of the derived Word class.  That way each word
         *        instance will know its lex instance but won't be burdened with storing it in
         *        every word instance.
         *        Could lead to an oppressively tall hierarchy of word classes, e.g.:
         *        qiki.Word:
         *            AllContributionWords:   <-- static lex;
         *                ContributionWord:
         *                    ContributeOriginalWord
         *                    EditWord
         *                CaptionWord
         *                RearrangeWord
         *        Plus layers on top of that for
         *            generic Contribution application innards versus
         *            specific Unslumping implementation
         */
        constructor(lex, idn, whn, sbj, vrb, ...obj_values) {
            var that = this;
            that.lex = lex;
            that.idn = idn;
            that.whn = whn;
            that.sbj = sbj;
            that.vrb = vrb;
            that.obj = null;
            that.obj_values = obj_values;

            // TODO:  Better as a getter property?  Then lex and inconsequential users can still
            //        have an agent that's an object with methods.

            // NOTE:  word.obj_values is a numerically indexed array.  It was passed to constructor.
            //        word.obj        is a named associative array.  It will get populated below.

            // TODO:  Hmm, should the decisions below be moved to LexClient.word_factory()?
            //            qiki.WordDefinition constructor absorb LexClient.each_definition_word()
            //            qiki.WordReference constructor  absorb LexClient.each_reference_word()
            //        A reason not to do that:  Someone smarter than me should break down the
            //        difference between these.  A lex definition could just be like any other word,
            //        with fields defined in the lex.  It's got extra powers for sure, but maybe
            //        those can be safely associated with the .sbj property, not with the class.
            if (that.lex.is_early_in_the_scan()) {
                if (that.is_the_definition_of_lex_itself()) {
                    that.lex.each_definition_word(that);
                    that.lex.agent_remember(that.idn, 'name', 'lex');
                } else if (that.is_the_definition_of_define_itself()) {
                    that.lex.each_definition_word(that);
                } else {
                    throw that.lex.scan_fail(
                        "The first words should define 'lex' and 'define' themselves."
                    );
                }
            } else {
                if (that.is_definition()) {
                    that.lex.each_definition_word(that);
                } else {
                    that.lex.each_reference_word(that);
                }
            }
        }

        get agent() {
            return this.lex.agent_from_idn(this.sbj);
            // NOTE:  This getter method, where every use of the agent "property" searches by idn,
            //        is optimized for less memory, more compute time.  But maybe every word
            //        instance should have an agent property.
        }

        idn_presentable() {
            return qiki.Lex.presentable(this.idn);
        }
        parent_name() {
            return this.lex.by_idn[this.obj.parent].obj.name;
        }
        /**
         * Get a printable name for this word's vrb.  Behave in all kinds of circumstances.
         * @returns {string}
         */
        vrb_name() {
            var that = this;
            if ( ! (that.lex instanceof qiki.Lex)) {
                return "LEX NOT DEFINED";
            }
            if ( ! is_specified(that.lex.by_idn)) {
                return "LEX NOT SCANNED";
            }
            if ( ! has(that.lex.by_idn, that.vrb)) {
                return f("VRB {vrb} NOT DEFINED", {vrb: that.vrb})
            }
            var vrb_word = that.lex.by_idn[that.vrb];
            if ( ! is_specified(vrb_word)) {
                return f("VRB {vrb} EMPTY DEFINITION", {vrb: that.vrb})
            }
            if ( ! is_specified(vrb_word.obj)) {
                return f("VRB {vrb} HAS NO OBJ", {vrb: that.vrb})
            }
            if ( ! is_laden(vrb_word.obj.name)) {
                return f("VRB {vrb} HAS NO NAME", {vrb: that.vrb})
            }
            return vrb_word.obj.name;
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
        is_definition() {
            return (
                this.sbj === this.lex.idn_of.lex &&
                this.vrb === this.lex.idn_of.define
            );
        }
        /**
         * Works on the 'lex' definition word before it has been processed, by slight trickery.
         *
         * And it works after that without the trickery.
         */
        is_the_definition_of_lex_itself() {
            var that = this;
            if (that.lex.have_we_processed_the_definition_of('lex')) {
                return that.idn === that.lex.idn_of.lex;
            } else {
                return (
                    that.sbj === that.idn &&
                    that.obj_values[0] === that.idn &&
                    that.obj_values[1] === 'lex'
                );
            }
        }
        /**
         * Works on the 'define' definition word before it has been processed, by slight trickery.
         *
         * And it works after that without the trickery.
         */
        is_the_definition_of_define_itself() {
            var that = this;
            if (that.lex.have_we_processed_the_definition_of('define')) {
                return that.idn === that.lex.idn_of.define;
            } else {
                // NOTE:  The following fall-back works early in the scan,
                //        when .is_name_defined() can't be used yet,
                //        because idn_of.define hasn't been set yet,
                //        because the 'define' definition-word hasn't been scanned yet,
                //        because we are scanning the 'lex' or 'define' definition but
                //        we haven't resolved them in .each_definition_word() yet.
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

        // noinspection JSUnusedGlobalSymbols
        /**
         * Change this word's class.  Turn it into an instance of a subclass of qiki.Word
         *
         * This heretical method untangles a conundrum.  Different words have different behaviors.
         * Those behaviors should be encapsulated in class methods.  But the differences are based
         * on the word's content.  Therefore a word's class can only be known after it has been
         * processed a little.
         *
         * An alternative might be overriding Lex.word_factory to pre-process the raw inputs to the
         * Word constructor before they are used to construct an instance.
         *
         * THANKS:  https://stackoverflow.com/a/3168082/673991
         */
        transmogrify_class(subclass) {
            var that = this;
            console.assert( ! (that instanceof subclass));
            console.assert(
                subclass && (subclass.prototype instanceof qiki.Word),
                "Expecting", subclass && subclass.name, "to be a subclass of", type_name(qiki.Word)
            );
            // THANKS:  Subclass test, https://stackoverflow.com/a/18939541/673991
            assert_equal(type_name(that), qiki.Word.name);
            assert_equal(that.constructor.name, qiki.Word.name);

            that.__proto__ = subclass.prototype;

            assert_equal(type_name(that), subclass.name);
            assert_equal(that.constructor.name, subclass.name);
            console.assert(that instanceof subclass);
        }
    }

})(qiki, jQuery);
// NOTE:  The last line used to be a little more explicit about window.qiki being a global variable:
//            })(window.qiki = window.qiki || {}, jQuery);
//        But that tripped up JetBrains into not seeing qiki.Word and other module classes.

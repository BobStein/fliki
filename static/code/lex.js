// lex.js
// ------
// Parse a .lex.jsonl file into words.  Derive classes from Lex and Word to process the words.
//
// TODO:  Move to qiki.js

window.qiki ||= {};
(function (qiki) {

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
            looper(that.idn_of, function _each_definition(name, idn) {
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
            if ( ! is_a(string, String)) {
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
        add_rightmost(word, name=null) {
            var that = this;
            that._words.push(word);
            if (is_specified(name)) {
                that.by_name[name] = word;
            }
        }
        add_leftmost(word, name=null) {
            var that = this;
            that._words.unshift(word);
            if (is_specified(name)) {
                that.by_name[name] = word;
            }
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
        get_by_index(index) {
            return this._words[index];
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
        //        Also, Bunch could be a Lex.  Maybe call it a LexCache, because it mimics some
        //        of the contents of another lex.
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
     * Local interface for a lex stored on a remote internet server.
     *
     * TODO:  Give a Lex object ways to read or write words with composition instead of subclassing.
     *        lex.reader(Reader(url))
     *        lex.writer(Writer(url))
     *
     * All event_handlers that are called are called with `this` set to the lex instance.
     *
     * CAUTION:  This constructor must not directly call any of the event_handlers, to give a
     *           derived constructor the chance to initialize members first.
     *
     * @property LexClient.idn_of.admin
     * @property LexClient.idn_of.anonymous
     * @property LexClient.idn_of.google_user
     */
    qiki.LexClient = class LexClient extends qiki.Lex {
        constructor(options) {
            super()
            var that = this;
            that.options = options;
            type_should_be(that.options.lex_get_url, String);
            that.by_idn = {};
            that.agent_cache = {};
            that.agent_representing_lex_itself = null;
            // that.error_message = null;
            that.num_words = 0;   // 0-based line number before each_json() call, 1-based after it
            that.any_progress_at_all = false;
            that.expect_definitions(
                'iconify',
                'name',
                'admin',
                'google_user',
                'anonymous',
            );

            // var abort_controller = new AbortController();
            var liner = new LinesFromBytes(function _each_incoming_line(line) {
                that.each_json(line);
                // if (that.each_json(line) === null) {
                //     liner.keep_going = false;
                //     abort_controller.abort();
                // }
            });
            that.promise = fetch(that.options.lex_get_url)
                .then(function _lex_fetch_resolution(response) {
                    if (response.ok) {
                        var reader = response.body.getReader();
                        return reader.read().then(incremental_download);

                        function incremental_download(result) {
                            that.any_progress_at_all = true;
                            if (result.done) {
                                console.assert(
                                    liner.remains === '',
                                    "Last line of", that.options.lex_get_url,
                                    "expected to be empty, not:", liner.remains
                                );

                                var no_defs = that.missing_definitions();
                                if (no_defs.length === 0) {
                                    console.log("LexClient fetch done");
                                } else {
                                    that.scan_fail("Missing definitions: " + no_defs.join(", "));
                                }
                            } else {
                                var words_before = that.num_words;
                                liner.bytes_in(result.value);
                                var words_after = that.num_words;
                                console.log(
                                    "LexClient fetch chunk,",
                                    result.value.length, "bytes,",
                                    words_after - words_before, "words total"
                                );
                                return reader.read().then(incremental_download);
                            }
                        }
                    } else {
                        that.scan_fail(f("LexClient fetch not ok: {status} {text}", {
                            status: response.status,
                            text: response.statusText
                        }));
                    }
                })
                .catch(function _lex_fetch_rejection(error) {
                    if (is_a(error, LexClient.ScanFail)) {
                        // .scan_fail() already displayed on console.error()
                    } else {
                        console.error("LexClient fetch failure:", error);
                    }
                    return Promise.reject(error.message);
                })
            ;
        }

        /**
         * Process the JSON form of each word.  From the lex.  Or newly added to the lex.
         *
         * This is the convergence of reading old words, and creating new words.
         *
         * @param word_json - e.g. '[882,1559479179156,[167,"103620384189003122864"], 808,"pithy"]'
         * @returns {qiki.Word}
         */
        each_json(word_json) {
            var that = this;
            that.num_words++;
            that.current_word_json = word_json;
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
            if (word.is_definition()) {
                var parent = that.by_idn[word.obj.parent];
                that.word_event(word, 'parent', parent.obj.name)
                // TODO:  Wouldn't it be cool if this expression:
                //            that.by_idn[word.obj.parent].obj.name
                //        could be this:
                //            word.parent.name
                //        In other words:
                //            named obj parts were word parts:  parent.name vs parent.obj.name
                //            and word parts were (germinal) words:  parent vs that.by_idn[parent]
            } else {
                that.word_event(word, 'vrb', word.vrb_name());
            }
            return word;
        }

        //
        // /**
        //  * Process the JSON form of each word.  From the lex.  Or newly added to the lex.
        //  *
        //  * This is the convergence of reading old words, and creating new words.
        //  *
        //  * @param word_json - e.g. '[882,1559479179156,[167,"103620384189003122864"], 808,"pithy"]'
        //  * @returns {qiki.Word}
        //  */
        // each_json(word_json) {
        //     var that = this;
        //     that.num_words++;
        //     that.current_word_json = word_json;
        //     var word_to_return;
        //     word_to_return = that.word_from_json(word_json);
        //     that.each_word(word_to_return);
        //     return word_to_return;
        // }
        // /**
        //  * Decode a line of JSON.  Use the nits to instantiate a qiki.Word.
        //  *
        //  * Handle a line from a .lex.jsonl file.
        //  * Handle the response from a .create_word() ajax call.
        //  *
        //  * @param word_json, e.g. "[220,1564505338118,[18,"103620384189003122864"], 80,214,183,31]"
        //  * @returns {qiki.Word}
        //  */
        // word_from_json(word_json) {
        //     var that = this;
        //     try {
        //         var word_array = JSON.parse(word_json);
        //     } catch (e) {
        //         that.scan_fail("Word JSONL error", e, word_json);
        //     }
        //     if ( ! is_a(word_array, Array)) {
        //         that.scan_fail("Word JSONL expecting array, not", word_array, word_json);
        //     }
        //     if (word_array.length < 4) {
        //         that.scan_fail("Word JSONL too few sub-nits", word_array, word_json);
        //     }
        //     var word = that.word_factory(...word_array);
        //     return word;
        // }
        // /**
        //  * Similar to constructor of qiki.Word subclass.  But each_word() is after ALL subclassing.
        //  *
        //  * @param word
        //  */
        // each_word(word) {
        //     var that = this;
        //     if (word.is_definition()) {
        //         var parent = that.by_idn[word.obj.parent];
        //         that.word_event(word, 'parent', parent.obj.name)
        //         // TODO:  Wouldn't it be cool if this expression:
        //         //            that.by_idn[word.obj.parent].obj.name
        //         //        could be this:
        //         //            word.parent.name
        //         //        In other words:
        //         //            named obj parts were word parts:  parent.name vs parent.obj.name
        //         //            and word parts were (germinal) words:  parent vs that.by_idn[parent]
        //     } else {
        //         that.word_event(word, 'vrb', word.vrb_name());
        //     }
        // }
        word_event(word, ...event_names) {
            var that = this;
            type_should_be(word, qiki.Word);
            should_be_array_like(event_names, String);
            var leaf = that.options;
            var is_a_hit = true;
            looper(event_names, function (level, event_name) {
                if (/* is_associative_array(leaf) && */ has(leaf, event_name)) {
                    leaf = leaf[event_name];
                } else {
                    is_a_hit = false;
                    // NOTE:  event_names must all match nested keys in event_handlers to get a hit.
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
                    console.warn(
                        "Event handler hit at", event_names.join(","),
                        "- but that is no function:", leaf
                    );
                }
            }
        }
        /**
         * What class should this word be?  Must be qiki.Word or a subclass.
         *
         * A subclass of LexClient may override this method, and return a subclass of Word
         * that depends on the word's vrb or other contents.
         *
         * @param idn
         * @param whn
         * @param sbj
         * @param vrb
         * @param obj_values
         * @returns {qiki.Word}
         */
        // noinspection JSUnusedLocalSymbols
        word_class(idn, whn, sbj, vrb, ...obj_values) {
            return qiki.Word;
        }
        /**
         * Instantiate a word in this lex.  Expect word_class() to return Word or a subclass.
         */
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

        // NOTE:  Hardwired fields for each definition word:
        static I_DEFINITION_PARENT = 0;
        static I_DEFINITION_NAME   = 1;
        static I_DEFINITION_FIELDS = 2;   // Definition-words have a field called 'fields'
        static N_DEFINITION        = 3;   // Definition-words have 3 fields
        // TODO:  Specify these in the lex, and make the circularity not dumb.

        each_definition_word(word) {
            var that = this;
            word.obj = {};
            if (word.obj_values.length !== qiki.LexClient.N_DEFINITION) {
                that.scan_fail("Definition should have 3 obj parts, not:", word.obj_values);
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
            //            lex-definition-word
            //            lex-reference-word
            //            user-reference-word
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
         * Throw a ScanFail exception.  A failure to decode and interpret the json of a word.
         *
         * If called by word_from_json() or each_word() or subordinates, it will be
         * caught by each_json(), and each_json() will return null.
         *
         * The arguments passed to scan_fail() will be displayed on the console, along with the
         * line number and word count.  A string concatenation of all that information will also get
         * passed eventually to the .event_handlers.fail() callback.
         *
         * @param args - text and variables to be passed to console.error().
         */
        scan_fail(...args) {
            var that = this;
            var more_args;
            if (that.any_progress_at_all) {
                more_args = [
                    ...args,
                    "\nScan failed on", that.options.lex_get_url, "line", that.num_words, "which is:" +
                    "\n" + (that.current_word_json || "(A BLANK LINE)")
                ]
                // NOTE:  Report the current line in the stream, in case its contents caused the
                //        failure.
            } else {
                more_args = args;
                // NOTE:  No bytes were fetched.  This happens if something crashed before any
                //        streaming, so it makes no sense to report where we are in the stream.
            }
            console.error(...more_args);
            var failure_string = more_args.join(" ")
            throw new qiki.LexClient.ScanFail(failure_string);
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
            // TODO:  configure and use fetch(method POST), not qoolbar
            //        So LexClient needs to know about  the URL for the ajax call.
            //        That may be different from the url to GET the .lex.jsonl contents.
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


    /**
     * Convert bytes to lines.  Streaming.
     *
     * Convert a series of chunks of bytes into text lines.
     * Chunks may come asynchronously.
     * Chunks are Uint8Array's of utf-8 encoded bytes.
     * Chunks are input by calling the .bytes_in() method.
     * Lines are output by the line_out() callback that was passed to the constructor.
     *
     * The line_out() callback may set .keep_going = false to stop further callbacks
     * from the same .bytes_in() call.
     *
     * TODO:  Implement as a ReadableStream?
     * TODO:  Understand ReadableStream
     */
    class LinesFromBytes {
        constructor(line_out) {
            var that = this;
            that.line_out = line_out;
            that.remains = '';
            that.keep_going = true;   // line_out callback can set to false to terminate
            that.string_from_utf8 = new TextDecoder('utf-8');
        }
        bytes_in(chunk_of_utf8_bytes) {
            var that = this;
            var characters = that.string_from_utf8.decode(chunk_of_utf8_bytes);
            that.remains += characters;
            var next_lines = that.remains.split('\n');
            var always_an_incomplete_line = next_lines.pop();
            looper(next_lines, function _each_line_in_chunk(_, line_that_might_end_in_cr) {
                var line = line_that_might_end_in_cr.replace(/\r$/, '');
                that.line_out(line);
                return that.keep_going;
            });
            that.remains = always_an_incomplete_line;
        }
    }
    var demo_lines_from_bytes = new LinesFromBytes(function (line) {
        console.assert(line === 'ABC' || line === 'DEF');
    });
    demo_lines_from_bytes.bytes_in(new Uint8Array([65,66,67, 13,10, 68,69,70, 13,10]));
    // NOTE:  There's a nuance to String.split() that LinesFromBytes.bytes_in() depends on:
    //        When you split a string ending in \n you get an empty trailer.  So (1) there
    //        is always a last element output by split (it never outputs an empty array []),
    //        and (2) that last element is always an unterminated line.  For example:
    assert_equal('', 'abc\ndef\n'.split('\n')[2]);


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
         * TODO:  Make lex a static property of a qiki.Word subclass.  That way each word
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
         *            ContributionWord - generic Contribution application innards versus
         *            Contribution - specific Unslumping implementation
         *        Except the extra layers are less bad since we started using composition in the
         *        implementation (e.g. Contribution._word)
         *        A major drawback:  e.g. two LexContribution instances (connecting to two servers
         *        like unslumping.org) would require two different sets of Word subclasses
         *        (ContributionWord, CategoryWord, etc.)
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

            // NOTE:  word.obj_values is a numerically indexed array.  It was passed to constructor.
            //        word.obj        is a named associative array.  It will get populated below.

            // TODO:  Hmm, should the decisions below be moved to LexClient.word_factory()?
            //            qiki.WordDefinition constructor absorb LexClient.each_definition_word()
            //            qiki.WordReference constructor  absorb LexClient.each_reference_word()
            //        A reason not to do that:  Someone smarter than me should break down the
            //        difference between these.  A lex-definition-word could be just like any other
            //        word, with fields defined in the lex.  It's got extra powers for sure, but
            //        maybe those can be safely associated with the .sbj being the lex definition,
            //        not with a new dichotomy of word classes.

            if (that.is_definition()) {
                that.lex.each_definition_word(that);
            } else {
                that.lex.each_reference_word(that);
            }
            // NOTE:  Calling these here in the base-class qiki.Word constructor means that a
            //        subclass constructor will get a fully resolved word, that has named .obj
            //        properties (after it calls super() of course).  Unlike the .word_class()
            //        method in a LexClient subclass, which must make do with the unnamed
            //        .obj_values array elements.
        }

        get agent() {
            return this.lex.agent_from_idn(this.sbj);
            // NOTE:  This getter method, where every use of the agent "property" searches the
            //        .lex.agent_cache by idn, is optimized for less memory, more compute time.  But
            //        maybe every word instance should have an agent property, a reference to an
            //        object in the .lex.agent_cache.
        }

        idn_presentable() {
            return qiki.Lex.presentable(this.idn);
        }
        parent_name() {
            return this.lex.by_idn[this.obj.parent].obj.name;
        }
        /**
         * Get a printable name for this word's vrb.  Strings for several hostile circumstances.
         *
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
            var that = this;
            if (that.lex.is_early_in_the_scan()) {
                if (that.is_the_definition_of_lex_itself()) {
                    return true;
                } else if (that.is_the_definition_of_define_itself()) {
                    return true;
                } else {
                    throw that.lex.scan_fail(
                        "The first words should define 'lex' and 'define' themselves."
                    );
                }
            } else {
                return (
                    this.sbj === this.lex.idn_of.lex &&
                    this.vrb === this.lex.idn_of.define
                );
            }
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

})(qiki);
// NOTE:  The last line used to be a little more explicit about window.qiki being a global variable:
//            })(window.qiki = window.qiki || {});
//        But that tripped up JetBrains into not seeing qiki.Word and other module classes.

(function (qiki) {
    var load_stage = 'qiki.js loaded';
    var load_call_count = 0;
    var LOAD_STAGE_FINISHED = 'finished';
    var FINISHER_METHOD_NAME = 'fin';
    // NOTE:  Name of a method on the lex-instance (the function-object returned by qiki.Lex()).
    //        This is a mechanism for knowing whether the loaded script executed to completion,
    //        for example if the loaded script throws an exception.  Or if the curried words it
    //        calls, whose code is below or in the client of this module, throws an exception.
    //        The buzz on this issue seems drowned by older harsher problems with $.getScript(),
    //        e.g. browser/jquery bugs, failing fail callback, cross-site scripting.
    //        https://stackoverflow.com/q/16561904/673991
    //        https://stackoverflow.com/q/1406537/673991
    //        https://stackoverflow.com/q/1130921/673991

    /**
     *
     * @param url
     * @param handlers - associative array for custom handling of various events
     *
     *        handlers.word_from_idn(idn) - lex instance called to retrieve word info from idn
     *
     *        handlers.word_define(wordie, ...) - define a word
     *        handlers.define_handlers: { name: function, name: function, ...}
     *        handlers.define_not_handled(wordie)
     *          (not handled by .define_handlers.xxx() -- may have been handled by .word_define())
     *
     *        handlers.word_setter(idn, wordie, ...) - create a word
     *        handlers.verb_handlers: { name: function, name: function, ...}
     *        handlers.verb_not_handled(wordie, idn, user_word)
     *          (not handled by .verb_handlers.xxx() -- may have been handled by .word_setter())
     *
     *        handlers.init()
     *        handlers.done()
     *        handlers.fail()
     *
     * @param output - optional information accumulated from the stream
     *        output.by_name - mapping from name to wordie, for all the lex's definitions in the stream
     */
    qiki.lex_load = function (url, handlers, output) {
        output = output || {};
        output.by_name = output.by_name || {};
        output.me_idn  = output.me_idn  || null;
        output.me_word = output.me_word || null;

        prepare_to_handle(handlers, output);

        // NOTE:  Not sure how importantly qiki.Lex be defined BEFORE $.getScript(), but we do.
        var load_promise = $.getScript(url);
        load_promise.done(function (script, textStatus) {
            if (load_stage === LOAD_STAGE_FINISHED) {
                console.log("done loading nits", textStatus, "-", script.length, "bytes in script");
                if (handlers.hasOwnProperty('done')) {
                    handlers.done();
                }
            } else {
                var error_message = "Load incomplete. Last stage: " + load_stage;
                console.error(error_message);
                if (handlers.hasOwnProperty('fail')) {
                    handlers.fail(error_message);
                }
            }
        });
        load_promise.fail(function (jqxhr, settings, exception) {
            console.warn("fail loading nits", jqxhr.readyState, jqxhr.status, exception);
            if (handlers.hasOwnProperty('fail')) {
                handlers.fail(jqxhr, settings, exception);
            }
        });
    };

    /**
     * Set up all the ways to call the handlers.
     *
     * Mainly this function serves to limit the scope.  But it's not that big of a deal,
     * perhaps only the url gets used and passes out of scope for garbage collection.
     * Maybe instead the url could come from handlers?  So could output!
     *
     * @param handlers
     * @param output
     */
    function prepare_to_handle(handlers, output) {
        if (is_specified(output)) {
        }

        /**
         * Instantiate a Lex -- which is itself a callable function.
         */
        qiki.Lex = function lex_constructor(me_idn_lineage) {
            load_stage = 'lex instantiated';

            output.me_idn = me_idn_lineage;

            if (handlers.hasOwnProperty('init')) {
                handlers.init(me_idn_lineage);
            }

            /**
             * When the lex instantiation object is called.
             */
            var instantiation_call = function _instantiation_call() {
                load_call_count++;
                load_stage = load_call_count.toString() + " calls";

                var idn;
                var name;
                switch (arguments.length) {
                case 0:
                    console.error("Lex instance called with no parameters.");
                    return null;
                case 1:
                    idn = arguments[0];
                    // var proto_word = {idn: idn};
                    // // TODO:  Return a wordie or a curried word,
                    // //        instead of yet a THIRD flavor of a word-like thingie.
                    // return proto_word;
                    if (handlers.hasOwnProperty('word_from_idn')) {
                        return handlers.word_from_idn(idn);
                    } else {
                        return null;
                    }
                default:
                    idn = arguments[0];
                    name = arguments[1];
                    var details = Array.prototype.slice.call(arguments, 2);
                    // THANKS:  arguments.slice(2), https://stackoverflow.com/a/960870/673991
                    var wordie = new qiki.Wordie(idn, name, details);
                    return word_definition(wordie);
                }
            };
            instantiation_call[FINISHER_METHOD_NAME] = function () {
                load_stage = LOAD_STAGE_FINISHED;
            }
            return instantiation_call;
        };


        /**
         * Define a new curried word.
         *
         * This happens either by calling the lex instance, or by calling a curried word.
         * A definition returns a curried word.
         * The curried word knows about the history of definitions that led to it.
         *
         * @param w - some properties of a word
         * @returns {function} - a callable thing that can define or set other words
         */
        function word_definition(w) {
            // TODO:  This should become a Wordie.definition() method.

            type_should_be(w, qiki.Wordie);

            if (w.name !== null && is_a(w.idn, Number)) {
                // NOTE:  Definitions with a name and an idn in the main lex are accessible by name.
                //        This doesn't include definitions in another lex like a google user.
                //        This doesn't include unnamed words, though actually those never get here.
                console.assert(
                    ! output.by_name.hasOwnProperty(w.name),
                    "Duplicate definition",
                    w,
                    "after",
                    output.by_name[w.name]
                );
                output.by_name[w.name] = w;
            }

            if (w.idn === output.me_idn) {
                output.me_word = w;
            }

            if (handlers.hasOwnProperty('word_define')) {
                handlers.word_define(w);
                // NOTE:  w.details is an array of parameters after the idn and name
                //        in a definition in the data stream.  There may be none, or several.
                //        If they are important to the application intercepting the data stream,
                //        then the word_define() handler should copy them to the Wordie object.
                //        When the curried word (the output of each definition) is called, it will
                //        have access to the wordie object.
                //        The wordie object is 'w' here for brevity of code in the curried_word
                //        closure function.  More on that below.
            }
            if (handlers.hasOwnProperty('define_handlers')) {
                var was_handled = false;
                // NOTE:  Higher (more abstract) ancestors first.
                // for (var i = w.vrb_ancestry.length - 1 ; i >= 0 ; i--) {
                w.ancestry_loop_downward(function (w_ancestor) {
                // for (var i = 0 ; i < w.vrb_ancestry.length ; i++) {
                //     var each_vrb = w.vrb_ancestry[i];
                    if (handlers.define_handlers.hasOwnProperty(w_ancestor.name)) {
                        handlers.define_handlers[w_ancestor.name](w);
                        was_handled = true;
                        // NOTE:  We don't break here because there may be multiple
                        //        handlers for different levels of the definition ancestry.
                    }
                });
                if ( ! was_handled && handlers.hasOwnProperty('define_not_handled')) {
                    handlers.define_not_handled(w);
                }
            }

            var curried_word = function(){return y(w,arguments)};
            // NOTE:  The above function is the curried word closure function.
            //        Each curried word is a different function object,
            //        but with the same code, obviously.
            //        Every definition in the data stream produces a new curried word.
            //        Every function call in the data stream that's not the Lex instance being
            //        called is a curried word being called.
            //        The curried word closure function and all symbols in it are minimized
            //        in an attempt to give this unique callable object a minimal memory footprint.
            //        It's a closure, so it has access to the Wordie instance ('w' here) of
            //        the word that defined it.
            // SEE:  function size futility, https://stackoverflow.com/q/26856783/673991
            curried_word.is_curried_word = true;
            return curried_word;
        }

        /**
         * y() - handle a curried word being CALLED, with arguments.
         *
         * This private y() function executes when any curried word is called.  The only place it's
         * called is from the curried word closure function inside word_definition().
         * This y() function has an abbreviated name as part of rabid minimization of the curried
         * word closure function.
         *
         * Flavors:
         *    y() - return the scoped wordie object - the application may do this.
         *    y(idn, name, etc) - define a new curried word
         *    y(idn, user, etc) - create a new word - user is expressing something
         *
         * @returns {function|object|null}
         */
        function y(wordie, parameters) {
            if (parameters.length === 0) {
                return wordie;
                // NOTE:  This helps when PASSING a curried word, to know what word it is.
                //        It's the only way for code that has this closure to get at the wordie
                //        object that's bound to it -- by calling it with no arguments.
                //        This happens e.g. in the word_setter callback when
                //        it deals with the user_word.
            }
            if (parameters.length === 1) {
                console.error(
                    "Unexpected 1-parameter curried word",
                    wordie.full_history(),
                    parameters[0]
                );
                // NOTE:  The Lex instance can be called with one parameter,
                //        but not a curried word.
                return null;
            }
            load_call_count++;
            load_stage = load_call_count.toString() + " calls";

            var idn = parameters[0];
            var details;



            var fork_definer_v_setter = is_a(parameters[1], String)
            // NOTE:  This is a consequential (thus problematic) fork in the road.
            //        A call with the 2nd parameter a string is a word definition
            //        A call with the 2nd parameter anything else is a word setter (creator)
            //        Both create new words.
            //        A defined word has a name and can go on to create more words.
            //        A set word has no name and is a genealogical dead end.



            var child_wordie;
            if (fork_definer_v_setter) {
                var definition_name = parameters[1];
                details = Array.prototype.slice.call(parameters, 2);
                child_wordie = new qiki.Wordie(idn, definition_name, details, wordie);
                return word_definition(child_wordie);
            } else {
                details = Array.prototype.slice.call(parameters, 1);
                var return_value;
                child_wordie = new qiki.Wordie(idn, null, details, wordie);
                if (handlers.hasOwnProperty('word_setter')) {
                    // return_value = handlers.word_setter(wordie, idn, user_word);
                    return_value = handlers.word_setter(child_wordie);
                } else {
                    return_value = null;
                }
                if (handlers.hasOwnProperty('verb_handlers')) {
                    var was_handled = false;
                    // NOTE:  Higher (more abstract) ancestors first.
                    // for (i = wordie.vrb_ancestry.length - 1 ; i >= 0 ; i--) {
                    // for (var i = 0 ; i < wordie.vrb_ancestry.length ; i++) {
                    wordie.ancestry_loop_downward(function (w_ancestor) {
                        if (handlers.verb_handlers.hasOwnProperty(w_ancestor.name)) {
                            // handlers.verb_handlers[w_ancestor.name](wordie, idn, user_word, details);
                            handlers.verb_handlers[w_ancestor.name](child_wordie);
                            // NOTE:  wordie.details is NOT the same as details here.
                            //        wordie.details is the array of extra parameters when the
                            //        verb was DEFINED.  details is the array of extra
                            //        parameters when the verb's curried word is CALLED.
                            was_handled = true;
                            // NOTE:  We don't break here because there may be multiple
                            //        handlers for different levels of the definition ancestry.
                        }
                    });
                    if ( ! was_handled && handlers.hasOwnProperty('verb_not_handled')) {
                        // handlers.verb_not_handled(wordie, idn, user_word, details);
                        handlers.verb_not_handled(child_wordie, details);
                        // NOTE:  It might be redundant to pass details to .verb_not_handled()
                        //        because the array was also passed to Wordie(), and the stuff is
                        //        probably in child_wordie.  But in case the original arguments
                        //        are not in wordie.fields[] and were moved to named fields
                        //        go ahead and pass the details too.
                    }
                }
                return return_value;
            }
        }

        /**
         * Just a collection of properties about a word.  This object is not callable.
         *
         * There's a good reason not to unify the curried word and the Wordie object.
         * A lot of curried word instances would take up a lot of memory
         * and a Wordie can't be called.  The curried words are only needed at load time,
         * and wishfully thinking, garbage collection will free them up soon after.
         *
         * @param idn
         * @param name - a lex-unique name, or null
         * @param details - array of verb-specific stuff, or [] - NOT optional
         * @param parent_word_if_any - optional - undefined or null if no parent
         * @constructor
         */
        qiki.Wordie = function Wordie(idn, name, details, parent_word_if_any) {
            var that = this;
            that.parent = parent_word_if_any || null;   // undefined becomes null
            type_should_be(that, Wordie);
            type_should_be(idn, [Number, String]);
            console.assert(idn !== '', "idn should not be the empty string");
            name === null || type_should_be(name, String);
            type_should_be(details, Array);
            that.idn = idn;
            that.name = name;

            if (is_specified(that.parent)) {
                type_should_be(that.parent, Wordie)
                // that.vrb_ancestry = that.parent.vrb_ancestry.concat([vrb_txt]);
                // that.wordie_ancestry = that.parent.wordie_ancestry.concat([that]);
                if (that.parent.fields.length === 0) {
                    // NOTE:  The parent did not specify fields.
                    //        So if we have any details, they must specify fields for OUR children.

                    that.fields = details;
                } else {
                    // NOTE:  The parent specified fields, so let's parse our details accordingly.
                    console.assert(
                        that.parent.fields.length === details.length,
                        f("{parent} said {np} fields, but we have {n} fields:", {
                            parent:that.parent.full_history(),
                            np:that.parent.fields.length,
                            n:details.length
                        }),
                        that.parent,
                        details
                    );
                    looper(that.parent.fields, function (i_field, field) {
                        // console.log("    ",i_field, field(), details);
                        var field_name = field().name;
                        var field_value = details[i_field];
                        that[field_name] = field_value;
                        // that[field.field_name] = details[i_field];
                    });
                    that.fields = [];
                    // NOTE:  We had fields, so our children definitely won't.
                    //        Probably we're sterile anyway.
                    //        Example of having children would be u0(4200, "something")
                    //        which I can't think of a use for.
                    //        So probably don't have to set fields to anything anyway.
                }
            } else {
                // that.vrb_ancestry = [vrb_txt];
                // that.wordie_ancestry = [that];
                that.fields = details;   // no parent to specify fields
            }
            // TODO:  Convert all uses of vrb_ancestry to wordie_ancestry.
            //        D.R.Y. the array-forming of that.parent

            // type_should_be(that.vrb_ancestry, Array)
        };

        qiki.Wordie.prototype.ancestry_loop_downward = function (callback) {
            var that = this;
            if (is_specified(that.parent)) {
                that.parent.ancestry_loop_downward(callback);
                callback(that);
            } else {
                callback(that);
            }
        };

        qiki.Wordie.prototype.full_history = function () {
            var that = this;
            // return that.vrb_ancestry.join("::");
            var this_history = that.name || that.idn;
            if (is_specified(that.parent)) {
                return that.parent.full_history() + '::' + this_history;
            } else {
                return this_history;
            }
        };
        // qiki.Wordie.prototype.lineage = function () {
        //     var that = this;
        //     if (is_specified(that.parent)) {
        //         return that.parent.lineage() + ':' + that.idn.toString();
        //     } else {
        //         return that.idn.toString();
        //     }
        // };
        qiki.Wordie.prototype.generation = function () {
            var that = this;
            if (is_specified(that.parent)) {
                return that.parent.generation() + 1;
            } else {
                return 1;
            }
        };
        // Object.defineProperties(qiki.Wordie.prototype, {
        //     vrb: { get: function () { return last_item(this.vrb_ancestry, null); }}
        // });
    }

})(window.qiki = window.qiki || {});


// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
 * @param listing_words
 * @param listing_words[].is_anonymous - supplied by server
 * @param listing_words[].img_src - computed by client
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
 * @param MONTY.URL_PREFIX_QUESTION
 * @param MONTY.URL_HERE
 */
function js_for_meta_lex(window, $, listing_words, MONTY) {

    var UNICODE = {
        NBSP: '\u00A0',
        LEFT_DOUBLE_QUOTE: '\u201C',
        RIGHT_DOUBLE_QUOTE: '\u201D',
        RIGHT_ARROW_UP: '\u2B0F',
        DOWN_ARROW_RIGHT: '\u21B3',
        UPWARDS_WHITE_ARROW: '\u21E7'
    };
    var session_list = [];   // helps identify session words when they're the vrb or obj
    $(document).ready(function() {
        $('.srend').each(function word_pass() {
            render_word(this);
        });
        console.log("Sessions", session_list);
        console.log("numberings", $.map(session_list, value_from_idn));
        console.log("listing_words", listing_words);
        looper(listing_words, function (idn, listed) {
            if (has(listed, 'img_src')) {
                var $words_with_same_idn = $data_idn(idn);
                var $words_to_iconify = $words_with_same_idn.filter(':not(:contains(.ditto))');
                // noinspection HtmlRequiredAltAttribute,RequiredAttributes
                var $img = $('<img>', {
                    src: listed.img_src,
                    alt: "icon for " + listed.name,
                    title: "icon for " + listed.name
                });
                $words_to_iconify.html($img);
            } else if (has(listed, 'name')) {
                var $words_to_name = $data_idn(idn);
                $words_to_name.attr('title', listed.name);
            } else if (listed.is_anonymous) {
                var $anons_to_name = $data_idn(idn);
                var parts = [];
                if (has(listed, 'ip_address')) {
                    parts.push(listed.ip_address);
                }
                parts.push('#' + listed.index_number);
                $anons_to_name.find('.named').text(parts.join(" "));
            }
        });
    });

    var $word_previous = null;
    function render_word(word) {
        var $word = $(word);
        var idn = $word.attr('id');
        var sbj_idn = sub($word, 'sbj', UNICODE.DOWN_ARROW_RIGHT);
        var vrb_idn = sub($word, 'vrb');
        var obj_idn = sub($word, 'obj', UNICODE.RIGHT_ARROW_UP);
        var txt = sub_txt($word);
        sub_whn($word_previous, $word);
        num($word);

        var listed;
        var $obj;
        var $inner;
        var question_url;
        var $txt;
        var $referrer;

        switch (vrb_idn) {
        case MONTY.IDN.IP_ADDRESS_TAG:
            var ip_address = txt;
            if (has(listing_words, sbj_idn)) {
                listed = listing_words[sbj_idn];
                if (listed.is_anonymous) {
                    console.log(
                        "Taggy",
                        $word.attr('value'),
                        sbj_idn,
                        ip_address
                    );
                    listed.ip_address = ip_address;
                    listed.session_idn = obj_idn;
                } else {
                    console.log("nonamous", $word.attr('value'));
                }
            } else {
                console.log("Unlisted", sbj_idn);
            }
            break;
        case MONTY.IDN.ICONIFY:
            chronicle(obj_idn, 'img_src', txt);
            break;
        case MONTY.IDN.NAME:
            chronicle(obj_idn, 'name', txt);
            break;
        case MONTY.IDN.DEFINE:
            if (obj_idn === MONTY.IDN.BROWSE) {   //  || obj_idn === MONTY.IDN.SESSION_OBSOLETE || obj_idn === MONTY.IDN.IP_ADDRESS_OBSOLETE) {
                session_list.push(idn);
            }
            break;
        case MONTY.IDN.REFERRER:
            $obj = $word.find('.obj');
            $inner = $obj.find('.named');
            $inner.text("hit #" + value_from_idn(obj_idn));
            $inner.removeClass('empty');

            question_url = $_from_id(obj_idn).data('question_url');
            if (txt === question_url) {
                $txt = $word.find('.txt');
                $txt.remove();
                $referrer = $('<span>', {class: 'referrer'}).text("(self)");
                $referrer.attr('title', "That hit was referred from itself.");
                $obj.after($referrer);
            } else if (txt === MONTY.URL_HERE) {
                $txt = $word.find('.txt');
                $txt.remove();
                $referrer = $('<span>', {class: 'referrer'}).text("(here)");
                $referrer.attr('title', "That hit was referred from here.");
                $obj.after($referrer);
            }

            if (obj_idn === $word_previous.attr('id')) {
                var $up_pointer = $('<span>', {
                    class: 'up-pointer',
                    title: "Referrer for the hit above"
                });
                $up_pointer.text(UNICODE.RIGHT_ARROW_UP);
                $obj.after($up_pointer);
                // NOTE:  Inserted 2nd but appears 1st
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
        $word_previous = $word;
    }
    function url_from_question(question) {
        return MONTY.URL_PREFIX_QUESTION + question;
    }
    function value_from_idn(idn) {
        return $_from_id(idn).attr('value');
    }
    function chronicle(idn, field_name, value) {
        if (has(listing_words, idn)) {
            var listed = listing_words[idn];
            if (listed.is_anonymous) {
                console.warn(
                    "Anonymous chronicle",
                    idn,
                    field_name,
                    value.substr(0, 20)
                );
                // TODO:  Is this a problem?  Tagging anonymous users?
            } else {
                console.log(
                    "Chronicle",
                    idn,
                    field_name,
                    value.substr(0, 20)
                );
            }
            listed[field_name] = value;
        } else {
            console.warn(
                "Non-listed chronicle",
                idn,
                field_name,
                value.substr(0,20)
            );
            // TODO:  keep track of non-listing words too
        }
    }

    function $data_idn(idn) {
        return $data('idn', idn);
    }
    function $data(name, value) {
        return $('[data-' + $.escapeSelector(name) + '=' + $.escapeSelector(value) + ']');
    }
    function $_from_id(id) {
        return $(selector_from_id(id));
    }
    function selector_from_id(id) {
        return '#' + $.escapeSelector(id);
    }
    function selector_from_class(id) {
        return '.' + $.escapeSelector(id);
    }

    var $sub_prevs = {sbj: $(), vrb: $(), obj: $()};

    function sub($word, sub, ditto_symbol) {
        var $span = $word.find(selector_from_class(sub));
        var idn = $span.data('idn');

        var $inner = $('<span>');
        $span.append($inner);

        var $sub_prev = $sub_prevs[sub];
        $sub_prevs[sub] = $span;
        var idn_prev = $sub_prev.data('idn');  // the sbj.idn or obj.idn of the word above
        var title_ditto = "";

        console.log("DITTO", $word.attr('value'), sub, idn, idn_prev, idn === idn_prev, is_specified(ditto_symbol));

        if (idn === idn_prev && is_specified(ditto_symbol)) {
            $inner.addClass('ditto');
            $inner.text(ditto_symbol);
            title_ditto = " (same as above)";
        } else {
            $inner.addClass('named');
            if (has(listing_words, idn)) {
                if (listing_words[idn].is_anonymous) {
                    $inner.addClass('anonymous');
                }
            } else {
                var $faraway_word = $_from_id(idn);
                if ($faraway_word.length === 1) {
                    if (has(session_list, idn)) {
                        $inner.text("session #" + $faraway_word.attr('value'));
                    } else {
                        var faraway_txt = $faraway_word.data('txt');
                        if (is_laden(faraway_txt)) {
                            $inner.text(faraway_txt);
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
        }
        var title = sub + " = " + idn;
        var value = value_from_idn(idn);
        if (is_defined(value)) {
            title += " (" + value + ")";
        }
        title += title_ditto;
        $inner.attr('title', title);
        return idn;
    }
    function sub_txt($word) {
        var txt = $word.data('txt');
        if (is_laden(txt)) {
            var $span = $('<span>');
            $span.addClass('txt');
            $span.append(" ", UNICODE.LEFT_DOUBLE_QUOTE, txt, UNICODE.RIGHT_DOUBLE_QUOTE);
            $word.append($span);
        }
        return txt;
    }
    var now = new Date();
    function sub_whn($word_previous, $word) {
        var word_date = date_from_whn($word.data('whn'));
        var delta = delta_format(delta_seconds(word_date, now));
        var $span = $('<span>', {class: 'whn'});
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
        $word.append($span);
        if ($word_previous !== null) {
            var word_previous_date = date_from_whn($word_previous.data('whn'));
            var between = delta_format(delta_seconds(word_previous_date, word_date));
            $word.addClass('delta-' + between.units_long);
        }
    }
    function num($word) {

    }
    function date_from_whn(whn) {
        return new Date(whn * 1000.0);
    }
    function delta_seconds(date_early, date_late) {
        return (date_late.getTime() - date_early.getTime()) / 1000.0;
    }
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


    function delta_format(delta_seconds) {
        function div(n, d) {
            return (n/d).toFixed(0);
        }
        function div1(n, d) {
            return (n/d).toFixed(1);
        }
        var word = {num: delta_seconds};
        if (delta_seconds ===                             0.000) {
            word.amount_short = "";
            word.amount_long = "";
            word.units_short = "z";
            word.units_long = "zero";
        } else if (delta_seconds <=                       120*1) {
            word.amount_short = div(delta_seconds,            1);
            word.amount_long = div1(delta_seconds,            1);
            word.units_short = "s";
            word.units_long = "seconds";
        } else if (delta_seconds <=                      120*60) {
            word.amount_short = div(delta_seconds,           60);
            word.amount_long = div1(delta_seconds,           60);
            word.units_short = "m";
            word.units_long = "minutes";
        } else if (delta_seconds <=                    48*60*60) {
            word.amount_short = div(delta_seconds,        60*60);
            word.amount_long = div1(delta_seconds,        60*60);
            word.units_short = "h";
            word.units_long = "hours";
        } else if (delta_seconds <=                 90*24*60*60) {
            word.amount_short = div(delta_seconds,     24*60*60);
            word.amount_long = div1(delta_seconds,     24*60*60);
            word.units_short = "d";
            word.units_long = "days";
        } else if (delta_seconds <=              24*30*24*60*60) {
            word.amount_short = div(delta_seconds,  30*24*60*60);
            word.amount_long = div1(delta_seconds,  30*24*60*60);
            word.units_short = "M";
            word.units_long = "months";
       } else {
            word.amount_short = div(delta_seconds, 365*24*60*60);
            word.amount_long = div1(delta_seconds, 365*24*60*60);
            word.units_short = "Y";
            word.units_long = "years";
        }
        word.description_short = word.amount_short + word.units_short;
        word.description_long = word.amount_long + " " + word.units_long;

        return word;
    }
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
     * @param object - e.g. {a:1, b:2} or [1,2,3]
     * @param callback - this is the object (UNLIKE JQUERY.EACH WHERE IT IS EACH VALUE!)
     *                   SEE jQuery .call():  https://github.com/jquery/jquery/blob/master/src/core.js#L258
     *                   XXX:  Kind of a dumb reason for this incompatibility:  the one-line test below
     *                   key, value are the parameters
     *                       key is the name of the property for { objects }
     *                       key is the index of the array for [ arrays ]
     *                   return false (not just falsy) to prematurely terminate the looping
     * @return {*} - returns the object, a convenience for chaining I guess, maybe $.each is like that.
     */
    // SEE:  $.each() bug for objects, https://stackoverflow.com/a/49652688/673991
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

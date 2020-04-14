// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
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
 * @param MONTY.LISTING_WORDS
 * @param MONTY.LISTING_WORDS[].is_anonymous - supplied by server
 * @param MONTY.LISTING_WORDS[].ip_address - supplied by server
 * @param MONTY.LISTING_WORDS[].browser - supplied by server
 * @param MONTY.LISTING_WORDS[].platform - supplied by server
 * @param MONTY.LISTING_WORDS[].word_class - supplied by server
 * @param MONTY.LISTING_WORDS[].iconify - supplied by server
 * @param MONTY.LISTING_WORDS[].index_number - computed by client
 * @param MONTY.NOW
 * @param MONTY.URL_PREFIX_QUESTION
 * @param MONTY.URL_HERE
 */
// TODO:  verb filter checkboxes (show/hide each one, especially may want to hide "questions")
function js_for_meta_lex(window, $, MONTY) {

    var MIN_SHOW_DELTA_SECONDS = 10;   // Below this, delta-whn times are hidden, unless you hover.
    var MAX_SCRUNCH_DELTA_SECONDS = .1;  // Below this delta-whn, sentences are scrunched together.

    var LIGHTEST_GRAY = 216;   // XXX:  D.R.Y. crime - qoolbar.js .target-environment rgb(216,216,216)
    var DARKEST_GRAY = 0;

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

    var $sentence_elements = $('.srend');   // all sentence renderings
    var SREND_FONT_SIZE = parseFloat($sentence_elements.css('font-size'));
    var session_list = [];   // helps identify session words when used as the vrb or obj
    var whn_delta = [];   // Built by sub_whn(), consumed by whn_delta_render().

    var now_date = new Date();
    var now_seconds = now_date.getTime() / 1000.0;
    var load_delay = now_seconds - MONTY.NOW;
    console.log("Load delay", load_delay.toFixed(3));
    // EXAMPLE:  0.874
    // NOTE:  Also includes server/client time discrepancy.
    //        Which should be zero, no matter the time zone,
    //        because both are seconds since 1970 UTC.

    $(function document_ready() {
        console.time('total');
        console.time('render_word');

        verb_report_init();
        array_async(
            $sentence_elements,
            function each_word(sentence_element) {
                var word_parts = render_word(sentence_element);
                verb_report_each(word_parts);
            },
            6,     // ms between iterations
            500,   // words to render per iteration
            // NOTE:  Chrome timing:
            //         100 - render_word took 18.5 seconds
            //         200 - render_word took 17.7 seconds
            //         500 - render_word took  4.1 seconds
            //        1000 - render_word took  3.4 seconds
            //        1000 - render_word took  2.9 seconds
            // NOTE:  Firefox timing:
            //         100 - render_word took  2.8 seconds
            //         500 - render_word took  2.2 seconds
            //        1000 - render_word took  2.5 seconds
            // NOTE:  Edge timing:
            //         100 - render_word took  4.6 seconds
            //        1000 - render_word took  2.2 seconds
            // NOTE:  Opera timing:
            //         100 - render_word took  4.6 seconds
            //        1000 - render_word took  2.6 seconds
            function after_rendering_words() {
                console.timeEnd('render_word');
                // console.log("Sessions", session_list);
                // console.log("numberings", $.map(session_list, value_from_idn));
                // console.log("listing_words", listing_words);
                // EXAMPLE:
                //     Sessions (11) ["0q83_044D", "0q83_0460", "0q83_0464", "0q83_046C", "0q83_0470",
                //                    "0q83_047B", "0q83_047E", "0q83_0491", "0q83_04C8", "0q83_04CE", "0q83_04D9"]
                //     numberings (11) ["1101", "1120", "1124", "1132", "1136", "1147", "1150", "1169",
                //                      "1224", "1230", "1241"]
                //     listing_words {0q82_A7__8A059E058E6A6308C8B0_1D0B00: {...},
                //                    0q82_A7__8A05F9A0A1873A14BD1C_1D0B00: {...}, 0q82_A8__82AB_1D0300: {...},
                //                    0q82_A8__830425_1D0400: {...}, 0q82_A8__83044D_1D0400: {...}, ...}
                setTimeout(function tiny_delay_after_words_rendered() {

                    console.time('whn_delta');
                    whn_delta_render();
                    console.timeEnd('whn_delta');

                    console.time('verb-report');
                    verb_report();
                    console.timeEnd('verb-report');

                    console.timeEnd('total');
                }, 6);
            }
        );
    });

    /**
     * Render the delta-time triangles on the left.
     */
    // TODO:  Instead synthesize triangle parts in render_word()?
    // SEE:  createElement(NS) debacle, https://stackoverflow.com/a/3642265/673991
    // SEE:  createElementNS with jQuery, https://stackoverflow.com/a/20852029/673991
    function whn_delta_render() {

        function point_join(array_of_points) {
            return array_of_points.map(function each_point(p) {
                return p.map(function each_coordinate(x) {
                    return x.toString();
                }).join(',');
            }).join(' ');
        }

        /**
         * Tooltip for BOTH the triangle and text elements.
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
        triangle.attr('fill', function (b) {
            return gray_scale(log_time_scale(b ? b.num : 0, LIGHTEST_GRAY, DARKEST_GRAY));
        });

        triangle.append('title').text(tooltip_delta);

        var text_element = svg.append('text');
        text_element.text(function (b) { return b ? b.description_short : ""; });
        text_element.attr('x', '1');
        text_element.attr('y', '12');
        text_element.attr('fill', function (b) { return (b ? b.num : 0) < 60 ? 'black' : 'white'; });
        text_element.attr('class', function (b) {
            var classes = ['whn-label'];
            if (is_specified(b)) {
                if (b.num <= MAX_SCRUNCH_DELTA_SECONDS) {
                    classes.push('whn-scrunch');
                }
                if (b.num < MIN_SHOW_DELTA_SECONDS) {
                    classes.push('whn-hide');
                }
            } else {
                classes.push('whn-hide');
            }
            return classes.join(' ');
        });
        text_element.append('title').text(tooltip_delta);

        $('.whn-scrunch').each(function () {
            var $srend = $(this).closest('.srend');
            $srend.addClass('whn-scrunch');
        });
        // NOTE:  Use jQuery to migrate the whn-scrunch class up to the li.srend element.
    }

    /**
     * Render a 3-sub-part sentence-word from the lex.
     *
     * @param word - DOM or jQuery object of the .srend class,
     *               e.g. <li class="srend" value="3469" id="0q83_0D8D" data-idn-native="3469" ...>
     * @returns {object} word_parts - {idn, sbj, vrb, obj, txt, whn: {ago_short, ...}}
     */
    function render_word(word) {
        var $word = $(word);
        var idn = $word.attr('id');
        var sbj_idn = sub($word, 'sbj');
        var vrb_idn = sub($word, 'vrb');
        var obj_idn = sub($word, 'obj');
        sub_num($word);
        var txt = sub_txt($word);
        var whn_parts = sub_whn($word);

        var $obj;
        var $named;
        var question_url;
        var $txt;
        var $referrer;

        switch (vrb_idn) {
        case MONTY.IDN.DEFINE:
            if (obj_idn === MONTY.IDN.BROWSE) {
                session_list.push(idn);
            }
            break;
        case MONTY.IDN.REFERRER:
            $obj = $word.find('.obj');
            $named = $obj.find('.named');
            $named.text("hit #" + value_from_idn(obj_idn));
            $named.addClass('hit');
            $named.removeClass('empty');
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
                $named = $obj.find('.named');
                question_url = url_from_question($obj.data('txt'));
                var $a = $('<a>', {href: question_url});
                $named.wrap($a);
                $word.attr('data-question_url', question_url);
            }
        }
        return {
            idn: idn,
            sbj: sbj_idn,
            vrb: vrb_idn,
            obj: obj_idn,
            txt: txt,
            whn: whn_parts
        };
    }
    function url_from_question(question) {
        var url = path_join(MONTY.URL_PREFIX_QUESTION, encodeURI(question));
        url = url.replace(/\?$/, "");
        // NOTE:  Flask request.full_path appends a `?` even when there was no query string.
        return url;
    }

    function value_from_idn(idn) {
        return $_from_id(idn).attr('value');
    }
    function $_from_id(id) {
        return $(selector_from_id(id));
    }
    function selector_from_id(id) {
        return '#' + $.escapeSelector(id);
    }
    function named_anchor_from_id(id) {
        return '#' + encodeURI(id);
    }
    function selector_from_class(id) {
        return '.' + $.escapeSelector(id);
    }

    /**
     * Render one of the three sub-parts (sub-words) of a word.
     *
     * @param $word - jQuery object of the .srend class,
     *                e.g. <li class="srend" value="3469" id="0q83_0D8D" data-idn-native="3469" ...>
     * @param {string} sub - 'sbj' or 'vrb' or 'obj'
     * @return - qstring of the sub-part's idn, e.g. '0q83_044C'
     */
    function sub($word, sub) {
        var $span = $word.find(selector_from_class(sub));
        var idn = $span.data('idn');
        var $named = $span.find('.named');
        var title = sub + " = " + idn;
        var value = value_from_idn(idn);
        if (is_defined(value)) {
            title += " (" + value + ")";
        }
        $named.attr('title', title);

        if (has(MONTY.LISTING_WORDS, idn)) {
            var listed = MONTY.LISTING_WORDS[idn];
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
                $named.replaceWith($img);
            } else if (listed.is_anonymous) {
                $named.addClass('anonymous');
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
                $named.text(parts.join(" "));

                if (has(listed, 'word_class')) {
                    title += " - " + listed.word_class;
                }
                $named.attr('title', title);
            }
        } else {
            var $faraway_word = $_from_id(idn);
            if ($faraway_word.length === 1) {
                console.assert($faraway_word.is('.srend[id][value]'));
                if (has(session_list, idn)) {
                    $named.text("session #" + $faraway_word.attr('value'));
                    $named.addClass('session');
                } else {
                    var faraway_txt = $faraway_word.data('txt');
                    if (is_laden(faraway_txt)) {
                        $named.text(compress_txt(faraway_txt));
                        $span.data('txt', faraway_txt);
                    } else {
                        $named.addClass('empty');   // unexpectedly empty txt, unable to describe.
                        $named.text("(BLANK)");
                    }
                    if (idn === MONTY.IDN.LEX) {
                        $named.addClass('lex');
                    }
                    if ($faraway_word.find('.sbj').data('idn') === MONTY.IDN.LEX) {
                        $named.addClass('sbj-lex');
                    }
                }
            } else {
                console.warn("idn is neither listed nor lexed:", idn, $faraway_word.length);
                $named.addClass('un-lexed');
                $named.text("??? " + idn);
            }
        }
        return idn;
    }

    function sub_num($word) {
        var num = $word.data('num');
        var $num = $word.find('.num');
        if (typeof num === 'undefined') {
        } else if (typeof num === 'number') {
            if (num !== 1.0) {
                $num.text(UNICODE.TIMES + human_number(num));
            }
        } else {
            $num.text(UNICODE.CIRCLED_TIMES + " " + num.toString());
        }
        var num_qstring = $word.data('num-qstring');
        if (is_specified(num_qstring)) {
            $num.attr('title', "num = " + num_qstring);
        }
        return num;
    }

    function sub_txt($word) {
        var txt = $word.data('txt');
        if (is_laden(txt)) {
            var $span = $word.find('.txt');
            $span.text(UNICODE.LEFT_DOUBLE_QUOTE + compress_txt(txt) + UNICODE.RIGHT_DOUBLE_QUOTE);
        }
        return txt;
    }

    function sub_whn($word) {
        var whn_seconds = $word.data('whn');
        var word_date = date_from_whn(whn_seconds);
        var delta = delta_format(MONTY.NOW - whn_seconds);
        var $span = $word.find('.whn');   // $('<span>', {class: 'whn'});
        $span.addClass(delta.units_long);
        $span.text(delta.description_short);
        var fractional = whn_seconds % 1.0;
        var then_utc = amend_fractional_seconds(word_date.toUTCString(), fractional);
        var then_local = amend_fractional_seconds(word_date.toLocaleString(), fractional);
        $span.attr('title', "{ago_long} ago: {then_utc} -or- {then_local} local"
            .replace('{ago_long}', delta.description_long)
            .replace('{then_utc}', then_utc)
            .replace('{then_local}', then_local)
        );
        var $word_previous = $word.prev('.srend');
        if ($word_previous.length === 1) {
            var between = delta_format($word.data('whn') - $word_previous.data('whn'));
            if (between.num >= 3600) {
                $word.css('border-top-color', gray_scale(log_time_scale(between.num, 333, 0)));
                if (between.num >= 7*24*3600) {
                    $word.css('border-top-width', log_time_scale(between.num, -150, 100));
                }
            }
            whn_delta.push(between);
        }
        return {
            ago_short: delta.description_short,
            ago_long: delta.description_long,
            then_utc: then_utc,
            then_local: then_local
        }
    }

    function amend_fractional_seconds(timestamp, fractional_seconds) {
        var fractional_seconds_string = strip_leading_zeros(fractional_seconds.toFixed(3));
        var amended_timestamp = timestamp.replace(
            /\d\d:\d\d:\d\d/,
            "$&" + fractional_seconds_string
        );
        return amended_timestamp;
    }
    console.assert(
        'Sat, 23 Nov 2019 16:30:44.388 GMT' === amend_fractional_seconds(
        'Sat, 23 Nov 2019 16:30:44 GMT', 0.388)
    );

    function strip_leading_zeros(s) {
        return s.replace(/^0+/, '');
        // THANKS:  aggressive zero-stripping, https://stackoverflow.com/a/6676498/673991
    }
    console.assert('.425' === strip_leading_zeros('0.425'));
    console.assert('' === strip_leading_zeros('0'));

    var verb_report_tally = {};

    function verb_report_init() {
        verb_report_tally = {};
    }

    function verb_report_each(word) {
        function its_a_verb(vrb) {
            if ( ! has(verb_report_tally, vrb)) {
                verb_report_tally[vrb] = [];
            }
        }
        function vrb_is_used(vrb, word) {
            console.assert(has(verb_report_tally, vrb), vrb);
            var word_whn = "{ago_long} ago, {then_local}"
                .replace('{ago_long}', word.whn.ago_long)
                .replace('{then_local}', word.whn.then_local)
            ;
            var word_stripped_down_a_Little = {idn: word.idn, whn: word_whn};
            verb_report_tally[vrb].push(word_stripped_down_a_Little);
        }

        its_a_verb(word.vrb);
        vrb_is_used(word.vrb, word);
        if (word.obj === MONTY.IDN.VERB) {
            // console.debug("defined", word.idn, word.obj, word.txt);
            its_a_verb(word.idn)
            // NOTE:  This captures a 1st-level derived verb even if it's never used as the verb in any word.
        } else if (word.vrb === MONTY.IDN.DEFINE && has(verb_report_tally, word.obj)) {
            // NOTE:  This would include L O T S of unused derived session words.
            // console.debug("DERIVED", word.idn, word.obj, word.txt);
            // its_a_verb(word.idn)
        }
    }

    /**
     * Show the number of uses of each verb.  Link to earliest and latest.
     */
    function verb_report() {
        var verb_idns = Object.keys(verb_report_tally);

        var $verb_report = $('<div>', {id: 'verb-report'});
        $(window.document.body).append($verb_report);
        var num_verbs = verb_idns.length.toString();
        $verb_report.append($('<h3>').text("{n} Verbs".replace('{n}', num_verbs)));
        var $ol = $('<ol>');
        $verb_report.append($ol);

        verb_idns.sort(function compare_verb_names(v1, v2) {
            var $v1 = $_from_id(v1);
            var $v2 = $_from_id(v2);
            var txt1 = $v1.data('txt') || "";
            var txt2 = $v2.data('txt') || "";
            return txt1.localeCompare(txt2, undefined, { sensitivity: 'accent' });
        });
        // THANKS:  Custom sort, https://stackoverflow.com/a/35092754/673991
        // THANKS:  Accented letters near, not exact, https://stackoverflow.com/a/2140723/673991

        // looper(verb_report_tally, function (vrb_idn, words) {
        looper(verb_idns, function (_, vrb_idn) {
            var words = verb_report_tally[vrb_idn];
            var $li = $('<li>');
            $ol.append($li);

            var $vrb = $_from_id(vrb_idn);
            var vrb_idn_int = $vrb.data('idn-native');
            $li.attr('value', vrb_idn_int);

            var vrb_txt = $vrb.data('txt');
            var n_words = words.length;
            var $verb_name = $('<span>', {class: 'named'});
            $li.append($verb_name);
            if (vrb_txt === "" || vrb_txt === null || ! is_laden(vrb_txt)) {
                $verb_name.text("(UNNAMED)");
                $verb_name.addClass('unnamed');
                console.log("UNNAMED", vrb_idn);
            } else {
                $verb_name.text(vrb_txt);
            }
            // var title = "idn " + word.idn + " (" + vrb_idn_int + ")";
            var title = "idn {idn} ({idn_int})"
                .replace('{idn}', vrb_idn)
                .replace('{idn_int}', vrb_idn_int)
            ;
            // TODO:  title = f("idn {idn} ({idn_int})", {idn: vrb_idn, idn_int: vrb_idn_int})

            if ($vrb.find('.sbj').data('idn') === MONTY.IDN.LEX) {
                $verb_name.addClass('sbj-lex');
            }

            var vrb_obj_idn = $vrb.find('.obj').data('idn');
            if (vrb_obj_idn === MONTY.IDN.VERB) {
                $verb_name.addClass('obj-verb');
            } else {
                title += " - {txt}".replace('{txt}', $_from_id(vrb_obj_idn).data('txt'));
                // TODO:  Include the full hierarchy of verb derivations.
                //        Follow the definitions all the way to MONTY.IDN.VERB.
                //        Recursively or loopily.
                //        This only goes one level.
            }

            $verb_name.attr('title', title);
            $li.append(" ");

            function $words(words) {
                function $word(word) {
                    function int_from_idn(idn) {
                        return $_from_id(idn).data('idn-native');
                    }

                    var $a = $('<a>', {
                        href: named_anchor_from_id(word.idn),
                        title: word.whn
                    });
                    $a.text(int_from_idn(word.idn).toString());
                    return $a;
                }

                var $anchors = [];
                looper(words, function (_, word) {
                    $anchors.push($word(word));
                    $anchors.push(" ");
                });
                return $anchors;
            }

            var $span = $('<span>', {class: 'idn-list'});
            $li.append($span);
            var N_EARLY = 3;
            var N_LATER = 12;
            var TOO_MANY_BETWEEN = 4;
            // NOTE:  4 numbers can take about as much space as ellipses:
            //        ...(4 more)...
            //        123 123 123 123
            if (n_words === 0) {
                $verb_name.addClass('meta-verb');
            } else if (n_words <= N_EARLY + TOO_MANY_BETWEEN + N_LATER) {
                $span.append($words(words));
            } else {
                var words_early = words.slice(0, N_EARLY);
                var words_late = words.slice(-N_LATER);
                var missing_words = (n_words - N_EARLY - N_LATER).toString();
                $span.append(
                    $words(words_early),
                    " ...({n} more)... ".replace('{n}', missing_words),
                    $words(words_late)
                );
                // THANKS:  .replace(substr) ... literal string, not a regular expression,
                //          https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Parameters
            }
        });
    }

    /**
     * The bottom triangle shows the time between the last word,
     * and when the page was loaded.
     *
     * This is of course redundant with the whn indication for that last word.
     */
    function sneak_in_one_last_whn_delta() {
        var last_delta_float = MONTY.NOW - $('.srend:last').data('whn');
        var last_delta_between = delta_format(last_delta_float);
        whn_delta.push(last_delta_between);
    }

    function path_join(left, right) {
        left = left.replace(/\/$/, "");
        right = right.replace(/^\//, "");
        return left + '/' + right;
    }
    console.assert('foo/bar' === path_join('foo', 'bar'));
    console.assert('foo/bar' === path_join('foo/', '/bar'));

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

    // var MINIMUM_RENDERED_SECONDS = 1;
    var MINIMUM_RENDERED_SECONDS = 0.1;
    var MAXIMUM_RENDERED_SECONDS = 3600*24*365*100;
    /**
     * Convert seconds to a log scale.
     *
     * @param seconds
     * @param output_min_seconds - output value to represent e.g. 1 for 1s or shorter
     * @param output_max_seconds - output value to represent e.g. 3600*24*365*100 for 100Y or longer
     * @return {*}
     */
    function log_time_scale(seconds, output_min_seconds, output_max_seconds) {
        var log_sec = Math.log(seconds);
        var omin = output_min_seconds;
        var omax = output_max_seconds;
        var log_min = Math.log(MINIMUM_RENDERED_SECONDS);
        var log_max = Math.log(MAXIMUM_RENDERED_SECONDS);
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
     * Process the members of an array asynchronously.  looper() for compute-bound tasks.
     *
     * Avoid Chrome warnings e.g. 'setTimeout' handler took 1361ms
     *
     * THANKS:  Code derived from 4th option at https://stackoverflow.com/a/45484448/673991
     *
     * @param array - e.g. $('div')
     * @param process - callback function (parameter is each array element)
     * @param delay_ms - milliseconds between calls, 0 to run "immediately" though OS intervenes
     *                   (higher value means SLOWER)
     * @param n_chunk - (optional) e.g 10 to handle 10 elements per iteration
     *                  (higher value means FASTER, but may hamstring UX)
     * @param then - (optional) called after array is finished, to do what's next
     * @return {object} setInterval object, caller could pass to clearInterval() to abort.
     */
    function array_async(array, process, delay_ms, n_chunk, then) {
        console.assert(typeof array.length === 'number', "Cannot async " + typeof array);
        if (typeof n_chunk !== 'number' || n_chunk < 1) {
            n_chunk = 1;
        }
        var i = 0;
        var interval = setInterval(function array_async_single_chunk() {
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

    var MILLISECOND = 0.001;
    var SECOND = 1;
    var MINUTE = 60*SECOND;
    var HOUR = 60*MINUTE;
    var DAY = 24*HOUR;
    var MONTH = 30*DAY;
    var YEAR = 365*DAY;

    // The following are thresholds.
    //     at and below which, we display this ---vvvv    vvvv--- above which, we display this
    var EXACTLY_ZERO    = 0.0000000000000;    //    z -> 0ms ____  <-- at exactly zero, display z
    //                    0.5*MILLISECOND;    //  0ms -> 1ms ___ `-- between these -- 0ms
    var UP_TO_MILLI     = 95*MILLISECOND;     // 95ms -> .01s _ `--- between these -- 1ms to 95ms
    var UP_TO_FRACTION  = 0.95*SECOND;        // .95s -> 1s __ `---- between these - .01s to .95s
    var UP_TO_SECOND    = 99.4*SECOND;        //  99s -> 2m _ `----- between these --- 1s to 99s
    var UP_TO_MINUTE    = 99.4*MINUTE;        //  99m -> 2h  `------ between these --- 2m to 99m
    var UP_TO_HOUR      = 48.4*HOUR;          //  48h -> 2d ___                        2h to 48h
    var UP_TO_DAY       = 99.4*DAY;           //  99d -> 3M __ `---- between these --- 2d to 99d
    var UP_TO_MONTH     = 24.4*MONTH;         //  24M -> 2Y _ `----- between these --- 3M to 24M
                                              //             `--------- above this --- 2Y to 999Y...

    // CAUTION:  Because these "constants" are defined here,
    //           delta_format() can be called before it works.
    //           If called above this line (not inside a function)
    //           it will return a bunch of NaNs.
    // SEE:  const unavailable in IE10, etc., https://stackoverflow.com/a/130399/673991

    /**
     * Format a period of time in multiple human-readable formats.
     *
     * description_short is guaranteed 2-3 characters from 0 time (z) to 99.5 years (99Y).
     *
     * EXAMPLE:  delta_format(1) == {
     *     "num": 1,
     *     "amount_short":      "1",
     *     "amount_long":       "1.0",
     *     "units_short":       "s",
     *     "units_long":        "seconds",
     *     "description_short": "1s",
     *     "description_long":  "1.0 seconds"
     * }
     * EXAMPLE:  delta_format(3628800) == {
     *     "num": 3628800,
     *     "amount_short":      "42",
     *     "amount_long":       "42.0",
     *     "units_short":       "d",
     *     "units_long":        "days",
     *     "description_short": "42d",
     *     "description_long":  "42.0 days"
     * }
     *
     * @param sec - number of seconds
     * @return {{}}
     */
    // TODO:  Candidate short descriptions for 0-1 second:
    //          0.05 - 0.94    ...  ".1s" - ".9s"
    //        0.0094 - 0.0500             ?          10ms,99ms,.01s,.05s,.09s are too long
    //                                               9-90 milliseconds - NOMINAL problem range
    //                                               10-50 milliseconds - REAL problem range
    //                                               Because .1s is KINDA close to 90 milliseconds,
    //                                               and to 80,70,60ms.  But it's too big for 50ms.
    //                                               can't be "50m"!
    //                                               Xms-Lms Roman Numerals???
    //        0.0005 - 0.0094  ...  "1ms" - "9ms"
    //        9.4e-6 - 500e-6             ?          10-500 microseconds
    //                                               10us,99us,.1ms,.5ms,.9ms   4-char-rule fits!
    //         .5e-6 - 9.4e-6  ...  "1us" - "9us"
    //        9.4e-9 - 500e-9
    //         .5e-9 - 9.4e-9  ...  "1ns" - "9ns"
    //
    //        3.5 characters would work 1ms,9ms,.01s,.05s,.1s
    //          4 characters is needed for 30 microseconds:  .1ms is too big, 9us is too small
    //                       Oh wait!  30u would be fine! So would 30n, 30p, 30f, 30a, 30z, 30y
    //        So the real problem is 30 milliseconds.  That bloody versatile letter m!
    //            .1s is 3.3x too big
    //            9ms is 3.3x too small
    //            30m is ambiguous (looks like 30 minutes)
    //            .03s might be a worthy compromise,
    //                 similarly for .01s to .05s
    //                 and it would slightly improve .06s to .09s
    //            .1s is maybe good enough for 60 milliseconds,
    //                   definitely good enough for 95 milliseconds
    //        So there'd be 3.5 characters 9.5 to 95 milliseconds ONLY, shown as .01s to .09s
    //            Wow, we could REALLY afford squeeze that decimal in close to the zero,
    //            because nowhere else is a digit preceded by a zero.
    //        Immediately outside the range .01s to .09s are
    //                                  9ms      and     .1s
    //        0 to 1 microsecond could be represented as "<1u"
    function delta_format(sec) {
        function div(n, d) {
            return (n/d).toFixed(0);
        }
        function div1(n, d) {
            return (n/d).toFixed(1);
        }
        function div2(n, d) {
            return (n/d).toFixed(2);
        }

        var word = {num: sec};
        if (sec === EXACTLY_ZERO) {
            word.amount_short = "";
            word.amount_long = "";
            word.units_short = "z";
            word.units_long = "zero";
        } else if (sec <=          UP_TO_MILLI) {
            word.amount_short = div(sec, MILLISECOND);
            word.amount_long = div1(sec, MILLISECOND);
            word.units_short = "ms";
            word.units_long = "milliseconds";
        } else if (sec <=          UP_TO_FRACTION) {
            word.amount_short = strip_leading_zeros(div1(sec, SECOND));
            word.amount_long = div2(sec, SECOND);
            word.units_short = "s";
            word.units_long = "seconds";
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

    /**
     * Convert x from an input range to an output range.  Interpolation if between.
     *
     * @param x
     * @param i_min \ range of input - x is somewhere on this continuum
     * @param i_max /
     * @param o_min \ range of output
     * @param o_max /
     * @return {*} - the same point on the output range, as x was on the input range
     */
    function scale(x, i_min, i_max, o_min, o_max) {
        return (x - i_min) * (o_max - o_min) / (i_max - i_min) + o_min;
    }
    console.assert(0.5 === scale(50,   0,100,   0,1.0));
}

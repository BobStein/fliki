
// noinspection JSUnusedGlobalSymbols
/**
 * JavaScript for contributions, a slightly more general-purpose unslumping implementation.
 *
 * @param window
 * @param $
 * @param qoolbar
 * @param MONTY
 *
 * @param MONTY.AJAX_URL
 * @param MONTY.FENCE_POST_RIGHT
 * @param MONTY.IDN
 * @param MONTY.IDN.CAPTION
 * @param MONTY.IDN.CATEGORY
 * @param MONTY.IDN.CAT_MY
 * @param MONTY.IDN.CAT_THEIR
 * @param MONTY.IDN.CAT_ANON
 * @param MONTY.IDN.CAT_TRASH
 * @param MONTY.IDN.CONTRIBUTE
 * @param MONTY.IDN.FIELD_FLUB
 * @param MONTY.IDN.QUOTE
 * @param MONTY.IDN.REORDER
 * @param MONTY.is_anonymous
 * @param MONTY.login_html
 * @param MONTY.me_idn
 * @param MONTY.me_txt
 * @param MONTY.order.cat
 * @param MONTY.order.cont
 * @param MONTY.words.cat
 * @param MONTY.words.cont
 *
 * @property word
 * @property word.sbj
 * @property word.vrb
 * @property word.was_submitted_anonymous
 *
 */
function js_for_contribution(window, $, qoolbar, MONTY) {

    var UNICODE = {
        NBSP: '\u00A0',
        VERTICAL_ELLIPSIS: '\u22EE',
        BLACK_RIGHT_POINTING_TRIANGLE: '\u25B6',
        BLACK_DOWN_POINTING_TRIANGLE: '\u25BC'
        // THANKS:  https://www.fileformat.info/info/unicode/char/
    };

    var INSERT_AFTER_TARGET = 1;
    // SEE:  SelectJS options, https://github.com/SortableJS/Sortable#user-content-options

    var ANON_V_ANON_BLURB = "Log in to see anonymous contributions (other than yours).";

    var me_name;
    var me_possessive;
    if (MONTY.is_anonymous || MONTY.me_txt === "") {
        // noinspection JSUnusedAssignment
        me_name = "me";
        me_possessive = "my";
    } else {
        me_name = MONTY.me_txt;
        me_possessive = me_name + "'s";
    }
    var me_title = me_possessive + " unslumping ";

    // Aux outputs of build_ump(), which puts the (orphan) DOM objects it creates here.
    var $umps = {};            // outer category divs:  div#xxxx_ump.target-environment
                               //                       includes h2 header and triangle valve
    var $categories = {};      // inner category divs:  div#xxxx_category.category
                               //                       Includes all div.container.word's,
                               //                       plus (for my_category) div.container-entry
                               // MONTY.order.cont[][] is kind of a skeleton of $categories.
                               // $categories[cat].find('.container').eq(n).attr('id')
                               // $categories[cat].find('.container')[n].id
                               // MONTY.order.cont[cat][n]

    $(document).ready(function() {
        qoolbar.ajax_url(MONTY.AJAX_URL);

        build();

        console.log("Initial order", order_report(MONTY.order));

        caption_should_track_text_width();

        $('#text_ump, #caption_ump').on('keyup', function text_or_caption_keyup() {
            enter_ump_disability();
        });
        enter_ump_disability();

        // noinspection JSUnusedGlobalSymbols
        $('.category').sortable({
            animation: 150,
            group: 'contributions',
            handle: '.grip',
            ghostClass: 'ghost',
            draggable: '.container',
            onMove: function sortable_move(evt) {
                if ($(evt.related).hasClass('container-entry')) {
                    return INSERT_AFTER_TARGET;
                    // NOTE:  Prevent moving the entry container.
                }
            },
            onEnd: function sortable_end(evt) {
                var from_cat_idn = $(evt.from).data('idn');
                var to_cat_idn = $(evt.to).data('idn');
                var from_cat_txt = MONTY.words.cat[from_cat_idn].txt;
                var to_cat_txt = MONTY.words.cat[to_cat_idn].txt;

                var $movee = $(evt.item);
                var movee_idn = $movee.attr('id');

                var $buttee = $(evt.item).next('.container');   // the one being displaced to the right
                var buttee_idn;
                var buttee_txt_excerpt;
                if ($buttee.length === 0) {
                    buttee_idn = MONTY.IDN.FENCE_POST_RIGHT;   // or the empty place to the right of them all
                    buttee_txt_excerpt = "[right edge]";
                } else {
                    buttee_idn = $buttee.attr('id');
                    buttee_txt_excerpt = $buttee.find('.contribution').text().substr(0, 20) + "...";
                }
                console.log(
                    "rearranged contribution", movee_idn,
                    "from", from_cat_txt + "#" + evt.oldDraggableIndex.toString(),
                    "to", to_cat_txt + "#" + evt.newDraggableIndex.toString(),
                    "butting in before", buttee_idn, buttee_txt_excerpt
                );
                if (evt.newDraggableIndex === evt.oldDraggableIndex && from_cat_idn === to_cat_idn) {
                    console.debug("(put back where it came from)");
                } else {
                    sentence({
                        vrb_idn: to_cat_idn,
                        obj_idn: movee_idn,
                        num: buttee_idn,
                        txt: ""
                    }, function () {
                        console.log("moved content", movee_idn);
                        settle_down();
                    });
                }
            }
        });
        settle_down();
        $('#enter_ump').on('click', enter_ump_click);
    });

    function enter_ump_disability() {
        if ($('#text_ump').val().length === 0 || $('#caption_ump').val().length === 0) {
            $('#enter_ump').attr('disabled', 'disabled');
        } else {
            $('#enter_ump').removeAttr('disabled');
        }
    }
    function sentence(sentence_or_null, then_what) {
        if (sentence_or_null === null) {
            then_what(null);
        } else {
            console.log("post", sentence_or_null);

            qoolbar.post('sentence', sentence_or_null, function (response) {
                var new_words = JSON.parse(response.new_words);
                if (new_words.length === 1) {
                    var new_word = new_words[0];
                    then_what(new_word);
                } else {
                    console.error("no new words");
                }
            });
        }
    }

    function enter_ump_click() {
        var text = $('#text_ump').val();
        var caption = $('#caption_ump').val();
        qoolbar.post(
            'sentence',
            {
                vrb_idn: MONTY.IDN.CONTRIBUTE,
                obj_idn: MONTY.IDN.QUOTE,
                txt: text
            },
            function enter_ump_done_1(response_1) {
                if (response_1.is_valid) {
                    var new_words_array = JSON.parse(response_1.new_words);
                    console.log("enter_ump 1", new_words_array);
                    console.assert(new_words_array.length === 1);
                    var new_word = new_words_array[0];
                    qoolbar.post(
                        'sentence',
                        {
                            vrb_idn: MONTY.IDN.CAPTION,
                            obj_idn: new_word.idn,
                            txt: caption
                        },
                        function enter_ump_done_2(response_2) {
                            var new_words_2 = JSON.parse(response_2.new_words);
                            console.log("enter up 2", new_words_2);
                            settle_down();
                        }
                    );
                    // qoolbar.page_reload();
                } else {
                    console.error("enter quote", response_1.error_message);
                }
            }
        );
    }

    /**
     * Build this page
     */
    function build() {
        var $login_prompt = $('<div>', {id: 'login-prompt'});
        $login_prompt.html(MONTY.login_html);

        $(document.body).text("");
        $(document.body).append($login_prompt);

        build_ump(me_title,    MONTY.IDN.CAT_MY,    true, true);
        build_ump("others",    MONTY.IDN.CAT_THEIR, true, true);
        build_ump("anonymous", MONTY.IDN.CAT_ANON,  true, false);
        build_ump("trash",     MONTY.IDN.CAT_TRASH, true, false);

        var $entry = $('<div>', {class: 'container-entry'});
        $entry.append($('<textarea>', {id: 'text_ump', placeholder: "enter a quote"}));
        $entry.append($('<input>', {id: 'caption_ump', placeholder: "and a caption"}));
        $entry.append($('<button>', {id: 'enter_ump'}).text("post it"));
        $categories[MONTY.IDN.CAT_MY].append($entry);

        if (MONTY.is_anonymous) {
            var $anon_blurb = $('<p>', {class: 'anon-blurb'}).text(ANON_V_ANON_BLURB);
            $categories[MONTY.IDN.CAT_ANON].append($anon_blurb);
            $umps[MONTY.IDN.CAT_ANON].addClass('double-anon');
        }

        var $containers = {};
        looper(MONTY.words.cont, function (index, word) {
            $containers[word.idn] = build_container(word);
        });

        looper(MONTY.order.cat, function (_, cat) {
            looper(MONTY.order.cont[cat], function (_, cont) {
                $categories[cat].append($containers[cont]);
            });
        });
        looper(MONTY.order.cat, function (_, idn) {
            $(document.body).append($umps[idn]);
        });
    }

    function build_container(contribution) {
        var $container = $('<div>', {class: 'container word', id: contribution.idn});
        var $contribution = $('<div>', {class: 'contribution'});
        $container.append($contribution);
        $contribution.text(contribution.txt);
        var $caption = $('<div>', {class: 'caption'});
        $container.append($caption);
        var $grip = $('<span>', {class: 'grip'});
        $caption.append($grip);
        $grip.text(UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS);
        var caption_txt = latest_txt(contribution.jbo, MONTY.IDN.CAPTION);
        if (caption_txt !== undefined) {
            $caption.append(caption_txt);
        }
        return $container;
    }

    function build_ump(title, idn, do_valve, is_valve_open) {
        // console.log("build_ump", name, idn, MONTY.categories[idn].txt);
        var name = MONTY.words.cat[idn].txt;
        var $ump = $('<div>', {id: name + '_ump', class: 'target-environment'});
        var $title = $('<h2>');
        $title.append(title);
        $ump.append($title);
        var $category = $('<div>', {id: name + '_category', class: 'category'});
        $category.data('idn', idn);
        $ump.append($category);
        if (do_valve) {
            var $valve = valve(name, is_valve_open);
            // noinspection JSCheckFunctionSignatures
            $title.prepend($valve);

            var $how_many = $('<span>', {class:'how-many'});
            // $how_many.text(" (n)");
            $title.append($how_many);

            valve_controls($valve, $category, $how_many);
        }

        $umps[idn] = $ump;
        $categories[idn] = $category;
    }

    function reconstitute_order_from_elements() {
        var order = { cat:[], cont:{} };

        $('.category').each(function () {
            var cat = $(this).data('idn');
            order.cat.push(cat);
            order.cont[cat] = [];
            $(this).find('.container').each(function () {
                order.cont[cat].push(this.id);
            });
        });
        return order;
    }

    /**
     * Make a string of category and contribution idns in order, ready to compare with order from another source.
     *
     * EXAMPLE return:
     *     "0q83_059F:0q83_05B0,0q83_0598,0q83_03B3,0q83_03BC,0q83_0372 " +
     *     "0q83_059E:0q83_0596,0q83_03B9,0q83_04"
     *
     * @param order - e.g. MONTY.order e.g.
     * @return {string}
     */
    function order_idns(order) {
        var cont_nonempty = order.cat.filter(function(cat) {
            return has(order.cont, cat) && order.cont[cat].length > 0
        });
        var cont_strings = cont_nonempty.map(function(cat) {
            return cat + ":" + order.cont[cat].join(",");
        });
        return cont_strings.join(" ");
    }

    function order_report(order) {
        var cont_nonempty = order.cat.filter(function(cat) {
            return has(order.cont, cat) && order.cont[cat].length > 0
        });
        var cont_strings = cont_nonempty.map(function(cat) {
            var first_words = order.cont[cat].map(function (cont) {
                return first_word_from_cont(cont);
            });
            return MONTY.words.cat[cat].txt + ":" + first_words.join(",");
        });
        return cont_strings.join(" ");
    }

    /**
     * Retrieve the first word of a contribution
     *
     * Or [blank] if the contribution is empty or all whitespace.
     * Or [idn] if we can't find the element.
     *
     * @param cont - idn of the contribution
     * @return {string}
     */
    function first_word_from_cont(cont) {
        var $cont = $_from_id(cont);   // actually the div.container#idn containing the div.contribution
        if ($cont.length !== 1) {
            console.error("Missing $cont", cont);
            return "[" + cont + "?]";
        }
        var txt = $cont.find('.contribution').text().trim();
        if ( ! is_laden(txt)) {
            return "[blank]";
        }
        return first_word(txt);
    }

    function first_word(string) {
        return string.trim().split(' ')[0];
    }
    console.assert("foo" === first_word(" foo bar "));
    console.assert("foo" === first_word("foo"));
    console.assert("" === first_word(""));

    var first_mismatch = true;   // Only report order mismatch once, to server and to user with an alert.

    /**
     * After major changes.
     *
     * 1. Refresh the how-many numbers in anti-valved fields (stuff that shows when closed).
     * 2. Make sure MONTY.order agrees with reconstituted_order().
     * 3. Make sure MONTY.order agrees with ajax order.
     */
    function settle_down() {
        looper(MONTY.order.cont, function recompute_category_anti_valves(cat, contribution_idns) {
            var how_many;
            if (contribution_idns.length === 0) {
                how_many = "";
            } else {
                how_many = " (" + contribution_idns.length.toString() + ")";
            }
            $umps[cat].find('.how-many').text(how_many);
        });

        var recon = reconstitute_order_from_elements();
        var recon_order = order_idns(recon);

        // NOTE:  We're not rearranging MONTY.order so we don't expect that to agree:
        // var monty_order = order_idns(MONTY.order);
        // if (monty_order !== recon_order) {
        //     console.warn(
        //         "Recon contribution order does not agree:\n" +
        //         monty_order + " == MONTY.order\n" +
        //         recon_order + " == reconstitute_order_from_elements()\n" +
        //         order_report(MONTY.order) + " == MONTY.order\n" +
        //         order_report(recon) + " == reconstitute_order_from_elements()"
        //     )
        // }

        qoolbar.post('contribution_order', {}, function (response) {
            if (response.is_valid) {
                var ajax_order = order_idns(response.order);
                if (recon_order === ajax_order) {
                    MONTY.order = response.order;
                } else {
                    var mismatch_report = "Ajax contribution order does not agree:\n" +
                        recon_order + " <-- reconstitute_order_from_elements()\n" +
                        ajax_order + " <-- ajax order\n" +
                        order_report(recon) + " <-- reconstitute_order_from_elements()\n" +
                        order_report(response.order) + " <-- ajax order";
                    console.warn(mismatch_report);
                    if (first_mismatch) {
                        first_mismatch = false;
                        sentence({
                            vrb_idn: MONTY.IDN.FIELD_FLUB,
                            txt: mismatch_report,
                            use_already: false
                        }, function () {
                            console.log("Successfully uploaded order field-flub.");
                        });
                        alert("Might be a little mixed up about the order here. Reload the page would you?");
                    }
                    // TODO:  Ajax this warning somewhere and just reload the page?
                }
                // if (monty_order !== ajax_order) {
                //     console.warn(
                //         "Ajax contribution order does not agree:\n" +
                //         monty_order + " == MONTY.order\n" +
                //         ajax_order + " == ajax order\n" +
                //         order_report(MONTY.order) + " == MONTY.order\n" +
                //         order_report(response.order) + " == ajax order"
                //     )
                // }
            } else {
                console.error("ajax reconstituted_order bust", response.error_message);
            }
        });
    }

    /**
     * Find the txt of the latest word of a specific verb.
     *
     * Either the words array input, or the return value may be undefined.
     *
     * @param words {array|undefined} - list of words, e.g. MONTY.words.cont[].jbo
     * @param vrb_sought - idn of the verb you want, e.g. IDN.CAPTION
     * @return {string|undefined} - string (maybe '') if found, undefined if there are none.
     */
    function latest_txt(words, vrb_sought) {
        if (is_defined(words)) {
            for (var i = words.length - 1 ; i >= 0 ; i--) {
                if (words[i].vrb === vrb_sought) {
                    return words[i].txt;
                }
            }
        }
        return undefined;
    }

    /**
     * Hide or show stuff.
     *
     * valve('foo') generates the DOM controls for a valve called 'foo'.  Append this somewhere.
     * valve_controls('foo', $elements) says the valve will show or hide these DOM $elements.
     *
     * @param name {string}
     * @param is_initially_open {boolean}
     * @return {jQuery}
     */
    function valve(name, is_initially_open) {
        var $valve = $('<span>', {id: id_valve(name), class: 'valve'});
        $valve.data('name', name);
        var $closer = $('<span>', {class: 'closer'}).text(UNICODE.BLACK_DOWN_POINTING_TRIANGLE);
        var $opener = $('<span>', {class: 'opener'}).text(UNICODE.BLACK_RIGHT_POINTING_TRIANGLE);
        $valve.append($closer, $opener);

        set_valve($valve, is_initially_open);
        // NOTE:  Cannot toggle valve-hidden on "-valved" objects here,
        //        because they can't have been "controlled" yet.

        $valve.on('click', function () {
            set_valve($valve, ! get_valve($valve));
        });
        return $valve;
    }
    function valve_controls($valve, $elements, $anti_elements) {
        var name = $valve.data('name');
        $elements.addClass(name + '-valved');
        $anti_elements.addClass(name + '-anti-valved');
        var is_open = get_valve($valve);
        $elements.toggleClass('valve-hidden', ! is_open);
        $anti_elements.toggleClass('valve-hidden', is_open);
    }
    function id_valve(name) {
        return name + '-valve';
    }
    function get_valve($valve) {
        return ! $valve.hasClass('valve-closed');
    }
    function set_valve($valve, should_be_open) {
        var name = $valve.data('name');
        $valve.toggleClass('valve-opened',   should_be_open);
        $valve.toggleClass('valve-closed', ! should_be_open);
        $_from_class(name + '-valved').toggleClass('valve-hidden', ! should_be_open);
        $_from_class(name + '-anti-valved').toggleClass('valve-hidden', should_be_open);
    }

    /**
     * Try to keep the caption input and textarea same width.  If not, no sweat.
     */
    function caption_should_track_text_width() {
        if (typeof window.MutationObserver === 'function') {
            var $text_ump = $('#text_ump');
            var $caption_ump = $('#caption_ump');
            function caption_tracks_text() {
                $caption_ump.width($text_ump.width());
            }
            new MutationObserver(caption_tracks_text).observe(
                $text_ump[0],
                {
                    attributes: true,
                    attributeFilter: ['style']
                }
            );
            caption_tracks_text();
        }
    }
    function $_from_class(class_) {
        return $(selector_from_class(class_));
    }
    function $_from_id(id) {
        return $(selector_from_id(id));
    }
    function selector_from_id(id) {
        return '#' + $.escapeSelector(id);
    }
    function selector_from_class(class_) {
        return '.' + $.escapeSelector(class_);
    }

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

    /**
     * Not undefined, not null, not the empty string.
     */
    function is_laden(txt) {
        return is_specified(txt) && txt !== "";
    }
    console.assert(is_laden(" "));
    console.assert( ! is_laden(""));

    /**
     * Not undefined, not null.
     */
    function is_specified(x) {
        return is_defined(x) && x !== null;
    }
    console.assert(is_specified('x'));
    console.assert( ! is_specified(null));

    /**
     * Not undefined.
     */
    function is_defined(x) {
        return typeof x !== 'undefined';
    }
    console.assert(is_defined(42));
    console.assert( ! is_defined(undefined));

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
}


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
        EN_SPACE: '\u2002',
        EM_SPACE: '\u2003',
        VERTICAL_ELLIPSIS: '\u22EE',
        BLACK_RIGHT_POINTING_TRIANGLE: '\u25B6',
        BLACK_DOWN_POINTING_TRIANGLE: '\u25BC'
        // THANKS:  https://www.fileformat.info/info/unicode/char/
    };

    // noinspection JSUnusedLocalSymbols
    var MOVE_AFTER_TARGET = 1,
        MOVE_BEFORE_TARGET = -1,
        MOVE_CANCEL = false;
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
    var $sup_categories = {};  // outer category divs:  div#sup-category-xxx.sup-category
                               //                       includes h2 header and triangle valve
    var $categories = {};      // inner category divs:  div#xxxx_category.category
                               //                       Includes all div.sup-contribution.word's,
                               //                       plus (for my_category) div.container-entry
                               // MONTY.order.cont[][] is kind of a skeleton of $categories.
                               // These are the same:
                               //     $categories[cat].find('.sup-contribution').eq(n).attr('id')
                               //     $categories[cat].find('.sup-contribution')[n].id
                               //     MONTY.order.cont[cat][n]

    var WIDTH_MAX_EM = {
        soft: 15,         // below the hard-max, display as is.
        hard: 20,         // between hard and extreme-max, limit to hard-max.
        extreme: 25       // above extreme-max, display at soft-max.
    };

    var HEIGHT_MAX_EM = {
        soft: 7,         // below the hard-max, display as is.
        hard: 10,         // between hard and extreme-max, limit to hard-max.
        extreme: 15       // above extreme-max, display at soft-max.
    };

    function size_adjust($element, dimension, max_em) {
        var natural_px = $element[dimension]();
        var natural_em = em_from_px(natural_px, $element);
        var initial_em;
        if (natural_em < max_em.hard) {
            initial_em = natural_em;
        } else if (natural_em < max_em.extreme) {
            initial_em = max_em.hard;
        } else {
            initial_em = max_em.soft;
        }
        var initial_px = px_from_em(initial_em, $element);
        console.log("Adjust", first_word($element.text()), dimension, natural_em, "to", initial_em, "em");
        $element[dimension](initial_px);
    }
    function px_from_em(em, $element) {
        $element = $element || $('body');
        return em * parseFloat($element.css('font-size'));
    }
    function em_from_px(px, $element) {
        $element = $element || $('body');
        return px / parseFloat($element.css('font-size'));
    }
    function initialize_contribution_size() {
        $('.size-adjust-once:visible').each(function () {
            var $element = $(this);
            $element.removeClass('size-adjust-once');
            size_adjust($element, 'width', WIDTH_MAX_EM);
            size_adjust($element, 'height', HEIGHT_MAX_EM);
        });
    }
    $(document).ready(function() {
        qoolbar.ajax_url(MONTY.AJAX_URL);

        build();

        caption_should_track_text_width();

        $('#text_ump, #caption_ump')
            .on('keyup', function text_or_caption_keyup() {
                enter_ump_disability();
            })
            .on('drop', function (evt) {
                text_or_caption_drop(evt);
            })
            .on('paste', function (evt) {
                text_or_caption_drop(evt);
            })
        ;
        $('#login-prompt, .sup-category')
            // .on('dragover', function () { $(this).addClass('dragging'); })
            // .on('dragleave', function () { $(this).removeClass('dragging'); })
            // .on('drop', function () { console.log("Drop sup-category"); })
        ;
        enter_ump_disability();

        $('.category, .frou-category')
            .sortable(sortable_options())
        ;

        initialize_contribution_size();

        settle_down();
        $('#enter_ump').on('click', enter_ump_click);
    });

    function text_or_caption_drop(evt) {
        var data = evt.originalEvent.dataTransfer;
        console.log("Dropped something", evt, data);
        console.log("dropEffect", data.dropEffect);
        console.log("effectAllowed", data.effectAllowed);
        // EXAMPLE (dropping YouTube link)
        //     Chrome:  dropEffect none, effectAllowed copyLink
        //     Opera:  dropEffect none, effectAllowed copyLink
        //     Firefox:  dropEffect copy, effectAllowed uninitialized
        //     IE11:  dropEffect none, (((Unexpected call to method or property access.))) <Permission denied>

        //
        var items = data.items;
        if (is_laden(items)) {
            looper(items, function (index, item) {
                console.log(index.toString() + ".", item.kind, item.type);
                item.getAsString(function (s) {
                    console.log("...", index, JSON.stringify(s));
                });
                // THANKS:  Dropped link, getting the actual URL,
                //          https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItemList/DataTransferItem#Example_Drag_and_Drop
                // TODO:  Drop anything, https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types
                // SEE:  Drop link, https://stackoverflow.com/q/11124320/673991
            });
            // EXAMPLE (Chrome, Edge, Opera):
            //     0. string text/plain
            //     1. string text/uri-list
            //     ... 0 "https://www.youtube.com/watch?v=o9tDO3HK20Q"
            //     ... 1 "https://www.youtube.com/watch?v=o9tDO3HK20Q"
            // EXAMPLE (Firefox):
            //     0. string text/x-moz-url
            //     1. string text/plain
            //     ... 0 "https://www.youtube.com/watch?v=o9tDO3HK20Q\nEarth - The Pale Blue Dot - YouTube"
            //     ... 1 "https://www.youtube.com/watch?v=o9tDO3HK20Q"
            // EXAMPLE (IE11):
            //     (data.items is undefined)
        }
    }

    function sortable_options() {
        // noinspection JSUnusedGlobalSymbols
        return {
            animation: 150,
            group: 'contributions',
            handle: '.grip',
            ghostClass: 'ghost',
            draggable: '.sup-contribution',
            onMove: function sortable_dragging(evt) {
                if (is_in_frou(evt.related)) {
                    if (is_open_drop(evt.related)) {
                        // NOTE:  This category is open (triangle points down).
                        //        So user would also be able to drop on the contributions there.
                        //        So don't let them drop on the "frou" (header),
                        //        because it's confusing being droppable next to the title
                        //        as well as among the contributions.
                        // TODO:  Ideally this drop would be allowed,
                        //        but the drop-hint would appear at the
                        //        left-most position among the contributions.
                        //        That's where it would go when dropping on a closed category.
                        return MOVE_CANCEL;
                    }
                }
            },
            onEnd: function sortable_drop(evt) {
                var $movee = $(evt.item);   // movee means the contribution being moved
                var movee_idn = $movee.attr('id');
                var from_cat_idn = $(evt.from).data('idn');
                var to_cat_idn;
                if (is_in_frou(evt.to)) {
                    // drop into a closed category
                    var $cat = $cat_of(evt.to);
                    to_cat_idn = $cat.data('idn');
                    var cat_txt = MONTY.words.cat[to_cat_idn].txt;
                    console.log(
                        "Frou drop", cat_txt,
                        "where cont", $movee[0].id,
                        "goes into cat", to_cat_idn
                    );
                    if ($cat.find('.container-entry').length > 0) {
                        // drop into category-my
                        $cat.find('.container-entry').last().after($movee);
                    } else {
                        // drop into any other category, whether empty or not
                        $cat.prepend($movee);
                    }
                } else {
                    // drop into an open category
                    to_cat_idn = $(evt.to).data('idn');
                }
                var from_cat_txt = MONTY.words.cat[from_cat_idn].txt;
                var to_cat_txt = MONTY.words.cat[to_cat_idn].txt;

                var $buttee = $movee.nextAll('.sup-contribution');   // buttee means the contribution
                                                                     // being displaced to the right, if any
                var buttee_idn;
                var buttee_txt_excerpt;
                if ($buttee.length === 0) {
                    buttee_idn = MONTY.IDN.FENCE_POST_RIGHT;   // this means the empty place to the right of them all
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
                    qoolbar.sentence({
                        vrb_idn: to_cat_idn,
                        obj_idn: movee_idn,
                        num: buttee_idn,
                        txt: ""
                    }, function () {
                        settle_down();
                    });
                }
            }
        };
    }

    /**
     * What's the category idn of this element?
     *
     * @param element
     * @return {?string}
     */
    function $cat_of(element) {
        var $sup_category = $(element).closest('.sup-category');
        if ($sup_category.length === 0) {
            console.error("How can it not be in a sup-category!?", element);
            return null;
        }
        var $cat = $sup_category.find('.category');
        return $cat;
    }

    /**
     * What's the category idn of this element?
     *
     * @param element
     * @return {?string}
     */
    function cat_idn_of(element) {
        var cat_idn = $cat_of(element).data('idn');
        return cat_idn;
    }

    /**
     * Is this element being dropped in an open-valved category?
     *
     * @param element
     * @return {boolean}
     */
    function is_open_drop(element) {
        var cat_idn = cat_idn_of(element);
        var cat_txt = MONTY.words.cat[cat_idn].txt;
        var is_open = get_valve($_from_id(id_valve(cat_txt)));
        return is_open;
    }

    /**
     * Is the element inside the frou-frou part of a category?
     *
     * This is part of the shenanigans for allowing a drop into a closed category.
     *
     * @param element
     * @return {boolean}
     */
    function is_in_frou(element) {
        return $(element).closest('.frou-category').length > 0;
        // THANKS:  Does element or any parent have a class?
        //          https://stackoverflow.com/a/17084912/673991
    }

    function console_log_order() {
        console.log("order", order_report(MONTY.order));
    }

    function enter_ump_disability() {
        if ($('#text_ump').val().length === 0 || $('#caption_ump').val().length === 0) {
            $('#enter_ump').attr('disabled', 'disabled');
        } else {
            $('#enter_ump').removeAttr('disabled');
        }
    }

    function enter_ump_click() {
        var $text = $('#text_ump');
        var $caption = $('#caption_ump');
        var text = $text.val();
        var caption = $caption.val();
        if (text.length === 0) {
            $text.focus();
            console.warn("Enter a quote.");
        } else if (caption.length === 0) {
            $caption.focus();
            console.warn("Enter a caption.");
        } else {
            qoolbar.sentence({
                vrb_idn: MONTY.IDN.CONTRIBUTE,
                obj_idn: MONTY.IDN.QUOTE,
                txt: text
            }, function enter_ump_done_1(contribute_word) {
                console.log("contribution", contribute_word);
                qoolbar.sentence({
                    vrb_idn: MONTY.IDN.CAPTION,
                    obj_idn: contribute_word.idn,
                    txt: caption
                }, function enter_ump_done_2(caption_word) {
                    console.log("caption", caption_word);
                    contribute_word.jbo = [caption_word];
                    MONTY.words.cont.push(contribute_word);
                    var $new_sup = build_contribution_dom(contribute_word);
                    $categories[MONTY.IDN.CAT_MY].find('.sup-contribution').first().before($new_sup);
                    // NOTE:  New .sup-contribution goes before the leftmost .sup-contribution
                    MONTY.order.cont[MONTY.IDN.CAT_MY].unshift(contribute_word.idn);
                    $text.val("");
                    $caption.val("");
                    settle_down();
                });
            });
        }
    }

    /**
     * Build this page
     */
    function build() {
        var $login_prompt = $('<div>', {id: 'login-prompt'});
        $login_prompt.html(MONTY.login_html);

        $(document.body).empty();
        $(document.body).append($login_prompt);

        build_category_dom(me_title,    MONTY.IDN.CAT_MY,    true, true);
        build_category_dom("others",    MONTY.IDN.CAT_THEIR, true, true);
        build_category_dom("anonymous", MONTY.IDN.CAT_ANON,  true, false);
        build_category_dom("trash",     MONTY.IDN.CAT_TRASH, true, false);

        var $entry = $('<div>', {class: 'container-entry'});
        $entry.append($('<textarea>', {id: 'text_ump', placeholder: "enter a quote"}));
        $entry.append($('<input>', {id: 'caption_ump', placeholder: "and a caption"}));
        $entry.append($('<button>', {id: 'enter_ump'}).text("post it"));
        $categories[MONTY.IDN.CAT_MY].append($entry);

        if (MONTY.is_anonymous) {
            var $anon_blurb = $('<p>', {class: 'anon-blurb'}).text(ANON_V_ANON_BLURB);
            $categories[MONTY.IDN.CAT_ANON].append($anon_blurb);
            $sup_categories[MONTY.IDN.CAT_ANON].addClass('double-anon');
            // The double-anon CSS class dims the anonymous category for anonymous users.
        }

        var $sup_contributions = {};
        looper(MONTY.words.cont, function (_, word) {
            $sup_contributions[word.idn] = build_contribution_dom(word);
        });

        looper(MONTY.order.cat, function (_, cat) {
            looper(MONTY.order.cont[cat], function (_, cont) {
                $categories[cat].append($sup_contributions[cont]);
            });
        });
        looper(MONTY.order.cat, function (_, idn) {
            $(document.body).append($sup_categories[idn]);
        });
    }

    /**
     * Build the div#idn.sup-contribution for a contribution, containing its div.contribution and div.caption.
     *
     * @param contribution_word
     * @return {jQuery}
     */
    function build_contribution_dom(contribution_word) {
        var $sup_contribution = $('<div>', {class: 'sup-contribution word', id: contribution_word.idn});
        var $contribution = $('<div>', {class: 'contribution size-adjust-once'});
        $sup_contribution.append($contribution);
        $contribution.text(leading_spaces_indent(contribution_word.txt));
        var $caption = $('<div>', {class: 'caption'});
        $sup_contribution.append($caption);
        var $grip = $('<span>', {class: 'grip'});
        $caption.append($grip);
        $grip.text(UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS);
        var caption_txt = latest_txt(contribution_word.jbo, MONTY.IDN.CAPTION);
        if (caption_txt !== undefined) {
            $caption.append(caption_txt);
        }
        return $sup_contribution;
    }

    function leading_spaces_indent(text) {
        if ( ! is_laden(text)) {
            return "";
        }
        return text.replace(/^[ \t]+/gm, function(spaces) {
            return new Array(spaces.length + 1).join(UNICODE.EN_SPACE);
            // NOTE:  UNICODE.NBSP is narrow and UNICODE.EM_SPACE is very wide.
        });
        // THANKS:  leading spaces to nbsp, https://stackoverflow.com/a/4522228/673991
    }
    /**
     * Build the div#sup-category-xxx for category xxx, including its heading, its open/close valve,
     * and the div#xxx_category that will contain its contributions.
     * Store the DOM in $sup_categories[] and $categories[].  (Each $sup_category contains each $category.)
     *
     * @param title - for the <h2>
     * @param idn - for the category
     * @param do_valve - should it have an open/close triangle?
     * @param is_valve_open - initially open?
     */
    function build_category_dom(title, idn, do_valve, is_valve_open) {
        var name = MONTY.words.cat[idn].txt;
        var $sup_category = $('<div>', {id: 'sup-category-' + name, class: 'sup-category'});
        var $title = $('<h2>', {class: 'frou-category'});
        // NOTE:  "frou" refers to the decorative stuff associated with a category.
        //        In this case, that's just the <h2> heading,
        //        which contains the category valve (the open-close triangles).
        //        In a closed category, this frou is all we see,
        //        so we have to deal with dropping there.
        $title.append(title);
        $sup_category.append($title);
        var $category = $('<div>', {id: name + '_category', class: 'category'});
        $category.data('idn', idn);
        $sup_category.append($category);
        if (do_valve) {
            var $valve = valve(name, is_valve_open);
            // noinspection JSCheckFunctionSignatures
            $title.prepend($valve);   // triangles go BEFORE the heading text

            var $how_many = $('<span>', {class:'how-many'});
            $title.append($how_many);   // (n) anti-valve goes AFTER the heading text

            valve_controls($valve, $category, $how_many);
        }

        $sup_categories[idn] = $sup_category;
        $categories[idn] = $category;
    }

    function reconstitute_order_from_dom() {
        var order = { cat:[], cont:{} };

        $('.category').each(function () {
            var cat = $(this).data('idn');
            order.cat.push(cat);
            order.cont[cat] = [];
            $(this).find('.sup-contribution').each(function () {
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
        var $cont = $_from_id(cont);   // actually the div.sup-contribution#idn containing the div.contribution
        if ($cont.length !== 1) {
            console.error("Missing contribution element, id =", cont);
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
     * After major changes:
     *
     * 1. Make sure reconstituted_order() agrees with ajax order.
     * 2. Update MONTY.order if so.
     * 3. Refresh the how-many numbers in anti-valved fields (stuff that shows when closed).
     */
    function settle_down() {
        var recon = reconstitute_order_from_dom();
        var recon_order = order_idns(recon);

        qoolbar.post('contribution_order', {}, function (response) {
            if (response.is_valid) {
                var ajax_order = order_idns(response.order);
                if (recon_order === ajax_order) {
                    MONTY.order = response.order;
                    console_log_order();
                    refresh_how_many();
                } else {
                    // FIXME:  This might mean legitimate changes on another window.
                    //         Contributions by any other user, or
                    //         rearrangements by the same user.
                    // TODO:  Rebuild??
                    //        We also need to download MONTY.words,
                    //        But then, yea, just call build()!
                    var mismatch_report = "Ajax contribution order does not agree:\n" +
                        recon_order + " <-- reconstitute_order_from_dom()\n" +
                        ajax_order + " <-- ajax order\n" +
                        order_report(recon) + " <-- reconstitute_order_from_dom()\n" +
                        order_report(response.order) + " <-- ajax order";
                    console.warn(mismatch_report);
                    if (first_mismatch) {
                        first_mismatch = false;
                        // flub(mismatch_report);
                        if (confirm("Might be a little mixed up about the order here. Okay to reload the page?")) {
                            qoolbar.page_reload();
                        }
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

    function refresh_how_many() {
        looper(MONTY.order.cont, function recompute_category_anti_valves(cat, contribution_idns) {
            var how_many;
            if (contribution_idns.length === 0) {
                how_many = "";
            } else {
                how_many = " (" + contribution_idns.length.toString() + ")";
            }
            $sup_categories[cat].find('.how-many').text(how_many);
        });
    }

    // noinspection JSUnusedLocalSymbols
    function flub(report) {
        qoolbar.sentence({
            vrb_idn: MONTY.IDN.FIELD_FLUB,
            obj_idn: MONTY.IDN.LEX,
            txt: report,
            use_already: false
        }, function () {
            console.log("Uploaded field-flub.");
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
        // TODO:  valve(options) instead, e.g. valve({name: x, is_initially_open: x});
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
            setTimeout(function () {
                initialize_contribution_size();
            });
        });
        return $valve;
    }
    function valve_controls($valve, $elements, $anti_elements) {
        // TODO:  Pass these parameters as fields to valve() options.
        //        Big problem with that!  Currently, between valve() and  valve_controls() call,
        //        The element returned by valve() must be appended into the DOM.
        //        What breaks if that doesn't happen?  I forget...
        //        Well it may be a problem that the valved and anti-valved elements cannot
        //        be conveniently placed until the $valve element exists.
        //        But maybe the solution to all this is to create an empty element and
        //        pass that TO valve() who then fills it in with triangles.
        //        Maybe the "name" (and its derivatives) can be inferred from that element's id.
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

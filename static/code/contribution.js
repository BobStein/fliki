
// noinspection JSUnusedGlobalSymbols
/**
 * JavaScript for qiki contributions, an attempt at generalizing the features of unslumping.org
 *
 * @param window
 * @param $
 * @param qoolbar
 * @param MONTY
 *
 * @param MONTY.AJAX_URL
 * @param MONTY.cat.order
 * @param MONTY.cat.txt
 * @param MONTY.FENCE_POST_RIGHT
 * @param MONTY.IDN
 * @param MONTY.IDN.CAPTION
 * @param MONTY.IDN.CATEGORY
 * @param MONTY.IDN.CAT_MY
 * @param MONTY.IDN.CAT_THEIR
 * @param MONTY.IDN.CAT_ANON
 * @param MONTY.IDN.CAT_TRASH
 * @param MONTY.IDN.CAT_ABOUT
 * @param MONTY.IDN.CONTRIBUTE
 * @param MONTY.IDN.EDIT
 * @param MONTY.IDN.FIELD_FLUB
 * @param MONTY.IDN.QUOTE
 * @param MONTY.IDN.REORDER
 * @param MONTY.IDN.UNSLUMP_OBSOLETE
 * @param MONTY.is_anonymous
 * @param MONTY.login_html
 * @param MONTY.me_idn
 * @param MONTY.me_txt
 * @param MONTY.WHAT_IS_THIS_THING
 * @param MONTY.u
 * @param MONTY.u.is_admin
 * @param MONTY.u.name_short
 * @param MONTY.w
 * @param MONTY.w.idn
 * @param MONTY.w.sbj
 * @param MONTY.w.vrb
 * @param MONTY.w.obj
 * @param MONTY.w.txt
 * @param MONTY.w.num
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
    var MOVE_AFTER_TARGET = 1,   // SortableJS shoulda defined these
        MOVE_BEFORE_TARGET = -1,
        MOVE_CANCEL = false;
    // SEE:  SelectJS options, https://github.com/SortableJS/Sortable#user-content-options
    var MOUSE_BUTTON_LEFT = 1;   // jQuery shoulda defined this
    // SEE:  jQuery event.which, https://api.jquery.com/event.which/

    var ANON_V_ANON_BLURB = (
        "You're here anonymously. " +
        "Log in to see anonymous contributions other than yours."
    );

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
    var me_title = me_possessive + " " + MONTY.WHAT_IS_THIS_THING;

    // Aux outputs of build_category(), which puts the (orphan) DOM objects it creates here.
    var $sup_categories = {};  // outer category divs:  div.sup-category
                               //                       includes h2 header and triangle valve
    var $categories = {};      // inner category divs:  div.category
                               //                       id of this inner div is the idn of the category
                               //                       Includes all div.sup-contribution elements,
                               //                       plus (for my_category) div.container-entry
                               // MONTY.order.cont[][] is kind of a skeleton of $categories.
                               // These should always be the same, the idn of the contribution:
                               //     $categories[cat].find('.contribution').eq(n).attr('id')
                               //     $categories[cat].find('.contribution')[n].id
                               //     MONTY.order.cont[cat][n]

    // Config options for size_adjust()
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

    var is_editing_some_contribution = false;   // TODO:  $(window.document.body).hasClass('edit-somewhere')
    // var is_dirty = false;
    var $cont_editing = null;   // TODO:  $('.contribution-edit').find('.contribution')
    // var original_text = null;

    $(window.document).ready(function document_ready() {
        qoolbar.ajax_url(MONTY.AJAX_URL);

        build_dom();

        $('#enter_some_text, #enter_a_caption')
            .on('keyup', post_it_button_disabled_or_not)
            .on('drop', text_or_caption_drop)
            .on('paste', text_or_caption_paste)
        ;
        $('#post_it_button').on('click', post_it_click);

        $('.category, .frou-category')
            .sortable(sortable_options())
        ;

        $(window.document)
            // .on('click', '.contribution', contribution_click)
            .on('input', '.contribution', contribution_input)
            .on('click', '.contribution', stop_propagation)
            .on('click', '.caption, .savebar', stop_propagation)
            .on('click', '.savebar .edit', contribution_edit)
            .on('click', '.savebar .cancel', contribution_cancel)
            .on('click', '.savebar .discard', contribution_cancel)
            .on('click', '.savebar .save', contribution_save)
            .on('click', attempt_content_edit_abandon)
        ;

        long_press('.contribution', contribution_edit);

        // TODO:  Prevent mousedown inside .contribution, and mouseup outside, from
        //        triggering a document click in Chrome.  (But not in Firefox.)
        //        Makes it hard to select text in a contentEditable .contribution,
        //        when the swiping happens to stray outside the div.contribution.

        $(window).on('beforeunload', function hesitate_to_unload_if_dirty_edit() {
            return attempt_content_edit_abandon() ? undefined : "Discard?";
        });
        caption_should_track_text_width();
        post_it_button_disabled_or_not();
        initialize_contribution_sizes();
        settle_down();
    });

    /**
     * Handler to e.g. avoid document click immediately undoing long-press
     */
    function stop_propagation(evt) {
        evt.stopPropagation();
    }

    function long_press(selector, handler, enough_milliseconds) {
        enough_milliseconds = enough_milliseconds || 1000;
        $(window.document)
            .on('mousedown touchstart', selector, function (evt) {
                var element = this;
                if (evt.type === 'mousedown' && evt.which !== MOUSE_BUTTON_LEFT) {
                    return;
                    // NOTE:  Ignore long right or middle mouse button press.
                }
                if (is_defined($(element).data('long_press_timer'))) {
                    // THANKS:  Avoid double timer when both events fire on Android,
                    //          https://stackoverflow.com/q/2625210/673991#comment52547525_27413909
                    //          Might also help if long_press() were called twice on the same
                    //          element, e.g. from overlapping classes.
                    return;
                }
                var timer = setTimeout(function () {
                    $(element).removeData('long_press_timer');
                    handler.call(element, evt);
                }, enough_milliseconds);
                $(element).data('long_press_timer', timer);
            })
            .on('mouseup mouseout mouseleave touchend touchleave touchcancel', selector, function () {
                var element = this;
                var timer = $(element).data('long_press_timer');
                if (is_defined(timer)) {
                    clearTimeout(timer);
                    $(element).removeData('long_press_timer');
                }
            })
            // TODO:  setInterval check?   https://stackoverflow.com/questions/7448468/
            //        why-cant-i-reliably-capture-a-mouseout-event
        ;
    }

    function contribution_input() {
        var $cont = $(this);
        var $sup_cont = $cont.closest('.sup-contribution');
        // var cont_idn = $cont.attr('id');
        if ( ! $sup_cont.hasClass('edit-dirty')) {
            $sup_cont.addClass('edit-dirty');
            $(window.document.body).removeClass('dirty-nowhere');
            // $savebar_from_cont($cont_editing).find('.cancel').text('discard')
        }
    }

    function contribution_cancel() {
        var $cont = $(this);
        var $sup_cont = $cont.closest('.sup-contribution');
        console.assert(is_editing_some_contribution);   // If not editing, how was the cancel button visible?
        if (is_editing_some_contribution) {
            if ($sup_cont.hasClass('edit-dirty')) {
                // $cont_editing.text(original_text);
                $cont_editing.text($cont_editing.data('original_text'));
            }
            contribution_edit_end();
        }
    }
    function contribution_save() {
        var cont_idn = $cont_editing.attr('id');
        if (is_editing_some_contribution) {
            var new_text = $cont_editing.text();
            if ($cont_editing.data('original_text') !== new_text) {
            // if (original_text !== new_text) {
                // console.assert(
                //     is_dirty,
                //     "Different but not dirty? " +
                //     original_text +
                //     " != " +
                //     new_text
                // );
                qoolbar.sentence({
                    vrb_idn: MONTY.IDN.EDIT,
                    obj_idn: cont_idn,
                    txt: new_text
                }, function contribution_save_done(edit_word) {
                    console.assert(is_editing_some_contribution);
                    console.log("Edit saved.", edit_word.idn);
                    $cont_editing.attr('id', edit_word.idn);
                    contribution_edit_end();
                    // NOPE:  Update MONTY.words.cont[?].idn to edit_word.idn
                    //        Update MONTY.words.cont[?].txt to new_text
                    //        Update MONTY.order.cont[cat][?] to edit_word.idn, not cont_idn
                });
            } else {
                console.log("(skipping save, no change detected to", new_text.length, "characters)");
                contribution_edit_end();
            }
        } else {
            console.error("Save but we weren't editing?", $cont_editing);
        }
    }
    function contribution_edit(evt) {
        // var $cont = $(this);
        if ($(this).is('.contribution') && is_click_on_the_resizer(evt, this)) {
            console.log("contribution_click nope, just resizing");
            return;
        }
        var $cont = $cont_of(this);   // whether `this` is .contribution or .savebar.edit
        var $sup_cont = $cont.closest('.sup-contribution');
        var was_editing_this_contribution = $sup_cont.hasClass('contribution-edit');
        console.assert(
            was_editing_this_contribution === ($cont === $cont_editing),
            was_editing_this_contribution,
            $cont,
            $cont_editing
        );
        if (was_editing_this_contribution) {
            // Leave it alone, might be selecting text to replace, or just giving focus.
        } else {
            contribution_edit_begin($cont);
            $cont.focus();
            // NOTE:  Luckily .focus() allows the click that began editing to also place the caret.
            //        Except it doesn't do that in IE11, requiring another click.
        }
        evt.stopPropagation();   // Don't let the document get it, which would end the editing.
    }

    /**
     * Get the position of a click, relative to the top-left corner of the element.
     *
     * THANKS:  click position, element-relative, https://stackoverflow.com/a/33378989/673991
     *          Paulo Bueno's code works well in Chrome, Firefox, IE11.
     *
     * @param evt - click or other mouse event
     * @param element - target of the event
     * @return {{x: number, y: number}} - in pixels from the top-left corner of the target element
     */
    function getXY(evt, element) {
        var rect = element.getBoundingClientRect();
        var scrollTop = document.documentElement.scrollTop?
                        document.documentElement.scrollTop:document.body.scrollTop;
        var scrollLeft = document.documentElement.scrollLeft?
                        document.documentElement.scrollLeft:document.body.scrollLeft;
        var elementLeft = rect.left+scrollLeft;
        var elementTop = rect.top+scrollTop;

        var x = evt.pageX-elementLeft;
        var y = evt.pageY-elementTop;
        return {x:x, y:y};
    }

    /**
     * Is the click on the div resize handle?  I.e. (crudely) with 20px of the bottom-right corner.
     *
     * THANKS:  Idea of using click-coordinates for this, https://stackoverflow.com/q/49136251/673991
     *          Brett DeWoody calls this his "final, and last, last, last resort
     *          ... ludicrous and unreliable."  Cool!
     *
     * CAVEAT:  IE11 has no div resize, so there's a little dead-zone there.
     *
     * @param evt - click or other mouse event
     * @param element - target of the event
     * @return {boolean}
     */
    function is_click_on_the_resizer(evt, element) {
        var xy = getXY(evt, element);
        var r = element.offsetWidth - xy.x;
        var b = element.offsetHeight - xy.y;
        return (
            0 <= r && r <= 20 &&
            0 <= b && b <= 20
        );
    }

    function contribution_edit_begin($cont) {
        if (attempt_content_edit_abandon()) {
            contribution_edit_show($cont);
            is_editing_some_contribution = true;
            // original_text = $cont.text();
            $cont.data('original_text', $cont.text());
            $cont_editing = $cont;
        }
    }

    /**
     * Are we able to abandon any other edit in progress?
     *
     * @return {boolean} - true if no edit, or it wasn't dirty. false if dirty edit in progress.
     */
    function attempt_content_edit_abandon() {
        if (is_editing_some_contribution) {
            var $sup_cont = $cont_editing.closest('.sup-contribution');
            if ($sup_cont.hasClass('edit-dirty')) {
                var $savebar = $savebar_from_cont($cont_editing);
                if ( ! $savebar.hasClass('abandon-alert')) {
                    $savebar.addClass('abandon-alert');
                    ignore_exception(function () {
                        $cont_editing[0].scrollIntoView({block: 'nearest', inline: 'nearest'});
                    });
                }
                // NOTE:  Scroll the red buttons into view.
                //        But only do that once because we don't want a dirty edit to be modal.
                return false;
            } else {
                contribution_edit_end();
                return true;
            }
        } else {
            return true;
        }
    }

    function ignore_exception(nonessential_function_that_may_not_be_supported) {
        try {
            nonessential_function_that_may_not_be_supported();
        } catch (_) {
        }
    }

    function contribution_edit_end() {
        if (is_editing_some_contribution) {
            is_editing_some_contribution = false;
            $('.edit-dirty').removeClass('edit-dirty');
            $(window.document.body).addClass('dirty-nowhere');
            contribution_edit_hide($cont_editing);
            $cont_editing.removeData('original_text');
            // is_dirty = false;
            // original_text = null;
            $cont_editing = null;
        }
    }

    function contribution_edit_show($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        $sup_cont.addClass('contribution-edit');
        $cont.prop('contentEditable', true);
    }

    function contribution_edit_hide($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        $sup_cont.removeClass('contribution-edit');
        $cont.prop('contentEditable', false);
        var $savebar = $savebar_from_cont($cont);
        $savebar.removeClass('abandon-alert');
        // $savebar.find('.cancel').text('cancel');
    }

    function $savebar_from_cont($cont) {
        return $cont.closest('.sup-contribution').find('.savebar');
    }

    function text_or_caption_paste(evt) {
        try {
            console.assert(evt.type === 'paste');
            var data = evt.originalEvent.clipboardData || window.clipboardData;
            if (is_defined(data)) {
                var pasted_text = data.getData('Text');
                // THANKS:  Getting pasted text, https://stackoverflow.com/a/6804718/673991
                console.log("Pasted string: `" + pasted_text + "'");
            }
        } catch (e) {
            console.error("Oops, trying to handle drop:", e.message);
        }
    }

    function text_or_caption_drop(evt) {
        try {
            console.assert(evt.type === 'drop');
            var data = evt.originalEvent.dataTransfer;
            console.log("Dropped something", evt, data);
            if (is_defined(data)) {
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
        } catch (e) {
            console.error("Oops, trying to handle drop:", e.message);
        }
    }

    function sortable_options() {
        // noinspection JSUnusedGlobalSymbols
        return {
            animation: 150,
            group: 'contributions',
            handle: '.grip',
            ghostClass: 'drop-hint',
            draggable: '.sup-contribution',
            onMove: function sortable_dragging(evt) {
                if (is_in_frou(evt.related)) {
                    if (is_open_drop(evt.related)) {
                        // NOTE:  This category is open (triangle points down).
                        //        So user can drop on the (visible) contributions there.
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
                if (is_in_about(evt.related)) {
                    if (!is_admin(MONTY.me_idn)) {
                        // NOTE:  Only the admin can move TO the about section.
                        return MOVE_CANCEL;
                    }
                }
                if (is_in_anon(evt.related)) {
                    // TODO:  Instead of this clumsiness, don't make the anon category
                    //        into a functional .category.  Just make it look like one with info.
                    if (MONTY.is_anonymous) {
                        // NOTE:  Anonymous users can't interact with other anonymous content.
                        return MOVE_CANCEL;
                    }
                }
            },
            onEnd: function sortable_drop(evt) {
                // NOTE:  movee means the contribution being moved
                var $movee = $(evt.item);
                var movee_idn = $movee.find('.contribution').attr('id');

                var from_cat_idn = $(evt.from).attr('id');
                var to_cat_idn = $cat_of(evt.to).attr('id');   // whether frou or category
                var from_cat_txt = MONTY.cat.txt[from_cat_idn];
                var to_cat_txt = MONTY.cat.txt[to_cat_idn];
                // var from_cat_txt = MONTY.words.cat[from_cat_idn].txt;
                // var to_cat_txt = MONTY.words.cat[to_cat_idn].txt;

                if (is_in_frou(evt.to)) {   // drop into a closed category
                    console.log(
                        "Frou drop", to_cat_txt,
                        "where cont", $movee[0].id,
                        "goes into cat", to_cat_idn
                    );
                    relocate_contribution_to_category_left_edge($cat_of(evt.to), $movee);
                }

                // NOTE:  buttee means the contribution shoved over to the right, if any
                var $buttee = $movee.nextAll('.sup-contribution');
                var buttee_idn;
                var buttee_txt_excerpt;
                if ($buttee.length === 0) {
                    buttee_idn = MONTY.IDN.FENCE_POST_RIGHT;   // this means the empty place to the right of them all
                    buttee_txt_excerpt = "[right edge]";
                } else {
                    buttee_idn = $buttee.find('.contribution').attr('id');
                    buttee_txt_excerpt = $buttee.find('.contribution').text().substr(0, 20) + "...";
                }
                console.log(
                    "rearranged contribution", movee_idn,
                    "from", from_cat_txt + "#" + evt.oldDraggableIndex.toString(),
                    "to", to_cat_txt + "#" + evt.newDraggableIndex.toString(),
                    "butting in before", buttee_idn, buttee_txt_excerpt
                );
                var is_same_category = from_cat_idn === to_cat_idn;
                var is_same_contribution = evt.newDraggableIndex === evt.oldDraggableIndex;
                if (is_same_category && is_same_contribution) {
                    console.debug("(put back where it came from)");
                } else {
                    qoolbar.sentence({
                        vrb_idn: to_cat_idn,
                        obj_idn: movee_idn,
                        num: buttee_idn,
                        txt: ""
                    }, function () {
                        settle_down();
                    }, function (message) {
                        revert_drag();
                    });
                }

                function revert_drag() {
                    var $from_cat = $(evt.from);
                    var $from_neighbor = $from_cat.find('.sup-contribution').eq(evt.oldDraggableIndex);
                    if ($from_neighbor.length === 1) {
                        console.debug("Revert to before", first_word($from_neighbor.text()));
                        $from_neighbor.before($movee);
                    } else {
                        console.debug("Revert to end of category", from_cat_idn);
                        $from_cat.append($movee);
                    }

                }
            }
        };
    }

    function contributions_becoming_visible_for_the_first_time_maybe() {
        initialize_contribution_sizes();
    }

    function new_contribution_just_created() {
        initialize_contribution_sizes();
    }
    function initialize_contribution_sizes() {
        $('.size-adjust-once:visible').each(function () {
            var $element = $(this);
            $element.removeClass('size-adjust-once');
            size_adjust($element, 'width', WIDTH_MAX_EM);
            size_adjust($element, 'height', HEIGHT_MAX_EM);
        });
    }
    function size_adjust($element, dimension, max_em) {
        var natural_px = $element[dimension]();
        var natural_em = em_from_px(natural_px, $element);
        var adjust_em;
        if (natural_em <= max_em.hard) {
            adjust_em = null;
        } else if (natural_em < max_em.extreme) {
            adjust_em = max_em.hard;
        } else {
            adjust_em = max_em.soft;
        }
        if (adjust_em !== null) {
            var initial_px = px_from_em(adjust_em, $element);
            $element[dimension](initial_px);
        }
    }
    function px_from_em(em, $element) {
        $element = $element || $(window.document.body);
        return em * parseFloat($element.css('font-size'));
    }
    function em_from_px(px, $element) {
        $element = $element || $(window.document.body);
        return px / parseFloat($element.css('font-size'));
    }

    function relocate_contribution_to_category_left_edge($cat, $movee) {
        if ($cat.find('.container-entry').length > 0) {
            // Drop after contribution entry form (the one in 'my' category))
            $cat.find('.container-entry').last().after($movee);
        } else {
            // drop into any other category, whether empty or not
            $cat.prepend($movee);
        }
    }

    /**
     * Is this element being dropped in an open-valved category?
     *
     * @param element
     * @return {boolean}
     */
    function is_open_drop(element) {
        var cat_idn = $cat_of(element).attr('id');
        var cat_txt = MONTY.cat.txt[cat_idn];
        var is_open = get_valve($_from_id(id_valve(cat_txt)));
        return is_open;
    }

    /**
     * What's the div.category element for this element inside it?
     *
     * @param element - any element inside div.sup-category
     * @return {jQuery} - the div.category element
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
     * What's the div.contribution element for this element inside it?
     *
     * @param element - any element inside div.sup-contribution
     * @return {jQuery} - the div.contribution element
     */
    function $cont_of(element) {
        var $sup_cont = $(element).closest('.sup-contribution');
        if ($sup_cont.length === 0) {
            console.error("How can it not be in a sup-contribution!?", element);
            return null;
        }
        var $cont = $sup_cont.find('.contribution');
        return $cont;
    }

    /**
     * Is this element inside the frou-frou part of a category (h2 header)?
     *
     * This is part of the shenanigans for allowing a drop into a closed category.
     *
     * @param element
     * @return {boolean}
     */
    function is_in_frou(element) {
        return $(element).closest('.frou-category').length > 0;
    }

    function is_in_about(element) {
        return $cat_of(element).attr('id') === MONTY.IDN.CAT_ABOUT.toString();
    }

    function is_in_anon(element) {
        return $cat_of(element).attr('id') === MONTY.IDN.CAT_ANON.toString();
    }

    /**
     * Console log the first words of each contribution, in each category.
     */
    function console_order_report() {
        // console.log("monty", order_report(MONTY.order));
        console.log(order_report(reconstitute_order_from_dom()));
        // if (has(MONTY.order, 'error_messages')) {
        //     looper(MONTY.order.error_messages, function (_, error_message) {
        //         console.warn("Monty order error:", error_message);
        //     });
        // }
    }

    function post_it_button_disabled_or_not() {
        // if (
        //     $('#enter_some_text').val().length === 0 ||
        //     $('#enter_a_caption').val().length === 0
        // ) {
        if ($('#enter_some_text').val().length === 0) {
            $('#post_it_button').attr('disabled', 'disabled');
        } else {
            $('#post_it_button').removeAttr('disabled');
        }
    }

    function post_it_click() {
        var $text = $('#enter_some_text');
        var $caption = $('#enter_a_caption');
        var text = $text.val();
        var caption = $caption.val();
        if (text.length === 0) {
            $text.focus();
            console.warn("Enter a quote.");
        // } else if (caption.length === 0) {
        //     $caption.focus();
        //     console.warn("Enter a caption.");
        } else {
            qoolbar.sentence({
                vrb_idn: MONTY.IDN.CONTRIBUTE,
                obj_idn: MONTY.IDN.QUOTE,
                txt: text
            }, function post_it_done_1(contribute_word) {
                console.log("contribution", contribute_word);
                var caption_sentence;
                if (caption.length === 0) {
                    caption_sentence = null;
                } else {
                    caption_sentence = {
                        vrb_idn: MONTY.IDN.CAPTION,
                        obj_idn: contribute_word.idn,
                        txt: caption
                    };
                }
                qoolbar.sentence(caption_sentence, function post_it_done_2(caption_word) {
                    if (is_specified(caption_word)) {
                        console.log("caption", caption_word);
                        contribute_word.jbo = [caption_word];
                    }
                    // MONTY.words.cont.push(contribute_word);
                    // Another good thing, that we don't have to do this.
                    var $new_sup = build_contribution_dom(contribute_word);
                    var $cat = $categories[MONTY.IDN.CAT_MY];
                    var $first_old_sup = $cat.find('.sup-contribution').first();
                    if ($first_old_sup.length === 1) {
                        $first_old_sup.before($new_sup);
                    } else {
                        $cat.append($new_sup);
                    }
                    // NOTE:  New .sup-contribution goes before leftmost .sup-contribution, if any.
                    // safe_prepend(MONTY.order.cont, MONTY.IDN.CAT_MY, contribute_word.idn);
                    // Is it a good thing we don't have to do this now?  Let the DOM be the (digested) database?
                    $text.val("");
                    $caption.val("");
                    settle_down();
                    setTimeout(function () {  // Give rendering some airtime.
                        new_contribution_just_created();
                    });
                });
            });
        }
    }

    /**
     * Prepend an element into an array, that's itself inside an associative array.
     *
     * And it (the inner array) may not even be there!  It may need to be inserted.
     *
     * Example:
     *
     *      var o = {prime: [3,5,7]};
     *      assert_json('{"prime":[3,5,7]}', o);
     *      safe_prepend(o, 'prime', 2);
     *      safe_prepend(o, 'perfect', 496);
     *      assert_json('{"prime":[2,3,5,7],"perfect":[496]}', o);
     *
     * @param associative_array
     * @param key
     * @param element
     */
    function safe_prepend(associative_array, key, element) {
        if (has(associative_array, key)) {
            associative_array[key].unshift(element);
        } else {
            associative_array[key] = [element];
        }
    }
    var a = {};
    safe_prepend(a, 'a', 99);   assert_json('{"a":[99]}', a);
    safe_prepend(a, 'a', 98);   assert_json('{"a":[98,99]}', a);
    safe_prepend(a, 'a', 97);   assert_json('{"a":[97,98,99]}', a);

    function assert_json(json, object) {
        var json_actual = JSON.stringify(object);
        if (json !== json_actual) {
            console.error(
                "assert oops: \n" +
                "\t`" + json + "' was expected, but \n" +
                "\t`" + json_actual + "' was the result"
            );
        }
    }

    /**
     * Build the body from scratch.
     */
    function build_dom() {
        $(window.document.body).empty();
        $(window.document.body).addClass('dirty-nowhere');

        var $login_prompt = $('<div>', {id: 'login-prompt'});
        $login_prompt.html(MONTY.login_html);
        $(window.document.body).append($login_prompt);

        build_category_dom(me_title,    MONTY.IDN.CAT_MY,    true, true);
        build_category_dom("others",    MONTY.IDN.CAT_THEIR, true, true);
        build_category_dom("anonymous", MONTY.IDN.CAT_ANON,  true, false);
        build_category_dom("trash",     MONTY.IDN.CAT_TRASH, true, false);
        build_category_dom("about",     MONTY.IDN.CAT_ABOUT, true, false);
        $sup_categories[MONTY.IDN.CAT_MY].addClass('sup-category-first');

        var $entry = $('<div>', {class: 'container-entry'});
        $entry.append($('<textarea>', {id: 'enter_some_text', placeholder: "enter a quote"}));
        $entry.append($('<input>', {id: 'enter_a_caption', placeholder: "and a caption"}));
        $entry.append($('<button>', {id: 'post_it_button'}).text("post it"));
        $categories[MONTY.IDN.CAT_MY].append($entry);

        if (MONTY.is_anonymous) {
            var $anon_blurb = $('<p>', {class: 'double-anon-blurb'}).text(ANON_V_ANON_BLURB);
            $categories[MONTY.IDN.CAT_ANON].append($anon_blurb);
            $sup_categories[MONTY.IDN.CAT_ANON].addClass('double-anon');
            // Anonymous users see a faded anonymous category with explanation.
        }

        var $sup_contributions = {};   // table of super-contribution DOM objects
        var cat_of_cont = {};   // maps contribution idn to category idn
        var conts_in_cat = {};   // for each category id, an array of contribution idns in order
        looper(MONTY.cat.order, function (_, cat) {
            conts_in_cat[cat] = [];
        });

        function consistent_cat_cont() {
            looper(cat_of_cont, function (cont, cat) {
                cont = parseInt(cont);
                console.assert(conts_in_cat[cat].indexOf(cont) !== -1, cont, cat);
                if (conts_in_cat[cat].indexOf(cont) === -1) {
                    console.error("inconsistency:", JSON.stringify(cat_of_cont), JSON.stringify(conts_in_cat));
                    return false;
                }
            });
            looper(conts_in_cat, function (cat, conts) {
                cat = parseInt(cat);
                looper(conts, function (_, cont) {
                    console.assert(cat_of_cont[cont] === cat, cat, cont);
                });
            });
        }
        consistent_cat_cont();

        function renumber_cont(old_idn, new_idn) {
            var cat = cat_of_cont[old_idn];
            console.assert(is_defined(cat), old_idn);
            var i = conts_in_cat[cat].indexOf(old_idn);
            console.assert(i !== -1, old_idn);
            conts_in_cat[cat][i] = new_idn;
            cat_of_cont[new_idn] = cat;
            delete cat_of_cont[old_idn];
            // NOTE:  Only deleting old so consistent_cat_cont() passes.
        }

        function insert_cont(cat, cont_idn, i_position) {
            if (i_position === MONTY.IDN.FENCE_POST_RIGHT) {
                conts_in_cat[cat].push(cont_idn);   // Stick it on the right end.
            } else {
                var i = conts_in_cat[cat].indexOf(i_position);
                if (i === -1) {
                    // console.error("insert_cont", cat, cont_idn, i_position, JSON.stringify(conts_in_cat));
                    console.log(
                        "(Can't insert", cont_idn,
                        "before", i_position,
                        "so it's going on the left end of", MONTY.cat.txt[cat],
                        "instead.)"
                    );
                    // NOTE:  Whatever was in there to anchor the rearranging is gone now.
                    //        Oh well, stick it in with the "latest" stuff (probably on the left).
                    //        This was happening when I wasn't processing obsolete unslump verbs.
                    //        It could also happen for anonymous users because the following
                    //        cont was from ANOTHER anonymous user so they don't see it.
                    //        Consequence is it's just out of order, no biggie.
                    conts_in_cat[cat].unshift(cont_idn);   // Stick it on the left end.
                } else {
                    conts_in_cat[cat].splice(i, 0, cont_idn);
                }
            }
        }

        looper(MONTY.w, function (_, word) {
            var $sup;
            var $cont;
            var $caption;
            if (word !== null) {
                switch (word.vrb) {
                case MONTY.IDN.CONTRIBUTE:
                case MONTY.IDN.UNSLUMP_OBSOLETE:
                    $sup = build_contribution_dom(word);
                    $cont = $sup.find('.contribution');
                    $caption = $sup.find('.caption');
                    $cont.attr('data-owner', word.sbj);
                    $caption.attr('data-owner', word.sbj);
                    $sup_contributions[word.idn] = $sup;
                    var cat = original_cat(word);
                    conts_in_cat[cat].unshift(word.idn);
                    cat_of_cont[word.idn] = cat;
                    break;
                case MONTY.IDN.CAPTION:
                    if (has($sup_contributions, word.obj)) {
                        $sup = $sup_contributions[word.obj];
                        $caption = $sup.find('.caption');
                        if (is_authorized(word, $caption.attr('data-owner'), "caption")) {
                            $caption.attr('id', word.idn);
                            $caption.attr('data-owner', word.sbj);
                            $caption.find('.caption-span').text(word.txt);
                        }
                    } else {
                        console.log("(Can't caption " + word.obj + ")");
                    }
                    break;
                case MONTY.IDN.EDIT:
                    if (has($sup_contributions, word.obj)) {
                        $sup = $sup_contributions[word.obj];
                        $cont = $sup.find('.contribution');
                        if (is_authorized(word, $cont.attr('data-owner'), "edit")) {
                            var old_idn = word.obj;
                            var new_idn = word.idn;
                            $cont.attr('id', new_idn);
                            $cont.attr('data-owner', word.sbj);
                            $cont.text(word.txt);
                            delete $sup_contributions[old_idn];
                            // TODO:  Instead of deleting, just flag it as overrode or something?
                            //        That would prevent vacuous "unknown word" situations.
                            $sup_contributions[new_idn] = $sup;
                            renumber_cont(old_idn, new_idn);
                            // TODO:  add new cat_of_cont[] index,
                            //        and change number in conts_in_cat[][]
                            consistent_cat_cont();
                        }
                        // NOTE:  This does reorder the edited contribution
                        //        But maybe that's good, it does get a new idn,
                        //        and likewise moves to the more recent end.
                    } else {
                        // TODO:  Editable captions.
                        console.log("(Can't edit " + word.obj + ")");
                        // NOTE:  One harmless way this could come about,
                        //        A logged-in user could edit an anonymous user's contribution.
                        //        Other anon users will see the edit, but not the original cont.
                        //
                        //        Another is if user A then B edits contribution x (by a third user).
                        //        A will get this message when it see's B's edit word,
                        //        because that edit word will refer to the original x's idn,
                        //        but by then x will have been displaced by A's edit word.
                    }
                    break;
                default:
                    if (has(MONTY.cat.order, word.vrb)) {
                        if (has($sup_contributions, word.obj)) {
                            var new_cat = word.vrb;
                            var cont_idn = word.obj;
                            var i_position = word.num;
                            // CAUTION:  Don't $_from_id(cont_idn) because it's not in the DOM yet.
                            $sup = $sup_contributions[cont_idn];
                            $cont = $sup.find('.contribution');
                            var is_right = i_position === MONTY.IDN.FENCE_POST_RIGHT;
                            var where = is_right ? "right" : i_position.toString();
                            var action = "drag to " + MONTY.cat.txt[new_cat] + "." + where + ",";
                            if (is_authorized(word, $cont.attr('data-owner'), action)) {
                                var post;
                                if (i_position === MONTY.IDN.FENCE_POST_RIGHT) {
                                    post = "[right edge]";
                                } else {
                                    post = i_position.toString();
                                }
                                var old_cat = cat_of_cont[cont_idn];
                                if (is_defined(old_cat)) {
                                    var i_cont = conts_in_cat[old_cat].indexOf(cont_idn);
                                    if (i_cont === -1) {
                                        console.error(
                                            "Can't find cont in order_cont",
                                            old_cat,
                                            conts_in_cat
                                        );
                                    } else {
                                        conts_in_cat[old_cat].splice(i_cont, 1);
                                        insert_cont(new_cat, cont_idn, i_position);
                                        cat_of_cont[cont_idn] = new_cat;
                                        $cont.attr('data-owner', word.sbj);
                                        consistent_cat_cont();
                                    }
                                } else {
                                    console.warn(
                                        "Lost track of cat for",
                                        cont_idn.toString(),
                                        cat_of_cont
                                    );
                                }
                            }
                        } else {
                            console.log("(Can't drag " + word.obj + ")");
                        }
                    }
                    break;
                }
            }
        });

        console.log("order_cont", conts_in_cat, cat_of_cont);

        // looper($sup_contributions, function (cont_idn, $sup_cont) {
        //     var cat = cat_of_cont[cont_idn];
        //     console.assert(is_defined(cat), cont_idn);
        //     $categories[cat].append($sup_cont);
        // });

        // var $sup_contributions = {};
        // looper(MONTY.words.cont, function (_, word) {
        //     $sup_contributions[word.idn] = build_contribution_dom(word);
        // });
        // looper(MONTY.order.cat, function (_, cat) {
        //     looper(MONTY.order.cont[cat], function (_, cont) {
        //         $categories[cat].append($sup_contributions[cont]);
        //     });
        // });

        looper(conts_in_cat, function (cat, conts) {
            looper(conts, function (_, cont) {
                $categories[cat].append($sup_contributions[cont]);
            });
        });

        looper(MONTY.cat.order, function (_, idn) {
            $(window.document.body).append($sup_categories[idn]);
        });
    }

    function original_cat(word) {
        if (word.sbj === MONTY.me_idn) {
            return MONTY.IDN.CAT_MY;
        } else if (word.was_submitted_anonymous) {
            return MONTY.IDN.CAT_ANON;
        } else {
            return MONTY.IDN.CAT_THEIR;
        }
    }

    function user_name_short(user_idn) {
        if (is_defined(user_idn)) {
            if (has(MONTY.u, user_idn)) {
                return MONTY.u[user_idn].name_short;
            } else {
                return user_idn;
            }
        } else {
            return "(unowned)";
        }
    }

    function is_admin(user_idn) {
        if (has(MONTY.u, user_idn)) {
            return MONTY.u[user_idn].is_admin;
        } else {
            return false;
        }
    }

    /**
     * Should we let this change affect a contribution?
     *
     * The hierarchy of changes to a contribution:
     *     original contributor < system admin < me (browsing user)
     *
     * So once I change a contribution, I will ignore changes by others.
     *
     * @param word - the changing word (e.g. edit or re-categorization or rearrangement)
     *               word.sbj is the idn of the user who initiated this change.
     * @param owner - tricky - this is last person we authorized to change this contribution.
     *                It starts off as the original contributor.
     *                But then if I (the browsing user) moved it or edited it, then I'm the owner.
     *                But before that if the system admin moved or edited it,
     *                then they became the owner.
     *                This field comes from the data-owner attribute.  But if we return true,
     *                then we expect data-owner to be overridden by whoever initiated this change!
     * @param action - text describing the change.
     *               (This is probably word.verb.txt, as if that were accessible in JS)
     * @return {boolean}
     */
    function is_authorized(word, owner, action) {
        var is_change_mine = word.sbj === MONTY.me_idn;
        var is_change_admin = is_admin(word.sbj);
        var is_change_owner = word.sbj === owner;
        var did_i_change_last = owner === MONTY.me_idn;
        var did_admin_change_last = is_admin(owner);
        var let_admin_change = ! did_i_change_last && is_change_admin;
        var let_owner_change = ! did_i_change_last && ! did_admin_change_last && is_change_owner;
        var ok = is_change_mine || let_admin_change || let_owner_change;
        if (ok) {
            console.log(word.idn + ". Yes " + user_name_short(word.sbj) + " may " + action + " " + word.obj + ", work of " + user_name_short(owner));
        } else {
            console.log(word.idn + ". Nope " + user_name_short(word.sbj) + " won't " + action + " " + word.obj + ", work of " + user_name_short(owner));
        }
        return ok;
    }

    /**
     * Build the div.sup-category ($sup_category) for a category.  Contributions will go in later.
     *
     * Including
     *     - open/close valve
     *     - heading text
     *     - span.how-many that will show a number when the category is closed.
     *     - div.category ($category) that will contain contributions.
     *
     * Output the DOM elements in $sup_categories[] and $categories[].
     * (Each $sup_category contains each $category.)
     *
     * @param title text - for the <h2>
     * @param cat_idn of the category
     * @param do_valve - should it have an open/close triangle?
     * @param is_valve_open - initially open?
     */
    function build_category_dom(title, cat_idn, do_valve, is_valve_open) {
        var name = MONTY.cat.txt[cat_idn];
        var $sup_category = $('<div>', {class: 'sup-category'});
        var $title = $('<h2>', {class: 'frou-category'});
        // NOTE:  "frou" refers to the decorative stuff associated with a category.
        //        In this case, that's just the <h2> heading,
        //        which contains the category valve (the open-close triangles).
        //        In a closed category, this frou is all we see,
        //        so we have to deal with dropping there.
        $title.append(title);
        $sup_category.append($title);
        var $category = $('<div>', {id: cat_idn, class: 'category'});
        $sup_category.append($category);
        if (do_valve) {
            var $valve = valve(name, is_valve_open);
            // noinspection JSCheckFunctionSignatures
            $title.prepend($valve);   // triangles go BEFORE the heading text
            var $how_many = $('<span>', {class:'how-many'});
            $title.append($how_many);   // (n) anti-valve goes AFTER the heading text
            valve_control($valve, $category, $how_many);
        }
        $sup_categories[cat_idn] = $sup_category;
        $categories[cat_idn] = $category;
    }

    /**
     * Build the div.sup-contribution for a contribution,
     * containing its div.contribution and div.caption and div.footer.
     *
     * It's returned free-range, not inserted in the DOM.
     *
     * @param contribution_word
     * @return {jQuery}
     */
    function build_contribution_dom(contribution_word) {
        var $sup_contribution = $('<div>', {class: 'sup-contribution word'});
        var $contribution = $('<div>', {class: 'contribution size-adjust-once', id: contribution_word.idn});
        $sup_contribution.append($contribution);
        $contribution.text(leading_spaces_indent(contribution_word.txt));
        var $caption = $('<div>', {class: 'caption'});
        var $savebar = $('<div>', {class: 'savebar'});
        $savebar.append($('<button>', {class: 'edit'}).text('edit'));
        $savebar.append($('<button>', {class: 'cancel'}).text('cancel'));
        $savebar.append($('<button>', {class: 'save'}).text('save'));
        $savebar.append($('<button>', {class: 'discard'}).text('discard'));
        $sup_contribution.append($caption);
        $sup_contribution.append($savebar);
        var $grip = $('<span>', {class: 'grip'});
        $caption.append($grip);
        $grip.text(UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS);
        var $caption_span = $('<span>', {class: 'caption-span'});
        $caption.append($caption_span);
        var caption_txt = latest_txt(contribution_word.jbo, MONTY.IDN.CAPTION);
        if (caption_txt !== undefined) {
            $caption_span.append(caption_txt);
        }

        if (contribution_word.was_submitted_anonymous) {
            $sup_contribution.addClass('was-submitted-anonymous');
        }
        return $sup_contribution;
    }

    /**
     * Replace each line's leading spaces with non-breaking en-spaces.
     */
    function leading_spaces_indent(text) {
        if ( ! is_laden(text)) {
            return "";
        }
        return text.replace(/^[ \t]+/gm, function(spaces) {
            return new Array(spaces.length + 1).join(UNICODE.EN_SPACE);
            // NOTE:  UNICODE.NBSP is too narrow and UNICODE.EM_SPACE is too wide.
        });
        // THANKS:  leading spaces to nbsp, https://stackoverflow.com/a/4522228/673991
    }

    function reconstitute_order_from_dom() {
        var order = { cat:[], cont:{} };

        $('.category').each(function () {
            var cat = $(this).attr('id');
            order.cat.push(cat);
            order.cont[cat] = [];
            $(this).find('.contribution').each(function () {
                order.cont[cat].push(this.id);
            });
        });
        return order;
    }

    // noinspection JSUnusedLocalSymbols
    /**
     * Make a string of category and contribution idns in order,
     * ready to compare with order from another source.
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
                console.assert(is_laden(cont), cat, "`" + cont + "`", order.cont[cat]);
                return JSON.stringify(first_word_from_cont(cont));
            });
            return MONTY.cat.txt[cat] + ":" + first_words.join(",");
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
            // console.error("Missing contribution element, id =", cont);
            return "[" + cont + "?]";
        }
        var txt = $cont/*.find('.contribution')*/.text().trim();
        if ( ! is_laden(txt)) {
            return "[blank]";
        }
        return first_word(txt);
    }

    function first_word(string) {
        return string.trim().split(' ')[0];
    }
    console.assert("foo" === first_word(" foo bar "));
    console.assert("" === first_word(""));


    /**
     * After major changes:
     *
     * 1. Make sure reconstituted_order() agrees with ajax order.
     * 2. Update MONTY.order if so.
     * 3. Refresh the how-many numbers in anti-valved fields (stuff that shows when closed).
     */
    // var first_mismatch = true;   // Only report order mismatch once, to server and to user with an alert.
    function settle_down() {
        console_order_report();
        refresh_how_many();


        // order_verification(function () {
        //     console_order_report();
        //     refresh_how_many();
        // });

        // var recon = reconstitute_order_from_dom();
        // var recon_order = order_idns(recon);
        //
        // qoolbar.post('contribution_order', {}, function (response) {
        //     if (response.is_valid) {
        //         var ajax_order = order_idns(response.order);
        //         if (recon_order === ajax_order) {
        //             MONTY.order = response.order;
        //             // NOTE:  We don't update MONTY.words.  Guess it's only used at startup.
        //             console_order_report();
        //             refresh_how_many();
        //         } else {
        //             // FIXME:  This might mean legitimate changes on another window.
        //             //         Contributions by any other user, or
        //             //         rearrangements by the same user.
        //             // TODO:  Rebuild??
        //             //        We also need to download MONTY.words,
        //             //        But then, yea, just call build()!
        //             var mismatch_report = "Ajax contribution order does not agree:\n" +
        //                 recon_order + " <-- reconstitute_order_from_dom()\n" +
        //                 ajax_order + " <-- ajax order\n" +
        //                 order_report(recon) + " <-- reconstitute_order_from_dom()\n" +
        //                 order_report(response.order) + " <-- ajax order";
        //             console.warn(mismatch_report);
        //             if (first_mismatch) {
        //                 first_mismatch = false;
        //                 // flub(mismatch_report);
        //                 if (confirm("Might be a little mixed up about the order here. Okay to reload the page?")) {
        //                     qoolbar.page_reload();
        //                 }
        //             }
        //             // TODO:  Ajax this warning somewhere and just reload the page?
        //         }
        //         // if (monty_order !== ajax_order) {
        //         //     console.warn(
        //         //         "Ajax contribution order does not agree:\n" +
        //         //         monty_order + " == MONTY.order\n" +
        //         //         ajax_order + " == ajax order\n" +
        //         //         order_report(MONTY.order) + " == MONTY.order\n" +
        //         //         order_report(response.order) + " == ajax order"
        //         //     )
        //         // }
        //     } else {
        //         console.error("ajax reconstituted_order bust", response.error_message);
        //     }
        // });
    }

    // // noinspection JSUnusedLocalSymbols
    // function order_verification(then) {
    //     var recon = reconstitute_order_from_dom();
    //     var recon_order = order_idns(recon);
    //     qoolbar.post('contribution_order', {}, function (response) {
    //         var ajax_order = order_idns(response.order);
    //         if (recon_order === ajax_order) {
    //             MONTY.order = response.order;
    //             // NOTE:  We don't update MONTY.words.  Guess it's only used at startup.
    //             then();
    //         } else {
    //             // FIXME:  This might mean legitimate changes from same user on another window,
    //             //         or contributions by any other user,
    //             //         or rearrangements by the same user.
    //             // TODO:  Rebuild??
    //             //        We also need to download MONTY.words,
    //             //        But then, yea, maybe we should just call build()!
    //             var mismatch_report = "Ajax contribution order does not agree:\n" +
    //                 recon_order + " <-- reconstitute_order_from_dom()\n" +
    //                 ajax_order + " <-- ajax order\n" +
    //                 order_report(recon) + " <-- reconstitute_order_from_dom()\n" +
    //                 order_report(response.order) + " <-- ajax order";
    //             console.warn(mismatch_report);
    //             if (first_mismatch) {
    //                 first_mismatch = false;
    //                 // flub(mismatch_report);
    //                 if (confirm("Might be a little mixed up about the order here. Okay to reload the page?")) {
    //                     qoolbar.page_reload();
    //                 }
    //             }
    //             // TODO:  Ajax this warning somewhere and just reload the page?
    //         }
    //         // if (monty_order !== ajax_order) {
    //         //     console.warn(
    //         //         "Ajax contribution order does not agree:\n" +
    //         //         monty_order + " == MONTY.order\n" +
    //         //         ajax_order + " == ajax order\n" +
    //         //         order_report(MONTY.order) + " == MONTY.order\n" +
    //         //         order_report(response.order) + " == ajax order"
    //         //     )
    //         // }
    //     });
    // }

    function refresh_how_many() {
        looper(MONTY.cat.order, function recompute_category_anti_valves(_, cat) {
            var how_many;
            var $cat = $_from_id(cat);
            var n_contributions = $cat.find('.contribution').length;
            if (n_contributions === 0) {
                how_many = "";
            } else {
                how_many = " (" + n_contributions.toString() + ")";
            }
            $sup_categories[cat].find('.how-many').text(how_many);
        });
        // looper(MONTY.order.cont, function recompute_category_anti_valves(cat, contribution_idns) {
        //     var how_many;
        //     if (contribution_idns.length === 0) {
        //         how_many = "";
        //     } else {
        //         how_many = " (" + contribution_idns.length.toString() + ")";
        //     }
        //     $sup_categories[cat].find('.how-many').text(how_many);
        // });
    }

    // noinspection JSUnusedLocalSymbols
    /**
     * Report some kerfuffle to the server.
     */
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
     * Try to keep the caption input and textarea same width.  If not, no sweat.
     */
    function caption_should_track_text_width() {
        if (typeof window.MutationObserver === 'function') {
            var $enter_some_text = $('#enter_some_text');
            var $enter_a_caption = $('#enter_a_caption');
            console.assert($enter_some_text.length === 1, $enter_some_text.length);
            console.assert($enter_a_caption.length === 1, $enter_a_caption);
            function caption_tracks_text() {
                $enter_a_caption.width($enter_some_text.width());
            }
            new MutationObserver(caption_tracks_text).observe(
                $enter_some_text[0],
                {
                    attributes: true,
                    attributeFilter: ['style']
                }
            );
            caption_tracks_text();

            // function cap_tracks_cont(mutation_list, ob) {
            //     // console.log("observe", this, mutation_list, ob);
            //     looper(mutation_list, function (index, mutation) {
            //         var $cont = $(mutation.target);
            //         var $caption = $cont.nextAll('.caption');
            //         // console.log("observe", $cont.attr('id'), first_word($caption.text()));
            //         $caption.width($cont.width());
            //     });
            // }
            // $('.contribution').each(function () {
            //     var each_contribution = this;
            //     new MutationObserver(cap_tracks_cont).observe(
            //         each_contribution,
            //         {
            //             attributes: true,
            //             attributeFilter: ['style']
            //         }
            //     );
            // });
            // TODO:  Contribution and caption should track width
            //        in .sup-contribution containers too.
            //        Not just the entry fields in div.container-entry
        }
    }

    ///////////////////////////////////////////////
    ////// valve() - click to open / click to close
    ///////////////////////////////////////////////

    /**
     * Hide or show stuff.
     *
     * $valve = valve('foo') generates the DOM controls for a valve called 'foo'.
     * Append $valve somewhere in the DOM tree.
     * valve_control() identifies what the valve should show or hide
     * when the user clicks the triangles.
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
            var old_open = get_valve($valve);
            var new_open = ! old_open;
            set_valve($valve, new_open);
            if (new_open) {
                setTimeout(function () {
                    contributions_becoming_visible_for_the_first_time_maybe();
                });
            }
        });
        return $valve;
    }

    /**
     * Identify what gets opened and closed when clicking on the valve triangles.
     *
     * @param $valve - returned by valve()
     * @param $elements - what's visible when "open"
     * @param $anti_elements - what's visible when "closed"
     */
    function valve_control($valve, $elements, $anti_elements) {
        // TODO:  Pass these parameters as fields to valve() options.
        //        Big problem with that!  Currently, between valve() and  valve_control() call,
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
        $_from_class(name +      '-valved').toggleClass('valve-hidden', ! should_be_open);
        $_from_class(name + '-anti-valved').toggleClass('valve-hidden',   should_be_open);
    }

    ////////////////////////////
    ////// Generic stuff follows
    ////////////////////////////

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
                    key,          // <-- 1st parameter - object property name, or array index
                    object[key]   // <-- 2nd parameter - value
                );
                if (false === return_value) {
                    break;
                }
            }
        }
        return object;
    }

    // noinspection DuplicatedCode,DuplicatedCode
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

    // noinspection DuplicatedCode,DuplicatedCode,DuplicatedCode,DuplicatedCode,DuplicatedCode
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

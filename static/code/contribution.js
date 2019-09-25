
// noinspection JSUnusedGlobalSymbols
/**
 * JavaScript for qiki contributions, an attempt at generalizing the features of unslumping.org
 *
 * Auxiliary input parameter extracted from the URL (window.location.search):
 *
 *     ?cont=IDN,IDN,...
 *
 * Limits the contributions displayed.
 * Each IDN is the inconvenient ROOT idn,
 * not the handier idn at the TIP of the edit chain.
 *
 * @param window
 * @param window.clipboardData
 * @param window.document
 * @param window.document.body
 * @param window.document.fullScreen
 * @param window.document.mozFullScreen
 * @param window.document.webkitIsFullScreen
 * @param window.localStorage
 * @param window.localStorage.getItem({string})
 * @param window.localStorage.setItem
 * @param window.location
 * @param window.location.href
 * @param window.MutationObserver
 * @param $
 * @param qoolbar
 * @param MONTY
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
 * @param MONTY.OEMBED_CLIENT_PREFIX
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
 * @param talkify
 *
 * @property word
 * @property word.sbj
 * @property word.vrb
 * @property word.was_submitted_anonymous
 */
function js_for_contribution(window, $, qoolbar, MONTY, talkify) {

    var DO_LONG_PRESS_EDIT = false;
    // NOTE:  Long press seems like too easy a way to trigger an edit.
    //        Only do this for mobile users?
    //        Edit is just not that common a desired course of action.

    var DO_DOCUMENT_CLICK_ENDS_CLEAN_EDIT = false;
    // NOTE:  Clicking on the document background ends a non-dirty edit.
    //        Makes more sense with DO_LONG_PRESS_EDIT.  Less so without it.

    var ANON_V_ANON_BLURB = (
        "You're here anonymously. " +
        "Log in to see anonymous contributions other than yours."
    );

    // noinspection JSUnusedLocalSymbols
    var MOVE_AFTER_TARGET = 1,   // SortableJS shoulda defined these
        MOVE_BEFORE_TARGET = -1,
        MOVE_CANCEL = false;
    // SEE:  SelectJS options, https://github.com/SortableJS/Sortable#user-content-options

    // noinspection JSUnusedLocalSymbols
    var MOUSE_BUTTON_LEFT = 1;   // jQuery shoulda defined this
    // SEE:  jQuery event.which, https://api.jquery.com/event.which/

    var UNICODE = {
        NBSP: '\u00A0',
        EN_SPACE: '\u2002',
        EM_SPACE: '\u2003',
        VERTICAL_ELLIPSIS: '\u22EE',
        BLACK_RIGHT_POINTING_TRIANGLE: '\u25B6',
        BLACK_DOWN_POINTING_TRIANGLE: '\u25BC',
        NW_SE_ARROW: '\u2921',
        NE_SW_ARROW: '\u2922'
        // THANKS:  https://www.fileformat.info/info/unicode/char/
    };

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
        hard: 40,         // between hard and extreme-max, limit to hard-max.
                          // (good reason to have a gap here: minimize wrapping)
        extreme: 45       // above extreme-max, display at soft-max.
    };
    var HEIGHT_MAX_EM = {
        soft: 7,          // below the hard-max, display as is.
        hard: 15,         // between hard and extreme-max, limit to hard-max.
                          // (no good reason to have a gap here: it's just
                          // annoying to show a tiny bit scrolled out of view)
        extreme: 15       // above extreme-max, display at soft-max.
    };
    // var WIDTH_TARGET_EM = 20;

    var is_editing_some_contribution = false;   // TODO:  $(window.document.body).hasClass('edit-somewhere')
    // var is_dirty = false;
    var $cont_editing = null;   // TODO:  $('.contribution-edit').find('.contribution')
    // var original_text = null;

    var cont_only = cont_list_from_query_string();

    var index_play_bot;
    var progress_play_bot = null;
    var list_play_bot;   // array of contribution id's

    var PLAYLIST_IN_ORDER = 'in_order';
    var PLAYLIST_RANDOM = 'random';
    var PLAYLIST_TABLE = {};
    PLAYLIST_TABLE[PLAYLIST_IN_ORDER] = {generate: playlist_in_order};
    PLAYLIST_TABLE[PLAYLIST_RANDOM  ] = {generate: playlist_random};

    var SETTING_SEQUENCER = 'setting.sequencer';

    var MEDIA_SKIP = 0;
    var MEDIA_INFINITE_PATIENCE = 1000000 * 365 * 24 * 60 * 60 * 1000;
    var MEDIA_SECONDS_TABLE = {
        youtube: MEDIA_INFINITE_PATIENCE,
        youtu_be: MEDIA_INFINITE_PATIENCE,
        // vimeo: 600,   // TODO automate playing for vimeo videos

        default: 10,   // other media is a static image
        no_media: MEDIA_INFINITE_PATIENCE,   // text being read aloud
        no_domain: MEDIA_SKIP     // badly formatted URL
    };
    // TODO:  Better way to prevent pausing youtube or talkify to result MUCH LATER
    //        in a jarring timeout and resumption of the bot with the next contribution.
    //        Now that's done with MEDIA_INFINITE_PATIENCE.

    var talkify_player = null;
    var talkify_playlist = null;
    var POPUP_PREFIX = 'popup_';
    var talkify_done = null;
    var talkify_voice_name;

    var BOT_CONTEXT = 'bot_context';  // PubSub message context

    var TALKIFY_VOICES_ENGLISH = [
        'Hazel',
        'David',
        'Zira'    // this may be the default
    ];

    $(window.document).ready(function document_ready() {
        qoolbar.ajax_url(MONTY.AJAX_URL);

        build_dom();

        $('#play-button').on('click', play_player_bot);
        $('#stop-button').on('click', stop_player_bot);
        $('#skip-button').on('click', skip_player_bot);

        $('#enter_some_text, #enter_a_caption')
            .on('change keyup input paste', post_it_button_disabled_or_not)
            .on('drop', text_or_caption_drop)
            .on('paste', text_or_caption_paste)
        ;
        $('#post_it_button').on('click', post_it_click);

        $('.category, .frou-category')
            .sortable(sortable_options())
        ;

        $(window.document)
            // .on('click', '.contribution', contribution_click)
            .on('input', '.contribution, .caption-span', contribution_dirty)
            .on('click', '.contribution', stop_propagation)
            .on('click', '.caption-bar, .save-bar', stop_propagation)
            .on('click', '.save-bar .edit',    contribution_edit)
            .on('click', '.save-bar .cancel',  contribution_cancel)
            .on('click', '.save-bar .discard', contribution_cancel)
            .on('click', '.save-bar .save',    contribution_save)
            .on('click', '.save-bar .full',    function () {
                bot_abort();
                pop_up(this, false);
            })
            .on('click', '.save-bar .unfull',  function () {
                bot_abort();
                pop_down_all();
            })
            .on('keyup', function (evt) {
                if (evt.key === 'Escape') {
                    bot_abort();
                    pop_down_all();
                }
            })
        ;

        $('#playlist-sequencer').on('change', playlist_sequencer_change);
        val_from_storage('#playlist-sequencer', SETTING_SEQUENCER);

        if (DO_DOCUMENT_CLICK_ENDS_CLEAN_EDIT) {
            $(window.document)
                .on('click', attempt_content_edit_abandon)
            ;
        }

        if (DO_LONG_PRESS_EDIT) {
            long_press('.sup-contribution', contribution_edit);
        }

        // TODO:  Prevent mousedown inside .contribution, and mouseup outside, from
        //        triggering a document click in Chrome.  (But not in Firefox.)
        //        Makes it hard to select text in a contentEditable .contribution,
        //        when the swiping happens to stray outside the div.contribution.

        $(window).on('beforeunload', function hesitate_to_unload_if_dirty_edit() {
            return is_page_dirty() ? "Discard?" : undefined;
        });
        // NOTE:  This helps prevent a user from losing work by inadvertently closing the page
        //        while in the middle of an entry or edit.

        caption_should_track_text_width();
        post_it_button_disabled_or_not();
        initialize_contribution_sizes();
        settle_down();
        $(window.document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function () {
            // noinspection JSUnresolvedVariable
            var isFullScreen = window.document.fullScreen ||
                               window.document.mozFullScreen ||
                               window.document.webkitIsFullScreen;
            var which_way = isFullScreen ? "ENTER" : "EXIT";
            console.debug(which_way, "full screen");
        });
        console.debug(
            "Unchecked runtime.lastError: Could not establish connection? " +
            "Receiving end does not exist?",
            "<--- Ignore these if you get them."
            // NOTE:  On my desktop Chrome these errors went away by disabling
            //        Youtube Playback Speed Control 0.0.5
            // SEE:  https://stackoverflow.com/q/54619817/673991#comment101370041_54765752
        );
        if (cont_only === null) {
            setTimeout(function () {
                resize_render_bars('.render-bar iframe');
                // NOTE:  Cheap-ass workaround for the zero-iframe-size bug.
                // https://github.com/davidjbradshaw/iframe-resizer/issues/629#issuecomment-525498353
                // But (even cheaper-ass) only do the workaround if no ?cont=NNN
                // -- that is, we're not limiting the contributions, showing all of them,
                // so as to preserve the failure mode in the above issue report.
                // FIXME:  Instead append query-string ?...&disable_zero_size_iframe_workaround
                //         Or wait until it's fixed.  And then remove this workaround
            }, 3 * 1000);
        }

        // setTimeout(function () {
        //     // $('.sup-contribution').each(function () { resizer_init(this); });
        //     // $('.render-bar iframe').iFrameResize({
        //     //     log: true,
        //     //     sizeWidth: true,
        //     //     sizeHeight: true,
        //     //     widthCalculationMethod: 'taggedElement'
        //     // });
        // }, 1000);
        // // NOTE:  If this delay is not enough, I don't think anything too bad happens.
        // //        You might see briefly a wafer-thin iframe before it gives its children
        // //        the data-iframe-width attribute that taggedElement needs.
        // //        That has to happen after a delay due to provider tricks with the
        // //        embedded html (see noembed_render()).
    });

    function playlist_sequencer_change() {
        // TODO:  remember in localStorage
        storage_from_val(SETTING_SEQUENCER, this);
    }

    function storage_from_val(name, selector) {
        window.localStorage.setItem(name, $(selector).val());
    }

    function val_from_storage(selector, name) {
        var setting = window.localStorage.getItem(name);
        if (is_specified(setting)) {
            $(selector).val(setting);
        }
    }

    function playlist_random() {
        var playlist = playlist_in_order();
        shuffle(playlist);
        return playlist;
    }

    function playlist_in_order() {
        var $my_category = $categories[MONTY.IDN.CAT_MY];
        return $my_category.find('.contribution[id]').map(function () {
            return this.id;
        }).get();
    }

    function playlist_generate() {
        var playlist_selection = $('#playlist-sequencer').val();
        console.assert(
            has(PLAYLIST_TABLE, playlist_selection),
            playlist_selection, "not in", PLAYLIST_TABLE
        );
        return PLAYLIST_TABLE[playlist_selection].generate();
    }

    function play_player_bot() {
        if (progress_play_bot === null) {
            list_play_bot = playlist_generate();
            // var $my_cat = $categories[MONTY.IDN.CAT_MY];
            // list_play_bot = [];
            // $my_cat.find('.contribution[id]').each(function () {
            //     list_play_bot.push(this.id);
            // });
            // // DONE:  Yes of course this should be a map call.
            console.log("play idns", list_play_bot.join(","));
            // var alt_idns = $my_cat.find('.contribution[id]').map(function () {
            //     return this.id;
            // }).get();
            // console.log("alt idns", alt_idns.join(","));

            index_play_bot = 0;
            next_play_bot();
        } else {
            console.log("(player bot already in play)");
        }
    }

    function stop_player_bot() {
        if (progress_play_bot !== null) {
            console.log("Stop player bot");
            bot_abort();
            pop_down_all();
        }
    }

    function skip_player_bot() {
        if (progress_play_bot !== null) {
            if (index_play_bot < list_play_bot.length) {
                console.log("Skipping", list_play_bot[index_play_bot]);
            } else {
                console.error("Skip shouldn't be possible", index_play_bot, list_play_bot);
            }
        }
        bot_timely_transition();
    }

    // TODO:  What if play-bot is in progress and user hits un-full button?
    //        Stop play-bot?  Or just skip to next one?  Thinking skip...

    /**
     * Stop the bot, pop-down the media, cancel the bot timeout.
     */
    function bot_abort() {
        if (progress_play_bot !== null) {
            clearTimeout(progress_play_bot);
            progress_play_bot = null;
            bot_media_ending();
        }
    }

    /**
     * At the beginning of each contribution.
     */
    function bot_media_beginning() {
        $(window.document.body).addClass('player-bot-playing');
        $('#playlist-sequencer').prop('disabled', true);
    }

    /**
     * At the end of each contribution.
     */
    function bot_media_ending() {
        $(window.document.body).removeClass('player-bot-playing');
        $('#playlist-sequencer').prop('disabled', false);
    }

    function get_media_seconds($sup_cont) {
        var data_domain = $sup_cont.attr('data-domain');
        var media_seconds;
        if (is_defined(data_domain)) {
            if (has(MEDIA_SECONDS_TABLE, data_domain)) {
                media_seconds = MEDIA_SECONDS_TABLE[data_domain];
            } else {
                media_seconds = MEDIA_SECONDS_TABLE.default;
            }
        } else {
            media_seconds = MEDIA_SECONDS_TABLE.no_media;
        }
        return media_seconds;
    }

    function next_play_bot() {
        if (index_play_bot < list_play_bot.length) {
            var cont_idn = list_play_bot[index_play_bot];
            var $cont = $_from_id(cont_idn);
            var $sup_cont = $sup_contribution($cont);
            var media_seconds = get_media_seconds($sup_cont);
            if (media_seconds === MEDIA_SKIP) {
                // NOTE:  0-second media should not be displayed at all.
                setTimeout(function () {
                    end_one_begin_another();
                }, 100);
            } else {
                pop_up($sup_cont, true);
                bot_media_beginning();
                progress_play_bot = setTimeout(function bot_media_timed_out() {
                    progress_play_bot = null;
                    console.log("Play", list_play_bot[index_play_bot], "taking too long.  Onward.");
                    bot_media_ending();
                    end_one_begin_another();
                }, media_seconds * 1000);
            }
        } else {
            console.log("End player bot");
        }
    }

    function end_one_begin_another() {
        pop_down_all();
        index_play_bot++;
        next_play_bot();
    }

    /**
     * Go to the next media in list_play_bot[] BEFORE the timeout has expired.
     */
    function bot_timely_transition() {
        if (progress_play_bot !== null) {
            bot_abort();
            end_one_begin_another();
        }
    }

    /**
     * Create an icon, something ready to pass to jQuery .append()
     *
     * THANKS:  Google icons, https://stackoverflow.com/a/27053825/673991
     * SEE:  Google icons, https://material.io/resources/icons/?style=baseline
     * SEE:  Google icons, https://github.com/google/material-design-icons
     *
     * @param name - e.g. 'play_arrow', 'volume_up'
     * @return {jQuery|string}
     */
    function $icon(name) {
        return $('<i>', {'class': 'material-icons'}).text(name);
    }

    /**
     * Initialize the iFrameResizer on an iframe jQuery object3.
     *
     * @param $iframe
     */
    // NOTE:  Intermittent error made 2 of 3 youtube videos inoperative:
    //        iframeResizer.min.js:8 Failed to execute 'postMessage' on 'DOMWindow':
    //        The target origin provided ('...the proper domain...')
    //        does not match the recipient window's origin ('null').
    function resizer_init($iframe) {
        if ($iframe.length >= 1 && typeof $iframe[0].iFrameResizer !== 'object') {
            setTimeout(function () {
                $iframe.iFrameResize({
                    log: false,
                    sizeWidth: true,
                    sizeHeight: true,
                    widthCalculationMethod: 'taggedElement',
                    onMessage: function(twofer) {
                        var message = twofer.message;
                        // NOTE:  Step 2 in the mother-daughter message demo.
                        // console.log("Mother Message In", $(message.iframe).attr('id'), message.message);
                        // EXAMPLE:  Mother Message In iframe_1849 {foo: "bar"}
                        // message.iframe.iFrameResizer.sendMessage({'moo':'butter'});
                        // noinspection JSRedundantSwitchStatement
                        switch (message.action) {
                        case 'auto-play-ended':
                            var media_cont_idn = message.contribution_idn;
                            console.log("Media ended", media_cont_idn);
                            bot_timely_transition();
                            break;
                        default:
                            console.error(
                                "Unknown action, parent <== child",
                                '"' + message.action + '"',
                                message
                            );
                            break;
                        }
                    }
                    // onInit: function resizer_init_callback(iframe) {
                    //     console.log("RESIZER_INIT_CALLBACK", iframe.id);
                    // }
                });
            }, 100);
            // NOTE:  Increase to 1500 milliseconds to avoid the following Chrome error:
            //            Failed to execute 'postMessage' on 'DOMWindow':
            //            The target origin provided ('<URL>') does not match
            //            the recipient window's origin ('<URL>').
            //        But it's a false alarm, and only happens when the iframe domain differs.
        }
    }

    /**
     * Is there unfinished entry or editing on the page?
     *
     * @return {boolean} - true = confirm exit, false = exit harmless, don't impede
     */
    function is_page_dirty() {
        return (
            $('#enter_some_text').val().length > 0 ||
            $('#enter_a_caption').val().length > 0 ||
            ! attempt_content_edit_abandon()
        );
    }

    function contribution_edit(evt) {
        var $cont = $cont_of(this);
        var $clicked_on = $(evt.target);
        // SEE:  this vs evt.target, https://stackoverflow.com/a/21667010/673991
        if ($clicked_on.is('.contribution') && is_click_on_the_resizer(evt, $clicked_on[0])) {
            console.log("contribution_click nope, just resizing");
            return;
        }
        var $sup_cont = $cont.closest('.sup-contribution');
        var was_already_editing_this_same_contribution = $sup_cont.hasClass('contribution-edit');
        if (was_already_editing_this_same_contribution) {
            // Leave it alone, might be selecting text to replace, or just giving focus.
        } else {
            contribution_edit_begin($cont);
            console.log("edit clicked", $cont[0].id);
            if ($clicked_on.is('.contribution')) {
                $cont.focus();
            } else if ($clicked_on.closest('.caption-bar').length > 0) {
                $sup_cont.find('.caption-span').focus();
            }
            // NOTE:  Luckily .focus() allows the click that began editing to also place the caret.
            //        Except it doesn't do that in IE11, requiring another click.
        }
        evt.stopPropagation();   // Don't let the document get it, which would end the editing.
    }

    function contribution_cancel() {
        var $sup_cont = $sup_contribution(this);
        var $caption_span = $sup_cont.find('.caption-span');
        console.assert(is_editing_some_contribution);
        // If not editing, how was the cancel button visible?
        if (is_editing_some_contribution) {
            if ($sup_cont.hasClass('edit-dirty')) {
                // $cont_editing.text(original_text);
                $cont_editing.text($cont_editing.data('original_text'));
                $caption_span.text($caption_span.data('original_text'));
            }
            contribution_edit_end();
        }
    }

    function $sup_contribution(somewhere_in_it) {
        return $(somewhere_in_it).closest('.sup-contribution');
    }

    function contribution_dirty() {
        var $entry = $(this);
        var $sup_cont = $entry.closest('.sup-contribution');
        if ( ! $sup_cont.hasClass('edit-dirty')) {
            $sup_cont.addClass('edit-dirty');
            $(window.document.body).removeClass('dirty-nowhere');
            console.log("Dirty", $entry[0].className, $entry.attr('id'));
        }
    }

    function contribution_save() {
        if (is_editing_some_contribution) {
            var cont_idn_old = $cont_editing.attr('id');
            edit_submit($cont_editing, "contribution", MONTY.IDN.EDIT, cont_idn_old, function () {
                var $sup_cont = $cont_editing.closest('.sup-contribution');
                var $caption_span = $sup_cont.find('.caption-span');
                var cont_idn_new = $cont_editing.attr('id');
                edit_submit($caption_span, "caption", MONTY.IDN.CAPTION, cont_idn_new, function () {
                    render_bar($cont_editing);
                    contribution_edit_end();
                });
            });
        } else {
            console.error("Save but we weren't editing?", $cont_editing);
        }
    }

    function pop_down_all() {
        var $pop_ups = $('.pop-up');
        console.assert($pop_ups.length <= 1, $pop_ups);
        $pop_ups.each(function () {
            var $popup = $(this);
            $popup.removeClass('pop-up');
            // NOTE:  This immediate removal of the pop-up class -- though premature --
            //        allows redundant back-to-back calls to pop_down_all().
            var pop_stuff = $popup.data('pop-stuff');
            // TODO:  Instead, just remember the pop-down DOM object,
            //        and recalculate its current "fixed" coordinates from it.
            var iframe = $popup.find('.render-bar iframe')[0];
            if (iframe) {
                try {
                    iframe.iFrameResizer.sendMessage({
                        action: 'un-pop-up',
                        width: pop_stuff.render_width,
                        height: pop_stuff.render_height
                    });
                } catch (e) {
                    console.error("Unable to unfull??", iframe.id, e.toString());
                }
            } else {
                // NOTE:  Harmlessly un-popping-up something with no render-bar iframe.
            }
            $popup.animate({
                top: pop_stuff.fixed_top,
                left: pop_stuff.fixed_left
            }, {
                complete: function () {
                    if (iframe) {
                        iframe.iFrameResizer.close();
                        // NOTE:  Without this, the un-full window generates warnings on resizing.
                        //        Example:
                        //            iframeResizer.js:134
                        //            [iFrameSizer][Host page: popup_iframe_1834]
                        //            [Window resize] IFrame(popup_iframe_1834) not found
                        //        And probably leaks memory.
                    }

                    $popup.data('popped-down').removeClass('pop-down');
                    $popup.removeData('popped-down');
                    $popup.remove();
                }
            });
        });
        if (talkify_player !== null) {
            talkify_player.pause();
            talkify_player.dispose();   // close the player UX
            talkify_player = null;
        }
        if (talkify_playlist !== null) {
            talkify_playlist.pause();   // stop the audio
            talkify_playlist.dispose();
            talkify_playlist = null;
        }
        if (talkify_done !== null) {
            talkify_done();
            talkify_done = null;
        }
        talkify.messageHub.unsubscribe(BOT_CONTEXT, '*.player.tts.ended');
        talkify.messageHub.unsubscribe(BOT_CONTEXT, '*.player.tts.timeupdated');
        talkify.messageHub.unsubscribe(BOT_CONTEXT, '*');
    }

    function pop_up(somewhere_in_contribution, auto_play) {
        var $sup_cont = $sup_contribution(somewhere_in_contribution);
        var $cont = $sup_cont.find('.contribution');
        var cont_idn = $cont.attr('id');
        var popup_cont_idn = POPUP_PREFIX + cont_idn;
        var popup_cont_selector = selector_from_id(popup_cont_idn);
        var was_already_popped_up = $(popup_cont_selector).length > 0;

        pop_down_all();
        if (was_already_popped_up) {
            console.error("Oops, somehow", cont_idn, "was already popped up.");
            // NOTE:  3rd line of defense, double-pop-up.
            //        Just pop down, don't pop-up again.
            return;
        }

        var offset = $sup_cont.offset();
        var window_width = $(window).width();
        var window_height = $(window).height();
        var $render_bar = $sup_cont.find('.render-bar');
        var render_width = $render_bar.width();
        var render_height = $render_bar.height();
        var caption_height = $sup_cont.find('.caption-bar').height();
        var $save_bar = $sup_cont.find('.save-bar');
        var save_height = $save_bar.height();
        console.assert(save_height > 0.0);

        var $popup = $sup_cont.clone(false, true);
        $popup.find('[id]').attr('id', function () {
            return POPUP_PREFIX + $(this).attr('id');
            // NOTE:  Prefix all ids in the clone, to avoid duplicates.
        });
        $popup.addClass('pop-up');
        $sup_cont.addClass('pop-down');
        $popup.data('popped-down', $sup_cont);
        $sup_cont.before($popup);

        var top_air = $('.sup-category-first').offset().top;

        var fixed_top = offset.top - $(window).scrollTop();
        var fixed_left = offset.left - $(window).scrollLeft();
        $popup.data('pop-stuff', {
            render_width: render_width,
            render_height: render_height,
            fixed_top: fixed_top,
            fixed_left: fixed_left
        });
        $popup.css({
            position: 'fixed',
            top: fixed_top,
            left: fixed_left,
            'z-index': 1
        });
        // THANKS:  Recast position from relative to fixed, with no apparent change,
        //          (my own compendium) https://stackoverflow.com/a/44438131/673991

        if ($sup_cont.is('.render-media')) {
            var $iframe = $popup.find('.render-bar iframe');
            resizer_init($iframe);
            // NOTE:  Finally decided the best way to make the popup iframe big
            //        was to focus on the inner CONTENTS size,
            //        and let iFrameResizer handle the outer size.
            // SEE:  Tricky iframe height 100%, https://stackoverflow.com/a/5871861/673991

            $iframe.attr('src', function () {
                var cont_padding = px_from_em(0.3 + 0.3);
                return $(this).attr('src') + '&' + $.param({
                    width:  Math.round(window_width - 30),
                    height: Math.round(
                        window_height
                        - top_air
                        - caption_height
                        - save_height
                        - 30
                        - cont_padding
                    ),
                    is_pop_up: true,
                    auto_play: auto_play.toString()
                });
                // NOTE:  The 30-pixel reduction in height gives room for browser status
                //        messages at the bottom.  Along with the same for width it also
                //        tends to prevent scrollbars from spontaneously appearing.
                //        Someday a less crude way would be good.
            });

            $popup.css({
                'background-color': 'rgba(0,0,0,0)'
            });
            $popup.animate({
                left: 0,
                top: top_air,
                'background-color': 'rgba(0,0,0,0.25)'
                // THANKS:  Alpha, not opacity, https://stackoverflow.com/a/5770362/673991
            }, {
                easing: 'swing',
                complete: function () {
                    resize_render_bars($iframe);
                    // NOTE:  This seems to work around the iFrameResizer bug
                    //        that sometimes leaves the frame zero-width when popping up.
                }
            });
        } else {
            $popup.css({
                'background-color': 'rgba(0,0,0,0)'
            });
            $popup.animate({
                left: 0,
                top: top_air,
                'background-color': 'rgba(0,0,0,0.25)'
                // THANKS:  Alpha, not opacity, https://stackoverflow.com/a/5770362/673991
            }, {
                easing: 'swing',
                complete: function () {
                    talkify.config.remoteService.host = 'https://talkify.net';
                    talkify.config.remoteService.apiKey = '084ff0b0-89a3-4284-96a1-205b5a2072c0';
                    talkify.config.ui.audioControls = {
                        enabled: false, //<-- Disable to get the browser built in audio controls
                        container: document.getElementById("player-bot")
                    };
                    talkify_player = new talkify.TtsPlayer();
                    talkify_player.enableTextHighlighting();

                    talkify_player.setRate(-1.0);   // a little slower than the default
                    // SEE:  Rate codes, https://github.com/Hagsten/Talkify#user-content-talkify-hosted-only

                    talkify_voice_name = random_element(TALKIFY_VOICES_ENGLISH);
                    talkify_player.forceVoice({name: talkify_voice_name});
                    // SEE:  Voice names,
                    //       https://github.com/Hagsten/Talkify/issues/20#issuecomment-347837787-permalink
                    //       https://jsfiddle.net/mknm62nx/1/
                    //       https://talkify.net/api/speech/v1/voices?key= + talkify api key

                    var popup_cont_node_list = document.querySelectorAll(popup_cont_selector);
                    // NOTE:  Although $(popup_cont_selector) appears to work, the doc calls for
                    //        "DOM elements" and the example passes a NodeList object.
                    //        https://github.com/Hagsten/Talkify#play-all-top-to-bottom

                    talkify_playlist = new talkify.playlist()
                        .begin()
                        .usingPlayer(talkify_player)
                        // .withTextInteraction()
                        .withElements(popup_cont_node_list)
                        .build();

                    talkify_playlist.play();
                    // NOTE:  Play now, if not auto_play pause later.

                    // console.log("Talkie", talkify_player, talkify_playlist);
                    // EXAMPLE talkify_player (type talkify.TtsPlayer) members:
                    //     audioSource: {play: ƒ, pause: ƒ, isPlaying: ƒ, paused: ƒ, currentTime: ƒ, …}
                    //     correlationId: "8e90fbe4-607f-4a82-97af-6802a18e430b"
                    //     createItems: ƒ (text)
                    //     currentContext: {item: {…}, positions: Array(86)}
                    //     disableTextHighlighting: ƒ ()
                    //     dispose: ƒ ()
                    //     enableTextHighlighting: ƒ ()
                    //     forceLanguage: ƒ (culture)
                    //     forceVoice: ƒ (voice)
                    //     forcedVoice: null
                    //     isPlaying: ƒ ()
                    //     isPlaying: ƒ ()
                    //     pause: ƒ ()
                    //     paused: ƒ ()
                    //     play: ƒ ()
                    //     playAudio: ƒ (item)
                    //     playItem: ƒ (item)
                    //     playText: ƒ (text)
                    //     playbar: {instance: null}
                    //     setRate: ƒ (r)
                    //     settings: {useTextHighlight: true, referenceLanguage: {…}, lockedLanguage: null, rate: 1, useControls: false}
                    //     subscribeTo: ƒ (subscriptions)
                    //     withReferenceLanguage: ƒ (refLang)
                    //     wordHighlighter: {start: ƒ, highlight: ƒ, dispose: ƒ}
                    // EXAMPLE talkify_playlist (type Object, e.g. {}) members:
                    //     disableTextInteraction: ƒ ()
                    //     dispose: ƒ ()
                    //     enableTextInteraction: ƒ ()
                    //     getQueue: ƒ ()
                    //     insert: ƒ insertElement(element)
                    //     isPlaying: ƒ isPlaying()
                    //     pause: ƒ pause()
                    //     play: ƒ play(item)
                    //     replayCurrent: ƒ replayCurrent()
                    //     setPlayer: ƒ (p)
                    //     startListeningToVoiceCommands: ƒ ()
                    //     stopListeningToVoiceCommands: ƒ ()

                    var duration_report = "unknown duration";

                    var pause_once = ! auto_play;

                    talkify.messageHub.subscribe(BOT_CONTEXT, '*', function (message, topic) {
                        // var members = message ? Object.keys(message).join() : "(no message)";
                        // console.debug("talkify", topic, members);
                        // EXAMPLE topics (context.type.action only, GUID context removed)
                        //         and message members:
                        //     player.*.prepareplay     \  text,preview,element,originalElement,
                        //     player.tts.loading        > isPlaying,isLoading
                        //     player.tts.loaded        /
                        //     player.tts.play          item,positions,currentTime
                        //     player.tts.timeupdated   currentTime,duration
                        //     player.tts.pause         (no message)
                        //     player.tts.ended         ((same members as loaded))
                        if (/\.play$/.test(topic)) {
                            if (pause_once) {
                                pause_once = false;
                                talkify_player.pause();
                                // NOTE:  Crude, mfing way to support manual-only playing.
                                //        Without this, player is inoperative.
                            }
                        }
                    });
                    talkify.messageHub.subscribe(
                        BOT_CONTEXT,
                        '*.player.tts.timeupdated',
                        function (message) {
                            // NOTE:  This event happens roughly 20Hz, 50ms.
                            var $highlight = $('.talkify-word-highlight');
                            $highlight.each(function () {
                                this.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                    inline: 'center'
                                });
                                // SEE:  Browser scrollIntoView, https://caniuse.com/#search=scrollIntoView
                                // TODO:  Reduce frequency of this call by tagging span
                                //        with .talkify-word-highlight-already-scrolled-into-view?
                            });
                            duration_report = message.duration.toFixed(1) + " seconds";
                        }
                    );
                    talkify.messageHub.subscribe(
                        BOT_CONTEXT,
                        '*.player.tts.ended',
                        function (/*message, topic*/) {
                            bot_timely_transition();
                            // console.log("talkify ended", popup_cont_idn, message, topic);
                            // EXAMPLE:  topic
                            //     23b92641-e7dc-46af-9f9b-cbed4de70fe4.player.tts.ended
                            // EXAMPLE:  message object members:
                            //     element: div#popup_1024.contribution.talkify-highlight
                            //     isLoading: false
                            //     isPlaying: false
                            //     originalElement: div#popup_1024.contribution
                            //     preview: "this is just a test"
                            //     text: "this is just a test"
                        }
                    );
                    talkify_done = function () {
                        console.log(
                            "talkify", popup_cont_idn,
                            "voice", talkify_voice_name,
                            duration_report
                        );
                    };
                }
            });
        }
        console.log("Popup", cont_idn);
    }

    function edit_submit($div, what, vrb, obj, then) {
        var new_text = $div.text();
        if ($div.data('original_text') === new_text) {
            console.log("(skipping", what, "save,", new_text.length, "characters unchanged)");
            then(null);
        } else {
            qoolbar.sentence({
                vrb_idn: vrb,
                obj_idn: obj,
                txt: new_text
            }, function edit_submit_done(edit_word) {
                console.log("Saved", what, edit_word.idn);
                $div.attr('id', edit_word.idn);
                then(edit_word);
            });
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
                var $save_bar = $save_bar_from_cont($cont_editing);
                if ( ! $save_bar.hasClass('abandon-alert')) {
                    $save_bar.addClass('abandon-alert');
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

    function contribution_edit_begin($cont) {
        if (attempt_content_edit_abandon()) {
            contribution_edit_show($cont);
            is_editing_some_contribution = true;
            $cont.data('original_text', $cont.text());
            var $caption_span = $cont.closest('.sup-contribution').find('.caption-span');
            $caption_span.data('original_text', $caption_span.text());
            $cont_editing = $cont;
        }
    }

    function contribution_edit_end() {
        if (is_editing_some_contribution) {
            is_editing_some_contribution = false;
            $('.edit-dirty').removeClass('edit-dirty');
            $(window.document.body).addClass('dirty-nowhere');
            contribution_edit_hide($cont_editing);
            var $caption_span = $cont_editing.closest('.sup-contribution').find('.caption-span');
            $cont_editing.removeData('original_text');
            $caption_span.removeData('original_text');
            $cont_editing = null;
        }
    }

    function contribution_edit_show($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.addClass('contribution-edit');
        $cont.prop('contentEditable', true);
        $caption_span.prop('contentEditable', true);
    }

    function contribution_edit_hide($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.removeClass('contribution-edit');
        $cont.prop('contentEditable', false);
        $caption_span.prop('contentEditable', false);
        var $save_bar = $save_bar_from_cont($cont);
        $save_bar.removeClass('abandon-alert');
    }

    function $save_bar_from_cont($cont) {
        return $cont.closest('.sup-contribution').find('.save-bar');
    }

    function text_or_caption_paste(evt) {
        try {
            console.assert(evt.type === 'paste');
            var data = evt.originalEvent.clipboardData || window.clipboardData;
            if (is_defined(data)) {
                var pasted_text = data.getData('Text');
                // THANKS:  Getting pasted text, https://stackoverflow.com/a/6804718/673991
                console.log("Pasted string: `" + pasted_text + "'");
                    // NOTE:  Only insert a new oembed-supplied caption
                    //        if both text and caption were blank
                    //        BEFORE the pasting took place.
                possible_incoming_media("paste", evt, pasted_text, function (url, title) {
                    var $enter_some_text = $('#enter_some_text');
                    var $enter_a_caption = $('#enter_a_caption');
                    var is_new_text = (
                        $enter_some_text.val().length === 0 ||   // was blank (is blank?? remove this?)
                        $enter_some_text.val() === url           // must have pasted over all
                    );
                    var is_blank_caption = $enter_a_caption.val().length === 0;
                    if (is_new_text && is_blank_caption) {
                        $enter_a_caption.val(title);
                        // NOTE:  Insert a caption when it was blank, and
                        //        the text is completely overwritten by the pasted url.
                        //        Unlike drop, pasting a URL into the caption does nothing special.
                        //        The thinking is, paste is more surgical than drop,
                        //        so take the user a little more literally.
                        // TODO:  Also overwrite a semi-dirty caption, that is,
                        //        the automated result of a previous paste or drop.
                    }
                });
            }
        } catch (e) {
            console.error("Oops, trying to handle paste:", e.message);
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
                        if (
                            item.kind === 'string' &&
                            item.type === 'text/plain'
                        ) {
                            item.getAsString(function (might_be_url) {
                                console.assert(typeof might_be_url === 'string');
                                possible_incoming_media(
                                    "drop",
                                    evt,
                                    might_be_url,
                                    function (url, title) {
                                        var $enter_some_text = $('#enter_some_text');
                                        var $enter_a_caption = $('#enter_a_caption');
                                        $enter_some_text.val(url);
                                        $enter_a_caption.val(title);
                                        // TODO:  Avoid dropping new text/caption when they're dirty.
                                        //        But do overwrite semi-dirty,
                                        //        that is already the result of earlier URL drop/paste.
                                    }
                                );
                            });
                        }
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
                    // EXAMPLE (dropping a YouTube thumbnail in Chrome, supplemental):
                    //     2. string text/html
                    //     ... 0 "https://www.youtube.com/watch?v=YsA3PK8bQd8"
                    //     ... 1 "https://www.youtube.com/watch?v=YsA3PK8bQd8"
                    //     ... 2 "<a id=\"thumbnail\" class=\"yt-simple-endpoint ...
                    //            ...
                    //                </ytd-thumbnail-overlay-toggle-button-renderer></div>\n
                    //            </a>"
                } else {
                    console.log("... items is", typeof items);
                }
            }
        } catch (e) {
            console.error("Oops, trying to handle drop:", e.message);
        }
    }

    function possible_incoming_media(what, evt, url, oembed_handler) {
        if (can_i_get_meta_about_it(url)) {
            qoolbar.post('noembed_meta', {
                url: url
            }, function (oembed_response) {
                console.log("noembed meta", what, oembed_response);
                if (
                    typeof oembed_response.oembed.title === 'string' &&
                    typeof oembed_response.oembed.error === 'undefined'
                ) {
                    var title = oembed_response.oembed.title;
                    oembed_handler(url, title);
                } else {
                    console.warn("Not an oembed URL", what, url, oembed_response.oembed.error);
                }
            });
            // NOTE:  The following anti-bubbling, anti-propagation code
            //        we could do it, but it probably never does anything.
            //            evt.preventDefault();
            //            evt.stopPropagation();
            //            return false;
            //        I'm not the only one who thinks this is bull puppy:
            //        https://opensourcehacker.com/2011/11/11/cancelling
            //        -html5-drag-and-drop-events-in-web-browsers/
            //        Hint:  you have to cancel dragover / dragenter
            // SEE:  Valid drop target
            //       https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations#drop
            //       https://stackoverflow.com/q/8414154/673991
        } else {
            console.log("Incoming non-URL", what, url);
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
                    }, function sortable_done() {
                        settle_down();
                    }, function sortable_fail() {
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
        resize_render_bars('.render-bar iframe');
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
    function resize_render_bars(selector) {
        $(selector).each(function () {
            this.iFrameResizer.resize();
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

    function post_it_button_disabled_or_not() {
        if ($('#enter_some_text').val().length === 0) {
            $('#post_it_button').attr('disabled', 'disabled');
        } else {
            $('#post_it_button').removeAttr('disabled');
        }
    }

    function post_it_click() {
        var $text = $('#enter_some_text');
        var $caption_input = $('#enter_a_caption');
        var text = $text.val();
        var caption = $caption_input.val();
        if (text.length === 0) {
            $text.focus();
            console.warn("Enter some content.");
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
                    var $sup_cont = build_contribution_dom(contribute_word);
                    var $cat = $categories[MONTY.IDN.CAT_MY];
                    var $first_old_sup = $cat.find('.sup-contribution').first();
                    if ($first_old_sup.length === 1) {
                        $first_old_sup.before($sup_cont);
                    } else {
                        $cat.append($sup_cont);
                    }
                    // NOTE:  New .sup-contribution goes before leftmost .sup-contribution, if any.
                    // safe_prepend(MONTY.order.cont, MONTY.IDN.CAT_MY, contribute_word.idn);
                    // Is it a good thing we don't have to do this now?  Let the DOM be the (digested) database?
                    $text.val("");
                    $caption_input.val("");
                    render_bar($sup_cont);
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

    var auth_log;   // Record all the decisions made by is_authorized().

    function url_with_no_query_string() {
        return window.location.href.split('?')[0];
    }

    /**
     * Build the body from scratch.
     */
    // TODO:  Faster bypassing jQuery, https://howchoo.com/g/mmu0nguznjg/
    //        learn-the-slow-and-fast-way-to-append-elements-to-the-dom
    function build_dom() {
        $(window.document.body).empty();
        $(window.document.body).addClass('dirty-nowhere');

        var $up_top = $('<div>', {id: 'up-top'});
        $(window.document.body).append($up_top);

        var $status_prompt = $('<div>', {id: 'status-prompt'});
        $status_prompt.text("");
        if (cont_only !== null) {
            $status_prompt.append("only idn " + cont_only.join(", ") + " - ");
            $status_prompt.append($('<a>', {href: url_with_no_query_string()}).text("see all"));
        }
        $up_top.append($status_prompt);

        var $bot = $('<div>', {id: 'player-bot'});

        $bot.append($('<button>', {id: 'play-button'})
            .append($icon('play_arrow'))
            .append(" play")
        );
        $bot.append($('<button>', {id: 'stop-button'})
            .append($icon('stop'))
            .append(" stop")
        );
        $bot.append($('<button>', {id: 'skip-button'})
            .append($icon('skip_next'))
            .append(" skip")
        );
        $bot.append($('<select>', {id: 'playlist-sequencer'})
            .append($('<option>', {value: PLAYLIST_IN_ORDER}).text("in order"))
            .append($('<option>', {value: PLAYLIST_RANDOM  }).text("random"))
        );
        $up_top.append($bot);

        var $login_prompt = $('<div>', {id: 'login-prompt'});
        $login_prompt.html(MONTY.login_html);
        $up_top.append($login_prompt);

        build_category_dom(me_title,    MONTY.IDN.CAT_MY,    true, true);
        build_category_dom("others",    MONTY.IDN.CAT_THEIR, true, true);
        build_category_dom("anonymous", MONTY.IDN.CAT_ANON,  true, false);
        build_category_dom("trash",     MONTY.IDN.CAT_TRASH, true, false);
        build_category_dom("about",     MONTY.IDN.CAT_ABOUT, true, false);
        $sup_categories[MONTY.IDN.CAT_MY].addClass('sup-category-first');

        var $entry = $('<div>', {class: 'container-entry'});
        $entry.append($('<textarea>', {id: 'enter_some_text', placeholder: "enter a quote or video"}));
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

        auth_log = [];

        looper(MONTY.w, function (_, word) {
            var $sup;
            var $cont;
            var $caption_span;
            if (word !== null) {
                switch (word.vrb) {
                case MONTY.IDN.CONTRIBUTE:
                case MONTY.IDN.UNSLUMP_OBSOLETE:
                    if (query_string_filter(word, cont_only)) {
                        $sup = build_contribution_dom(word);
                        $cont = $sup.find('.contribution');
                        $caption_span = $sup.find('.caption-span');
                        $cont.attr('data-owner', word.sbj);
                        $caption_span.attr('data-owner', word.sbj);
                        $sup_contributions[word.idn] = $sup;
                        var cat = original_cat(word);
                        conts_in_cat[cat].unshift(word.idn);
                        cat_of_cont[word.idn] = cat;
                    }
                    break;
                case MONTY.IDN.CAPTION:
                    if (has($sup_contributions, word.obj)) {
                        $sup = $sup_contributions[word.obj];
                        $caption_span = $sup.find('.caption-span');
                        if (is_authorized(word, $caption_span.attr('data-owner'), "caption")) {
                            $caption_span.attr('id', word.idn);
                            $caption_span.attr('data-owner', word.sbj);
                            $caption_span.text(word.txt);
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
                        //        Other anon user would get this edit-word, but not the original word.
                        //        TODO:  They should see this edit.   Now they won't.
                        //
                        //        Another is if user A then B edits contribution x (by a third user).
                        //        B won't enforce A's edit, so although B's edit is later,
                        //        it will refer back to the original contribution.
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
        console.log("Authorizations", auth_log.join("\n"));

        console.log("order_cont", conts_in_cat, cat_of_cont);

        looper(conts_in_cat, function (cat, conts) {
            looper(conts, function (_, cont) {
                $categories[cat].append($sup_contributions[cont]);
            });
        });

        looper(MONTY.cat.order, function (_, idn) {
            $(window.document.body).append($sup_categories[idn]);
        });

        // NOTE:  Now the contributions are in the DOM.

        $('.sup-contribution').each(function () {
            render_bar($(this));
        });
    }

    function cont_list_from_query_string() {
        var cont_filter = query_get('cont', null);
        if (cont_filter === null) {
            return null;
        } else {
            var cont_array = cont_filter.split(',');
            return cont_array;
        }
    }

    function query_string_filter(word, cont_array) {
        if (cont_array === null) {
            return true;
        } else if (has(cont_array, word.idn.toString())) {
            return true;
        } else {
            console.log("Skipping", word.idn.toString(), "in", cont_array);
            return false;
        }
    }

    function iframe_src_from_url(url, idn) {
        return MONTY.OEMBED_CLIENT_PREFIX + "?" + $.param({url: url, idn: idn});
        // THANKS:  jQuery query string, https://stackoverflow.com/a/31599255/673991
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
            auth_log.push(word.idn + ". Yes " + user_name_short(word.sbj) + " may " + action + " " + word.obj + ", work of " + user_name_short(owner));
        } else {
            auth_log.push(word.idn + ". Nope " + user_name_short(word.sbj) + " won't " + action + " " + word.obj + ", work of " + user_name_short(owner));
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
     * containing its div.contribution and div.caption-bar and div.save-bar.
     *
     * It's returned free-range, not inserted in the DOM.
     *
     * @param contribution_word
     * @return {jQuery}
     */
    function build_contribution_dom(contribution_word) {
        var $sup_contribution = $('<div>', {class: 'sup-contribution word'});
        var $contribution = $('<div>', {
            id: contribution_word.idn,
            class: 'contribution size-adjust-once'
        });
        $sup_contribution.append($contribution);
        $contribution.text(leading_spaces_indent(contribution_word.txt));
        var $render_bar = $('<div>', {class: 'render-bar'});
        var $caption_bar = $('<div>', {class: 'caption-bar'});
        var $save_bar = $('<div>', {class: 'save-bar'});
        $save_bar.append($('<button>', {class: 'edit'}).text('edit'));
        $save_bar.append($('<button>', {class: 'cancel'}).text('cancel'));
        $save_bar.append($('<button>', {class: 'save'}).text('save'));
        $save_bar.append($('<button>', {class: 'discard'}).text('discard'));
        $save_bar.append($('<button>', {class: 'full'}).text('full'));
        $save_bar.append($('<button>', {class: 'unfull'}).text('unfull'));
        $sup_contribution.append($render_bar);
        $sup_contribution.append($caption_bar);
        $sup_contribution.append($save_bar);
        var $grip = $('<span>', {class: 'grip'});
        $caption_bar.append($grip);
        $grip.text(UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS);
        var $caption_span = $('<span>', {class: 'caption-span'});
        $caption_bar.append($caption_span);
        var caption_txt = latest_txt(contribution_word.jbo, MONTY.IDN.CAPTION);
        if (caption_txt !== undefined) {
            $caption_span.append(caption_txt);
        }

        if (contribution_word.was_submitted_anonymous) {
            $sup_contribution.addClass('was-submitted-anonymous');
        }
        return $sup_contribution;
    }

    function render_bar(any_element_in_a_contribution) {
        var $sup_cont = $(any_element_in_a_contribution).closest('.sup-contribution');
        console.assert($sup_cont.length === 1, $sup_cont, any_element_in_a_contribution);
        var $cont = $sup_cont.find('.contribution');
        var cont_txt = $cont.text();
        var cont_idn = $cont.attr('id');
        if (can_i_embed_it(cont_txt)) {
            render_iframe($sup_cont, cont_txt, cont_idn);
        } else {
            render_text($sup_cont);
        }
    }

    function render_text($sup_cont) {
        $sup_cont.removeClass('render-media');
        $sup_cont.removeAttr('data-domain');
        var $render_bar = $sup_cont.find('.render-bar');
        $render_bar.empty();
    }

    function render_iframe($sup_cont, url, cont_idn) {
        $sup_cont.addClass('render-media');
        $sup_cont.attr('data-domain', sanitized_domain_from_url(url));
        var $render_bar = $sup_cont.find('.render-bar');
        var $iframe = $('<iframe>', {
            id: 'iframe_' + cont_idn,
            style: 'width: 300px;',   // This becomes the minimum render-bar width.
            src: iframe_src_from_url(url, cont_idn),
            allowfullscreen: 'allowfullscreen',
            allow: 'autoplay; fullscreen'
        });
        // NOTE:  Chrome's ooey gooey autoplay policy needs iframe delegation.
        //        https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
        //        Unclear if allow: autoplay is part or all of that.
        //        Emeffing lazy browser developers hammer legitimate media activity.
        //        So user may have to hit in-iframe play buttons an unknown number of times
        //        before the (Geedee user-initiated) player bot will begin to work.
        // NOTE:  Instagram popup won't do scrollbars, even if iframe overflow: auto
        //        On both outer (this $iframe here) and inner (instagram-installed).
        //        Is this a bad thing?  Even if it did scroll, virtually ANY other interaction
        //        results in an instagram tab popping up.
        $render_bar.html($iframe);
        resizer_init($iframe);
    }

    function could_be_url(text) {
        return starts_with(text, 'http://') || starts_with(text, 'https://');
    }

    function can_i_embed_it(text) {
        return could_be_url(text);
    }

    function can_i_get_meta_about_it(text) {
        return could_be_url(text);
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

    function order_report(order) {
        var cont_nonempty = order.cat.filter(function(cat) {
            return has(order.cont, cat) && order.cont[cat].length > 0
        });
        var cont_strings = cont_nonempty.map(function(cat) {
            var first_words = order.cont[cat].map(function (cont) {
                console.assert(is_laden(cont), cat, "`" + cont + "`", order.cont[cat]);
                return safe_string(first_word_from_cont(cont));
            });
            return MONTY.cat.txt[cat] + ":" + first_words.join(" ");
        });
        return cont_strings.join("\n");
    }

    function safe_string(string) {
        return JSON.stringify(string).replace(/^"/, '').replace(/"$/, '')
    }
    console.assert('string' === safe_string('string'));
    console.assert('back\\\\slash line\\nfeed' === safe_string('back\\slash line\nfeed'));
    console.assert('42' === safe_string(42));

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
        var $sup = $cont.closest('.sup-contribution');
        var $cap = $sup.find('.caption-span');
        var txt_cont = $cont.text().trim();
        var txt_cap = $cap.text().trim();
        if        ( ! is_laden(txt_cont) && ! is_laden(txt_cap)) {
            return "[blank]";
        } else if ( ! is_laden(txt_cont) &&   is_laden(txt_cap)) {
            return                          first_word(txt_cap);
        } else if (   is_laden(txt_cont) && ! is_laden(txt_cap)) {
            return  first_word(txt_cont);
        } else if (   is_laden(txt_cont) &&   is_laden(txt_cap)) {
            var first_cap = first_word(txt_cap);
            var first_cont = first_word(txt_cont);
            if (first_cont.length < first_cap.length) {
                return first_cont;
            } else {
                return first_cap;
            }
        }
    }

    function first_word(string) {
        return string.trim().split(' ')[0];
    }
    console.assert("foo" === first_word(" foo bar "));
    console.assert("" === first_word(""));

    /**
     * After major changes:
     *
     * 1. log the first words of each contribution, in each category.
     * 2. Refresh the how-many numbers in anti-valved fields (stuff that shows when closed).
     */
    function settle_down() {
        console.log(order_report(reconstitute_order_from_dom()));
        refresh_how_many();
    }

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
    }

    // noinspection JSUnusedLocalSymbols
    /**
     * Report some malfeasance or kerfuffle to the server.
     */
    // TODO:  In the timeless words of Captain Herbert Sobel:  Find some.
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

    /**
     * Handler to e.g. avoid document click immediately undoing long-press
     */
    function stop_propagation(evt) {
        evt.stopPropagation();
    }

    var long_press_timer = null;
    function long_press(selector, handler, enough_milliseconds) {
        enough_milliseconds = enough_milliseconds || 1000;
        $(window.document)
            .on('mousedown touchstart', selector, function (evt) {
                var element = this;
                if (evt.type === 'mousedown' && evt.which !== MOUSE_BUTTON_LEFT) {
                    return;
                    // NOTE:  Ignore long right or middle mouse button press.
                }
                if (long_press_timer !== null) {
                    // THANKS:  Avoid double timer when both events fire on Android,
                    //          https://stackoverflow.com/q/2625210/673991#comment52547525_27413909
                    //          Might also help if long_press() were called twice on the same
                    //          element, e.g. for overlapping classes.
                    return;
                }
                long_press_timer = setTimeout(function () {
                    long_press_timer = null;
                    handler.call(element, evt);
                }, enough_milliseconds);
            })
            .on('mouseup mouseout mouseleave touchend touchleave touchcancel', selector, function () {
                if (long_press_timer !== null) {
                    clearTimeout(long_press_timer);
                    long_press_timer = null;
                }
            })
            // TODO:  setInterval check?   https://stackoverflow.com/questions/7448468/
            //        why-cant-i-reliably-capture-a-mouseout-event
        ;
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

    function ignore_exception(nonessential_function_that_may_not_be_supported) {
        try {
            nonessential_function_that_may_not_be_supported();
        } catch (_) {
        }
    }

    /**
     * Fisher-Yates Shuffle, in-place.
     *
     * THANKS:  https://stackoverflow.com/a/2450976/673991
     * SEE:  https://bost.ocks.org/mike/shuffle/
     */
    function shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
    }
}

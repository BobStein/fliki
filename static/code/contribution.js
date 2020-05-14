// noinspection JSUnusedGlobalSymbols
/**
 * JavaScript for qiki contributions, an attempt at generalizing the features of unslumping.org
 *
 * Auxiliary input parameter extracted from the URL (window.location.search):
 *
 *     ?cont=IDN,IDN,...
 *
 * Limits the contributions displayed.
 * Each IDN is the inconvenient ROOT id_attribute,
 * not the handier id_attribute at the TIP of the edit chain.
 *
 * @param window
 * @param window.clipboardData
 * @param window.document
 * @param window.document.body
 * @param window.document.currentScript
 * @param window.document.exitFullscreen
 * @param window.document.fullScreen
 * @param window.document.mozCancelFullScreen
 * @param window.document.mozFullScreen
 * @param window.document.msExitFullscreen
 * @param window.document.webkitIsFullScreen
 * @param window.document.webkitExitFullscreen
 * @param window.innerHeight
 * @param window.innerWidth
 * @param window.localStorage
 * @param window.localStorage.getItem({string})
 * @param window.localStorage.setItem
 * @param window.location
 * @param window.location.href
 * @param window.MutationObserver
 * @param window.qiki
 * @param window.qiki.media_register
 * @param window.speechSynthesis
 * @param window.SpeechSynthesisUtterance
 * @param window.utter
 * @param $
 * @param qoolbar
 * @param MONTY
 * @param MONTY.AJAX_URL
 * @param MONTY.cat.order
 * @param MONTY.cat.txt
 * @param MONTY.cat.txt[] {string}
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
 * @param MONTY.INTERACTION.BOT
 * @param MONTY.INTERACTION.END
 * @param MONTY.INTERACTION.ERROR
 * @param MONTY.INTERACTION.PAUSE
 * @param MONTY.INTERACTION.RESUME
 * @param MONTY.INTERACTION.QUIT
 * @param MONTY.INTERACTION.START
 * @param MONTY.INTERACTION.UNBOT
 * @param MONTY.is_anonymous
 * @param MONTY.login_html
 * @param MONTY.me_idn
 * @param MONTY.me_txt
 * @param MONTY.MEDIA_HANDLERS
 * @param MONTY.OEMBED_CLIENT_PREFIX
 * @param MONTY.POPUP_ID_PREFIX
 * @param MONTY.STATIC_IMAGE
 * @param MONTY.THUMB_MAX_HEIGHT
 * @param MONTY.THUMB_MAX_WIDTH
 * @param MONTY.WHAT_IS_THIS_THING
 * @param MONTY.u
 * @param MONTY.u.is_admin
 * @param MONTY.u.name_short
 * @param MONTY.w
 * @param MONTY.w.id_attribute
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
 *
 * @property js_for_contribution.utter - so JS console has access to SpeechSynthesisUtterance object
 */
function js_for_contribution(window, $, qoolbar, MONTY, talkify) {

    var DO_LONG_PRESS_EDIT = false;
    // NOTE:  Long press seems like too easy a way to trigger an edit.
    //        Only do this for mobile users?
    //        Edit is just not that common a desired course of action.

    var DOES_DOCUMENT_CLICK_END_CLEAN_EDIT = false;
    // NOTE:  Clicking on the document background ends a non-dirty edit.
    //        Makes more sense with DO_LONG_PRESS_EDIT.  Less so without it.

    var DEBUG_SIZE_ADJUST = false;
    var DEBUG_BOT_STATES = true;

    var MS_IFRAME_RESIZER_INIT = 100;
    // NOTE:  Increase to 2000 milliseconds to avoid the following Chrome error:
    //            Failed to execute 'postMessage' on 'DOMWindow':
    //            The target origin provided ('<URL>')
    //            does not match the recipient window's origin ('<URL>').
    //        It seems to be a transient thing during initialization of an iframe,
    //        in a contribution or its popup.
    //        The number of messages varies wildly, e.g. 10-100 on init.  More after auto play.
    //        Chrome console may group these errors NON-CONSECUTIVELY, which is rather evil.
    //        For the non-consecutive grouping I blame Chrome.
    //        Anyway it's a false alarm.
    //        Worse, it's a misleading, alarmist false alarm.
    //        Red herring error messages are also evil.  A boy who cries wolf when lunch is late.
    //        For being errors instead of warnings, and so abundant, I blame iFrameResizer.
    //        So it comes off as a cross-site script thwarting, an attempted security breach.
    //        But it's more an overeager parent calling to a lethargic child.
    //        THANKS:  Unready iframe, https://stackoverflow.com/a/22379990/673991
    //        So the parent sends to the child before the child is ready to receive.
    //        The parent iFrameResizer must retry later and things turn out fine.
    //        And by the way it only happens when the iframe domain differs.
    //        The cost of this lame workaround increase to 2000 is slower load time.
    //        Firefox also has this false alarm, e.g.
    //            Failed to execute ‘postMessage’ on ‘DOMWindow’:
    //            The target origin provided (‘http://xxx’)
    //            does not match the recipient window’s origin (‘http://yyy’).

    var MS_IFRAME_RECOVERY_CHECK = 5000;
    // TODO:  3 seconds seemed to brief, lots of churn.

    var MEDIA_HANDLER_LOAD_SECONDS = 10.0;

    var EXPERIMENTAL_RED_WORD_READING = false;

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

    var GRIP_SYMBOL = UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS;

    var ANON_V_ANON_BLURB = (
        "You're here anonymously. " +
        "Log in to see the anonymous contributions from others."
    );

    var weep_url = MONTY.STATIC_IMAGE + '/' + 'weep_80.png';
    var laugh_url = MONTY.STATIC_IMAGE + '/' + 'laugh_80_left.png';

    // var INTRODUCTORY_BLURB = "or drag stuff here by its " + GRIP_SYMBOL;
    // var INTRODUCTORY_BLURB = "drag " + GRIP_SYMBOL + " here";
    // var INTRODUCTORY_BLURB = "This is the place for stuff that unslumps you.";
    // var INTRODUCTORY_BLURB = "The site for therapy grade wah's and lol's.";
    // var INTRODUCTORY_BLURB = "The site for therapeutic wah's and lol's.";
    // NOTE:  Thinking this category confusion will go away,
    //        that dragging from "their" to "my" is not the way.
    // noinspection HtmlRequiredAltAttribute,RequiredAttributes
    var INTRODUCTORY_BLURB = [
        "The site for therapeutic ",
        $('<img>', {src: weep_url, alt: "weeping"}),
        " and ",
        $('<img>', {src: laugh_url, alt: "laughing"})
    ];

    var MAX_CAPTION_LENGTH = 100;  // Because some oembed titles are huge

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
                               //                       id of this inner div is the id_attribute of the category
                               //                       Includes all div.sup-contribution elements,
                               //                       plus (for my_category) div.container-entry

    // Config options for size_adjust()
    var WIDTH_MAX_EM = {
        soft: 12,         // below the hard-max, display as is.
        hard: 15,         // between hard and extreme-max, limit to hard-max.
                          // (good reason to have a gap here: minimize wrapping)
        extreme: 15       // above extreme-max, display at soft-max.
    };
    var HEIGHT_MAX_EM = {
        soft: 5,          // below the hard-max, display as is.
        hard: 6,          // between hard and extreme-max, limit to hard-max.
                          // (no good reason to have a gap here: it's just
                          // annoying to show a tiny bit scrolled out of view)
        extreme: 8        // above extreme-max, display at soft-max.
    };
    // var POPUP_WIDTH_MAX_EM = {
    //     soft: 30,         // below the hard-max, display as is.
    //     hard: 60,         // between hard and extreme-max, limit to hard-max.
    //                       // (a reason to have a soft-hard gap horizontally: minimize wrapping)
    //     extreme: 65       // above extreme-max, display at soft-max.
    // };
    // var POPUP_HEIGHT_MAX_EM = {
    //     soft: 20,         // below the hard-max, display as is.
    //     hard: 30,         // between hard and extreme-max, limit to hard-max.
    //                       // (no big reason to have a gap between soft and hard vertically:
    //                       // it's just annoying to show a tiny bit scrolled out of view)
    //     extreme: 40       // above extreme-max, display at soft-max.
    // };

    var MIN_CAPTION_WIDTH = 100;
    // NOTE:  Prevent zero-width iframe or other crazy situation from scrunching caption too narrow.

    var is_editing_some_contribution = false;
    // TODO:  $(window.document.body).hasClass('edit-somewhere')
    var $cont_editing = null;
    // TODO:  $('.contribution-edit').find('.contribution')

    var cont_only = cont_list_from_query_string();

    // var progress_play_bot = null;   // setTimeout timer for the current contribution in play
    var list_play_bot;   // array of contribution id's
    var index_play_bot;
    // TODO:  These should be properties of Bot instance, right??

    var SETTING_PLAY_BOT_SEQUENCE = 'setting.play_bot.sequence';
    var PLAY_BOT_SEQUENCE_ORDER = 'in_order';
    var PLAY_BOT_SEQUENCE_RANDOM = 'random';

    var PLAYLIST_TABLE = {};
    PLAYLIST_TABLE[PLAY_BOT_SEQUENCE_ORDER] = {generate: playlist_in_order};
    PLAYLIST_TABLE[PLAY_BOT_SEQUENCE_RANDOM] = {generate: playlist_random};

    var SETTING_PLAY_BOT_FROM = 'setting.play_bot.from';
    var SETTING_PLAY_BOT_SPEECH = 'setting.play_bot.speech';
    var PLAY_BOT_FROM_MY = 'CAT_MY';          // \ human-understandable values for #play_bot_from
    var PLAY_BOT_FROM_OTHERS = 'CAT_THEIR';   // / options, machine use ala MONTY.IDN['CAT_THEIR']

    var PLAY_BOT_SPEECH_OUT_LOUD = 'out loud';
    var PLAY_BOT_SPEECH_ANIMATED = 'animated';
    var PLAY_BOT_SPEECH_OFF = 'off';

    var MEDIA_STATIC_SECONDS = 10;   // How long to display media we don't know how to automate.

    var talkify_player = null;
    var talkify_playlist = null;
    var talkify_done = null;
    var talkify_voice_name;
    // var $animation_in_progress = null;    // jQuery object for elements currently animating.

    var BOT_CONTEXT = 'bot_context';  // PubSub message context

    var TALKIFY_VOICES_ENGLISH = [
        'Hazel',
        'David',
        'Zira'    // this may be the default
    ];

    // noinspection JSUndefinedPropertyAssignment
    var utter = null;
    var speech_progress = null;   // Character index (null means ended)

    var voices = null;
    var voice_weights;
    var voice_default = {name:"(unknown)", lang: ""};
    var SECONDS_BREATHER_AT_MEDIA_END          = 2.0;
    var SECONDS_BREATHER_AT_SPEECH_SYNTHESIS_END = 4.0;   // using window.speechSynthesis
    // var SECONDS_BREATHER_AT_TALKIFY_END          = 4.0;
    // var SECONDS_BREATHER_AT_OTHER_MEDIA_END      = 0.0;   // it was ALREADY a delay showing it
    var SECONDS_BREATHER_AFTER_ZERO_TIME         = 0.0;
    var SECONDS_BREATHER_AT_NOEMBED_ERROR        = 0.0;
    var SECONDS_BREATHER_AT_SKIP                 = 0.0;
    var breather_timer = null;
    // var work_in_a_pause = false;

    var bot = null;

    var txt_from_idn = {};
    looper(MONTY.IDN, function(name, idn) {
        txt_from_idn[idn] = name;
    });

    // A media handler is a JavaScript file that calls window.qiki.media_register()
    var media_handlers = [];   // array of handlers:  {url: '...', media: {...}, ...}
    var isFullScreen;

    var TOP_SPACER_REM = 1.5;
    var TOP_SPACER_PX = px_from_em(TOP_SPACER_REM);
    // NOTE:  Presumed to be the practical height of #up-top which is position:fixed,
    //        this is the amount the position:static elements are scooted down.
    // SEE:  contribution.css where TOP_SPACER_PX is mentioned.
    // TODO:  Refactor those occurrences in contribution.css to applying those properties
    //        here in contribution.js, e.g.
    //        $('#up-top').css('height', TOP_SPACER_EM.toString() + 'em');

    var POP_UP_ANIMATE_MS = 500;
    var POP_UP_ANIMATE_EASING = 'linear';   // swing or linear
    var POP_DOWN_ANIMATE_MS = 250;
    var POP_DOWN_ANIMATE_EASING = 'swing';   // swing or linear


    /////////////////////////////////////////////////////////////////////////////////////////
    ////// Rogues Gallery - a compendium errors and warnings on the JavaScript console.
    /////////////////////////////////////////////////////////////////////////////////////////

    // runtime.lastError
    // -----------------
    // Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
    // https://www.youtube.com/embed/VmvFb-cIjnc?feature=oembed
    // YouTube shenanigans?  Perhaps thwarted by the dual-domain scheme for oembed iframes.
    // (Accumulate after init, and during auto-play.)

    // cross-site cookie without SameSite
    // ----------------------------------
    // A cookie associated with a cross-site resource at <various> was set without the `SameSite`
    // attribute. A future release of Chrome will only deliver cookies with cross-site requests
    // if they are set with `SameSite=None` and `Secure`. You can review cookies in developer
    // tools under Application>Storage>Cookies and see more details at
    // https://www.chromestatus.com/feature/5088147346030592 and
    // https://www.chromestatus.com/feature/5633521622188032.
    // <various> is: fontawesome, youtube, instagram, flickr, etc.

    // SameSite=None cookie without Secure
    // -----------------------------------
    // A cookie associated with a resource at http://www.google.com/ was set with `SameSite=None`
    // but without `Secure`. A future release of Chrome will only deliver cookies marked
    // `SameSite=None` if they are also marked `Secure`. You can review cookies in developer
    // tools under Application>Storage>Cookies and see more details at
    // https://www.chromestatus.com/feature/5633521622188032.

    // No tagged elements
    // ------------------
    // No tagged elements (data-iframe-width) found on page
    // iframeResizer.contentWindow.js:176

    // Allow attribute will take precedence over 'allowfullscreen'.

    // IFrame has not responded within 5 seconds. Check iFrameResizer.contentWindow.js has been
    // loaded in iFrame. This message can be ignored if everything is working, or you can set
    // the warningTimeout option to a higher value or zero to suppress this warning.
    // iframeResizer.js:134
    // (On unslumping.org but not localhost?)

    // Failed to execute 'postMessage' on 'DOMWindow': The target origin provided
    // ('https://fun.unslumping.org') does not match the recipient window's origin
    // ('https://unslumping.org').
    // iframeResizer.js:754

    // The AudioContext was not allowed to start. It must be resumed (or created) after a user
    // gesture on the page. https://goo.gl/7K7WLu
    // widget-8b6beef-7505829a.js:18

    // [Violation] Added synchronous DOM mutation listener to a 'DOMNodeInserted' event. ...
    // [Violation] Added non-passive event listener to a scroll-blocking 'touchstart' event. ...
    // [Violation] Forced reflow while executing JavaScript took 53ms
    // [Violation] 'setTimeout' handler took 55ms
    // [Violation] Avoid using document.write(). ...

    // Uncaught TypeError: Cannot read property 'parentNode' of undefined
    // video-toolbar.js
    // (UC Browser 7)


    $(function document_ready() {
        if (window.speechSynthesis !== null) {
            window.speechSynthesis.onvoiceschanged = function () {
                // THANKS:  voices ready, https://stackoverflow.com/a/22978802/673991
                voices = window.speechSynthesis.getVoices();
                console.log("Voices loaded", voices);
                voice_weights = Array(voices.length);
                for (var i = 0; i < voices.length; i++) {
                    if (/^en-GB/.test(voices[i].lang)) {
                        voice_weights[i] = 10.0;
                    } else if (/^en/.test(voices[i].lang)) {
                        voice_weights[i] = 5.0;
                    } else {
                        voice_weights[i] = 0.0;
                    }
                    if (voices[i].default) {
                        voice_default = voices[i];
                    }
                }
            };
        }
        qoolbar.ajax_url(MONTY.AJAX_URL);

        build_dom();

        $( '#close-button').on('click', function () { pop_down_all(false); });
        $(  '#play-button').on('click', function () { bot.play(); });
        $( '#pause-button').on('click', function () { bot.pause(); });
        $('#resume-button').on('click', function () { bot.resume(); });
        $(  '#stop-button').on('click', function () { bot.stop(); });
        $(  '#skip-button').on('click', function () { bot.skip(); });
        // NOTE:  You might expect INTERACTION words to all be generated near here, where most
        //        user interaction originates.  But then how to record the controls inside a youtube
        //        video?  Those actions can be detected by events in the youtube API, but those
        //        events also include these actions.
        //        So the words are generated in diverse places with fiddly conditions.
        //        This is a tiny part of the most complex project:  machines understanding people.

        $('#play_bot_speech').on('change', play_bot_speech_change);
        play_bot_speech_change();

        $('#enter_some_text, #enter_a_caption')
            .on('paste change input keyup', post_it_button_appearance)
            .on(      'change input',       maybe_cancel_feedback)
            .on('paste',                    text_or_caption_paste)
            .on('drop',                     text_or_caption_drop)
        ;
        $('#post_it_button').on('click', post_it_click);


        $('.category, .frou-category').sortable(sortable_module_options());

        $(window.document)
            .on('input', '.contribution, .caption-span', contribution_dirty)
            .on('click', '.contribution', stop_propagation)
            .on('click', '.caption-bar, .save-bar', stop_propagation)
            .on('click', '.render-bar .thumb-link', thumb_click)
            .on('click', '.save-bar .edit',    contribution_edit)
            .on('click', '.save-bar .cancel',  contribution_cancel)
            .on('click', '.save-bar .discard', contribution_cancel)
            .on('click', '.save-bar .save',    contribution_save)
            .on('click', '.save-bar .play',    function () { bigger(this, true); })
            .on('click', '.save-bar .expand',  function () { bigger(this, false); })
            // TODO:  Should play or expand end non-dirty edits?  That could be more consistent:
            //        Closing the popup with Escape does this already.
            //        Closing with the close button, or clicking on the pop-screen does not.

            .on('keyup', function (evt) {
                if (evt.key === 'Escape') {
                    // THANKS:  Escape event, https://stackoverflow.com/a/3369624/673991
                    // THANKS:  Escape event, https://stackoverflow.com/a/46064532/673991
                    // SEE:  evt.key values, https://developer.mozilla.org/search?q=key+values
                    bot.stop();
                    check_contribution_edit_dirty(false, true);
                    // TODO:  Return false if handled?  So Escape doesn't do other things?
                }
            })
            .on('blur keyup paste input', '[contenteditable=true]', function () {
                work_around_jumpy_contenteditable_chrome_bug(this);
            })
            .on('click', '#popup-screen', function popup_screen_click() {
                if (bot.state === bot.State.MANUAL) {
                    pop_down_all(false);
                }
                // NOTE:  If the bot is running, clicking on the translucent popup background does nothing.
                //        Because that would make it too easy to inadvertently terminate the bot.
                //        If you really want to stop or skip (which is it?) click that button.
                //        If you manually popped up a contribution,
                //        then clicking on the #popup-screen closes the popup.
                //        This follows tons of convention,
                //        e.g. tapping on the margin of a popped-up facebook image.
            })
        ;

        persist_select_element('#play_bot_sequence', SETTING_PLAY_BOT_SEQUENCE);

        play_bot_default_others_if_empty_my_category();
        persist_select_element('#play_bot_from', SETTING_PLAY_BOT_FROM);

        persist_select_element('#play_bot_speech', SETTING_PLAY_BOT_SPEECH);

        // TODO:  Store these settings in lex
        //        user -> option -> preference -> noun

        $(window.document).on('click', function () {
            var dont_scroll_dirty_entry_into_view_on_document_click = false;
            check_page_dirty(
                dont_scroll_dirty_entry_into_view_on_document_click,
                DOES_DOCUMENT_CLICK_END_CLEAN_EDIT
            );
        });
        if (DO_LONG_PRESS_EDIT) {
            long_press('.sup-contribution', contribution_edit);
        }

        // TODO:  Prevent mousedown inside .contribution, and mouseup outside, from
        //        triggering a document click in Chrome.  (But not in Firefox.)
        //        Makes it hard to select text in a contentEditable .contribution,
        //        when the swiping happens to stray outside the div.contribution.

        $(window).on('beforeunload', function hesitate_to_unload_if_dirty_edit() {
            var do_scroll_dirty_entry_into_view_on_page_unload = true;
            var do_hinder_page_unload = check_page_dirty(
                do_scroll_dirty_entry_into_view_on_page_unload,
                true
            );
            return do_hinder_page_unload ? "Discard?" : undefined;
        });
        // NOTE:  This helps prevent a user from losing work by inadvertently closing the page
        //        while in the middle of an entry or edit.
        // TODO:  Radical idea:  save this in localStorage, and resurrect it later, instead?
        //        Downside is it thwarts attempt to "clear" the page by reloading it.
        //        Ugh might require "Resurrect abandoned work?" question on next load.  No!
        //        If we do this, maybe there should be a "clear" button next to "post it".
        //        In any case, the page should reload with red controls, scrolled into view. 
        //        Whew that's a lot of work.
        //        As well as creepy resurrection of possibly ancient work on some far future load.
        //        Possibly for a different user on the same computer, that could be bad bad bad.

        entry_caption_same_width_as_textarea();
        post_it_button_appearance();
        initialize_contribution_sizes();
        settle_down();

        bot = Bot();
        // NOTE:  Must happen after Bot.prototype.ticker_interval_ms has been set.
        //        I.e. it must be immune to the issue that function declarations are hoisted
        //        but function expressions are not.  So the constructor is hoisted
        //        but the methods are not.
        //        So bot is constructed in jQuery ready handler,
        //        which must be after whole .js file has executed.
        //        But it's also constructed before full-screen event handler installed.

        $(window.document).on(
            'webkitfullscreenchange ' +
               'mozfullscreenchange ' +
                  'fullscreenchange',
            function full_screen_change() {
                // noinspection JSUnresolvedVariable
                isFullScreen = window.document.fullScreen ||
                               window.document.mozFullScreen ||
                               window.document.webkitIsFullScreen;
                var is_entering = isFullScreen;
                var is_exiting = ! isFullScreen;
                var which_way = is_entering ? "ENTER" : "EXIT";
                console.log(
                    which_way,
                    "full screen",
                    window.innerWidth.toString() + "x" + window.innerHeight.toString()
                );
                if (is_exiting) {
                    bot.on_exit_full_screen();
                }
            }
        );

        // NOTE:  On my desktop Chrome the following errors went away by disabling
        //        Youtube Playback Speed Control 0.0.5
        //            Unchecked runtime.lastError: Could not establish connection?
        //            Receiving end does not exist?
        // SEE:  https://stackoverflow.com/q/54619817/673991#comment101370041_54765752

        if (cont_only === null) {
            setTimeout(function () {
                resizer_nudge_all();
                // NOTE:  Cheap-ass workaround for the zero-iframe-size bug.
                // https://github.com/davidjbradshaw/iframe-resizer/issues/629#issuecomment-525498353
                // But (even cheaper-ass) only do the workaround if no ?cont=NNN
                // -- that is, we're not limiting the contributions, showing all of them,
                // so as to preserve the failure mode in the above issue report.
                // FIXME:  Instead, append query-string ?...&disable_zero_size_iframe_workaround
                //         Or wait until it's fixed.  And then remove this workaround.

                // An even cheaper cheap-ass workaround:
                // setTimeout(function () {
                //     resizer_nudge_all();
                // }, 10000);

            }, 3000);
            // NOTE:  If this delay is not enough, I don't think anything too bad happens.
            //        You might see briefly a wafer-thin iframe before it gives its children
            //        the data-iframe-width attribute that taggedElement needs.
            //        That has to happen after a delay due to provider tricks with the
            //        embedded html (see noembed_render()).
        }

    });

    function play_bot_default_others_if_empty_my_category() {
        var num_my_contributions = num_contributions_in_category(MONTY.IDN.CAT_MY);
        var $play_bot_from = $('#play_bot_from');
        var is_play_bot_from_my = $play_bot_from.val() === PLAY_BOT_FROM_MY;
        if (num_my_contributions === 0 && is_play_bot_from_my) {
            $play_bot_from.val(PLAY_BOT_FROM_OTHERS);
            console.log("My category is empty, defaulting play-bot to the other category.");
        }
    }

    function num_contributions_in_category(category_idn) {
        var $category = $categories[category_idn];
        var num_contributions = $category.find('.contribution').length;
        return num_contributions;
    }

    function persist_select_element(selector, storage_name) {
        $(selector).on('change', function () {
            window.localStorage.setItem(storage_name, $(selector).val());
        });
        var setting = window.localStorage.getItem(storage_name);
        if (is_specified(setting)) {
            $(selector).val(setting);
            console.log("Recalling", storage_name, setting);
        }
    }

    function playlist_random() {
        var playlist = playlist_in_order();
        shuffle(playlist);
        return playlist;
    }

    function cat_idn_for_playlist() {
        var play_bot_from_symbol = $('#play_bot_from').val();   // e.g. 'CAT_MY'
        var play_bot_from_idn = MONTY.IDN[play_bot_from_symbol];   // e.g. 1435
        return play_bot_from_idn;
    }

    function playlist_in_order() {
        var play_bot_from_idn = cat_idn_for_playlist();
        var $cat = $categories[play_bot_from_idn];
        return $cat.find('.contribution[id]').map(function () {
            return this.id;
        }).get();
    }

    function playlist_generate() {
        var playlist_selection = $('#play_bot_sequence').val();
        console.assert(
            has(PLAYLIST_TABLE, playlist_selection),
            playlist_selection, "not in", PLAYLIST_TABLE
        );
        return PLAYLIST_TABLE[playlist_selection].generate();
    }



    function Bot() {
        if ( ! (this instanceof Bot)) {
            return new Bot();
        }
        // THANKS:  Automatic 'new', https://stackoverflow.com/a/383503/673991

        var that = this;
        // THANKS:  that = this, https://alistapart.com/article/getoutbindingsituations/#snippet26
        //          `that` is set in all methods, so anonymous callbacks don't shadow `this`.

        that.state = that.State.MANUAL;
        that.last_tick_state = null;
        that.ticks_this_state = 0;    // N means state is [N to N+1) seconds old, if no pauses.
        that._interval_timer = null;
        that.ticker_interval_ms(1000);
        that.breather_seconds = null;
        that.cont = null;       // e.g. id_attribute '1821' a thumbnail
        that.pop_cont = null;   // e.g. id_attribute 'popup_1821' an almost full screen pop-up
        that.is_paused = false;
        that.cont_idn = null;
        that.did_bot_transition = null;  // Did the bot initiate transition to the next contribution?
    }

    Bot.prototype.State = Enumerate({
        MANUAL: "Normal, manual site operation",
        START_AUTO: "Play starts",
        PREP_CONTRIBUTION: "Prepare for next contribution",
        UNFULL_CONTRIBUTION: "Exiting full screen before the next contribution",
        NEXT_CONTRIBUTION: "Next contribution in playlist",
        MEDIA_READY: "The iframe is showing stuff",                            // dynamic or static
        MEDIA_STARTED: "The iframe is doing stuff, we'll know when it ends",   // dynamic media
        MEDIA_TIMING: "The iframe is static",                                  // static media
        MEDIA_PAUSE_IN_FORCE: "Both main page and iframe agree we're paused",  // (no need to pause_media() again - dynamic media only)
        SPEECH_SHOULD_PLAY: "The text was told to speak",
        SPEECH_STARTED: "The speaking has started",
        DONE_CONTRIBUTION: "Natural ending of a contribution in playlist",
        BREATHER: "Take a breather between popups.",
        BEGIN_ANOTHER: "Begin the next contribution.",
        PLAYING_CONTRIBUTION: "Quiescently automatically playing",
        END_AUTO: "Play ends",
        CRASHED: "Something went wrong"
    });

    Bot.prototype.play = function Bot_play() {
        var that = this;
        console.assert(that.state === that.State.MANUAL, that.state);
        that.state = that.State.START_AUTO;
    };

    /**
     * Transition to a new state.
     *
     * @param old_states - [0] state we're expecting to be in already
     *                     [1],[2],... (optional) alternate states we might be in,
     *                                 not a crash, but less expected.
     *                                 This situation should be explained in the call.
     * @param new_state
     * @return {boolean} true=transitioned as expected, false=was already there, or something wrong.
     */
    // TODO:  Which looks better?
    //        that.transit([that.State.OLD_STATE], that.State.NEW_STATE);
    //        that.transit(['OLD_STATE'], 'NEW_STATE');
    Bot.prototype.transit = function Bot_transit(old_states, new_state) {
        var that = this;
        console.assert(Array.isArray(old_states), old_states);
        // console.assert(new_state is an that.State);
        if (has(old_states, that.state)) {
            that.state = new_state;
            return true;
        } else if (new_state === that.state) {
            console.warn("Transit, but already in state", that.state.name);
            return false;
        } else {
            that.crash(
                "TRANSIT CRASH expecting", old_states.map(function get_state_name(s) {
                    return s.name;
                }).join(","),
                "  not", that.state.name,
                "  before", new_state.name
            );
            return false;
        }
    };

    Bot.prototype.ticker = function Bot_ticker() {
        var that = this;
        if (that.is_paused) {
            that.finite_state_machine_paused();
            return;
        }
        var did_state_change_since_last_ticker_call = that.state !== that.last_tick_state;
        if (did_state_change_since_last_ticker_call) {
            that.ticks_this_state = 0;
        } else {
            that.ticks_this_state++;
        }
        do { // TODO:  Loop instead with setInterval and clearInterval?
            var LESS_INTERESTING_STATES = [
                that.State.MANUAL,
                that.State.PLAYING_CONTRIBUTION
            ];
            if ( ! has(LESS_INTERESTING_STATES, that.state)) {
                if (DEBUG_BOT_STATES) console.debug("Bot", that.state.name, that.ticks_this_state, that.state.description);
            }
            that.last_tick_state = that.state;
            that.finite_state_machine();
            var did_fsm_change_state = this.state !== this.last_tick_state
        } while (did_fsm_change_state);
    };

    Bot.prototype.on_exit_full_screen = function Bot_on_exit_full_screen() {
        var that = this;
        if (that.state === that.State.UNFULL_CONTRIBUTION) {
            console.log("Moving on after exiting full screen.");
            that.state = that.State.NEXT_CONTRIBUTION;
            // TODO:  Hasten to finite_state_machine() for this step?
            //        Instead of waiting (for 0-1 seconds)?
        }
    };

    /**
     * Bot plays on.  Perform the extended consequences of the global play button.
     *
     * Called
     *     - once per tick (every second)
     *     - after each state change, in case it is ready to change again
     *
     * But this is NOT called during pause.  See
     */
    Bot.prototype.finite_state_machine = function Bot_finite_state_machine() {
        var that = this;

        switch (that.state) {
        case that.State.MANUAL:
            break;
        case that.State.START_AUTO:
            list_play_bot = playlist_generate();
            console.log("playlist", list_play_bot.join(","));
            index_play_bot = 0;
            that.media_beginning();
            that.state = that.State.PREP_CONTRIBUTION;
            interact.BOT(cat_idn_for_playlist(), 1, list_play_bot.join(","));
            // NOTE:  When there is a feature for the Bot to play from a more diverse set than
            //        merely categories MY and THEIR, then the obj should be a word representing
            //        that set.
            break;
        case that.State.PREP_CONTRIBUTION:
            if (isFullScreen) {
                console.log("Full screen.  Ending that first, before next contribution.");
                // NOTE:  Otherwise, the next eager-beaver pop_up() used to get full-screen values
                //        for window width and height, passing them on to the iframe
                //        embed_content.js.
                //        This fixes the bug where YouTube controls were out of reach, because the
                //        next popup iframe was sized for full-screen, not for the restored browser
                //        window in effect by the time it actually animated its pop up.
                //        Then, it was the removing of the iframe from the DOM that implicitly
                //        exited full screen.  Now, we do that explicitly.
                // TODO:  Preserve full-screen and bring it back for the next pop-up.
                //        (This code is more than a dirty sweeping the bug under the carpet.  Yes,
                //        it is that, but it also has much of the code needed to do it the right
                //        way.  I.e. now we SHOULD be arranging for pop_up() call below to somehow
                //        make a full-screen iframe.)
                exit_full_screen();
                that.state = that.State.UNFULL_CONTRIBUTION;
            } else {
                that.state = that.State.NEXT_CONTRIBUTION;
            }
            break;
        case that.State.UNFULL_CONTRIBUTION:
            if (that.ticks_this_state >= 5) {
                console.warn("Unable to exit full screen, moving on anyway.");
                that.state = that.State.NEXT_CONTRIBUTION;
            }
            break;
        case that.State.NEXT_CONTRIBUTION:
            if (index_play_bot >= list_play_bot.length) {
                that.state = that.State.END_AUTO;
                // NOTE:  Natural automatic Bot ending - at the end of all contributions.
                //        May never happen!
                break;
            }
            that.cont_idn = list_play_bot[index_play_bot];
            that.cont = Contribution(that.cont_idn);
            if ( ! that.cont.exists()) {
                that.crash("Missing contribution", that.cont_idn, index_play_bot);
                break;
            }
            // FALSE WARNING:  The following dumb noinspection prevents the following warning:
            //            Condition is always false since types
            //            '{get: (function(): jQuery | null)} | {get: function(): *}'
            //            and 'string' have no overlap
            // noinspection JSIncompatibleTypesComparison
            if (that.cont.media_domain === 'no_domain') {
                // NOTE:  A badly formatted URL should not be popped up at all.
                console.log("Zero time for", that.cont.id_attribute);
                that.end_one_begin_another(SECONDS_BREATHER_AFTER_ZERO_TIME, true);
            } else if (that.cont.is_noembed_error) {
                console.log("Noembed is no help with", that.cont.id_attribute);
                that.end_one_begin_another(SECONDS_BREATHER_AT_NOEMBED_ERROR, true);
            } else {
                $(window.document.body).addClass('pop-up-auto');
                that.pop_begin(pop_up(that.cont, true));
                that.state = that.State.PLAYING_CONTRIBUTION;
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_INIT, function () {
                    that.transit([that.State.PLAYING_CONTRIBUTION], that.State.MEDIA_READY);
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_BEGUN, function () {
                    that.transit([that.State.MEDIA_READY], that.State.MEDIA_STARTED);
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_STATIC, function (_, data) {
                    if (that.transit([that.State.MEDIA_READY], that.State.MEDIA_TIMING)) {
                        // NOTE:  This if-check prevents the double START interaction of 13-Apr-20.
                        //        Because Contribution.zero_iframe_recover() reloaded the iframe.
                        interact.START(data.cont_idn, data.current_time);
                    }
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_ENDED, function () {
                    that.transit(
                        [
                            that.State.MEDIA_STARTED,
                            that.State.MEDIA_PAUSE_IN_FORCE   // paused, then immediately ended
                        ],
                        that.State.DONE_CONTRIBUTION
                    );
                    that.pop_end();
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_PLAYING, function (_, data) {
                    // NOTE:  From Contribution's embedded DYNAMIC iframe to the Bot.
                    // NOTE:  Don't think it's possible to get a double START on dynamic media
                    //        the way it was with static media.
                    //        We got here from an auto-play-playing message from the embed
                    //        and that could not hardly have come from a zero-size iframe.
                    console.log("Media playing", data.cont_idn);
                    if (that.is_paused) {
                        interact.RESUME(data.cont_idn, data.current_time);
                        that._pause_ends();
                    } else {
                        interact.START(data.cont_idn, data.current_time);
                    }
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_PAUSED, function () {
                    // TODO:  This is where we disentangle a pause initiated by the outer website,
                    //        from one initiated by the embedded youtube iframe.
                    //        Move this disentanglement to media_youtube.js or something.
                    if (that.is_paused) {
                        // NOTE:  Expected - main-page pause fed back by iframe
                        //        main page --> iframe
                    } else {
                        // NOTE:  Surprise - the embedded pause button was hit.
                        //        main page <-- iframe
                        that._pause_begins();
                    }
                    if (that.state === that.State.MEDIA_STARTED) {
                        that.transit([that.State.MEDIA_STARTED], that.State.MEDIA_PAUSE_IN_FORCE);
                        // NOTE:  This transition stops the barrage of pause_media().
                        //        Static TIMING state won't come here.
                    }
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_RESUME, function () {
                    // NOTE:  This event only happens when resuming paused STATIC media.
                    if (that.is_paused) {
                        // NOTE:  Surprise - the embedded resume button was hit.
                        //        main page <-- iframe
                        // TODO:  This isn't possible any more, only static media gets here.
                        that._pause_ends();
                    } else {
                        console.warn("Resume redundant?");
                        // NOTE:  Expected - main-page resume fed back by iframe, or
                        //        Expected - play started from the beginning
                        //        main page --> iframe
                    }
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.SPEECH_PLAY, function () {
                    that.transit([that.State.PLAYING_CONTRIBUTION], that.State.SPEECH_SHOULD_PLAY);
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.SPEECH_START, function () {
                    that.transit([that.State.SPEECH_SHOULD_PLAY], that.State.SPEECH_STARTED);
                });
                that.pop_cont.$sup.on(that.pop_cont.Event.SPEECH_END, function () {
                    that.transit([
                    that.State.SPEECH_STARTED,
                    that.State.SPEECH_SHOULD_PLAY   // ended early, or never started
                ], that.State.DONE_CONTRIBUTION);
                    that.pop_end();
                });
            }
            break;
        case that.State.PLAYING_CONTRIBUTION:
            break;
        case that.State.MEDIA_READY:
            // NOTE:  Awaiting MEDIA_BEGUN event (for dynamic media) leads to MEDIA_STARTED state
            //             or MEDIA_STATIC event (for static media) leads to MEDIA_TIMING state
            break;
        case that.State.MEDIA_TIMING:
            // Static media, e.g. jpg on flickr, show it for a while.
            if (that.ticks_this_state >= MEDIA_STATIC_SECONDS) {
                that.did_bot_transition = true;
                that.state = that.State.BEGIN_ANOTHER;
            }
            break;
        case that.State.MEDIA_STARTED:
            break;
        case that.State.MEDIA_PAUSE_IN_FORCE:
            break;
        case that.State.SPEECH_SHOULD_PLAY:
            // NOTE:  Wait at least 1 second to retry.
            //        Actual delays from speak-method to start-event in ms:
            //            27, 131, 11 - Chrome
            //            30 - Opera
            //            231, 170 - Firefox
            if (that.ticks_this_state === 1) {   // Warn once, not again for 2, 3, 4...
                var n_characters;
                try {
                    n_characters = utter.text.length.toString() + " characters";
                } catch (e) {
                    n_characters = "((" + e.message + "))";
                }
                var message = (
                    "Speech " + n_characters +
                    " failed to start " + that.ticks_this_state.toString()
                );
                notable_occurrence(message);
                window.speechSynthesis.cancel();   // Another attempt to fix text-not-speaking bug.
                window.speechSynthesis.speak(utter);   // Attempt to fix text-not-speaking bug.
                // NOTE:  This is a workaround for the text-not-speaking bug.
            }
            break;
        case that.State.SPEECH_STARTED:
            break;
        case that.State.DONE_CONTRIBUTION:
            that.did_bot_transition = true;
            if (that.cont.is_media) {
                that.end_one_begin_another(SECONDS_BREATHER_AT_MEDIA_END, true);
            } else {
                that.end_one_begin_another(SECONDS_BREATHER_AT_SPEECH_SYNTHESIS_END, true);
            }
            break;
        case that.State.BREATHER:
            if (that.ticks_this_state < that.breather_seconds) {
                // time at the end of media or text
            } else {
                that.state = that.State.BEGIN_ANOTHER;
            }
            break;
        case that.State.BEGIN_ANOTHER:
            that.pop_end();
            pop_down_all(that.did_bot_transition);
            index_play_bot++;
            that.state = that.State.PREP_CONTRIBUTION;
            break;
        case that.State.CRASHED:
            // NOTE:  Leaving things messy, for study.  May regret this.
            that.state = that.State.MANUAL;
            // NOTE: Abrupt catastrophic Bot ending.  Something went wrong.
            break;
        case that.State.END_AUTO:
            that.media_ending();
            console.log("End player bot");
            interact.UNBOT(that.cont_idn, 1);
            that.state = that.State.MANUAL;
            break;
        default:
            that.crash("Unknown state", that.state);
            break;
        }
    };

    /**
     * Instead of finite_state_machine(), this gets called while paused, once per tick (second).
     */
    Bot.prototype.finite_state_machine_paused = function Bot_finite_state_machine_paused() {
        var that = this;

        // NOTE:  This crude peppering of the media or speech with pause directives
        //        once a second during the ENTIRE time they should be paused, catches
        //        edge cases when the pause button was clicked in the early stages of
        //        media or speech, when it LOOKED as if things could be paused but they
        //        really weren't ready to be paused yet.  And then auto-play kicked in.
        // TODO:  A better way might be for the Bot to intercept Contribution Event.MEDIA_WOKE
        //        events.  And to trigger a similar Contribution Event.SPEECH_WOKE event on
        //        the first speech word boundary, so the Bot can intercept that too.
        //        Also the thing that does .speak(utter) should first check whether a
        //        pause is in effect.
        //        Maybe the SPEECH_PLAY event is already enough, but it's possible SPEECH_WOKE
        //        should be the secondary check for pause, just in case.
        // TODO:  Rewrite the above.  It's at least a little obsolete.
        // TODO:  Write more or fewer TODO comments.  Somewhere or other.

        switch (that.state) {
        case that.State.MEDIA_STARTED:
            that.pause_media();
            // TODO:  This might come too early.  Do only after Event.MEDIA_WOKE?
            break;
        case that.State.SPEECH_SHOULD_PLAY:
            that.pause_speech();
            break;
        }
    };

    /**
     * Begin working with a popped-up Contribution object, store it in that.pop_cont
     *
     * @param pop_cont
     */
    Bot.prototype.pop_begin = function Bot_pop_begin(pop_cont) {
        var that = this;
        that.pop_end();
        that.pop_cont = pop_cont;
    };

    /**
     * Done working with the popped-up Contribution object, if any.
     */
    Bot.prototype.pop_end = function Bot_pop_end() {
        var that = this;
        if (that.pop_cont !== null) {
            that.pop_cont.$sup.off();
            that.pop_cont = null;
        }
    };

    Bot.prototype.ticker_interval_ms = function Bot_ticker_interval_ms(milliseconds) {
        var that = this;
        that._interval_timer = setInterval(function () {
            that.ticker();
        }, milliseconds);
    };

    /**
     * Transition to next contribution.
     *
     * The timeout is NOT expected to be running.
     * So either it has naturally expired, or it's been aborted already.
     *
     * @param seconds_delay between contributions
     * @param did_bot_transition - true=bot initiated next contribution, false=user did
     */
    Bot.prototype.end_one_begin_another = function Bot_end_one_begin_another(
        seconds_delay,
        did_bot_transition
    ) {
        var that = this;
        that.did_bot_transition = did_bot_transition;
        console.log("(bot breather {})".replace('{}', seconds_delay.toFixed(1)));
        that.breather_seconds = seconds_delay;
        that.state = that.State.BREATHER;
    };

    /**
     * At the beginning of each contribution.
     */
    Bot.prototype.media_beginning = function Bot_media_beginning() {
        $(window.document.body).addClass('playing-somewhere');
        $('#play_bot_sequence').prop('disabled', true);
        $('#play_bot_from'    ).prop('disabled', true);
    };

    /**
     * At the end of each contribution.
     */
    Bot.prototype.media_ending = function Bot_media_ending() {
        $(window.document.body).removeClass('playing-somewhere');
        $(window.document.body).removeClass('pausing-somewhere');
        $('#play_bot_sequence').prop('disabled', false);
        $('#play_bot_from'    ).prop('disabled', false);
    };

    Bot.prototype.crash = function Bot_crash(/* arguments */) {
        var that = this;
        var bot_crash_arguments = Array.prototype.slice.call(arguments);
        // THANKS:  Soft-copy function arguments, https://stackoverflow.com/a/960870/673991
        bot_crash_arguments.unshift("Bot crash:");
        console.error.apply(null, bot_crash_arguments);
        // THANKS:  Pass-through arguments, https://stackoverflow.com/a/3914600/673991
        if (that._interval_timer !== null) {
            clearInterval(that._interval_timer);
            that._interval_timer = null;
        }
        that.media_ending();
        that.state = that.State.CRASHED;
        // TODO:  Prompt to reload the page.
        that.is_paused = false;
    };

    Bot.prototype.assert = function Bot_assert(/* condition, arguments */) {
        var that = this;
        var assert_arguments = Array.prototype.slice.call(arguments);
        var condition = assert_arguments.shift();
        assert_arguments.unshift("Assertion failed:");
        if ( ! condition) {
            that.crash.apply(that, assert_arguments);
            // noinspection JSConstructorReturnsPrimitive
            return false;
        }
        // noinspection JSConstructorReturnsPrimitive
        return true;
    };

    Bot.prototype.pause_speech = function Bot_pause_speech() {
        window.speechSynthesis.pause();
        // TODO:  Why is this delayed 4 words later?
    };

    Bot.prototype.pause_media = function Bot_pause_media() {
        embed_message('.pop-up', {action: 'pause'});
    };

    /**
     * Pause initiated by either the main page or the embedded iframe.
     */
    Bot.prototype._pause_begins = function Bot_pause_begins() {
        var that = this;
        that.is_paused = true;
        $(window.document.body).addClass('pausing-somewhere');
    };

    /**
     * Pause initiated by the main page.
     */
    Bot.prototype.pause = function Bot_pause() {
        var that = this;
        that._pause_begins();
        console.log("Pause initiated by main page");
        that.pause_media();   // TODO:  Only from state MEDIA_STARTED or MEDIA_READY?
        that.pause_speech();  // TODO:  Only from state SPEECH_STARTED or SPEECH_SHOULD_PLAY?
    };

    Bot.prototype._pause_ends = function Bot_pause_ends(/*unusual_reason*/) {
        var that = this;
        that.is_paused = false;
        $(window.document.body).removeClass('pausing-somewhere');
        if (that.state === that.State.MEDIA_PAUSE_IN_FORCE) {
            that.state = that.State.MEDIA_STARTED;
        }
    };

    Bot.prototype.resume = function Bot_resume() {
        var that = this;
        console.log("Resume initiated by main page");
        if (utter === null) {
            embed_message('.pop-up', {action: 'resume'});
            // NOTE:  _pause_ends() after embed messages back auto-play-playing.
        } else {
            window.speechSynthesis.resume();
            that._pause_ends();
        }
    };

    Bot.prototype.stop = function Bot_stop() {
        var that = this;
        that._pause_ends("stop");

        if (that.state === that.State.MANUAL) {
            // NOTE:  Harmlessly getting a precautionary bot.stop() when not animating or anything.
        } else {
            that.state = that.State.END_AUTO;
            // NOTE:  Artificial manual Bot ending.
        }
        that.pop_end();
        pop_down_all(false);
    };

    Bot.prototype.skip = function Bot_skip() {
        var that = this;
        that._pause_ends("skip");
        if (index_play_bot < list_play_bot.length) {
            console.log("Skipping idn", list_play_bot[index_play_bot], "at state", that.state.name);
        } else {
            console.error("Skip shouldn't be possible", index_play_bot, list_play_bot, that.state.name);
        }
        if (that.state === that.State.MANUAL) {
            // NOTE:  Mysteriously but harmlessly getting a skip when not animating or anything.
        } else {
            that.pop_end();
            that.end_one_begin_another(SECONDS_BREATHER_AT_SKIP, false);
        }
    };

    /**
     * Send a message to the embedded iframe JavaScript.
     *
     * @param selector_or_element_in_contribution
     * @param message {object} - with an action property, and other action-specific properties
     */
    function embed_message(selector_or_element_in_contribution, message) {
        iframe_resizer(
            selector_or_element_in_contribution,
            function (resizer) {
                resizer.sendMessage(message);
            },
            function (why) {
                // console.warn("Cannot iframe", message.action, "--", why);
                // Cannot pause or resume text -- no iframe
                // NOTE:  This harmlessly happens because of the redundant un-pop-up,
                //        when BEGIN_ANOTHER state does a precautionary pop_down_all()
                //        before it punts to NEXT_CONTRIBUTION which pops up.
            }
        );
    }

    /**
     * Freakish name for a thing that stores idn-referenced stuff.
     *
     * It's almost sorta maybe like a Lex.
     *
     * @param word_class constructs instances for the lexi.  Takes an idn to construct.
     * @return {Lexi}
     * @constructor
     */
    function Lexi(word_class) {
        if ( ! (this instanceof Lexi)) {
            return new Lexi(word_class);
        }
        this.word_class = word_class;
        this._word_from_idn = {}
    }
    Lexi.prototype.get = function Lexi_get(idn) {
        var that = this;
        if (has(that._word_from_idn, idn)) {
            return that._word_from_idn[idn];
        } else {
            console.error(type_name(that), "has not got", idn);
            return null;
        }
    }
    Lexi.prototype.has = function Lexi_has(idn) {
        var that = this;
        return has(that._word_from_idn, idn);
    }
    Lexi.prototype.add = function Lexi_add(idn) {
        var that = this;
        if (has(that._word_from_idn, idn)) {
            console.error(type_name(that), "already added", idn);
        } else {
            that._word_from_idn[idn] = that.word_class(idn);
        }
        return that._word_from_idn[idn];
    }

    /**
     * Know about contributions.
     *
     * @return {ContributionLexi}
     * @constructor
     */
    function ContributionLexi(category_list) {
        if ( ! (this instanceof ContributionLexi)) {
            return new ContributionLexi(category_list);
        }
        this.category_list = category_list;
        Lexi.apply(this, [Contribution]);
    }
    ContributionLexi.prototype = new Lexi(Contribution);
    ContributionLexi.prototype.constructor = ContributionLexi;

    ContributionLexi.prototype.word_pass = function ContributionLexi_add(word) {
        var that = this;
        switch (word.vrb) {
        case MONTY.IDN.UNSLUMP_OBSOLETE:
        case MONTY.IDN.CONTRIBUTE:
            contribute_word(word);
            break;
        case MONTY.IDN.CAPTION:
            caption_word(word);
            break;
        case MONTY.IDN.EDIT:
            edit_word(word);
            break;
        default:
            var cat = that.category_list.get(word.vrb);
            if (cat !== null) {
                cat_ordering_word(cat, word);
            }
        }

        function contribute_word(word) {
            var cont = that.add(word.idn);
            console.assert(cont !== null, word, that);
            var cat_idn = original_cat(word);
            cont.cat_idn = cat_idn;
        }

        function caption_word(word) {
        }

        function edit_word(word) {
        }

        function cat_ordering_word(cat, word) {
            var cont_idn = word.obj;
            if (that.has(cont_idn)) {
                var cont = that.get(cont_idn);
                cat.cont_idn_sequence.unshift(cont_idn);
                cont.cat = cat;
            } else {
                console.warn("Can't order", cont_idn);
            }
        }
    }

    /**
     * What we need to know about each category.
     *
     * @param idn - e.g. MONTY.IDN.CAT_MY
     * @return {Category}
     * @constructor
     */
    function Category(idn) {
        if ( ! (this instanceof Category)) {
            return new Category(idn);
        }
        this.idn = idn;
        this.txt = null;
        this.cont_idn_sequence = null;
    }

    /**
     * Know about Categories
     *
     * @return {CategoryLexi}
     * @constructor
     */
    function CategoryLexi() {
        if ( ! (this instanceof CategoryLexi)) {
            return new CategoryLexi();
        }
        Lexi.apply(this, [Category]);
    }
    CategoryLexi.prototype = new Lexi(Category);
    CategoryLexi.prototype.constructor = CategoryLexi;

    CategoryLexi.prototype.from_monty = function CategoryLexi_from_monty(monty_cat) {
        var that = this;
        looper(monty_cat.order, function (_, cat_idn) {
            var category = that.add(cat_idn);
            category.txt = monty_cat.txt[cat_idn];
            category.cont_idn_sequence = [];
        });
    }



    var contribution_list = null;

    function alternative_build_contributions() {
        var category_list = CategoryLexi();
        category_list.from_monty(MONTY.cat);
        console.debug("CategoryLexi", category_list);

        contribution_list = ContributionLexi(category_list);
        looper(MONTY.w, function (_, word) {
            contribution_list.word_pass(word);
        });

        looper(MONTY.cat.order, function (_, cat_idn) {
            var cat = category_list.get(cat_idn);
            console.log("Category", cat.txt, cat.cont_idn_sequence.join(","));
        });

    }

    /**
     * Representing a little contribution box on the screen.  Or the popup.
     *
     * @param id_attribute - e.g. '1281' the contribution idn or 'popup_1281' its popup.
     * @return {Contribution}
     * @constructor
     */
    function Contribution(id_attribute) {
        if ( ! (this instanceof Contribution)) {
            return new Contribution(id_attribute);
        }
        // THANKS:  Automatic 'new', https://stackoverflow.com/a/383503/673991

        if (is_specified(id_attribute)) {
            if (typeof id_attribute === 'number') {
                id_attribute = id_attribute.toString();
            }
            this.id_specified = true;
            this.id_attribute = id_attribute;
            this.idn = parseInt(id_attribute);
            this.idn_decimal = strip_prefix(this.id_attribute, MONTY.POPUP_ID_PREFIX);
            this.$cont = $_from_id(this.id_attribute);
            this.$sup = this.$cont.closest('.sup-contribution');
            this.handler = null;
        } else {
            this.id_specified = false;
        }
    }

    /**
     * Construct a Contribution, not from its id, but from any element inside it.
     *
     * @param element_or_selector - e.g. '#1821' or $('.pop-up')
     * @return {Contribution}
     * @constructor
     */
    // TODO:  Combine this aux constructor with the Contribution() constructor?
    //        There would be an ambiguity between Contribution(id_attribute)
    //                                        and Contribution(text_selector)
    //        Guess we could try $_from_id() first and if fails just $().  Smelly.
    //        Or convert to everyone passing selector_or_element,
    //        then Contribution(idn) becomes Contribution($_from_id(idn))
    //                                    or Contribution(selector_from_id(idn))
    //        But that requires insider knowledge that an idn is the same as the
    //        naked id of some element in the contribution (it's the .contribution element).
    //        Oh wow, the "official" constructor is only used two places,
    //        when getting an idn from a playlist, or in a message from an iframe.
    //        So maybe switch the official and the aux constructors?
    //        Contribution_from_id_attribute()?
    //        Is that ever called on a popup_NNNN id??  Nope!
    //        Because the popup iframe uses the `idn=NNNN` part of its src URL in sendMessage.
    //        Contribution_from_idn() would make sense.
    //        In any case I tried to carefully distinguish between idn (always a decimal integer
    //        string in JavaScript, akin to the qiki.Number idn of a qiki.Word in Python)
    //        and an id_attribute (which may be an idn or a prefixed idn, e.g. 'popup_1821')
    //        Maybe cont.$sup.data('idn') should store a reliable idn, and cont.$sup.attr('id')
    //        should be prefixed.  Because hogging all the decimal integer ids for idns is priggish.
    function Contribution_from_element(element_or_selector) {
        var $sup_cont = $(element_or_selector).closest('.sup-contribution');
        var $cont = $sup_cont.find('.contribution');
        var cont_idn = $cont.attr('id');
        return Contribution(cont_idn);
    }

    Contribution.prototype.Event = {
        SPEECH_PLAY: 'SPEECH_PLAY',     // speechSynthesis.speak() was just called
        SPEECH_START: 'SPEECH_START',   // SpeechSynthesisUtterance 'start' event
        SPEECH_END: 'SPEECH_END',       // SpeechSynthesisUtterance 'end' event
        MEDIA_INIT: 'MEDIA_INIT',       // e.g. youtube started playing
        MEDIA_BEGUN: 'MEDIA_BEGUN',     // e.g. youtube auto-play started
        MEDIA_WOKE: 'MEDIA_WOKE',       // e.g. youtube auto-play first state-change TODO:  Use this?
        MEDIA_PAUSED: 'MEDIA_PAUSED',   // e.g. youtube auto-play paused
        MEDIA_PLAYING: 'MEDIA_PLAYING', // e.g. youtube auto-play playing
        MEDIA_RESUME: 'MEDIA_RESUME',   // e.g. youtube auto-play resume
        MEDIA_ENDED: 'MEDIA_ENDED',     // e.g. youtube auto-play played to the end
        MEDIA_STATIC: 'MEDIA_STATIC'    // e.g. flickr, not going to play, timed display
    };
    // TODO:  Should Event be an Enumerate()?  If so we need to add .name a buncha places, e.g.
    //            that.$sup.trigger(that.Event.MEDIA_BEGUN);
    //            that.$sup.trigger(that.Event.MEDIA_BEGUN.name);
    //        or
    //            that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_INIT, function () { ... } );
    //            that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_INIT.name, function () { ... } );

    function Contribution_loop(callback) {
        $('.contribution').each(function () {
            var cont = Contribution(this.id);
            var return_value = callback(cont);
            if (return_value === false) {
                return false;
            }
        });
    }

    Object.defineProperties(Contribution.prototype, {
        $render_bar:      { get: function () {return this.$sup.find('.render-bar');}},
        $save_bar:        { get: function () {return this.$sup.find('.save-bar');}},
        $caption_bar:     { get: function () {return this.$sup.find('.caption-bar');}},
        $caption_span:    { get: function () {return this.$sup.find('.caption-span');}},
        content:          { get: function () {return this.$cont.text();}},
        is_media:         { get: function () {return could_be_url(this.content);}},
        caption_text:     { get: function () {return this.$caption_span.text();}},
        is_noembed_error: { get: function () {return this.$sup.hasClass('noembed-error');}},
        /**
         * Compact domain for a media link (e.g. "youtube")
         *
         * @return {string|null} or null if not a link, or "no_domain" if bad link.
         */
        // TODO:  This JSDoc header STILL doesn't obviate the need for a
        //        noinspection JSIncompatibleTypesComparison
        media_domain:     { get: function () {return this.$sup.attr('data-domain') || null;}},
        $iframe:          { get: function () {return this.$render_bar.find('iframe');}},
        $img_thumb:       { get: function () {return this.$render_bar.find('img.thumb');}},
        iframe:           { get: function () {return this.$iframe.get(0) || null;}},
        $cat:             { get: function () {return this.$sup.closest('.category');}},
        category_id:      { get: function () {return this.$cat.attr('id');}},
        is_my_category:   { get: function () {return this.category_id === MONTY.IDN.CAT_MY.toString();}},
        media_url:        { get: function () {return this.is_media ? this.content : null;}}
    });

    Contribution.prototype.exists = function Contribution_exists() {
        // noinspection JSConstructorReturnsPrimitive
        return this.id_specified && this.$sup.length === 1;
    };

    /**
     * Initialize the iFrameResizer on an iframe jQuery object3.
     *
     * @param {function=} on_init - callback after iFrameResizer was initialized.
     */
    // NOTE:  Intermittent error made 2 of 3 youtube videos inoperative:
    //        iframeResizer.min.js:8 Failed to execute 'postMessage' on 'DOMWindow':
    //        The target origin provided ('...the proper domain...')
    //        does not match the recipient window's origin ('null').
    Contribution.prototype.resizer_init = function Contribution_resizer_init(on_init) {
        var that = this;
        console.assert(typeof on_init === 'function', "Expecting on_init function, not", on_init);
        if (that.$iframe.length >= 1 && typeof that.$iframe[0].iFrameResizer !== 'object') {
            setTimeout(function () {
                // noinspection JSUnusedGlobalSymbols
                that.$iframe.iFrameResize({
                    log: false,
                    sizeWidth: true,
                    sizeHeight: true,
                    widthCalculationMethod: 'taggedElement',
                    onMessage: function (twofer) {
                        iframe_incoming_message(that, twofer);
                    },
                    onResized: function iframe_resized_itself(stuff) {
                        var msg_cont = Contribution_from_element(stuff.iframe);
                        console.assert(
                            msg_cont.exists(),
                            stuff.iframe,
                            stuff.iframe.parentElement,
                            stuff.height, stuff.width, stuff.type
                        );

                        var pop_stuff = msg_cont.$sup.data('pop-stuff');
                        if (is_defined(pop_stuff)) {
                            var progress_width = linear_transform(
                                stuff.width,
                                pop_stuff.render_width, pop_stuff.max_live_width,
                                0.0, 1.0
                            )
                            // FALSE WARNING:  'render_height' should probably not be passed as parameter 'x1'
                            // noinspection JSSuspiciousNameCombination
                            var progress_height = linear_transform(
                                stuff.height,
                                pop_stuff.render_height, pop_stuff.max_live_height,
                                0.0, 1.0
                            )
                            var progress = Math.max(progress_width, progress_height);
                            // NOTE:  Rely on whichever is further along the way to a full screen.

                            if (0.0 <= progress && progress <= 1.0) {
                                // NOTE:  Limiting progress's range prevents a zero-size iframe
                                //        from moving to the "vanishing" point.

                                // console.log(
                                //     "iframe resized",
                                //     msg_cont.id_attribute,
                                //     stuff.width,
                                //     stuff.height,
                                //     pop_stuff.render_width,
                                //     pop_stuff.render_height,
                                //     pop_stuff.max_live_width,
                                //     pop_stuff.max_live_height
                                // );
                                // EXAMPLE:  iframe resized popup_1990 168.53125 136 162 92 1583 1390
                                //           iframe resized popup_1990 216.90625 178 162 92 1583 1390
                                //           iframe resized popup_1990 265.296875 221 162 92 1583 1390
                                //           :
                                //           iframe resized popup_1990 1526.078125 1340 162 92 1583 1390
                                //           iframe resized popup_1990 1546 1357 162 92 1583 1390
                                //           iframe resized popup_1990 1583 1390 162 92 1583 1390
                                // NOTE:  It doesn't START at render dimensions,
                                //        but it does seem to END at max_live dimensions.

                                var pop_left = 0;
                                var pop_top = TOP_SPACER_PX;
                                // FALSE WARNING:  'left' should probably not be passed as parameter 'y1'
                                // noinspection JSSuspiciousNameCombination
                                var sliding_left = linear_transform(
                                    progress,
                                    0.0, 1.0,
                                    pop_stuff.fixed_coordinates.left, pop_left
                                )
                                var sliding_top = linear_transform(
                                    progress,
                                    0.0, 1.0,
                                    pop_stuff.fixed_coordinates.top, pop_top
                                )
                                msg_cont.$sup.css({left: sliding_left, top: sliding_top});
                            } else {
                                if (stuff.width === 0 && stuff.height === 0) {
                                    // Neither animate nor warn about zero-size iframe.  Boring.
                                } else {
                                    console.warn(
                                        "Resize out of range",
                                        msg_cont.id_attribute,
                                        stuff.width,
                                        stuff.height
                                    );
                                }
                            }
                        }
                        msg_cont.fix_caption_width();
                    }
                    /*,
                    targetOrigin: MONTY.OEMBED_OTHER_ORIGIN*/
                    // onInit: function resizer_init_callback(iframe) {
                    //     console.log("RESIZER_INIT_CALLBACK", iframe.id);
                    // }
                });
                on_init();
            }, MS_IFRAME_RESIZER_INIT);
        } else {
            console.error("Missing iframe or resizer", that);
        }
    };
    function iframe_incoming_message(that, twofer) {
        var message = twofer.message;
        var cont_idn = strip_prefix(message.contribution_idn, MONTY.POPUP_ID_PREFIX);
        console.assert(cont_idn === that.idn_decimal, cont_idn, that.idn_decimal);
        // noinspection JSRedundantSwitchStatement
        switch (message.action) {
        case 'auto-play-presaged':
            console.log("Media presaged", that.id_attribute, message.contribution_idn);
            that.$sup.trigger(that.Event.MEDIA_BEGUN);
            break;
        case 'auto-play-static':
            console.log("Media static", that.id_attribute, message.contribution_idn);
            that.$sup.trigger(that.Event.MEDIA_STATIC, [{
                cont_idn: cont_idn,
                current_time: message.current_time
            }]);
            // interact.START(cont_idn, message.current_time);
            // DONE:  Avoid double START interaction.  Interaction is now lexed in event handler.
            //        Can happen if Contribution.zero_iframe_recover()
            break;
        case 'auto-play-begun':
            console.log("Media begun", that.id_attribute, message.contribution_idn);
            // NOTE:  Okay to pause.
            break;
        case 'auto-play-woke':
            console.log("Media woke", that.id_attribute, message.contribution_idn);
            that.$sup.trigger(that.Event.MEDIA_WOKE);
            // NOTE:  State changes, first sign of life from youtube player.
            break;
        case 'auto-play-end-dynamic':
            console.log("Dynamic media ended", that.id_attribute, message.contribution_idn);
            that.$sup.trigger(that.Event.MEDIA_ENDED);
            // NOTE:  MEDIA_ENDED event means e.g. a video ended,
            //        so next it's time for a breather.
            interact.END(cont_idn, message.current_time);
            break;
        case 'auto-play-end-static':
            console.log("Static media ended", that.id_attribute, message.contribution_idn);
            // NOTE:  Static media timed-out, no breather necessary.
            interact.END(cont_idn, message.current_time);
            break;
        case 'auto-play-error':
            console.log("Embedded player error", that.id_attribute, message.error_message);
            interact.ERROR(cont_idn, 1, message.error_message);
            break;
        case 'auto-play-paused':
            console.log(
                "Media paused",
                that.id_attribute,
                message.contribution_idn,
                message.current_time
            );
            that.$sup.trigger(that.Event.MEDIA_PAUSED);
            interact.PAUSE(cont_idn, message.current_time);
            // NOTE:  This could happen a while after the pause button is clicked,
            //        after a cascade of consequences.  But it should accurately
            //        record the actual position of the pause in the video.
            break;
        case 'auto-play-quit':
            // NOTE:  This up-going message resulted from the Down-going message
            //            'un-pop-up'
            //        For a dynamic contribution, e.g. youtube,
            //        we get here only if the iframe says the video was in a
            //        quitable state.
            //        You can't quit if a video wasn't playing or paused.
            //        For a static contribution, e.g. instagram,
            //        we get here if the un-pop-up was manual, not bot-automated.
            console.log(
                "Media quit",
                that.id_attribute,
                message.contribution_idn
            );
            interact.QUIT(cont_idn, message.current_time);
            break;
        case 'auto-play-playing':
            console.log(
                "Media playing",
                that.id_attribute,
                message.contribution_idn,
                message.current_time.toFixed(3),
                bot.is_paused
            );
            // if (bot.is_paused) {
            //     // NOTE:  This may be the sole place a Contribution knows of a Bot.
            //     //        Necessary?  Wise?
            //     interact.RESUME(cont_idn, message.current_time);
            // } else {
            //     interact.START(cont_idn, message.current_time);
            // }

            that.$sup.trigger(that.Event.MEDIA_PLAYING, [{
                // is_paused: bot.is_paused,
                cont_idn: cont_idn,
                current_time: message.current_time
            }]);

            break;
        case 'auto-play-resume':
            // NOTE:  This is a parent-initiated resume, for non-dynamic media.
            console.log(
                "Media resume",
                that.id_attribute,
                message.contribution_idn,
                message.current_time.toFixed(3)
            );
            interact.RESUME(cont_idn, message.current_time);
            that.$sup.trigger(that.Event.MEDIA_RESUME, [{
                current_time: message.current_time
            }]);

            break;
        case 'noembed-error-notify':
            // NOTE:  This happens when youtube oembed says "401 Unauthorized"
            //        E.g. https://www.youtube.com/watch?v=bAD2_MVMUlE
            // var media_cont = Contribution(message.contribution_idn);
            // TODO:  We don't need message.contribution_idn,
            //        because we know it from scope!  Right??
            that.$sup.addClass('noembed-error');
            interact.ERROR(cont_idn, 1, message.error_message);
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
    function interact(interaction_name, obj, num, txt) {
        if ( ! is_specified(txt))   txt = "";
        console.assert(typeof num === 'number', num);
        console.assert(typeof txt === 'string', txt);
        var num_with_one_qigit_resolution = one_qigit(num);
        // NOTE:  current_time doesn't need to store more than one qigit below decimal.
        //        So it gets rounded to the nearest 1/256.
       qoolbar.post('interact', {
            name: interaction_name,
            obj: obj,
            num: num_with_one_qigit_resolution,
            txt: txt
        });
    }
    looper(MONTY.INTERACTION, function for_each_interaction(INTERACTION_CODE, interaction_name) {
        interact[INTERACTION_CODE] = function curried_interact(obj, num, txt) {
            interact(interaction_name, obj, num, txt);
        };
    });

    function one_qigit(n) {
        return Math.round(n * 256.0) / 256.0;
    }
    console.assert(26.0 / 256 === one_qigit(0.1));
    console.assert(0.1015625 === one_qigit(0.1));

    Contribution.prototype.fix_caption_width = function Contribution_fix_caption_width() {
        // TODO:  Call this function more places where $caption_bar.width(is set to something)
        // noinspection JSUnusedAssignment
        var that = this;


        var media_width = that.$iframe   .outerWidth() || 0;
        var thumb_width = that.$img_thumb.outerWidth() || 0;
        var wordy_width = that.$cont     .outerWidth() || 0;

        function adjust_to(width) {
            if (equal_ish(width, that.$caption_bar.outerWidth(), 1.0)) {
                // width is already within 1 pixel, don't upset the UI.
            } else {
                // EXAMPLE:  caption tweak 296 -> 162 55% thumb loading
                // EXAMPLE:  caption tweak 221 -> 210 95% quote size adjust
                that.$caption_bar.outerWidth(width);
            }
        }

        if (media_width > MIN_CAPTION_WIDTH) {
            adjust_to(media_width);
        } else if (thumb_width > MIN_CAPTION_WIDTH) {
            adjust_to(thumb_width);
            // NOTE:  thumb_width === 2 (or some width) is common, but temporary
        } else if (wordy_width > MIN_CAPTION_WIDTH) {
            adjust_to(wordy_width);
        }
        // NOTE:  wordy_width is the last resort, in case of quote contributions
        //        But it has width even when invisible.  In that case choose media or thumb.
    };

    Contribution.prototype.resizer_nudge = function Contribution_resizer_nudge() {
        var that = this;
        var iframe = that.iframe;
        // FALSE WARNING:  Condition is always true since types '{get: (function(): any | null)}' and 'null' have no overlap
        // noinspection JSIncompatibleTypesComparison
        if (iframe !== null && is_defined(iframe.iFrameResizer)) {
            iframe.iFrameResizer.resize();
        }
    };

    /**
     * Workaround for the zero-iframe bug.
     *
     * When an iframe has zero width or height, try reloading it.
     * This may work around an iFrameResizer bug.  Or just a poor internet connection.
     *
     * When this is attempted (obviously this list is massively likely to go stale):
     *    3 seconds after each iframe is loaded
     *    3 seconds after a reload that THIS function causes
     *    after animating a pop-up to full-ish screen
     *    after save, cancel, discard a contribution media URL
     *    (for all iframes) 3 seconds after page load (help browsers with no iframe load event)
     *    (for all iframes) when a category is opened (For the first time? Or every time?)
     *
     * THANKS:  iframe reload by src reassign, https://stackoverflow.com/a/4062084/673991
     */
    Contribution.prototype.zero_iframe_recover = function Contribution_zero_iframe_recover() {
        var that = this;
        var $iframe = that.$iframe;
        if (
            $iframe.is(':visible') &&
            ($iframe.width() === 0 || $iframe.height() === 0)
        ) {
            var MAX_IFRAME_RECOVERY_TRIES = 10;
            var i_recovery = $iframe.data('recovery-count') || 0;
            i_recovery++;
            $iframe.data('recovery-count', i_recovery);
            if (i_recovery > MAX_IFRAME_RECOVERY_TRIES) {
                console.error("Too many iframe recoveries, giving up", $iframe.attr('id'));
                // NOTE:  This can stop an endless cycle of reloading, for embedded media that
                //        for whatever reason always has zero size.
            } else {
                reload_iframe($iframe);
                console.log("ZERO-IFRAME, RECOVERY", i_recovery, $iframe.attr('id'));
            }
        }
    };

    function reload_iframe(iframe) {
        $(iframe).attr('src', $(iframe).attr('src'));
    }

    /**
     * (Re)build the render bar element contents, using the media URL in the contribution text.
     *
     * Use the registered media handler, if the pattern matches.
     *
     * Happens on page load, on entering a new contribution, or editing an old one.
     */
    Contribution.prototype.render_media = function Contribution_render_media() {
        // NOTE:  that.$iframe may not exist yet, e.g. on page reload, or entering a new cont.
        //        If it did exist it gets displaced here, e.g. after an edit.
        var that = this;
        that.$sup.attr('data-domain', sanitized_domain_from_url(that.content));

        if (that.handler_scan()) {
            // console.log(
            //     "Sophisticated Media", that.id_attribute,
            //     "handler", that.handler.handler_index,
            //     that.handler.media.description_short,
            //     that.handler.match_object.slice(1).join(" "),
            //     that.caption_text.slice(0, 10) + "..."
            // );
            // EXAMPLE:  Sophisticated Media 3459 handler 0 youtube _SKdN1xQBjk
            // EXAMPLE:  Sophisticated Media 994 handler 1 instagram BNCeThsAhVT
            // EXAMPLE:  Sophisticated Media 1857 handler 2 noembed  Switched a...
            // EXAMPLE:  Sophisticated Media 1792 handler 3 any url  Mr Bean's ...
            that.handler.media.render_thumb(that);
            var can_play = that.handler.media.can_play();
            this.$sup.toggleClass('can-play', can_play);
            this.$sup.toggleClass('cant-play', ! can_play);
        } else {
            this.$sup.removeClass('can-play');
            this.$sup.removeClass('cant-play');
            console.error(
                "No fallback media handler for",
                that.id_attribute,
                that.content.slice(0,40)
            );
        }
    };

    Contribution.prototype.render_error = function Contribution_render_error(error_message) {
        var that = this;
        that.$render_bar.empty().text(error_message);   // .addClass('oembed-error');
        that.$sup.addClass('noembed-error');
        // NOTE:  How non-live thumbnails skip the bot.
        //        Also how the text gets its peachy background color.
        that.$render_bar.outerWidth(that.$cont.outerWidth());
        // TODO:  Less clumsy way to constrain error message width.
        //        Why the heck does that.$cont have an element style width at this point?!
    };

    Contribution.prototype.thumb_image = function Contribution_thumb_image(
        thumb_url,
        thumb_title,
        error_callback
    ) {
        var that = this;
        var $a = $('<a>', {
            id: 'thumb_' + that.id_attribute,
            class: 'thumb-link',
            href: thumb_url,
            target: '_blank',
            title: thumb_title
        });
        // noinspection HtmlRequiredAltAttribute,RequiredAttributes
        var $img = $('<img>', {
            class: 'thumb thumb-loading',
            alt: thumb_title
        });
        that.$render_bar.empty().append($a);
        $a.append($img);
        that.fix_caption_width('thumb loading');
        $img.one('load.thumb1', function render_img_load() {
            $img.off('.thumb1');
            $img.removeClass('thumb-loading');
            $img.addClass('thumb-loaded');
            that.fix_caption_width('thumb loaded');
        });
        $img.one('error.thumb1', function render_img_error() {
            $img.off('.thumb1');
            console.log("Broken thumb", thumb_url);
            error_callback();
        });
        // NOTE:  .src is set after the load and error event handlers,
        //        so one of those handlers is sure to get called.
        $img.attr('src', thumb_url);
    };

    Contribution.prototype.live_media_iframe = function Contribution_live_media_iframe(parameters, then) {
        var that = this;
        var $iframe = $('<iframe>', {
            id: 'iframe_' + that.id_attribute,   // This is NOT how a pop-up gets made.
            src: our_oembed_relay_url(parameters),
                  allowFullScreen : 'true',
               mozallowFullScreen : 'true',
            webkitallowFullScreen : 'true',
            allow: 'autoplay; fullscreen'
        });

        that.$render_bar.empty().append($iframe);   // The iframe is dead, long live the iframe.

        $iframe.on('load', function () {
            // DONE:  Verify iframe load event happens on "all" browsers.
            //        Claim that it does:  https://stackoverflow.com/a/751458/673991
            //        Yes:  Chrome, Firefox, Opera, Edge, UCBrowser7
            //        No:  IE11
            // NOTE:  Cannot delegate the iframe load event, because it doesn't bubble.
            //        https://developer.mozilla.org/Web/API/Window/load_event

            var older_loader_timer = $iframe.data('loader_timer');
            if (is_specified(older_loader_timer)) {
                clearInterval(older_loader_timer);
                // NOTE:  Instead of multiple load events triggering multiple recoveries,
                //        this clears the older (thus earlier) recovery,
                //        and so only the newer (thus later) recovery happens.
                //        This might thwart a run-away chain reaction in case some oembed
                //        iframe content reloads itself once (and iframe is persistently zero).
                //        Because if a reload happens, we'll almost certainly come back here
                //        at least once.
                //        Worst case, a permanently zero iframe reloads every 3 seconds forever.
                // TODO:  Limit the reloading to a certain number of times.
                //        And a certain minimum too!  Otherwise a zero-iframe may result,
                //        due to $(iframe iframe div img) having style width:0 height:0
                //        maybe because the div.flickr-embed-photo did too?
                // NOTE:  There seems to be an infinite loop in UC Browser for soundcloud.com
                //        VM1681 visual-single-sound-ff6ac74-7a528cf9.js
                //        Uncaught DOMException: Failed to execute 'getImageData' on
                //        'CanvasRenderingContext2D': The source width is 0.
            }
            var loader_timer = setTimeout(function () {
                $iframe.removeData('loader_timer');
                that.zero_iframe_recover();
            }, MS_IFRAME_RECOVERY_CHECK);
            $iframe.data('loader_timer', loader_timer);

            if (is_specified(then)) {
                then();
                // NOTE:  Zero-iframe recovery (i.e. reload) might come AFTER callback is called.
            }
        });
        // NOTE:  Chrome's ooey gooey autoplay policy needs iframe delegation.
        //        https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
        //        Unclear if `allow: autoplay` is part or all of that.
        //        Emeffing lazy browser developers hammer legitimate media activity.
        //        So user may have to hit an in-iframe play button an unknown number of times
        //        before the (GeeDee user-initiated) player bot will begin to work.
        // NOTE:  Instagram popup won't do scrollbars, even if iframe overflow: auto
        //        On both outer (this $iframe here) and inner (instagram-installed).
        //        Is this a bad thing?  Even if it did scroll, virtually ANY other interaction
        //        results in a new instagram tab popping up.
        that.resizer_init(function () {});
    };

    /**
     * Compute coordinates for position:fixed clone that would appear in the same place.
     *
     * @return {{top: number, left: number}}
     */
    Contribution.prototype.fixed_coordinates = function Contribution_fixed_coordinates() {
        var that = this;
        var offset = that.$sup.offset();
        return {
            top: offset.top - $(window).scrollTop(),
            left: offset.left - $(window).scrollLeft()
        };
        // THANKS:  Recast position from relative to fixed, with no apparent change,
        //          (my own compendium) https://stackoverflow.com/a/44438131/673991
    };

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
     * Is there unfinished entry or editing on the page?
     *
     * Make red controls that could save unfinished work.
     *
     * @param do_scroll_into_view {boolean} - if reddening controls, also scroll entry into view?
     * @param do_close_clean {boolean} - If an edit was started but no changes, do we just close it?
     * @return {boolean} - true = confirm exit, false = exit harmless, don't impede
     */
    function check_page_dirty(do_scroll_into_view, do_close_clean) {
        var is_dirty_entry = check_text_entry_dirty(do_scroll_into_view);
        var is_dirty_edit = check_contribution_edit_dirty(do_scroll_into_view, do_close_clean);
        // NOTE:  We want side effects from both these functions, the button reddening.
        return is_dirty_entry || is_dirty_edit;
    }

    /**
     * Are there unposted text or caption entry fields?
     *
     * If so, make the [post it] button red.
     *
     * @return {boolean} - false means the fields are both empty, i.e. clean
     */
    function check_text_entry_dirty(do_scroll_into_view) {
        if (
            $('#enter_some_text').val().length > 0 ||
            $('#enter_a_caption').val().length > 0
        ) {
            var $post_it_button = $('#post_it_button');
            if ( ! $post_it_button.hasClass('abandon-alert')) {
                $post_it_button.addClass('abandon-alert');
                // TODO:  Is it annoying to redden the post-it when merely clicking on the
                //        document background?
                if (do_scroll_into_view) {
                    scroll_into_view('#enter_some_text', {block: 'nearest', inline: 'nearest'});
                    // NOTE:  Reluctantly scroll dirty entry into view, if user seems to digress.
                    //        Ala scroll_into_view() call in check_contribution_edit_dirty()
                }
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Is there an unsaved contribution edit in progress?
     *
     * If so, make its [save] and [discard] buttons red.
     *
     * @param do_scroll_into_view {boolean} - if reddening controls, also scroll edits into view?
     * @param do_close_clean {boolean} - If an edit was started but no changes, do we just close it?
     *     There are five callers to this function.
     *     At the risk of taunting the stale-comment gods, here are those three three cases:
     *     If unloading the page - doesn't matter, if a started edit was clean,
     *                             then this returns false and page unloads without interruption.
     *     If document click - depends on DOES_DOCUMENT_CLICK_END_CLEAN_EDIT.
     *     If editing another contribution - yes, always want to silently close an old clean edit.
     *     Escape key - yes, Escape closes a clean edit.  And reddens a dirty edit.
     *     Thumb-click - yes, popping up media closes a clean edit.
     * @return {boolean} - true if a contribution was being edited and there are unsaved changes,
     *                          meaning you can't edit some other contribution now.
     *                     false if okay to go ahead with whatever edit user wants to do now.
     */
    function check_contribution_edit_dirty(do_scroll_into_view, do_close_clean) {
        if (is_editing_some_contribution) {
            var $sup_cont = $cont_editing.closest('.sup-contribution');
            if ($sup_cont.hasClass('edit-dirty')) {
                var $save_bar = $save_bar_from_cont($cont_editing);
                if ( ! $save_bar.hasClass('abandon-alert')) {
                    $save_bar.addClass('abandon-alert');
                    if (do_scroll_into_view) {
                        scroll_into_view($cont_editing, {block: 'nearest', inline: 'nearest'});
                        // NOTE:  Scroll the dirty contribution edit with its red buttons into view.
                        //        But only do that once (that's what the.hasClass() is for)
                        //        because we don't want a dirty edit to be repeatedly scrolling
                        //        itself into view, if the user is up to something else.
                    }
                }
                return true;
            } else {   // edit was started but there were no changes (a "clean" edit)
                if (do_close_clean) {
                    contribution_edit_end();
                }
                return false;
            }
        } else {   // no edit was started
            return false;
        }
    }

    /**
     * SEE:  About this bug in contribution.css
     *
     * Note, if 1px instead of 0.1px, contribution element would have been seen to jitter
     * vertically 1 pixel when editing, on every keystroke, paste, etc.
     *
     * TODO:  Only burden the UI with this in Chrome.  Safari too?  Opera?
     *        Better yet, detect the bug.  But I don't know a way to do that.
     *
     * @param element - e.g. $('.contribution')
     */
    function work_around_jumpy_contenteditable_chrome_bug(element) {
        var $element = $(element);
        $element.css('top', '0.1px');
        setTimeout(function () {
            $element.css('top', '0px');
        });
    }

    function scroll_into_view(element, options) {
        ignore_exception(function () {
            $(element)[0].scrollIntoView(options);
            // SEE:  Browser scrollIntoView, https://caniuse.com/#search=scrollIntoView
        });
    }

    function contribution_edit(evt) {
        // TODO:  Make these functions members of Contribution "class".
        var cont = Contribution_from_element(this);
        console.assert(cont.exists(), this);
        var $clicked_on = $(evt.target);
        // SEE:  this vs evt.target, https://stackoverflow.com/a/21667010/673991
        if ($clicked_on.is('.contribution') && is_click_on_the_resizer(evt, $clicked_on[0])) {
            console.log("contribution_click nope, just resizing");
            return;
        }
        var was_already_editing_this_same_contribution = cont.$sup.hasClass('contribution-edit');
        if (was_already_editing_this_same_contribution) {
            // Leave it alone, might be selecting text to replace, or just giving focus.
        } else {
            contribution_edit_begin(cont.$cont);
            console.log("edit clicked", cont.id_attribute);
            if ($clicked_on.is('.contribution')) {
                cont.$cont.focus();
            } else if ($clicked_on.closest('.caption-bar').length > 0) {
                cont.$caption_span.focus();
            }
            // NOTE:  Luckily .focus() allows the click that began editing to also place the caret.
            //        Except it doesn't do that in IE11, requiring another click.
        }
        evt.stopPropagation();   // Don't let the document get it, which would end the editing.
    }

    function contribution_cancel() {
        var cont = Contribution_from_element(this);
        console.assert(cont.exists(), this);
        console.assert(is_editing_some_contribution);
        // If not editing, how was the cancel button visible?
        if (is_editing_some_contribution) {
            if (cont.$sup.hasClass('edit-dirty')) {
                $cont_editing.text($cont_editing.data('original_text'));
                cont.$caption_span.text(cont.$caption_span.data('original_text'));
            }
            contribution_edit_end();
        }
    }

    function contribution_dirty() {
        var cont = Contribution_from_element(this);
        console.assert(cont.exists(), this);
        var class_attr = this.classList;
        if ( ! cont.$sup.hasClass('edit-dirty')) {
            cont.$sup.addClass('edit-dirty');
            $(window.document.body).removeClass('dirty-nowhere');
            console.log("Dirty", cont.id_attribute, class_attr);
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
                    rebuild_a_render_bar($cont_editing);
                    contribution_edit_end();
                });
            });
        } else {
            console.error("Save but we weren't editing?", $cont_editing);
        }
    }

    function thumb_click(evt) {
        var div = this;
        if ( ! check_contribution_edit_dirty(false, true)) {
            var cont = Contribution_from_element(this);
            console.log("thumb click", cont.id_attribute);
            bigger(div, true);
            evt.stopPropagation();
            evt.preventDefault();
            return false;
        }
    }

    /**
     * Respond to the buttons under individual contribution thumbnails.
     *
     * @param element - anywhere in a contribution
     * @param do_play - false for the bigger button, true for the play button
     */
    function bigger(element, do_play) {
        bot.stop();
        var cont = Contribution_from_element(element);
        console.assert(cont.exists(), element);
        $(window.document.body).addClass('pop-up-manual');
        // NOTE:  body.pop-up-manual results from clicking any of:
        //        1. the contribution's save-bar "bigger" button with the fullscreen icon
        //        2. the contribution's save-bar "play" button with the triangle icon
        //        3. the contribution render-bar thumbnail
        //        This does not happen when clicking the global bot play button,
        //        nor its subsequent automated pop-ups.
        pop_up(cont, do_play);
    }

    /**
     * Do something with the iFrameResizer object.  Call back if there is one.  Explain if not.
     *
     * @param selector_or_element - e.g. '.pop-up', $popup
     * @param {function} callback_good - pass it the iFrameResizer object, if up and running
     * @param {function} callback_bad - pass it an explanation if not
     */
    function iframe_resizer(selector_or_element, callback_good, callback_bad) {
        callback_bad = callback_bad || function () {};
        var cont = Contribution_from_element(selector_or_element);
        if (cont.exists()) {
            var iframe = cont.iframe;
            // noinspection JSIncompatibleTypesComparison
            if (iframe === null) {
                // NOTE:  E.g. harmlessly trying to use a cont with no render-bar iframe.
                callback_bad("No iframe " + selector_or_element.toString());
            } else {
                var resizer;
                try {
                    resizer = iframe.iFrameResizer;
                } catch (e) {
                    console.error("iframe without a resizer??", e.message, iframe.id);
                    callback_bad("No resizer " + selector_or_element.toString());
                    return
                }
                console.assert(typeof resizer.sendMessage === 'function', resizer, selector_or_element);
                console.assert(typeof resizer.close === 'function', resizer, selector_or_element);
                callback_good(resizer);
            }
        } else {
            callback_bad("No element " + selector_or_element.toString());
        }
    }

    /**
     * End pop-up.
     *
     * @param did_bot_transition - true = Bot automatic timeout of the contribution,
     *                           false or unspecified = manually terminated
     */
    function pop_down_all(did_bot_transition) {
        var $pop_ups = $('.pop-up');
        var pop_cont = null;
        var pop_conts = [];   // In case there are more than one.

        deanimate("popping down " + $pop_ups.find('.contribution').attr('id'));

        $pop_ups.each(function () {
            // NOTE:  There's almost certainly only one .pop-up at a time.
            //        Maybe lingering animations could cause multiple?
            //        But this makes sure to un-pop them all.  And exactly once.

            pop_cont = Contribution_from_element(this);
            var cont = Contribution(pop_cont.idn_decimal);
            pop_conts.push(pop_cont);

            pop_cont.$sup.removeClass('pop-up');
            // NOTE:  This immediate removal of the pop-up class, though premature
            //        (because the animation of the popping down is not complete),
            //        allows redundant back-to-back calls to pop_down_all().
            //        Because it means a second call won't find any .pop-up elements.

            $(window.document.body).removeClass('pop-up-manual');
            $(window.document.body).removeClass('pop-up-auto');

            var pop_stuff = pop_cont.$sup.data('pop-stuff');
            // TODO:  Instead, just remember the pop-down DOM object ($sup_cont in pop_up()),
            //        and recalculate HERE AND NOW its current "fixed" coordinates from that object.

            if (pop_cont.is_media) {
                embed_message(pop_cont.$sup, {
                    action: 'un-pop-up',
                    width: pop_stuff.render_width,
                    height: pop_stuff.render_height,
                    did_bot_transition: did_bot_transition
                });
            } else {
                pop_cont.$cont.animate({
                    width: pop_stuff.cont_css_width,
                    height: pop_stuff.cont_css_height,
                    'font-size': px_from_em(1)
                }, {
                    duration: POP_DOWN_ANIMATE_MS,
                    easing: POP_DOWN_ANIMATE_EASING,
                    queue: false
                });
                pop_cont.$caption_bar.animate({
                    width: pop_stuff.caption_css_width,
                    height: pop_stuff.caption_css_height,
                    'background-color': pop_stuff.caption_css_background
                }, {
                    duration: POP_DOWN_ANIMATE_MS,
                    easing: POP_DOWN_ANIMATE_EASING,
                    queue: false
                });
                pop_screen_fade_out();
                // NOTE:  Rely on the $sup animation to remove the popup-screen element,
                //        at about the same time as this animation finishes fading.
                //        Has to be that way because that animation completion function
                //        also removes the popup $sup from the DOM.

                // TODO:  Velocity.js animation?  https://github.com/julianshapiro/velocity
            }


            // FALSE WARNING:  Argument type {complete: complete} is not assignable to parameter type number | KeyframeAnimationOptions | undefined
            // noinspection JSCheckFunctionSignatures
            pop_cont.$sup.animate(cont.fixed_coordinates(), {
                duration: POP_DOWN_ANIMATE_MS,
                easing: POP_DOWN_ANIMATE_EASING,
                queue: false,
                // THANKS:  Concurrent animations, https://stackoverflow.com/a/4719034/673991
                //          Queue false means animate immediately, in this case mostly
                //          simultaneously with shrinking text caption.
                complete: function pop_down_scoot_done() {
                    iframe_resizer(pop_cont.$sup, function (resizer) {
                        resizer.close();
                        // NOTE:  Without close() the un-full window generates warnings on resizing.
                        //        Example:
                        //            iframeResizer.js:134
                        //            [iFrameSizer][Host page: popup_iframe_1834]
                        //            [Window resize] IFrame(popup_iframe_1834) not found
                        //        And probably maybe leaks memory.
                    });

                    cont.$sup.removeClass('pop-down');
                    // NOTE:  Unhide the original un-popped contribution

                    $('#popup-screen').remove();   // Removes contained popup contribution too.
                }
            });
        });
        console.assert(pop_conts.length <= 1, "MULTIPLE POP-UPS", pop_conts);

        if (talkify_player !== null) {
            console.log("DISPOSE", talkify_player.correlationId, "player");
            talkify_player.pause();
            talkify_player.dispose();   // close the player UX
            talkify_player = null;
        }
        if (talkify_playlist !== null) {
            console.log("dispose playlist");
            talkify_playlist.pause();   // stop the audio
            talkify_playlist.dispose();
            talkify_playlist = null;
        }
        if (talkify_done !== null) {
            talkify_done();
            talkify_done = null;
        }
        if (is_specified(talkify)) {
            talkify.messageHub.unsubscribe(BOT_CONTEXT, '*.player.tts.ended');
            talkify.messageHub.unsubscribe(BOT_CONTEXT, '*.player.tts.timeupdated');
            talkify.messageHub.unsubscribe(BOT_CONTEXT, '*');
        }
        if (utter !== null) {
            $(utter).off();   // Otherwise an 'end' event will come a split second later.
            utter = null;
            js_for_contribution.utter = utter;

            // NOTE:  .cancel() does lead eventually to our 'end' event handler being called.
            //        This can cause us to come back here.  So we're setting utter to null
            //        first thing, in case .cancel() EVER leads to a synchronous call
            //        to our 'end' event handler!  (Though it appears to be async now.)

            // window.speechSynthesis.pause();   No need for this, right?
            console.log("Aborting speech.");
            window.speechSynthesis.cancel();
            // CAUTION:  .cancel() then immediately .play() may not have worked at some point.
            //           https://stackoverflow.com/a/44042494/673991
            //           Though it seems to have been fixed in Chrome.
            if (speech_progress !== null && pop_cont !== null) {
                // NOTE:  No QUIT after END.
                interact.QUIT(pop_cont.idn_decimal, speech_progress);
            }
        }
        if (breather_timer !== null) {
            console.log("(breather cut short)");
            clearTimeout(breather_timer);
            breather_timer = null;
        }
    }

    function pop_up(cont, auto_play) {
        var cont_idn = cont.id_attribute;
        var popup_cont_idn = MONTY.POPUP_ID_PREFIX + cont_idn;
        // TODO:  Less misleading symbol name than popup_cont_idn.
        //        It's less of an idn than cont_idn, which at least is a decimal string of the qiki
        //        idn.  This thing e.g. "popup_1809" is the id attribute
        //        of the popup .contribution element.
        var popup_cont_selector = selector_from_id(popup_cont_idn);
        var was_already_popped_up = $(popup_cont_selector).length > 0;

        pop_down_all(false);
        if (was_already_popped_up) {
            console.log("Contribution", cont_idn, "is popping itself down by 2nd click.");
            // NOTE:  Avoid double-pop-up.  Just pop down, don't pop-up again.
            return null;
        }

        // var top_air = $('.sup-category-first').offset().top;
        var render_width = cont.$render_bar.width();
        var render_height = cont.$render_bar.height();
        var cont_css_width = cont.$cont.css('width');
        var cont_css_height = cont.$cont.css('height');
        var caption_css_width = cont.$caption_bar.css('width');
        var caption_css_height = cont.$caption_bar.css('height');
        var caption_css_background = cont.$caption_bar.css('background-color');
        var save_height = cont.$save_bar.height() || cont.$save_bar.find('.edit').height();
        var vertical_padding_in_css = px_from_em(0.3 + 0.3);

        console.assert(
            save_height > 0.0,
            cont_idn,
            save_height,
            cont.$save_bar.height(),
            cont.$save_bar.width(),
            cont.$save_bar.find('.edit').height(),
            cont.$save_bar.find('.expand').height(),
            cont.$save_bar.css('overflow')
        );
        // EXAMPLE:  Assertion failed: 1929 0 ... 16 16 hidden
        // EXAMPLE:  Assertion failed: 1851 0 0 202 16 16 hidden
        // NOTE:  Sometimes $save_bar.height() is zero.
        //        $save_bar is supposed to have enough .height() to contain its buttons,
        //        but it's sometimes zero (not always), even though its overflow:hidden and
        //        the button.full child has height.  (So does .unfull even though display none.)
        //        See https://stackoverflow.com/a/5369963/673991
        //        Working around it by reverting to the button height if the div height is zero.
        //        Clear-fix didn't work https://alistapart.com/article/css-floats-101/#section7
        //        Specifically, this code was in build_contribution_dom() below the buttons:
        //            $save_bar.append($('<div>', {style: 'clear: both;'}).html('&nbsp;'));
        //        Moving the .height() to before pop_down_all() didn't work.
        //        Adds to the impression I don't understand the problem.
        //        Along with the fact that $save_bar.height() is never zero from the console.
        //        Not even when the item is eclipsed by something else popped up.
        //        Both Chrome and Firefox have this problem,
        //        and both are fixed by the || .full work-around.
        //        Doesn't always happen.  I think it only happens when the bot is popping up
        //        item N+1 as it is about to pop down item N.  So never for item 1.
        //        Happens either for logged in users from their "my" category, and anon
        //        users from the "others" category.
        // TODO:  Try "Float Fix Float" http://complexspiral.com/publications/containing-floats/
        //        More tricks:  https://stackoverflow.com/a/5369963/673991

        var $popup = cont.$sup.clone();
        // TODO:  Why in the world was this .clone(false, true)??
        //        It seems to have worked; sup data wasn't cloned but cont data was.
        //        Anyway I don't think I need it.  Do I??

        $popup.find('[id]').attr('id', function () {
            return MONTY.POPUP_ID_PREFIX + $(this).attr('id');
        });
        // NOTE:  Prefix all id attributes in the clone elements, to avoid duplicate ids.

        $popup.find('.grip').removeClass('grip').addClass('grip-inoperative');
        // NOTE:  No dragging popped-up stuff.
        //        It was a little disconcerting not seeing the grip symbol there.
        //        So just disabling the feature and dimming the icon
        //        seemed the lesser UX crime.

        $popup.addClass('pop-up');
        cont.$sup.addClass('pop-down');
        $popup.data('popped-down', cont.$sup);

        var $popup_screen = $('<div>', {id: 'popup-screen'});
        $popup_screen.append($popup);
        cont.$sup.before($popup_screen);

        var pop_cont = Contribution_from_element($popup);

        var max_live_width = usable_width();
        var caption_height_px = cont.$caption_bar.outerHeight();
        // NOTE:  Wrapped thumbnail captions may result in less tall popups,
        //        because popped-up captions don't need to be wrapped.
        var max_live_height = Math.round(
            usable_height()
            - caption_height_px
            // - save_height   // Not this; we eliminated buttons below the pop-up.
            - vertical_padding_in_css
            - 30
        );
        // NOTE:  Extra 30-pixel reduction in height.
        //        Tends to prevent scrollbars from spontaneously appearing.
        //        Someday a less crude way would be good.

        $popup.data('pop-stuff', {
            render_width: render_width,
            render_height: render_height,
            cont_css_width: cont_css_width,
            cont_css_height: cont_css_height,
            caption_css_width: caption_css_width,
            caption_css_height: caption_css_height,
            caption_css_background: caption_css_background,
            max_live_width: max_live_width,
            max_live_height: max_live_height,
            fixed_coordinates: cont.fixed_coordinates()
        });

        $popup.css({
            position: 'fixed',
            'z-index': 1
        });
        $popup.css(cont.fixed_coordinates());
        // NOTE:  Start the popup right where the original thumbnail was on the screen, but with
        //        fixed coordinates.

        if (cont.is_media) {

            var img_src = pop_cont.$img_thumb.attr('src');
            if (is_defined(img_src)) {
                pop_cont.$render_bar.css({
                    'background-image': 'url(' + img_src + ')',
                    'background-position': 'center center',
                    'background-size': 'cover'
                });
                // NOTE:  This makes the thumbnail resemble the unplayed youtube video, at least
                //        today it seems to, and with lower resolution.
                // THANKS:  Scale background to cover element, without distorting aspect ratio,
                //          https://stackoverflow.com/a/7372377/673991
            }

            pop_cont.live_media_iframe({
                idn: pop_cont.id_attribute,
                url: pop_cont.media_url,
                is_pop_up: true,
                auto_play: auto_play.toString(),
                width:  max_live_width,
                height: max_live_height
            }, function media_iframe_loaded() {
                pop_cont.$render_bar.css({
                    'background-image': '',
                    'background-position': '',
                    'background-size': ''
                });
                // NOTE:  This removes unsightly background echo for some vimeo and flickr embeds.
                // THANKS:  Remove CSS style, https://stackoverflow.com/a/4036868/673991
            });
            // NOTE:  This is what overrides the thumbnail image cloned from the original
            //        .contribution element, and makes it live media (e.g. a video) in the pop-up.

            pop_cont.$iframe.width(render_width);
            pop_cont.$iframe.height(render_height);
            // NOTE:  Until embed_content.js gets up and sets the size of the iframe through the
            //        iFrameResizer, let it start off as the same size as the thumbnail.

            pop_cont.resizer_init(
                function pop_media_init() {
                    pop_cont.$sup.trigger(pop_cont.Event.MEDIA_INIT);

                    // NOTE:  Finally decided the best way to make the popup iframe big
                    //        was to focus on the inner CONTENTS size,
                    //        and let iFrameResizer handle the outer size.
                    // SEE:  Tricky iframe height 100%, https://stackoverflow.com/a/5871861/673991

                    deanimate("popping up media " + popup_cont_idn);
                    pop_cont.resizer_nudge();
                    pop_cont.zero_iframe_recover();
                    // NOTE:  A little extra help for pop-ups
                    //        with either a zero-iframe bug in iFrameResizer,
                    //        or a poor internet connection.

                    pop_screen_fade_in();
                }
            );
        } else {
            pop_cont.full_ish_screen_text(function () {
                if (auto_play) {
                    var pop_text = pop_cont.content;

                    utter = new window.SpeechSynthesisUtterance(pop_text);
                    js_for_contribution.utter = utter;
                    // THANKS:  SpeechSynthesis bug workaround from 2016,
                    //          https://stackoverflow.com/a/35935851/673991
                    // NOTE:  Not sure if this is the same bug, but sometimes speech was
                    //        not starting.

                    utter.rate = 0.75;

                    // Another attempt to fix text-not-speaking bug.

                    utter.pitch = 1.0;    // otherwise it's -1, wtf that means
                    // Another attempt to fix text-not-speaking bug.

                    switch ($('#play_bot_speech').val()) {
                    case PLAY_BOT_SPEECH_OUT_LOUD:
                        utter.volume = 1.0;   // otherwise it's -1, wtf that means
                        break;
                    case PLAY_BOT_SPEECH_ANIMATED:
                        utter.volume = 0.0;   // otherwise it's -1, wtf that means
                        break;
                    case PLAY_BOT_SPEECH_OFF:
                        utter.volume = 0.0;   // otherwise it's -1, wtf that means
                        break;
                    }

                    // utter.voice = chooseWeighted(voices, voice_weights);
                    // console.log("Voice", utter.voice.name, utter.voice.lang);
                    // NOTE:  (2019) Google voices don't report their word-boundary events.
                    //               Microsoft voices do, and they sound better too.
                    //        (2018) https://stackoverflow.com/a/48160824/673991
                    //        (2016) https://bugs.chromium.org/p/chromium/issues/detail?id=521666
                    //        Upshot is not to set voice at all.
                    //        Microsoft Anna is default in Chrome, Firefox, Opera, Edge.
                    //        Edge has many voices (9 English, 25 total).
                    //        Could instead multiplicatively weight Google voices 0, Microsoft 1.
                    //        Anyway, word boundaries are important because visual highlighting
                    //        of words seems more potent.  Combination visual and auditory.

                    var states_before = speech_states();

                    window.speechSynthesis.cancel();   // Another attempt to fix text-not-speaking bug.
                    // NOTE:  This cancel appears to be the trick that fixed it.

                    var states_between = speech_states();
                    window.speechSynthesis.speak(utter);
                    // NOTE:  Play audio even if not auto_play -- because there's no way
                    //        to start the speech otherwise.  (SpeechSynthesis has no
                    //        native control UX.)
                    // EXAMPLE:  Silent for UC Browser, Opera Mobile, IE11

                    var states_after = speech_states();

                    console.log(
                        "Language",
                        voice_default.name,
                        voice_default.lang,
                        utter.voice,   // null in Chrome
                        typeof utter.lang, utter.lang,   // string '' in Chrome
                        states_before,
                        "->",
                        states_between,
                        "->",
                        states_after
                    );
                    // NOTE:  Probe droid for occasional lack of speaking popup.
                    // EXAMPLE:  Microsoft Anna - English (United States) en-US
                    // EXAMPLE:  (unknown) (UC Browser -- onvoiceschanged never called)
                    //           window.speechSynthesis.getVoices() returns []
                    //           https://caniuse.com/#feat=speech-synthesis

                    $(utter).on('start end boundary error mark pause resume', function (evt) {
                        console.log(
                            "Utter",
                            evt.originalEvent.elapsedTime.toFixed(1),
                            evt.type,
                            evt.originalEvent.charIndex
                        );
                        // EXAMPLE:
                        //     Utter start 0 39.220001220703125
                        //     Utter boundary 0 158.97999572753906
                        //     Utter boundary 0 161.0850067138672
                        //     Utter boundary 5 359.07000732421875
                        //     Utter boundary 8 449.2300109863281
                        //     Utter boundary 13 759.3049926757812
                        //     Utter boundary 15 799.1599731445312
                        //     Utter end 0 1779.2449951171875
                        // EXAMPLE:
                        //                   Utter 21.7 start 0
                        //     14:53:02.834  Utter 116.9 boundary 0
                        //     14:53:02.837  Utter 119.9 boundary 0
                        //     14:53:02.935  Utter 217.1 boundary 3
                        //     14:53:03.185  Utter 467.1 boundary 7
                        //     14:53:03.293 Bot SPEECH_PLAYING 0 The text is being spoken
                        //     14:53:03.385  Utter 667.1 boundary 12
                        //     14:53:03.387  Utter 669.7 boundary 14
                        //     14:53:03.784  Utter 1067.0 boundary 25
                        //     14:53:03.984  Utter 1267.0 boundary 28
                        //     14:53:04.135  Utter 1417.0 boundary 32
                        //     14:53:04.293 Bot SPEECH_PLAYING 1 The text is being spoken
                        //     14:53:04.634  Utter 1917.0 boundary 41
                        //     14:53:04.935  Utter 2217.1 boundary 49
                        //     14:53:04.976 Pause player bot
                        //     14:53:04.980  Utter 2262.8 pause 0         <-- .004 second feedback
                        //     14:53:05.084  Utter 2366.9 boundary 52
                        //     14:53:05.287  Utter 2569.7 boundary 55
                        //     14:53:05.485  Utter 2767.1 boundary 61
                        //     14:53:05.685  Utter 2967.1 boundary 64
                        //     14:53:06.085  Utter 3367.3 boundary 70
                        //     14:53:12.081 Resume player bot
                        //     14:53:12.086  Utter 9368.3 resume 0
                        //     14:53:12.294 Bot SPEECH_PLAYING 2 The text is being spoken
                        //     14:53:13.162  Utter 10444.1 end 0
                        //     14:53:13.162
                    });
                    var $svg = null;
                    $(utter).on('start', function speech_boundary(evt) {
                        pop_cont.$sup.trigger(pop_cont.Event.SPEECH_START);
                        interact.START(cont_idn, evt.originalEvent.charIndex);
                        speech_progress = 0;
                    });
                    $(utter).on('pause', function speech_pause() {
                        interact.PAUSE(cont_idn, speech_progress);
                    });
                    $(utter).on('resume', function speech_resume() {
                        interact.RESUME(cont_idn, speech_progress);
                        // NOTE:  Resume can be 2-4 words later than pause!
                        //        This is the "speechSynthesis pause delay" issue.
                    });
                    $(utter).on('boundary', function speech_boundary(evt) {
                        // TODO:  Hold off HERE if pause is happening.
                        //        This would avoid highlighting the NEXT word.
                        //        Besides the wrong word, the animation appears unresponsive to
                        //        the pause command, stubbornly pushing on ahead.
                        //        (It already butts ahead 2 words anyway.)
                        var start_word = evt.originalEvent.charIndex;
                        // NOTE:  We don't seem to need to adjust start_word to the left
                        //        to get to a word-boundary.  That's what's done in
                        //        https://stackoverflow.com/a/50285928/673991
                        //        If we did, it might look like this:
                        //        left = str.slice(0, pos + 1).search(/\S+$/)
                        var word_to_end = pop_text.slice(start_word);
                        var len_word = word_to_end.search(/\s|$/);
                        var end_word = start_word + len_word;
                        var the_word = pop_text.slice(start_word, end_word+1);
                        var range_word = window.document.createRange();
                        pop_cont.$cont.text(pop_text);
                        var text_node = pop_cont.$cont[0].childNodes[0];
                        console.assert(text_node.nodeName === '#text', text_node, pop_cont);
                        range_word.setStart(text_node, start_word);
                        range_word.setEnd(text_node, end_word);
                        // THANKS:  Range of text, https://stackoverflow.com/a/29903556/673991
                        var speaking_node = $('<span>', {class:'speaking'})[0];
                        range_word.surroundContents(speaking_node);
                        // THANKS:  Range wrap, https://stackoverflow.com/a/6328906/673991
                        speech_progress = end_word;
                        scroll_into_view(speaking_node, {
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                        // SEE:  Highlight speech, https://stackoverflow.com/a/38122794/673991
                        // SEE:  Select speech, https://stackoverflow.com/a/50285928/673991


                        if (EXPERIMENTAL_RED_WORD_READING) {
                            // NOTE:  The following experimental code would render the word being
                            //        spoken, in red, on top of the same word in the paragraph.
                            var r = range_word.getBoundingClientRect();
                            console.log("Bound", the_word, r.x, r.y);
                            if ($svg !== null) {
                                $svg.remove();
                            }
                            var svg_top = r.top - $popup.position().top;
                            var svg_left = r.left - $popup.position().left;
                            $svg = $('<svg>', {
                                height: r.height,
                                width: r.width,
                                style: (
                                    'position:absolute;color:red;font: 16px Literata,serif;' +
                                    'top:'+svg_top.toString()+'px;' +
                                    'left:'+svg_left.toString()+'px;'
                                )
                            }).append($('<text>', {fill:'red !important'}).append(the_word));
                            $popup.append($svg);
                            // TODO:  Needs to scroll word into view,
                            //        and then also position the svg right onto the scrolled word.
                        }
                    });
                    $(utter).on('end', function (evt) {
                        pop_cont.$cont.text(pop_text);
                        if (utter === null) {
                            console.error(
                                "Utterance interruptus (vestigial end after aborted speech)",
                                (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec"
                            );
                            // TODO:  Make a better scheme for detecting a stale utter event.
                            //        Because a NEW bot play cycle might otherwise be
                            //        transitioned prematurely.
                            //        Did the $(utter).off() in pop_down_all() solve this issue?
                            interact.QUIT(cont_idn, speech_progress);
                        } else {
                            console.log(
                                "Utterance",
                                (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec,",
                                speech_progress, "of", pop_text.length, "chars"
                            );
                            pop_cont.$sup.trigger(pop_cont.Event.SPEECH_END);
                            // NOTE:  A bit lame, this happens whether manually popped up or
                            //        automatically played by the bot.  But it should have
                            //        no consequence manually anyway.
                            interact.END(cont_idn, pop_text.length);
                        }
                        speech_progress = null;
                        // NOTE:  Setting speech_progress to null here
                        //        prevents MONTY.INTERACTION.QUIT interaction after END
                    });
                    pop_cont.$sup.trigger(pop_cont.Event.SPEECH_PLAY);
                    return;



                    // NOTE:  The following code worked with the Talkify service.
                    //        Which I recall was more legible than the Chrome browser speech,
                    //        (though less so than the Edge browser speech), and is reasonably
                    //        priced, but any metering of an uber free service is vexing.



                    // noinspection UnreachableCodeJS
                    if (is_specified(talkify)) {
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

                        // noinspection JSUnusedAssignment
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

                        var this_player = talkify_player;
                        // NOTE:  Local "copy" of player needed in case pop_down_all() happens
                        //        before the callback below has fully popped up.

                        talkify.messageHub.subscribe(BOT_CONTEXT, '*', function (message, topic) {
                            // var members = message ? Object.keys(message).join() : "(no message)";
                            console.debug("talkify", topic/*, members*/);
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
                                    this_player.pause();
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
                                // $highlight.each(function () {
                                //     scroll_into_view(this, {
                                //         behavior: 'smooth',
                                //         block: 'center',
                                //         inline: 'center'
                                //     });
                                // });
                                // TODO:  Does this work without .each()?
                                scroll_into_view($highlight, {
                                    behavior: 'smooth',
                                    block: 'center',
                                    inline: 'center'
                                });
                                // TODO:  Reduce frequency of this call by tagging element
                                //        with .already-scrolled-into-view?
                                //        Because this event happens 20Hz!
                                duration_report = message.duration.toFixed(1) + " seconds";
                            }
                        );
                        talkify.messageHub.subscribe(
                            BOT_CONTEXT,
                            '*.player.tts.ended',
                            function (/*message, topic*/) {
                                pop_cont.$sup.trigger(pop_cont.Event.SPEECH_END);
                                // console.log("talkify ended", popup_cont_idn, message, topic);
                                // EXAMPLE:  topic
                                //     23b92641-e7dc-46af-9f9b-cbed4de70fe4.player.tts.ended
                                // EXAMPLE:  message object members:
                                //     element: div#popup_1024.contribution.talkify-highlight
                                //     isLoading: false
                                //     isPlaying: false
                                //     originalElement: div#popup_1024.contribution
                                //     preview: "this is just a test"
                                //     text: "this is just a te
                                //     st"
                            }
                        );
                        talkify_done = function () {
                            console.log(
                                "talkify", popup_cont_idn,
                                "voice", talkify_voice_name,
                                duration_report
                            );
                        };
                        // noinspection JSUnusedAssignment
                        pop_cont.$sup.trigger(pop_cont.Event.SPEECH_PLAY);
                    }
                }
            });
        }
        console.log("Popup", cont_idn, cont.media_domain || "(quote)");
        return pop_cont;
    }

    /**
     * Finish up all animations.
     *
     * @param {string} what - some context for the warnings.
     */
    function deanimate(what) {
        $(':animated').each(function () {
            var $element = $(this);
            var deanimating_cont = Contribution_from_element($element);
            if (deanimating_cont.exists()) {
                console.warn(
                    "Deanimating before",
                    what,
                    deanimating_cont.id_attribute,
                    $element.attr('class') || "(no classes)"
                );
            } else {
                console.warn(
                    "Deanimating before",
                    what,
                    "SOME ELEMENT",
                    $element
                );
            }
            $element.finish();
        });
    }

    /**
     * Animated pop-up of a text quote.
     *
     * @param {function} then - callback when done.
     */
    Contribution.prototype.full_ish_screen_text = function Contribution_full_ish_screen_text(then) {
        var that = this;

        var cont_css_width = that.$cont.css('width');
        var cont_css_height = that.$cont.css('height');

        that.$sup.css('left', 0);
        that.$sup.css('top', 0);   // give the text some room from the harsh right and bottom edges
        that.$cont.width('auto');
        that.$cont.height('auto');   // let the text's freak flag flow

        var sup_natural_width = that.$sup.width()
        var sup_natural_height = that.$sup.height();
        var cont_natural_width = that.$cont.width();

        var does_man_spread = sup_natural_width > (usable_width() * 0.95);
        // NOTE:  Does the content take up all the width we gave it?

        var is_poetry = any_lone_newlines(that.content) && ! does_man_spread;
        // NOTE:  If it doesn't man-spread, it still might not be poetry,
        //        it might be really short prose.
        //        Huh, double-spaced poetry will be considered prose.
        //        And so might be slightly more likely to wrap, trying to match the aspect ratio,
        //        and get a bigger font.



        //// Horizontal - determine left and width properties

        var sup_chrome_h = that.$sup.innerWidth() - that.$cont.width();
        var SUP_PAD_LEFT = px_from_em(0.5);   // SEE:  contribution.css
        var ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP = 10;
        var cont_width_value = Math.min(
            cont_natural_width + ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP,
            usable_width() - sup_chrome_h
        );
        var sup_left = (usable_width() - cont_width_value - sup_chrome_h)/2 + SUP_PAD_LEFT;
        var cont_width_setting;
        if (is_poetry) {
            cont_width_setting = 'auto';
        } else {
            cont_width_setting = cont_width_value;

            // NOTE:  Now see if we can match the prose's aspect ratio to the window's.

            var width_portion = cont_width_value / usable_width();
            var height_portion = sup_natural_height / usable_height();
            var cont_fatter_than_window = width_portion / height_portion;   // fatter > 1, thinner < 1
            if (cont_fatter_than_window > 1.2) {

                // NOTE:  Is the contribution's aspect ratio more than 20% wider than the window's?
                //        If contribution fills window width AND height
                //        (or more than the height, so it scrolls), we'll never get here,
                //        because cont_fatter_than_window will have been about 1 (or less than 1).

                var excess_width = Math.sqrt(cont_fatter_than_window);
                // NOTE:  If contribution is 4 times as fat as the window, we want to make the
                //        contribution 1/2 as wide.  Which will make it about 2 times as tall.
                //        (Could a lot of small paragraphs introduce TOO MUCH height and
                //        thus require scrolling here?  Hope not!)

                // TODO:  Run this aspect adjustment more than once?  Might help with text that
                //        doesn't wrap enough, so height doesn't expand as much as width shrunk.
                //        Without doing this, here's the problem:
                //        The EXPANDED popup (with the larger font) takes up the full width
                //        but only a fraction of the height of the window, e.g. half.

                var cont_width_value_new = cont_width_value / excess_width;
                if (cont_width_value_new < px_from_em(WIDTH_MAX_EM.soft)) {
                    cont_width_value_new = px_from_em(WIDTH_MAX_EM.soft);   // not too skinny
                }
                if (cont_width_value_new < cont_width_value) {

                    // NOTE:  This if-test prevents VERY tiny contributions from being made
                    //        WIDER than they would have been.
                    //        Because we only want this step to SHRINK width.

                    sup_left += (cont_width_value - cont_width_value_new)/2;
                    cont_width_value = cont_width_value_new;
                    cont_width_setting = cont_width_value;
                }
            }
        }
        that.$sup.css('left', sup_left);   // set left BEFORE width, avoiding right-edge wrap
        that.$cont.width(cont_width_setting);
        that.fix_caption_width();



        //// Vertical - determine top and height properties

        that.$cont.height('auto');

        var sup_height = that.$sup.height();
        var sup_chrome_v = that.$sup.innerHeight() - that.$cont.height();
        var sup_top;
        var cont_height_setting;
        if (sup_height <= usable_height()) {
            sup_top = (TOP_SPACER_PX + $(window).height() - sup_height)/2;
            cont_height_setting = 'auto';
        } else {
            sup_top = TOP_SPACER_PX;
            cont_height_setting = usable_height() - sup_chrome_v;
        }

        that.$sup.css('top', sup_top);
        that.$cont.height(cont_height_setting);



        //// Font - can we make this bigger?

        var expandable_h = usable_width() / that.$sup.innerWidth();
        var expandable_v = usable_height() / that.$sup.innerHeight();
        var expandable = Math.min(expandable_h, expandable_v);
        var expand_font = null;

        var font_size_setting;
        var font_size_normal = px_from_em(1);
        // NOTE:  Animating to or from 'inherit' doesn't seem to work.

        if (expandable > 1.1) {
            // NOTE:  Don't fiddle with a middling expansion.

            var MAX_FONT_EXPANSION = 3.0;
            expand_font = Math.min(expandable, MAX_FONT_EXPANSION);

            var sup_width_before = that.$sup.width();
            var sup_height_before = that.$sup.height();

            that.$sup.css('left', 0);   // prepare to grow font without right-edge wrap
            that.$sup.css('top', 0);
            // NOTE:  Temporarily scoot to upper left corner, so an enlarged contribution
            //        with auto width doesn't cause wrapping against right edge.
            //        Or, I guess, scrolling against the bottom, or something.
            //        Not sure it matters if top is set to 0 actually.

            font_size_setting = expand_font.toFixed(2) + 'rem';
            that.$cont.css('font-size', font_size_setting);

            if (typeof cont_width_setting === 'number') {
                cont_width_setting *= expand_font;
                that.$cont.width(cont_width_setting);
            }
            that.fix_caption_width();

            // NOTE:  No cont_height_setting expansion needed, because if it's numeric, i.e. not
            //        'auto', then the text is height-limited, and we're scrolling, and we hate
            //        that, so we sure haven't expanded the font at all.

            var sup_width_after = that.$sup.width();
            var sup_height_after = that.$sup.height();

            sup_left -= (sup_width_after - sup_width_before) / 2;
            sup_top -= (sup_height_after - sup_height_before) / 2;
            that.$sup.css('left', sup_left);
            that.$sup.css('top', sup_top);
        } else {
            font_size_setting = font_size_normal;
        }



        // console.log(
        //     "Text pop up",
        //     sup_left, sup_top, sup_height,
        //     is_poetry ? "POEM" : "prose",
        //     expand_font,
        //     "\n",
        //     cont_css_width, cont_css_height,
        //     cont_width_setting, cont_height_setting,
        //     usable_width(), usable_height(),
        //     sup_chrome_h, sup_chrome_v,
        //     expandable_h, expandable_v,
        //     type_name(cont_width_setting), type_name(cont_height_setting),
        //     "\n",
        //     that.$sup.css('left'),
        //     that.$sup.css('top'),
        //     that.$cont.css('width'),
        //     that.$cont.css('height'),
        //     that.$caption_bar.css('width')
        // );
        // EXAMPLE:  Text pop up 10.760767208223115 87.73450000000003 460.781 prose 1.3039538714991763
        //           192px 80px 1538.6766070994775 auto 1583 741 34 50.39300000000003 1.3039538714991763 1.5753187309861578 Number String
        //           10.7608px 87.7345px 1561.47px 593.938px 1545.48px



        //// Animate

        deanimate("popping up quote " + that.id_attribute);

        var cont = Contribution(that.idn_decimal);

        // NOTE:  Popup text elements are now are at their FINAL place and size.
        //        But nobody has seen that yet.
        //        Get stats on them before reverting everything to its STARTING place and size,
        //        for the animation.

        var pop_cont_css_width = that.$cont.css('width');
        var pop_cont_css_height = that.$cont.css('height');
        var pop_caption_css_width = that.$caption_bar.css('width');
        var pop_up_caption_background = that.$caption_bar.css('background-color');
        var pop_down_caption_background = cont.$caption_bar.css('background-color');

        that.$cont.css('width', cont_css_width);
        that.$cont.css('height', cont_css_height);
        // NOTE:  jQuery animation seems to need the STARTING point to be set via .css(),
        //        not .width() and .height()

        that.fix_caption_width();
        that.$caption_bar.css('background-color', pop_down_caption_background);
        that.$sup.css(cont.fixed_coordinates());
        that.$cont.css('font-size', font_size_normal);

        var sup_promise = that.$sup.animate({
            top: sup_top,
            left: sup_left
        }, {
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false
        }).promise();

        var cont_promise = that.$cont.animate({
            width: pop_cont_css_width,
            height: pop_cont_css_height,
            'font-size': font_size_setting
        }, {
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false,
            complete: function popup_text_contribution_complete() {
                that.$cont.width(cont_width_setting);
                that.$cont.height(cont_height_setting);
            }
        }).promise();

        var caption_promise = that.$caption_bar.animate({
            width: pop_caption_css_width,
            'background-color': pop_up_caption_background
        }, {
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false,
            complete: function popup_text_caption_complete() {
                that.fix_caption_width();
            }
        }).promise();

        var screen_promise = pop_screen_fade_in().promise();

        var combined_promise = $.when(
            sup_promise,
            cont_promise,
            caption_promise,
            screen_promise
        );
        combined_promise.done(function popup_animation_done() {
            then();
        });
    };

    function pop_screen_fade_out() {
        return pop_screen_fade('rgba(0,0,0,0.25)', 'rgba(0,0,0,0)')
    }

    function pop_screen_fade_in() {
        return pop_screen_fade('rgba(0,0,0,0)', 'rgba(0,0,0,0.25)')
    }

    function pop_screen_fade(from_color, to_color) {
        var $pop_screen = $('#popup-screen');
        $pop_screen.css({'background-color': from_color});
        $pop_screen.animate({
            'background-color': to_color
        }, {
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false
        });
        return $pop_screen;
    }

    function usable_width() {
        return Math.min(
            $(window).width(),
            $(window.document.body).width()
            // NOTE:  Body might be wider than window if horizontal scrollbar is active.
        );
    }

    function usable_height() {
        return $(window).height() - TOP_SPACER_PX;
    }

    function speech_states() {
        return (
            (window.speechSynthesis.speaking ? "s+" : "s-") +
            (window.speechSynthesis.pending  ? "p+" : "p-")
        );
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
                        document.documentElement.scrollTop:window.document.body.scrollTop;
        var scrollLeft = document.documentElement.scrollLeft?
                        document.documentElement.scrollLeft:window.document.body.scrollLeft;
        var elementLeft = rect.left+scrollLeft;
        var elementTop = rect.top+scrollTop;

        var x = evt.pageX-elementLeft;
        var y = evt.pageY-elementTop;
        return {x:x, y:y};
    }

    function contribution_edit_begin($cont) {
        if ( ! check_contribution_edit_dirty(true, true)) {
            // NOTE:  The above call may never have any side effects (and this branch is always
            //        taken) because all edit buttons are invisible whenever an edit is in progress.
            //        That invisibility hinges on the .dirty-nowhere selector in contribution.css.
            contribution_edit_show($cont);
            is_editing_some_contribution = true;
            $cont.data('original_text', $cont.text());
            var $caption_span = $cont.closest('.sup-contribution').find('.caption-span');
            $caption_span.data('original_text', $caption_span.text());
            $cont_editing = $cont;
        }
    }

    function contribution_edit_end() {   // save, cancel, discard
        if (is_editing_some_contribution) {
            is_editing_some_contribution = false;
            $('.edit-dirty').removeClass('edit-dirty');
            $(window.document.body).addClass('dirty-nowhere');
            contribution_edit_hide($cont_editing);
            var $caption_span = $cont_editing.closest('.sup-contribution').find('.caption-span');
            $cont_editing.removeData('original_text');
            $caption_span.removeData('original_text');

            var cont = Contribution_from_element($cont_editing);
            cont.resizer_nudge();
            cont.zero_iframe_recover();
            // NOTE:  A crude response to the occasional zero-height or zero-width contribution
            //        lurking inside an as-yet unopened category.

            $cont_editing = null;
        }
    }

    function contribution_edit_show($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.addClass('contribution-edit');
        $cont.prop('contentEditable', true);
        $caption_span.prop('contentEditable', true);
        var cont = Contribution_from_element($cont);
        cont.fix_caption_width();
    }

    function contribution_edit_hide($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.removeClass('contribution-edit');
        $cont.prop('contentEditable', false);
        $caption_span.prop('contentEditable', false);
        var $save_bar = $save_bar_from_cont($cont);
        $save_bar.removeClass('abandon-alert');
        var cont = Contribution_from_element($cont);
        cont.fix_caption_width();
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
                get_oembed("paste", pasted_text, function (oembed) {
                    var $enter_some_text = $('#enter_some_text');
                    var $enter_a_caption = $('#enter_a_caption');
                    var is_new_text = (
                        $enter_some_text.val().length === 0 ||    // was blank (is blank?? remove this?)
                        $enter_some_text.val() === pasted_text    // must have pasted over all
                    );
                    var is_blank_caption = $enter_a_caption.val().length === 0;
                    if (is_new_text && is_blank_caption) {
                        $enter_a_caption.val(oembed.caption_for_media);
                        // NOTE:  Insert a caption when it was blank, and
                        //        the text is completely overwritten by the pasted url.
                        //        Unlike drop, pasting a URL into the caption does nothing special.
                        //        The thinking is, paste is more surgical than drop,
                        //        so take the user a little more literally.
                        // TODO:  Also overwrite a semi-dirty caption, that is,
                        //        the automated result of a previous paste or drop.
                    }
                });
                duplicate_check(pasted_text);
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
                        //          https://developer.mozilla.org/Web/API/DataTransferItemList/DataTransferItem#Example_Drag_and_Drop
                        // TODO:  Drop anything, https://developer.mozilla.org/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types
                        // SEE:  Drop link, https://stackoverflow.com/q/11124320/673991
                        if (
                            item.kind === 'string' &&
                            item.type === 'text/plain'
                        ) {
                            item.getAsString(function (might_be_url) {
                                console.assert(is_string(might_be_url));
                                get_oembed(
                                    "drop",
                                    might_be_url,
                                    function (oembed) {
                                        var $enter_some_text = $('#enter_some_text');
                                        var $enter_a_caption = $('#enter_a_caption');
                                        $enter_some_text.val(might_be_url);
                                        $enter_a_caption.val(oembed.caption_for_media);
                                        // TODO:  Avoid dropping new text/caption when they're dirty.
                                        //        But do overwrite semi-dirty,
                                        //        that is already the result of earlier URL drop/paste.
                                    }
                                );
                                duplicate_check(might_be_url);
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

    /**
     * Has this URL been contributed already?  Something to check on paste or drop.
     *
     * @param contribution_text - if it's a media url, check if it's been contributed already.
     *                            Because I kept finding duplicates.
     */
    function duplicate_check(contribution_text) {
        if (can_i_get_meta_about_it(contribution_text)) {
            var duplicate_id = null;
            Contribution_loop(function (cont) {
                // TODO:  Instead, pass a category filter to Contribution_loop() for my-category.
                if (cont.content === contribution_text && cont.is_my_category) {
                    duplicate_id = cont.id_attribute;
                    return false;
                }
            });
            if (duplicate_id === null) {
                entry_feedback();
            } else {
                entry_feedback("(possible duplicate)").data('duplicate_url', contribution_text);
                // ,
                // $('<a>', {href: "#" + duplicate_id}).text("Scroll to it.")
                // TODO:  This link is seductively simple, but it's busted.  Maybe someday, but:
                //        1. The .contribution element is display:none for media.
                //           Anchor links won't budge for invisible elements.
                //        2. The duplicate contribution may be inside a closed category.
                //           (Or in the trash, in which case it's not a duplicate.
                //           Whoa that has to be fixed now!  Done.)
                //           Furthermore, a duplicate
                //           from "other" or "anon" categories should be handled differently,
                //           e.g. "GMTA!  John Doe already contributed that. Move it here?"
                //           And one day if there are user-defined categories those will be
                //           weird cases too.  We may WANT a duplicate.
                //           Or maybe there shouldn't be user categories ever, just tags
                //           (i.e. qoolbar verbs) and the pseudo-categories that implies.
                //        3. Merely scrolling to it is not much help.  It should be haloed,
                //           ala Stack Overflow's fading orange background indication.
                //        4. A similar but not identical URL won't be detected.
                //           e.g. youtube.com vs youtu.be
                //           e.g. query string variables, such as t, feature
                //        5. (swore there was another reason)
                console.log("Possible duplicate", duplicate_id, "'" + contribution_text + "'");
            }
        }
    }

    /**
     * Pasted or dropped contribution.
     *
     * @param what - 'paste' or 'drop' or 'thumb'
     * @param media_url - that was pasted or dropped - POSSIBLY a URL.
     * @param {function} oembed_handler - passed the oembed associative array, augmented with:
     *                                    .caption_for_media = caption or author or error message
     * @return {boolean} - true means we should eventually get a callback
     *                          Except it will return true and not call back if the post fails.
     */
    function get_oembed(what, media_url, oembed_handler) {
        if (can_i_get_meta_about_it(media_url)) {
            /**
             * @param oembed_response
             * @param oembed_response.oembed
             * @param oembed_response.oembed.author_name
             * @param oembed_response.oembed.error
             * @param oembed_response.oembed.title
             * @param oembed_response.oembed.url
             */
            qoolbar.post('noembed_meta', {
                url: media_url
            }, function (oembed_response) {
                var oembed_object = oembed_response.oembed;
                var is_title_a_copy_of_url = oembed_object.title === oembed_object.url;
                // NOTE:  Twitter does this, title same as url, WTF?!?
                //        https://twitter.com/ICRC/status/799571646331912192
                //        possibly because Twitter titles contain the tweet, so can be long.
                //        but in that case author_name === 'ICRC'
                //        Another example from facebook:
                //        https://www.facebook.com/priscila.s.iwama/videos/10204886348423453/
                var is_error_usable = is_laden(oembed_object.error);
                var is_title_usable = is_laden(oembed_object.title) && ! is_title_a_copy_of_url;
                var is_author_usable = is_laden(oembed_object.author_name);
                if (is_error_usable) {
                    console.warn("Not an oembed URL", what, media_url, oembed_object.error);
                    oembed_object.caption_for_media = "(" + oembed_object.error + ")";
                } else if (is_title_usable) {
                    oembed_object.caption_for_media = oembed_object.title;
                } else if (is_author_usable) {
                    oembed_object.caption_for_media = oembed_object.author_name;
                } else {
                    oembed_object.caption_for_media = "(neither title nor author)";
                }
                var limited_caption = oembed_object.caption_for_media.substr(0, MAX_CAPTION_LENGTH);
                oembed_object.caption_for_media = limited_caption;
                oembed_handler(oembed_object);
            });
            // NOTE:  The following anti-bubbling, anti-propagation code
            //        COULD have been here, but it probably never does anything.
            //            evt.preventDefault();
            //            evt.stopPropagation();
            //            return false;
            //        I'm not the only one who thinks this is bull puppy (that it does nothing):
            //        https://opensourcehacker.com/2011/11/11/cancelling
            //        -html5-drag-and-drop-events-in-web-browsers/
            //        Hint:  you have to cancel dragover / dragenter
            // SEE:  Valid drop target
            //       https://developer.mozilla.org/Web/API/HTML_Drag_and_Drop_API/Drag_operations#drop
            //       https://stackoverflow.com/q/8414154/673991
            return true;
        } else {
            console.log("Incoming non-URL", what, media_url);
            return false;
        }
    }

    /**
     * Put elements in the #entry_feedback span.
     *
     * Or call with no arguments to empty the feedback span.
     *
     * @return {string|jQuery|HTMLElement}
     */
    function entry_feedback(/* element, element, ... */) {
        var $feedback = $('#entry_feedback');
        $feedback.empty();
        looper(arguments, function (_, argument) {
            $feedback.append(argument);
        });
        return $feedback;
    }

    function maybe_cancel_feedback() {
        var $feedback = $('#entry_feedback');
        var duplicate_url = $feedback.data('duplicate_url');
        if (is_specified(duplicate_url)) {
            var $enter_some_text = $('#enter_some_text');
            if (duplicate_url === $enter_some_text.val()) {
                console.log("(persisting duplicate condition)", duplicate_url);
            } else {
                console.log("Cancel duplicate feedback", duplicate_url, $enter_some_text.val());
                entry_feedback();
                $feedback.removeData('duplicate_url');
            }
        }
    }

    function sortable_module_options() {
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
                    if ( ! is_admin(MONTY.me_idn)) {
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
                if (is_in_popup(evt.related)) {
                    console.warn("Whoa there, don't drag me bro.");
                    return MOVE_CANCEL;
                }
                var $introductory_blurb = $('#introductory-blurb');
                $('#top-right-blurb').empty().append($introductory_blurb);
                // TODO:  Be nice to animate this relocation of the blurb.  Not trivial:
                //        https://stackoverflow.com/a/5212193/673991
                //        Hint, animate a clone that's in neither place.
                // NOTE:  Moves blurb to top right if we only ATTEMPT to drag a contribution to
                //        the empty 'my' category.  If we don't drop it, and 'my' remains empty,
                //        the blurb stays in the top right until reloading the page.  No biggie.
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
                    console.log("(put back where it came from)");
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
                        console.warn("Revert to before", first_word($from_neighbor.text()));
                        $from_neighbor.before($movee);
                    } else {
                        console.warn("Revert to end of category", from_cat_idn);
                        $from_cat.append($movee);
                    }
                }
            }
        };
    }

    function contributions_becoming_visible_for_the_first_time_maybe() {
        initialize_contribution_sizes();
        // resizer_nudge('.render-bar iframe');
        resizer_nudge_all();
    }

    function new_contribution_just_created() {
        initialize_contribution_sizes();
    }
    function initialize_contribution_sizes() {
        $('.size-adjust-once:visible').each(function () {
            var $element = $(this);
            $element.removeClass('size-adjust-once');
            size_adjust($element, WIDTH_MAX_EM, HEIGHT_MAX_EM);
            var cont = Contribution_from_element($element);
            cont.fix_caption_width('quote size adjust');
        });
    }
    function resizer_nudge_all() {
        $('.sup-contribution').each(function () {
            var cont = Contribution_from_element(this);
            cont.resizer_nudge();
            cont.zero_iframe_recover();
            // NOTE:  Reload any zero-width or zero-height iframe, a workaround for an
            //        apparent bug in iFrameResizer.  Or just bad internet.
        });
    }
    function size_adjust($element, width_max_em, height_max_em) {
        var width_em = size_adjust_each($element, 'width', width_max_em);
        // NOTE:  Width before height so paragraphs can wrap.
        var height_em = size_adjust_each($element, 'height', height_max_em);
        return {
            width_em: width_em,
            height_em: height_em
        };
    }
    function size_adjust_each($element, dimension, max_em) {
        $element[dimension]('auto');
        // var scroll_dimension = {
        //     // width: 'scrollWidth',   // NOTE:  This number is HUGE for unwrapped paragraphs.
        //     width: 'width',
        //     height: 'scrollHeight'
        // }[dimension];
        var natural_px = $element[dimension]();
        // if (dimension === 'height') natural_px = $element.get(0).scrollHeight;
        // console.log("Size", $element.attr('id'), dimension, natural_px);
        var natural_em = em_from_px(natural_px, $element);
        var adjusted_em;
        if (natural_em <= max_em.hard) {
            adjusted_em = null;
            if (DEBUG_SIZE_ADJUST) console.debug (
                "Easy", dimension, first_word($element.text()),
                natural_em.toFixed(0)
            );
        } else if (natural_em < max_em.extreme) {
            adjusted_em = max_em.hard;
            if (DEBUG_SIZE_ADJUST) console.debug(
                "Hard", dimension, first_word($element.text()),
                adjusted_em.toFixed(0), "<-", natural_em.toFixed(0)
            );
        } else {
            adjusted_em = max_em.soft;
            if (DEBUG_SIZE_ADJUST) console.debug(
                "Soft", dimension, first_word($element.text()),
                adjusted_em.toFixed(0), "<=", natural_em.toFixed(0)
            );
        }
        if (adjusted_em !== null) {
            // var adjusted_px = px_from_em(adjusted_em, $element);
            // $element[dimension](adjusted_px);
            set_em($element, dimension, adjusted_em);
        }
        return adjusted_em || natural_em;
    }

    function set_em($element, dimension, em) {
        var property = {};
        property[dimension] = em.toFixed(2) + 'rem';
        $element.css(property);
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

    function is_in_popup(element) {
        return $(element).closest('.pop-up').length > 0;
    }

    function is_in_about(element) {
        return $cat_of(element).attr('id') === MONTY.IDN.CAT_ABOUT.toString();
    }

    function is_in_anon(element) {
        return $cat_of(element).attr('id') === MONTY.IDN.CAT_ANON.toString();
    }

    function play_bot_speech_change() {
        var do_animate_speech = $('#play_bot_speech').val() !== PLAY_BOT_SPEECH_OFF;
        $(window.document.body).toggleClass('text-animate', do_animate_speech);
    }

    /**
     * Should the post-it button be disabled (can't submit)?  Or red (submit hint)?
     */
    function post_it_button_appearance() {
        var is_empty_text = $('#enter_some_text').val().length === 0;
        var is_empty_caption = $('#enter_a_caption').val().length === 0;
        if (is_empty_text) {
            $('#post_it_button').attr('disabled', 'disabled');
        } else {
            $('#post_it_button').removeAttr('disabled');
        }
        if (is_empty_text && is_empty_caption) {
            $('#post_it_button').removeClass('abandon-alert');
        }
        // NOTE:  Non-empty caption with an empty text-area is a weird edge case.
        //        Post-it button is disabled, so you can't post it,
        //        but neither can you close the page without confirmation.
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

            function failed_post(message) {
                post_it_button_appearance();
                $('#post_it_button')
                    .addClass('failed-post')
                    .attr('title', "Post failed: " + message)
                ;
            }

            function benefit_of_the_doubt_post() {
                $('#post_it_button')
                    .removeClass('failed-post')
                    .removeAttr('title')
                ;
            }

            benefit_of_the_doubt_post();

            qoolbar.sentence(
                {
                    vrb_idn: MONTY.IDN.CONTRIBUTE,
                    obj_idn: MONTY.IDN.QUOTE,
                    txt: text
                },
                function post_it_done_1(contribute_word) {
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
                    qoolbar.sentence(
                    caption_sentence,
                        function post_it_done_2(caption_word) {
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
                            // NOTE:  Now for the first time ever, a new contribution is in the DOM
                            //        and now the Contribution constructor could be called.
                            $text.val("");
                            $caption_input.val("");
                            post_it_button_appearance();
                            rebuild_a_render_bar($sup_cont);
                            settle_down();
                            setTimeout(function () {  // Give rendering some airtime.
                                new_contribution_just_created();
                            });
                        },
                        failed_post
                    );
                },
                failed_post
            );
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
    var aa = {};
    safe_prepend(aa, 'a', 99);   assert_json('{"a":[99]}', aa);
    safe_prepend(aa, 'a', 98);   assert_json('{"a":[98,99]}', aa);
    safe_prepend(aa, 'a', 97);   assert_json('{"a":[97,98,99]}', aa);

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
        // FIXME:  This obliterates all <script> elements.
        //         They seem to continue to run fine on Win/Chrome.
        //         Including jQuery and MONTY and THIS contribution.js script and a bunch of others!
        //         But is that a problem for some other browser??
        //         Should we instead empty and append a div within body?
        //         Or put the js in the header?
        //         What good is it in the body if the page is all JavaScript generated?

        $(window.document.body).addClass('dirty-nowhere');

        // var $up_top_spacer = $('<div>', {id: 'up-top-spacer'});
        // // NOTE:  #up-top-spacer is a position:static element that takes one for the "team" of other
        // //        position:static elements (which begin with .sup-category-first).
        // //        It is hidden under the position:fixed #up-top element, so the "team" is not.
        var $up_top = $('<div>', {id: 'up-top'});
        // $(window.document.body).append($up_top_spacer);
        $(window.document.body).append($up_top);

        var $status_prompt = $('<div>', {id: 'status-prompt'});
        $status_prompt.text("");
        if (cont_only !== null) {
            $status_prompt.append("contribution " + cont_only.join(", ") + " - ");
            $status_prompt.append($('<a>', {href: url_with_no_query_string()}).text("see all"));
            $status_prompt.append(" ");
        }
        $up_top.append($status_prompt);

        var $bot = $('<div>', {id: 'player-bot'});

        $bot.append($('<button>', {id: 'close-button'}).append($icon('close')).append(" close"));
        $bot.append($('<button>', {id: 'play-button'}).append($icon('play_arrow')).append(" play"));
        $bot.append($('<button>', {id: 'pause-button'}).append($icon('pause')).append(" pause"));
        $bot.append($('<button>', {id: 'resume-button'}).append($icon('play_arrow')).append(" resume"));
        $bot.append($('<button>', {id: 'stop-button'}).append($icon('stop')).append(" stop"));
        $bot.append($('<button>', {id: 'skip-button'}).append($icon('skip_next')).append(" skip"));
        $bot.append($('<select>', {id: 'play_bot_sequence'})
            .append($('<option>', {value: PLAY_BOT_SEQUENCE_RANDOM}).text("random"))
            .append($('<option>', {value: PLAY_BOT_SEQUENCE_ORDER}).text("in order"))
        );
        $bot.append($('<select>', {id: 'play_bot_from'})
            .append($('<option>', {value: PLAY_BOT_FROM_MY}).text("from my playlist"))
            .append($('<option>', {value: PLAY_BOT_FROM_OTHERS}).text("from others playlist"))
        );
        $bot.append($('<select>', {id: 'play_bot_speech'})
            .append($('<option>', {value: PLAY_BOT_SPEECH_OUT_LOUD}).text("quotes are spoken out loud"))
            .append($('<option>', {value: PLAY_BOT_SPEECH_ANIMATED}).text("quotes are silently animated"))
            .append($('<option>', {value: PLAY_BOT_SPEECH_OFF}).text("quotes are silent"))
        );
        $up_top.append($bot);

        var $login_prompt = $('<div>', {id: 'login-prompt', title: "your idn is " + MONTY.me_idn});
        $login_prompt.html(MONTY.login_html);
        $up_top.append($login_prompt);

        var $login_left = $('<div>', {id: 'top-right-blurb'});
        $up_top.append($login_left);

        build_category_dom(me_title,    MONTY.IDN.CAT_MY,    true, true);
        build_category_dom("others",    MONTY.IDN.CAT_THEIR, true, true);
        build_category_dom("anonymous", MONTY.IDN.CAT_ANON,  true, false);
        build_category_dom("trash",     MONTY.IDN.CAT_TRASH, true, false);
        build_category_dom("about",     MONTY.IDN.CAT_ABOUT, true, false);
        // TODO:  Live category titles should not be buried in code like this.
        $sup_categories[MONTY.IDN.CAT_MY].addClass('sup-category-first');

        var $entry = $('<div>', {class: 'container-entry'});
        $entry.append($('<textarea>', {id: 'enter_some_text', placeholder: "enter a quote or video"}));
        $entry.append($('<input>', {id: 'enter_a_caption', placeholder: "and a caption"}));
        $entry.append($('<button>', {id: 'post_it_button'}).text("post it"));
        $entry.append($('<span>', {id: 'entry_feedback'}));
        // TODO:  Make global-ish variables.  E.g. $enter_some_text instead of $('#enter_some_text')
        //        Likewise maybe use $categories[] more, instead of DOM selections.
        $categories[MONTY.IDN.CAT_MY].append($entry);

        if (MONTY.is_anonymous) {
            var $anon_blurb = $('<p>', {id: 'anon-v-anon-blurb'}).text(ANON_V_ANON_BLURB);
            $categories[MONTY.IDN.CAT_ANON].append($anon_blurb);
            $sup_categories[MONTY.IDN.CAT_ANON].addClass('double-anon');
            // Anonymous users see a faded anonymous category with explanation.
        }

        var $sup_contributions = {};   // table of super-contribution DOM objects, by idn qstring
        var cat_of_cont = {};   // maps contribution idn to category idn
        var conts_in_cat = {};   // for each category idn, an ordered array of contribution idns
        looper(MONTY.cat.order, function (_, cat) {
            conts_in_cat[cat] = [];   // each array defines contribution order within category
        });

        /**
         * Assert consistency of cat_of_cont{} and conts_in_cat{}[].
         *
         * They are roughly inverses of each other.
         * A bit like "a place for everything, and everything in its place."
         */
        function consistent_cat_cont() {
            looper(cat_of_cont, function (cont, cat) {
                cont = parseInt(cont);
                if (conts_in_cat[cat].indexOf(cont) === -1) {
                    console.error(
                        "inconsistency: contribution",
                        cont,
                        "should be in category",
                        cat,
                        JSON.stringify(cat_of_cont),
                        JSON.stringify(conts_in_cat)
                    );
                    return false;
                }
            });
            looper(conts_in_cat, function (cat, conts) {
                cat = parseInt(cat);
                looper(conts, function (_, cont) {
                    console.assert(
                        cat_of_cont[cont] === cat,
                        "inconsistency: contribution",
                        cont,
                        "could be in category",
                        cat,
                        "or",
                        cat_of_cont[cont]
                    );
                });
            });
        }
        consistent_cat_cont();   // empty is consistent with empty

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
                            //        That would prevent SOME vacuous "unknown word" situations.
                            $sup_contributions[new_idn] = $sup;
                            renumber_cont(old_idn, new_idn);
                            consistent_cat_cont();
                        }
                        // NOTE:  This does reorder the edited contribution
                        //        But maybe that's good, it does get a new id_attribute,
                        //        and likewise moves to the more recent end.
                    } else {
                        // TODO:  Editable captions.
                        //        (Currently, an edited caption is submitted as a new caption.)
                        console.log("(Can't edit " + word.obj + ")");
                        // NOTE:  Edit for an unknown contribution.  One harmless way we get here:
                        //        A logged-in user could edit an anonymous user's contribution.
                        //        Other anon user would get this edit-word, but not the original word.
                        //        TODO:  They should see this edit.   Now they won't.
                        //               Or not.  Maybe the contribution should be explicitly
                        //               APPROVED before other anonymous users could see it.
                        //
                        //        Another is if user A then B edits contribution x (by a third user).
                        //        B won't enforce A's edit, so although B's edit is later,
                        //        it will refer back to the original contribution.
                        //        A will get this message when it see's B's edit word,
                        //        because that edit word will refer to the original x's id_attribute,
                        //        but by then x will have been displaced by A's edit word.
                    }
                    break;
                default:
                    if (has(MONTY.cat.order, word.vrb)) {   // Is this a categorization verb?
                        if (has($sup_contributions, word.obj)) {   // Are we rendering what it categorizes?
                            var new_cat = word.vrb;
                            var cont_idn = word.obj;
                            var idn_position = word.num;
                            // CAUTION:  Don't $_from_id(cont_idn) because it's not in the DOM yet.
                            $sup = $sup_contributions[cont_idn];
                            $cont = $sup.find('.contribution');
                            var is_right = idn_position === MONTY.IDN.FENCE_POST_RIGHT;
                            var where = is_right ? "right" : idn_position.toString();
                            var action = "drag to " + MONTY.cat.txt[new_cat] + "." + where + ",";
                            if (is_authorized(word, $cont.attr('data-owner'), action)) {
                                var old_cat = cat_of_cont[cont_idn];
                                if (is_defined(old_cat)) {
                                    var i_cont_within_cat = conts_in_cat[old_cat].indexOf(cont_idn);
                                    if (i_cont_within_cat === -1) {
                                        console.error(
                                            "Can't find cont",
                                            cont_idn,
                                            "within conts_in_cat[" + old_cat + "]",
                                            conts_in_cat
                                        );
                                    } else {
                                        conts_in_cat[old_cat].splice(i_cont_within_cat, 1);
                                        insert_cont(new_cat, cont_idn, idn_position);
                                        cat_of_cont[cont_idn] = new_cat;
                                        $cont.attr('data-owner', word.sbj);
                                        consistent_cat_cont();
                                    }
                                } else {
                                    console.error(
                                        "Lost track of cat for",
                                        cont_idn,
                                        cat_of_cont
                                    );
                                }
                            }
                        } else {
                            console.log("(Can't drag " + word.obj + ")");
                            // NOTE:  Because we're not rendering word.obj anywhere.
                            //        Possible harmless reasons:
                            //        - URL suffix cont=NNN restricts the contributions displayed
                            //        - This action refers to another action we rejected already,
                            //          because it was for another user.
                            //          E.g. Baker edited Able's quote, then dragged it,
                            //               resulting in two words,
                            //               an edit word and a categorization word.
                            //               The edit word refers to the Able's original
                            //               contribution, and the categorization word
                            //               refers to the edit word.
                            //               So when Able is the browsing user,
                            //               first the edit word gets rejected by is_authorized()
                            //               (because Baker is not the boss of Able).
                            //               Then the categorization word winds up here.
                            //               That's because it uses the idn of Baker's edit word,
                            //               when Able's rendering kept no record of that edit.
                        }
                    } else {
                        console.warn(
                            "Not dealing with idn",
                            word.idn,
                            "verb",
                            txt_from_idn[word.vrb] || "(idn )" + word.vrb.toString()
                        );
                    }
                    break;
                }
            }
        });
        // NOTE:  MONTY.w loop is done.
        consistent_cat_cont();   // One final check for good measure.



        alternative_build_contributions();



        /**
         * Give a contribution a new idn, in cat_of_cont{} and conts_in_cat{}[].
         *
         * So an edit word takes the place of a contribution word (or an older edit word).
         *
         * @param old_idn - idn of the original contribution word (or an older edit word).
         * @param new_idn - idn of a new edit word.
         */
        function renumber_cont(old_idn, new_idn) {
            var cat = cat_of_cont[old_idn];
            console.assert(is_defined(cat), old_idn);
            var i = conts_in_cat[cat].indexOf(old_idn);
            console.assert(i !== -1, old_idn);
            conts_in_cat[cat][i] = new_idn;
            cat_of_cont[new_idn] = cat;
            delete cat_of_cont[old_idn];
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
                        "so it's going on the LEFT end of", MONTY.cat.txt[cat],
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



        // console.log("cat_of_cont", JSON.stringify(cat_of_cont, null, 2));
        // EXAMPLE:  cat_of_cont {
        //   "882": 1438,   (Order of contributions does not matter in this associative array.)
        //   "953": 1438,
        //   "1024": 1438,
        //   "1430": 1438,
        //   "1432": 1435,
        //   "1450": 1435,
        //   "1458": 1438,
        //   "1462": 1438,
        //   "1473": 1438,
        //   "1475": 1438,
        //   "1551": 1435,
        //   "1654": 1436,
        //   "1678": 1435,
        //   "1679": 1438,
        //   "1689": 1438,
        //   "1691": 1688,
        //   "1695": 1688,
        //   "1729": 1688,
        //   "1733": 1435,
        //   "1739": 1435,
        //   "1741": 1435,
        //   "1746": 1435,
        //   "1748": 1435,
        //   "1754": 1435,
        //   "1759": 1435,
        //   "1792": 1437,
        //   "1795": 1435,
        //   "1796": 1435,
        //   "1809": 1435,
        //   "1813": 1435,
        //   "1822": 1435,
        //   "1823": 1435,
        //   "1825": 1435,
        //   "1831": 1435,
        //   "1834": 1435,
        //   "1849": 1436,
        //   "1851": 1436,
        //   "1857": 1438,
        //   "1871": 1435,
        //   "1874": 1435,
        //   "1896": 1435,
        //   "1909": 1435,
        //   "1911": 1435,
        //   "1917": 1438,
        //   "1924": 1435,
        //   "1931": 1435,
        //   "1936": 1436,
        //   "1938": 1436,
        //   "1970": 1435,
        //   "1990": 1435,
        //   "1996": 1435,
        //   "2001": 1435,
        //   "2025": 1435,
        //   "2036": 1436,
        //   "2048": 1435,
        //   "2055": 1435,
        //   "2061": 1435,
        //   "2995": 1435,
        //   "3373": 1435,
        //   "3470": 1435,
        //   "3486": 1435
        // }
        // console.log("conts_in_cat", JSON.stringify(conts_in_cat, null, 2));
        // EXAMPLE:  conts_in_cat {
        //   "1435": [   (Order of categories does not matter in the outer associative array.)
        //     3486,     (Order of contributions DOES matter, and is defined by, each inner array.)
        //     3470,     (By the way, category order is defined by MONTY.cat.order[].)
        //     1809,
        //     1990,
        //     2001,
        //     1924,
        //     1823,
        //     1931,
        //     2061,
        //     2025,
        //     1911,
        //     1874,
        //     2048,
        //     2055,
        //     1970,
        //     1759,
        //     3373,
        //     1871,
        //     1834,
        //     1831,
        //     2995,
        //     1822,
        //     1813,
        //     1825,
        //     1748,
        //     1754,
        //     1896,
        //     1795,
        //     1796,
        //     1746,
        //     1741,
        //     1739,
        //     1733,
        //     1678,
        //     1450,
        //     1909,
        //     1996,
        //     1432,
        //     1551
        //   ],
        //   "1436": [
        //     1938,
        //     1936,
        //     1851,
        //     1849,
        //     1654,
        //     2036
        //   ],
        //   "1437": [
        //     1792
        //   ],
        //   "1438": [
        //     1857,
        //     1689,
        //     1430,
        //     1458,
        //     1462,
        //     882,
        //     1475,
        //     1917,
        //     1679,
        //     1473,
        //     953,
        //     1024
        //   ],
        //   "1688": [
        //     1695,
        //     1691,
        //     1729
        //   ]
        // }
        // $(window.document.body).append(
        //     $('<div>', {title: 'Authorization History Comment'}).append(
        //         $('<!-- \n' + auth_log.join("\n") + '\n-->')
        //     )
        // );
        // // NOTE:  Slightly less intrusive stowing of the auth_log than console.log(auth_log).
        // //        See it in F12 | Elements.
        // EXAMPLE:
        //     1433. Yes Bob Stein may caption 1432, work of Bob Stein
        //     1441. Yes Bob Stein may drag to trash.right, 1430, work of Bob Stein
        //     1442. Yes Bob Stein may drag to trash.right, 1024, work of Bob Stein
        //     :
        //     1457. Nope anon#1267 won't drag to my.1432, 956, work of Bob Stein
        //     1459. Yes anon#1267 may caption 1458, work of anon#1267
        //     1461. Yes anon#1267 may caption 1460, work of anon#1267
        //     1463. Yes anon#1267 may caption 1462, work of anon#1267
        //     1465. Yes Bob Stein may drag to trash.right, 1462, work of anon#1267
        //     :
        //     4144. Yes Bob Stein may caption 4143, work of Bob Stein
        //     4215. Yes Bob Stein may edit 1450, work of Bob Stein
        //     4222. Yes Bob Stein may drag to my.right, 1432, work of Bob Stein



        /**
         * Put the newly minted contribution elements in their category DOMs.
         */
        looper(conts_in_cat, function (cat_idn, cont_idns) {
            looper(cont_idns, function (_, cont_idn) {
                $categories[cat_idn].append($sup_contributions[cont_idn]);
            });
        });
        /**
         * Put the categories in the page DOM.
         */
        looper(MONTY.cat.order, function (_, idn) {
            $(window.document.body).append($sup_categories[idn]);
        });



        // NOTE:  Now all contribution elements are in the DOM.
        //        Everything below requires this.
        //        After this the Contribution constructor may be called.



        var $introductory_blurb = $('<p>', { id: 'introductory-blurb' }).append(INTRODUCTORY_BLURB);
        if (num_contributions_in_category(MONTY.IDN.CAT_MY) === 0) {
            $categories[MONTY.IDN.CAT_MY].append($introductory_blurb);
        } else {
            $('#top-right-blurb').empty().append($introductory_blurb);
        }



        looper(MONTY.MEDIA_HANDLERS, function (_, media_handler_url) {
            media_handlers.push({
                url: media_handler_url,
                did_load: false,
                did_fail: false,
                did_register: false,
                media: null,
                $script: null,
                handler_index: null,   // in media_handlers[]
                pattern_index: null,   // in media.url_pattern[]   \  outputs of
                match_object: null     //                          /  handler_scan()
                // TODO:  Do all this in a MediaHandler object constructor.
            });
            // NOTE:  media_handlers[] order determined by MONTY.MEDIA_HANDLERS[]
        });
        var first_script_error = true;
        looper(media_handlers, function (handler_index, handler) {
            handler.handler_index = handler_index;
            handler.$script = $('<script>');
            handler.$script.data('handler-index', handler_index);
            handler.$script.one('load.script2', function () {
                handler.$script.off('.script2');
                handler.did_load = true;
                console.log("Media handler loaded:", handler.$script.attr('src'));
                if ( ! handler.did_register) {
                    console.error(
                        "HANDLER", handler_index,
                        "LOADED BUT DID NOT REGISTER",
                        handler.url
                    );
                    // TODO:  Does the loaded event always happen after the script has executed?
                    //        We assume so here.
                    //        https://stackoverflow.com/q/14565365/673991
                }
                are_we_done_loading_handlers();
            });
            handler.$script.one('error.script2', function (evt) {
                handler.$script.off('.script2');
                handler.did_fail = true;
                console.error(
                    "Media handler", handler_index,
                    "error, script", handler.url,
                    evt
                );
                if (first_script_error) {
                    first_script_error = false;
                    alert("Unable to register all media handlers. You may want to reload.");
                    // FIXME:  Whole page is busted if we can't load all media handlers.
                    //         Is there a better way to handle this?
                    //         How about a red status message up-top?
                    //         And/or a red line around media we can't handle.
                }
            });
            $(window.document.body).append(handler.$script);
            handler.$script.attr('src', handler.url);
            // SEE:  Set src after on-error, https://api.jquery.com/error/#entry-longdesc
        });
        setTimeout(function () {
            var all_ok = true;
            var num_loaded = 0;
            var num_failed = 0;
            var num_registered = 0;
            looper(media_handlers, function(_, handler) {
                if (handler.did_load) {
                    num_loaded++;
                    if (handler.did_register) {
                        num_registered++;
                    }
                } else if (handler.did_fail) {
                    num_failed++;
                    all_ok = false;
                } else {
                    console.warn("Media handler failed to load", handler);
                    all_ok = false;
                }
            });
            var console_reporter = all_ok ? console.log : console.warn;
            console_reporter(
                num_loaded.toString(),
                "of",
                Object.keys(media_handlers).length.toString(),
                "media handlers loaded,",
                num_failed, "failed,",
                num_registered, "registered"
            );
        }, MEDIA_HANDLER_LOAD_SECONDS * 1000);
    }

    window.qiki = window.qiki || {};
    window.qiki.media_register = function js_for_contribution_media_register(media) {
        var $script = $(window.document.currentScript);
        console.assert($script.length === 1, "currentScript broke", window.document.currentScript);
        var handler_index = $script.data('handler-index');
        // TODO:  Point instead directly at handler object?
        console.assert(is_defined(handler_index), "handler-index broke", $script);
        var handler = media_handlers[handler_index];
        console.assert(is_defined(handler), "handler object broke", handler_index, media_handlers);
        if (is_defined(handler)) {
            console.log("Media handler registered:", media.description_long);
            handler.media = media;
            handler.did_register = true;
        }
    };

    /**
     * Is this media URL handled by a registered handler?
     *
     * If so:
     *     return true
     *     set that.handler to point to the winning handler object in media_handlers.
     *     set that.handler.match_object to the results of the match, possibly containing
     *                                   regular expression parenthetical sub-match strings
     *     set that.handler.pattern_index to the index into url_patterns[] for that handler.
     *
     * The first pattern of the first handler wins.  So catch-all patterns should come last in
     * the media_handlers[] array.
     *
     * @return {boolean}
     */
    Contribution.prototype.handler_scan = function contribution_handler_scan() {
        var that = this;
        var did_find = false;
        if (that.is_media) {
            looper(media_handlers, function handler_loop(_, media_handler) {
                if (media_handler.did_register) {
                    console.assert(is_specified(media_handler.media), media_handler);
                    console.assert(is_specified(media_handler.media.url_patterns), media_handler.media);
                    looper(media_handler.media.url_patterns, function pattern_loop(pattern_index, url_pattern) {
                        var match_object = that.content.match(url_pattern);
                        if (match_object !== null) {
                            that.handler = media_handler;
                            that.handler.match_object = match_object;
                            that.handler.pattern_index = pattern_index;
                            did_find = true;
                            return false;
                            // NOTE:  Exit url pattern loop, FIRST pattern wins.
                        }
                    });
                    if (did_find) {
                        return false;
                        // NOTE:  Exit handler loop, FIRST handler wins.
                    }
                }
            });
            // TODO:  Profile this double loop.
            //        Especially when it's a triple loop inside rebuild_all_render_bars()
        }
        return did_find;
    };

    function are_we_done_loading_handlers() {
        var all_loaded = true;
        looper(media_handlers, function (_, handler) {
            if ( ! handler.did_load) {
                all_loaded = false;
                return false;
            }
        });
        // TODO:  Use .entries() and .reduce()?
        //        all_done = Object.entries(media_handlers).reduce(
        //            (done, handler) => done && !handler.need_load,
        //            true
        //        )
        //        But is that harder to follow?  And if I have to ask the answer is yes?
        // TODO:  all_done = Object.entries(media_handlers).all(handler => ! handler.need_load);
        if (all_loaded) {
            rebuild_all_render_bars();
            console.log("Media handlers", media_handlers);
        }
    }

    function rebuild_all_render_bars() {
        $('.sup-contribution').each(function () {
            rebuild_a_render_bar(this);
        });
    }

    function cont_list_from_query_string() {
        var cont_filter = query_get('cont', null);
        if (cont_filter === null) {
            return null;
        } else {
            var cont_array = cont_filter.split(',');
            window.document.title += " - " + cont_filter;
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

    function our_oembed_relay_url(parameters) {
        console.assert(is_associative_array(parameters), parameters);
        return MONTY.OEMBED_CLIENT_PREFIX + "?" + $.param(parameters);
        // THANKS:  jQuery query string, https://stackoverflow.com/a/31599255/673991
    }


    /**
     * What's the category idn where this contribution went (for CURRENT user) before it was edited?
     *
     * @param word
     * @return {number} - idn of CAT_MY, CAT_ANON, or CAT_THEIR
     */
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
     * So once I (logged-in user) changes a contribution, I will ignore changes by others.
     * Before that, admin changes similarly stop original author changes.
     *
     * @param word - the word causing a change (e.g. edit or re-categorization or rearrangement)
     *               word.sbj is the id_attribute of the user who initiated this change.
     * @param owner - tricky - id of the last person we authorized to change this contribution.
     *                It starts off as the original contributor.
     *                But then if I (the browsing user) moved it or edited it, then I'm the owner.
     *                But before that if the system admin moved or edited it,
     *                then they became the owner.
     *                This field comes from the data-owner attribute.  BUT if we return true,
     *                then we expect data-owner to be overridden by whoever initiated THIS change!
     * @param action - text describing the change.
     *                 (This is probably word.verb.txt, as if that were accessible in JS)
     * @return {boolean}
     */

    // DONE:  Don't let owner or admin "drag to my.*"  (not even before I do)
    //            Shame that removes the Seuss quote, and the top will be empty for new users.
    //        Nor other.* nor anon.*
    //            (It's weird that we allow recategorizations to there at all,
    //            less weird that we allow rearrangements within those categories,
    //            but it would be weirder if we allowed anyone ELSE do those FOR me.)
    //            But this eliminates admin rearranging the "other" category.
    //            Which would be problematic anyway, as different users already have
    //            different stuff there.  So admin placing X to the left of Y would
    //            already be unusable to the user who created Y (or moved it to category 'my')
    //            because it wouldn't then be in category 'other'.
    //        But do allow owner or admin to "drag to trash.*"
    //            And that affects everyone else, unless of course I drag it elsewhere later.
    //            A little weird that owner or admin rearrangements WITHIN trash affect
    //            everyone.
    //        Do allow admin to "drag to about.*" (Only admin can create those words anyway.)
    //            And those actions rightly affect everyone.
    // TODO:  The confusion above is a symptom of the deeper confusion:
    //            Are categories user-interest partitions, or user-origin partitions?
    //            IOW are we separating things by where they came from?
    //                (anonymous users, me, other logged-in users)
    //            or by what we want to do with them?
    //                (my unslumping, others, trash)

    function is_authorized(word, owner, action) {

        // First stage of decision-making:
        var is_change_mine = word.sbj === MONTY.me_idn;
        var is_change_admin = is_admin(word.sbj);
        var is_change_owner = word.sbj === owner;
        var did_i_change_last = owner === MONTY.me_idn;
        var did_admin_change_last = is_admin(owner);

        // Second stage of decision making:
        var let_admin_change = ! did_i_change_last                            && is_change_admin;
        var let_owner_change = ! did_i_change_last && ! did_admin_change_last && is_change_owner;

        // Third stage of decision making:
        var only_i_can_do_these = [
            // NOTE:  These rearranging actions are only allowed by the browsing user.
            MONTY.IDN.CAT_MY,
            MONTY.IDN.CAT_THEIR,
            MONTY.IDN.CAT_ANON
        ];
        var ok;
        if (has(only_i_can_do_these, word.vrb)) {
            ok = is_change_mine;
        } else {
            ok = is_change_mine || let_admin_change || let_owner_change;
        }

        // Decision:
        if (ok) {
            auth_log.push(word.idn + ". Yes " + user_name_short(word.sbj) + " may " + action + " " + word.obj + ", work of " + user_name_short(owner));
        } else {
            auth_log.push(word.idn + ". Nope " + user_name_short(word.sbj) + " won't " + action + " " + word.obj + ", work of " + user_name_short(owner));
            if (let_admin_change || let_owner_change) {
                auth_log.push("     ...because only I can recategorize like this.");
            }
            // TODO:  Display more thorough explanations on why or why not ok.
            //        This might be a big idea:
            //        Explain reasons by seeing which boolean inputs were critical,
            //        that is, which if flipped, would have changed the "ok" output.
            //        Would this really be interesting and complete?
            //        What about pairs of inputs that together change the output?
            //        How to compose the human-readable explanations once we know which
            //        inputs were critical?
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
        $save_bar.append($('<button>', {class: 'edit'}).text("edit"));
        $save_bar.append($('<button>', {class: 'cancel'}).text("cancel"));
        $save_bar.append($('<button>', {class: 'save'}).text("save"));
        $save_bar.append($('<button>', {class: 'discard'}).text("discard"));
        $save_bar.append(
            $('<button>', {
                class: 'expand',
                title: "expand"
            })
                .append($icon('fullscreen'))
                .append(
                    $('<span>').text(" bigger")
                )
        );
        $save_bar.append(
            $('<button>', {class: 'play'})
                .append($icon('play_arrow'))
                .append(" play")
        );
        $sup_contribution.append($render_bar);
        $sup_contribution.append($caption_bar);
        $sup_contribution.append($save_bar);
        var $grip = $('<span>', {class: 'grip'});
        $caption_bar.append($grip);
        $grip.text(GRIP_SYMBOL);
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

    function rebuild_a_render_bar(any_element_in_a_contribution) {
        // TODO:  This function and all his playmates should become Contribution methods.
        var cont = Contribution_from_element(any_element_in_a_contribution);
        if (cont.is_media) {
            cont.$sup.addClass('render-media');
            cont.render_media();
        } else {
            cont.$sup.removeClass('render-media');
            cont.$sup.addClass('can-play');
            render_text(cont.$sup);
        }
    }

    function render_text($sup_cont) {
        $sup_cont.removeAttr('data-domain');
        var $render_bar = $sup_cont.find('.render-bar');
        $render_bar.empty();
        // var cont = Contribution_from_element($sup_cont);
        // cont.fix_caption_width('quote rendering');
        // console.log("render_text()", cont.id_attribute);
    }

    function could_be_url(text) {
        return starts_with(text, 'http://') || starts_with(text, 'https://');
    }

    /**
     * Try to find a caption?  I.e. is this text something we can "go meta" about?
     *
     * @param text - is this a URL of something we can get a caption about?
     */
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
        return text.replace(/^[ \t]+/gm, function each_indentation(spaces) {
            return new Array(spaces.length + 1).join(UNICODE.EN_SPACE);
            // NOTE:  UNICODE.NBSP is too narrow and UNICODE.EM_SPACE is too wide.
        });
        // THANKS:  leading spaces to nbsp, https://stackoverflow.com/a/4522228/673991
    }

    /**
     *
     * @return {{cat: [], cont: {}}} - .cat - array of category idns in display order
     *                                 .cont - association from each category idn to an array
     *                                         of its contributions in order
     */
    function order_of_contributions_in_each_category() {
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

    /**
     *
     * @param order {{cat: [], cont: {}}}
     * @return {string}
     */
    function order_report(order) {
        var cont_nonempty = order.cat.filter(function (cat) {
            return has(order.cont, cat) && order.cont[cat].length > 0
        });
        var cont_strings = cont_nonempty.map(function (cat) {
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
     * Or [id_attribute] if we can't find the element.
     *
     * @param cont - id_attribute of the contribution
     * @return {string}
     */
    function first_word_from_cont(cont) {
        var $cont = $_from_id(cont);   // actually the div.sup-contribution#id_attribute containing the div.contribution
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
        console.log(order_report(order_of_contributions_in_each_category()));
        refresh_how_many();
    }

    /**
     * Update all the (count) indicators that show when a category is collapsed.
     */
    function refresh_how_many() {
        looper(MONTY.cat.order, function recompute_category_anti_valves(_, cat) {
            var num_cont_string;
            var num_cont_int = num_contributions_in_category(cat);
            if (num_cont_int === 0) {
                num_cont_string = "";
            } else {
                num_cont_string = " (" + num_cont_int.toString() + ")";
            }
            $sup_categories[cat].find('.how-many').text(num_cont_string);
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
     * @param vrb_sought - id_attribute of the verb you want, e.g. IDN.CAPTION
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
    function entry_caption_same_width_as_textarea() {
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

    function exit_full_screen() {
        // THANKS:  Exit full screen, https://stackoverflow.com/a/36672683/673991
        if (window.document.exitFullscreen) {
            window.document.exitFullscreen();
        } else if (window.document.webkitExitFullscreen) {
            window.document.webkitExitFullscreen();
        } else if (window.document.mozCancelFullScreen) {
            window.document.mozCancelFullScreen();
        } else if (window.document.msExitFullscreen) {
            window.document.msExitFullscreen();
        } else {
            console.error("No function to exit full screen.");
        }
    }

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

    // noinspection JSUnusedLocalSymbols
    function chooseWeighted(items, chances) {
        // THANKS:  Weighted random element, https://stackoverflow.com/a/55671924/673991
        var sum = chances.reduce(function (acc, el) { return acc + el; }, 0);
        var acc = 0;
        chances = chances.map(function (el) { acc = el + acc; return acc; });
        var rand = Math.random() * sum;
        return items[chances.filter(function (el) { return el <= rand; }).length];
    }

    function notable_occurrence(message) {
        qoolbar.post('notable_occurrence', { message: message });
    }
}

// NOTE:  Reasons why IE11 won't work:
//        window.document.currentScript is needed to match media handler code and objects.
//        window.speechSynthesis to speak quotes
//        window.SpeechSynthesisUtterance is where it actually crashes
//        $('iframe').on('load') event never happens.

// noinspection JSUnusedGlobalSymbols

/**
 * unslump.js - JavaScript for unslumping.org
 *
 * Auxiliary input parameter extracted from the URL (window.location.search):
 *
 *     ?cont=IDN,IDN,...    Only show some contributions.  (IDN of latest edit.)
 *     ?initial=NN          Initially show NN to NN+MORE_CAT_CONT-1 contributions
 *     ?console_verbose     Details on the JavaScript console of how words are processed
 *
 * Limits the contributions displayed.
 * Each IDN is the inconvenient ROOT id_attribute,
 * not the handier id_attribute at the TIP of the edit chain.
 *
 * @param window
 * @param window.clipboardData
 * @param window.document
 * @param window.document.body
 * @param window.document.createRange
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
 * @param window.performance
 * @param window.performance.memory
 * @param window.performance.memory.usedJSHeapSize
 * @param window.qiki
 * @param window.qiki.media_register
 * @param window.scrollBy
 * @param window.speechSynthesis
 * @param window.ResizeObserver
 * @param window.SpeechSynthesisUtterance
 * @param window.utter
 * @param $
 * @param qoolbar
 * @param MONTY
 * @param MONTY.AJAX_URL
 * @param MONTY.INTERACT_VERBS
 * @param MONTY.login_html
 * @param MONTY.me_idn
 * @param MONTY.MEDIA_HANDLERS
 * @param MONTY.OEMBED_CLIENT_PREFIX
 * @param MONTY.OEMBED_OTHER_ORIGIN
 * @param MONTY.POPUP_ID_PREFIX
 * @param MONTY.STATIC_IMAGE
 * @param MONTY.THUMB_MAX_HEIGHT
 * @param MONTY.THUMB_MAX_WIDTH
 * @param MONTY.WHAT_IS_THIS_THING
 * @param talkify
 *
 * @property word
 * @property word.sbj
 * @property word.vrb
 * @property word.was_submitted_anonymous
 *
 * @property categories
 * @property categories.by_name
 * @property categories.by_name.my
 * @property categories.by_name.their
 * @property categories.by_name.anon
 * @property categories.by_name.about
 * @property categories.by_name.trash
 *
 * @property interact
 * @property interact.bot
 * @property interact.start
 * @property interact.quit
 * @property interact.end
 * @property interact.pause
 * @property interact.resume
 * @property interact.error
 * @property interact.unbot
 *
 * @property js_for_unslumping.utter - so JS console has access to SpeechSynthesisUtterance object
 */

// TODO:  window.qiki --> qiki (either the global, or an explicitly passed parameter)

function js_for_unslumping(window, $, qoolbar, MONTY, talkify) {
    type_should_be(window, Window);
    type_should_be($, Function);
    type_should_be($(), $);
    type_should_be($().jquery, String);
    type_should_be(qoolbar, Object);
    type_should_be(MONTY, Object);

    const FUDGE_FICKLE = 24;   // HACK:  Compute this somehow

    const DO_REPORT_EDIT_HISTORIES = true;

    const DO_LONG_PRESS_EDIT = false;
    // NOTE:  Long press seems like too easy a way to trigger an edit.
    //        Only do this for mobile users?
    //        Edit is just not that common a desired course of action.

    const DOES_DOCUMENT_CLICK_END_CLEAN_EDIT = false;
    // NOTE:  Clicking on the document background ends a non-dirty edit.
    //        Makes more sense with the long-press-edit feature.  Less so without it.

    const DEBUG_SIZE_ADJUST = false;
    const DEBUG_BOT_STATES = true;

    const IFRAME_RESIZER_INIT_MS = .100 * 1000;
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

    const IFRAME_RECOVERY_CHECK_MS = 5.000 * 1000;
    // TODO:  3 seconds seemed too brief, lots of churn.

    const MEDIA_HANDLER_LOAD_CHECK_MS = 10.000 * 1000;

    const LONG_PRESS_DEFAULT_MS = 1.000 * 1000;

    const INITIAL_RESIZING_NUDGE_MS = 3.000 * 1000;   // Ask iFrameResizer to resize after some settling.

    // var MS_THUMB_TO_POP_UP = 1;   // ms to freeze thumbnail clone before popping it up

    const FINITE_STATE_MACHINE_INTERVAL_MS = 1.000 * 1000;

    const EXPERIMENTAL_RED_WORD_READING = false;

    const MOVE_CANCEL = false;   // SortableJS should have defined this
    // SEE:  SortableJS options, https://github.com/SortableJS/Sortable#user-content-options

    const MOUSE_BUTTON_LEFT = 1;   // jQuery should have defined this
    // SEE:  jQuery event.which, https://api.jquery.com/event.which/

    const UNICODE = {
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

    const GRIP_SYMBOL = UNICODE.VERTICAL_ELLIPSIS + UNICODE.VERTICAL_ELLIPSIS;

    const ANON_V_ANON_BLURB = (
        "You're here anonymously. " +
        "Log in to see the anonymous contributions from others."
    );

    var weep_url = MONTY.STATIC_IMAGE + '/' + 'weep_104_right.png';
    var laugh_url = MONTY.STATIC_IMAGE + '/' + 'laugh_103_left.png';

    // var INTRODUCTORY_BLURB = "or drag stuff here by its " + GRIP_SYMBOL;
    // var INTRODUCTORY_BLURB = "drag " + GRIP_SYMBOL + " here";
    // var INTRODUCTORY_BLURB = "This is the place for stuff that unslumps you.";
    // var INTRODUCTORY_BLURB = "The site for therapy grade wah's and lol's.";
    // var INTRODUCTORY_BLURB = "The site for therapeutic wah's and lol's.";
    // NOTE:  Thinking this category confusion will go away,
    //        that dragging from "their" to "my" is not the way.
    // noinspection HtmlRequiredAltAttribute,RequiredAttributes
    const INTRODUCTORY_BLURB = [
        "The site for therapeutic ",
        $('<img>', {src: weep_url, alt: "weeping", title: "weeping"}),
        " and ",
        $('<img>', {src: laugh_url, alt: "laughing", title: "laughing"})
    ];

    const MAX_OEMBED_CAPTION_LENGTH = 100;  // Because some oembed titles are huge

    // var me_word = null;
    // function me_title() {
    //     var me_name = me_word.name;
    //     var me_possessive;
    //     if (MONTY.is_anonymous || me_name === "") {
    //         me_possessive = "my";
    //     } else {
    //         me_possessive = me_name + "'s";
    //     }
    //     return me_possessive + " " + MONTY.WHAT_IS_THIS_THING;
    // }

    // var categories;
    // var contribution_lexi = null;
    var lex;

    var popped_cont;
    set_popped_cont(null);

    // Config options for size_adjust()
    const WIDTH_MAX_EM = {
        soft: 12,         // below the hard-max, display as is.
        hard: 15,         // between hard and extreme-max, limit to hard-max.
                          // (good reason to have a gap here: minimize wrapping)
        extreme: 15       // above extreme-max, display at soft-max.
    };
    const HEIGHT_MAX_EM = {
        soft: 5,          // below the hard-max, display as is.
        hard: 6,          // between hard and extreme-max, limit to hard-max.
                          // (no good reason to have a gap here: it's just
                          // annoying to show a tiny bit scrolled out of view)
        extreme: 8        // above extreme-max, display at soft-max.
    };

    // Config options for size_adjust()
    const WIDTH_MAX_EM_ABOUT = {
        soft: 24,         // below the hard-max, display as is.
        hard: 30,         // between hard and extreme-max, limit to hard-max.
                          // (good reason to have a gap here: minimize wrapping)
        extreme: 30       // above extreme-max, display at soft-max.
    };
    const HEIGHT_MAX_EM_ABOUT = {
        soft: 15,         // below the hard-max, display as is.
        hard: 24,         // between hard and extreme-max, limit to hard-max.
                          // (no good reason to have a gap here: it's just
                          // annoying to show a tiny bit scrolled out of view)
        extreme: 24       // above extreme-max, display at soft-max.
    };

    const MIN_CAPTION_WIDTH = 100;
    // NOTE:  Prevent zero-width iframe or other crazy situation from scrunching caption too narrow.

    var is_editing_some_contribution = false;
    // TODO:  $(window.document.body).hasClass('edit-somewhere')
    var $cont_editing = null;
    // TODO:  $('.contribution-edit').find('.contribution')
    //        Or maybe cont_editing refers to the Contribution object being edited.
    //        Then cont_editing.$cont serves for $cont_editing
    //        Or maybe make an Editor object (singleton) and its methods do all this?
    //        Or fold that into Contribution
    //        Or ContributionLexi members (maybe some Contribution members):
    //           .cont_being_edited
    //           .is_editing
    //           .check_dirty()
    //           .edit_start()
    //           .edit_end()
    //           .edit_cancel()

    var list_play_bot;   // array of contribution id's
    var index_play_bot;
    // TODO:  These should be properties of the Bot instance, right??

    // window.localStorage item names
    const SETTING_PLAY_BOT_SEQUENCE = 'setting.play_bot.sequence';
    const PLAY_BOT_SEQUENCE_ORDER = 'in_order';
    const PLAY_BOT_SEQUENCE_RANDOM = 'random';

    const PLAYLIST_TABLE = {};
    PLAYLIST_TABLE[PLAY_BOT_SEQUENCE_ORDER] = {generate: playlist_in_order};
    PLAYLIST_TABLE[PLAY_BOT_SEQUENCE_RANDOM] = {generate: playlist_random};

    const SETTING_PLAY_BOT_FROM = 'setting.play_bot.from';
    const SETTING_PLAY_BOT_SPEECH = 'setting.play_bot.speech';
    const PLAY_BOT_FROM_MY = 'my';          // \ Possible values for select#play_bot_from options.
    const PLAY_BOT_FROM_OTHERS = 'their';   // / Example use:  categories.by_name['my']

    const PLAY_BOT_SPEECH_OUT_LOUD = 'out loud';
    const PLAY_BOT_SPEECH_ANIMATED = 'animated';
    const PLAY_BOT_SPEECH_OFF = 'off';

    const PLAY_BOT_FROM_STUFF = [
        {
            option_value: PLAY_BOT_FROM_MY,
            label: "from my playlist ({number})"
        },
        {
            option_value: PLAY_BOT_FROM_OTHERS,
            label: "from others playlist ({number})"
        }
    ];

    const MEDIA_STATIC_SECONDS = 10;   // How long to display media we don't know how to automate.

    var talkify_player = null;
    var talkify_playlist = null;
    var talkify_done = null;
    var talkify_voice_name;
    // var $animation_in_progress = null;    // jQuery object for elements currently animating.

    const BOT_CONTEXT = 'bot_context';  // PubSub message context

    const TALKIFY_VOICES_ENGLISH = [
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
    const SECONDS_BREATHER_AT_MEDIA_END          = 2.0;
    const SECONDS_BREATHER_AT_SPEECH_SYNTHESIS_END = 4.0;   // using window.speechSynthesis
    // var SECONDS_BREATHER_AT_TALKIFY_END          = 4.0;
    // var SECONDS_BREATHER_AT_OTHER_MEDIA_END      = 0.0;   // it was ALREADY a delay showing it
    const SECONDS_BREATHER_AFTER_ZERO_TIME         = 0.0;
    // var SECONDS_BREATHER_AT_NOEMBED_ERROR
    const SECONDS_BREATHER_AT_SKIP                 = 0.0;
    const SECONDS_UNFULL_PATIENCE                  = 5.0;
    const SECONDS_ERROR_MESSAGE                    = 5.0;
    var breather_timer = null;
    // var work_in_a_pause = false;

    var bot = null;

    // var txt_from_idn = {};
    // looper(MONTY.IDN, function(name, idn) {
    //     txt_from_idn[idn] = name;
    // });

    // A media handler is a JavaScript file that calls window.qiki.media_register()
    var media_handlers = [];   // array of handlers:  {url: '...', media: {...}, ...}
    var isFullScreen;

    const TOP_SPACER_REM = 1.5;
    const TOP_SPACER_PX = px_from_rem(TOP_SPACER_REM);
    // NOTE:  Presumed to be the practical height of #up-top which is position:fixed,
    //        this is the amount the position:static elements are scooted down.
    // SEE:  contribution.css where TOP_SPACER_PX is mentioned.
    // TODO:  Refactor those occurrences in contribution.css to applying those properties
    //        here in contribution.js, e.g.
    //        $('#up-top').css('height', TOP_SPACER_REM.toString() + 'em');

    const POP_UP_ANIMATE_MS = .500 * 1000;
    const POP_DOWN_ANIMATE_MS = .250 * 1000;
    const POP_UP_ANIMATE_EASING = 'swing';   // swing or linear
    const POP_DOWN_ANIMATE_EASING = 'linear';   // swing or linear

    const MAX_IFRAME_RECOVERY_TRIES = 10;   // Reload a 0 x 0 iframe this many times max.

    const MAX_FONT_EXPANSION = 3.0;   // Popping up a quote, magnify font size up to this factor.

    const INITIAL_CAT_CONT = 40;   // How many contributions to show in a category initially
    const INITIAL_CAT_CONT_QUERY = 'initial';   // query-string variable to override INITIAL_CAT_CONT

    const MORE_CAT_CONT = 20;   // Clicking "N MORE" renders this many contributions
                                // It's also the granularity of the "N MORE" contributions --
                                // they're always an integral multiple of this number.
    const MORE_CAT_CONT_SHIFT = 5 * MORE_CAT_CONT;  // Shift-click renders THIS many
    const DO_WHOLE_UNRENDERED_PIECES = true;  // Show a few more than INITIAL_CAT_CONT initially,
                                              // to make unrendered count an even multiple of
                                              // MORE_CAT_CONT.  This way the "N more" label
                                              // So up to this many are displayed initially:
                                              // INITIAL_CAT_CONT + MORE_CAT_CONT + 1

    const MIN_OPEN_CATEGORY_VIEW = 200;   // When opening a category, if fewer pixels than this
                                          // are in view, scroll up.

    // var OBJECT_IDN_FOR_CONTRIBUTION = 0;   // Used to be QUOTE, but it's never checked so why bother.
    //                                        // Another nail in the coffin of fitting everything into
    //                                        // sbj-vrb-obj.

    // ... text/plain ...
    // THANKS:  Fix Firefox text/plain warning for static media .js files in Windows registry,
    //          https://github.com/pallets/flask/issues/1045#issuecomment-42202749-permalink

    // THANKS:  "var" warnings, EcmaScript 6 to 5, https://stackoverflow.com/q/54551923/673991

    var console_verbose = query_get('console_verbose', false) !== false;

    function set_popped_cont(contribution_instance_or_null) {
        popped_cont = contribution_instance_or_null;
        js_for_unslumping.popped_cont = popped_cont;
    }
    function is_popup() {
        return popped_cont !== null;
    }

    $(function document_ready() {
        pop_speech_synthesis_init();
        qoolbar.ajax_url(MONTY.AJAX_URL);

        category_and_contribution_instantiations(function () {

            // categories.loop(function (_, cat) {
            //     cat.thumb_specs = {
            //         for_width: WIDTH_MAX_EM,
            //         for_height: HEIGHT_MAX_EM
            //     };
            // });
            // categories.by_name.about.thumb_specs = {
            //     for_width: WIDTH_MAX_EM_ABOUT,
            //     for_height: HEIGHT_MAX_EM_ABOUT
            // };

            lex.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                cat.thumb_specs = {
                    for_width: WIDTH_MAX_EM,
                    for_height: HEIGHT_MAX_EM
                };
            });
            lex.cats.by_name.about.thumb_specs = {
                for_width: WIDTH_MAX_EM_ABOUT,
                for_height: HEIGHT_MAX_EM_ABOUT
            };

            build_body_dom();

            $( '#close-button').on('click', function () { pop_down_all(false); });
            $(  '#play-button').on('click', function () { bot.play(); });
            $( '#pause-button').on('click', function () { bot.pause(); });
            $('#resume-button').on('click', function () { bot.resume(); });
            $(  '#stop-button').on('click', function () { bot.stop(); });
            $(  '#skip-button').on('click', function () { bot.skip(); });
            // NOTE:  You might expect lex INTERACT words to all be generated near here, where most
            //        user interaction originates.  But then how to record the controls inside a youtube
            //        video?  Those actions can be detected by events in the youtube API, but those
            //        events also trigger as a result of the click events here.
            //        So most of those words are generated there, in response to youtube events.
            //        But they're generated elsewhere (I forget) for other media interactions.
            //        So the words are generated in diverse places with fiddly conditions.
            //        This is a tiny part of that perennially difficult quest:
            //        machines understanding people.

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
                .on('input', '.contribution, .caption-span', caption_input)
                .on('click', '.contribution', stop_propagation)
                .on('click', '.caption-bar, .save-bar', stop_propagation)
                .on('click', '.render-bar .thumb-link', thumb_click)
                .on('click', '.save-bar .edit',    contribution_edit)
                .on('click', '.save-bar .cancel',  contribution_cancel)
                .on('click', '.save-bar .discard', contribution_cancel)
                .on('click', '.save-bar .save',    contribution_save)
                .on('click', '.save-bar .play',    function () { bigger(this, true); })
                .on('click', '.save-bar .expand',  function () { bigger(this, false); })
                .on('click', '.unrendered', unrendered_click)
                // TODO:  Should play or expand end non-dirty edits?  That could be more consistent:
                //        Closing the popup with Escape does this already.
                //        Closing with the close button, or clicking on the popup-screen does not.

                .on('keydown', keyboard_shortcut_handler)
                // THANKS:  no keyup .preventDefault(), https://stackoverflow.com/a/14055191/673991
                // THANKS:  no keypress on Escape, https://stackoverflow.com/a/38502715/673991

                .on('blur keyup paste input', '[contenteditable=true]', function () {
                    work_around_jumpy_contenteditable_chrome_bug(this);
                })
                .on('click', '#popup-screen', function popup_screen_click() {
                    if (bot.state === bot.State.MANUAL) {
                        // Background clicks only end manual popups, never bot popups.
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
                .on('wheel', '.sup-category', mouse_wheel_handler)
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

            initial_thumb_size_adjustment();
            // TODO:  How does this work so early (we've just called build_body_dom()),
            //        when some contribution thumbnails have not been rendered yet,
            //        by Contribution.rebuild_bars()?
            //        Specifically, those handled by media_noembed.js.
            //        Aren't twitter contributions greatly delayed in their renderings,
            //        and therefore adjustments?
            //        Maybe the size is just limited regardless of its contents, and that's kinda okay.

            settle_down();

            bot = new Bot();
            js_for_unslumping.bot = bot;
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
                    // FALSE WARNING:  Unresolved variable fullScreen
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
                        String(window.innerWidth) + "x" + String(window.innerHeight)
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

            if (cont_array_from_query_string() === null) {
                setTimeout(function () {
                    resizer_nudge_all();
                    // NOTE:  Cheap-ass workaround for the zero-iframe-size bug.
                    // https://github.com/davidjbradshaw/iframe-resizer/issues/629#issuecomment-525498353
                    // But (even cheaper-ass) only do the workaround if no ?cont=NNN
                    // -- that is, if we're not limiting the contributions and showing all of them.
                    // This preserves the failure mode in the above issue report.
                    // FIXME:  Instead, append query-string ?...&disable_zero_size_iframe_workaround
                    //         Or wait until it's fixed.  And then remove this workaround.

                    // An even cheaper cheap-ass workaround:
                    // setTimeout(function () {
                    //     resizer_nudge_all();
                    // }, 10000);

                }, INITIAL_RESIZING_NUDGE_MS);
                // NOTE:  If this delay is not enough, I don't think anything too bad happens.
                //        You might see briefly a wafer-thin iframe before it gives its children
                //        the data-iframe-width attribute that taggedElement needs.
                //        That has to happen after a delay due to provider tricks with the
                //        embedded html (see noembed_render()).
            }
        });
    });

    /**
     * Handle keyboard shortcut `keydown` event.
     *
     * EXAMPLE:  $(window.document).on('keydown', keyboard_shortcut_handler)
     *
     * @param evt
     */
    function keyboard_shortcut_handler(evt) {
        if ( ! handle_keystroke_in_all_contexts(evt)) {
            if ( ! is_text_entry_element(evt.target)) {
                if ( ! handle_keystroke_when_not_typing_text(evt)) {
                    console.info(
                        "ignoring key", evt.key,
                        evt.shiftKey ? "SHIFT"   : "",
                        evt.ctrlKey  ? "CONTROL" : "",
                        evt.altKey   ? "ALT"     : "",
                        evt.metaKey  ? "META"    : "",
                        evt.target.tagName,
                        $(evt.target).attr('id') || ""
                    );
                    // EXAMPLE:  ignoring keystroke F9 SHIFT CONTROL
                }
            }
        }
    }

    /**
     * Does element expect the user to be typing some text?
     *
     * For calling from a keyboard event handler on event_object.target
     * Doesn't matter:  where focus is, what's visible, what's disabled, what's readonly.
     *
     * SEE:  Is typable question, https://stackoverflow.com/q/34149423/673991
     *
     * @param element - jQuery object or DOM object or selector
     * @return {boolean}
     */
    function is_text_entry_element(element) {
        return $(element).is(':input, [contenteditable]');
    }

    /** Handle a keystroke whether the user is entering text or not.
     *
     * @param evt - as passed to jQuery .on() callback
     * @return {boolean} - true=handled it
     */
    // THANKS:  Escape event, https://stackoverflow.com/a/3369624/673991
    function handle_keystroke_in_all_contexts(evt) {
        switch (evt.key) {
        case 'Escape':
            var was_editing = is_editing_some_contribution;
            var was_dirty = check_contribution_edit_dirty(false, true);
            if (was_editing) {
                if (was_dirty) {
                    console.info("Ignoring escape - dirty edit.");
                } else {
                    console.info("Escape - cancel a clean edit.");
                }
            } else {
                if (bot.is_manual()) {
                    if (is_popup()) {
                        console.info("Escape - popping down manual popup.");
                    } else {
                        console.debug("Ignoring escape - no animation, no popup, no editing.");
                    }
                } else {
                    console.info("Escape - stop animation.");
                }
                bot.stop();
            }
            return true;
        default:
            return false;
        }
    }

    /** Handle a keystroke when a user is NOT entering text.
     *
     * @param evt - as passed to jQuery .on() callback
     * @return {boolean} - true=handled it
     */
    // THANKS:  KeyboardEvent.key, https://stackoverflow.com/a/46064532/673991
    // THANKS:  KeyboardEvent.key values,
    //          https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    function handle_keystroke_when_not_typing_text(evt) {
        switch (evt.key) {
        case 'ArrowLeft':
            if (is_popup()) {
                popped_cont.embed_message({ action: 'seek_relative', seconds: -10 });
            } else {
                console.warn("Oops can't seek behind");
            }
            return true;
        case 'ArrowRight':
            if (is_popup()) {
                popped_cont.embed_message({ action: 'seek_relative', seconds: +10 });
            } else {
                console.warn("Oops can't seek ahead");
            }
            return true;
        case 'ArrowDown':
        case 'ArrowUp':
            console.info("volume up/down -- goes here");   // TODO
            return true;
        // case 'Tab':
        //     console.info("tab -- goes here");   // TODO -- but what's shift-tab?
        //     return true;
        case 'f':
        case 'F':
            if (isFullScreen) {
                console.debug("F keystroke to exit full screen");
                // TODO:  This may never happen because in full screen mode, the inner
                //        iframe (hosted at youtube.com) has focus.
                exit_full_screen();
            } else {
                embed_enter_full_screen();
            }
            return true;
        case 'm':
        case 'M':
            console.info("mute -- goes here");   // TODO
            return true;
        case 'n':
        case 'N':
            if (bot.is_manual()) {
                console.warn("N - next - IGNORED");
            } else {
                console.info("N - next");
            }
            bot.skip();
            return true;
        case 'q':
        case 'Q':
            if (bot.is_manual()) {
                console.warn("Q - quit - IGNORED");
            } else {
                console.info("Q - quit");
            }
            bot.stop();
            return true;
        case ' ':
            if (bot.is_manual()) {
                // console.info("spacebar - play");
                // bot.play();
                // NOTE:  This doesn't feel natural.
                //        It would begin the long play of a sequence of contributions.
                //        Just too big of a step to take on a whole web page.
                // SEE:  Spacebar ux, https://ux.stackexchange.com/a/53113/25643
                // TODO:  It could initiate play if a contribution has been manually popped up.
                console.info("spacebar ignored when not playing");
            } else if (bot.is_paused) {
                console.info("spacebar - resume");
                bot.resume();
            } else {
                console.info("spacebar - pause");
                bot.pause();
            }
            evt.preventDefault();
            // NOTE:  Prevent spacebar from scrolling down a web page.
            // SEE:  About that ancient crusty convention of a spacebar scrolling down a web page,
            //       https://ux.stackexchange.com/a/53112/25643
            return true;
        case '?':
            console.info("keyboard help -- goes here");
            // TODO:  Scroll to and open a blurb in the About category?  Noice!
            return true;
        default:
            return false;
        }
    }

    function play_bot_default_others_if_empty_my_category() {
        var is_my_category_empty = lex.cats.by_name.my.conts.num_words() === 0;
        if (is_my_category_empty) {
            var $play_bot_from = $('#play_bot_from');
            var is_bot_playing_from_my_category = $play_bot_from.val() === PLAY_BOT_FROM_MY;
            if (is_bot_playing_from_my_category) {
                $play_bot_from.val(PLAY_BOT_FROM_OTHERS);
                console.log("My category is empty, defaulting play-bot to the other category.");
            }
        }
    }

    function persist_select_element(selector, storage_name) {
        $(selector).on('change', function () {
            window.localStorage.setItem(storage_name, $(selector).val());
        });
        var setting = window.localStorage.getItem(storage_name);
        if (is_specified(setting)) {
            $(selector).val(setting);
        }
    }

    function playlist_random() {
        var playlist = playlist_in_order();
        shuffle(playlist);
        return playlist;
    }

    function cat_idn_for_playlist() {
        var category_code_name = $('#play_bot_from').val();   // e.g. 'my' or 'their'
        var play_bot_from_idn = lex.cats.by_name[category_code_name].idn;   // e.g. 1435
        return play_bot_from_idn;
    }

    function playlist_in_order() {
        var cat_idn = cat_idn_for_playlist();
        var cat = lex.cats.get(cat_idn);
        var cont_array = cat.conts.idn_array();
        return cont_array;
    }

    function playlist_generate() {
        var playlist_selection = $('#play_bot_sequence').val();
        console.assert(
            has(PLAYLIST_TABLE, playlist_selection),
            playlist_selection, "not in", PLAYLIST_TABLE
        );
        return PLAYLIST_TABLE[playlist_selection].generate();
    }


    /**
     * //// Bot //// Automate the playing of media and text.  "Play" button etc.
     *
     * @return {Bot}
     * @constructor
     */
    function Bot() {
        var that = this;
        type_should_be(that, Bot)
        // THANKS:  Automatic 'new', https://stackoverflow.com/a/383503/673991

        // THANKS:  that = this, https://alistapart.com/article/getoutbindingsituations/#snippet26
        //          `that` is set in all methods, so anonymous callbacks don't shadow `this`.

        that.state = that.State.MANUAL;
        that.last_tick_state = null;
        that.ticks_this_state = 0;    // N means state is [N to N+1) seconds old, if no pauses.
        that._interval_timer = null;
        that.ticker_interval_ms(FINITE_STATE_MACHINE_INTERVAL_MS);
        that.breather_seconds = null;
        that.cont = null;       // e.g. id_attribute '1821' a thumbnail
        that.pop_cont = null;   // e.g. id_attribute 'popup_1821' an almost full screen pop-up
        that.is_paused = false;
        // that.cont_idn = null;
        that.did_bot_transition = false;  // Did the bot initiate transition to the next contribution?
    }

    Bot.prototype.State = Enumerate({
        MANUAL: "Normal, manual site operation",
        START_AUTO: "Play starts",
        PREP_CONTRIBUTION: "Prepare for next contribution",
        UNFULL_CONTRIBUTION: "Exiting full screen before the next contribution",
        NEXT_CONTRIBUTION: "Next contribution in playlist",
        MEDIA_READY: "The iframe is showing stuff",                           // dynamic or static
        MEDIA_STARTED: "The iframe dynamically doing stuff, we'll know when it ends",   // dynamic
        MEDIA_TIMING: "The iframe is static",                                           // static
        MEDIA_PAUSE_IN_FORCE: "Both main and iframe agree we're paused",   // no more pause_media() - dynamic only
        MEDIA_ERROR_MESSAGE: "Displaying an error message",
        SPEECH_SHOULD_PLAY: "The text was told to speak",
        SPEECH_STARTED: "The speaking has started",
        DONE_CONTRIBUTION: "Natural ending of a contribution in playlist",
        BREATHER: "Take a breather between popups.",
        POP_DOWN_ONE: "Pop down the current popped-up contribution.",
        POP_DOWN_PATIENCE: "Being patient for pop-down animations to complete",
        BEGIN_ANOTHER: "Begin the next contribution.",
        PLAYING_CONTRIBUTION: "Quiescently automatically playing",
        END_AUTO: "Play ends",
        CRASHED: "Something went horribly wrong"
    });
    Bot.prototype.StateArray = Object.values(Bot.prototype.State);
    // Array of states, [S.MANUAL, S.START_AUTO, ...] where S = Bot.prototype.State
    // TODO:  Fix IE11 error maybe?
    //        Object doesn't support property or method 'values'
    //        Bunch of assert failures too.

    Bot.prototype.State.describe = function(states, delimiter) {
        if (states.length === 0) {
            return "(none)";
        } else {
            var state_names = states.map(function (state) { return state.name; });
            return state_names.join(delimiter);
        }
    }

    Bot.prototype.play = function Bot_play() {
        var that = this;
        that.transit([that.State.MANUAL], that.State.START_AUTO);
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
    //        that.transit([S.OLD_STATE], S.NEW_STATE);
    Bot.prototype.transit = function Bot_transit(old_states, new_state) {
        var that = this;
        console.assert(that.is_valid_state(new_state), new_state);
        if (that.assert_state_is(old_states, "transitioning to " + new_state.name)) {
            that.state = new_state;
            return true;
        } else {
            if (new_state === that.state) {
                console.warn("Transit, but already in state", that.state.name);
                return false;
            }
            that.crash(
                "TRANSIT CRASH expecting", that.State.describe(old_states, ","),
                "  not", that.state.name,
                "  before", new_state.name
            );
            return false;
        }

        // if (has(old_states, that.state)) {
        //     that.state = new_state;
        //     return true;
        // } else if (new_state === that.state) {
        //     console.warn("Transit, but already in state", that.state.name);
        //     return false;
        // } else {
        //     that.crash(
        //         "TRANSIT CRASH expecting", that.State.describe(old_states),
        //         "  not", that.state.name,
        //         "  before", new_state.name
        //     );
        //     return false;
        // }
    };

    /**
     * Is this object a valid Bot state?
     *
     * @param maybe_state
     * @return {boolean}
     */
    Bot.prototype.is_valid_state = function Bot_is_state(maybe_state) {
        var that = this;
        return has(that.StateArray, maybe_state);
    };

    Bot.prototype.is_manual = function Bot_is_manual() {
        var that = this;
        return that.state === that.State.MANUAL;
    };

    Bot.prototype.assert_state_is = function Bot_assert_state_is(states, context) {
        var that = this;
        type_should_be(states, Array) && console.assert(that.is_valid_state(states[0]));
        if (has(states, that.state)) {
            return true;
        } else {
            var context_if_any = is_defined(context) ? " - " + String(context) : "";
            console.error(
                "Expected state",
                that.State.describe(states, " or "),
                "-",
                "but got state",
                that.state.name,
                context_if_any
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
        do {
            // TODO:  Loop instead with setInterval and clearInterval?
            //        So as not to pile up too much rendering.
            var BORING_STATES = [
                that.State.MANUAL,
                that.State.PLAYING_CONTRIBUTION
            ];
            var is_interesting_state = ! has(BORING_STATES, that.state);
            var is_interesting_time = that.ticks_this_state === 0;
            if (is_interesting_state || is_interesting_time) {
                if (DEBUG_BOT_STATES) console.log("Bot", that.state.name, that.ticks_this_state);
            }
            that.last_tick_state = that.state;
            try {
                that.finite_state_machine();
            } catch (e) {
                that.crash("FSM:", e.message, e.stack);
                // NOTE:  e.stack shows the stack-trace of the exception where it first happened.
                //        console.trace() on the other hand just shows the stack-trace HERE.
            }
            var did_fsm_change_state = that.state !== that.last_tick_state
        } while (did_fsm_change_state);
    };

    Bot.prototype.on_exit_full_screen = function Bot_on_exit_full_screen() {
        var that = this;
        if (that.state === that.State.UNFULL_CONTRIBUTION) {
            that.state = that.State.NEXT_CONTRIBUTION;
            console.log("Moving on after exiting full screen.");
            // TODO:  Hasten to finite_state_machine() for this step?
            //        Instead of waiting (for 0-1 seconds)?
        }
    };

    Bot.prototype.time_out = function (seconds, to_state) {
        var that = this;
        if (that.ticks_this_state >= seconds) {
            that.transit([that.state], to_state);
            return true;
        }
        return false;
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
        var S = that.State;

        switch (that.state) {
        case S.MANUAL:
            break;
        case S.START_AUTO:
            list_play_bot = playlist_generate();
            console.log("playlist", list_play_bot.join(" "));
            index_play_bot = 0;
            that.media_beginning();
            that.state = S.PREP_CONTRIBUTION;
            // interact_old.bot(cat_idn_for_playlist(), 1, list_play_bot.join(","));
            interact_new.bot({
                category: cat_idn_for_playlist(),
                sequence: sequence_nit(list_play_bot)
            });
            // NOTE:  When there is a feature for the Bot to play from a more diverse set than
            //        merely categories MY and THEIR, then the obj should be a word representing
            //        that set.
            break;
        case S.PREP_CONTRIBUTION:
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
                that.state = S.UNFULL_CONTRIBUTION;
            } else {
                that.state = S.NEXT_CONTRIBUTION;
            }
            break;
        case S.UNFULL_CONTRIBUTION:
            if (that.time_out(SECONDS_UNFULL_PATIENCE, S.NEXT_CONTRIBUTION)) {
                console.warn("Unable to exit full screen, moving on anyway.");
            }
            break;
        case S.NEXT_CONTRIBUTION:
            if (index_play_bot >= list_play_bot.length) {
                that.state = S.END_AUTO;
                // NOTE:  Natural automatic Bot ending - at the end of all contributions.
                //        May never happen!
                break;
            }
            var idn_string = list_play_bot[index_play_bot];
            that.cont = lex.cont_from_idn(idn_string);
            if (that.cont.media_domain === 'no_domain') {
                // NOTE:  A badly formatted URL should not be popped up at all.
                console.log("Zero time for", that.cont.id_attribute);
                that.end_one_begin_another(SECONDS_BREATHER_AFTER_ZERO_TIME, true);
            } else {
                if ( ! that.cont.is_dom_rendered()) {
                    // throw Error("Not yet implemented - popping up an unrendered contribution such as " + String(that.cont.idn));
                    that.cont.cat.render_rando_cont(that.cont);
                    that.cont.cat.show_unrendered_count();
                    // CAUTION:  This will break:  lex.assert_consistent();
                    //           because there's a temporarily rendered contribution that's probably
                    //           out of order.
                    that.cont.is_temporarily_rendered = true;
                }
                $(window.document.body).addClass('pop-up-auto');
                that.cont.cat.valve.set_openness(true);
                that.cont.pop_up(true);
                that.pop_begin(popped_cont);
                // TODO:  Reform this weird corrupt mix of global and member variables.
                //        pop_up() outputs popup_cont, but Bot.pop_begin() fiddles with Bot.pop_cont
                //        Then the real crime:  Some Bot methods use one, some the other.
                //        This *case* of this method uses both!!
                //        One complication with going fully to Bot.pop_cont is that a contribution
                //        can be MANUALLY popped up.  Not part of the Bot animation "play" button.
                //        Maybe the solution is to have another loop of Bot states for manually
                //        popping up.  Then starting, ending, pausing, and resuming could happen
                //        there too?  Are these called swim-lanes?
                that.state = S.PLAYING_CONTRIBUTION;
                var E = that.pop_cont.Event;
                function ON(event, handler) {
                    that.pop_cont.on_event(event, handler);
                }
                // TODO:  Move event handlers to the individual state handlers.
                //        That is, make events more synchronous.
                //        The .assert_state_is() calls are a preliminary way to find out which
                //        states actually handle which events.
                ON(E.MEDIA_INIT, function () {
                    that.transit([S.PLAYING_CONTRIBUTION], S.MEDIA_READY);
                });
                ON(E.MEDIA_BEGUN, function () {
                    that.transit([
                        S.MEDIA_READY,
                        S.PLAYING_CONTRIBUTION   // e.g. MEDIA_BEGUN came before MEDIA_INIT on bogus
                    ], S.MEDIA_STARTED);
                });
                ON(E.MEDIA_ERROR, function (data) {
                    that.assert_state_is([
                        S.PLAYING_CONTRIBUTION,   // e.g. unsupported videos, or bogus URLs
                        S.MEDIA_STARTED           // e.g. youtube videos deleted or restricted
                    ]);
                    // interact_old.error(popup_cont.idn, 1, data.message);
                    interact_new.error({contribute: popped_cont.idn, text: data.message});
                    that.end_one_begin_another(SECONDS_ERROR_MESSAGE, true);
                });
                ON(E.MEDIA_STATIC, function (data) {
                    if (that.transit([S.MEDIA_READY], S.MEDIA_TIMING)) {
                        // NOTE:  This if-check prevents the double START interact of 13-Apr-20.
                        //        Because Contribution.zero_iframe_recover() reloaded the iframe.
                        // interact_old.start(data.idn, data.current_time);
                        interact_new.start({
                            contribute: data.idn,
                            progress: ms_round(data.current_time)
                        });
                    }
                });
                ON(E.MEDIA_ENDED, function () {
                    that.transit([
                        S.MEDIA_STARTED,
                        S.MEDIA_PAUSE_IN_FORCE
                    ], S.DONE_CONTRIBUTION);
                    that.pop_end();
                });
                // ON(E.MEDIA_PLAYING, function (/*data*/) {
                //     if (that.is_paused) {
                // //         that.assert_state_is([
                // //             S.MEDIA_PAUSE_IN_FORCE   // dynamic resume, parent or embed, bot only
                // //         ]);
                // //         console.log("Media resuming", data.idn);
                // //         interact.resume(data.idn, data.current_time);   // dynamic resume
                //         that._pause_ends();
                //     } else {
                // //         that.assert_state_is([
                // //             S.MEDIA_STARTED   // dynamic play for the first time, bot only
                // //         ]);
                // //         console.log("Media started playing", data.idn);
                // //         interact.start(data.idn, data.current_time);
                // //         // NOTE:  Don't think it's possible to get a double START on dynamic media
                // //         //        the way it was with static media.
                // //         //        We got here from an auto-play-playing message from the embed
                // //         //        and that could not hardly have come from a zero-size iframe.
                //     }
                // });
                ON(E.MEDIA_PAUSED, function () {
                    // TODO:  This is where we disentangle a pause initiated by the outer website,
                    //        from one initiated by the embedded youtube iframe.
                    //        Move this disentanglement to media_youtube.js or something.
                    if (that.is_paused) {
                        that.assert_state_is([
                            S.MEDIA_STARTED,          // dynamic pause initiated by parent
                            S.MEDIA_PAUSE_IN_FORCE,   // pause very soon after resume
                            S.MEDIA_TIMING,           // static media
                            S.BREATHER                // 401 Unauthorized, user paused then skipped
                        ]);
                        // NOTE:  Expected - main-page pause, fed back by iframe-embedded code
                        //        main page --> iframe
                        console.debug("pause confirmed by embed");
                    } else {
                        that.assert_state_is([
                            S.MEDIA_STARTED,          // dynamic pause initiated by embed
                            S.MEDIA_PAUSE_IN_FORCE    // pause very soon after resume
                        ]);
                        // NOTE:  Surprise - the (dynamic) embedded pause button was hit
                        //        main page <-- iframe
                        that._pause_begins();
                        console.debug("Pause initiated by embed.");
                    }
                    if (that.state === S.MEDIA_STARTED) {
                        console.assert(that.is_paused);
                        that.state = S.MEDIA_PAUSE_IN_FORCE;
                        // NOTE:  This transition stops the repetition of (dynamic) pause_media().
                    }
                });
                // ON(E.MEDIA_RESUME, function () {
                //     that.assert_state_is([
                //     ]);
                //     // NOTE:  This event only happens when resuming paused STATIC media.
                //     if (that.is_paused) {
                //         // NOTE:  Surprise - the embedded resume button was hit.
                //         //        main page <-- iframe
                //         // TODO:  This isn't possible any more, only static media gets here.
                //         //        and static media has no embedded resume capability!
                //         that._pause_ends();
                //     } else {
                //         console.warn("Resume redundant?");
                //         // NOTE:  Expected - main-page resume fed back by iframe, or
                //         //        Expected - play started from the beginning
                //         //        main page --> iframe
                //     }
                // });
                ON(E.SPEECH_PLAY, function () {
                    that.transit([S.PLAYING_CONTRIBUTION], S.SPEECH_SHOULD_PLAY);
                });
                ON(E.SPEECH_START, function () {
                    that.transit([S.SPEECH_SHOULD_PLAY], S.SPEECH_STARTED);
                });
                ON(E.SPEECH_END, function () {
                    that.transit([
                        S.SPEECH_STARTED,
                        S.SPEECH_SHOULD_PLAY
                    ], S.DONE_CONTRIBUTION);
                    // TODO:  that.pop_end() really unnecessary?
                });
            }
            break;
        case S.PLAYING_CONTRIBUTION:
            break;
        case S.MEDIA_READY:
            // NOTE:  Awaiting MEDIA_BEGUN event (for dynamic media) leads to MEDIA_STARTED state
            //             or MEDIA_STATIC event (for static media) leads to MEDIA_TIMING state
            //             or MEDIA_ERROR (e.g. noembed error) leads to breather then next cont
            break;
        case S.MEDIA_TIMING:
            // Static media, e.g. jpg on flickr, show it for a while.
            if (that.time_out(MEDIA_STATIC_SECONDS, S.POP_DOWN_ONE)) {
                that.did_bot_transition = true;
            }
            break;
        case S.MEDIA_STARTED:
            break;
        case S.MEDIA_PAUSE_IN_FORCE:
            if ( ! that.is_paused) {
                that.state = that.State.MEDIA_STARTED;
            }
            break;
        case S.SPEECH_SHOULD_PLAY:
            // NOTE:  Wait at least 1 second to retry.
            //        Actual delays from speak-method to start-event in ms:
            //            27, 131, 11 - Chrome
            //            30 - Opera
            //            231, 170 - Firefox
            if (that.ticks_this_state === 2) {   // Warn once
                var n_characters;
                try {
                    n_characters = String(utter.text.length) + " characters";
                } catch (e) {
                    n_characters = "((" + e.message + "))";
                }
                // flub(f("Speech {n_characters} failed to start", {
                //     n_characters: n_characters
                // }));

                window.speechSynthesis.cancel();
                // NOTE:  This is a workaround for the text-not-speaking bug.

                window.speechSynthesis.speak(utter);
            }
            break;
        case S.SPEECH_STARTED:
            break;
        case S.DONE_CONTRIBUTION:
            that.did_bot_transition = true;
            if (that.cont.is_media) {
                that.end_one_begin_another(SECONDS_BREATHER_AT_MEDIA_END, true);
            } else {
                that.end_one_begin_another(SECONDS_BREATHER_AT_SPEECH_SYNTHESIS_END, true);
            }
            break;
        case S.BREATHER:
            that.time_out(that.breather_seconds, S.POP_DOWN_ONE);
            break;
        case S.POP_DOWN_ONE:
            that.pop_end();
            that.transit([S.POP_DOWN_ONE], S.POP_DOWN_PATIENCE);
            pop_down_all(that.did_bot_transition, function bot_pop_down_then() {
                that.transit([
                    S.POP_DOWN_PATIENCE,
                    S.BREATHER   // during pop-down animation, user hit skip
                ], S.BEGIN_ANOTHER);
            });
            break;
        case S.POP_DOWN_PATIENCE:
            // Waiting for pop-down animation to complete, between Bot-automated contributions.
            break;
        case S.BEGIN_ANOTHER:
            index_play_bot++;
            that.state = S.PREP_CONTRIBUTION;
            break;
        case S.CRASHED:
            // NOTE:  Leaving things messy, for study.  May regret this.
            that.state = S.MANUAL;
            // NOTE: Abrupt catastrophic Bot ending.  Something went wrong.
            break;
        case S.END_AUTO:
            that.media_ending();
            // interact_old.unbot(cat_idn_for_playlist(), 1);
            interact_new.unbot({category: cat_idn_for_playlist()});
            that.state = S.MANUAL;
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
        var S = that.State;

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
        case S.MEDIA_STARTED:
            that.pause_media();
            // NOTE:  Be persistent trying to get the media to pause.
            //        But stop calling pause_media() after embed says auto-play-paused.
            //        (That stopping is the whole reason S.MEDIA_PAUSE_IN_FORCE was invented.)
            // TODO:  This might come too early.  Do only after Event.MEDIA_WOKE?  Who cares?
            break;
        case S.SPEECH_SHOULD_PLAY:
            that.pause_speech();
            // NOTE:  Persistent trying to get speech to stop.
            //        Don't stop.
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
        console.log(f("(bot breather {sec})", {sec: seconds_delay.toFixed(1)}));
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

    Bot.prototype.crash = function Bot_crash(/* arguments, arguments, ... */) {
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

    // Bot.prototype.assert = function Bot_assert(/* condition, arguments */) {
    //     var that = this;
    //     var assert_arguments = Array.prototype.slice.call(arguments);
    //     var condition = assert_arguments.shift();
    //     assert_arguments.unshift("Assertion failed:");
    //     if ( ! condition) {
    //         that.crash.apply(that, assert_arguments);
    //         // noinspection JSConstructorReturnsPrimitive
    //         return false;
    //     }
    //     // noinspection JSConstructorReturnsPrimitive
    //     return true;
    // };
    // NOTE:  This looks too much like console.assert() which does not interrupt flow.

    /**
     * Pause initiated by the main page.
     */
    Bot.prototype.pause = function Bot_pause() {
        var that = this;
        console.assert( ! that.is_paused, "Redundant pause", that.state);
        that._pause_begins();
        console.log("Pause initiated by main page");
        that.pause_media();   // TODO:  Only from state MEDIA_STARTED or MEDIA_READY?
        that.pause_speech();  // TODO:  Only from state SPEECH_STARTED or SPEECH_SHOULD_PLAY?
    };

    /**
     * Pause initiated by either the main page or the embedded iframe.
     */
    Bot.prototype._pause_begins = function Bot_pause_begins() {
        var that = this;
        that.is_paused = true;
        $(window.document.body).addClass('pausing-somewhere');
    };

    Bot.prototype._pause_ends = function Bot_pause_ends() {
        var that = this;
        that.is_paused = false;
        $(window.document.body).removeClass('pausing-somewhere');
    };

    Bot.prototype.pause_media = function Bot_pause_media() {
        if (is_popup()) {
            popped_cont.embed_message({ action: 'pause' });
            // NOTE:  Indiscriminately send this to static media and error messages that don't need it.
        }
    };

    Bot.prototype.pause_speech = function Bot_pause_speech() {
        window.speechSynthesis.pause();
        // NOTE:  Is this the source of the non-starter speech synthesis bug, the workaround
        //        for which was .cancel() before .speak()?
        // TODO:  Why is speech pause delayed 4 words?
    };

    Bot.prototype.resume = function Bot_resume() {
        var that = this;
        console.assert(that.is_paused, "Redundant resume", that.state);
        if (that.is_dynamic_resume_called_for()) {
            console.log("Resume dynamic media, initiated by main page");
            popped_cont.embed_message({ action: 'resume' });   // dynamic, non-error, bot popped up
            // NOTE:  ._pause_ends() will happen after embed messages back auto-play-playing.
        } else if (utter !== null) {
            console.log("Resume text.");
            window.speechSynthesis.resume();
            // NOTE:  utter events will trigger interact.resume()
            that._pause_ends();
        } else if (is_popup() && ! popped_cont.is_noembed_error) {
            console.log("Resume static media.  Or dynamic media's breather after it completed.");
            // interact_old.resume(popup_cont.idn, bot.ticks_this_state);   // static resume
            interact_new.resume({
                contribute: popped_cont.idn,
                progress: ms_round(bot.ticks_this_state)
            });   // static resume
            that._pause_ends();
        } else {
            console.log("Resume timing out error message.");
            // NOTE:  We get here with an error message
            //        Nothing to do but let the FSM pick up where it left off.
            that._pause_ends();
        }
    };

    Bot.prototype.is_dynamic_resume_called_for = function Bot_is_dynamic_resume_called_for() {
        var that = this;
        return (
            is_popup() &&             // not if no popup
            popped_cont.is_media &&             // not if text
            popped_cont.is_able_to_play &&      // not if instagram photo
            ! popped_cont.is_noembed_error &&   // no, error message is not dynamic
            has([
                that.State.MEDIA_PAUSE_IN_FORCE,   // yes if embed initiated or confirmed pause
                that.State.MEDIA_STARTED           // yes if embed hasn't confirmed pause yet
            ], that.state)
        );
    };

    Bot.prototype.stop = function Bot_stop() {
        var that = this;
        that._pause_ends("stop");
        if (that.is_manual()) {
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
        if (that.is_manual()) {
            console.warn("Mysteriously but harmlessly getting a skip when not animating or anything.");
        } else {
            that._pause_ends("skip");
            if (index_play_bot < list_play_bot.length) {
                console.log("Skipping idn", list_play_bot[index_play_bot], "at state", that.state.name);
            } else {
                console.error("Skip shouldn't be possible", index_play_bot, list_play_bot, that.state.name);
            }
            that.pop_end();
            that.end_one_begin_another(SECONDS_BREATHER_AT_SKIP, false);
        }
    };

    function ms_round(seconds) {
        return Math.round(seconds * 1000.0);
    }
    console.assert(1945 === ms_round(1.9447))

    /**
     * Prepare the sequence sub-nit of an interact.bot nit.
     *
     * Reasons why the sequence sub-nit always starts with the sequence_idn:
     *     Avoids the weird edge-case-problem-prone situation of a sub-nit being a container
     *         but the bytes part of the nit always being the first item contained.
     *         What do you do when the container is empty?!
     *         Should the sub-nit be a nat??  Edge cases are dumb!
     *
     * Can't decide whether to then eliminate the sequence idn from the interact.bot definition.
     *     Because it's then doubly specified.
     *     Better instead to make the sequence field be more like a Python kwarg than an arg,
     *     that is, a "named" argument versus an ordered argument.
     * All this shines light on the sub-nit in a define specifying the sequence of field idns.
     *     Shouldn't that sub-nit have a specific bytes value?  What??
     *     The type of the sequence? But that's known at define time:
     *         For a definition, the subtypes are definition idns.
     *         For an interact.bot, the subtypes are contribution idns.
     *         Same could be said about the sequence idn, the information is redundant and misplaced.
     * TODO:  Why can't the bytes be always empty?
     * For now, the bot sequence always begins with the sequence idn.
     * This might be the only case where a Bot method needs to know ContributionUnslumping
     *     (the Lexi) exists and use its stuff, specifically the sequence idn.
     *     At least that breakage of encapsulation is encapsulated here.  FOR NOW.
     *
     * SEE:  IDN_SEQUENCE in fliki.py where the idn sequence is defined and used to artificially
     *       prepend all interact.bot sequence fields.
     */
    function sequence_nit(list_of_contribution_idns) {
        var sequence_idn = lex.idn_of.sequence;
        var nit_array = [sequence_idn].concat(list_of_contribution_idns)
        return nit_array;
    }


    /**
     * //// Instantiate //// - Category and Contribution collections - and fill them from lex.
     */
    function category_and_contribution_instantiations(then) {
        // categories = new CategoriesUnslump();
        //
        // contribution_lexi = new ContributionsUnslump(categories);

        // contribution_lexi.idn_of._me = MONTY.me_idn;

        // looper(MONTY.cat_words, function (index, cat_word) {
        //     categories.word_pass(cat_word);
        //     // NOTE:  So for unslumping.js, MONTY.cat_words[] defines the order of categories
        //     //        on the screen.
        // });

        // NOTE:  Setting the fence_post_right values for the cont_sequence in each Category
        //        instance, must come AFTER the above CategoryLexi.word_pass() calls,
        //        which populate this collection of categories.
        //        And it has to come BEFORE all the ContributionLexi.word_pass() calls
        //        because they will need to know the fence_post_right values.

        // categories.loop(function (_, cat) {
        //     cat.cont_sequence.fence_post_right = MONTY.IDN.FENCE_POST_RIGHT;
        //     // TODO:  Move this to application-specific Category subclass,
        //     //        if we ever think of a name for it that doesn't confuse.
        // });
        // OOPS:  Can't do this before load_nits() because we don't know what the categories are.
        //        Can't do this after load_nits() because it processes all the reordering words
        //        that USE the fence-post-right value.
        //        Therefore this MUST happen inside load_nits().  In its category: callback.

        // looper(MONTY.w, function (_, word) {
        //     contribution_lexi.word_pass(word);
        // });

        // load_nits(contribution_lexi, function () {
        //     contribution_lexi.assert_consistent();   // more interesting after .word_pass() calls
        //     // NOTE:  Early consistency check makes sure the .word_pass(MONTY.w) worked well.
        //     //        It requires a special provision in .assert_consistent() because nothing is
        //     //        rendered yet, and there are no .unrendered sections to count the not-rendered.
        //
        //     console.log("contribution_lexi", contribution_lexi);
        //     // NOTE:  category_lexi shows up as a property of contribution_lexi
        //     categories.loop(function (_, cat) {
        //         cat.thumb_specs = {
        //             for_width: WIDTH_MAX_EM,
        //             for_height: HEIGHT_MAX_EM
        //         };
        //     });
        //     categories.by_name.about.thumb_specs = {
        //         for_width: WIDTH_MAX_EM_ABOUT,
        //         for_height: HEIGHT_MAX_EM_ABOUT
        //     };
        //     // TODO:  .thumb_specs should be set in a Category subclass constructor.
        //
        // });






        // scan_lex_jsonl(contribution_lexi, function () {
        //     contribution_lexi.assert_consistent();   // more interesting after .word_pass() calls
        //     // NOTE:  Early consistency check makes sure the .word_pass(MONTY.w) worked well.
        //     //        It requires a special provision in .assert_consistent() because nothing is
        //     //        rendered yet, and there are no .unrendered sections to count the not-rendered.
        //
        //     categories.loop(function (_, cat) {
        //         cat.thumb_specs = {
        //             for_width: WIDTH_MAX_EM,
        //             for_height: HEIGHT_MAX_EM
        //         };
        //     });
        //     categories.by_name.about.thumb_specs = {
        //         for_width: WIDTH_MAX_EM_ABOUT,
        //         for_height: HEIGHT_MAX_EM_ABOUT
        //     };
        //     // TODO:  .thumb_specs should be set in a Category subclass constructor.
        //
        //     then();
        // });






        // FALSE WARNING:  Invalid number of arguments, expected 0
        //                 because PyCharm doesn't see the qiki.Lex class in lex.js
        // noinspection JSCheckFunctionSignatures
        lex = new LexContribution('/meta/static/data/unslumping.lex.jsonl');

        qiki.lex = lex;
        // NOTE:  Make the lex instance available for debugging.

        // lex.clex = contribution_lexi;
        lex.scan(function () {

            lex.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                cat.kludge_cat_features();
            });

            lex.assert_consistent();

            console.debug("Lex", lex);

            if (DO_REPORT_EDIT_HISTORIES) {
                lex.editing_history_report();
            }

            then();

        }, function (error_message) {
            console.error("Lex scan fail:", error_message);
        });
    }

    class LexContribution extends qiki.LexCloud {
        constructor(...args) {
            super(...args)
            var that = this;
            $.extend(that.idn_of, {   // mapping name ==> idn for lex-defined words

                category: qiki.Lex.IDN_UNDEFINED,
                locus: qiki.Lex.IDN_UNDEFINED,
                contribute: qiki.Lex.IDN_UNDEFINED,
                caption: qiki.Lex.IDN_UNDEFINED,
                edit: qiki.Lex.IDN_UNDEFINED,
                rearrange: qiki.Lex.IDN_UNDEFINED,
                rightmost: qiki.Lex.IDN_UNDEFINED,
                interact: qiki.Lex.IDN_UNDEFINED,

                // ip_address: IDN_UNDEFINED,
                // user_agent: IDN_UNDEFINED,
                // browse: IDN_UNDEFINED

                // NOTE:  The categories are not here (my, their, trash, etc.).
                //        Those idns are available as e.g. lex.cats.by_name.my.idn
                // NOTE:  The interact verbs are not here.
                //        They are not defined until and unless they're used.
                //        And we allow new ones to come and go without complaint.
                //        And they are referred to only by name in this code, not idn.
            });
            that.cats = new qiki.Bunch();
            that.me_idn = MONTY.me_idn;
        }
        am_i_admin() {
            return this.is_user_admin(this.me_idn);
        }
        am_i_authenticated() {
            return this.is_authenticated(this.me_idn);
        }
        notify(message) {
            var that = this;
            if (console_verbose) {
                console.log(message);
            }
            that.last_notify_message = message;
        }
        // word_factory(idn, whn, sbj, vrb, ...obj_values) {
        //     var that = this;
        //     if (sbj === that.idn_of.lex && vrb === that.idn_of.define && obj_values[0] === that.idn_of.category) {
        //         that.word_class = CategoryWord;
        //     } else if (vrb === that.idn_of.contribute || vrb === that.idn_of.edit) {
        //         that.word_class = ContributionWord;
        //     } else {
        //         that.word_class = qiki.Word;
        //     }
        //     return super.word_factory(idn, whn, sbj, vrb, ...obj_values);
        // }
        each_definition_word(word) {
            var that = this;
            super.each_definition_word(word);
            if (word.obj.parent === this.idn_of.category) {
                // that.clex.category_lexi.add_cat(word.idn, word.obj.name);

                word.transmogrify_class(CategoryWord);
                word.conts = new qiki.Bunch();
                that.cats.add_rightmost(word);

                that.category_rightmost_resolve();   // in case rightmost is defined first
            }
            if (word.idn === that.idn_of.rightmost) {
                that.category_rightmost_resolve();   // in case categories are defined first
            }
        }
        me_title() {
            return this.possessive(this.me_idn) + " " + MONTY.WHAT_IS_THIS_THING;
        }
        /**
         * Inform categories about the idn representing the rightmost position.
         *
         * Whether categories are defined first, or the 'rightmost' word is defined first,
         * calling this after either definition ensures that the categories are kept as up-to-date
         * as possible.
         *
         * So this may get called redundantly but the cost is negligible.
         */
        category_rightmost_resolve() {
            var that=this;
            if (is_specified(that.idn_of.rightmost)) {
                // that.clex.category_lexi.loop(function (_, cat) {
                //     cat.cont_sequence.fence_post_right = that.idn_of.rightmost;
                // });
            }
        }
        each_reference_word(word) {
            var that = this;
            super.each_reference_word(word);
            switch (word.vrb) {
            case that.idn_of.contribute:
                word.transmogrify_class(ContributionWord);
                that.contribute_word(word);
                break;
            case that.idn_of.edit:
                word.transmogrify_class(ContributionWord);
                that.edit_word(word);
                break;
            case that.idn_of.caption:
                that.caption_word(word);
                break;
            case that.idn_of.rearrange:
                that.rearrange_word(word);
                break;
            // case that.idn_of.iconify:
            // case that.idn_of.name:
            // case that.idn_of.browse:
            // case that.idn_of.admin:
            // case that.idn_of.ip_address:
            // case that.idn_of.user_agent:
            //     break;
            // default:
            //     if (word instanceof InteractWord) {
            //         // TODO:  Someday do something with all the interacts the
            //         //        contribution has had.
            //     } else {
            //         console.warn("Unrecognized reference word", word.idn, "verb", word.vrb);
            //     }
            //     break;
            }
        }
        contribute_word(word) {
            var that = this;
            if ( ! has(that.from_user, word.sbj) && that.is_authenticated(word.sbj)) {
                // TODO:  Higher bar for word.sbj.  This will pass if either name or icon have
                //        been scanned already (or admin).
                console.warn(
                    "Contribution word", word.idn,
                    "scan line", this.line_number,
                    "unknown authenticated user", word.sbj
                );
            }
            if ( ! (
                is_specified(that.cats.by_name.my) &&
                is_specified(that.cats.by_name.anon) &&
                is_specified(that.cats.by_name.their)
            )) {
                that.scan_fail(
                    "Contribution word", word.idn,
                    "before categories defined", that.cats.by_name
                );
            }



            // that.clex.contribute_word(word);



            word.cat = that.starting_cat(word);
            word.cat.conts.add_leftmost(word);

            if ( ! that.is_authenticated(word.sbj)) {
                word.was_submitted_anonymous = true;
                // NOTE:  Pink is the color of anonymous contributions.
                //        Captioning or moving a contribution retains its .was_submitted_anonymous
                //        But editing by a logged-in user removes it.
            }

            // NOTE:  Captioning does not change a contribution's owner.
            //        (It does change the caption's owner.)
            //        Moving and editing do change the contribution's owner.
            //        (They do not change the caption's owner.  One way this could be weird:
            //        if I move an anonymous contribution to "my" category, then that user
            //        edits the caption, I will see the new caption too.  So this is a possible
            //        leak between anonymous users.)
            that.notify(f("{idn}. {owner} contributes {n} bytes to {cat}", {
                idn: word.idn,
                owner: that.user_name_short(word.sbj),
                cat: word.cat.obj.name,
                n: word.obj.text.length
            }));


            // that.affirm_notifies_match();
        }
        caption_word(word) {
            var that = this;



            // that.clex.caption_word(word);



            // var cont_idn = word.obj.contribute;   // word.contribute || word.obj;
            // var new_capt_idn = word.idn;
            // var new_capt_txt = word.obj.text;   // is_defined(word.text) ? word.text : word.txt;
            // var new_capt_owner = word.sbj;

            var cont = that.cont_from_idn(word.obj.contribute);
            if (cont === null) {
                that.notify(f("{capt_idn}. (Can't caption {cont_idn})", {
                    cont_idn: word.obj.contribute,
                    capt_idn: word.idn
                }));
            } else {
                var old_capt_owner;
                if (is_specified(cont.capt)) {
                    old_capt_owner = cont.capt.sbj;
                } else {
                    old_capt_owner = cont.sbj;
                }
                if (that.is_authorized(word, old_capt_owner, "caption")) {
                    cont.capt = word;
                }
            }
            // that.affirm_notifies_match();
        }
        edit_word(word) {
            var that = this;


            // that.clex.edit_word(word);



            // var old_cont_idn = word.obj.contribute;   // word.contribute || word.obj;
            // var new_cont_idn = word.idn;
            // var new_cont_owner = word.sbj;
            // var edit_text = word.obj.text;   // is_defined(word.text) ? word.text : word.txt;
            // var new_cont;

            var old_cont = that.cont_from_idn(word.obj.contribute);
            if (old_cont === null) {
                if (that.is_me(word.sbj)) {
                    // NOTE:  Weird situation:  I did this edit, but for some reason the old contribution
                    //        that this edit displaces was not in my view.  Oh well, treat the edit itself
                    //        as a new contribution from me.  This is problematic of course if I was merely
                    //        edited some contribution somewhere that was subsequently lost.  I don't
                    //        necessarily want it elevated to my category.  But I guess it's better than
                    //        not seeing it at all.
                    word.cat = that.starting_cat(word);
                    word.cat.conts.add_leftmost(word);
                    // word.supersedes_idn = word.obj.contribute;
                    that.notify(f("{new_cont_idn}. Resurrecting my edit of ghostly #{old_cont_idn})", {
                        new_cont_idn: word.idn,
                        old_cont_idn: word.obj.contribute
                    }));
                } else {
                    that.notify(f("{new_cont_idn}. (Can't edit {old_cont_idn})", {
                        new_cont_idn: word.idn,
                        old_cont_idn: word.obj.contribute
                    }));
                }
            } else {
                if (that.is_authorized(word, old_cont.sbj, "edit")) {
                    old_cont.cat.conts.replace(word.obj.contribute, word);
                    word.cat = old_cont.cat;
                    word.capt = old_cont.capt;
                    // TODO:  Should a lesser-privileged caption owner
                    //        be replaced by new_cont_owner?
                    //        Maybe always do this here:
                    //            word.capt.owner = word.sbj;
                    //        Is there a downside?
                    //        What does it mean to "own" a contribution or caption??
                    //        It's certainly not equivalent to being permitted to edit it.
                    // if (is_specified(old_cont.superseded_by_idn)) {
                    //     console.warn(
                    //         "Edit fork:",
                    //         old_cont.idn,
                    //         "was edited twice, first by",
                    //         old_cont.superseded_by_idn,
                    //         "now by",
                    //         word.idn
                    //     );
                    //     // Probably harmless.  Different non-admin users, editing the same cont?
                    //     // TODO:  Chronicle the sequence of owners too?
                    //     // NOTE:  This is probably not the only fork.
                    // }
                    // old_cont.superseded_by = word;
                    if (DO_REPORT_EDIT_HISTORIES) {
                        word.supersedes = old_cont;
                        // NOTE:  This maintains a reference to the older, superseded contribute
                        //        word (or edit word).  There is a theoretical memory penalty to
                        //        doing this.  If not (if this option is false), and garbage
                        //        collection actually happens, then the memory used by the old
                        //        word could be recovered.
                    }
                    // that.superseded_cont_idns.push(old_cont.idn);
                    // old_cont.cat = null;
                    console.assert( ! word.cat.conts.has(old_cont.idn), "WTF it should be gone from cat", word.cat.obj.name, old_cont);
                    console.assert(that.cont_from_idn(old_cont.idn) === null, "WTF it should be gone from all cats", old_cont);
                    // TODO:  Maybe superseded contributions can be destroyed:
                    //        old_cont.destroy()
                }
            }
            // that.affirm_notifies_match();
        }
        rearrange_word(word) {
            var that = this;
            if ( ! is_specified(that.idn_of.rightmost)) {
                that.scan_fail("Rearrange before 'rightmost' definition", word.idn);
            }
            if ( ! that.cats.has(word.obj.category)) {
                that.scan_fail("Rearrange before category definition", word.idn, word.obj.category);
            }
            // if ( ! is_specified(that.clex.category_lexi.get(word.obj.category).cont_sequence.fence_post_right)) {
            //     that.scan_fail(
            //         "Rearrange to category with unspecified rightmost",
            //         word.idn,
            //         word.obj.category
            //     );
            // }



            // that.clex.rearrange_word(word);




            var cont = that.cont_from_idn(word.obj.contribute);
            if (cont === null) {
                that.notify(f("{reordering_idn}. (Can't find contribution {cont_idn} to rearrange)", {
                    reordering_idn: word.idn,
                    cont_idn: word.obj.contribute
                }));
            } else {
                var new_cat = that.cats.get(word.obj.category);
                var is_far_right = qiki.Lex.is_equal_idn(word.obj.locus, that.idn_of.rightmost);
                var old_cat = cont.cat;
                var old_cont_owner = cont.sbj;
                var action_template = is_far_right
                    ? "rearrange to right end of {cat},"
                    : "rearrange to the left of #{idn} in {cat},";
                var action = f(action_template, {
                    cat: new_cat.obj.name,
                    idn: word.obj.locus
                });
                if (that.is_authorized(word, old_cont_owner, action)) {
                    if (is_specified(old_cat)) {
                        old_cat.conts.delete(word.obj.contribute);
                    } else {
                        console.error("Why didn't contribution have a category?", cont);
                    }
                    if (is_far_right) {
                        new_cat.conts.add_rightmost(cont);
                    } else {
                        if ( ! new_cat.conts.add_left_of(cont, word.obj.locus)) {
                            new_cat.conts.add_leftmost(cont);
                            // NOTE:  locus can't be found, insert leftmost instead.
                        }
                    }
                    cont.sbj = word.sbj;   // HACK:  Does this leave things as they were with sql?
                    cont.cat = new_cat;
                    // NOTE:  This used to transfer ownership from the original author to
                    //        the person who rearranged it:
                    //            cont.owner = word.sbj;
                    //        What was the rationale for that?
                    //        If we don't have to do that, we don't have to keep a separate owner
                    //        property for each contribution -- the original sbj property is fine.
                    // TODO:  Commandeer the caption ownership too?
                    //        cont.capt.owner = new_cont_owner;
                }
            }

            // that.affirm_notifies_match();
        }
        /**
         * Should we let this reference-word affect our rendering?
         *
         * The hierarchy of changes to a contribution are:
         *     original contributor < system admin < me (browsing user)
         *
         * So once I (a logged-in user) changes a contribution, I will ignore changes by others.
         * Before that, admin changes similarly stop original author changes.
         *
         * @param word - the word causing a change (e.g. edit or re-categorization or rearrangement)
         *               word.idn is the idn number of the word
         *               word.sbj is the idn qstring of the user who initiated this change.
         *               word.vrb is the idn number of the verb
         *               word.obj is the idn number of the object
         * @param old_owner - tricky - id of the last person we authorized to change this contribution.
         *                It starts off as the original contributor.
         *                But then if I (the browsing user) moved it or edited it, then I'm the owner.
         *                But before that if the system admin moved or edited it,
         *                then they became the owner.
         *                This field comes from the data-owner attribute.  BUT if we return true,
         *                then we expect data-owner to be overridden by whoever initiated THIS change!
         * @param action - text describing the change.
         *                 (This may be briefly word.vrb.txt, as if that were accessible in JS,
         *                 or it may be longer, e.g. "drop on right end of my")
         * @return {boolean}
         */
        is_authorized(
            word,
            old_owner,
            action
        ) {
            var that = this;

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

            // var change_idn = word.idn;
            // var new_owner = word.sbj;
            // var change_vrb = word.vrb;
            // var target = word.obj;
            var change_idn = word.idn;
            var new_owner = word.sbj;
            var target = word.obj.contribute || word.idn;

            // First stage of decision-making:
            var is_change_mine = that.is_me(new_owner);
            var did_i_change_last = that.is_me(old_owner);
            var is_change_admin = that.is_user_admin(new_owner);
            var did_admin_change_last = that.is_user_admin(old_owner);
            var is_same_owner = qiki.Lex.is_equal_idn(new_owner, old_owner);
            var is_guardrailed = that.is_word_guardrailed(word);

            // Second stage of decision making:
            var let_admin_change = ! is_guardrailed && ! did_i_change_last                            && is_change_admin;
            var let_owner_change = ! is_guardrailed && ! did_i_change_last && ! did_admin_change_last && is_same_owner;

            // var ok;
            // if (that.is_word_guardrailed(word)) {
            //     ok = is_change_mine;
            // } else {
            //     ok = is_change_mine || let_admin_change || let_owner_change;
            // }
            var ok = is_change_mine || let_admin_change || let_owner_change;

            // Decision:
            if (ok) {
                that.notify(
                    change_idn +
                    ". Yes " +
                    that.user_name_short(new_owner) +
                    " may " +
                    action +
                    " " +
                    target +
                    ", work of " +
                    that.user_name_short(old_owner)
                );
            } else {
                that.notify(
                    change_idn +
                    ". Nope " +
                    that.user_name_short(new_owner) +
                    " won't " +
                    action +
                    " " +
                    target +
                    ", work of " +
                    that.user_name_short(old_owner)
                );

                // Obsolete:
                // if (let_owner_change) {
                //     that.notify("     ...because only owner can recategorize like this.");
                //     // TODO:  Misleading because admin might be able to change too?
                // } else if (let_admin_change) {
                //     that.notify("     ...because only admin can recategorize like this.");
                //     // TODO:  Wny don't rearrange-about words show up here?
                // }

                // TODO:  Display more thorough explanations on why or why not ok.
                //        This might be a big idea:
                //        Explain reasons by seeing which boolean inputs were critical,
                //        that is, which if flipped, would have changed the "ok" output.
                //        Would this really be interesting and complete?
                //        What about pairs of inputs that together change the output
                //        but don't individually?  Are there any such pairs?  Or triples?
                //        How to compose the human-readable explanations once we know which
                //        inputs were critical?
            }
            return ok;
        }
        // affirm_notifies_match() {
        //     var that = this;
        //     if (that.last_notify_message !== that.clex.last_notify_message) {
        //         if (console_verbose) {
        //             console.error("NOTIFY MISMATCH");
        //         } else {
        //             console.error(
        //                 "NOTIFY MISMATCH\n" +
        //                 "\t" + that.clex.last_notify_message + "\n" +
        //                 "\t" + that.last_notify_message
        //             );
        //         }
        //     }
        // }
        starting_cat(word) {
            var that = this;
            console.assert(
                (
                    is_specified(that.cats.by_name.my) &&
                    is_specified(that.cats.by_name.anon) &&
                    is_specified(that.cats.by_name.their)
                ),
                "Categories not defined yet:",
                that.cats.by_name,
                "\nidns defined:",
                that.idn_of
            );
            if (that.is_me(word.sbj)) {
                return that.cats.by_name.my;
            } else if ( ! that.is_authenticated(word.sbj)) {
                return that.cats.by_name.anon;
            } else {
                return that.cats.by_name.their;
            }
        }
        cat_from_idn(cat_idn) {
            return this.cats.get(cat_idn);
        }
        cont_from_idn(cont_idn) {
            var that = this;
            var cont_answer = null;
            that.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                cont_answer = cat.conts.get(cont_idn);
                if (cont_answer !== null) {
                    return false;
                }
            });
            return cont_answer;
        }
        is_me(user_idn) {
            return qiki.Lex.is_equal_idn(user_idn, this.me_idn);
        }
        is_user_admin(user_idn) {
            var that = this;
            var user = that.from_user[user_idn];
            if (is_specified(user)) {
                return user.is_admin;
            } else {
                return false;
            }
        };
        is_word_guardrailed(word) {
            var that = this;
            var guardrailed_categories = [
                that.cats.by_name.my.idn,
                that.cats.by_name.their.idn,
                that.cats.by_name.anon.idn
            ];
            return word.vrb === that.idn_of.rearrange && has(guardrailed_categories, word.obj.category);
        }
        user_name_short(user_idn) {
            var that = this;
            if (is_defined(user_idn)) {
                var user_word = that.from_user[user_idn];
                if (
                    is_specified(user_word) &&
                    is_specified(user_word.name) &&
                    user_word.name !== ''
                ) {
                    if (user_word.name.length > 20) {
                        return user_word.name.substring(0,15) + "...";
                    } else {
                        return user_word.name;
                    }
                } else {
                    return "#" + String(user_idn);
                }
            } else {
                return "(unowned)";
            }
        };

        /**
         * Add a word to the lex.
         *
         * TODO:  Move this method to LexCloud.
         *        That will require encapsulating ajax calls there, which is good.
         *        Probably they should be there, and qoolbar should use them too.
         *        Then ajax_url needs to be some app-specific configurable value,
         *        along with LexCloud.url used for scanning.
         *        Duh, the REST way is to use the SAME url for both and the method
         *        would be GET or POST.
         *        Huh, including a way to GET the whole lex (async of course) or
         *        one word by idn, or multiple words by search criteria.
         *        So lex.py needs a RESTful server and lex.js a RESTful client.
         *
         * @param vrb_name - e.g. 'edit'
         * @param named_sub_nits - e.g. {contribute: idn, text: "new contribution text"}
         * @param done_callback
         * @param fail_callback
         */
        create_word(vrb_name, named_sub_nits, done_callback, fail_callback) {
            var that = this;
            done_callback = done_callback || function () {};
            fail_callback = fail_callback || function (message) { console.error(message); };
            qoolbar.post(
                'create_word',
                {
                    vrb_name: vrb_name,
                    named_sub_nits: JSON.stringify(named_sub_nits)
                },
                /**
                 * Handle a valid response from the create-word ajax.
                 *
                 * @param response_object
                 * @param response_object.jsonl - JSON of array of the created word's bytes and nits.
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

        /**
         * Report all contribution edit histories in the console.
         *
         * Only edits that were "authorized" (e.g. we made them, etc.)
         *
         * EXAMPLE:
         *     2.2Y     1911. e "From this day to the ending of the world, \nWe in (420)
         *         5d   1891. c "From this day to the ending of the world,\n...we  (422)
         *
         * Meaning 2.2 years ago a contribution was edited (to 420 characters),
         * and 5 days before that, the original was submitted (422 characters long).
         */
        editing_history_report() {
            var that = this;
            var superseded_idns = [];
            var active_idns = [];
            that.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                active_idns = active_idns.concat(cat.conts.idn_array());
                cat.conts.loop(/** @param {ContributionWord} cont */ function (cont) {
                    // FALSE WARNING:  Unresolved variable vrb
                    // noinspection JSUnresolvedVariable
                    if (cont.vrb !== that.idn_of.contribute) {
                        var this_cont = cont;
                        var later_cont = null;
                        console.debug("");
                        do {
                            var delta, whn;
                            var is_first_line_and_latest_version = later_cont === null;
                            if (is_first_line_and_latest_version) {
                                delta = delta_format(seconds_since_1970() - this_cont.whn_seconds());
                                whn = delta.amount_long + delta.units_short;
                            } else {
                                delta = delta_format(
                                    later_cont.whn_seconds() - this_cont.whn_seconds()
                                );
                                whn = "    " + delta.amount_short + delta.units_short;
                                superseded_idns.push(this_cont.idn);
                            }
                            whn = whn.padEnd(4 + 2 + 1);
                            var report = f("{whn} {idn}. {vrb} {text} ({len})", {
                                whn: whn,
                                idn: String(this_cont.idn).padStart(5),
                                vrb: that.by_idn[this_cont.vrb].obj.name.substring(0,1),
                                text: JSON.stringify(this_cont.obj.text).substring(0,50),
                                len: this_cont.obj.text.length
                            });
                            var is_earliest_truly = this_cont.vrb === that.idn_of.contribute;
                            var is_earliest_we_know_of = ! is_specified(this_cont.supersedes);
                            if (is_earliest_truly && ! is_earliest_we_know_of) {
                                console.debug("%c\t" + report, 'color:magenta;');
                            } else if ( ! is_earliest_truly && is_earliest_we_know_of) {
                                console.debug("%c\t" + report, 'color:red;');
                                var guessed_next = f("{whn} {idn}. ???", {
                                    whn: "       ",
                                    idn: String(this_cont.obj.contribute).padStart(5)
                                });
                                console.debug("%c\t" + guessed_next, 'color:red;');
                            } else {
                                console.debug("\t" + report);
                            }
                            later_cont = this_cont;
                            this_cont = this_cont.supersedes;
                        } while (is_specified(this_cont))
                    }
                });
            });
            console.debug("Active:", active_idns.join(" "));
            console.debug("Superseded:", superseded_idns.join(" "));
            var duplicated_idns = find_duplicates(active_idns.concat(superseded_idns));
            if (duplicated_idns.length === 0) {
                console.debug("No duplicates.");
            } else {
                console.error("Duplicated:", duplicated_idns);
            }
        }
        refresh_how_many() {
            var that = this;
            that.cats.loop(/** @param {CategoryWord} cat */ function recompute_category_anti_valves(cat) {
                var num_cont = cat.conts.num_words();
                var num_cont_string = num_cont === 0 ? "" : f(" ({n})", {n:num_cont});
                cat.$sup.find('.how-many').text(num_cont_string);
            });
        }

        cont_loop(callback) {
            var that = this;
            var return_value;
            that.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                cat.conts.loop(/** @param {ContributionWord} cont */ function (cont) {
                    return_value = callback(cont);
                    if (return_value === false) {
                        return false;
                    }
                });
                if (return_value === false) {
                    return false;
                }
            });
        }

        /**
         * Affirm that Categories and Contributions agree on who contains whom.
         */
        assert_consistent() {
            var that = this;

            // NOTE:  1. For each category, for each contribution within it...
            //           Each contribution should know what category it's in.
            var num_with_sups = 0;
            that.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                cat.conts.loop(/** @param {ContributionWord} cont */ function (cont) {
                    console.assert(
                        cat === cont.cat,   // NOTE:  object instance comparison
                        "INCONSISTENT CATEGORY",
                        cat.obj.name,
                        cat.idn,
                        "thinks it has cont",
                        cont.idn,
                        "- but that cont thinks it's in cat",
                        cont.cat.obj.name,
                        cont.cat.idn,
                    );
                    if (cont.is_dom_rendered()) {
                        num_with_sups++;
                    }
                    if (cont.is_temporarily_rendered) {
                        console.error("Contribution temporarily rendered and left to rot", cont);
                    }
                });
            });

            // NOTE:  2. Go through rendered contribution DOM objects in each category.
            var num_rendered = 0;
            var num_unrendered = 0;
            var any_query_string_limitations = cont_array_from_query_string() !== null;
            that.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                var rendered_idn_strings = [];
                // if (is_defined(cat.$cat)) {
                //     console.warn("Unrendered category", cat.obj.name);
                if (is_defined(cat.$cat) && cat.$cat.length === 1) {
                    // NOTE:  If cat.build_dom() has happened yet.
                    cat.$cat.find('.sup-contribution').each(function (_, sup) {
                        num_rendered++;
                        var $sup = $(sup);
                        var $cont = $sup.find('.contribution');
                        var rendered_idn_string = $cont.attr('id');
                        var rendered_idn = parseInt(rendered_idn_string);
                        rendered_idn_strings.push(rendered_idn_string);
                        var cont_by_data = ContributionWord.from_element($sup);
                        var cont_by_idn = that.cont_from_idn(rendered_idn);

                        assert_equal(cont_by_data, cont_by_idn) &&
                        assert_equal(cont_by_data.idn_string, rendered_idn_string);
                    });
                    var num_current_this_category = cat.conts.num_words();
                    var num_unrendered_this_category = cat.$unrendered.data('count');
                    if (is_specified(num_unrendered_this_category)) {
                        // NOTE:  Prevent false alarms at the beginning, when contributions objects are
                        //        instantiated but not rendered yet.  And so the $unrendered count
                        //        has not been computed either.

                        num_unrendered += num_unrendered_this_category;
                        assert_equal(   // 1.lex vs 2.dom -- compare quantity
                            num_current_this_category,
                            rendered_idn_strings.length + num_unrendered_this_category,
                            "lex vs dom in category " + cat.obj.name
                        );

                        var current_idns = cat.conts.idn_array();
                        var idn_mismatch;
                        if (any_query_string_limitations) {
                            idn_mismatch = false;
                            // NOTE:  If there's a cont=NNNN in the query string, don't even bother
                            //        comparing rendered and current (cat.conts) contribution idns.
                        } else {
                            idn_mismatch = false;
                            looper(rendered_idn_strings, function (index, rendered_idn_string) {
                                var current_idn = current_idns[index];
                                var current_idn_string = String(current_idn);
                                if (current_idn_string !== rendered_idn_string) {
                                    idn_mismatch = true;
                                }
                            });
                        }
                        var plus_n_more;
                        if (num_unrendered_this_category === 0) {
                            plus_n_more = "";
                        } else {
                            plus_n_more = f(" + {n} more", {n: num_unrendered_this_category});
                        }
                        var rendered_idn_string = rendered_idn_strings.join(" ") || "(none rendered)";
                        var vars = {
                            cat: cat.obj.name,
                            rendered_idns: rendered_idn_string,
                            plus_n_more: plus_n_more,
                            num_current: num_current_this_category,
                            current_idns: stringify_array(current_idns).join(" ")
                        };
                        if (idn_mismatch) {
                            console.error(f("RENDERING MISMATCH {cat}:\n" +
                                "    rendered: {rendered_idns}{plus_n_more} = {num_current}\n" +
                                "     current: {current_idns}", vars));
                        } else {
                            console.log(f("Rendered {cat}: " +
                                "{rendered_idns}{plus_n_more} = {num_current}", vars));
                        }
                    }
                }
            });

            assert_equal(num_rendered, num_with_sups);
            // NOTE:  The number of Contribution instances that think they're rendered,
            //        should match the number of DOM elements representing contributions.

            if (num_rendered === 0) {
                console.debug(f("{total} contributions", {total: num_unrendered}));
            } else {
                console.debug(f("{total} contributions = {yes} rendered + {no} unrendered", {
                    total: num_rendered + num_unrendered,
                    yes: num_rendered,
                    no: num_rendered
                }));
            }
        }
    }

    // class CategoryWord extends qiki.Word {
    //     when_resolved() {
    //         var that = this;
    //         super.when_resolved();
    //         that.conts = new qiki.LexMemory();
    //         that.lex.cats.add(that);
    //     }
    // }
    // class ContributionWord extends qiki.Word {
    //     starting_cat() {
    //         var that = this;
    //         console.assert(
    //             (
    //                 is_specified(that.lex.cats.by_name.my) &&
    //                 is_specified(that.lex.cats.by_name.anon) &&
    //                 is_specified(that.lex.cats.by_name.their)
    //             ),
    //             "Categories not defined yet:",
    //             that.lex.cats.by_name, "\n",
    //             "idns defined:",
    //             lex.idn_of
    //         );
    //         if (that.lex.is_me(that.sbj)) {
    //             return that.lex.cats.by_name.my;
    //         } else if ( ! that.lex.is_authenticated(that.sbj)) {
    //             return that.lex.cats.by_name.anon;
    //         } else {
    //             return that.lex.cats.by_name.their;
    //         }
    //     }
    //     when_resolved() {
    //         var that = this;
    //         super.when_resolved();
    //         that.cat = that.starting_cat();
    //         console.assert(that.lex.cats.has(that.cat.idn), that.cat, that.lex.cats);
    //         that.cat.conts.add(that);
    //     }
    // }
    // // class InteractWord extends qiki.Word {
    // //
    // // }
    // class OtherWord extends qiki.Word {
    //     // is_interact_ref() {
    //     //     var that = this;
    //     //     var vrb_definition_word = that.lex.by_idn[that.vrb];
    //     //     var vrb_parent = vrb_definition_word.obj.parent;
    //     //     return vrb_parent === that.lex.idn_of.interact;
    //     // }
    //     // is_category_def() {
    //     //     return this.obj.parent === this.lex.idn_of.category;
    //     // }
    // }

    // /**
    //  * Fill the JavaScript Lexi collections by scanning the lex jsonl.
    //  *
    //  * @param clex - ContributionUnslump object
    //  * @param then - follow-up function
    //  */
    // function scan_lex_jsonl(clex, then) {
    //     // var is_static_jsonl = query_get('static_jsonl', false) !== false;
    //     // // var jsonl_url = '/meta/nits?argot=jsonl';
    //     // var jsonl_url;
    //     // if (is_static_jsonl) {
    //     //     jsonl_url = '/meta/nits?argot=jsonl&static_jsonl'
    //     // } else {
    //     //     jsonl_url = '/meta/nits?argot=jsonl'
    //     // }
    //     var jsonl_url = '/meta/static/data/unslumping.lex.jsonl'
    //     var promise_jsonl = $.get({url: jsonl_url, dataType:'text'});
    //
    //     promise_jsonl.done(function (response_body) {
    //         var response_lines = response_body.split('\n');
    //         console.debug("JSONL", response_lines.length, "lines");
    //
    //         clex.by_idn = {};
    //
    //         /**
    //          * Convert a lex definition's obj_values into obj.parent, obj.name, obj.fields.
    //          *
    //          * Also populate clex.idn_of -- mapping name to idn
    //          * Also populate clex.by_idn -- mapping idn to word associative array
    //          */
    //         function definition_resolve(word) {
    //             if (word.obj_values.length < 2) {
    //                 console.error("Malformed definition", word);
    //                 return false;
    //             } else {
    //                 word.obj = {};
    //                 word.obj.parent = word.obj_values.shift();   // parent aka definer
    //                 word.obj.name = word.obj_values.shift();
    //                 if (word.obj_values.length === 1) {
    //                     word.obj.fields = word.obj_values[0];
    //                 } else {
    //                     word.obj.fields = [];
    //                     console.error(
    //                         "Definition should end with fields and fields only",
    //                         word.obj_values.length,
    //                         word
    //                     );
    //                 }
    //                 delete word.obj_values;
    //                 if (is_idn_defined(clex.idn_of[word.obj.name])) {
    //                     console.error("duplicate define", clex.idn_of[word.obj.name], word);
    //                     return false;
    //                 } else {
    //                     clex.idn_of[word.obj.name] = word.idn;
    //                     clex.by_idn[word.idn] = word;
    //                     return true;
    //                 }
    //             }
    //         }
    //         function check_forward_definition(word) {
    //             check_forward_referent(word, word.obj.parent, "parent");
    //             looper(word.obj.fields, function (index_field_0_based_string, idn_field) {
    //                 check_forward_referent(word, idn_field, f(
    //                     "field {index_field}/{num_field}",
    //                     {
    //                         index_field: parseInt(index_field_0_based_string) + 1,
    //                         num_field: word.obj.fields.length
    //                     }
    //                 ));
    //             });
    //         }
    //         function check_forward_referent(word, idn_referent, description) {
    //             if (idn_referent === word.idn) {
    //                 if (console_verbose) {
    //                     // NOTE:  A word may refer to itself.  Fundamental definitions do this:
    //                     //        lex, define, noun, text, integer, sequence.
    //                     console.debug(f(
    //                         "Self reference:  " +
    //                         "{name_defined} (word {idn_defined}) -- " +
    //                         "{description} refers to itself"
    //                         , {
    //                             idn_defined: word.idn,
    //                             name_defined: word.obj.name,
    //                             description: description
    //                         }
    //                     ));
    //                 }
    //             // } else if ( ! has(clex.by_idn, idn_referent)) {
    //             } else if (idn_referent > word.idn) {
    //                 console.warn(f(
    //                     "Forward definition:  " +
    //                     "{name_defined} (word {idn_defined}) -- " +
    //                     "{description} refers to word {idn_referent}"
    //                     , {
    //                         idn_defined: word.idn,
    //                         name_defined: word.obj.name,
    //                         idn_referent: idn_referent,
    //                         description: description
    //                     }
    //                 ));
    //             }
    //         }
    //
    //         var error_free = true;
    //         function response_pass(callback) {
    //             if (error_free) looper(response_lines, function (_, word_json) {
    //                 if (word_json === '') {
    //                     // We have to be cool with at least one blank line.
    //                     // Because the last line of the file (like every other line) ends in a
    //                     // newline, JavaScript split treats the nothingness after that as if it were
    //                     // an additional empty-string line.
    //                 } else {
    //                     var w = word_decode(word_json);
    //                     if (w === false) {
    //                         error_free = false;
    //                         return false;   // abort -- low level word decoding error
    //                     } else if (false === callback(w)) {
    //                         return false;   // abort -- high level caller is done (maybe error)
    //                     }
    //                 }
    //             });
    //         }
    //
    //         // TODO:  The three passes could all be achieved with a single pass.
    //         //        Pass 2 and 3 would only have to accumulate words until certain
    //         //        conditions were met.
    //         //        Pass 2 condition:  lex and define words are known.
    //         //        Pass 3 conditions are fuzzy:  need to know that "all" categories have been
    //         //        defined.  Plus the rightmost-word.  Only then can we set the field
    //         //        cat.cont_sequence.fence_post_right
    //         //        There are probably other tricky dependencies that might resolve themselves if
    //         //        a lex were created from scratch, defining things in dependency-friendly order.
    //
    //         response_pass(function pass_1_lex_and_define(w) {
    //             // CAUTION:  The lex can make forward definitions, but the lex-word and the
    //             //           define-word really should come before there are any user words.
    //             //           The define-word is especially vulnerable to usurp.
    //             if (is_idn_defined(clex.idn_of.lex) && is_idn_defined(clex.idn_of.define)) {
    //                 return false;
    //             } else if (
    //                 w.idn === w.sbj &&
    //                 w.obj_values[0] ===  w.idn &&
    //                 w.obj_values[1] === 'lex'
    //             ) {
    //                 // NOTE:  Sneaky detection of the lex-word defining itself, and its own parent.
    //                 //        Assume the vrb is define.
    //                 definition_resolve(w);
    //             } else if (
    //                 w.idn === w.vrb &&
    //                 w.obj_values[0] === w.idn &&
    //                 w.obj_values[1] === 'define'
    //             ) {
    //                 // NOTE:  Sneaky detection of define-word defining itself, and its own parent.
    //                 //        Assume the sbj is lex.
    //                 definition_resolve(w);
    //             } else {
    //                 console.error("Before lex-word or define-word there shouldn't be this word:", w);
    //                 error_free = false;
    //                 return false;
    //             }
    //         });
    //         if (error_free) {
    //             console.assert(is_idn_defined(clex.idn_of.lex));
    //             console.assert(is_idn_defined(clex.idn_of.define));
    //         }
    //
    //         response_pass(function pass_2_lex_words(w) {
    //             var user_idn;
    //             var user_word;
    //             if (w.sbj === clex.idn_of.lex) {
    //                 if (w.idn === clex.idn_of.lex) {
    //                     // ignore the lex-word itself on this pass
    //                 } else if (w.idn === clex.idn_of.define) {
    //                     // ignore the define-word itself on this pass
    //                 } else {
    //                     switch (w.vrb) {
    //                     case clex.idn_of.define:
    //                         if (definition_resolve(w)) {
    //                             if (w.obj.parent === clex.idn_of.category) {
    //                                 clex.category_lexi.add_cat(w.idn, w.obj.name);
    //                             }
    //                         }
    //                         break;
    //                     case clex.idn_of.name:
    //                         user_idn = w.obj_values.shift();
    //                         // TODO:  Verify this is a user idn, and not something else being named.
    //
    //                         var user_name = w.obj_values.shift();
    //                         if (w.obj_values.length !== 0) {
    //                             console.warn("Leftover nits in name-word", w, user_idn, user_name);
    //                         }
    //                         delete w.obj_values;
    //                         user_word = clex.user_factory(user_idn);
    //                         user_word.name = user_name;
    //                         break;
    //                     case clex.idn_of.admin:
    //                         user_idn = w.obj_values.shift();
    //                         if (w.obj_values.length !== 0) {
    //                             console.warn("Leftover nits in admin-word", w, user_idn);
    //                         }
    //                         delete w.obj_values;
    //                         user_word = clex.user_factory(user_idn);
    //                         user_word.is_admin = true;
    //                         break;
    //                     case clex.idn_of.iconify:
    //                         break;
    //                     case clex.idn_of.ip_address:
    //                         break;
    //                     case clex.idn_of.user_agent:
    //                         break;
    //                     default:
    //                         console.warn("Unhandled lex", w.vrb, "word", w);
    //                         break;
    //                     }
    //                 }
    //             } else {
    //                 user_word = clex.user_factory(w.sbj);
    //                 user_word.num_references += 1;
    //                 // NOTE:  Create a word in the user lexi for all users who contribute.
    //                 // TODO:  Alias the most common user references.  Maybe in the .lex.jsonl.
    //             }
    //         });
    //
    //         clex.category_lexi.loop(function copy_the_idn_that_means_rightmost(_, cat) {
    //             cat.cont_sequence.fence_post_right = clex.idn_of.rightmost;
    //             // NOTE:  This cannot happen inside pass 2 if we don't know which is defined first,
    //             //        the category-words or the rightmost-word.
    //         });
    //         if (error_free) {
    //             looper(clex.idn_of, function expected_and_actual_definitions(name, idn) {
    //                 if (idn === IDN_UNDEFINED) {
    //                     console.warn("Missing lex definition word for:", name);
    //                     error_free = false;
    //                 }
    //             });
    //             looper(clex.by_idn, function actual_definitions(idn, word) {
    //                 check_forward_definition(word);
    //             });
    //         }
    //
    //         response_pass(function pass_3_user_words(w) {
    //             if (w.sbj === clex.idn_of.lex) {
    //                 // ignore all lex words this pass
    //             } else {
    //                 clex.word_resolve(w);
    //                 clex.word_handle(w);
    //             }
    //         });
    //
    //         console.log("contribution_lexi", contribution_lexi);
    //         // NOTE:  category_lexi shows up as a property of contribution_lexi
    //
    //         if (error_free) {
    //             then();
    //         }
    //    });
    // }
    //
    // /**
    //  * EXAMPLE:  if (is_idn_defined(contribution_lexi.idn_of.lex)) {...}
    //  *
    //  * @param idn - output of idn_of[] object.
    //  * @returns {boolean}
    //  */
    // function is_idn_defined(idn) {
    //     return is_defined(idn) && idn !== IDN_UNDEFINED;
    // }






    // // noinspection JSUnusedLocalSymbols
    // /**
    //  * Load, "parse", and process the nit stream.
    //  */
    // function load_nits(_contribution_lexi, then) {
    //     var t0, t1, t8, t9;
    //     var m0, m1, m8, m9;
    //     t0 = Date.now()
    //     m0 = mem();
    //     var before_assign = 'var ';
    //     var before_file = '(function(qiki){\n';
    //     var after_file = '\n})(window.qiki = window.qiki || {});';
    //     var nits_url = (
    //         '/meta/nits' +
    //             '?before_assign=' + encodeURIComponent(before_assign) +
    //             '&before_file=' + encodeURIComponent(before_file) +
    //             '&after_file=' + encodeURIComponent(after_file)
    //     );
    //     var nit_handlers = {
    //         word_define: function (wordie) {
    //             if (console_verbose) console.info(f("{idn}. {full_name}", {
    //                 idn: wordie.idn,
    //                 full_name: wordie.full_history()
    //             }), wordie.fields.length ? wordie.fields : "");
    //             // NOTE:  curried word is called to define something.
    //             //        or when the lex instance defines something.
    //         },
    //         word_from_idn: function(idn) {
    //             return {idn: idn};
    //             // NOTE:  What's returned here comes back to us in the parameters to other
    //             //        callbacks.
    //             //        For example, say this was in the data stream:
    //             //            their(6632, u0, c(1857), rightmost);
    //             //        then obviously word_from_idn() gets called with idn == 1857.
    //             //        And what's returned from that call above becomes the 3rd parameter to
    //             //        their().
    //             //        That gets passed to the callback word_setter() in setting_details[0].
    //             //        And also to category in etc[0]
    //         },
    //         word_setter: function (/* wordie, idn, user_word, setting_details */) {
    //             // console.info(f("{idn}. {user} -- {name} {details}", {
    //             //     name: wordie.full_history(),
    //             //     idn: idn,
    //             //     user: render_nit(user_word),
    //             //     details: render_nits(setting_details)
    //             // }));
    //             t8 = Date.now();
    //             m8 = mem();
    //             return null;
    //         },
    //         define_handlers: {
    //             user: function (w) {
    //             },
    //             google_user: function (w) {
    //                 w.was_anon = false;
    //             },
    //             anonymous:   function (w) {
    //                 w.was_anon = true;
    //             },
    //             // contribute: function (w) { _contribution_lexi.idn.contribute = w.idn; },
    //             // caption:    function (w) { _contribution_lexi.idn.caption    = w.idn; },
    //             // edit:       function (w) { _contribution_lexi.idn.edit       = w.idn; },
    //             // rightmost:  function (w) { _contribution_lexi.idn.rightmost  = w.idn; },
    //             //     // TODO:  Say, what if qiki.js automagically retained all definitions
    //             //     //        So what's a load-wide variable where it could put stuff,
    //             //     //        that we can also use here?
    //             //     //            load_nits.definitions.rightmost?
    //             //     //        Then these would be pretty awesome too:
    //             //     //            load_nits.definitions.category[idn]
    //             //     //            load_nits.definitions.category.by_name[name]
    //             //     //            load_nits.definitions.category.by_name.about
    //             //     //        Wait wait, not the load_nits() callee, but the object passed to it.
    //             //     //        So then it would have to be defined here before it could be used,
    //             //     //        e.g. var o = {word_define: function...}; window.qiki.lex_load(url, o);
    //             //     //        In qiki.js this would be called handlers.definitions.
    //             category: function(w) {
    //                 // var is_generation_3 = w.generation() === 3;
    //                 // var is_nameless = w.name === null;
    //                 // console.assert(is_generation_3 === is_nameless, "Generational conundrum", w);
    //                 // // if (is_generation_3) {
    //                 if (is_specified(w.parent) && w.parent.name === 'category') {
    //                     // NOTE:  Intercept the category SUB-definitions (generation 2),
    //                     //        not the definition of category ITSELF (generation 1).
    //                     _contribution_lexi.category_lexi.add_cat(w.idn, w.name);
    //                     // NOTE:  So for unslumping.js, the calls to category() in the nit stream
    //                     //        define the order of categories on the screen.
    //                     // cat.cont_sequence.fence_post_right = _contribution_lexi.idn.rightmost;
    //                     // _contribution_lexi.category_lexi.idn[w.name] = w.idn;
    //                 }
    //             }
    //         },
    //         verb_handlers: {
    //             // old scheme               symbol here     nit
    //             // ----------               -----------     ---
    //             // contribution.sbj.idn     u().idn         cont.nits[0].bytes   cont.who
    //             // contribution.vrb.idn     w.idn           cont.bytes           cont.idn
    //             // contribution.obj.idn     -               -
    //             // contribution.txt         etc[0]          cont.nits[1].bytes   cont.text
    //             // contribution.num         -               -
    //             // contribute: function (w, idn, u, etc) {
    //             //     console.info(f("{idn}. {user_name} -- contribute {t}", {
    //             //         idn:idn,
    //             //         user_name: u().full_history(),
    //             //         t:JSON.stringify(etc[0])
    //             //     }));
    //             //     _contribution_lexi.contribute_word({
    //             //         idn:idn,
    //             //         sbj:u().idn,
    //             //         was_submitted_anonymous: u().was_anon,
    //             //         txt:etc[0]
    //             //     });
    //             // },
    //             contribute: function (wordie) {
    //                 if (console_verbose) console.info(f("{idn}. {user_name} -- contribute {t}", {
    //                     idn:wordie.idn,
    //                     user_name: wordie.user().full_history(),
    //                     t:JSON.stringify(wordie.text)
    //                 }));
    //                 _contribution_lexi.contribute_word({
    //                     idn:wordie.idn,
    //                     sbj:wordie.user().idn,
    //                     was_submitted_anonymous: wordie.user().was_anon,
    //                     txt:wordie.text
    //                 });
    //             },
    //             // old scheme               symbol here     nit
    //             // ----------               -----------     ---
    //             // contribution.sbj.idn     u().idn         edit.nits[0].bytes   edit.who
    //             // contribution.vrb.idn     w.idn           edit.bytes           edit.idn
    //             // contribution.obj.idn     etc[1].idn      edit.nits[2].bytes   edit.cont
    //             // contribution.txt         etc[0]          edit.nits[1].bytes   edit.text
    //             // contribution.num         -               -
    //             // edit: function (w, idn, u, etc) {
    //             //     console.info(f("{idn}. {user} -- edit {t} replaces {o}", {
    //             //         idn:idn,
    //             //         user: u().full_history(),
    //             //         t:JSON.stringify(etc[0]),
    //             //         o:render_idn(etc[1].idn)
    //             //     }));
    //             //     _contribution_lexi.edit_word({
    //             //         idn:idn,
    //             //         sbj:u().idn,
    //             //         obj:etc[1].idn,
    //             //         txt:etc[0]
    //             //     })
    //             // },
    //             edit: function (wordie) {
    //                 if (console_verbose) console.info(f("{idn}. {user} -- edit {t} replaces {o}", {
    //                     idn:wordie.idn,
    //                     user: wordie.user().full_history(),
    //                     t:JSON.stringify(wordie.text),
    //                     o:render_idn(wordie.contribute.idn)
    //                 }));
    //                 _contribution_lexi.edit_word({
    //                     idn:wordie.idn,
    //                     sbj:wordie.user().idn,
    //                     obj:wordie.contribute,
    //                     txt:wordie.text
    //                 })
    //             },
    //             // old scheme               symbol here     nit
    //             // ----------               -----------     ---
    //             // contribution.sbj.idn     u().idn         cap.nits[0].bytes    cap.who
    //             // contribution.vrb.idn     w.idn           cap.bytes            cap.idn
    //             // contribution.obj.idn     etc[1].idn      cap.nits[2].bytes    cap.cont
    //             // contribution.txt         etc[0]          cap.nits[1].bytes    cap.text
    //             // contribution.num         -               -
    //             // caption: function (w, idn, u, etc) {
    //             //     console.info(f("{idn}. {user} -- caption {t} for {o}", {
    //             //         idn:idn,
    //             //         user: u().full_history(),
    //             //         t:JSON.stringify(etc[0]),
    //             //         o:render_idn(etc[1].idn)
    //             //     }));
    //             //     _contribution_lexi.caption_word({
    //             //         idn:idn,
    //             //         sbj:u().idn,
    //             //         obj:etc[1].idn,
    //             //         txt:etc[0]
    //             //     })
    //             // },
    //             caption: function (wordie) {
    //                 if (console_verbose) console.info(f("{idn}. {user} -- caption {t} for {o}", {
    //                     idn:wordie.idn,
    //                     user: wordie.user().full_history(),
    //                     t:JSON.stringify(wordie.text),
    //                     o:render_idn(wordie.contribute.idn)
    //                 }));
    //                 _contribution_lexi.caption_word({
    //                     idn:wordie.idn,
    //                     sbj:wordie.user().idn,
    //                     obj:wordie.contribute,
    //                     txt:wordie.text
    //                 })
    //             },
    //             // ----------               -----------     ---
    //             // old scheme               symbol here     nit
    //             // contribution.sbj.idn     u().idn         cat.nits[0].bytes    cat.who
    //             // contribution.vrb.idn     w.idn           cat.bytes            cat.idn
    //             // contribution.obj.idn     etc[0].idn      cat.nits[1].bytes    cat.cont
    //             // contribution.txt         -               -
    //             // contribution.num         etc[1]          cat.nits[2].bytes    cat.left_of
    //             // category: function (w, idn, u, etc) {
    //             //     var position_idn = etc[1].idn || etc[1]().idn;
    //             //     // NOTE:  etc[1].idn   if etc[1] is c(6469)
    //             //     //        etc[1]().idn if etc[1] is rightmost
    //             //     // EXAMPLES:
    //             //     //        their(7103, u0, c(1741), c(6469));
    //             //     //        their(7112, u0, c(1741), rightmost);
    //             //     // TODO:  Less sucky way to do this.
    //             //     var position_description = etc[1].is_curried_word
    //             //         ? etc[1]().name            // rightmost
    //             //         : render_idn(etc[1].idn)   // c(6469)
    //             //     ;
    //             //     console.info(f("{idn}. {user} -- {category_name} {o} at {p}", {
    //             //         idn:idn,
    //             //         user: u().full_history(),
    //             //         category_name:w.name,
    //             //         o:render_idn(etc[0].idn),
    //             //         p:position_description
    //             //     }));
    //             //     _contribution_lexi.cat_ordering_word({
    //             //         idn:idn,
    //             //         sbj:u().idn,
    //             //         vrb:w.idn,
    //             //         obj:etc[0].idn,
    //             //         num:position_idn
    //             //     })
    //             // }
    //             category: function (wordie) {
    //                 var position_idn;
    //                 var position_description;
    //                 if (wordie.locus.is_curried_word) {
    //                     position_idn = wordie.locus().idn;
    //                     position_description = wordie.locus().name;
    //                 } else {
    //                     position_idn = wordie.locus;
    //                     position_description = render_idn(position_idn)
    //                 }
    //                 // var position_idn = wordie.locus.idn || wordie.locus().idn;
    //                 // NOTE:  etc[1].idn   if etc[1] is c(6469)
    //                 //        etc[1]().idn if etc[1] is rightmost
    //                 // EXAMPLES:
    //                 //        their(7103, u0, c(1741), c(6469));
    //                 //        their(7112, u0, c(1741), rightmost);
    //                 // TODO:  Less sucky way to do this.
    //                 // var position_description = wordie.locus.is_curried_word
    //                 //     ? wordie.locus().name            // rightmost
    //                 //     : render_idn(wordie.locus.idn)   // c(6469)
    //                 // ;
    //                 if (console_verbose) console.info(f("{idn}. {user} -- {category_name} {o} at {p}", {
    //                     idn:wordie.idn,
    //                     user:wordie.user().full_history(),
    //                     category_name:wordie.parent.name,
    //                     o:render_idn(wordie.contribute.idn),
    //                     p:position_description
    //                 }));
    //                 _contribution_lexi.cat_ordering_word({
    //                     idn:wordie.idn,
    //                     sbj:wordie.user().idn,
    //                     vrb:wordie.parent.idn,
    //                     obj:wordie.contribute,
    //                     num:position_idn
    //                 })
    //             }
    //         },
    //         verb_not_handled: function (wordie, details) {
    //             if (console_verbose) console.warn(
    //                 f("{idn}. VERB NOT HANDLED -- {history}", {
    //                     idn:wordie.idn,
    //                     history:wordie.full_history()
    //                 }),
    //                 wordie,
    //                 details
    //             );
    //         },
    //         init: function(me_idn_lineage) {
    //             t1 = Date.now();
    //             m1 = mem();
    //             console.log("Nit init", ((m1-m0)/1024).toFixed(0), "Kbytes", ((t1-t0)/1000.0).toFixed(3), "seconds");
    //
    //             _contribution_lexi.idn.me = me_idn_lineage;
    //             // TODO:  Instead make a ContributionsUnslump.is_me(idn) method
    //             //        and THAT can return idn === nit_output.me_word.idn or something.
    //         },
    //         fail: function(/* arguments */) {
    //             // TODO:  Some kind of something on the page.
    //         },
    //         done: function() {
    //             t9 = Date.now();
    //             m9 = mem();
    //             console.log("Nit last", ((m8-m1)/1024).toFixed(0), "Kbytes", ((t8-t1)/1000.0).toFixed(3), "seconds");
    //             console.log("Nit done", (m9-m8).toFixed(0), "bytes", ((t9-t8)/1000.0).toFixed(3), "seconds");
    //             console.debug("Wordie objects by name", nit_output);
    //
    //             _contribution_lexi.idn.contribute = nit_output.by_name.contribute.idn
    //             _contribution_lexi.idn.caption    = nit_output.by_name.caption.idn
    //             _contribution_lexi.idn.edit       = nit_output.by_name.edit.idn
    //
    //             _contribution_lexi.category_lexi.loop(function (_, cat) {
    //                 cat.cont_sequence.fence_post_right = nit_output.by_name.rightmost.idn;
    //             });
    //             // NOTE:  Don't confuse the overall category sequence with the sequence of
    //             //        contributions WITHIN each category
    //             //        _contribution_lexi.category_lexi.cat_idns.fence_post_right is NOT used.
    //             //        _contribution_lexi.category_lexi.by_name.my.fence_post_right is used.
    //             //                                             .their.fence_post_right is used.
    //             //                                              .anon.fence_post_right is used.
    //             //                                             .trash.fence_post_right is used.
    //             //                                             .about.fence_post_right is used.
    //
    //             me_word = nit_output.me_word;
    //
    //             then();
    //         }
    //     };
    //     var nit_output = {};
    //     window.qiki.lex_load(nits_url, nit_handlers, nit_output);
    // }

    // function render_nits(args) {
    //     var arg_descriptions = [];
    //     for (var i = 0 ; i < args.length ; i++) {
    //         var arg_description = render_nit(args[i]);
    //         arg_descriptions.push(arg_description);
    //     }
    //     return arg_descriptions.join(", ");
    // }

    // function render_nit(arg) {
    //     if (typeof arg === 'object' && arg.hasOwnProperty('idn')) {
    //         return "#" + arg.idn.toString();
    //     } else if (typeof arg === 'function' && arg.is_curried_word) {
    //         return arg().full_history();
    //         // NOTE:  This happens when arg is a curried word that was PASSED.
    //         //        Now we extract its info by calling it with zero parameters.
    //     } else if (typeof arg === 'number') {
    //         return JSON.stringify(arg);
    //     } else if (typeof arg === 'string') {
    //         return JSON.stringify(arg);
    //     } else {
    //         return "????" + typeof arg;
    //     }
    // }
    //
    // function render_idn(idn) {
    //     return "#" + String(idn);
    // }

    class CategoryWord extends qiki.Word {
        lex;   // NOTE:  Including these from qiki.Word to prevent boneheaded warnings.
        idn;
        obj;
        presentable_name;
        is_initially_open;
        /** @namespace {qiki.Bunch} */ conts;
        /** @namespace {jQuery} */ $sup;
        /** @namespace {jQuery} */ $cat;
        /** @namespace {Valve} */ valve;
        thumb_specs;

        kludge_cat_features() {
            var that = this;
            that.presentable_name = {
                my: lex.me_title(),
                their: "others",
                anon: "anonymous"
            }[that.obj.name] || that.obj.name;
            that.is_initially_open = {
                my: true,
                their: true
            }[that.obj.name] || false;
        }

        get $unrendered() { return this.$cat.find('.unrendered'); }
        get $frou() { return this.$cat.find('.frou-category'); }

        static from_element(element_or_selector) {
            var $sup = $(element_or_selector).closest('.sup-category');
            if ($sup.length === 1) {
                var cat = $sup.data('category-object');
                console.assert(
                    cat instanceof CategoryWord,
                    "Expecting CategoryWord, not", cat,
                    "at", element_or_selector
                );
                console.assert(
                    cat.$sup.is($sup),
                    "Category dom disassociated",
                    cat.$sup, $sup, element_or_selector
                );
                return cat;   // which could be undefined
            } else {
                return null;
            }
        }

        build_dom() {
            var that = this;
            that.$sup = $('<div>', {'class': 'sup-category'});
            that.$sup.data('category-object', that);

            var $title = $('<h2>', {'class': 'frou-category'});
            // NOTE:  "frou" refers to the decorative stuff associated with a category.
            //        In this case, that's just the <h2> heading,
            //        which contains the category valve (the open-close triangles).
            //        In a closed category, this frou is all we see,
            //        so we have to deal with dropping there.

            // $title.append(title);

            that.$sup.append($title);
            that.$cat = $('<div>', {id: that.idn, 'class': 'category'});
            that.$cat.addClass('category-' + that.obj.name);
            that.$sup.append(that.$cat);
            that.valve = new Valve({
                name: that.obj.name,
                is_initially_open: that.is_initially_open,
                on_open: function() {
                    var doc_top = $(window).scrollTop();
                    var doc_bottom = doc_top + $(window).height();
                    var cat_top = that.$cat.offset().top;
                    var cat_pixels_in_view = doc_bottom - cat_top;
                    if (cat_pixels_in_view < MIN_OPEN_CATEGORY_VIEW) {
                        // NOTE:  Category is scrolled down too far, not enough content is visible.
                        dom_from_$(that.$sup).scrollIntoView({
                            block: 'nearest',
                            inline: 'nearest'
                        });
                        doc_top = $(window).scrollTop();
                        var sup_top = that.$sup.offset().top;
                        var cat_pixels_above_browser_top = doc_top - sup_top;
                        var cat_pixels_above_up_top = cat_pixels_above_browser_top + TOP_SPACER_PX;
                        if (cat_pixels_above_up_top > 0) {
                            // NOTE:  Category is scrolled up too far, underneath #up-top.
                            window.scrollBy(0, - TOP_SPACER_PX);
                        }
                    }
                }
            });
            var $valve = that.valve.$valve;
            $title.prepend($valve);   // triangles go BEFORE the heading text

            $valve.append(that.presentable_name);
            // NOTE:  Include title inside valve element, so clicking the word opens and closes,
            //        along with the triangle symbols.

            var $how_many = $('<span>', {'class': 'how-many'});
            $valve.append($how_many);   // (n) anti-valve goes AFTER the heading text
            // NOTE:  Number is clickable to expand also.

            that.valve.control(that.$cat, $how_many);
            var $unrendered = $('<div>', {'class': 'unrendered'});
            // NOTE:  Until show_unrendered_count() is called, this element's 'count' data
            //        will remain unspecified.
            that.$cat.append($unrendered);
        }

        render_some_conts(n_show) {
            var that = this;
            var num_newly_rendered = 0;
            that.conts.loop(/** @param {ContributionWord} cont */ function (cont) {
                if (cont.is_dom_rendered()) {
                    // NOTE:  Skip this already-rendered contribution.
                    //        This happens when you click "20 more" and we're hunting for unrendered
                    //        contributions, skipping first over those that are already rendered.
                } else if (does_query_string_allow(cont.idn)) {

                    that.render_rando_cont(cont);

                    num_newly_rendered++;
                    if (num_newly_rendered >= n_show) {
                        return false;
                    }
                } else {
                    // NOTE:  This contribution was excluded by `cont` parameter in the query string.
                }
            });
        }
        render_rando_cont(cont) {
            var that = this;
            if (cont.is_dom_rendered()) {
                console.error("Already rendered contribution", cont);
            } else {
                cont.build_dom();
                cont.rebuild_bars(function () {
                    if (is_defined(window.ResizeObserver)) {
                        // SEE:  ResizeObserver, https://caniuse.com/#feat=resizeobserver

                        cont.resize_observer = new ResizeObserver(function resized_cont_handler() {
                            cont.fix_caption_width();
                        });
                        cont.resize_observer.observe(dom_from_$(cont.$cont));
                    }
                });
                if (that.$unrendered.length === 0) {
                    that.$cat.append(cont.$sup);
                } else {
                    that.$unrendered.before(cont.$sup);
                }
                console.assert(cont.is_dom_rendered(), "Should be freshly rendered", cont);
            }
        }
        show_unrendered_count() {
            var that = this;
            var total_conts = that.conts.num_words();
            var number_renderings = that.$cat.find('.contribution').length;
            // var number_popup_conts = that.$cat.find('#popup-screen').find('.contribution').length;
            // var number_thumbnail_renderings = number_renderings - number_popup_conts;
            var number_of_unrendered_conts = total_conts - number_renderings;
            that.$unrendered.empty();
            that.$unrendered.append($('<div>', {class: 'unrendered-count'}).text(f("{n} more", {n: number_of_unrendered_conts})));
            that.$unrendered.append($('<div>', {class: 'unrendered-arrow'}).text(UNICODE.BLACK_RIGHT_POINTING_TRIANGLE));
            that.$unrendered.data('count', number_of_unrendered_conts);
            that.$unrendered.toggleClass('zero', number_of_unrendered_conts === 0);
            // TODO:  Title tool-tip should say, e.g.:
            //            Click to show 10 more.  Shift-click to show 100 more.
            //        Numbers should change depending on MORE_CAT_CONT.
            //        And also depending on how many contributions are ACTUALLY unrendered.
            //        And note that it's NOT clickable if the page is ?cont=NNNN limited.
            // TODO:  The shift key should change e.g. "234 more" to
            //        "234 more (shift-click to see 100 of them)"
            // TODO:  Show icons resembling how many more?  Numerous little squares.
            // TODO:  Think of other ways to visually represent the mental models user should have.
        }
    
        /**
         * Insert a contribution's newly built DOM into the left end of a category's DOM.
         *
         * This doesn't touch the Bunch of ContributionWords in CategoryWord.conts.
         * The caller should have done that via .each_json() in .contribute_word.
         *
         * This is called when (1) posting a new contribution, or (2) dropping into a Valve-
         * minimized category.
         *
         * @param cont
         */
        insert_left(cont) {
            var that = this;
            var $container_entry = that.$cat.find('.container-entry');
            if ($container_entry.length > 0) {
                // Insert after the entry form ('my' category)
                $container_entry.last().after(cont.$sup);
            } else {
                // Insert at the left end (any other category)
                that.$cat.prepend(cont.$sup);
            }
        };

        usable_width() {
            var that = this;
            return Math.min(
                $(window).width(),
                $(window.document.body).width(),
                // NOTE:  Body might be wider than window if horizontal scrollbar is active.
                that.$cat.width()
            );
        }
    }

    class ContributionWord extends qiki.Word {
        lex;
        idn;
        obj;
        /** @namespace {ResizeObserver} */ resize_observer;
        /** @namespace {CategoryWord} */ cat;
        handler;
        is_temporarily_rendered = false;

        get id_attribute () {return this.id_prefix + this.idn_string;}
        get id_prefix() {return this._id_prefix || '';}
        set id_prefix(new_prefix) {return this._id_prefix = new_prefix;}
        get idn_string() {return String(this.idn);}
        get $cont() {return this.$sup.find('.contribution');}
        get $render_bar() {return this.$sup.find('.render-bar');}
        get $save_bar() {return this.$sup.find('.save-bar');}
        get $caption_bar() {return this.$sup.find('.caption-bar');}
        get $caption_span() {return this.$sup.find('.caption-span');}
        get $external_link() {return this.$sup.find('.external-link');}
        // get content() {
        //                       var that = this;
        //                       if (that.is_dom_rendered()) {
        //                           return that.$cont.text();
        //                           // TODO:  Are the EN_SPACE indentation characters a problem?
        //                           //        See Contribution.prototype.build_dom
        //                       } else {
        //                           return that.obj.text;
        //                       }
        //                   }
        get caption_text() {return is_specified(this.capt) ? this.capt.obj.text : ""}
        get is_media() {return could_be_url(this.obj.text);}
        get media_domain() {return sanitized_domain_from_url(this.media_url);}
        get $img_thumb() {return this.$render_bar.find('img.thumb');}
        get has_iframe() {return this.is_dom_rendered() && this.$iframe.length === 1;}
        get $iframe() {return this.$render_bar.find('iframe');}
        // get $cat() {return this.$sup.closest('.category');}
        get media_url() {return this.is_media ? this.obj.text : null;}

        /**
         * .iframe - DOM object for the iframe, or null
         *
         * @return {HTMLElement|null} DOM object, or null if no iframe
         */
        // TODO:  This JSDoc header STILL doesn't obviate the need for a
        //        noinspection JSIncompatibleTypesComparison
        get iframe() {return dom_from_$(this.$iframe) || null;}

        /**
         * Do we have a DOM element rendering for this contribution?
         *
         * Make sure this is true before accessing any property that relies on the .$sup property.
         * This also arbitrates where the content is.
         *     if true:   that.$cont.text()
         *     if false:  that.unrendered_content
         *
         * @return {boolean}
         */
        is_dom_rendered() {
            return this.is_idn_specified() && is_specified(this.$sup) && this.$sup.length === 1;
        }

        is_idn_specified() {
            return is_specified(this.idn);
        }

        /**
         * Return a Contribution instance given any element inside its DOM.
         *
         * @param element_or_selector - e.g. '#1821' or $('.pop-up')
         * @return {null|ContributionWord}
         */
        static from_element(element_or_selector) {
            var $sup = $(element_or_selector).closest('.sup-contribution');
            if ($sup.length === 1) {
                var cont = $sup.data('contribution-object');
                console.assert(
                    cont instanceof ContributionWord,
                    "Expecting ContributionWord, not", cont,
                    "at", element_or_selector
                );
                console.assert(
                    cont.$sup.is($sup),
                    "Contribution dom disassociated",
                    cont.$sup, $sup, element_or_selector
                );
                return cont;   // which could be undefined
            } else {
                return null;
            }
        }

        /** @namespace {jQuery} */ $sup;
        build_dom() {
            var that = this;

            that.dom_link($('<div>', {'class': 'sup-contribution word size-adjust-once'}));
            that.$sup.append($('<div>', {'class': 'contribution', id: that.id_attribute}));
            that.$cont.text(leading_spaces_indent(that.obj.text));

            var $render_bar = $('<div>', {'class': 'render-bar'});
            var $caption_bar = $('<div>', {'class': 'caption-bar'});
            var $save_bar = $('<div>', {'class': 'save-bar'});
            $save_bar.append($('<button>', {'class': 'edit'}).text("edit"));
            $save_bar.append($('<button>', {'class': 'cancel'}).text("cancel"));
            $save_bar.append($('<button>', {'class': 'save'}).text("save"));
            $save_bar.append($('<button>', {'class': 'discard'}).text("discard"));
            $save_bar.append(
                $('<button>', {
                    'class': 'expand',
                    title: "expand"
                })
                    .append($icon('fullscreen'))
                    .append($('<span>', {'class': 'wordy-label'}).text(" bigger"))
            );
            $save_bar.append(
                $('<button>', {'class': 'play'})
                    .append($icon('play_arrow'))
                    .append($('<span>', {'class': 'wordy-label'}).text(" play"))
            );
            var $external_link = $('<a>', {'class': 'external-link among-buttons'});
            $external_link.append($icon('launch'))
            $save_bar.append($external_link);

            that.$sup.append($render_bar);
            that.$sup.append($caption_bar);
            that.$sup.append($save_bar);

            var $grip = $('<span>', {'class': 'grip'});
            $caption_bar.append($grip);
            $grip.text(GRIP_SYMBOL);
            var $caption_span = $('<span>', {'class': 'caption-span'});
            $caption_bar.append($caption_span);

            $caption_span.append(that.caption_text);
            // TODO:  Why .append() here, versus .text() when looping through CAPTION words?

            if (that.was_submitted_anonymous) {
                that.$sup.addClass('was-submitted-anonymous');
            }
        }
        dom_link($sup) {
            var that = this;

            that.$sup = $sup;
            // NOTE:  primal connection:  from object instance --> to DOM element
            //        `$sup` - DOM element was created in ContributionWord.build_dom()

            that.$sup.data('contribution-object', that);
            // NOTE:  primal connection:  from DOM element --> to object instance
            //        `that` - object was instantiated by LexCloud.each_word_json(),
            //                 which was called by either:
            //                     LexCloud.scan() or
            //                     LexContribute.create_word()
        }

        /**
         * Render the contents of .render-bar (for a media url) or .contribution (for a text quote)
         * @param then
         */
        rebuild_bars(then) {
            var that = this;
            then = then || function () {};
            if (that.is_media) {
                that.render_media(intermediate_step);
            } else {
                that.render_text(intermediate_step);
            }

            function intermediate_step() {
                setTimeout(function () {
                    // NOTE:  This little bit of breathing space really seems to make a difference
                    //        when adjusting the sizes of what's newly rendered.
                    //        Especially some quotes and yellow-background error messages, which
                    //        otherwise are too wide.
                    initial_thumb_size_adjustment();
                    then();
                });
            }
        }
        render_media(then) {
            var that = this;
            // NOTE:  that.$iframe may not exist yet, e.g. on page reload, or entering a new cont.
            //        If it did exist it gets displaced here, e.g. after an edit.
            that.$sup.addClass('render-media');
            that.$external_link.attr('href', that.media_url);
            that.$external_link.attr('target', '_blank');
            that.$external_link.attr('title', that.media_domain + " - new tab");
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
                that.set_can_play(that.handler.media.can_play());

                that.$cont.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
                // NOTE:  Set width for editing the contribution URL text.

                that.handler.media.render_thumb(that, then);
            } else {
                // Virtually impossible to get here, because could_be_url() does the same test as
                // media_any_url.js media.url_patterns.  So nothing passes could_be_url() and fails
                // media_any_url.js.
                var error_message = [
                    "No media handler for",
                    that.id_attribute,
                    that.obj.text.slice(0,40),
                    "in",
                    media_handlers.length,
                    "handlers"
                ].join(" ");
                console.error(error_message);
                that.render_error(error_message);
                then();
            }
        }
        handler_scan() {
            var that = this;
            var did_find = false;
            if (that.is_media) {
                looper(media_handlers, function handler_loop(_, media_handler) {
                    if (media_handler.did_register) {
                        console.assert(is_specified(media_handler.media), media_handler);
                        console.assert(is_specified(media_handler.media.url_patterns), media_handler.media);
                        looper(media_handler.media.url_patterns, function pattern_loop(pattern_index, url_pattern) {
                            var match_object = that.obj.text.match(url_pattern);
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
                //        Especially when it's a triple loop inside rebuild_all_bars()
            }
            return did_find;
        }
        thumb_image(
            thumb_url,
            thumb_title,
            load_callback,
            error_callback
        ) {
            var that = this;
            type_should_be(thumb_url, String);
            type_should_be(thumb_title, String);
            type_should_be(load_callback, Function);
            type_should_be(error_callback, Function);
            if ( ! that.is_dom_rendered()) {
                console.warn("No thumb for unrendered contribution", that);
                return;
            }
            var $a = $('<a>', {
                id: that.id_prefix + 'thumb_' + that.idn_string,
                'class': 'thumb-link',
                href: thumb_url,
                target: '_blank',
                title: thumb_title
            });
            // THANKS:  class is a reserved word,
            //          https://api.jquery.com/jQuery/#creating-new-elements
            //          'The name "class" must be quoted in the object since it is a JavaScript
            //          reserved word, and "className" cannot be used since it refers to the
            //          DOM property, not the attribute.'

            // noinspection HtmlRequiredAltAttribute,RequiredAttributes
            var $img = $('<img>', {
                'class': 'thumb thumb-loading',
                alt: thumb_title
            });
            that.$render_bar.empty().append($a);
            $a.append($img);
            that.fix_caption_width();
            $img.one('load.thumb1', function render_img_load() {
                $img.off('.thumb1');
                $img.removeClass('thumb-loading');
                $img.addClass('thumb-loaded');
                that.fix_caption_width();
                load_callback();
            });
            $img.one('error.thumb1', function render_img_error() {
                $img.off('.thumb1');
                console.log("Broken thumb", thumb_url);
                error_callback();
            });
            // NOTE:  .src is set after the load and error event handlers,
            //        so one of those handlers is sure to get called.
            $img.attr('src', thumb_url);
        }
        render_text(then) {
            var that = this;
            that.$sup.removeClass('render-media');
            that.set_can_play(true);   // (can be "played" as text to speech audio)
            that.$external_link.removeAttr('href');
            that.$external_link.removeAttr('target');
            that.$external_link.removeAttr('title');
            that.$render_bar.empty();
            then();
        }
        render_error(error_message) {
            var that = this;
            var $p = $('<p>', { 'class': 'error-message' });
            $p.text(error_message);
            that.$render_bar.empty().append($p);
            // NOTE:  A different error message, from the one we're storing here in the thumbnail,
            //        would go into a popup if the Bot tries to play it.
            //        The popup error comes from the server, and goes inside the iframe
            //        (with no iFrameResizer) so it will not be accessible here,
            //        so it will not be recorded in the lex.

            // Early error, handler discovered it, maybe with help from noembed
            that.media_error_clarion("handler-rendering", error_message);
            // EXAMPLE:  Instagram image not found
            // EXAMPLE:  facebook is not supported. noembed provides some info but not a thumbnail. Provider: Facebook
            // EXAMPLE:  no matching providers found for 'inspire_rs'
            // NOTE:  Don't record in lex here!  Errors in thumbnails come through here.

            that.set_can_play(false);
            // NOTE:  How non-live thumbnails skip the bot.
            //        Also how the text gets its peachy background color.

            that.$render_bar.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
            // NOTE:  Might be better to set this in CSS, but that would need box-sizing:border-box

            that.$cont.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
            // NOTE:  Set width for editing the contribution URL text.

            that.fix_caption_width();
        }
        media_error_clarion(what, message) {
            var that = this;
            that.is_noembed_error = true;
            that.$sup.addClass('noembed-error');
            that.trigger_event(that.Event.MEDIA_ERROR, {message: message});
            console.warn("Media error", what, "#" + that.id_attribute, message);
            if (is_popup() && popped_cont.idn === that.idn) {
                // NOTE:  In other words, is there a popup, and is the error for the same contribution
                //        as the popup!  The second test is so that a delayed (dynamic) thumbnail
                //        error does not interfere with displaying the popup.
                // popped_cont.$sup.animate({
                //     top: TOP_SPACER_PX,
                //     left: 0
                // }, {
                //     duration: POP_UP_ANIMATE_MS,
                //     easing: POP_UP_ANIMATE_EASING,
                //     queue: false
                // });
                that.animate_headroom(TOP_SPACER_PX);
            }
        }

        /**
         * Animate the headroom of this contribution to a specific value.
         *
         * Headroom is the pixels between the top of the contribution and the top of the screen.
         * It can be negative when scrolled down below it.  Or larger than the screen height when
         * scrolled up above it.
         */
        animate_headroom(headroom_finish) {
            var that = this;
            var headroom_start = that.$sup.offset().top - $(window).scrollTop();
            $('html, body').each(function () {
                this.headroom = headroom_start;
            }).animate({
                headroom: headroom_finish
            }, {
                duration: POP_UP_ANIMATE_MS,
                easing: POP_UP_ANIMATE_EASING,
                queue: false,
                step: function (headroom_now) {
                    var scroll_top_now = that.$sup.offset().top - headroom_now;
                    $(this).scrollTop(scroll_top_now);
                },
            });
        }
        set_can_play(can) {
            var that = this;
            that.is_able_to_play = can;
            that.$sup.toggleClass('can-play', can);
            that.$sup.toggleClass('cant-play', ! can);
        }
        fix_caption_width() {
            var that = this;
            // TODO:  Call this function more places where $caption_bar.width(is set to something)
            // TODO:  Why can't this simply copy $sup.width() to $caption_bar.outerWidth()?

            var media_width  = that.$iframe    .is(':visible') ? that.$iframe    .outerWidth() || 0 : 0;
            var thumb_width  = that.$img_thumb .is(':visible') ? that.$img_thumb .outerWidth() || 0 : 0;
            var wordy_width  = that.$cont      .is(':visible') ? that.$cont      .outerWidth() || 0 : 0;
            var render_width = that.$render_bar.is(':visible') ? that.$render_bar.outerWidth() || 0 : 0;


            function adjust_to(width) {
                if (equal_ish(width, that.$caption_bar.outerWidth(), 1.0)) {
                    // NOTE:  width is already within 1 pixel, don't upset the UI.
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
                // NOTE:  thumb_width being 2 (or some nonzero value) is common, but temporary
            } else if (render_width > MIN_CAPTION_WIDTH) {
                adjust_to(render_width);
                // NOTE:  render_width is the only nonzero value when a noembed error is shown.
            } else if (wordy_width > MIN_CAPTION_WIDTH) {
                adjust_to(wordy_width);
                // NOTE:  wordy_width is the last resort, in case of quote contributions
                //        But it has width even when invisible, which we don't want.
                //        In that case choose media or thumb.
            }
        }
        live_media_iframe(parameters, then) {
            var that = this;
            then = default_to(then, function () {});
            if ( ! that.is_dom_rendered()) {
                console.warn("No live media for unrendered contribution", that);
                return;
            }
            var $iframe = $('<iframe>', {
                id: that.id_prefix + 'iframe_' + that.idn_string,   // This is NOT how a pop-up gets made.
                src: our_oembed_relay_url(parameters),
                      allowFullScreen : 'true',
                   mozallowFullScreen : 'true',
                webkitallowFullScreen : 'true',
                allow: 'autoplay; fullscreen'
            });
            $iframe.one('error.media1', function () {
                $iframe.off('.media1');
                then();
            });
            $iframe.one('load.media1', function () {
                $iframe.off('.media1');
                // NOTE:  Cannot delegate the iframe load event, because it doesn't bubble.
                //        https://developer.mozilla.org/Web/API/Window/load_event

                if ( ! that.is_dom_rendered()) {
                    console.warn("No live media loading for unrendered contribution", that);
                    return;
                }

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
                }, IFRAME_RECOVERY_CHECK_MS);
                $iframe.data('loader_timer', loader_timer);

                then();
                // NOTE:  Zero-iframe recovery (i.e. reload) might come AFTER callback is called.
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

            that.$render_bar.empty().append($iframe);   // The iframe is dead, long live the iframe.

            that.resizer_init(function () {});
        }
        zero_iframe_recover() {
            var that = this;
            if (that.is_dom_rendered()) {
                // NOTE:  A temporarily rendered contribution may already be popped down and no
                //        longer rendered.
                var $iframe = that.$iframe;
                if (
                    $iframe.is(':visible') &&
                    ($iframe.width() === 0 || $iframe.height() === 0)
                ) {
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
            }
        }
        resizer_nudge() {
            var that = this;
            if (that.has_iframe) {
                var iframe = that.iframe;
                // noinspection JSUnresolvedVariable
                iframe && iframe.iFrameResizer && iframe.iFrameResizer.resize();
            }
        }
        /**
         * Send a message to the embedded iframe JavaScript.
         *
         * @param message {object} - with an action property, and other action-specific properties
         */
        embed_message(message) {
            var that = this;
            that.iframe_resizer(
                function (resizer) {
                    resizer.sendMessage(message);
                },
                function (why) {
                    console.warn("Cannot iframe", message.action, "--", why);
                    // Cannot pause or resume text -- no iframe
                    // NOTE:  This harmlessly happens because of the redundant un-pop-up,
                    //        when POP_DOWN_ONE state does a pop_down_all()
                    //        before it punts to NEXT_CONTRIBUTION which pops up
                    //        (which also does a pop_down_all()).
                }
            );
        }
        /**
         * Do something with the iFrameResizer object.  Call back if there is one.  Explain if not.
         *
         * @param {function} callback_good - pass it the iFrameResizer object, if up and running
         * @param {function=} callback_bad - pass it an explanation if not
         */
        iframe_resizer(
            callback_good,
            callback_bad
        ) {
            var that = this;
            callback_bad = callback_bad || function (message) { console.error(message); };

            if (that.is_dom_rendered()) {
                if (that.is_media) {
                    if (that.has_iframe) {
                    // var iframe = that.iframe;
                    // // FALSE WARNING:  Condition is always false since types '{get: (function():
                    // //                 any | null)}' and 'null' have no overlap
                    // // noinspection JSIncompatibleTypesComparison
                    // if (iframe === null) {
                    //     bad("No iframe element in " + that.id_attribute);
                    // } else {
                        var resizer;
                        try {
                            // noinspection JSUnresolvedVariable
                            resizer = that.iframe.iFrameResizer;
                        } catch (e) {
                            callback_bad(
                                "No resizer " +
                                that.id_attribute + " " +
                                e.message + " - " +
                                that.iframe.id
                            );
                            return
                        }
                        if ( ! is_specified(resizer)) {
                            callback_bad("Null resizer " + that.id_attribute);
                        } else if (typeof resizer.sendMessage !== 'function') {
                            callback_bad("No resizer sendMessage " + that.id_attribute);
                        } else if (typeof resizer.close !== 'function') {
                            callback_bad("No resizer close " + that.id_attribute);
                        } else {
                            callback_good(resizer);
                        }
                    } else {
                        callback_bad("No iframe element in " + that.id_attribute);
                    }
                } else {
                    // NOTE:  E.g. harmlessly trying to use a cont with no render-bar iframe.
                }
            } else {
                callback_bad("No element " + that.idn);
            }
        }
        on_event(event_name, handler_function) {
            var that = this;
            that.$sup.on(event_name, function (_, custom_object) {
                handler_function(custom_object);
            });
        }

        trigger_event(
            event_name,
            custom_object   // not an array, as in jQuery .trigger()
        ) {
            var that = this;
            that.$sup.trigger(event_name, [custom_object]);
        }

        /**
         * Remove a contribution from the DOM.
         *
         * This happens when editing a contribution's text.  The edit-word becomes the basis for a new
         * contribution.  The old contribution word (or earlier edit word) is superseded.
         *
         * Not to be confused with unrendered content, which is only about the "20 more" clickable.
         */
        dom_removal() {
            var that = this;
            // if (is_defined(that.observer)) {
            //     that.observer.disconnect();
            //     delete that.observer;
            // }
            if (is_defined(that.resize_observer)) {
                that.resize_observer.disconnect();
                delete that.resize_observer;
            }
            if (is_defined(that.$sup)) {
                that.$sup.removeData();
                that.$sup.remove();
                delete that.$sup;
            } else {
                console.error("Cannot remove an unrendered contribution", that);
            }
        }

        /**
         * Initialize the iFrameResizer on an iframe jQuery object.
         *
         * @param {function} on_init - callback after iFrameResizer was initialized.
         */
        // NOTE:  Intermittent error made 2 of 3 youtube videos inoperative:
        //        iframeResizer.min.js:8 Failed to execute 'postMessage' on 'DOMWindow':
        //        The target origin provided ('...the proper domain...')
        //        does not match the recipient window's origin ('null').
        resizer_init(on_init) {
            var that = this;
            type_should_be(on_init, Function);
            var is_an_iframe = that.$iframe.length === 1;
            // FALSE WARNING:  Unresolved variable iFrameResizer
            // noinspection JSUnresolvedVariable
            var was_iframe_initialized = typeof dom_from_$(that.$iframe).iFrameResizer === 'object';

            if (!is_an_iframe) {
                console.error(
                    "Missing iframe",
                    that.id_attribute,
                    is_an_iframe,
                    was_iframe_initialized,
                    that
                );
            } else if (was_iframe_initialized) {
                console.log("Already initialized iframe", that.id_attribute);
                on_init();
            } else {
                setTimeout(function () {
                    // noinspection JSUnusedGlobalSymbols
                    that.$iframe.iFrameResize({
                        log: false,
                        sizeWidth: true,
                        sizeHeight: true,
                        widthCalculationMethod: 'taggedElement',
                        onMessage: function (twofer) {
                            that.iframe_incoming(twofer);
                        },
                        onResized: function iframe_resized_itself(stuff) {
                            console.assert(stuff.iframe === that.iframe, stuff.iframe, that);
                            console.assert(
                                that.is_dom_rendered(),
                                stuff.iframe,
                                stuff.iframe.parentElement,
                                stuff.height, stuff.width, stuff.type
                            );
                            var siz_width = parseFloat(stuff.width);
                            var siz_height = parseFloat(stuff.height);
                            if (
                                is_popup() &&
                                ! popped_cont.is_noembed_error &&
                                is_specified(popped_cont.pop_stuff)
                            ) {

                                // NOTE:  Popup animation is a collaboration, parent with embed:
                                //        The embed is animating the size of the popup.
                                //        The parent will now adjust the position accordingly.

                                // TODO:  Adjust scroll position along the scale from where the
                                //        thumbnail was on the screen to the top of the screen,
                                //        so the enlarging contribution appears to move there.

                                var progress_width = linear_transform(
                                    siz_width,
                                    popped_cont.pop_stuff.thumb_render_width,
                                    popped_cont.pop_stuff.max_live_width,
                                    0.0,
                                    1.0
                                )
                                // FALSE WARNING:  'thumb_render_height' should probably not be passed as
                                //                 parameter 'x1'
                                // noinspection JSSuspiciousNameCombination
                                var progress_height = linear_transform(
                                    siz_height,
                                    popped_cont.pop_stuff.thumb_render_height,
                                    popped_cont.pop_stuff.max_live_height,
                                    0.0,
                                    1.0
                                )
                                var progress = Math.max(progress_width, progress_height);
                                // NOTE:  Rely on whichever is further along the way to a full screen.

                                if (0.0 <= progress && progress <= 1.05) {
                                    // NOTE:  Is size between thumbnail and popup?
                                    // NOTE:  Limiting progress's range prevents e.g. a zero-size iframe
                                    //        from moving to the "vanishing" point.
                                    // NOTE:  A little forgiveness on the high end prevents a slightly
                                    //        oversize popup from never getting top & left set, e.g.
                                    //        a 401 error message.  Although that should now not be
                                    //        oversized.  (Multiple fixes.)

                                    // NOTE:  Linear conversion, size to position.
                                    // console.log(
                                    //     "iframe resized",
                                    //     that.id_attribute,
                                    //     stuff.width,
                                    //     stuff.height,
                                    //     popup_cont.pop_stuff.thumb_render_width,
                                    //     popup_cont.pop_stuff.thumb_render_height,
                                    //     popup_cont.pop_stuff.max_live_width,
                                    //     popup_cont.pop_stuff.max_live_height
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

                                    // var pop_left = 0;
                                    // var pop_top = TOP_SPACER_PX;
                                    // // FALSE WARNING:  'left' should probably not be passed as parameter 'y1'
                                    // // noinspection JSSuspiciousNameCombination
                                    // var sliding_left = linear_transform(
                                    //     progress,
                                    //     0.0, 1.0,
                                    //     popped_cont.pop_stuff.fixed_coordinates.left, pop_left
                                    // )
                                    // var sliding_top = linear_transform(
                                    //     progress,
                                    //     0.0, 1.0,
                                    //     popped_cont.pop_stuff.fixed_coordinates.top, pop_top
                                    // )
                                    // that.$sup.css({left: sliding_left, top: sliding_top});

                                    var headroom_popped_up = TOP_SPACER_PX;
                                    var sliding_headroom = linear_transform(
                                        progress,
                                        0.0, 1.0,
                                        popped_cont.pop_stuff.headroom_popped_down,
                                        headroom_popped_up
                                    )
                                    var sliding_scroll_top = (
                                        popped_cont.$sup.offset().top - sliding_headroom
                                    );
                                    $(window).scrollTop(sliding_scroll_top);
                                    // NOTE:  This tries to animate the *headroom*.  ScrollTop jumps
                                    //        suddenly when the expanding contribution wraps, but
                                    //        the idea is that the contribution jumps less visually,
                                    //        by making the preceding items jump suddenly instead.

                                    // NOTE:  Routine collaborative resize / reposition.
                                    // console.log(
                                    //     "Resize in",
                                    //     that.id_attribute,
                                    //     siz_width, "x", siz_height,
                                    //     pct(progress),
                                    //     sliding_left.toFixed(0) + "," + sliding_top.toFixed(0)
                                    // );
                                    // EXAMPLE:
                                    //     Resize in popup_1990 278.671875 x 194 17.4% 238,70
                                    //     Resize in popup_1990 312.296875 x 213 20.6% 229,68
                                    //     Resize in popup_1990 345.921875 x 231 23.7% 220,66

                                } else {
                                    if (siz_width === 0 && siz_height === 0) {
                                        // We harmlessly start out with zero-size iframe.
                                    } else {
                                        console.warn(
                                            "Resize out",
                                            that.id_attribute,
                                            siz_width, "x",
                                            siz_height,
                                            pct(progress), "[",
                                            pct(progress_width),
                                            pct(progress_height), "]",
                                            that.$render_bar.width(),
                                            that.$render_bar.height(), "~",
                                            popped_cont.pop_stuff.thumb_render_width,
                                            popped_cont.pop_stuff.thumb_render_height, "->",
                                            popped_cont.pop_stuff.max_live_width,
                                            popped_cont.pop_stuff.max_live_height
                                        );
                                    }
                                }
                                function pct(z) {
                                    return (z * 100.0).toFixed(1) + "%";
                                }
                            }
                            that.fix_caption_width();
                        },
                        checkOrigin: [MONTY.OEMBED_OTHER_ORIGIN]
                    });
                    // TODO:  live_media_iframe() postMessage error from iframeResizer,
                    //        Is it wrong?  Fixable?
                    //        iframeResizer.js:754 Failed to execute 'postMessage' on 'DOMWindow':
                    //        The target origin provided ('http://...') does not match the recipient
                    //        window's origin ('http://...').
                    on_init();
                }, IFRAME_RESIZER_INIT_MS);
            }
        }
        iframe_incoming(twofer) {
            var that = this;
            var message = twofer.message;
            console.assert(
                message.id_attribute === that.id_attribute,
                "Mismatch id_attribute",
                that.id_attribute,
                message
            );
            var idn_string = strip_prefix(message.id_attribute, MONTY.POPUP_ID_PREFIX);
            var idn = parseInt(idn_string);
            console.assert(idn === that.idn, "Mismatch idn", that.idn, idn, message);
            // noinspection JSRedundantSwitchStatement
            switch (message.action) {
            case 'auto-play-presaged':
                console.log("Media presaged", that.id_attribute, message.id_attribute);
                that.trigger_event(that.Event.MEDIA_BEGUN);
                break;
            case 'auto-play-static':
                console.log("Media static", that.id_attribute, message.id_attribute);
                that.trigger_event(that.Event.MEDIA_STATIC, {
                    idn: that.idn,
                    current_time: message.current_time
                });
                // interact.start(idn, message.current_time);
                // DONE:  Avoid double START interact.  Interaction is now lexed in event handler.
                //        Can happen if Contribution.zero_iframe_recover()
                break;
            case 'auto-play-begun':
                console.log("Media begun", that.id_attribute, message.id_attribute);
                // NOTE:  Okay to pause.
                break;
            case 'auto-play-woke':
                console.log("Media woke", that.id_attribute, message.id_attribute);
                that.trigger_event(that.Event.MEDIA_WOKE);
                // NOTE:  State changes, first sign of life from youtube player.
                break;
            case 'auto-play-end-dynamic':
                console.log("Dynamic media ended", that.id_attribute, message.id_attribute);
                that.trigger_event(that.Event.MEDIA_ENDED);
                // NOTE:  MEDIA_ENDED event means e.g. a video ended,
                //        so next it's time for a breather.
                // interact_old.end(idn, message.current_time);
                interact_new.end({contribute: idn, progress: ms_round(message.current_time)});
                break;
            case 'auto-play-end-static':
                console.log("Static media ended", that.id_attribute, message.id_attribute);
                // NOTE:  Static media timed-out, no breather necessary.
                // interact_old.end(idn, message.current_time);
                interact_new.end({contribute: idn, progress: ms_round(message.current_time)});
                break;
            case 'auto-play-error':
                // Later error, youtube finds
                that.media_error_clarion("auto-play", message.error_message);
                // EXAMPLE:  YouTube Player error 150
                //           Video unavailable
                //           This video contains content from Home Box Office Inc.,
                //           who has blocked it on copyright grounds.
                //           https://www.youtube.com/watch?v=axVxgCT3YD0 (Six Feet Under finale)
                break;
            case 'auto-play-paused':
                console.log(
                    "Media paused - static or dynamic",
                    that.id_attribute,
                    message.id_attribute,
                    message.current_time
                );
                that.trigger_event(that.Event.MEDIA_PAUSED);
                if ( ! that.is_noembed_error) {
                    // interact_old.pause(idn, message.current_time);
                    interact_new.pause({contribute: idn, progress: ms_round(message.current_time)});
                    // NOTE:  This could happen a while after the pause button is clicked,
                    //        after a cascade of consequences.  But it should accurately
                    //        record the actual position of the pause in the video.
                }
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
                    message.id_attribute
                );
                // interact_old.quit(idn, message.current_time);
                interact_new.quit({contribute: idn, progress: ms_round(message.current_time)});
                break;
            case 'auto-play-playing':
                // console.log(
                //     "Media playing",
                //     that.id_attribute,
                //     message.id_attribute,
                //     message.current_time.toFixed(3),
                //     bot.is_paused
                // );

                // if (bot.is_paused) {
                //     // NOTE:  This may be the sole place a Contribution knows of a Bot.
                //     //        Necessary?  Wise?
                //     interact.resume(idn, message.current_time);
                // } else {
                //     interact.start(idn, message.current_time);
                // }

                // TODO:  Get smarter about the work iframe_incoming() does, and the work
                //        Bot.finite_state_machine() does.  The only reason to move the interact.verb()
                //        calls here was so they'd record the manual playing of contributions.
                //        The FSM event handlers don't catch those, because they're .off()ed
                //        at MEDIA_END or POP_DOWN_ONE.
                //        Unfortunately it's still buggy, because bot.is_paused is tested here
                //        but never set in MANUAL state when a pause comes through.
                //        Maybe the multiple sources of play/pause/resume events should NOT be combined
                //        but rather teased apart:
                //            1. Global buttons - bot
                //            2. Individual play button under each contribution thumbnail.
                //            3. Media embedded buttons e.g. inside a YouTube video.

                var S = bot.State;
                if (bot.is_paused) {
                    bot.assert_state_is([
                        S.MEDIA_PAUSE_IN_FORCE   // dynamic resume, parent or embed, bot only
                    ]);
                    console.log("Media resuming", idn, message.current_time);
                    // interact_old.resume(idn, message.current_time);   // dynamic resume
                    interact_new.resume({contribute: idn, progress: ms_round(message.current_time)});   // dynamic resume
                    bot._pause_ends();
                } else {
                    bot.assert_state_is([
                        S.MANUAL,          // dynamic play for the first time, manual - and (BUG) resume after pause
                        S.MEDIA_STARTED    // dynamic play for the first time, bot
                    ]);
                    console.log("Media started playing", idn, message.current_time);
                    // interact_old.start(idn, message.current_time);
                    interact_new.start({contribute: idn, progress: ms_round(message.current_time)});
                    // NOTE:  Don't think it's possible to get a double START on dynamic media
                    //        the way it was with static media.
                    //        We got here from an auto-play-playing message from the embed
                    //        and that could not hardly have come from a zero-size iframe.
                }


                // that.trigger_event(that.Event.MEDIA_PLAYING);



                break;
            // case 'auto-play-resume':
            //     // NOTE:  This is a parent-initiated resume, for non-dynamic media.
            //     console.log(
            //         "Media resume",
            //         that.id_attribute,
            //         message.id_attribute,
            //         message.current_time.toFixed(3)
            //     );
            //     interact.resume(idn, message.current_time);
            //     that.trigger_event(that.Event.MEDIA_RESUME, {
            //         current_time: message.current_time
            //     });
            //
            //     break;
            case 'noembed-error-notify':
                // Later error, noembed finds
                that.media_error_clarion("noembed-error", message.error_message);
                // EXAMPLE:  noembed error 401 Unauthorized
                //           https://www.youtube.com/watch?v=bAD2_MVMUlE (Love Actually end)
                //           https://www.youtube.com/watch?v=7FwBbb6FuCU (Eisenhower Farewell)
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
        // /**
        //  * Compute coordinates for position:fixed clone that would appear in the same place.
        //  *
        //  * @return {{top: number, left: number}}
        //  */
        // css_for_position_fixed() {
        //     var that = this;
        //     var offset;
        //     if (that.is_dom_rendered()) {
        //         offset = that.$sup.offset();
        //     } else {
        //         offset = that.cat.$unrendered.offset();
        //     }
        //     return {
        //         top: offset.top - $(window).scrollTop(),
        //         left: offset.left - $(window).scrollLeft()
        //     };
        //     // THANKS:  Recast position from relative to fixed, with no apparent change,
        //     //          (my own compendium) https://stackoverflow.com/a/44438131/673991
        // }
        play_quote_synthesis() {
            var that = this;

            // var pop_text = that.content;

            utter = new window.SpeechSynthesisUtterance(that.obj.text);
            js_for_unslumping.utter = utter;
            // THANKS:  SpeechSynthesis bug workaround from 2016,
            //          https://stackoverflow.com/a/35935851/673991
            // NOTE:  Not sure if this is the same bug, but sometimes speech was
            //        not starting.

            utter.rate = 0.75;

            utter.pitch = 1.0;    // otherwise it's -1, wtf that means

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
                that.trigger_event(that.Event.SPEECH_START);
                // interact_old.start(that.idn, evt.originalEvent.charIndex);
                interact_new.start({contribute: that.idn, progress: evt.originalEvent.charIndex});
                speech_progress = 0;
            });
            $(utter).on('pause', function speech_pause() {
                // interact_old.pause(that.idn, speech_progress);
                interact_new.pause({contribute: that.idn, progress: speech_progress});
            });
            $(utter).on('resume', function speech_resume() {
                // interact_old.resume(that.idn, speech_progress);   // quote resume
                interact_new.resume({contribute: that.idn, progress: speech_progress});   // quote resume
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
                var word_to_end = that.obj.text.slice(start_word);
                var len_word = word_to_end.search(/\s|$/);
                var end_word = start_word + len_word;
                var the_word = that.obj.text.slice(start_word, end_word+1);
                var range_word = window.document.createRange();
                that.$cont.text(that.obj.text);

                var text_node = dom_from_$(that.$cont).childNodes[0];

                console.assert(text_node.nodeName === '#text', text_node, that);
                range_word.setStart(text_node, start_word);
                range_word.setEnd(text_node, end_word);
                // THANKS:  Range of text, https://stackoverflow.com/a/29903556/673991
                var speaking_node = dom_from_$($('<span>', { 'class': 'speaking' }));
                range_word.surroundContents(speaking_node);
                // THANKS:  Range wrap, https://stackoverflow.com/a/6328906/673991
                speech_progress = end_word;
                // SEE:  Highlight speech, https://stackoverflow.com/a/38122794/673991
                // SEE:  Select speech, https://stackoverflow.com/a/50285928/673991

                // scroll_into_view(speaking_node, {
                //     behavior: 'smooth',
                //     block: 'center',
                //     inline: 'center'
                // });
                // NOTE:  This was distracting and confusing, especially after popping up
                //        worked well for text quotes.


                if (EXPERIMENTAL_RED_WORD_READING) {
                    // NOTE:  The following experimental code would render the word being
                    //        spoken, in red, on top of the same word in the paragraph.
                    var r = range_word.getBoundingClientRect();
                    console.log("Bound", the_word, r.x, r.y);
                    if ($svg !== null) {
                        $svg.remove();
                    }
                    var svg_top = r.top - that.$sup.position().top;
                    var svg_left = r.left - that.$sup.position().left;
                    $svg = $('<svg>', {
                        height: r.height,
                        width: r.width,
                        style: (
                            'position:absolute;color:red;font: 16px Literata,serif;' +
                            'top:'+String(svg_top)+'px;' +
                            'left:'+String(svg_left)+'px;'
                        )
                    }).append($('<text>', { fill: 'red !important' }).append(the_word));
                    that.$sup.append($svg);
                    // TODO:  Needs to scroll word into view,
                    //        and then also position the svg right onto the scrolled word.
                }
            });
            $(utter).on('end', function (evt) {
                that.$cont.text(that.obj.text);
                if (utter === null) {
                    console.error(
                        "Utterance interruptus (vestigial end after aborted speech)",
                        (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec"
                    );
                    // TODO:  Make a better scheme for detecting a stale utter event.
                    //        Because a NEW bot play cycle might otherwise be
                    //        transitioned prematurely.
                    //        Did the $(utter).off() in pop_down_all() solve this issue?
                    // interact_old.quit(that.idn, speech_progress);
                    interact_new.quit({contribute: that.idn, progress: speech_progress});
                } else {
                    console.log(
                        "Utterance",
                        (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec,",
                        speech_progress, "of", that.obj.text.length, "chars"
                    );
                    that.trigger_event(that.Event.SPEECH_END);
                    // NOTE:  A bit lame, this happens whether manually popped up or
                    //        automatically played by the bot.  But it should have
                    //        no consequence manually anyway.
                    interact_new.end({contribute: that.idn, progress: that.obj.text.length});
                }
                speech_progress = null;
                // NOTE:  Setting speech_progress to null here prevents interact.quit() after
                //        interact.end()
            });
            that.trigger_event(that.Event.SPEECH_PLAY);
        }
        play_quote_talkify(is_auto_play) {
            var that = this;

            // NOTE:  The following code worked with the Talkify service.
            //        Which I recall was more legible than the Chrome browser speech,
            //        (though less so than the Edge browser speech), and is reasonably
            //        priced, but any metering of an uber free service is vexing.

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
                var popup_cont_node_list = document.querySelectorAll(selector_from_id(that.id_attribute));
                // NOTE:  Although that.$sup appears to work,
                //        the doc calls for "DOM elements" and the example passes a NodeList object.
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

                var pause_once = ! is_auto_play;

                var this_player = talkify_player;
                // NOTE:  Local "copy" of player needed in case pop_down_all() happens
                //        before the callback below has fully popped up.

                talkify.messageHub.subscribe(BOT_CONTEXT, '*', function (message, topic) {
                    // var members = message ? Object.keys(message).join() : "(no message)";
                    console.log("talkify", topic/*, members*/);
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
                            // NOTE:  Crude, mf-ing way to support manual-only playing.
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
                        that.trigger_event(that.Event.SPEECH_END);
                        // console.log("talkify ended", that.id_attribute, message, topic);
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
                        "talkify", that.id_attribute,
                        "voice", talkify_voice_name,
                        duration_report
                    );
                };
                that.trigger_event(that.Event.SPEECH_PLAY);
            }
        }

        /**
         * How much width is taken up by stuff OUTSIDE the contribution's rendering.
         *
         * Includes this.$sup padding plus this.$cont padding.  Left plus right.
         */
        chrome_width() {
            return this.$sup.innerWidth() - this.$cont.width();
        }
        /**
         * Animated pop-up of a text quote.
         *
         * @param {function} then - callback when done.
         */
        full_ish_screen_text(then) {
            var that = this;
            var cont_css_width = that.$cont.css('width');
            var cont_css_height = that.$cont.css('height');
            var sup_left_is = that.$sup.offset().left;

            that.$cont.width('auto');   // Find out how wide the text wants to go.
            that.$cont.height('auto');
            // NOTE:  This works even if the thumbnail is way over to the right,
            //        because if the contribution's INNER text wants more width, then the
            //        contribution's OUTER flow within the category will wrap.
            //        But we won't see that because we'll revert the width before the DOM
            //        gets a chance to render it.

            var sup_natural_width = that.$sup.width()
            var sup_natural_height = that.$sup.height();
            var cont_natural_width = that.$cont.width();

            var does_man_spread = sup_natural_width > (that.cat.usable_width() * 0.95);
            // NOTE:  Does the content take up almost all the width we gave it?

            var is_poetry = any_lone_newlines(that.obj.text) && ! does_man_spread;
            // NOTE:  Poetry has hard returns because it likes to control the lines.
            //        Prose is a stream of text or paragraphs.
            //        So prose tends to man-spread to the width of the screen, while poetry does
            //        not.  If this contribution does man-spread, it still might be prose --
            //        really short prose.  Huh, double-spaced poetry will be considered prose,
            //        because it has no lone newlines.  And so it might be slightly more likely to
            //        wrap, trying to match the aspect ratio, and get a bigger font.



            //// Horizontal - determine left and width properties

            var SUP_PAD_LEFT = px_from_rem(0.5);   // SEE:  contribution.css
            var ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP = 10;
            var widest_cont_could_be = that.cat.usable_width() - that.chrome_width();
            var cont_width_value = Math.min(
                cont_natural_width + ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP,
                widest_cont_could_be
            );
            var width_cont_doesnt_need = widest_cont_could_be - cont_width_value;
            var sup_left_want = width_cont_doesnt_need/2 + SUP_PAD_LEFT;
            var cont_width_setting;
            if (is_poetry) {   // let poetry control the line width
                cont_width_setting = 'auto';
            } else {   // take control of the width for prose
                cont_width_setting = cont_width_value;

                // NOTE:  Now see if we can match the prose's aspect ratio to the window's.

                var width_portion = cont_width_value / that.cat.usable_width();
                var height_portion = sup_natural_height / usable_height();
                var cont_fatter_than_window = width_portion / height_portion;
                // NOTE:  How much fatter is the content than the window?  fatter > 1, thinner < 1
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
                    if (cont_width_value_new < px_from_rem(WIDTH_MAX_EM.soft)) {
                        cont_width_value_new = px_from_rem(WIDTH_MAX_EM.soft);   // not too skinny
                    }
                    if (cont_width_value_new < cont_width_value) {

                        // NOTE:  This if-test prevents VERY tiny contributions from being made
                        //        WIDER than they would have been.
                        //        Because we only want this step to SHRINK width.

                        sup_left_want += (cont_width_value - cont_width_value_new)/2;
                        cont_width_value = cont_width_value_new;
                        cont_width_setting = cont_width_value;
                    }
                }
            }
            // that.$sup.css('left', sup_left);   // set left BEFORE width, avoiding right-edge wrap
            that.$cont.width(cont_width_setting);
            that.fix_caption_width();



            //// Vertical - determine top and height properties

            that.$cont.height('auto');

            var sup_height = that.$sup.height();
            var sup_chrome_v = that.$sup.innerHeight() - that.$cont.height();
            var sup_top_want;
            var cont_height_setting;
            if (sup_height <= usable_height()) {
                sup_top_want = (TOP_SPACER_PX + $(window).height() - sup_height)/2;
                cont_height_setting = 'auto';
            } else {
                sup_top_want = TOP_SPACER_PX;
                cont_height_setting = usable_height() - sup_chrome_v;
            }

            // that.$sup.css('top', sup_top);
            that.$cont.height(cont_height_setting);



            //// Font - can we make this bigger?

            var expandable_h = that.cat.usable_width() / that.$sup.innerWidth();
            var expandable_v = usable_height() / that.$sup.innerHeight();
            var expandable = Math.min(expandable_h, expandable_v);
            var expand_font = null;

            var font_size_setting;
            var font_size_normal = px_from_rem(1);
            // NOTE:  Animating to or from 'inherit' doesn't seem to work.

            if (expandable > 1.1) {
                // NOTE:  Don't fiddle with a middling expansion.

                expand_font = Math.min(expandable, MAX_FONT_EXPANSION);

                var sup_width_before = that.$sup.width();
                var sup_height_before = that.$sup.height();
                //
                // that.$sup.css('left', 0);   // prepare to grow font without right-edge wrap
                // that.$sup.css('top', 0);
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
                //
                sup_left_want -= (sup_width_after - sup_width_before) / 2;
                sup_top_want -= (sup_height_after - sup_height_before) / 2;
                // that.$sup.css('left', sup_left);
                // that.$sup.css('top', sup_top);
            } else {
                font_size_setting = font_size_normal;
            }

            var is_right_of_where_we_want_it = sup_left_want < sup_left_is;
            console.debug(
                is_right_of_where_we_want_it ? "It's right" : "It's left",
                Math.abs(sup_left_want - sup_left_is),
                "px from where we want it.",
                sup_left_want, sup_left_is, that.cat.usable_width(), cont_width_value
            );



            //// Animate

            deanimate("popping up quote", that.id_attribute);

            var thumb_cont = that.lex.cont_from_idn(that.idn);

            // NOTE:  Popup text elements are now are at their FINAL place and size.
            //        But nobody has seen that yet.
            //        Get stats on them before reverting everything to its STARTING place and size,
            //        for the animation.

            var pop_cont_css_width = that.$cont.css('width');
            var pop_cont_css_height = that.$cont.css('height');
            var pop_caption_css_width = that.$caption_bar.css('width');

            that.$cont.css('width', cont_css_width);
            that.$cont.css('height', cont_css_height);
            // NOTE:  jQuery animation seems to need the STARTING point to be set via .css(),
            //        not .width() and .height()

            that.fix_caption_width();
            that.$cont.css('font-size', font_size_normal);

            var promises = [];
            var margin_left_up;
            if (is_right_of_where_we_want_it) {
                popped_cont.pop_stuff.margin_left_down = sup_left_is - FUDGE_FICKLE;
                margin_left_up = sup_left_want - FUDGE_FICKLE;

                var offset_top_1 = popped_cont.$sup.offset().top;
                var scroll_top_1 = $(window).scrollTop();

                popped_cont.$sup.css('margin-left', popped_cont.pop_stuff.margin_left_down);
                popped_cont.$sup.addClass('pop-up-block');

                var offset_top_2 = popped_cont.$sup.offset().top;
                var scroll_top_2 = scroll_top_1 + offset_top_2 - offset_top_1;

                $(window).scrollTop(scroll_top_2);
            } else {
                popped_cont.pop_stuff.margin_left_down = 0;
                margin_left_up = sup_left_want - sup_left_is;
            }
            promises.push(that.$sup.animate({
                'margin-left': margin_left_up
            }, {
                duration: POP_UP_ANIMATE_MS,
                easing: POP_UP_ANIMATE_EASING,
                queue: false
            }));

            var scroll_top_for_popped_up = popped_cont.$sup.offset().top - sup_top_want;
            console.debug("Scroll to", scroll_top_for_popped_up, sup_top_want);
            promises.push($('html, body').animate({
                scrollTop: scroll_top_for_popped_up
            }, {
                duration: POP_UP_ANIMATE_MS,
                easing: POP_UP_ANIMATE_EASING,
                queue: false
            }));
            // THANKS:  Animating scrollTop, https://stackoverflow.com/a/8047537/673991
            //          Weird, $('html') is all that works in chrome,
            //          not $(window)
            //          nor $(window.document)   <-- jquery errors and freaky effects
            //          nor $(window.document.body)

            // console.debug("Font", font_size_normal, "to", font_size_setting, expandable_h, expandable_v, expandable);
            promises.push(that.$cont.animate({
                width: pop_cont_css_width,
                height: pop_cont_css_height,
                'font-size': font_size_setting
            }, {
                duration: POP_UP_ANIMATE_MS,
                easing: POP_UP_ANIMATE_EASING,
                queue: false,
                complete: function popup_text_contribution_complete() {
                    that.$cont.width(cont_width_setting);   // because animate chokes on 'auto'
                    that.$cont.height(cont_height_setting);
                }
            }).promise());

            promises.push(that.$caption_bar.animate({
                width: pop_caption_css_width,
            }, {
                duration: POP_UP_ANIMATE_MS,
                easing: POP_UP_ANIMATE_EASING,
                queue: false,
                complete: function popup_text_caption_complete() {
                    that.fix_caption_width();
                }
            }).promise());

            promises.push(pop_screen_up_fade_in().promise());

            var combined_promise = $.when.apply($, promises);
            // var combined_promise = $.when(
            //     sup_promise,
            //     cont_promise,
            //     caption_promise,
            //     screen_promise
            // );
            combined_promise.done(function popup_animation_done() {
                then();
            });
        }
        save_alarm(is_bad) {
            var that = this;
            var $save_button = that.$save_bar.find('.save');
            $save_button.toggleClass('failed-post', is_bad);
            var title_text = is_bad ? "Failed to save. Try again?" : null;
            $save_button.attr('title', title_text);
        }

        pop_up(auto_play) {
            var that = this;

            // var cont_idn = that.id_attribute;
            // var popup_id_attribute = MONTY.POPUP_ID_PREFIX + cont_idn;
            // var popup_cont_selector = selector_from_id(popup_id_attribute);
            // var was_already_popped_up = $(popup_cont_selector).length > 0;
            var was_already_popped_up = that === popped_cont;

            pop_down_all(false);

            if (was_already_popped_up) {
                console.error("Contribution", that.idn, "is popping itself down by 2nd click.");
                // NOTE:  Avoid double-pop-up.  Just pop down, don't pop-up again.
                //        This may no longer be possible, with the popup-screen,
                //        and the save-bar buttons all disabled on the popup.
                return null;
            }

            // var thumb_fixed_coordinates = that.css_for_position_fixed();

            set_popped_cont(that);

            // popup_cont.id_prefix = MONTY.POPUP_ID_PREFIX;
            // popup_cont.cat = that.cat;
            // popup_cont.capt = that.capt;
            // popup_cont.build_dom(that.content);

            // NOTE:  This Contribution object never passes through render_some_conts(), so no
            //        mutation or resize observations take place.
            //        That only happens for contribution objects in contribution_lexi.

            popped_cont.$sup.find('.grip').addClass('inoperative');
            // NOTE:  No dragging popped-up stuff.
            //        It was a little disconcerting not seeing the grip symbol there.
            //        So just disabling the feature and dimming the icon
            //        seemed the lesser UX crime.


            // popup_cont.$sup.data('popped-down', that.$sup);

            // var $popup_screen = $('<div>', { id: 'popup-screen' });
            // $popup_screen.append(popup_cont.$sup);
            // if (that.is_dom_rendered()) {
            //     that.$sup.before($popup_screen);
            //     that.$sup.addClass('pop-down');
            //     // NOTE:  Zoom up from thumbnail.
            // } else {
            //     that.cat.$unrendered.before($popup_screen);
            //     // NOTE:  Zoom up from the .unrendered section
            // }

            // popup_cont.$sup.css(thumb_fixed_coordinates);
            // popup_cont.$sup.css({
            //     position: 'fixed',
            //     'z-index': 1
            // });
            // NOTE:  Start the popup right where the original thumbnail was on the screen, but with
            //        fixed coordinates.

            // popup_cont.rebuild_bars(function popup_clone_rendered() {

                // NOTE:  Now the contribution to be popped up is cloned and thumbnail size.

            
            

            var caption_height_px = popped_cont.$caption_bar.outerHeight();
            // NOTE:  Wrapped thumbnail captions may result in less tall popups,
            //        because popped-up captions don't need to be wrapped.

            var vertical_padding_in_css = px_from_rem(0.3 + 0.3);

            var max_live_height = Math.round(
                usable_height()
                - caption_height_px
                - vertical_padding_in_css
                - 30
            );
            // NOTE:  Extra 30-pixel reduction in height.
            //        Tends to prevent scrollbars from spontaneously appearing.
            //        Someday a less crude way would be good.

            // popup_cont.$sup.data('pop-stuff',
            popped_cont.pop_stuff = {
                thumb_render_width: popped_cont.$render_bar.width(),
                thumb_render_height: popped_cont.$render_bar.height(),
                cont_css_width: popped_cont.$cont.css('width'),
                cont_css_height: popped_cont.$cont.css('height'),
                caption_css_width: popped_cont.$caption_bar.css('width'),
                caption_css_height: popped_cont.$caption_bar.css('height'),
                max_live_width: that.cat.usable_width(),
                max_live_height: max_live_height,
                window_scroll_top: $(window).scrollTop()
            };

            popped_cont.$sup.addClass('pop-up');

            if (popped_cont.is_media) {

                deanimate("popping up media", popped_cont.id_attribute);

                var img_src = popped_cont.$img_thumb.attr('src');
                // NOTE:  popup_cont.$img_thumb is ajax-loaded, use that.$img_thumb instead.
                if (is_defined(img_src)) {
                    popped_cont.$render_bar.css({
                        'background-image': 'url(' + img_src + ')',
                        'background-position': 'center center',
                        'background-size': 'cover'
                    });
                    // NOTE:  This makes the thumbnail resemble the unplayed youtube video,
                    //        while it's expanding to pop-up size,
                    //        albeit with lower resolution,
                    //        at least today it seems to.
                    // THANKS:  Scale background to cover element, without distorting aspect ratio,
                    //          https://stackoverflow.com/a/7372377/673991

                    // TODO:  Visually this mostly sucks.  Any way to do better?
                }
                popped_cont.pop_stuff['headroom_popped_down'] = (
                    popped_cont.$sup.offset().top - $(window).scrollTop()
                );
                popped_cont.live_media_iframe({
                    id_attribute: popped_cont.id_attribute,   // idn is a misnomer, it may include popup_prefix
                    url: popped_cont.media_url,
                    is_pop_up: true,
                    auto_play: String(auto_play),
                    width:  popped_cont.pop_stuff.max_live_width - popped_cont.chrome_width(),
                    height: max_live_height,
                    duration: POP_UP_ANIMATE_MS,
                    easing: POP_UP_ANIMATE_EASING
                }, function media_iframe_loaded() {
                    // NOTE:  This is what makes it live media (e.g. a video) in the pop-up.
                    //        When oembed doesn't provide a thumbnail (e.g. dropbox) this may
                    //        load the iframe twice.

                    popped_cont.$render_bar.width('');
                    // NOTE:  Undo render-bar width-setting from render_error();

                    popped_cont.$render_bar.css({
                        'background-image': '',
                        'background-position': '',
                        'background-size': ''
                    });
                    // NOTE:  This removes unsightly background echo for some vimeo and flickr embeds.
                    // THANKS:  Remove CSS style, https://stackoverflow.com/a/4036868/673991



                    // if (popup_cont.is_noembed_error) {
                    //     // NOTE:  This error may come from an embed_content.js iframe, as opposed to
                    //     //        media_noembed.js render_error().  So it may be worded different
                    //     //        and have different dimensions.
                    //
                    //     // TODO:  How to animate errors that come in later, e.g. 401 Unauthorized?
                    //
                    //     popup_cont.$sup.animate({
                    //         top: TOP_SPACER_PX,
                    //         left: 0
                    //     }, {
                    //         duration: POP_UP_ANIMATE_MS,
                    //         easing: POP_UP_ANIMATE_EASING,
                    //         queue: false
                    //     });
                    //
                    //     // NOTE:  We can't rely on an iframe and its resizing to animate this popup,
                    //     //        we'll do it ourselves here, but half-assed.  Just move the error
                    //     //        message to the upper left corner, under the bot buttons.
                    // }
                });

                popped_cont.$iframe.width(popped_cont.pop_stuff.thumb_render_width);
                popped_cont.$iframe.height(popped_cont.pop_stuff.thumb_render_height);
                // NOTE:  Early in the popup, as soon as the iframe is in the DOM,
                //        until embed_content.js gets up and sets the size of the iframe through
                //        the iFrameResizer, let it start off as the same size as the thumbnail.

                pop_screen_up_fade_in();
                console.debug("Fading in.....................");

                if ( ! popped_cont.is_noembed_error) {
                    popped_cont.resizer_init(function pop_media_init() {

                        // NOTE:  Harmless warning:
                        //        [iFrameSizer][Host page: iframe_popup_1990] Ignored iFrame, already setup.
                        //        because the popup is CLONED from a contribution that already
                        //        initialized its iFrameResizer.  Apparently it still needs to be
                        //        initialized but it thinks it doesn't.

                        popped_cont.$sup.trigger(popped_cont.Event.MEDIA_INIT);
                        // NOTE:  Finally decided the best way to make the popup iframe big
                        //        was to focus on the inner CONTENTS size,
                        //        and let iFrameResizer handle the outer size.
                        // SEE:  Tricky iframe height 100%, https://stackoverflow.com/a/5871861/673991

                        popped_cont.resizer_nudge();
                        popped_cont.zero_iframe_recover();
                        // NOTE:  A little extra help for pop-ups
                        //        with either a zero-iframe bug in iFrameResizer,
                        //        or a poor internet connection.

                    });
                }
            } else {
                popped_cont.full_ish_screen_text(function () {
                    if (auto_play) {
                        popped_cont.play_quote_synthesis();
                        return;

                        // noinspection UnreachableCodeJS
                        popped_cont.play_quote_talkify(auto_play);
                    }
                });
            }
                
                
                
            // });
            console.log(
                "Popup",
                popped_cont.id_attribute,
                popped_cont.media_domain || "(quote)",
                "-",
                popped_cont.caption_text
            );
        }

    }

    ContributionWord.prototype.Event = {
        SPEECH_PLAY: 'SPEECH_PLAY',     // speechSynthesis.speak() was just called
        SPEECH_START: 'SPEECH_START',   // SpeechSynthesisUtterance 'start' event
        SPEECH_END: 'SPEECH_END',       // SpeechSynthesisUtterance 'end' event
        MEDIA_INIT: 'MEDIA_INIT',       // e.g. youtube started playing
        MEDIA_ERROR: 'MEDIA_ERROR',     // e.g. noembed error
        MEDIA_BEGUN: 'MEDIA_BEGUN',     // e.g. youtube auto-play started
        MEDIA_WOKE: 'MEDIA_WOKE',       // e.g. youtube auto-play first state-change TODO:  Use or lose?
        MEDIA_PAUSED: 'MEDIA_PAUSED',   // e.g. youtube auto-play paused
        MEDIA_ENDED: 'MEDIA_ENDED',     // e.g. youtube auto-play played to the end
        MEDIA_STATIC: 'MEDIA_STATIC'    // e.g. flickr, not going to play, timed display
    };

    function pop_speech_synthesis_init() {
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
    }




    // /**
    //  * //// CategoriesUnslump //// - collection of all categories for unslumping.org
    //  *
    //  * @return {CategoriesUnslump}
    //  * @constructor
    //  */
    // function CategoriesUnslump() {
    //     var that = this;
    //     type_should_be(that, CategoriesUnslump);
    //     CategoryLexi.call(that, Category);
    //
    //     // that.define_some_IDNS({
    //     //     LEX: MONTY.IDN.LEX,
    //     //     DEFINE: MONTY.IDN.DEFINE,
    //     //     CATEGORY: MONTY.IDN.CATEGORY
    //     // });
    //     // that.IDN.LEX      = MONTY.IDN.LEX;
    //     // that.IDN.DEFINE   = MONTY.IDN.DEFINE;
    //     // that.IDN.CATEGORY = MONTY.IDN.CATEGORY;
    //
    //     // that.notify = console.log.bind(console);
    //     //
    //     // // NOTE:  Setting our .notify() function should come BEFORE our CategoryLexi.word_pass() calls
    //     //
    //     // looper(MONTY.cat_words, function (index, cat_word) {
    //     //     that.word_pass(cat_word);
    //     //     // NOTE:  So for unslumping.js, MONTY.cat_words[] defines the order of categories
    //     //     //        on the screen.
    //     // });
    //     //
    //     // // NOTE:  Setting the fence_post_right values for the cont_sequence in each Category
    //     // //        instance, must come AFTER the above CategoryLexi.word_pass() calls,
    //     // //        which populate this collection of categories.
    //     // //        And it has to come BEFORE all the ContributionLexi.word_pass() calls
    //     // //        because they will need to know the fence_post_right values.
    //     //
    //     // that.loop(function (_, cat) {
    //     //     cat.cont_sequence.fence_post_right = MONTY.IDN.FENCE_POST_RIGHT;
    //     //     // TODO:  Move this to application-specific Category subclass,
    //     //     //        if we ever think of a name for it that doesn't confuse.
    //     // });
    // }
    // CategoriesUnslump.prototype = Object.create(CategoryLexi.prototype);
    // CategoriesUnslump.prototype.constructor = CategoriesUnslump;

    // CategoriesUnslump.prototype.is_me = function CategoriesUnslump_is_me(idn) {
    //     return is_equal_idn(idn, MONTY.me_idn);
    //     // NOTE:  Possibly the only place the Categories Lexi needs to know the user's idn.
    // }

    // var IDN_UNDEFINED = {IDN_UNDEFINED: 'IDN_UNDEFINED'};
    // var IDN_UNDEFINED = ['IDN_UNDEFINED'];

    // /**
    //  * //// ContributionsUnslump //// - collection of all contributions for unslumping.org
    //  *
    //  * This is ALL contributions, in definition order, not caring about their categories yet.
    //  *
    //  * @return {ContributionsUnslump}
    //  * @constructor
    //  */
    // function ContributionsUnslump(category_lexi) {
    //     var that = this;
    //     type_should_be(that, ContributionsUnslump);
    //     // that.idn_of = {   // mapping name ==> idn for lex-defined words
    //     //     lex: IDN_UNDEFINED,
    //     //     define: IDN_UNDEFINED,
    //     //     name: IDN_UNDEFINED,
    //     //     admin: IDN_UNDEFINED,
    //     //     google_user: IDN_UNDEFINED,
    //     //     anonymous: IDN_UNDEFINED,
    //     //
    //     //     category: IDN_UNDEFINED,
    //     //     locus: IDN_UNDEFINED,
    //     //     contribute: IDN_UNDEFINED,
    //     //     caption: IDN_UNDEFINED,
    //     //     edit: IDN_UNDEFINED,
    //     //     rearrange: IDN_UNDEFINED,
    //     //     rightmost: IDN_UNDEFINED,
    //     //     interact: IDN_UNDEFINED,
    //     //
    //     //     ip_address: IDN_UNDEFINED,
    //     //     user_agent: IDN_UNDEFINED,
    //     //
    //     //     browse: IDN_UNDEFINED
    //     //
    //     //     // NOTE:  The interact verbs are not here.
    //     //     //        They are not defined until and unless they're used.
    //     //     //        And we allow new ones to come and go without complaint.
    //     // };
    //     // that.by_idn = {};   // mapping idn ==> jsonl-word (with named objs) for lex-defined words
    //     // that._word_from_idn   mapping idn ==> javascript-word for user-defined words
    //     ContributionLexi.call(that, Contribution, category_lexi);
    //     // TODO:  Subclass Contribution too, don't just add to it.
    //     //        (Here we are subclassing the generic base class ContributionLexi,
    //     //        by defining the more specific derived class ContributionUnslump.
    //     //        But we never subclass Contribution.)
    //     //
    //
    //     // that.define_some_IDNS({
    //     //     CONTRIBUTE: MONTY.IDN.CONTRIBUTE,
    //     //     CAPTION: MONTY.IDN.CAPTION,
    //     //     EDIT: MONTY.IDN.EDIT
    //     //     // me: MONTY.me_idn
    //     //     // me: me_idn_lineage   // oops, too early, put off until load_nits ... init().
    //     // });
    //
    //
    //     that.notify = function (message) {
    //         if (console_verbose) {
    //             console.log(message);
    //         }
    //         that.last_notify_message = message;
    //     };   // should come before words are processed
    //     // EXAMPLE:
    //     //     1918. Yes Bob Stein may caption 1917, work of Bob Stein
    //     //     1919. Nope Horatio won't edit 956, work of Bob Stein
    //     //     1920. (Can't caption 1919)
    //     //     1921. Nope Horatio won't drag to 1871 in their, 1849, work of Horatio
    //     //          ...because only admin can recategorize like this.
    //
    //     //
    //     // looper(MONTY.w, function (_, word) {
    //     //     that.word_pass(word);
    //     // });
    //     //
    //     // that.assert_consistent();   // more interesting after .word_pass() calls
    //     // // NOTE:  Early consistency check makes sure the .word_pass(MONTY.w) worked well.
    //     // //        It requires a special provision in .assert_consistent() because nothing is
    //     // //        rendered yet, and there are no .unrendered sections to count the not-rendered.
    //     //
    //     // console.log("contribution_lexi", that);
    //
    //
    //
    //     // that.user_lexi = new UserLexi(User);
    //     // that.lex = null;
    // }
    // ContributionsUnslump.prototype = Object.create(ContributionLexi.prototype);
    // ContributionsUnslump.prototype.constructor = ContributionsUnslump;
    //
    // /**
    //  * What's the category where this contribution word started out (for CURRENT user)?
    //  *
    //  * That is, before it could have been dragged to a different category.
    //  *
    //  * @param word
    //  * @return {Category}
    //  */
    // ContributionsUnslump.prototype.starting_cat = function ContributionsUnslump_starting_cat(word) {
    //     var that = this;
    //     console.assert(
    //         (
    //             is_specified(that.category_lexi.by_name.my) &&
    //             is_specified(that.category_lexi.by_name.anon) &&
    //             is_specified(that.category_lexi.by_name.their)
    //         ),
    //         "Categories not defined yet:",
    //         that.category_lexi.by_name,
    //         "\n" + "idns defined:",
    //         lex.idn_of
    //     );
    //     if (that.is_me(word.sbj)) {
    //         return that.category_lexi.by_name.my;
    //     } else if ( ! that.is_user_authenticated(word.sbj)) {
    //         return that.category_lexi.by_name.anon;
    //     } else {
    //         return that.category_lexi.by_name.their;
    //     }
    // }
    //
    // ContributionsUnslump.prototype.is_user_authenticated = function ContributionsUnslump_is_user_authenticated(user_idn) {
    //     return lex.is_authenticated(user_idn);
    //     // var that = this;
    //     // // if (that.user_lexi.has(user_idn)) {
    //     // if (has(that.lex.from_user, user_idn)) {
    //     //     // var user_word = that.user_lexi.get(user_idn);
    //     //     var user_word = that.lex.from_user[user_idn];
    //     //     return user_word.is_authenticated === true;
    //     //     // NOTE:  defaults to unauthenticated if somehow
    //     //     //        user_word.is_authenticated is undefined.
    //     // } else {
    //     //     console.warn("Assumed unauthenticated", user_idn);
    //     //     return false;
    //     // }
    // }

    // /**
    //  * Return a user word for this idn.  Instantiate a User object in the user_lexi if necessary.
    //  *
    //  * All additions to user_lexi go here.  And everything returned here is stored in the user_lexi.
    //  * This is a Contribution Lexi method, because only ContributionUnslump can tell the difference
    //  * between a google_user and anonymous.
    //  * TODO:  Maybe push that knowledge down into UserLexi somehow?
    //  */
    // ContributionsUnslump.prototype.user_factory = function ContributionsUnslump_user_factory(user_idn) {
    //     var that = this;
    //     type_should_be(user_idn, Array);
    //     // type_should_be(user_idn, String);
    //
    //     var user_object = that.user_lexi.add_if_new(user_idn);
    //     var user_type = extract_user_type(user_idn);
    //     if (is_equal_idn(user_type, that.idn_of.google_user)) {
    //         user_object.is_authenticated = true;
    //         // user_object.is_anonymous = false;
    //     } else if (is_equal_idn(user_type, that.idn_of.anonymous)) {
    //         user_object.is_authenticated = false;
    //         // user_object.is_anonymous = true;
    //     } else {
    //         user_object.is_authenticated = false;
    //         // user_object.is_anonymous = false;   // safe default?
    //         console.error(
    //             "User idn malformed",
    //             user_idn,
    //             that.idn
    //         );
    //     }
    //     return user_object;
    // };

    function extract_user_type(user_idn) {
        var parts = String(user_idn).split(',');
        console.assert(parts.length === 2, "Malformed user idn", user_idn);
        return parseInt(parts[0]);
    }
    console.assert(167 === extract_user_type([167,103620384189003120000]));
    console.assert(167 === extract_user_type([167,"103620384189003120000"]));
    console.assert(167 === extract_user_type('167,103620384189003122864'));

    /**
     * Is this action-word only for the sake of a user's own viewing?
     *
     * In other words, ignore the action if a not-me user did it,
     * even if they're the owner or administrator did it.
     *
     * So we tolerate someone else moving their content to trash,
     * or about (only admin can move to about anyway).
     * But we don't let anyone move to our my,their,anon categories.
     *
     * @param word
     */
    // ContributionsUnslump.prototype.is_word_guardrailed = function ContributionsUnslump_is_word_guardrailed(word) {
    //     // var that = this;
    //     var guardrailed_categories = [
    //         categories.by_name.my.idn,
    //         categories.by_name.their.idn,
    //         categories.by_name.anon.idn
    //     ];
    //     return word.vrb === lex.idn_of.rearrange && has(guardrailed_categories, word.obj.category);
    // }
    //
    // // FALSE WARNING:  Unused definition user_name_short
    // //                 It's used in contribution.js for notifications.
    // //                 But I guess PyCharm is not smart enough to recognized a base-class method
    // //                 calling an overridden derived-class method.
    // // noinspection JSUnusedGlobalSymbols
    // ContributionsUnslump.prototype.user_name_short = function ContributionsUnslump_user_name_short(user_idn) {
    //     // var that = this;
    //     if (is_defined(user_idn)) {
    //         // var user_word = that.user_lexi.get(user_idn, UNKNOWN_USER);
    //         var user_word = lex.from_user[user_idn];
    //         if (
    //             is_specified(user_word) &&
    //             is_specified(user_word.name) &&
    //             user_word.name !== ''
    //         ) {
    //             if (user_word.name.length > 20) {
    //                 return user_word.name.substring(0,15) + "...";
    //             } else {
    //                 return user_word.name;
    //             }
    //         } else {
    //             return "#" + String(user_idn);
    //         }
    //     } else {
    //         return "(unowned)";
    //     }
    // };
    //
    // ContributionsUnslump.prototype.is_me = function ContributionsUnslump_is_me(idn) {
    //     // return this.category_lexi.is_me(idn);
    //     return qiki.Lex.is_equal_idn(idn, MONTY.me_idn);
    // }
    //
    // ContributionsUnslump.prototype.am_i_admin = function ContributionsUnslump_am_i_admin() {
    //     // var that = this;
    //     // return that.me_user_word().is_admin;
    //     return lex.is_admin(MONTY.me_idn);
    // };
    //
    // ContributionsUnslump.prototype.am_i_anonymous = function ContributionsUnslump_am_i_anonymous() {
    //     var that = this;
    //     return that.me_user_word().is_anonymous;
    // };

    // ContributionsUnslump.prototype.am_i_authenticated = function ContributionsUnslump_am_i_authenticated() {
    //     // var that = this;
    //     // return that.me_user_word().is_authenticated;
    //     return lex.is_authenticated(MONTY.me_idn);
    // };
    //
    // // var UNKNOWN_USER = new User([-1,-1]);
    // // UNKNOWN_USER.name = "((no such user))";
    // //
    // // ContributionsUnslump.prototype.me_user_word = function ContributionsUnslump_me_user() {
    // //     var that = this;
    // //     // return that.user_lexi.get(MONTY.me_idn, UNKNOWN_USER);
    // //     return that.lex.from_user[MONTY.me_idn] || {};
    // //     // TODO:  Refactor this method's godlike knitting together of the User Lexi, the
    // //     //        Contribution Lexi, the MONTY, and a static User class.
    // //     //        This functional sprawl is a global embarrassment.
    // // };
    //
    // /**
    //  * Title for the "my" category.
    //  */
    // ContributionsUnslump.prototype.me_title = function ContributionsUnslump_me_user() {
    //     // var that = this;
    //     // return that.me_user_word().possessive() + " " + MONTY.WHAT_IS_THIS_THING;
    //     return lex.possessive(MONTY.me_idn) + " " + MONTY.WHAT_IS_THIS_THING;
    // };
    //
    // ContributionsUnslump.prototype.is_user_admin = function ContributionsUnslump_is_user_admin(user_idn) {
    //     // var that = this;
    //
    //     // var user = that.user_lexi.get(user_idn);
    //     var user = lex.from_user[user_idn];
    //     if (is_specified(user)) {
    //         return user.is_admin;
    //     } else {
    //         return false;
    //     }
    //     // if (has(MONTY.u, user_idn)) {
    //     //     return MONTY.u[user_idn].is_admin;
    //     // } else {
    //     //     return false;
    //     // }
    // };

    // /**
    //  * Decode a word's JSON into its idn,whn,sbj,vrb parts.  And its unnamed obj_values.
    //  *
    //  * Returns an associative array with unresolved obj values.
    //  * Or false if there was a problem (which will have an error on the console).
    //  */
    // // TODO:  JavaScript Word Class instead of associative array
    // function word_decode (word_json) {
    //     try {
    //         var word_array = JSON.parse(word_json);
    //     } catch (e) {
    //         console.error("JSONL error", e);
    //         console.debug("    " + word_json);
    //         return false;
    //     }
    //     if ( ! is_a(word_array, Array)) {
    //         console.error("Word JSON should be an array", word_array);
    //         console.debug("    " + word_json);
    //         return false;
    //     }
    //     if (word_array.length < 4) {
    //         console.error("Word has too few nits", word_array);
    //         return false;
    //     }
    //     var word_associative_array_unresolved = {
    //         idn: word_array[0],
    //         whn: word_array[1],
    //         sbj: word_array[2],
    //         vrb: word_array[3],
    //         obj_values: word_array.slice(4)   // to be resolved into named .obj properties later
    //     };
    //     // TODO:  JavaScript Word Class instead of associative array
    //     return word_associative_array_unresolved;
    // }

    // /**
    //  * Convert user word's obj_values into named obj properties.  Not specific to Contribution app.
    //  */
    // ContributionsUnslump.prototype.word_resolve = function (w) {
    //     var that = this;
    //     var vrb_word = that.by_idn[w.vrb];
    //     if (
    //         is_specified(vrb_word) &&
    //         is_specified(vrb_word.obj) &&
    //         is_specified(vrb_word.obj.fields)
    //     ) {
    //         // NOTE:  Can only be called inside a response_pass(), in the 3rd pass.
    //         //        Because define_word fields are set by definition_resolve() in the 2nd pass.
    //         //        Also the .by_idn[] associative array is set there too.
    //         //        So in passes 1 and 2, the w.obj_values array doesn't get converted to named
    //         //        w.obj properties.
    //         //        This inconvenience accommodates forward references.
    //         //        Some definitions come after they are referenced.
    //         if (w.obj_values.length !== vrb_word.obj.fields.length) {
    //             console.error(
    //                 w.idn.toString() + ".",
    //                 "Field mismatch, verb", vrb_word.obj.name,
    //                 "calls for", vrb_word.obj.fields,
    //                 "but word", w.idn,
    //                 "has", w.obj_values
    //             );
    //         } else {
    //             w.obj = {};
    //             looper(w.obj_values, function (index, field_value) {
    //                 var field_idn = vrb_word.obj.fields[index];
    //                 var field_word = that.by_idn[field_idn];
    //                 if (is_specified(field_word)) {
    //                     var field_name = field_word.obj.name;
    //                     w.obj[field_name] = field_value;
    //                 } else {
    //                     console.error("Word", w.idn, "verb", vrb_word.obj.name, "field", field_idn, "not defined");
    //                 }
    //             });
    //             // console.debug(w.idn.toString() + ".", w);
    //             delete w.obj_values
    //         }
    //     } else {
    //         console.error("Cannot resolve word", w.idn, vrb_word, w);
    //     }
    // }
    //
    // /**
    //  * Pass consequences of a (resolved) word into the DOM.  Specific to Contribution application.
    //  */
    // ContributionsUnslump.prototype.word_handle = function (w) {
    //     var that = this;
    //     switch (w.vrb) {
    //     case that.idn_of.contribute:
    //         // var was_submitted_anonymous;
    //         // if (clex.user_lexi.has(w.sbj)) {
    //         //     user_word = clex.user_lexi.get(w.sbj);
    //         //     was_submitted_anonymous = (user_word.is_anonymous !== false);
    //         //     // NOTE:  it WAS submitted anonymous if somehow
    //         //     //        user_word.is_anonymous is undefined.
    //         // } else {
    //         //     console.warn("Assumed anonymous", w);
    //         //     was_submitted_anonymous = true;
    //         // }
    //
    //         // var user_word = clex.user_factory(w.sbj);
    //         // w.was_submitted_anonymous = clex.is_idn_anonymous(w.sbj);
    //         that.contribute_word(w);
    //         // clex.contribute_word({
    //         //     idn:w.idn,
    //         //     sbj:w.sbj,
    //         //     was_submitted_anonymous: clex.user_lexi.is_idn_anonymous(w.sbj),
    //         //     // was_submitted_anonymous: user_word.is_anonymous,
    //         //     txt:w.objs[0]
    //         // });
    //         break;
    //     case that.idn_of.edit:
    //         that.edit_word(w);
    //         // clex.edit_word({
    //         //     idn:w.idn,
    //         //     sbj:w.sbj,
    //         //     obj:w.objs[0],
    //         //     txt:w.objs[1]
    //         // })
    //         break;
    //     case that.idn_of.caption:
    //         that.caption_word(w);
    //         // clex.caption_word({
    //         //     idn:w.idn,
    //         //     sbj:w.sbj,
    //         //     obj:w.objs[0],
    //         //     txt:w.objs[1]
    //         // })
    //         break;
    //     case that.idn_of.rearrange:
    //         that.rearrange_word(w);
    //         // type_should_be(w.objs[0], Number);
    //         // type_should_be(w.objs[1], Number);
    //         // type_should_be(w.objs[2], Number);
    //         // clex.cat_ordering_word({
    //         //     idn:w.idn,
    //         //     sbj:w.sbj,
    //         //     obj:w.objs[0],   // w.contribute
    //         //     vrb:w.objs[1],   // w.category
    //         //     num:w.objs[2]    // w.locus
    //         // })
    //         break;
    //     case that.idn_of.browse:
    //         break;
    //     default:
    //         var vrb_idn = w.vrb;
    //         var vrb_word = that.by_idn[vrb_idn];
    //         var vrb_parent_idn = vrb_word.obj.parent
    //         if (vrb_parent_idn === that.idn_of.interact) {
    //             // TODO:  Someday do something with all the interacts the
    //             //        contribution has had.
    //         } else {
    //             console.log("Unrecognized user word", w, "-- a", vrb_word);
    //         }
    //
    //         // if (is_specified(vrb) && is_specified(vrb_parent)) {
    //         //     switch (vrb_parent.idn) {
    //         //     case clex.idn_of.category:
    //         //         clex.cat_ordering_word({
    //         //             idn:w.idn,
    //         //             sbj:w.sbj,
    //         //             vrb:w.vrb,
    //         //             obj:w.objs[0],
    //         //             num:w.objs[1]
    //         //         })
    //         //         break;
    //         //     case clex.idn_of.interact:
    //         //         break;
    //         //     default:
    //         //         console.error("Neglected", vrb_parent.idn, w, vrb, vrb_parent);
    //         //         break;
    //         //     }
    //         break;
    //     }
    // };

    // /**
    //  * Affirm that Categories and Contributions agree on who contains whom.
    //  */
    // ContributionsUnslump.prototype.assert_consistent = function ContributionsUnslump_assert_consistent() {
    //     var that = this;
    //
    //     // NOTE:  1. For each category, for each contribution within it...
    //     //           Each contribution should know what category it's in.
    //     categories.loop(function (idn_category, category) {
    //         category.cont_sequence.loop(function (index, idn_contribution) {
    //             var contribution = that.get(idn_contribution);
    //             console.assert(
    //                 idn_category === contribution.cat.idn,
    //                 "INCONSISTENT CATEGORY",
    //                 idn_category,
    //                 "thinks it has cont",
    //                 idn_contribution,
    //                 "- but that cont thinks it's in cat",
    //                 contribution.cat.idn
    //             );
    //         });
    //     });
    //
    //     // NOTE:  2. For each contribution...
    //     //           Unsuperseded contributions should be in their category's sequence.
    //     //           Superseded contributions should not.
    //     var num_current = 0;
    //     var num_superseded = 0;
    //     var num_with_sups = 0;
    //     that.loop(function (idn_contribution, contribution) {
    //         var does_cat_have_cont = contribution.cat.cont_sequence.has(idn_contribution);
    //         if (contribution.is_superseded) {  // Contribution is obsolete, some edit superseded it.
    //             num_superseded++;
    //             console.assert(
    //                 ! does_cat_have_cont,
    //                 "SUPERSEDED CONTRIBUTION",
    //                 idn_contribution,
    //                 "by",
    //                 contribution.superseded_by_idn,
    //                 "should not be among the",
    //                 contribution.cat.cont_sequence.len(),
    //                 "conts of cat",
    //                 contribution.cat.idn
    //             );
    //             console.assert(
    //                 ! is_defined(contribution.$sup),
    //                 "Superseded should not be rendered",
    //                 contribution.id_attribute,
    //                 contribution.$sup
    //             );
    //         } else {   // Contribution is current, no edit supersedes.
    //             num_current++;
    //             console.assert(
    //                 does_cat_have_cont,
    //                 "INCONSISTENT CONTRIBUTION",
    //                 idn_contribution,
    //                 "thinks it's in cat",
    //                 contribution.cat.idn,
    //                 "- but that cat has no record among its",
    //                 contribution.cat.cont_sequence.len(),
    //                 "conts"
    //             );
    //         }
    //         if (contribution.is_dom_rendered()) {
    //             num_with_sups++;
    //
    //             var caption_from_dom = contribution.$caption_span.text();
    //             var caption_from_object = contribution.caption_text;
    //             assert_equal(caption_from_dom, caption_from_object);
    //         }
    //     });
    //
    //     // NOTE:  3. Go through rendered contributions in each category.
    //     var num_rendered = 0;
    //     var num_unrendered = 0;
    //     var any_query_string_limitations = cont_array_from_query_string() !== null;
    //     categories.loop(function (idn_category, category) {
    //         var rendered_idn_strings = [];
    //         if ( ! is_defined(category.$cat)) {
    //             // silently ignore when categories have not .build_dom() yet.
    //         } else if (category.$cat.length === 0) {
    //             console.warn("Unrendered", category.txt);
    //         } else {
    //             category.$cat.find('.sup-contribution').each(function (_, sup) {
    //                 num_rendered++;
    //                 var $sup = $(sup);
    //                 var $cont = $sup.find('.contribution');
    //                 var rendered_idn_string = $cont.attr('id');
    //                 var rendered_idn = parseInt(rendered_idn_string);
    //                 rendered_idn_strings.push(rendered_idn_string);
    //                 var cont_by_data = $sup.data('contribution-object');
    //                 var cont_by_idn = Contribution.from_idn(rendered_idn);
    //                 var cont_by_element = Contribution.from_element($sup);
    //
    //                 assert_equal(cont_by_data, cont_by_idn) &&
    //                 assert_equal(cont_by_data, cont_by_element) &&
    //                 assert_equal(cont_by_data.idn_string, rendered_idn_string);
    //             });
    //             var num_current_this_category = category.cont_sequence.len();
    //             var num_unrendered_this_category = category.$unrendered.data('count');
    //             if (is_specified(num_unrendered_this_category)) {
    //                 // NOTE:  Prevent false alarms at the beginning, when contributions objects are
    //                 //        instantiated but not rendered yet.  And so the $unrendered count
    //                 //        has not been computed either.
    //
    //                 // NOTE:  What follows is a three-way comparison to make sure the sequence
    //                 //        of contributions in each category are in agreement.
    //                 //        1.sql - the words from LexMySQL, that built:  Category.cont_sequence
    //                 //        2.dom - the order of appearance of rendered contributions,
    //                 //                the rendered ones only
    //                 //        3.nit - the words from lex.js stored in lex.cats...conts
    //
    //                 num_unrendered += num_unrendered_this_category;
    //                 assert_equal(   // 1.sql vs 2.dom -- compare quantity
    //                     num_current_this_category,
    //                     rendered_idn_strings.length + num_unrendered_this_category,
    //                     "sql vs dom"
    //                 );
    //
    //                 var nit_conts = lex.cats.by_name[category.txt].conts;
    //                 var num_nits_this_category = nit_conts.num_words();
    //                 assert_equal(   // 1.sql vs 3.nit -- compare quantity
    //                     num_current_this_category,
    //                     num_nits_this_category,
    //                     "sql vs nits"
    //                 );
    //
    //                 var current_idns = category.cont_sequence.idn_array();
    //                 var idn_mismatch;
    //                 if (any_query_string_limitations) {
    //                     idn_mismatch = false;
    //                     // NOTE:  If there's a cont=NNNN in the query string, don't even bother
    //                     //        comparing rendered and current (cont_sequence) contribution idns.
    //                 } else {
    //                     idn_mismatch = false;
    //                     looper(rendered_idn_strings, function (index, rendered_idn_string) {
    //                         var current_idn = current_idns[index];
    //                         var current_idn_string = String(current_idn);
    //                         if (current_idn_string !== rendered_idn_string) {   // 1.sql vs 2.dom
    //                             idn_mismatch = true;
    //                         }
    //                     });
    //                 }
    //                 var plus_n_more;
    //                 if (num_unrendered_this_category === 0) {
    //                     plus_n_more = "";
    //                 } else {
    //                     plus_n_more = f(" + {n} more", {n: num_unrendered_this_category});
    //                 }
    //                 var current_idn_string = stringify_array(current_idns).join(" ");
    //                 var rendered_idn_string = rendered_idn_strings.join(" ") || "(none rendered)";
    //                 var nits_idn_string = nit_conts.idn_array().join(" ");
    //                 if (nits_idn_string !== current_idn_string) {   // 1.sql vs 3.nit
    //                     idn_mismatch = true;
    //                 }
    //                 var vars = {
    //                     cat: category.txt,
    //                     rendered_idns: rendered_idn_string,
    //                     plus_n_more: plus_n_more,
    //                     num_current: num_current_this_category,
    //                     current_idns: stringify_array(current_idns).join(" "),
    //                     nits_idns: nits_idn_string
    //                 };
    //                 if (idn_mismatch) {
    //                     console.error(f("RENDERING MISMATCH {cat}:\n" +
    //                         "    rendered: {rendered_idns}{plus_n_more} = {num_current}\n" +
    //                         "     current: {current_idns}\n" +
    //                         "        nits: {nits_idns}", vars));
    //                 } else {
    //                     console.log(f("Rendered {cat}: " +
    //                         "{rendered_idns}{plus_n_more} = {num_current}", vars));
    //                 }
    //             }
    //         }
    //     });
    //
    //     var any_rendered_at_all = num_rendered !== 0;
    //
    //     console.debug(f(
    //         "{num_passed} contributions = " +
    //         "{num_superseded} superseded + " +
    //         "{num_current} current" +
    //         (any_rendered_at_all ? " = {num_rendered} rendered + {num_unrendered} unrendered" : ""),
    //         {
    //             num_passed: num_superseded + num_current,
    //             num_superseded: num_superseded,
    //             num_current: num_current,
    //             num_rendered: num_rendered,
    //             num_unrendered: num_unrendered
    //
    //         }
    //     ));
    //
    //     assert_equal(num_rendered, num_with_sups);
    //     // NOTE:  The number of Contribution instances that think they're rendered,
    //     //        should match the number of DOM elements representing contributions.
    //
    //     if (any_rendered_at_all) {
    //         assert_equal(num_current, num_rendered + num_unrendered);
    //         // NOTE:  Forgive initial conditions before .unrendered sections are created.
    //     }
    // }
    // /**
    //  * Affirm that Categories and Contributions agree on who contains whom.
    //  */
    // ContributionsUnslump.prototype.assert_consistent = function ContributionsUnslump_assert_consistent() {
    //     var that = this;
    //
    //     // NOTE:  1. For each category, for each contribution within it...
    //     //           Each contribution should know what category it's in.
    //     categories.loop(function (idn_category, category) {
    //         category.cont_sequence.loop(function (index, idn_contribution) {
    //             var contribution = that.get(idn_contribution);
    //             console.assert(
    //                 idn_category === contribution.cat.idn,
    //                 "INCONSISTENT CATEGORY",
    //                 idn_category,
    //                 "thinks it has cont",
    //                 idn_contribution,
    //                 "- but that cont thinks it's in cat",
    //                 contribution.cat.idn
    //             );
    //         });
    //     });
    //
    //     // NOTE:  2. For each contribution...
    //     //           Unsuperseded contributions should be in their category's sequence.
    //     //           Superseded contributions should not.
    //     var num_current = 0;
    //     var num_superseded = 0;
    //     var num_with_sups = 0;
    //     that.loop(function (idn_contribution, contribution) {
    //         var does_cat_have_cont = contribution.cat.cont_sequence.has(idn_contribution);
    //         if (contribution.is_superseded) {  // Contribution is obsolete, some edit superseded it.
    //             num_superseded++;
    //             console.assert(
    //                 ! does_cat_have_cont,
    //                 "SUPERSEDED CONTRIBUTION",
    //                 idn_contribution,
    //                 "by",
    //                 contribution.superseded_by_idn,
    //                 "should not be among the",
    //                 contribution.cat.cont_sequence.len(),
    //                 "conts of cat",
    //                 contribution.cat.idn
    //             );
    //             console.assert(
    //                 ! is_defined(contribution.$sup),
    //                 "Superseded should not be rendered",
    //                 contribution.id_attribute,
    //                 contribution.$sup
    //             );
    //         } else {   // Contribution is current, no edit supersedes.
    //             num_current++;
    //             console.assert(
    //                 does_cat_have_cont,
    //                 "INCONSISTENT CONTRIBUTION",
    //                 idn_contribution,
    //                 "thinks it's in cat",
    //                 contribution.cat.idn,
    //                 "- but that cat has no record among its",
    //                 contribution.cat.cont_sequence.len(),
    //                 "conts"
    //             );
    //         }
    //         if (contribution.is_dom_rendered()) {
    //             num_with_sups++;
    //
    //             var caption_from_dom = contribution.$caption_span.text();
    //             var caption_from_object = contribution.caption_text;
    //             assert_equal(caption_from_dom, caption_from_object);
    //         }
    //     });
    //
    //     // NOTE:  3. Go through rendered contributions in each category.
    //     var num_rendered = 0;
    //     var num_unrendered = 0;
    //     var any_query_string_limitations = cont_array_from_query_string() !== null;
    //     categories.loop(function (idn_category, category) {
    //         var rendered_idn_strings = [];
    //         if ( ! is_defined(category.$cat)) {
    //             // silently ignore when categories have not .build_dom() yet.
    //         } else if (category.$cat.length === 0) {
    //             console.warn("Unrendered", category.txt);
    //         } else {
    //             category.$cat.find('.sup-contribution').each(function (_, sup) {
    //                 num_rendered++;
    //                 var $sup = $(sup);
    //                 var $cont = $sup.find('.contribution');
    //                 var rendered_idn_string = $cont.attr('id');
    //                 var rendered_idn = parseInt(rendered_idn_string);
    //                 rendered_idn_strings.push(rendered_idn_string);
    //                 var cont_by_data = $sup.data('contribution-object');
    //                 var cont_by_idn = Contribution.from_idn(rendered_idn);
    //                 var cont_by_element = Contribution.from_element($sup);
    //
    //                 assert_equal(cont_by_data, cont_by_idn) &&
    //                 assert_equal(cont_by_data, cont_by_element) &&
    //                 assert_equal(cont_by_data.idn_string, rendered_idn_string);
    //             });
    //             var num_current_this_category = category.cont_sequence.len();
    //             var num_unrendered_this_category = category.$unrendered.data('count');
    //             if (is_specified(num_unrendered_this_category)) {
    //                 // NOTE:  Prevent false alarms at the beginning, when contributions objects are
    //                 //        instantiated but not rendered yet.  And so the $unrendered count
    //                 //        has not been computed either.
    //
    //                 // NOTE:  What follows is a three-way comparison to make sure the sequence
    //                 //        of contributions in each category are in agreement.
    //                 //        1.sql - the words from LexMySQL, that built:  Category.cont_sequence
    //                 //        2.dom - the order of appearance of rendered contributions,
    //                 //                the rendered ones only
    //                 //        3.nit - the words from lex.js stored in lex.cats...conts
    //
    //                 num_unrendered += num_unrendered_this_category;
    //                 assert_equal(   // 1.sql vs 2.dom -- compare quantity
    //                     num_current_this_category,
    //                     rendered_idn_strings.length + num_unrendered_this_category,
    //                     "sql vs dom"
    //                 );
    //
    //                 var nit_conts = lex.cats.by_name[category.txt].conts;
    //                 var num_nits_this_category = nit_conts.num_words();
    //                 assert_equal(   // 1.sql vs 3.nit -- compare quantity
    //                     num_current_this_category,
    //                     num_nits_this_category,
    //                     "sql vs nits"
    //                 );
    //
    //                 var current_idns = category.cont_sequence.idn_array();
    //                 var idn_mismatch;
    //                 if (any_query_string_limitations) {
    //                     idn_mismatch = false;
    //                     // NOTE:  If there's a cont=NNNN in the query string, don't even bother
    //                     //        comparing rendered and current (cont_sequence) contribution idns.
    //                 } else {
    //                     idn_mismatch = false;
    //                     looper(rendered_idn_strings, function (index, rendered_idn_string) {
    //                         var current_idn = current_idns[index];
    //                         var current_idn_string = String(current_idn);
    //                         if (current_idn_string !== rendered_idn_string) {   // 1.sql vs 2.dom
    //                             idn_mismatch = true;
    //                         }
    //                     });
    //                 }
    //                 var plus_n_more;
    //                 if (num_unrendered_this_category === 0) {
    //                     plus_n_more = "";
    //                 } else {
    //                     plus_n_more = f(" + {n} more", {n: num_unrendered_this_category});
    //                 }
    //                 var current_idn_string = stringify_array(current_idns).join(" ");
    //                 var rendered_idn_string = rendered_idn_strings.join(" ") || "(none rendered)";
    //                 var nits_idn_string = nit_conts.idn_array().join(" ");
    //                 if (nits_idn_string !== current_idn_string) {   // 1.sql vs 3.nit
    //                     idn_mismatch = true;
    //                 }
    //                 var vars = {
    //                     cat: category.txt,
    //                     rendered_idns: rendered_idn_string,
    //                     plus_n_more: plus_n_more,
    //                     num_current: num_current_this_category,
    //                     current_idns: stringify_array(current_idns).join(" "),
    //                     nits_idns: nits_idn_string
    //                 };
    //                 if (idn_mismatch) {
    //                     console.error(f("RENDERING MISMATCH {cat}:\n" +
    //                         "    rendered: {rendered_idns}{plus_n_more} = {num_current}\n" +
    //                         "     current: {current_idns}\n" +
    //                         "        nits: {nits_idns}", vars));
    //                 } else {
    //                     console.log(f("Rendered {cat}: " +
    //                         "{rendered_idns}{plus_n_more} = {num_current}", vars));
    //                 }
    //             }
    //         }
    //     });
    //
    //     var any_rendered_at_all = num_rendered !== 0;
    //
    //     console.debug(f(
    //         "{num_passed} contributions = " +
    //         "{num_superseded} superseded + " +
    //         "{num_current} current" +
    //         (any_rendered_at_all ? " = {num_rendered} rendered + {num_unrendered} unrendered" : ""),
    //         {
    //             num_passed: num_superseded + num_current,
    //             num_superseded: num_superseded,
    //             num_current: num_current,
    //             num_rendered: num_rendered,
    //             num_unrendered: num_unrendered
    //
    //         }
    //     ));
    //
    //     assert_equal(num_rendered, num_with_sups);
    //     // NOTE:  The number of Contribution instances that think they're rendered,
    //     //        should match the number of DOM elements representing contributions.
    //
    //     if (any_rendered_at_all) {
    //         assert_equal(num_current, num_rendered + num_unrendered);
    //         // NOTE:  Forgive initial conditions before .unrendered sections are created.
    //     }
    // }

    // /**
    //  * //// Category - unslumping.org
    //  * @param element_or_selector
    //  * @return {null|Category}
    //  * @constructor - sorta - subclass should go here
    //  */
    // Category.from_element = function (element_or_selector) {
    //     var $sup = $(element_or_selector).closest('.sup-category');
    //     if ($sup.length === 1) {
    //         var cat = $sup.data('category-object');
    //         console.assert(cat.$sup.is($sup), cat.$sup, $sup, element_or_selector);
    //         return cat;   // which could be undefined
    //     } else {
    //         return null;
    //     }
    // }
    //
    // Category.from_idn = function Category_from_idn(idn) {
    //     type_should_be(idn, Number);
    //     return categories.get(idn);
    // }

    // Category.prototype.show_unrendered_count = function Category_show_unrendered_count() {
    //     var that = this;
    //     var total_conts = that.cont_sequence.len();
    //     var number_renderings = that.$cat.find('.contribution').length;
    //     var number_popup_conts = that.$cat.find('#popup-screen').find('.contribution').length;
    //     var number_thumbnail_renderings = number_renderings - number_popup_conts;
    //     var number_of_unrendered_conts = total_conts - number_thumbnail_renderings;
    //     that.$unrendered.text(f("{n} more", {n: number_of_unrendered_conts}));
    //     that.$unrendered.data('count', number_of_unrendered_conts);
    //     that.$unrendered.toggleClass('zero', number_of_unrendered_conts === 0);
    //     // TODO:  Title tool-tip should say, e.g.:
    //     //            Click to show 10 more.  Shift-click to show 100 more.
    //     //        Numbers should change depending on MORE_CAT_CONT.
    //     //        And also depending on how many contributions are ACTUALLY unrendered.
    //     //        And note that it's NOT clickable if the page is ?cont=NNNN limited.
    //     // TODO:  The shift key should change e.g. "234 more" to
    //     //        "234 more (shift-click to see 100 of them)"
    //     // TODO:  Show icons resembling how many more?  Numerous little squares.
    //     // TODO:  Think of other ways to visually represent the mental models user should have.
    // };

    // Category.prototype.render_some_conts = function Category_render_some_conts(n_show) {
    //     var that = this;
    //     var num_newly_rendered = 0;
    //     that.cont_sequence.loop(function (_, cont_idn) {
    //         var cont = Contribution.from_idn(cont_idn);
    //         console.assert( ! cont.is_superseded, "Superseded", cont, cont_idn);
    //         if (cont.is_dom_rendered()) {
    //             // NOTE:  Skip this already-rendered contribution.
    //             //        This happens when you click "20 more" and we're hunting for unrendered
    //             //        contributions, skipping first over those that are already rendered.
    //         } else if (does_query_string_allow(cont.idn)) {
    //
    //             cont.build_dom(cont.unrendered_content);
    //             cont.unrendered_content = null;
    //             // NOTE:  Conceivably save memory by MOVING the contribution text, instead of copying.
    //
    //             cont.rebuild_bars(function () {
    //                 if (is_defined(window.ResizeObserver)) {
    //                     // SEE:  ResizeObserver, https://caniuse.com/#feat=resizeobserver
    //
    //                     cont.resize_observer = new ResizeObserver(function resized_cont_handler() {
    //                         cont.fix_caption_width();
    //                     });
    //                     cont.resize_observer.observe(dom_from_$(cont.$cont));
    //                 }
    //             });
    //             if (that.$unrendered.length === 0) {
    //                 that.$cat.append(cont.$sup);
    //             } else {
    //                 that.$unrendered.before(cont.$sup);
    //             }
    //             console.assert(cont.is_dom_rendered(), "Should be freshly rendered", cont);
    //             num_newly_rendered++;
    //             if (num_newly_rendered >= n_show) {
    //                 return false;
    //             }
    //         } else {
    //             // NOTE:  This contribution was excluded by `cont` parameter in the query string.
    //         }
    //     });
    // };
    //
    // /**
    //  * Insert a contribution's DOM into the left end of a category's DOM.
    //  *
    //  * This doesn't touch the underlying objects, e.g. Category.cont_sequence, because
    //  * the caller should do that (soon before or soon after) with Category.word_pass().
    //  *
    //  * @param cont
    //  */
    // Category.prototype.insert_left = function(cont) {
    //     var that = this;
    //     var $container_entry = that.$cat.find('.container-entry');
    //     if ($container_entry.length > 0) {
    //         // Drop after contribution entry form (the one in 'my' category))
    //         $container_entry.last().after(cont.$sup);
    //     } else {
    //         // drop into any other category, whether empty or not
    //         that.$cat.prepend(cont.$sup);
    //     }
    // };

    // /**
    //  * //// Contribution - unslumping.org
    //  *
    //  * @param {number} idn
    //  * @return {Contribution}
    //  * @constructor - sorta - should subclass Contribution here
    //  */
    // Contribution.from_idn = function Contribution_from_idn(idn) {
    //     type_should_be(idn, Number);
    //     var contribution_instance = contribution_lexi.get(idn, null);
    //     console.assert(contribution_instance !== null, "No contribution with idn", idn);
    //     return contribution_instance;
    // }

    // /**
    //  * Return a Contribution instance given any element inside its DOM.
    //  *
    //  * @param element_or_selector - e.g. '#1821' or $('.pop-up')
    //  * @return {Contribution}
    //  */
    // // idn (always a decimal integer number
    // //        in JavaScript, akin to the qiki.Number idn of a qiki.Word in Python)
    // //        and an id_attribute (which may be an idn or a prefixed idn, e.g. 'popup_1821')
    // //        Maybe cont.$sup.data('idn') should store a reliable idn, and cont.$sup.attr('id')
    // //        should be prefixed.  Because hogging all the decimal integer ids for idns is priggish.
    // Contribution.from_element = function (element_or_selector) {
    //     var $sup = $(element_or_selector).closest('.sup-contribution');
    //     if ($sup.length === 1) {
    //         var cont = $sup.data('contribution-object');
    //         console.assert(cont.$sup.is($sup), "Contribution dom disassociated", cont.$sup, $sup, element_or_selector);
    //         return cont;   // which could be undefined
    //     } else {
    //         return null;
    //     }
    //     // var $cont = $sup.find('.contribution');
    //     // var idn_string = $cont.attr('id');
    //     // var idn = parseInt(idn_string);
    //     // return Contribution_from_idn(idn);
    // }

    // Object.defineProperties(Contribution.prototype, {
    //     /**
    //      * .id_attribute - unique id for this Contribution, the .contribution element, id attribute
    //      *
    //      * @type {string}
    //      *
    //      * THANKS:  JSDoc for get and set accessors, https://stackoverflow.com/a/22276207/673991
    //      *          Solves the overeager type warning:  Argument type {get: (function(): string)}
    //      *          is not assignable to parameter type string
    //      */
    //     id_attribute:     { get: function () {return this.id_prefix + this.idn_string;}},
    //
    //     id_prefix:        {
    //                            get: function () {return this._id_prefix || '';},
    //                            set: function (new_prefix) {return this._id_prefix = new_prefix;}
    //                       },
    //     idn_string:       { get: function () {return String(this.idn);}},
    //     $cont:            { get: function () {return this.$sup.find('.contribution');}},
    //     $render_bar:      { get: function () {return this.$sup.find('.render-bar');}},
    //     $save_bar:        { get: function () {return this.$sup.find('.save-bar');}},
    //     $caption_bar:     { get: function () {return this.$sup.find('.caption-bar');}},
    //     $caption_span:    { get: function () {return this.$sup.find('.caption-span');}},
    //     $external_link:   { get: function () {return this.$sup.find('.external-link');}},
    //     content:          { get: function () {
    //                           var that = this;
    //                           if (that.is_dom_rendered()) {
    //                               return that.$cont.text();
    //                               // TODO:  Are the EN_SPACE indentation characters a problem?
    //                               //        See Contribution.prototype.build_dom
    //                           } else {
    //                               return that.unrendered_content;   // TODO:  Make async
    //                           }
    //                       }},
    //     caption_text:     { get: function () {return is_specified(this.capt) ? this.capt.txt : ""}},
    //     is_media:         { get: function () {return could_be_url(this.content);}},
    //
    //     // is_noembed_error: { get: function () {return this.$sup.hasClass('noembed-error');}},
    //     // NOTE:  is_noembed_error is an ad hoc flag instead.
    //
    //     media_domain:     { get: function () {return sanitized_domain_from_url(this.media_url);}},
    //     $img_thumb:       { get: function () {return this.$render_bar.find('img.thumb');}},
    //     has_iframe:       { get: function () {return this.is_dom_rendered() && this.$iframe.length === 1;}},
    //     $iframe:          { get: function () {return this.$render_bar.find('iframe');}},
    //
    //     /**
    //      * .iframe - DOM object for the iframe, or null
    //      *
    //      * @return {{HTMLElement}|null} DOM object, or null if no iframe
    //      */
    //     // TODO:  This JSDoc header STILL doesn't obviate the need for a
    //     //        noinspection JSIncompatibleTypesComparison
    //     iframe:           { get: function () {return dom_from_$(this.$iframe) || null;}},
    //     $cat:             { get: function () {return this.$sup.closest('.category');}},
    //     // category_id:      { get: function () {return this.$cat.attr('id');}},
    //     // is_my_category:   { get: function () {return this.category_id === MONTY.IDN.CAT_MY.toString();}},
    //     // is_about_category:{ get: function () {return this.category_id === MONTY.IDN.CAT_ABOUT.toString();}},
    //     media_url:        { get: function () {return this.is_media ? this.content : null;}},
    //
    //     /**
    //      * .is_superseded - Should we hide this Contribution?  True if an edit supersedes it.
    //      */
    //     is_superseded:  { get: function () {return is_specified(this.superseded_by_idn);}}
    // });

    // Contribution.prototype.Event = {
    //     SPEECH_PLAY: 'SPEECH_PLAY',     // speechSynthesis.speak() was just called
    //     SPEECH_START: 'SPEECH_START',   // SpeechSynthesisUtterance 'start' event
    //     SPEECH_END: 'SPEECH_END',       // SpeechSynthesisUtterance 'end' event
    //     MEDIA_INIT: 'MEDIA_INIT',       // e.g. youtube started playing
    //     MEDIA_ERROR: 'MEDIA_ERROR',     // e.g. noembed error
    //     MEDIA_BEGUN: 'MEDIA_BEGUN',     // e.g. youtube auto-play started
    //     MEDIA_WOKE: 'MEDIA_WOKE',       // e.g. youtube auto-play first state-change TODO:  Use or lose?
    //     MEDIA_PAUSED: 'MEDIA_PAUSED',   // e.g. youtube auto-play paused
    //     // MEDIA_PLAYING: 'MEDIA_PLAYING', // e.g. youtube auto-play playing
    //     // MEDIA_RESUME: 'MEDIA_RESUME',   // e.g. youtube auto-play resume
    //     MEDIA_ENDED: 'MEDIA_ENDED',     // e.g. youtube auto-play played to the end
    //     MEDIA_STATIC: 'MEDIA_STATIC'    // e.g. flickr, not going to play, timed display
    // };
    // TODO:  Should Event be an Enumerate()?  If so we need to add .name a bunch of places, e.g.
    //            that.$sup.trigger(that.Event.MEDIA_BEGUN);
    //            that.$sup.trigger(that.Event.MEDIA_BEGUN.name);
    //            that.Event.MEDIA_BEGUN.trigger(data);   (oops `that` doesn't propagate to .trigger()'s `this`)
    //            that.trigger_event(that.Event.MEDIA_BEGUN, data);
    //        or
    //            that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_INIT, function (_, data) { ... } );
    //            that.pop_cont.$sup.on(that.pop_cont.Event.MEDIA_INIT.name, function (_, data) { ... } );
    //            that.pop_cont.Event.MEDIA_INIT.on(function (data) { ... } );   (oops)
    //            that.pop_cont.on_event(that.pop_cont.Event.MEDIA_INIT, function (data) { ... } );
    //            that.pop_cont.on_event(E.MEDIA_INIT, function (data) { ... } );
    //            that.on_event(E.MEDIA_INIT, function (data) { ... } );
    //            E(that.pop_cont.Event.MEDIA_INIT, function (data) { ... } );
    //            that.pop_cont.off_events();

    // Object.defineProperties(Category.prototype, {
    //     $unrendered: { get: function () {return this.$cat.find('.unrendered');}},
    //     $frou:       { get: function () {return this.$cat.find('.frou-category');}}
    // });

    // Contribution.prototype.on_event = function Contribution_on_event(event_name, handler_function) {
    //     var that = this;
    //     that.$sup.on(event_name, function (_, custom_object) {
    //         handler_function(custom_object);
    //     });
    // };
    //
    // Contribution.prototype.trigger_event = function Contribution_trigger_event(
    //     event_name,
    //     custom_object   // not an array, as in jQuery .trigger()
    // ) {
    //     var that = this;
    //     that.$sup.trigger(event_name, [custom_object]);
    // };
    //
    // /**
    //  * Destroy a Contribution object -- TODO:  Call this somewhere
    //  *
    //  * Not sure if we'd ever need to destroy a Contribution object, but if we do,
    //  * here go the issues to keep track of.
    //  */
    // // noinspection JSUnusedGlobalSymbols
    // Contribution.prototype.destructor = function Contribution_destructor() {
    //     // noinspection JSUnusedLocalSymbols
    //     var that = this;
    //     that.dom_removal();
    // };
    //
    // /**
    //  * Remove a contribution from the DOM.
    //  *
    //  * This happens when editing a contribution's text.  The edit-word becomes the basis for a new
    //  * contribution.  The old contribution word (or earlier edit word) is superseded.
    //  *
    //  * Not to be confused with unrendered content, which is only about the "20 more" clickable.
    //  */
    // Contribution.prototype.dom_removal = function Contribution_dom_removal() {
    //     var that = this;
    //     // if (is_defined(that.observer)) {
    //     //     that.observer.disconnect();
    //     //     delete that.observer;
    //     // }
    //     if (is_defined(that.resize_observer)) {
    //         that.resize_observer.disconnect();
    //         delete that.resize_observer;
    //     }
    //     if (is_defined(that.$sup)) {
    //         delete that.$sup;
    //     }
    // };
    //
    // Contribution.prototype.is_idn_specified = function Contribution_is_idn_specified() {
    //     var that = this;
    //     return is_specified(that.idn);
    // };
    //
    // /**
    //  * Do we have a DOM element rendering for this contribution?
    //  *
    //  * Make sure this is true before accessing any property that relies on the .$sup property.
    //  * This also arbitrates where the content is.
    //  *     if true:   that.$cont.text()
    //  *     if false:  that.unrendered_content
    //  *
    //  * @return {boolean}
    //  */
    // Contribution.prototype.is_dom_rendered = function Contribution_is_dom_rendered() {
    //     var that = this;
    //     return that.is_idn_specified() && is_specified(that.$sup) && that.$sup.length === 1;
    // };
    //
    // /**
    //  * Initialize the iFrameResizer on an iframe jQuery object.
    //  *
    //  * @param {function} on_init - callback after iFrameResizer was initialized.
    //  */
    // // NOTE:  Intermittent error made 2 of 3 youtube videos inoperative:
    // //        iframeResizer.min.js:8 Failed to execute 'postMessage' on 'DOMWindow':
    // //        The target origin provided ('...the proper domain...')
    // //        does not match the recipient window's origin ('null').
    // Contribution.prototype.resizer_init = function Contribution_resizer_init(on_init) {
    //     var that = this;
    //     type_should_be(on_init, Function);
    //     var is_an_iframe = that.$iframe.length === 1;
    //     // FALSE WARNING:  Unresolved variable iFrameResizer
    //     // noinspection JSUnresolvedVariable
    //     var was_iframe_initialized = typeof dom_from_$(that.$iframe).iFrameResizer === 'object';
    //
    //     if (!is_an_iframe) {
    //         console.error(
    //             "Missing iframe",
    //             that.id_attribute,
    //             is_an_iframe,
    //             was_iframe_initialized,
    //             that
    //         );
    //     } else if (was_iframe_initialized) {
    //         console.log("Already initialized iframe", that.id_attribute);
    //         on_init();
    //     } else {
    //         setTimeout(function () {
    //             // noinspection JSUnusedGlobalSymbols
    //             that.$iframe.iFrameResize({
    //                 log: false,
    //                 sizeWidth: true,
    //                 sizeHeight: true,
    //                 widthCalculationMethod: 'taggedElement',
    //                 onMessage: function (twofer) {
    //                     that.iframe_incoming(twofer);
    //                 },
    //                 onResized: function iframe_resized_itself(stuff) {
    //                     console.assert(stuff.iframe === that.iframe, stuff.iframe, that);
    //                     console.assert(
    //                         that.is_dom_rendered(),
    //                         stuff.iframe,
    //                         stuff.iframe.parentElement,
    //                         stuff.height, stuff.width, stuff.type
    //                     );
    //                     var siz_width = parseFloat(stuff.width);
    //                     var siz_height = parseFloat(stuff.height);
    //                     // var pop_stuff = that.$sup.data('pop-stuff');
    //                     if (
    //                         is_specified(popup_cont) &&
    //                         ! popup_cont.is_noembed_error &&
    //                         is_specified(popup_cont.pop_stuff)
    //                     ) {
    //
    //                         // NOTE:  Popup animation is a collaboration, parent with embed:
    //                         //        The embed is animating the size of the popup.
    //                         //        The parent will now adjust the position accordingly.
    //
    //                         var progress_width = linear_transform(
    //                             siz_width,
    //                             popup_cont.pop_stuff.thumb_render_width,
    //                             popup_cont.pop_stuff.max_live_width,
    //                             0.0,
    //                             1.0
    //                         )
    //                         // FALSE WARNING:  'thumb_render_height' should probably not be passed as
    //                         //                 parameter 'x1'
    //                         // noinspection JSSuspiciousNameCombination
    //                         var progress_height = linear_transform(
    //                             siz_height,
    //                             popup_cont.pop_stuff.thumb_render_height,
    //                             popup_cont.pop_stuff.max_live_height,
    //                             0.0,
    //                             1.0
    //                         )
    //                         var progress = Math.max(progress_width, progress_height);
    //                         // NOTE:  Rely on whichever is further along the way to a full screen.
    //
    //                         if (0.0 <= progress && progress <= 1.05) {
    //                             // NOTE:  Is size between thumbnail and popup?
    //                             // NOTE:  Limiting progress's range prevents e.g. a zero-size iframe
    //                             //        from moving to the "vanishing" point.
    //                             // NOTE:  A little forgiveness on the high end prevents a slightly
    //                             //        oversize popup from never getting top & left set, e.g.
    //                             //        a 401 error message.  Although that should now not be
    //                             //        oversized.  (Multiple fixes.)
    //
    //                             // NOTE:  Linear conversion, size to position.
    //                             // console.log(
    //                             //     "iframe resized",
    //                             //     that.id_attribute,
    //                             //     stuff.width,
    //                             //     stuff.height,
    //                             //     popup_cont.pop_stuff.thumb_render_width,
    //                             //     popup_cont.pop_stuff.thumb_render_height,
    //                             //     popup_cont.pop_stuff.max_live_width,
    //                             //     popup_cont.pop_stuff.max_live_height
    //                             // );
    //                             // EXAMPLE:  iframe resized popup_1990 168.53125 136 162 92 1583 1390
    //                             //           iframe resized popup_1990 216.90625 178 162 92 1583 1390
    //                             //           iframe resized popup_1990 265.296875 221 162 92 1583 1390
    //                             //           :
    //                             //           iframe resized popup_1990 1526.078125 1340 162 92 1583 1390
    //                             //           iframe resized popup_1990 1546 1357 162 92 1583 1390
    //                             //           iframe resized popup_1990 1583 1390 162 92 1583 1390
    //                             // NOTE:  It doesn't START at render dimensions,
    //                             //        but it does seem to END at max_live dimensions.
    //
    //                             var pop_left = 0;
    //                             var pop_top = TOP_SPACER_PX;
    //                             // FALSE WARNING:  'left' should probably not be passed as parameter 'y1'
    //                             // noinspection JSSuspiciousNameCombination
    //                             var sliding_left = linear_transform(
    //                                 progress,
    //                                 0.0, 1.0,
    //                                 popup_cont.pop_stuff.fixed_coordinates.left, pop_left
    //                             )
    //                             var sliding_top = linear_transform(
    //                                 progress,
    //                                 0.0, 1.0,
    //                                 popup_cont.pop_stuff.fixed_coordinates.top, pop_top
    //                             )
    //                             that.$sup.css({left: sliding_left, top: sliding_top});
    //
    //                             // NOTE:  Routine collaborative resize / reposition.
    //                             // console.log(
    //                             //     "Resize in",
    //                             //     that.id_attribute,
    //                             //     siz_width, "x", siz_height,
    //                             //     pct(progress),
    //                             //     sliding_left.toFixed(0) + "," + sliding_top.toFixed(0)
    //                             // );
    //                             // EXAMPLE:
    //                             //     Resize in popup_1990 278.671875 x 194 17.4% 238,70
    //                             //     Resize in popup_1990 312.296875 x 213 20.6% 229,68
    //                             //     Resize in popup_1990 345.921875 x 231 23.7% 220,66
    //
    //                         } else {
    //                             if (siz_width === 0 && siz_height === 0) {
    //                                 // We harmlessly start out with zero-size iframe.
    //                             } else {
    //                                 console.warn(
    //                                     "Resize out",
    //                                     that.id_attribute,
    //                                     siz_width, "x",
    //                                     siz_height,
    //                                     pct(progress), "[",
    //                                     pct(progress_width),
    //                                     pct(progress_height), "]",
    //                                     that.$render_bar.width(),
    //                                     that.$render_bar.height(), "~",
    //                                     popup_cont.pop_stuff.thumb_render_width,
    //                                     popup_cont.pop_stuff.thumb_render_height, "->",
    //                                     popup_cont.pop_stuff.max_live_width,
    //                                     popup_cont.pop_stuff.max_live_height
    //                                 );
    //                             }
    //                         }
    //                         function pct(z) {
    //                             return (z * 100.0).toFixed(1) + "%";
    //                         }
    //                     }
    //                     that.fix_caption_width();
    //                 },
    //                 checkOrigin: [MONTY.OEMBED_OTHER_ORIGIN]
    //             });
    //             // TODO:  live_media_iframe() postMessage error from iframeResizer,
    //             //        Is it wrong?  Fixable?
    //             //        iframeResizer.js:754 Failed to execute 'postMessage' on 'DOMWindow':
    //             //        The target origin provided ('http://...') does not match the recipient
    //             //        window's origin ('http://...').
    //             on_init();
    //         }, IFRAME_RESIZER_INIT_MS);
    //     }
    // };

    // Contribution.prototype.media_error_clarion = function Contribution_media_error_clarion(what, message) {
    //     var that = this;
    //     that.is_noembed_error = true;
    //     that.$sup.addClass('noembed-error');
    //     that.trigger_event(that.Event.MEDIA_ERROR, {message: message});
    //     console.warn("Media error", what, "#" + that.id_attribute, message);
    //     if (is_popup() && popup_cont.idn === that.idn) {
    //         // NOTE:  In other words, is there a popup, and is the error for the same contribution
    //         //        as the popup!  The second test is so that a delayed (dynamic) thumbnail
    //         //        error does not interfere with displaying the popup.
    //         popup_cont.$sup.animate({
    //             top: TOP_SPACER_PX,
    //             left: 0
    //         }, {
    //             duration: POP_UP_ANIMATE_MS,
    //             easing: POP_UP_ANIMATE_EASING,
    //             queue: false
    //         });
    //     }
    // };

    // Contribution.prototype.iframe_incoming = function Contribution_iframe_incoming(twofer) {
    //     var that = this;
    //     var message = twofer.message;
    //     console.assert(
    //         message.id_attribute === that.id_attribute,
    //         "Mismatch id_attribute",
    //         that.id_attribute,
    //         message
    //     );
    //     var idn_string = strip_prefix(message.id_attribute, MONTY.POPUP_ID_PREFIX);
    //     var idn = parseInt(idn_string);
    //     console.assert(idn === that.idn, "Mismatch idn", that.idn, idn, message);
    //     // noinspection JSRedundantSwitchStatement
    //     switch (message.action) {
    //     case 'auto-play-presaged':
    //         console.log("Media presaged", that.id_attribute, message.id_attribute);
    //         that.trigger_event(that.Event.MEDIA_BEGUN);
    //         break;
    //     case 'auto-play-static':
    //         console.log("Media static", that.id_attribute, message.id_attribute);
    //         that.trigger_event(that.Event.MEDIA_STATIC, {
    //             idn: that.idn,
    //             current_time: message.current_time
    //         });
    //         // interact.start(idn, message.current_time);
    //         // DONE:  Avoid double START interact.  Interaction is now lexed in event handler.
    //         //        Can happen if Contribution.zero_iframe_recover()
    //         break;
    //     case 'auto-play-begun':
    //         console.log("Media begun", that.id_attribute, message.id_attribute);
    //         // NOTE:  Okay to pause.
    //         break;
    //     case 'auto-play-woke':
    //         console.log("Media woke", that.id_attribute, message.id_attribute);
    //         that.trigger_event(that.Event.MEDIA_WOKE);
    //         // NOTE:  State changes, first sign of life from youtube player.
    //         break;
    //     case 'auto-play-end-dynamic':
    //         console.log("Dynamic media ended", that.id_attribute, message.id_attribute);
    //         that.trigger_event(that.Event.MEDIA_ENDED);
    //         // NOTE:  MEDIA_ENDED event means e.g. a video ended,
    //         //        so next it's time for a breather.
    //         // interact_old.end(idn, message.current_time);
    //         interact_new.end({contribute: idn, progress: ms_round(message.current_time)});
    //         break;
    //     case 'auto-play-end-static':
    //         console.log("Static media ended", that.id_attribute, message.id_attribute);
    //         // NOTE:  Static media timed-out, no breather necessary.
    //         // interact_old.end(idn, message.current_time);
    //         interact_new.end({contribute: idn, progress: ms_round(message.current_time)});
    //         break;
    //     case 'auto-play-error':
    //         // Later error, youtube finds
    //         that.media_error_clarion("auto-play", message.error_message);
    //         // EXAMPLE:  YouTube Player error 150
    //         //           Video unavailable
    //         //           This video contains content from Home Box Office Inc.,
    //         //           who has blocked it on copyright grounds.
    //         //           https://www.youtube.com/watch?v=axVxgCT3YD0 (Six Feet Under finale)
    //         break;
    //     case 'auto-play-paused':
    //         console.log(
    //             "Media paused - static or dynamic",
    //             that.id_attribute,
    //             message.id_attribute,
    //             message.current_time
    //         );
    //         that.trigger_event(that.Event.MEDIA_PAUSED);
    //         if ( ! that.is_noembed_error) {
    //             // interact_old.pause(idn, message.current_time);
    //             interact_new.pause({contribute: idn, progress: ms_round(message.current_time)});
    //             // NOTE:  This could happen a while after the pause button is clicked,
    //             //        after a cascade of consequences.  But it should accurately
    //             //        record the actual position of the pause in the video.
    //         }
    //         break;
    //     case 'auto-play-quit':
    //         // NOTE:  This up-going message resulted from the Down-going message
    //         //            'un-pop-up'
    //         //        For a dynamic contribution, e.g. youtube,
    //         //        we get here only if the iframe says the video was in a
    //         //        quitable state.
    //         //        You can't quit if a video wasn't playing or paused.
    //         //        For a static contribution, e.g. instagram,
    //         //        we get here if the un-pop-up was manual, not bot-automated.
    //         console.log(
    //             "Media quit",
    //             that.id_attribute,
    //             message.id_attribute
    //         );
    //         // interact_old.quit(idn, message.current_time);
    //         interact_new.quit({contribute: idn, progress: ms_round(message.current_time)});
    //         break;
    //     case 'auto-play-playing':
    //         // console.log(
    //         //     "Media playing",
    //         //     that.id_attribute,
    //         //     message.id_attribute,
    //         //     message.current_time.toFixed(3),
    //         //     bot.is_paused
    //         // );
    //
    //         // if (bot.is_paused) {
    //         //     // NOTE:  This may be the sole place a Contribution knows of a Bot.
    //         //     //        Necessary?  Wise?
    //         //     interact.resume(idn, message.current_time);
    //         // } else {
    //         //     interact.start(idn, message.current_time);
    //         // }
    //
    //         // TODO:  Get smarter about the work iframe_incoming() does, and the work
    //         //        Bot.finite_state_machine() does.  The only reason to move the interact.verb()
    //         //        calls here was so they'd record the manual playing of contributions.
    //         //        The FSM event handlers don't catch those, because they're .off()ed
    //         //        at MEDIA_END or POP_DOWN_ONE.
    //         //        Unfortunately it's still buggy, because bot.is_paused is tested here
    //         //        but never set in MANUAL state when a pause comes through.
    //         //        Maybe the multiple sources of play/pause/resume events should NOT be combined
    //         //        but rather teased apart:
    //         //            1. Global buttons - bot
    //         //            2. Individual play button under each contribution thumbnail.
    //         //            3. Media embedded buttons e.g. inside a YouTube video.
    //
    //         var S = bot.State;
    //         if (bot.is_paused) {
    //             bot.assert_state_is([
    //                 S.MEDIA_PAUSE_IN_FORCE   // dynamic resume, parent or embed, bot only
    //             ]);
    //             console.log("Media resuming", idn, message.current_time);
    //             // interact_old.resume(idn, message.current_time);   // dynamic resume
    //             interact_new.resume({contribute: idn, progress: ms_round(message.current_time)});   // dynamic resume
    //             bot._pause_ends();
    //         } else {
    //             bot.assert_state_is([
    //                 S.MANUAL,          // dynamic play for the first time, manual - and (BUG) resume after pause
    //                 S.MEDIA_STARTED    // dynamic play for the first time, bot
    //             ]);
    //             console.log("Media started playing", idn, message.current_time);
    //             // interact_old.start(idn, message.current_time);
    //             interact_new.start({contribute: idn, progress: ms_round(message.current_time)});
    //             // NOTE:  Don't think it's possible to get a double START on dynamic media
    //             //        the way it was with static media.
    //             //        We got here from an auto-play-playing message from the embed
    //             //        and that could not hardly have come from a zero-size iframe.
    //         }
    //
    //
    //         // that.trigger_event(that.Event.MEDIA_PLAYING);
    //
    //
    //
    //         break;
    //     // case 'auto-play-resume':
    //     //     // NOTE:  This is a parent-initiated resume, for non-dynamic media.
    //     //     console.log(
    //     //         "Media resume",
    //     //         that.id_attribute,
    //     //         message.id_attribute,
    //     //         message.current_time.toFixed(3)
    //     //     );
    //     //     interact.resume(idn, message.current_time);
    //     //     that.trigger_event(that.Event.MEDIA_RESUME, {
    //     //         current_time: message.current_time
    //     //     });
    //     //
    //     //     break;
    //     case 'noembed-error-notify':
    //         // Later error, noembed finds
    //         that.media_error_clarion("noembed-error", message.error_message);
    //         // EXAMPLE:  noembed error 401 Unauthorized
    //         //           https://www.youtube.com/watch?v=bAD2_MVMUlE (Love Actually end)
    //         //           https://www.youtube.com/watch?v=7FwBbb6FuCU (Eisenhower Farewell)
    //         break;
    //     default:
    //         console.error(
    //             "Unknown action, parent <== child",
    //             '"' + message.action + '"',
    //             message
    //         );
    //         break;
    //     }
    // }

    // /**
    //  * Record an interact in the Lex.
    //  *
    //  * The deceptively simple loop below the interact() function definition creates curried
    //  * versions of calls to interact():
    //  *
    //  *     interact(MONTY.INTERACT_VERBS[i_something], o, n, t);   // long version
    //  *     interact('start', o, n, t);                                // less long version
    //  *     interact.start(o, n, t);                                   // curried version
    //  *
    //  * @param interact_name - value from MONTY.INTERACT_VERBS array
    //  * @param obj
    //  * @param num
    //  * @param txt
    //  */
    // function interact_old(interact_name, obj, num, txt) {
    //     if ( ! is_specified(txt))   txt = "";
    //     type_should_be(interact_name, String);
    //     type_should_be(obj, Number);   // e.g. 1435
    //     type_should_be(num, Number);
    //     type_should_be(txt, String);
    //     var num_with_one_qigit_resolution = one_qigit(num);
    //     // NOTE:  current_time (the position of play within a video)
    //     //        doesn't need to be stored with more than one qigit below the decimal.
    //     //        So it gets rounded to the nearest 1/256.
    //     //        Does this throw away 2 useful bits?  Dubious how useful.
    //    qoolbar.post('interact', {
    //         name: interact_name,
    //         obj: obj,
    //         num: num_with_one_qigit_resolution,
    //         txt: txt
    //     });
    // }
    // looper(MONTY.INTERACT_VERBS, function for_each_interact(_, interact_name) {
    //     interact_old[interact_name] = function curried_interact(obj, num, txt) {
    //         interact_old(interact_name, obj, num, txt);
    //     };
    // });






    /**
     * Record a child of interact in the Lex.
     *
     * The deceptively simple loop below the interact() function definition creates curried
     * versions of calls to interact():
     *
     *     interact(MONTY.INTERACT_VERBS[i_something], obj);   // long version
     *     interact('start', obj);                                // less long version
     *     interact.start(obj);                                   // curried version
     *
     * @param interact_name - value from MONTY.INTERACT_VERBS array
     * @param obj - associative array of obj fields, e.g. {contribute=7444, progress=2072}
     */
    function interact_new(interact_name, obj) {
       type_should_be(interact_name, String);
       type_should_be(obj, Object);
       lex.create_word(interact_name, obj, function done_interact(word) {
           // contribution_lexi.word_resolve(word);
           // contribution_lexi.word_handle(word);
       });
    }
    looper(MONTY.INTERACT_VERBS, function for_each_interact(_, interact_name) {
        interact_new[interact_name] = function curried_interact(obj) {
            interact_new(interact_name, obj);
        };
    });






    // Contribution.prototype.fix_caption_width = function Contribution_fix_caption_width() {
    //     var that = this;
    //     // TODO:  Call this function more places where $caption_bar.width(is set to something)
    //     // TODO:  Why can't this simply copy $sup.width() to $caption_bar.outerWidth()?
    //
    //
    //     var media_width  = that.$iframe    .is(':visible') ? that.$iframe    .outerWidth() || 0 : 0;
    //     var thumb_width  = that.$img_thumb .is(':visible') ? that.$img_thumb .outerWidth() || 0 : 0;
    //     var wordy_width  = that.$cont      .is(':visible') ? that.$cont      .outerWidth() || 0 : 0;
    //     var render_width = that.$render_bar.is(':visible') ? that.$render_bar.outerWidth() || 0 : 0;
    //
    //
    //     function adjust_to(width) {
    //         if (equal_ish(width, that.$caption_bar.outerWidth(), 1.0)) {
    //             // width is already within 1 pixel, don't upset the UI.
    //         } else {
    //             // EXAMPLE:  caption tweak 296 -> 162 55% thumb loading
    //             // EXAMPLE:  caption tweak 221 -> 210 95% quote size adjust
    //             that.$caption_bar.outerWidth(width);
    //         }
    //     }
    //
    //     if (media_width > MIN_CAPTION_WIDTH) {
    //         adjust_to(media_width);
    //     } else if (thumb_width > MIN_CAPTION_WIDTH) {
    //         adjust_to(thumb_width);
    //         // NOTE:  thumb_width being 2 (or some nonzero value) is common, but temporary
    //     } else if (render_width > MIN_CAPTION_WIDTH) {
    //         adjust_to(render_width);
    //         // NOTE:  render_width is the only nonzero value when a noembed error is shown.
    //     } else if (wordy_width > MIN_CAPTION_WIDTH) {
    //         adjust_to(wordy_width);
    //         // NOTE:  wordy_width is the last resort, in case of quote contributions
    //         //        But it has width even when invisible, which we don't want.
    //         //        In that case choose media or thumb.
    //     }
    // };

    // Contribution.prototype.resizer_nudge = function Contribution_resizer_nudge() {
    //     var that = this;
    //     if (that.has_iframe) {
    //         var iframe = that.iframe;
    //         // FALSE WARNING:  Condition is always true since types '{get: (function(): any | null)}' and 'null' have no overlap
    //         // noinspection JSIncompatibleTypesComparison
    //         if (iframe !== null && is_defined(iframe.iFrameResizer)) {
    //             iframe.iFrameResizer.resize();
    //         }
    //     }
    // };

    // /**
    //  * Workaround for the zero-iframe bug.
    //  *
    //  * When an iframe has zero width or height, try reloading it.
    //  * This may work around an iFrameResizer bug.  Or just a poor internet connection.
    //  *
    //  * When this is attempted (obviously this list is massively likely to go stale):
    //  *    3 seconds after each iframe is loaded
    //  *    3 seconds after a reload that THIS function causes
    //  *    after animating a pop-up to full-ish screen
    //  *    after save, cancel, discard a contribution media URL
    //  *    (for all iframes) 3 seconds after page load (help browsers with no iframe load event)
    //  *    (for all iframes) when a category is opened (For the first time? Or every time?)
    //  *
    //  * THANKS:  iframe reload by src reassign, https://stackoverflow.com/a/4062084/673991
    //  */
    // Contribution.prototype.zero_iframe_recover = function Contribution_zero_iframe_recover() {
    //     var that = this;
    //     var $iframe = that.$iframe;
    //     if (
    //         $iframe.is(':visible') &&
    //         ($iframe.width() === 0 || $iframe.height() === 0)
    //     ) {
    //         var i_recovery = $iframe.data('recovery-count') || 0;
    //         i_recovery++;
    //         $iframe.data('recovery-count', i_recovery);
    //         if (i_recovery > MAX_IFRAME_RECOVERY_TRIES) {
    //             console.error("Too many iframe recoveries, giving up", $iframe.attr('id'));
    //             // NOTE:  This can stop an endless cycle of reloading, for embedded media that
    //             //        for whatever reason always has zero size.
    //         } else {
    //             reload_iframe($iframe);
    //             console.log("ZERO-IFRAME, RECOVERY", i_recovery, $iframe.attr('id'));
    //         }
    //     }
    // };

    function reload_iframe(iframe) {
        $(iframe).attr('src', $(iframe).attr('src'));
    }

    // Contribution.prototype.thumb_image = function Contribution_thumb_image(
    //     thumb_url,
    //     thumb_title,
    //     load_callback,
    //     error_callback
    // ) {
    //     var that = this;
    //     type_should_be(thumb_url, String);
    //     type_should_be(thumb_title, String);
    //     type_should_be(load_callback, Function);
    //     type_should_be(error_callback, Function);
    //     var $a = $('<a>', {
    //         id: that.id_prefix + 'thumb_' + that.idn_string,
    //         'class': 'thumb-link',
    //         href: thumb_url,
    //         target: '_blank',
    //         title: thumb_title
    //     });
    //     // THANKS:  class is a reserved word,
    //     //          https://api.jquery.com/jQuery/#creating-new-elements
    //     //          'The name "class" must be quoted in the object since it is a JavaScript
    //     //          reserved word, and "className" cannot be used since it refers to the
    //     //          DOM property, not the attribute.'
    //
    //     // noinspection HtmlRequiredAltAttribute,RequiredAttributes
    //     var $img = $('<img>', {
    //         'class': 'thumb thumb-loading',
    //         alt: thumb_title
    //     });
    //     that.$render_bar.empty().append($a);
    //     $a.append($img);
    //     that.fix_caption_width();
    //     $img.one('load.thumb1', function render_img_load() {
    //         $img.off('.thumb1');
    //         $img.removeClass('thumb-loading');
    //         $img.addClass('thumb-loaded');
    //         that.fix_caption_width();
    //         load_callback();
    //     });
    //     $img.one('error.thumb1', function render_img_error() {
    //         $img.off('.thumb1');
    //         console.log("Broken thumb", thumb_url);
    //         error_callback();
    //     });
    //     // NOTE:  .src is set after the load and error event handlers,
    //     //        so one of those handlers is sure to get called.
    //     $img.attr('src', thumb_url);
    // };

    // Contribution.prototype.live_media_iframe = function Contribution_live_media_iframe(
    //     parameters,
    //     then
    // ) {
    //     var that = this;
    //     then = default_to(then, function () {});
    //     var $iframe = $('<iframe>', {
    //         id: that.id_prefix + 'iframe_' + that.idn_string,   // This is NOT how a pop-up gets made.
    //         src: our_oembed_relay_url(parameters),
    //               allowFullScreen : 'true',
    //            mozallowFullScreen : 'true',
    //         webkitallowFullScreen : 'true',
    //         allow: 'autoplay; fullscreen'
    //     });
    //     $iframe.one('error.media1', function () {
    //         $iframe.off('.media1');
    //         then();
    //     });
    //     $iframe.one('load.media1', function () {
    //         $iframe.off('.media1');
    //         // NOTE:  Cannot delegate the iframe load event, because it doesn't bubble.
    //         //        https://developer.mozilla.org/Web/API/Window/load_event
    //
    //         var older_loader_timer = $iframe.data('loader_timer');
    //         if (is_specified(older_loader_timer)) {
    //             clearInterval(older_loader_timer);
    //             // NOTE:  Instead of multiple load events triggering multiple recoveries,
    //             //        this clears the older (thus earlier) recovery,
    //             //        and so only the newer (thus later) recovery happens.
    //             //        This might thwart a run-away chain reaction in case some oembed
    //             //        iframe content reloads itself once (and iframe is persistently zero).
    //             //        Because if a reload happens, we'll almost certainly come back here
    //             //        at least once.
    //             //        Worst case, a permanently zero iframe reloads every 3 seconds forever.
    //             // TODO:  Limit the reloading to a certain number of times.
    //             //        And a certain minimum too!  Otherwise a zero-iframe may result,
    //             //        due to $(iframe iframe div img) having style width:0 height:0
    //             //        maybe because the div.flickr-embed-photo did too?
    //             // NOTE:  There seems to be an infinite loop in UC Browser for soundcloud.com
    //             //        VM1681 visual-single-sound-ff6ac74-7a528cf9.js
    //             //        Uncaught DOMException: Failed to execute 'getImageData' on
    //             //        'CanvasRenderingContext2D': The source width is 0.
    //         }
    //         var loader_timer = setTimeout(function () {
    //             $iframe.removeData('loader_timer');
    //             that.zero_iframe_recover();
    //         }, IFRAME_RECOVERY_CHECK_MS);
    //         $iframe.data('loader_timer', loader_timer);
    //
    //         then();
    //         // NOTE:  Zero-iframe recovery (i.e. reload) might come AFTER callback is called.
    //     });
    //     // NOTE:  Chrome's ooey gooey autoplay policy needs iframe delegation.
    //     //        https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
    //     //        Unclear if `allow: autoplay` is part or all of that.
    //     //        Emeffing lazy browser developers hammer legitimate media activity.
    //     //        So user may have to hit an in-iframe play button an unknown number of times
    //     //        before the (GeeDee user-initiated) player bot will begin to work.
    //     // NOTE:  Instagram popup won't do scrollbars, even if iframe overflow: auto
    //     //        On both outer (this $iframe here) and inner (instagram-installed).
    //     //        Is this a bad thing?  Even if it did scroll, virtually ANY other interaction
    //     //        results in a new instagram tab popping up.
    //
    //     that.$render_bar.empty().append($iframe);   // The iframe is dead, long live the iframe.
    //
    //     that.resizer_init(function () {});
    // };

    // /**
    //  * Generate the parts of a contribution's bars that might change due to content.
    //  *
    //  * Mainly this is the render-bar.  But the save-bar external-link is also affected.
    //  * And the .sup-contribution gets a .render-media or not, which has ripple effects.
    //  */
    // // TODO:  Is the callback `then` only needed for media_noembed.js to wait for ajax response?
    // //        So can this complification go away after we get free of noembed??
    // Contribution.prototype.rebuild_bars = function Contribution_rebuild_bars(then) {
    //     var that = this;
    //     then = then || function () {};
    //     if (that.is_media) {
    //         that.render_media(intermediate_step);
    //     } else {
    //         that.render_text(intermediate_step);
    //     }
    //
    //     function intermediate_step() {
    //         setTimeout(function () {
    //             // NOTE:  This little bit of breathing space really seems to make the difference
    //             //        when adjusting the sizes of what's newly rendered.
    //             //        Especially some quotes and yellow-background error messages, which
    //             //        otherwise are too wide.
    //             initial_thumb_size_adjustment();
    //             then();
    //         });
    //     }
    // }

    // /**
    //  * (Re)build the render bar element contents, using the media URL in the contribution text.
    //  *
    //  * Use the registered media handler, if the pattern matches.
    //  *
    //  * Happens on page load, on entering a new contribution, or editing an old one.
    //  */
    // Contribution.prototype.render_media = function Contribution_render_media(then) {
    //     var that = this;
    //     // NOTE:  that.$iframe may not exist yet, e.g. on page reload, or entering a new cont.
    //     //        If it did exist it gets displaced here, e.g. after an edit.
    //     // that.$sup.attr('data-domain', sanitized_domain_from_url(that.content));
    //
    //     that.$sup.addClass('render-media');
    //     that.$external_link.attr('href', that.media_url);
    //     that.$external_link.attr('target', '_blank');
    //     that.$external_link.attr('title', that.media_domain + " - new tab");
    //
    //     if (that.handler_scan()) {
    //         // console.log(
    //         //     "Sophisticated Media", that.id_attribute,
    //         //     "handler", that.handler.handler_index,
    //         //     that.handler.media.description_short,
    //         //     that.handler.match_object.slice(1).join(" "),
    //         //     that.caption_text.slice(0, 10) + "..."
    //         // );
    //         // EXAMPLE:  Sophisticated Media 3459 handler 0 youtube _SKdN1xQBjk
    //         // EXAMPLE:  Sophisticated Media 994 handler 1 instagram BNCeThsAhVT
    //         // EXAMPLE:  Sophisticated Media 1857 handler 2 noembed  Switched a...
    //         // EXAMPLE:  Sophisticated Media 1792 handler 3 any url  Mr Bean's ...
    //         that.set_can_play(that.handler.media.can_play());
    //
    //         that.$cont.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
    //         // NOTE:  Set width for editing the contribution URL text.
    //
    //         that.handler.media.render_thumb(that, then);
    //     } else {
    //         // Virtually impossible to get here, because could_be_url() does the same test as
    //         // media_any_url.js media.url_patterns.  So nothing passes could_be_url() and fails
    //         // media_any_url.js.
    //
    //         // that.set_can_play(false);
    //         // // that.$sup.removeClass('can-play');
    //         // // that.$sup.removeClass('cant-play');
    //         // // TODO:  Remember why I used to remove BOTH these classes?
    //         //
    //         // console.error(
    //         //     "No media handler for",
    //         //     that.id_attribute,
    //         //     that.content.slice(0,40),
    //         //     "in",
    //         //     media_handlers.length,
    //         //     "handlers"
    //         // );
    //
    //         var error_message = [
    //             "No media handler for",
    //             that.id_attribute,
    //             that.content.slice(0,40),
    //             "in",
    //             media_handlers.length,
    //             "handlers"
    //         ].join(" ");
    //         console.error(error_message);
    //         that.render_error(error_message);
    //         then();
    //     }
    // };
    //
    // Contribution.prototype.render_text = function Contribution_render_text(then) {
    //     var that = this;
    //     that.$sup.removeClass('render-media');
    //     that.set_can_play(true);   // (can be "played" as text to speech audio)
    //     that.$external_link.removeAttr('href');
    //     that.$external_link.removeAttr('target');
    //     that.$external_link.removeAttr('title');
    //     that.$render_bar.empty();
    //     then();
    // }

    // Contribution.prototype.render_error = function Contribution_render_error(error_message) {
    //     var that = this;
    //     var $p = $('<p>', { 'class': 'error-message' });
    //     $p.text(error_message);
    //     that.$render_bar.empty().append($p);
    //     // NOTE:  A different error message, from the one we're storing here in the thumbnail,
    //     //        would go into a popup if the Bot tries to play it.
    //     //        The popup error comes from the server, and goes inside the iframe
    //     //        (with no iFrameResizer) so it will not be accessible here,
    //     //        so it will not be recorded in the lex.
    //
    //     // Early error, handler discovered it, maybe with help from noembed
    //     that.media_error_clarion("handler-rendering", error_message);
    //     // EXAMPLE:  Instagram image not found
    //     // EXAMPLE:  facebook is not supported. noembed provides some info but not a thumbnail. Provider: Facebook
    //     // EXAMPLE:  no matching providers found for 'inspire_rs'
    //     // NOTE:  Don't record in lex here!  Errors in thumbnails come through here.
    //
    //     that.set_can_play(false);
    //     // NOTE:  How non-live thumbnails skip the bot.
    //     //        Also how the text gets its peachy background color.
    //
    //     that.$render_bar.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
    //     // NOTE:  Might be better to set this in CSS, but that would need box-sizing:border-box
    //
    //     that.$cont.outerWidth(px_from_rem(WIDTH_MAX_EM.soft));
    //     // NOTE:  Set width for editing the contribution URL text.
    //
    //     that.fix_caption_width();
    // };

    // Contribution.prototype.set_can_play = function Contribution_set_can_play(can) {
    //     var that = this;
    //     that.is_able_to_play = can;
    //     that.$sup.toggleClass('can-play', can);
    //     that.$sup.toggleClass('cant-play', ! can);
    // };

    // /**
    //  * Compute coordinates for position:fixed clone that would appear in the same place.
    //  *
    //  * @return {{top: number, left: number}}
    //  */
    // Contribution.prototype.fixed_coordinates = function Contribution_fixed_coordinates() {
    //     var that = this;
    //     var offset;
    //     if (that.is_dom_rendered()) {
    //         offset = that.$sup.offset();
    //     } else {
    //         offset = that.cat.$unrendered.offset();
    //     }
    //     return {
    //         top: offset.top - $(window).scrollTop(),
    //         left: offset.left - $(window).scrollLeft()
    //     };
    //     // THANKS:  Recast position from relative to fixed, with no apparent change,
    //     //          (my own compendium) https://stackoverflow.com/a/44438131/673991
    // };

    // /**
    //  * Is this media URL handled by a registered handler?
    //  *
    //  * If so:
    //  *     return true
    //  *     set that.handler to point to the winning handler object in media_handlers.
    //  *     set that.handler.match_object to the results of the match, possibly containing
    //  *                                   regular expression parenthetical sub-match strings
    //  *     set that.handler.pattern_index to the index into url_patterns[] for that handler.
    //  *
    //  * The first pattern of the first handler wins.  So catch-all patterns should come last in
    //  * the media_handlers[] array.
    //  *
    //  * @return {boolean}
    //  */
    // Contribution.prototype.handler_scan = function contribution_handler_scan() {
    //     var that = this;
    //     var did_find = false;
    //     if (that.is_media) {
    //         looper(media_handlers, function handler_loop(_, media_handler) {
    //             if (media_handler.did_register) {
    //                 console.assert(is_specified(media_handler.media), media_handler);
    //                 console.assert(is_specified(media_handler.media.url_patterns), media_handler.media);
    //                 looper(media_handler.media.url_patterns, function pattern_loop(pattern_index, url_pattern) {
    //                     var match_object = that.content.match(url_pattern);
    //                     if (match_object !== null) {
    //                         that.handler = media_handler;
    //                         that.handler.match_object = match_object;
    //                         that.handler.pattern_index = pattern_index;
    //                         did_find = true;
    //                         return false;
    //                         // NOTE:  Exit url pattern loop, FIRST pattern wins.
    //                     }
    //                 });
    //                 if (did_find) {
    //                     return false;
    //                     // NOTE:  Exit handler loop, FIRST handler wins.
    //                 }
    //             }
    //         });
    //         // TODO:  Profile this double loop.
    //         //        Especially when it's a triple loop inside rebuild_all_bars()
    //     }
    //     return did_find;
    // };

    // /**
    //  * Send a message to the embedded iframe JavaScript.
    //  *
    //  * @param message {object} - with an action property, and other action-specific properties
    //  */
    // // TODO:  Contribution method
    // Contribution.prototype.embed_message = function Contribution_embed_message(message) {
    //     var that = this;
    //     that.iframe_resizer(
    //         function (resizer) {
    //             resizer.sendMessage(message);
    //         },
    //         function (why) {
    //             console.warn("Cannot iframe", message.action, "--", why);
    //             // Cannot pause or resume text -- no iframe
    //             // NOTE:  This harmlessly happens because of the redundant un-pop-up,
    //             //        when POP_DOWN_ONE state does a pop_down_all()
    //             //        before it punts to NEXT_CONTRIBUTION which pops up
    //             //        (which also does a pop_down_all()).
    //         }
    //     );
    // }

    // /**
    //  * Do something with the iFrameResizer object.  Call back if there is one.  Explain if not.
    //  *
    //  * @param {function} callback_good - pass it the iFrameResizer object, if up and running
    //  * @param {function=} callback_bad - pass it an explanation if not
    //  */
    // Contribution.prototype.iframe_resizer = function Contribution_iframe_resizer(
    //     callback_good,
    //     callback_bad
    // ) {
    //     var that = this;
    //     callback_bad = callback_bad || function (message) { console.error(message); };
    //
    //     if (that.is_dom_rendered()) {
    //         if (that.is_media) {
    //             if (that.has_iframe) {
    //             // var iframe = that.iframe;
    //             // // FALSE WARNING:  Condition is always false since types '{get: (function():
    //             // //                 any | null)}' and 'null' have no overlap
    //             // // noinspection JSIncompatibleTypesComparison
    //             // if (iframe === null) {
    //             //     bad("No iframe element in " + that.id_attribute);
    //             // } else {
    //                 var resizer;
    //                 try {
    //                     resizer = that.iframe.iFrameResizer;
    //                 } catch (e) {
    //                     callback_bad(
    //                         "No resizer " +
    //                         that.id_attribute + " " +
    //                         e.message + " - " +
    //                         that.iframe.id
    //                     );
    //                     return
    //                 }
    //                 if ( ! is_specified(resizer)) {
    //                     callback_bad("Null resizer " + that.id_attribute);
    //                 } else if (typeof resizer.sendMessage !== 'function') {
    //                     callback_bad("No resizer sendMessage " + that.id_attribute);
    //                 } else if (typeof resizer.close !== 'function') {
    //                     callback_bad("No resizer close " + that.id_attribute);
    //                 } else {
    //                     callback_good(resizer);
    //                 }
    //             } else {
    //                 callback_bad("No iframe element in " + that.id_attribute);
    //             }
    //         } else {
    //             // NOTE:  E.g. harmlessly trying to use a cont with no render-bar iframe.
    //         }
    //     } else {
    //         callback_bad("No element " + that.idn);
    //     }
    // };

    // TODO:  Contribution.one_word()
    // /**
    //  * Retrieve the first word of a contribution
    //  *
    //  * Or [blank] if the contribution is empty or all whitespace.
    //  * Or [id_attribute] if we can't find the element.
    //  *
    //  * @param cont_idn - id_attribute of the contribution
    //  * @return {string}
    //  */
    // function first_word_from_cont(cont_idn) {
    //     var $cont = $_from_id(cont_idn);   // actually the div.sup-contribution#id_attribute containing the div.contribution
    //     if ($cont.length !== 1) {
    //         // console.error("Missing contribution element, id =", cont);
    //         return "[" + cont_idn + "?]";
    //     }
    //     var $sup = $cont.closest('.sup-contribution');
    //     var $cap = $sup.find('.caption-span');
    //     var txt_cont = $cont.text().trim();
    //     var txt_cap = $cap.text().trim();
    //     if        ( ! is_laden(txt_cont) && ! is_laden(txt_cap)) {
    //         return "[blank]";
    //     } else if ( ! is_laden(txt_cont) &&   is_laden(txt_cap)) {
    //         return                          first_word(txt_cap);
    //     } else if (   is_laden(txt_cont) && ! is_laden(txt_cap)) {
    //         return  first_word(txt_cont);
    //     } else if (   is_laden(txt_cont) &&   is_laden(txt_cap)) {
    //         var first_cap = first_word(txt_cap);
    //         var first_cont = first_word(txt_cont);
    //         if (first_cont.length < first_cap.length) {
    //             return first_cont;
    //         } else {
    //             return first_cap;
    //         }
    //     }
    // }

    // Contribution.prototype.fetch_txt = function fetch_txt() {
    //     var that = this;
    //     return monty_txt_from_idn(that.idn);
    // }

    // /**
    //  * Make the bi-directional connection between a Contribution object instance and a DOM element.
    //  *
    //  * @param $sup - DOM element rendering of the Contribution
    //  */
    // Contribution.prototype.dom_link = function Contribution_dom_link($sup) {
    //     var that = this;
    //
    //     that.$sup = $sup;
    //     // NOTE:  primal connection:  from object instance --> to DOM element
    //     //        `$sup` - DOM element was created in Contribution.build_dom()
    //
    //     that.$sup.data('contribution-object', that);
    //     // NOTE:  primal connection:  from DOM element --> to object instance
    //     //        `that` - object was instantiated in ContributionLexi.word_pass()
    // }

    function could_be_url(text) {
        // FALSE WARNING:  HTTP links are not secure
        // noinspection HttpUrlsUsage
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



    //// UX handlers

    /**
     * Is there unfinished entry or editing on the page?
     *
     * Make red controls that could save unfinished work.
     *
     * @param {boolean} do_scroll_into_view - if reddening controls, also scroll entry into view?
     * @param {boolean} do_close_clean - If an edit was started but no changes, do we just close it?
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
                    scroll_into_view('#enter_some_text', { block: 'nearest', inline: 'nearest' });
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
     * If so, make its [save] and [discard] buttons red.  Because the user appears to be about to
     * inadvertently abandon edits without saving.  So which is it?  Save or advertently abandon?
     *
     * @param {boolean} do_scroll_into_view - if reddening controls, also scroll edits into view?
     * @param {boolean} do_close_clean - If an edit was started but no changes, do we just close it?
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
                        scroll_into_view($cont_editing, { block: 'nearest', inline: 'nearest' });
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
     *        Better yet, detect the bug by its behavior.  But I don't know a way to do that.
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
            dom_from_$($(element)).scrollIntoView(options);
            // SEE:  Browser scrollIntoView, https://caniuse.com/#search=scrollIntoView
        });
    }

    function contribution_edit(evt) {
        var element = this;
        var cont = ContributionWord.from_element(element);
        console.assert(cont.is_dom_rendered(), cont);
        // NOTE:  Much falderal in this function to support long-press edit.
        //        If we gave up entirely on that feature, the rest of this function might be
        //        simplified to just calling contribution_edit_begin() and stopPropagation()
        var $clicked_on = $(evt.target);
        // SEE:  this vs evt.target, https://stackoverflow.com/a/21667010/673991
        if ($clicked_on.is('.contribution') && is_click_on_the_resizer(evt, $clicked_on.get(0))) {
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
        var element = this;
        var cont = ContributionWord.from_element(element);
        console.assert(cont.is_dom_rendered(), element);
        console.assert(is_editing_some_contribution);
        // If not editing, how was the cancel button visible?
        if (is_editing_some_contribution) {
            if (cont.$sup.hasClass('edit-dirty')) {
                $cont_editing.text($cont_editing.data('unedited_text'));
                cont.$caption_span.text(cont.$caption_span.data('unedited_text'));
            }
            contribution_edit_end();
        }
        cont.save_alarm(false);
    }

    /**
     * The contribution or caption editing input field has changed value.  It's unsaved, so "dirty".
     */
    function caption_input() {
        var element = this;
        var cont = ContributionWord.from_element(element);
        console.assert(cont.is_dom_rendered(), element);
        if ( ! cont.$sup.hasClass('edit-dirty')) {
            cont.$sup.addClass('edit-dirty');
            $(window.document.body).removeClass('dirty-nowhere');
        }
    }

    // TODO:  Contribution method
    function contribution_save() {
        if (is_editing_some_contribution) {
            var old_cont = ContributionWord.from_element($cont_editing);
            console.assert(old_cont.$cont.is($cont_editing));

            old_cont.save_alarm(false);
            // NOTE:  Both acknowledge clicking the save button, and clear any error
            //        indication, in case it works this time.

            edit_submit(
                old_cont.$cont,
                "contribution",
                'edit',
                old_cont.idn,
                function contribution_saved(new_cont_word) {
                    // var $sup_cont = $cont_editing.closest('.sup-contribution');
                    // var $caption_span = $sup_cont.find('.caption-span');

                    var did_contribution_change = new_cont_word !== null;

                    var live_cont_idn;   // idn of the live contribution from onw on, new or old
                    if (did_contribution_change) {
                        // contribution_lexi.edit_word(new_cont_word);
                        // contribution_lexi.word_resolve(new_cont_word);
                        // contribution_lexi.word_handle(new_cont_word);
                        live_cont_idn = new_cont_word.idn;
                    } else {
                        live_cont_idn = old_cont.idn;
                    }

                    // NOTE:  Unique among the three interactive changes (post, edit, drag)
                    //        saving an edit needs more work after the word is handled, and
                    //        a new Contribution has been instantiated.
                    //        A new Contribution instance must be forcibly associated
                    //        with an existing DOM object.
                    //        These two entities always link to each other.
                    //        Call them cont and $dom.
                    //        Each $dom links to a cont.  But not every cont links to a $dom.
                    //            (A cont may be superseded or unrendered.)
                    //        Without any editing, that relationship was maintained from birth:
                    //            .build_dom() pointed cont.$sup to $dom
                    //            .build_dom() pointed $dom.data('contribution-object') to cont
                    //            (Both were achieved when .build_dom() called .dom_link().)
                    //        So here are the current cast of characters:
                    //            old_cont          - old cont
                    //            old_cont.$sup     - new $dom   <-- weird huh!
                    //            new_cont          - new cont
                    //            new_cont.$sup     - (undefined)
                    //        Good parts:
                    //            $cont_editing is part-way to becoming the new $dom
                    //            The existing DOM element -- thanks to the magic of
                    //                HTML content editing -- was edited in place,
                    //                So it already has the new text,
                    //                in both .contribution and .caption-span elements.
                    //                This is why we say old_cont.$sup is (almost) the new $dom
                    //            there is no old $dom, we don't need to worry about it
                    //            old_cont.$cont.attr('id') was already updated by the preceding
                    //                edit_submit()
                    //            old_cont.$caption_span.attr('id') will set by the upcoming
                    //                edit_submit()
                    //            old cont got a superseded_by_idn property in .edit_word()
                    //                TODO:  Make sure of this, see twin asserts below.
                    //        Bad parts:
                    //            old_cont.idn
                    //            old_cont.idn_string     (nope, it is computed from .idn)
                    //            old_cont.id_attribute   (nope, it is computed from .idn)
                    //            $cont_editing DOM object points to the old cont
                    //                it should point to the new cont
                    //            the old cont points to $cont_editing
                    //                the new cont should point to it
                    //            new cont doesn't point to any $dom, so its
                    //                .is_dom_rendered() is false
                    //
                    //        TL;DR:  Wrest the DOM away from old_cont, and give it to new_cont

                    edit_submit(
                        old_cont.$caption_span,
                        "caption",
                        'caption',
                        live_cont_idn,
                        function caption_saved(new_caption_word) {
                            var did_caption_change = new_caption_word !== null;
                            if (did_caption_change) {
                                // contribution_lexi.caption_word(new_caption_word);
                                // contribution_lexi.word_resolve(new_caption_word);
                                // contribution_lexi.word_handle(new_caption_word);
                            }
                            if (did_contribution_change) {
                                var new_cont = lex.cont_from_idn(live_cont_idn);

                                var $new_dom_almost = old_cont.$sup;
                                new_cont.dom_link($new_dom_almost);   // new cont becomes rendered

                                // console.assert(
                                //     old_cont.superseded_by_idn === new_cont.idn,
                                //     "Huh, the following is not redundant after all.",
                                //     old_cont,
                                //     new_cont
                                // );
                                // console.assert(
                                //     old_cont.supersedes_idn === old_cont.idn,
                                //     "Huh, the next two lines may not be redundant after all.",
                                //     old_cont,
                                //     new_cont
                                // );

                                old_cont.dom_removal();               // old cont disappears
                                // TODO:  Encapsulate this code into some kind of new method
                                //        ContributionLexi.cont_supersede(
                                //            old_rendered_cont_with_updated_dom,
                                //            new_superseding_cont
                                //        )?

                                new_cont.rebuild_bars();
                            }
                            contribution_edit_end();
                            // contribution_lexi.assert_consistent();
                            lex.assert_consistent();
                        },
                        save_fail
                    );
                },
                save_fail
            );

            function save_fail(message) {
                console.error(message);
                old_cont.save_alarm(true);
                // TODO:  Test both changed, contribution saved, caption save failed (rare)

                // contribution_lexi.assert_consistent();
                lex.assert_consistent();
                // NOTE:  May fail, e.g. caption dom != caption object, until properly saved.
            }
        } else {
            console.error("Save but we weren't editing?", $cont_editing);
        }
    }

    // Contribution.prototype.save_alarm = function Contribution_save_alarm(is_bad) {
    //     var that = this;
    //     var $save_button = that.$save_bar.find('.save');
    //     $save_button.toggleClass('failed-post', is_bad);
    //     var title_text = is_bad ? "Failed to save. Try again?" : null;
    //     $save_button.attr('title', title_text);
    // }

    // Contribution.prototype.supersedes = function Contribution_supersedes(older_cont_idn) {
    //     var that = this;
    //     that.supersedes_idn = older_cont_idn;
    // }
    //
    // Contribution.prototype.superseded_by = function Contribution_superseded_by(newer_cont) {
    //     var that = this;
    //     that.superseded_by_idn = newer_cont.idn;
    //     // TODO:  Remove the obsolete object??
    //     //        contribution_lexi.delete(that.idn) ??
    //     //        That is, deliberately forget about superseded contributions,
    //     //        only store the current ones.
    // }

    function unrendered_click(evt) {
        var cat = CategoryWord.from_element(this);
        console.assert(cat !== null, this, evt);
        cat.render_some_conts(evt.shiftKey ? MORE_CAT_CONT_SHIFT : MORE_CAT_CONT);
        cat.show_unrendered_count();
        // contribution_lexi.assert_consistent();
        lex.assert_consistent();
    }

    /**
     * Pop up and auto play a contribution.  Unless editing.
     *
     * If editing clean (i.e. no changes yet), just end the edit.
     * If editing dirty, make the discard and save buttons red.
     * In either case, no popup.
     *
     * @param evt - event from the click
     * @return {boolean} - return false, not just falsy, as part of the overkill trying not to let
     *                     the click do anything else.
     */
    function thumb_click(evt) {
        var div = this;
        if ( ! check_contribution_edit_dirty(false, true)) {
            var cont = ContributionWord.from_element(this);
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
    // TODO:  Contribution method
    function bigger(element, do_play) {
        bot.stop();
        var cont = ContributionWord.from_element(element);
        console.assert(cont.is_dom_rendered(), element);
        $(window.document.body).addClass('pop-up-manual');
        // NOTE:  body.pop-up-manual results from clicking any of:
        //        1. the contribution's save-bar "bigger" button with the fullscreen icon
        //        2. the contribution's save-bar "play" button with the triangle icon
        //        3. the contribution render-bar thumbnail
        //        This does not happen when clicking the global bot play button,
        //        nor its subsequent automated pop-ups.
        cont.pop_up(do_play);
    }

    function mouse_wheel_handler(evt) {
        if (evt.originalEvent.ctrlKey) {
            console.log("Mouse wheel", evt.originalEvent.deltaY);
            // -100 for up (zoom in)
            // +100 for down (zoom out)

            // evt.preventDefault();
            // EXAMPLE:  error message when trying to evt.preventDefault():
            //           jquery.js:5575 [Intervention] Unable to preventDefault
            //           inside passive event listener due to target being treated as passive.
            //           See https://www.chromestatus.com/features/6662647093133312
            // SEE:  addEventListener passive false, https://stackoverflow.com/a/55673572/673991
            // SEE:  passive event listeners, https://stackoverflow.com/a/39187679/673991
            // SEE:  passive events, https://stackoverflow.com/a/44339214/673991
        }
    }

    /**
     * End pop-up.
     *
     * @param did_bot_transition - true = Bot automatic timeout of the contribution,
     *                            false = manually terminated
     * @param {function=} then - callback when popping down (if any) is done.
     */
    function pop_down_all(did_bot_transition, then) {
        then = then || function () {};

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
            js_for_unslumping.utter = utter;
            if (is_specified(popped_cont)) {
                popped_cont.$cont.text(popped_cont.obj.text);
            } else {
                console.error("Uttering while nothing popped up?");
            }

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
            if (speech_progress !== null && is_popup()) {
                // NOTE:  No manual QUIT after automated END.
                // interact_old.quit(popup_cont.idn, speech_progress);
                interact_new.quit({contribute: popped_cont.idn, progress:speech_progress});
            }
        }
        if (breather_timer !== null) {
            console.log("(breather cut short)");
            clearTimeout(breather_timer);
            breather_timer = null;
        }

        if ( ! is_popup()) {
            then();
        } else {

            deanimate("popping down", popped_cont.id_attribute);
            // NOTE:  popup_cont could now be null if this pop-down interrupted another pop-down.
            //        which would have caused all its animations to immediately complete.

            if ( ! is_popup()) {
                then();
            } else {

                // var thumb_cont = lex.cont_from_idn(popped_cont.idn);

                // popup_cont.$sup.removeClass('pop-up');
                // // NOTE:  This immediate removal of the pop-up class, though premature
                // //        (because the animation of the popping down is not complete),
                // //        allows redundant back-to-back calls to pop_down_all().
                // //        Because it means a second call won't find any .pop-up elements.

                $(window.document.body).removeClass('pop-up-manual');
                $(window.document.body).removeClass('pop-up-auto');

                var promises = [];

                if (is_specified(popped_cont.pop_stuff)) {
                    // NOTE:  Now we know the bars were rendered. (Actually, just the .render-bar
                    //        and the caption-bar.  The save-bar is never rendered on the popup.)
                    //        Time to un-render them.

                    console.assert(is_specified(popped_cont.pop_stuff));
                    // TODO:  Instead, just remember the pop-down DOM object ($sup_cont in pop_up()),
                    //        and recalculate HERE AND NOW its current "fixed" coordinates from that object.

                    if (popped_cont.is_media) {
                        popped_cont.embed_message({
                            action: 'un-pop-up',
                            width: popped_cont.pop_stuff.thumb_render_width,
                            height: popped_cont.pop_stuff.thumb_render_height,
                            did_bot_transition: did_bot_transition,
                            duration: POP_DOWN_ANIMATE_MS,
                            easing: POP_DOWN_ANIMATE_EASING
                        });
                    } else {
                        promises.push(popped_cont.$cont.animate({
                            width: popped_cont.pop_stuff.cont_css_width,
                            height: popped_cont.pop_stuff.cont_css_height,
                            'font-size': px_from_rem(1)
                        }, {
                            duration: POP_DOWN_ANIMATE_MS,
                            easing: POP_DOWN_ANIMATE_EASING,
                            queue: false
                        }).promise());
                        promises.push(popped_cont.$caption_bar.animate({
                            width: popped_cont.pop_stuff.caption_css_width,
                            height: popped_cont.pop_stuff.caption_css_height,
                        }, {
                            duration: POP_DOWN_ANIMATE_MS,
                            easing: POP_DOWN_ANIMATE_EASING,
                            queue: false
                        }).promise());

                        // TODO:  Velocity.js animation?  https://github.com/julianshapiro/velocity
                    }
                    if (is_specified(popped_cont.pop_stuff.margin_left_down)) {
                        promises.push(popped_cont.$sup.animate({
                            'margin-left': popped_cont.pop_stuff.margin_left_down
                        }, {
                            duration: POP_DOWN_ANIMATE_MS,
                            easing: POP_DOWN_ANIMATE_EASING,
                        }));
                    }
                    if (is_specified(popped_cont.pop_stuff.window_scroll_top)) {
                        console.debug("Scroll DOWN to", popped_cont.pop_stuff.window_scroll_top);
                        promises.push($('html, body').animate({
                            scrollTop: popped_cont.pop_stuff.window_scroll_top
                        }, {
                            duration: POP_DOWN_ANIMATE_MS,
                            easing: POP_DOWN_ANIMATE_EASING,
                        }));
                        // TODO:  Animate headroom instead of scrollTop, perhaps with step.
                    }
                }
                promises.push(pop_screen_down_fade_out().promise());
                // promises.push(popped_cont.$sup.animate(thumb_cont.css_for_position_fixed(), {
                //     duration: POP_DOWN_ANIMATE_MS,
                //     easing: POP_DOWN_ANIMATE_EASING,
                //     queue: false,
                //     // THANKS:  Concurrent animations, https://stackoverflow.com/a/4719034/673991
                //     //          Queue false means animate immediately, in this case mostly
                //     //          simultaneously with shrinking text caption.
                //     complete: function pop_down_scoot_done() {
                //         popped_cont.iframe_resizer(function (resizer) {
                //             resizer.close();
                //             // NOTE:  Without close() the un-full window generates warnings on resizing.
                //             //        Example:
                //             //            iframeResizer.js:134
                //             //            [iFrameSizer][Host page: popup_iframe_1834]
                //             //            [Window resize] IFrame(popup_iframe_1834) not found
                //             //        And probably maybe leaks memory.
                //         }, function pop_down_scoot_fail() {
                //         });
                //
                //         if (thumb_cont.is_dom_rendered()) {
                //             thumb_cont.$sup.removeClass('pop-down');
                //             // NOTE:  Unhide the original un-popped contribution
                //         }
                //     }
                // }).promise());

                var combined_promise = $.when.apply($, promises);
                combined_promise.done(function popdown_animation_done() {
                    // $('#popup-screen').remove();   // Removes contained popup contribution too.
                    popped_cont.$sup.removeClass('pop-up');
                    popped_cont.$sup.removeClass('pop-up-block');
                    popped_cont.$sup.css('margin-left', 0);
                    popped_cont.$sup.find('.grip').removeClass('inoperative');
                    popped_cont.rebuild_bars();
                    // NOTE:  Revert from live media to thumbnail at END of pop-down animation.

                    if (popped_cont.is_temporarily_rendered) {
                        popped_cont.is_temporarily_rendered = false;
                        popped_cont.dom_removal();
                        popped_cont.cat.show_unrendered_count();
                    }
                    delete popped_cont.pop_stuff;
                    // NOTE:  Some events could conceivably come in later from the embedded
                    //        rendering via the iFrameResizer, but that handler should handle
                    //        that gracefully by checking is_specified(...pop_stuff)
                    set_popped_cont(null);
                    then();
                });
                combined_promise.fail(function popdown_animation_fail() {
                    then();
                });
            }
        }
    }
    //
    // Contribution.prototype.pop_up = function Contribution_pop_up(auto_play) {
    //     var that = this;
    //
    //     var cont_idn = that.id_attribute;
    //     var popup_id_attribute = MONTY.POPUP_ID_PREFIX + cont_idn;
    //     var popup_cont_selector = selector_from_id(popup_id_attribute);
    //     var was_already_popped_up = $(popup_cont_selector).length > 0;
    //
    //     pop_down_all(false);
    //
    //     if (was_already_popped_up) {
    //         console.error("Contribution", that.idn, "is popping itself down by 2nd click.");
    //         // NOTE:  Avoid double-pop-up.  Just pop down, don't pop-up again.
    //         //        This may no longer be possible, with the popup-screen,
    //         //        and the save-bar buttons all disabled on the popup.
    //         return null;
    //     }
    //
    //     var thumb_fixed_coordinates = that.css_for_position_fixed();
    //
    //     set_popup_cont(new Contribution(that.idn));
    //     // NOTE:  Only the second place we ever call the Contribution constructor.
    //     //        That's because we actually do want to create a new Contribution instance here.
    //     //        This will mean TWO instances of the Contribution class,
    //     //        representing TWO elements in the DOM,
    //     //        representing only ONE contribution word from the qiki Lex.
    //     //        The old (thumb) element will be hidden (because it'll have .pop-down CSS class).
    //     //        The new (popup) element will be popped up big with a screen behind it.
    //     //        Thus the illusion that only one Contribution is seen.
    //     //        The old element can be accessed by pulling the old instance from contribution_lexi
    //     //        using the factory method Contribution.from_idn().
    //     //        But the new element will now be built from scratch for the new instance
    //     //        rendering the popup.
    //
    //     popup_cont.id_prefix = MONTY.POPUP_ID_PREFIX;
    //     popup_cont.cat = that.cat;
    //     popup_cont.capt = that.capt;
    //     popup_cont.build_dom(that.content);
    //
    //     // NOTE:  This Contribution object never passes through render_some_conts(), so no
    //     //        mutation or resize observations take place.
    //     //        That only happens for contribution objects in contribution_lexi.
    //
    //     popup_cont.$sup.find('.grip').removeClass('grip').addClass('grip-inoperative');
    //     // NOTE:  No dragging popped-up stuff.
    //     //        It was a little disconcerting not seeing the grip symbol there.
    //     //        So just disabling the feature and dimming the icon
    //     //        seemed the lesser UX crime.
    //
    //     popup_cont.$sup.addClass('pop-up');
    //     // popup_cont.$sup.data('popped-down', that.$sup);
    //
    //     var $popup_screen = $('<div>', { id: 'popup-screen' });
    //     $popup_screen.append(popup_cont.$sup);
    //     if (that.is_dom_rendered()) {
    //         that.$sup.before($popup_screen);
    //         that.$sup.addClass('pop-down');
    //         // NOTE:  Zoom up from thumbnail.
    //     } else {
    //         that.cat.$unrendered.before($popup_screen);
    //         // NOTE:  Zoom up from the .unrendered section
    //     }
    //
    //     popup_cont.$sup.css(thumb_fixed_coordinates);
    //     popup_cont.$sup.css({
    //         position: 'fixed',
    //         'z-index': 1
    //     });
    //     // NOTE:  Start the popup right where the original thumbnail was on the screen, but with
    //     //        fixed coordinates.
    //
    //     popup_cont.rebuild_bars(function popup_clone_rendered() {
    //
    //         // NOTE:  Now the contribution to be popped up is cloned and thumbnail size.
    //
    //         var thumb_render_width = popup_cont.$render_bar.width();
    //         var thumb_render_height = popup_cont.$render_bar.height();
    //         var cont_css_width = popup_cont.$cont.css('width');
    //         var cont_css_height = popup_cont.$cont.css('height');
    //         var caption_css_width = popup_cont.$caption_bar.css('width');
    //         var caption_css_height = popup_cont.$caption_bar.css('height');
    //         var caption_css_background = popup_cont.$caption_bar.css('background-color');
    //
    //         var vertical_padding_in_css = px_from_rem(0.3 + 0.3);
    //
    //         // var save_height = popup_cont.$save_bar.height() || popup_cont.$save_bar.find('.edit').height();
    //         // console.assert(
    //         //     save_height > 0.0,
    //         //     that.idn,
    //         //     save_height,
    //         //     that.$save_bar.height(),
    //         //     that.$save_bar.width(),
    //         //     that.$save_bar.find('.edit').height(),
    //         //     that.$save_bar.find('.expand').height(),
    //         //     that.$save_bar.css('overflow')
    //         // );
    //         // // EXAMPLE:  Assertion failed: 1929 0 ... 16 16 hidden
    //         // // EXAMPLE:  Assertion failed: 1851 0 0 202 16 16 hidden
    //         // // NOTE:  Sometimes $save_bar.height() is zero.
    //         // //        $save_bar is supposed to have enough .height() to contain its buttons,
    //         // //        but it's sometimes zero (not always), even though its overflow:hidden and
    //         // //        the button.full child has height.  (So does .unfull even though display none.)
    //         // //        See https://stackoverflow.com/a/5369963/673991
    //         // //        Working around it by reverting to the button height if the div height is zero.
    //         // //        Clear-fix didn't work https://alistapart.com/article/css-floats-101/#section7
    //         // //        Specifically, this code was in build_contribution_dom() below the buttons:
    //         // //            $save_bar.append($('<div>', { style: 'clear: both;' }).html('&nbsp;'));
    //         // //        Moving the .height() to before pop_down_all() didn't work.
    //         // //        Adds to the impression I don't understand the problem.
    //         // //        Along with the fact that $save_bar.height() is never zero from the console.
    //         // //        Not even when the item is eclipsed by something else popped up.
    //         // //        Both Chrome and Firefox have this problem,
    //         // //        and both are fixed by the || .full work-around.
    //         // //        Doesn't always happen.  I think it only happens when the bot is popping up
    //         // //        item N+1 as it is about to pop down item N.  So never for item 1.
    //         // //        Happens either for logged in users from their "my" category, and anon
    //         // //        users from the "others" category.
    //         // // TODO:  Try "Float Fix Float" http://complexspiral.com/publications/containing-floats/
    //         // //        More tricks:  https://stackoverflow.com/a/5369963/673991
    //
    //         var max_live_width = usable_width();
    //
    //         var caption_height_px = popup_cont.$caption_bar.outerHeight();
    //         // NOTE:  Wrapped thumbnail captions may result in less tall popups,
    //         //        because popped-up captions don't need to be wrapped.
    //
    //         var max_live_height = Math.round(
    //             usable_height()
    //             - caption_height_px
    //             // - save_height   // Not this; we eliminated buttons below the pop-up.
    //             - vertical_padding_in_css
    //             - 30
    //         );
    //         // NOTE:  Extra 30-pixel reduction in height.
    //         //        Tends to prevent scrollbars from spontaneously appearing.
    //         //        Someday a less crude way would be good.
    //
    //         // popup_cont.$sup.data('pop-stuff',
    //         popup_cont.pop_stuff = {
    //             thumb_render_width: thumb_render_width,
    //             thumb_render_height: thumb_render_height,
    //             cont_css_width: cont_css_width,
    //             cont_css_height: cont_css_height,
    //             caption_css_width: caption_css_width,
    //             caption_css_height: caption_css_height,
    //             caption_css_background: caption_css_background,
    //             max_live_width: max_live_width,
    //             max_live_height: max_live_height,
    //             fixed_coordinates: thumb_fixed_coordinates
    //         };
    //
    //         if (popup_cont.is_media) {
    //
    //             deanimate("popping up media", popup_cont.id_attribute);
    //
    //             var img_src = popup_cont.$img_thumb.attr('src');
    //             // NOTE:  popup_cont.$img_thumb is ajax-loaded, use that.$img_thumb instead.
    //             if (is_defined(img_src)) {
    //                 popup_cont.$render_bar.css({
    //                     'background-image': 'url(' + img_src + ')',
    //                     'background-position': 'center center',
    //                     'background-size': 'cover'
    //                 });
    //                 // NOTE:  This makes the thumbnail resemble the unplayed youtube video,
    //                 //        while it's expanding to pop-up size,
    //                 //        albeit with lower resolution,
    //                 //        at least today it seems to.
    //                 // THANKS:  Scale background to cover element, without distorting aspect ratio,
    //                 //          https://stackoverflow.com/a/7372377/673991
    //
    //             }
    //             popup_cont.live_media_iframe({
    //                 id_attribute: popup_cont.id_attribute,   // idn is a misnomer, it may include popup_prefix
    //                 url: popup_cont.media_url,
    //                 is_pop_up: true,
    //                 auto_play: String(auto_play),
    //                 width:  max_live_width,
    //                 height: max_live_height,
    //                 duration: POP_UP_ANIMATE_MS,
    //                 easing: POP_UP_ANIMATE_EASING
    //             }, function media_iframe_loaded() {
    //                 // NOTE:  This is what makes it live media (e.g. a video) in the pop-up.
    //                 //        When oembed doesn't provide a thumbnail (e.g. dropbox) this may
    //                 //        load the iframe twice.
    //
    //                 popup_cont.$render_bar.width('');
    //                 // NOTE:  Undo render-bar width-setting from render_error();
    //
    //                 popup_cont.$render_bar.css({
    //                     'background-image': '',
    //                     'background-position': '',
    //                     'background-size': ''
    //                 });
    //                 // NOTE:  This removes unsightly background echo for some vimeo and flickr embeds.
    //                 // THANKS:  Remove CSS style, https://stackoverflow.com/a/4036868/673991
    //
    //
    //
    //                 // if (popup_cont.is_noembed_error) {
    //                 //     // NOTE:  This error may come from an embed_content.js iframe, as opposed to
    //                 //     //        media_noembed.js render_error().  So it may be worded different
    //                 //     //        and have different dimensions.
    //                 //
    //                 //     // TODO:  How to animate errors that come in later, e.g. 401 Unauthorized?
    //                 //
    //                 //     popup_cont.$sup.animate({
    //                 //         top: TOP_SPACER_PX,
    //                 //         left: 0
    //                 //     }, {
    //                 //         duration: POP_UP_ANIMATE_MS,
    //                 //         easing: POP_UP_ANIMATE_EASING,
    //                 //         queue: false
    //                 //     });
    //                 //
    //                 //     // NOTE:  We can't rely on an iframe and its resizing to animate this popup,
    //                 //     //        we'll do it ourselves here, but half-assed.  Just move the error
    //                 //     //        message to the upper left corner, under the bot buttons.
    //                 // }
    //             });
    //
    //             popup_cont.$iframe.width(thumb_render_width);
    //             popup_cont.$iframe.height(thumb_render_height);
    //             // NOTE:  Early in the popup, as soon as the iframe is in the DOM,
    //             //        until embed_content.js gets up and sets the size of the iframe through
    //             //        the iFrameResizer, let it start off as the same size as the thumbnail.
    //
    //             pop_screen_fade_in();
    //             console.debug("Fading in.....................");
    //
    //             if ( ! popup_cont.is_noembed_error) {
    //                 popup_cont.resizer_init(function pop_media_init() {
    //
    //                     // NOTE:  Harmless warning:
    //                     //        [iFrameSizer][Host page: iframe_popup_1990] Ignored iFrame, already setup.
    //                     //        because the popup is CLONED from a contribution that already
    //                     //        initialized its iFrameResizer.  Apparently it still needs to be
    //                     //        initialized but it thinks it doesn't.
    //
    //                     popup_cont.$sup.trigger(popup_cont.Event.MEDIA_INIT);
    //                     // NOTE:  Finally decided the best way to make the popup iframe big
    //                     //        was to focus on the inner CONTENTS size,
    //                     //        and let iFrameResizer handle the outer size.
    //                     // SEE:  Tricky iframe height 100%, https://stackoverflow.com/a/5871861/673991
    //
    //                     popup_cont.resizer_nudge();
    //                     popup_cont.zero_iframe_recover();
    //                     // NOTE:  A little extra help for pop-ups
    //                     //        with either a zero-iframe bug in iFrameResizer,
    //                     //        or a poor internet connection.
    //
    //                 });
    //             }
    //         } else {
    //             popup_cont.full_ish_screen_text(function () {
    //                 if (auto_play) {
    //                     popup_cont.play_quote_synthesis();
    //                     return;
    //
    //                     // noinspection UnreachableCodeJS
    //                     popup_cont.play_quote_talkify(auto_play);
    //                 }
    //             });
    //         }
    //     });
    //     console.log(
    //         "Popup",
    //         popup_cont.id_attribute,
    //         popup_cont.media_domain || "(quote)",
    //         "-",
    //         popup_cont.caption_text
    //     );
    // };
    //
    // function pop_speech_synthesis_init() {
    //     if (window.speechSynthesis !== null) {
    //         window.speechSynthesis.onvoiceschanged = function () {
    //             // THANKS:  voices ready, https://stackoverflow.com/a/22978802/673991
    //             voices = window.speechSynthesis.getVoices();
    //             console.log("Voices loaded", voices);
    //             voice_weights = Array(voices.length);
    //             for (var i = 0; i < voices.length; i++) {
    //                 if (/^en-GB/.test(voices[i].lang)) {
    //                     voice_weights[i] = 10.0;
    //                 } else if (/^en/.test(voices[i].lang)) {
    //                     voice_weights[i] = 5.0;
    //                 } else {
    //                     voice_weights[i] = 0.0;
    //                 }
    //                 if (voices[i].default) {
    //                     voice_default = voices[i];
    //                 }
    //             }
    //         };
    //     }
    // }

    // Contribution.prototype.play_quote_synthesis = function Contribution_play_quote_synthesis() {
    //     var that = this;
    //
    //     var pop_text = that.content;
    //
    //     utter = new window.SpeechSynthesisUtterance(pop_text);
    //     js_for_unslumping.utter = utter;
    //     // THANKS:  SpeechSynthesis bug workaround from 2016,
    //     //          https://stackoverflow.com/a/35935851/673991
    //     // NOTE:  Not sure if this is the same bug, but sometimes speech was
    //     //        not starting.
    //
    //     utter.rate = 0.75;
    //
    //     utter.pitch = 1.0;    // otherwise it's -1, wtf that means
    //
    //     switch ($('#play_bot_speech').val()) {
    //     case PLAY_BOT_SPEECH_OUT_LOUD:
    //         utter.volume = 1.0;   // otherwise it's -1, wtf that means
    //         break;
    //     case PLAY_BOT_SPEECH_ANIMATED:
    //         utter.volume = 0.0;   // otherwise it's -1, wtf that means
    //         break;
    //     case PLAY_BOT_SPEECH_OFF:
    //         utter.volume = 0.0;   // otherwise it's -1, wtf that means
    //         break;
    //     }
    //
    //     // utter.voice = chooseWeighted(voices, voice_weights);
    //     // console.log("Voice", utter.voice.name, utter.voice.lang);
    //     // NOTE:  (2019) Google voices don't report their word-boundary events.
    //     //               Microsoft voices do, and they sound better too.
    //     //        (2018) https://stackoverflow.com/a/48160824/673991
    //     //        (2016) https://bugs.chromium.org/p/chromium/issues/detail?id=521666
    //     //        Upshot is not to set voice at all.
    //     //        Microsoft Anna is default in Chrome, Firefox, Opera, Edge.
    //     //        Edge has many voices (9 English, 25 total).
    //     //        Could instead multiplicatively weight Google voices 0, Microsoft 1.
    //     //        Anyway, word boundaries are important because visual highlighting
    //     //        of words seems more potent.  Combination visual and auditory.
    //
    //     var states_before = speech_states();
    //
    //     window.speechSynthesis.cancel();   // Another attempt to fix text-not-speaking bug.
    //     // NOTE:  This cancel appears to be the trick that fixed it.
    //
    //     var states_between = speech_states();
    //     window.speechSynthesis.speak(utter);
    //     // NOTE:  Play audio even if not auto_play -- because there's no way
    //     //        to start the speech otherwise.  (SpeechSynthesis has no
    //     //        native control UX.)
    //     // EXAMPLE:  Silent for UC Browser, Opera Mobile, IE11
    //
    //     var states_after = speech_states();
    //
    //     console.log(
    //         "Language",
    //         voice_default.name,
    //         voice_default.lang,
    //         utter.voice,   // null in Chrome
    //         typeof utter.lang, utter.lang,   // string '' in Chrome
    //         states_before,
    //         "->",
    //         states_between,
    //         "->",
    //         states_after
    //     );
    //     // NOTE:  Probe droid for occasional lack of speaking popup.
    //     // EXAMPLE:  Microsoft Anna - English (United States) en-US
    //     // EXAMPLE:  (unknown) (UC Browser -- onvoiceschanged never called)
    //     //           window.speechSynthesis.getVoices() returns []
    //     //           https://caniuse.com/#feat=speech-synthesis
    //
    //     $(utter).on('start end boundary error mark pause resume', function (evt) {
    //         console.log(
    //             "Utter",
    //             evt.originalEvent.elapsedTime.toFixed(1),
    //             evt.type,
    //             evt.originalEvent.charIndex
    //         );
    //         // EXAMPLE:
    //         //     Utter start 0 39.220001220703125
    //         //     Utter boundary 0 158.97999572753906
    //         //     Utter boundary 0 161.0850067138672
    //         //     Utter boundary 5 359.07000732421875
    //         //     Utter boundary 8 449.2300109863281
    //         //     Utter boundary 13 759.3049926757812
    //         //     Utter boundary 15 799.1599731445312
    //         //     Utter end 0 1779.2449951171875
    //         // EXAMPLE:
    //         //                   Utter 21.7 start 0
    //         //     14:53:02.834  Utter 116.9 boundary 0
    //         //     14:53:02.837  Utter 119.9 boundary 0
    //         //     14:53:02.935  Utter 217.1 boundary 3
    //         //     14:53:03.185  Utter 467.1 boundary 7
    //         //     14:53:03.293 Bot SPEECH_PLAYING 0 The text is being spoken
    //         //     14:53:03.385  Utter 667.1 boundary 12
    //         //     14:53:03.387  Utter 669.7 boundary 14
    //         //     14:53:03.784  Utter 1067.0 boundary 25
    //         //     14:53:03.984  Utter 1267.0 boundary 28
    //         //     14:53:04.135  Utter 1417.0 boundary 32
    //         //     14:53:04.293 Bot SPEECH_PLAYING 1 The text is being spoken
    //         //     14:53:04.634  Utter 1917.0 boundary 41
    //         //     14:53:04.935  Utter 2217.1 boundary 49
    //         //     14:53:04.976 Pause player bot
    //         //     14:53:04.980  Utter 2262.8 pause 0         <-- .004 second feedback
    //         //     14:53:05.084  Utter 2366.9 boundary 52
    //         //     14:53:05.287  Utter 2569.7 boundary 55
    //         //     14:53:05.485  Utter 2767.1 boundary 61
    //         //     14:53:05.685  Utter 2967.1 boundary 64
    //         //     14:53:06.085  Utter 3367.3 boundary 70
    //         //     14:53:12.081 Resume player bot
    //         //     14:53:12.086  Utter 9368.3 resume 0
    //         //     14:53:12.294 Bot SPEECH_PLAYING 2 The text is being spoken
    //         //     14:53:13.162  Utter 10444.1 end 0
    //         //     14:53:13.162
    //     });
    //     var $svg = null;
    //     $(utter).on('start', function speech_boundary(evt) {
    //         that.trigger_event(that.Event.SPEECH_START);
    //         // interact_old.start(that.idn, evt.originalEvent.charIndex);
    //         interact_new.start({contribute: that.idn, progress: evt.originalEvent.charIndex});
    //         speech_progress = 0;
    //     });
    //     $(utter).on('pause', function speech_pause() {
    //         // interact_old.pause(that.idn, speech_progress);
    //         interact_new.pause({contribute: that.idn, progress: speech_progress});
    //     });
    //     $(utter).on('resume', function speech_resume() {
    //         // interact_old.resume(that.idn, speech_progress);   // quote resume
    //         interact_new.resume({contribute: that.idn, progress: speech_progress});   // quote resume
    //         // NOTE:  Resume can be 2-4 words later than pause!
    //         //        This is the "speechSynthesis pause delay" issue.
    //     });
    //     $(utter).on('boundary', function speech_boundary(evt) {
    //         // TODO:  Hold off HERE if pause is happening.
    //         //        This would avoid highlighting the NEXT word.
    //         //        Besides the wrong word, the animation appears unresponsive to
    //         //        the pause command, stubbornly pushing on ahead.
    //         //        (It already butts ahead 2 words anyway.)
    //         var start_word = evt.originalEvent.charIndex;
    //         // NOTE:  We don't seem to need to adjust start_word to the left
    //         //        to get to a word-boundary.  That's what's done in
    //         //        https://stackoverflow.com/a/50285928/673991
    //         //        If we did, it might look like this:
    //         //        left = str.slice(0, pos + 1).search(/\S+$/)
    //         var word_to_end = pop_text.slice(start_word);
    //         var len_word = word_to_end.search(/\s|$/);
    //         var end_word = start_word + len_word;
    //         var the_word = pop_text.slice(start_word, end_word+1);
    //         var range_word = window.document.createRange();
    //         that.$cont.text(pop_text);
    //
    //         var text_node = dom_from_$(that.$cont).childNodes[0];
    //
    //         console.assert(text_node.nodeName === '#text', text_node, that);
    //         range_word.setStart(text_node, start_word);
    //         range_word.setEnd(text_node, end_word);
    //         // THANKS:  Range of text, https://stackoverflow.com/a/29903556/673991
    //         var speaking_node = dom_from_$($('<span>', { 'class': 'speaking' }));
    //         range_word.surroundContents(speaking_node);
    //         // THANKS:  Range wrap, https://stackoverflow.com/a/6328906/673991
    //         speech_progress = end_word;
    //         scroll_into_view(speaking_node, {
    //             behavior: 'smooth',
    //             block: 'center',
    //             inline: 'center'
    //         });
    //         // SEE:  Highlight speech, https://stackoverflow.com/a/38122794/673991
    //         // SEE:  Select speech, https://stackoverflow.com/a/50285928/673991
    //
    //
    //         if (EXPERIMENTAL_RED_WORD_READING) {
    //             // NOTE:  The following experimental code would render the word being
    //             //        spoken, in red, on top of the same word in the paragraph.
    //             var r = range_word.getBoundingClientRect();
    //             console.log("Bound", the_word, r.x, r.y);
    //             if ($svg !== null) {
    //                 $svg.remove();
    //             }
    //             var svg_top = r.top - that.$sup.position().top;
    //             var svg_left = r.left - that.$sup.position().left;
    //             $svg = $('<svg>', {
    //                 height: r.height,
    //                 width: r.width,
    //                 style: (
    //                     'position:absolute;color:red;font: 16px Literata,serif;' +
    //                     'top:'+String(svg_top)+'px;' +
    //                     'left:'+String(svg_left)+'px;'
    //                 )
    //             }).append($('<text>', { fill: 'red !important' }).append(the_word));
    //             that.$sup.append($svg);
    //             // TODO:  Needs to scroll word into view,
    //             //        and then also position the svg right onto the scrolled word.
    //         }
    //     });
    //     $(utter).on('end', function (evt) {
    //         that.$cont.text(pop_text);
    //         if (utter === null) {
    //             console.error(
    //                 "Utterance interruptus (vestigial end after aborted speech)",
    //                 (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec"
    //             );
    //             // TODO:  Make a better scheme for detecting a stale utter event.
    //             //        Because a NEW bot play cycle might otherwise be
    //             //        transitioned prematurely.
    //             //        Did the $(utter).off() in pop_down_all() solve this issue?
    //             // interact_old.quit(that.idn, speech_progress);
    //             interact_new.quit({contribute: that.idn, progress: speech_progress});
    //         } else {
    //             console.log(
    //                 "Utterance",
    //                 (evt.originalEvent.elapsedTime/1000).toFixed(3), "sec,",
    //                 speech_progress, "of", pop_text.length, "chars"
    //             );
    //             that.trigger_event(that.Event.SPEECH_END);
    //             // NOTE:  A bit lame, this happens whether manually popped up or
    //             //        automatically played by the bot.  But it should have
    //             //        no consequence manually anyway.
    //             // interact_old.end(that.idn, pop_text.length);
    //             interact_new.end({contribute: that.idn, progress: pop_text.length});
    //         }
    //         speech_progress = null;
    //         // NOTE:  Setting speech_progress to null here prevents interact.quit() after
    //         //        interact.end()
    //     });
    //     that.trigger_event(that.Event.SPEECH_PLAY);
    // };
    //
    // Contribution.prototype.play_quote_talkify = function Contribution_play_quote_talkify(is_auto_play) {
    //     var that = this;
    //
    //     // NOTE:  The following code worked with the Talkify service.
    //     //        Which I recall was more legible than the Chrome browser speech,
    //     //        (though less so than the Edge browser speech), and is reasonably
    //     //        priced, but any metering of an uber free service is vexing.
    //
    //     if (is_specified(talkify)) {
    //         talkify.config.remoteService.host = 'https://talkify.net';
    //         talkify.config.remoteService.apiKey = '084ff0b0-89a3-4284-96a1-205b5a2072c0';
    //         talkify.config.ui.audioControls = {
    //             enabled: false, //<-- Disable to get the browser built in audio controls
    //             container: document.getElementById("player-bot")
    //         };
    //         talkify_player = new talkify.TtsPlayer();
    //         talkify_player.enableTextHighlighting();
    //
    //         talkify_player.setRate(-1.0);   // a little slower than the default
    //         // SEE:  Rate codes, https://github.com/Hagsten/Talkify#user-content-talkify-hosted-only
    //
    //         talkify_voice_name = random_element(TALKIFY_VOICES_ENGLISH);
    //         talkify_player.forceVoice({name: talkify_voice_name});
    //         // SEE:  Voice names,
    //         //       https://github.com/Hagsten/Talkify/issues/20#issuecomment-347837787-permalink
    //         //       https://jsfiddle.net/mknm62nx/1/
    //         //       https://talkify.net/api/speech/v1/voices?key= + talkify api key
    //
    //         // noinspection JSUnusedAssignment
    //         var popup_cont_node_list = document.querySelectorAll(selector_from_id(that.id_attribute));
    //         // NOTE:  Although that.$sup appears to work,
    //         //        the doc calls for "DOM elements" and the example passes a NodeList object.
    //         //        https://github.com/Hagsten/Talkify#play-all-top-to-bottom
    //
    //         talkify_playlist = new talkify.playlist()
    //             .begin()
    //             .usingPlayer(talkify_player)
    //             // .withTextInteraction()
    //             .withElements(popup_cont_node_list)
    //             .build();
    //
    //         talkify_playlist.play();
    //         // NOTE:  Play now, if not auto_play pause later.
    //
    //         // console.log("Talkie", talkify_player, talkify_playlist);
    //         // EXAMPLE talkify_player (type talkify.TtsPlayer) members:
    //         //     audioSource: {play: ƒ, pause: ƒ, isPlaying: ƒ, paused: ƒ, currentTime: ƒ, …}
    //         //     correlationId: "8e90fbe4-607f-4a82-97af-6802a18e430b"
    //         //     createItems: ƒ (text)
    //         //     currentContext: {item: {…}, positions: Array(86)}
    //         //     disableTextHighlighting: ƒ ()
    //         //     dispose: ƒ ()
    //         //     enableTextHighlighting: ƒ ()
    //         //     forceLanguage: ƒ (culture)
    //         //     forceVoice: ƒ (voice)
    //         //     forcedVoice: null
    //         //     isPlaying: ƒ ()
    //         //     isPlaying: ƒ ()
    //         //     pause: ƒ ()
    //         //     paused: ƒ ()
    //         //     play: ƒ ()
    //         //     playAudio: ƒ (item)
    //         //     playItem: ƒ (item)
    //         //     playText: ƒ (text)
    //         //     playbar: {instance: null}
    //         //     setRate: ƒ (r)
    //         //     settings: {useTextHighlight: true, referenceLanguage: {…}, lockedLanguage: null, rate: 1, useControls: false}
    //         //     subscribeTo: ƒ (subscriptions)
    //         //     withReferenceLanguage: ƒ (refLang)
    //         //     wordHighlighter: {start: ƒ, highlight: ƒ, dispose: ƒ}
    //         // EXAMPLE talkify_playlist (type Object, e.g. {}) members:
    //         //     disableTextInteraction: ƒ ()
    //         //     dispose: ƒ ()
    //         //     enableTextInteraction: ƒ ()
    //         //     getQueue: ƒ ()
    //         //     insert: ƒ insertElement(element)
    //         //     isPlaying: ƒ isPlaying()
    //         //     pause: ƒ pause()
    //         //     play: ƒ play(item)
    //         //     replayCurrent: ƒ replayCurrent()
    //         //     setPlayer: ƒ (p)
    //         //     startListeningToVoiceCommands: ƒ ()
    //         //     stopListeningToVoiceCommands: ƒ ()
    //
    //         var duration_report = "unknown duration";
    //
    //         var pause_once = ! is_auto_play;
    //
    //         var this_player = talkify_player;
    //         // NOTE:  Local "copy" of player needed in case pop_down_all() happens
    //         //        before the callback below has fully popped up.
    //
    //         talkify.messageHub.subscribe(BOT_CONTEXT, '*', function (message, topic) {
    //             // var members = message ? Object.keys(message).join() : "(no message)";
    //             console.log("talkify", topic/*, members*/);
    //             // EXAMPLE topics (context.type.action only, GUID context removed)
    //             //         and message members:
    //             //     player.*.prepareplay     \  text,preview,element,originalElement,
    //             //     player.tts.loading        > isPlaying,isLoading
    //             //     player.tts.loaded        /
    //             //     player.tts.play          item,positions,currentTime
    //             //     player.tts.timeupdated   currentTime,duration
    //             //     player.tts.pause         (no message)
    //             //     player.tts.ended         ((same members as loaded))
    //             if (/\.play$/.test(topic)) {
    //                 if (pause_once) {
    //                     pause_once = false;
    //                     this_player.pause();
    //                     // NOTE:  Crude, mf-ing way to support manual-only playing.
    //                     //        Without this, player is inoperative.
    //                 }
    //             }
    //         });
    //         talkify.messageHub.subscribe(
    //             BOT_CONTEXT,
    //             '*.player.tts.timeupdated',
    //             function (message) {
    //                 // NOTE:  This event happens roughly 20Hz, 50ms.
    //                 var $highlight = $('.talkify-word-highlight');
    //                 // $highlight.each(function () {
    //                 //     scroll_into_view(this, {
    //                 //         behavior: 'smooth',
    //                 //         block: 'center',
    //                 //         inline: 'center'
    //                 //     });
    //                 // });
    //                 // TODO:  Does this work without .each()?
    //                 scroll_into_view($highlight, {
    //                     behavior: 'smooth',
    //                     block: 'center',
    //                     inline: 'center'
    //                 });
    //                 // TODO:  Reduce frequency of this call by tagging element
    //                 //        with .already-scrolled-into-view?
    //                 //        Because this event happens 20Hz!
    //                 duration_report = message.duration.toFixed(1) + " seconds";
    //             }
    //         );
    //         talkify.messageHub.subscribe(
    //             BOT_CONTEXT,
    //             '*.player.tts.ended',
    //             function (/*message, topic*/) {
    //                 that.trigger_event(that.Event.SPEECH_END);
    //                 // console.log("talkify ended", that.id_attribute, message, topic);
    //                 // EXAMPLE:  topic
    //                 //     23b92641-e7dc-46af-9f9b-cbed4de70fe4.player.tts.ended
    //                 // EXAMPLE:  message object members:
    //                 //     element: div#popup_1024.contribution.talkify-highlight
    //                 //     isLoading: false
    //                 //     isPlaying: false
    //                 //     originalElement: div#popup_1024.contribution
    //                 //     preview: "this is just a test"
    //                 //     text: "this is just a te
    //                 //     st"
    //             }
    //         );
    //         talkify_done = function () {
    //             console.log(
    //                 "talkify", that.id_attribute,
    //                 "voice", talkify_voice_name,
    //                 duration_report
    //             );
    //         };
    //         that.trigger_event(that.Event.SPEECH_PLAY);
    //     }
    // }
    //
    // /**
    //  * Animated pop-up of a text quote.
    //  *
    //  * @param {function} then - callback when done.
    //  */
    // Contribution.prototype.full_ish_screen_text = function Contribution_full_ish_screen_text(then) {
    //     var that = this;
    //
    //     var cont_css_width = that.$cont.css('width');
    //     var cont_css_height = that.$cont.css('height');
    //
    //     that.$sup.css('left', 0);
    //     that.$sup.css('top', 0);   // give the text some room from the harsh right and bottom edges
    //     that.$cont.width('auto');
    //     that.$cont.height('auto');   // let the text's freak flag flow
    //
    //     var sup_natural_width = that.$sup.width()
    //     var sup_natural_height = that.$sup.height();
    //     var cont_natural_width = that.$cont.width();
    //
    //     var does_man_spread = sup_natural_width > (usable_width() * 0.95);
    //     // NOTE:  Does the content take up all the width we gave it?
    //
    //     var is_poetry = any_lone_newlines(that.content) && ! does_man_spread;
    //     // NOTE:  If it doesn't man-spread, it still might not be poetry,
    //     //        it might be really short prose.
    //     //        Huh, double-spaced poetry will be considered prose.
    //     //        And so might be slightly more likely to wrap, trying to match the aspect ratio,
    //     //        and get a bigger font.
    //
    //
    //
    //     //// Horizontal - determine left and width properties
    //
    //     var sup_chrome_h = that.$sup.innerWidth() - that.$cont.width();
    //     var SUP_PAD_LEFT = px_from_rem(0.5);   // SEE:  contribution.css
    //     var ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP = 10;
    //     var cont_width_value = Math.min(
    //         cont_natural_width + ROOM_FOR_WORD_ANIMATION_SO_IT_DOESNT_WRAP,
    //         usable_width() - sup_chrome_h
    //     );
    //     var sup_left = (usable_width() - cont_width_value - sup_chrome_h)/2 + SUP_PAD_LEFT;
    //     var cont_width_setting;
    //     if (is_poetry) {
    //         cont_width_setting = 'auto';
    //     } else {
    //         cont_width_setting = cont_width_value;
    //
    //         // NOTE:  Now see if we can match the prose's aspect ratio to the window's.
    //
    //         var width_portion = cont_width_value / usable_width();
    //         var height_portion = sup_natural_height / usable_height();
    //         var cont_fatter_than_window = width_portion / height_portion;   // fatter > 1, thinner < 1
    //         if (cont_fatter_than_window > 1.2) {
    //
    //             // NOTE:  Is the contribution's aspect ratio more than 20% wider than the window's?
    //             //        If contribution fills window width AND height
    //             //        (or more than the height, so it scrolls), we'll never get here,
    //             //        because cont_fatter_than_window will have been about 1 (or less than 1).
    //
    //             var excess_width = Math.sqrt(cont_fatter_than_window);
    //             // NOTE:  If contribution is 4 times as fat as the window, we want to make the
    //             //        contribution 1/2 as wide.  Which will make it about 2 times as tall.
    //             //        (Could a lot of small paragraphs introduce TOO MUCH height and
    //             //        thus require scrolling here?  Hope not!)
    //
    //             // TODO:  Run this aspect adjustment more than once?  Might help with text that
    //             //        doesn't wrap enough, so height doesn't expand as much as width shrunk.
    //             //        Without doing this, here's the problem:
    //             //        The EXPANDED popup (with the larger font) takes up the full width
    //             //        but only a fraction of the height of the window, e.g. half.
    //
    //             var cont_width_value_new = cont_width_value / excess_width;
    //             if (cont_width_value_new < px_from_rem(WIDTH_MAX_EM.soft)) {
    //                 cont_width_value_new = px_from_rem(WIDTH_MAX_EM.soft);   // not too skinny
    //             }
    //             if (cont_width_value_new < cont_width_value) {
    //
    //                 // NOTE:  This if-test prevents VERY tiny contributions from being made
    //                 //        WIDER than they would have been.
    //                 //        Because we only want this step to SHRINK width.
    //
    //                 sup_left += (cont_width_value - cont_width_value_new)/2;
    //                 cont_width_value = cont_width_value_new;
    //                 cont_width_setting = cont_width_value;
    //             }
    //         }
    //     }
    //     that.$sup.css('left', sup_left);   // set left BEFORE width, avoiding right-edge wrap
    //     that.$cont.width(cont_width_setting);
    //     that.fix_caption_width();
    //
    //
    //
    //     //// Vertical - determine top and height properties
    //
    //     that.$cont.height('auto');
    //
    //     var sup_height = that.$sup.height();
    //     var sup_chrome_v = that.$sup.innerHeight() - that.$cont.height();
    //     var sup_top;
    //     var cont_height_setting;
    //     if (sup_height <= usable_height()) {
    //         sup_top = (TOP_SPACER_PX + $(window).height() - sup_height)/2;
    //         cont_height_setting = 'auto';
    //     } else {
    //         sup_top = TOP_SPACER_PX;
    //         cont_height_setting = usable_height() - sup_chrome_v;
    //     }
    //
    //     that.$sup.css('top', sup_top);
    //     that.$cont.height(cont_height_setting);
    //
    //
    //
    //     //// Font - can we make this bigger?
    //
    //     var expandable_h = usable_width() / that.$sup.innerWidth();
    //     var expandable_v = usable_height() / that.$sup.innerHeight();
    //     var expandable = Math.min(expandable_h, expandable_v);
    //     var expand_font = null;
    //
    //     var font_size_setting;
    //     var font_size_normal = px_from_rem(1);
    //     // NOTE:  Animating to or from 'inherit' doesn't seem to work.
    //
    //     if (expandable > 1.1) {
    //         // NOTE:  Don't fiddle with a middling expansion.
    //
    //         expand_font = Math.min(expandable, MAX_FONT_EXPANSION);
    //
    //         var sup_width_before = that.$sup.width();
    //         var sup_height_before = that.$sup.height();
    //
    //         that.$sup.css('left', 0);   // prepare to grow font without right-edge wrap
    //         that.$sup.css('top', 0);
    //         // NOTE:  Temporarily scoot to upper left corner, so an enlarged contribution
    //         //        with auto width doesn't cause wrapping against right edge.
    //         //        Or, I guess, scrolling against the bottom, or something.
    //         //        Not sure it matters if top is set to 0 actually.
    //
    //         font_size_setting = expand_font.toFixed(2) + 'rem';
    //         that.$cont.css('font-size', font_size_setting);
    //
    //         if (typeof cont_width_setting === 'number') {
    //             cont_width_setting *= expand_font;
    //             that.$cont.width(cont_width_setting);
    //         }
    //         that.fix_caption_width();
    //
    //         // NOTE:  No cont_height_setting expansion needed, because if it's numeric, i.e. not
    //         //        'auto', then the text is height-limited, and we're scrolling, and we hate
    //         //        that, so we sure haven't expanded the font at all.
    //
    //         var sup_width_after = that.$sup.width();
    //         var sup_height_after = that.$sup.height();
    //
    //         sup_left -= (sup_width_after - sup_width_before) / 2;
    //         sup_top -= (sup_height_after - sup_height_before) / 2;
    //         that.$sup.css('left', sup_left);
    //         that.$sup.css('top', sup_top);
    //     } else {
    //         font_size_setting = font_size_normal;
    //     }
    //
    //
    //
    //     // console.log(
    //     //     "Text pop up",
    //     //     sup_left, sup_top, sup_height,
    //     //     is_poetry ? "POEM" : "prose",
    //     //     expand_font,
    //     //     "\n",
    //     //     cont_css_width, cont_css_height,
    //     //     cont_width_setting, cont_height_setting,
    //     //     usable_width(), usable_height(),
    //     //     sup_chrome_h, sup_chrome_v,
    //     //     expandable_h, expandable_v,
    //     //     type_name(cont_width_setting), type_name(cont_height_setting),
    //     //     "\n",
    //     //     that.$sup.css('left'),
    //     //     that.$sup.css('top'),
    //     //     that.$cont.css('width'),
    //     //     that.$cont.css('height'),
    //     //     that.$caption_bar.css('width')
    //     // );
    //     // EXAMPLE:  Text pop up 10.760767208223115 87.73450000000003 460.781 prose 1.3039538714991763
    //     //           192px 80px 1538.6766070994775 auto 1583 741 34 50.39300000000003 1.3039538714991763 1.5753187309861578 Number String
    //     //           10.7608px 87.7345px 1561.47px 593.938px 1545.48px
    //
    //
    //
    //     //// Animate
    //
    //     deanimate("popping up quote", that.id_attribute);
    //
    //     var thumb_cont = Contribution.from_idn(that.idn);
    //
    //     // NOTE:  Popup text elements are now are at their FINAL place and size.
    //     //        But nobody has seen that yet.
    //     //        Get stats on them before reverting everything to its STARTING place and size,
    //     //        for the animation.
    //
    //     var pop_cont_css_width = that.$cont.css('width');
    //     var pop_cont_css_height = that.$cont.css('height');
    //     var pop_caption_css_width = that.$caption_bar.css('width');
    //     var pop_up_caption_background = that.$caption_bar.css('background-color');
    //     var pop_down_caption_background;
    //     if (thumb_cont.is_dom_rendered()) {
    //         pop_down_caption_background = thumb_cont.$caption_bar.css('background-color');
    //     } else {
    //         pop_down_caption_background = 'rgba(0,0,0,0)';
    //         // TODO:  replace transparent final ''color'' with background of .unrendered?
    //     }
    //
    //     that.$cont.css('width', cont_css_width);
    //     that.$cont.css('height', cont_css_height);
    //     // NOTE:  jQuery animation seems to need the STARTING point to be set via .css(),
    //     //        not .width() and .height()
    //
    //     that.fix_caption_width();
    //     that.$caption_bar.css('background-color', pop_down_caption_background);
    //     that.$sup.css(thumb_cont.css_for_position_fixed());
    //     that.$cont.css('font-size', font_size_normal);
    //
    //     var sup_promise = that.$sup.animate({
    //         top: sup_top,
    //         left: sup_left
    //     }, {
    //         duration: POP_UP_ANIMATE_MS,
    //         easing: POP_UP_ANIMATE_EASING,
    //         queue: false
    //     }).promise();
    //
    //     var cont_promise = that.$cont.animate({
    //         width: pop_cont_css_width,
    //         height: pop_cont_css_height,
    //         'font-size': font_size_setting
    //     }, {
    //         duration: POP_UP_ANIMATE_MS,
    //         easing: POP_UP_ANIMATE_EASING,
    //         queue: false,
    //         complete: function popup_text_contribution_complete() {
    //             that.$cont.width(cont_width_setting);   // because animate chokes on 'auto'
    //             that.$cont.height(cont_height_setting);
    //         }
    //     }).promise();
    //
    //     var caption_promise = that.$caption_bar.animate({
    //         width: pop_caption_css_width,
    //         'background-color': pop_up_caption_background
    //         // TODO:  Use .fadeIn() or .fadeOut(), to wean from jQuery UI
    //     }, {
    //         duration: POP_UP_ANIMATE_MS,
    //         easing: POP_UP_ANIMATE_EASING,
    //         queue: false,
    //         complete: function popup_text_caption_complete() {
    //             that.fix_caption_width();
    //         }
    //     }).promise();
    //
    //     var screen_promise = pop_screen_fade_in().promise();
    //
    //     var combined_promise = $.when(
    //         sup_promise,
    //         cont_promise,
    //         caption_promise,
    //         screen_promise
    //     );
    //     combined_promise.done(function popup_animation_done() {
    //         then();
    //     });
    // };

    function pop_screen_down_fade_out() {   // while popping down, fade and then hide the screen
        // return pop_screen_fade(
        //     'rgba(0,0,0,0.25)',
        //     'rgba(0,0,0,0.00)',
        //     POP_DOWN_ANIMATE_MS,
        //     POP_DOWN_ANIMATE_EASING,
        //     function () {
        //         // $('#popup-screen').hide();
        //     }
        // )
        var $pop_screen = $('#popup-screen');
        return $pop_screen.fadeOut({
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false,
            done: function () {
                $pop_screen.hide();
            }
        });
    }

    function pop_screen_up_fade_in() {   // while popping up a cont, fade in a screen behind it
        // $('#popup-screen').show();
        // return pop_screen_fade(
        //     'rgba(0,0,0,0.00)',
        //     'rgba(0,0,0,0.25)',
        //     POP_UP_ANIMATE_MS,
        //     POP_UP_ANIMATE_EASING,
        //     function () {
        //     }
        // )
        var $pop_screen = $('#popup-screen');
        $pop_screen.hide();
        return $pop_screen.fadeIn({
            duration: POP_UP_ANIMATE_MS,
            easing: POP_UP_ANIMATE_EASING,
            queue: false
        });
        // THANKS:  .fadeIn() requires .hide(), https://stackoverflow.com/a/3398905/673991
        //          .hide() may be redundant here but doing it anyway in case it's ever not.
        // THANKS:  Starting opacity at zero would make more sense, since that is the property
        //          animated by .fadeIn(), but that does NOT appear to work,
        //          https://stackoverflow.com/q/3398882/673991#comment69712297_3398905
    }

    // function pop_screen_fade(from_color, to_color, duration, easing, always) {
    //     // CAUTION:  This requires the jQuery-UI plugin (or the color plugin)
    //     //           Otherwise colors won't animate!
    //     //           Use jQuery .fadeIn() instead?
    //     var $pop_screen = $('#popup-screen');
    //     $pop_screen.css({'background-color': from_color});
    //     $pop_screen.animate({
    //         'background-color': to_color
    //         // DONE:  Use .fadeIn() or .fadeOut(), to wean from jQuery UI
    //     }, {
    //         duration: duration,
    //         easing: easing,
    //         queue: false,
    //         always: always
    //     });
    //     return $pop_screen;
    // }

    /**
     * Finish up all animations.
     *
     * @param {string} context - some string about what we're doing
     * @param {string} what - more info
     */
    function deanimate(context, what) {
        $(':animated').each(function () {
            var $element = $(this);
            $element.finish();
            // NOTE:  Don't use mf-ing jQuery .finish(), callbacks are NOT "immediately called".
            $element.stop(true, true);
            var deanimating_cont = ContributionWord.from_element($element);
            if (is_specified(deanimating_cont)/* && deanimating_cont.is_dom_rendered()*/) {
                console.warn(
                    "Deanimating",
                    context,
                    what,
                    deanimating_cont.id_attribute,
                    $element.attr('class') || "(no class)"
                );
            } else {
                console.warn(
                    "Deanimating",
                    context,
                    what,
                    "SOME ELEMENT",
                    $element.attr('id') || "(no id)",
                    $element.attr('class') || "(no class)"
                );
            }
        });
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

    /**
     * Create a word in a lex, associated with a jQuery element.
     *
     * @param $div
     * @param what - "contribution" or "caption"
     * @param vrb_name - 'edit' or 'caption'
     * @param obj
     * @param then
     * @param fail
     *
     * Aux output is $div.attr('id'), the idn of the new word.
     */
    function edit_submit($div, what, /*vrb,*/ vrb_name, obj, then, fail) {
        var new_text = text_from_$($div);   // was $div.text();
        // TODO:  Why doesn't this remove leading or trailing newlines from an edited caption?
        if ($div.data('unedited_text') === new_text) {
            console.log("(skipping", what, "save,", new_text.length, "characters unchanged)");
            then(null);
        } else {
            lex.create_word(
                vrb_name,
                {
                    contribute: obj,
                    text: new_text
                },
                function (caption_or_edit_word) {
                    $div.text(new_text);
                    console.log("Saved", what, caption_or_edit_word.idn);
                    $div.attr('id', caption_or_edit_word.idn);
                    then(caption_or_edit_word);
                },
                fail
            );
            // qoolbar.sentence({
            //     vrb_idn: vrb,
            //     obj_idn: obj,
            //     txt: new_text
            // }, function sentence_created(edit_word) {
            //     // console.log("Saved", what, edit_word.idn);
            //     // $div.attr('id', edit_word.idn);
            //     //
            //     // // contribution_lexi.word_pass(edit_word);   // TODO:  .edit_word() or .caption_word()
            //     // // // NOTE:  This may let through a cont edit without a capt edit.
            //     //
            //     // then(edit_word);
            // }/*, fail*/);
        }
    }

    /**
     * Extract text from a jQuery object or selector.  Honor <br> as \n and <p> as \n\n, etc.
     *
     * Helps when pasting text into a contribution being edited.
     * For example, pasting from poem-a-day email turned foo<br>bar into foobar using plain .text().
     *
     * THANKS:  loosely based on html-to-text code in https://stackoverflow.com/a/50822488/673991
     * THANKS:  DOMParser parsing, https://stackoverflow.com/a/42254787/673991
     *
     * @param selector - raw html, DOM, jQuery, or anything that could be passed to $()
     */
    function text_from_$(selector) {
        var html = $(selector).html();
        html = html.replace(/<br/g,    "\n<br");
        html = html.replace(/<table/g, "\n<table");
        html = html.replace(/<tr/g,    "\n<tr");
        html = html.replace(/<td/g,    "\n<td");
        html = html.replace(/<p/g,     "\n\n<p");
        html = html.replace(/<div/g,   "\n\n<div");
        html = html.replace(/<h/g,     "\n\n<h");

        // TODO:  Possibly briefer version:
        //        html = html.replace(/<(br|table|tr|td)\b/g, "\n<$1");
        //        html = html.replace(/<(p|div|h)\b/g,      "\n\n<$1");

        var html_document = '<!doctype html><body>' + html;
        var dom_document = (new DOMParser()).parseFromString(html_document, 'text/html');
        var text = dom_document.body.textContent;
        text = text.trim();
        return text;
    }
    assert_equal("foo\nbar", text_from_$("<span>foo<br>bar</span>"));

    if (DO_LONG_PRESS_EDIT) {
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
    }

    // TODO:  Contribution method -- or maybe not, since editing applies to one instance at a time.
    //        Though it does belong with the $sup and $cont etc. fields because it's all about DOM.
    function contribution_edit_begin($cont) {
        if ( ! check_contribution_edit_dirty(true, true)) {
            // NOTE:  The above call may never have any side effects (and this branch is always
            //        taken) because all edit buttons are invisible whenever an edit is in progress.
            //        That invisibility hinges on the .dirty-nowhere selector in contribution.css.
            contribution_edit_show($cont);
            is_editing_some_contribution = true;
            $cont.data('unedited_text', $cont.text());
            var $sup = $cont.closest('.sup-contribution');
            var $caption_span = $sup.find('.caption-span');
            $caption_span.data('unedited_text', $caption_span.text());
            $cont_editing = $cont;
        }
    }

    // TODO:  Contribution method
    function contribution_edit_end() {   // save, cancel, discard
        if (is_editing_some_contribution) {
            is_editing_some_contribution = false;
            $('.edit-dirty').removeClass('edit-dirty');
            $(window.document.body).addClass('dirty-nowhere');
            contribution_edit_hide($cont_editing);
            var $caption_span = $cont_editing.closest('.sup-contribution').find('.caption-span');
            $cont_editing.removeData('unedited_text');
            $caption_span.removeData('unedited_text');

            var cont = ContributionWord.from_element($cont_editing);
            cont.resizer_nudge();
            cont.zero_iframe_recover();
            // NOTE:  A crude response to the occasional zero-height or zero-width contribution
            //        lurking inside an as-yet unopened category.

            $cont_editing = null;
        }
    }

    // TODO:  Contribution method
    function contribution_edit_show($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.addClass('contribution-edit');
        $cont.prop('contentEditable', true);
        $caption_span.prop('contentEditable', true);
        var cont = ContributionWord.from_element($cont);
        cont.fix_caption_width();
    }

    // TODO:  Contribution method
    function contribution_edit_hide($cont) {
        var $sup_cont = $cont.closest('.sup-contribution');
        var $caption_span = $sup_cont.find('.caption-span');
        $sup_cont.removeClass('contribution-edit');
        $cont.prop('contentEditable', false);
        $caption_span.prop('contentEditable', false);
        var $save_bar = $save_bar_from_cont($cont);
        $save_bar.removeClass('abandon-alert');
        var cont = ContributionWord.from_element($cont);
        cont.fix_caption_width();
    }

    // TODO:  Will become obsolete because callers can use .$save_bar property.
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
            } else {
                console.error("Unable to capture pasted data.", evt);
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
                        console.log(String(index) + ".", item.kind, item.type);
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
            lex.cont_loop(function (cont) {
                // TODO:  Instead, pass a category filter to Contribution_loop() for my-category.
                // if (cont.content === contribution_text && cont.is_my_category) {
                // if (cont.content === contribution_text && cont.is_cat(MONTY.IDN.CAT_MY)) {
                // if (cont.content === contribution_text && cont.cat.txt === 'my') {
                if (cont.obj.text === contribution_text && cont.cat === lex.cats.by_name.my) {
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
                //        1. The .contribution element itself is display:none for media.
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
                    // EXAMPLE:  (no matching providers found)
                    //           https://www.youtube.com/watch?time_continue=2&v=dQw4w9WgXcQ&feature=emb_logo
                    // TODO:  Find some way other than noembed to get the video caption?
                    //        This URL comes from clicking the YouTube logo on an embedded video.
                    // THANKS:  https://www.reddit.com/r/youtube/comments/88z1c8/_/dwo6mqk/
                } else if (is_title_usable) {
                    oembed_object.caption_for_media = oembed_object.title;
                } else if (is_author_usable) {
                    oembed_object.caption_for_media = oembed_object.author_name;
                } else {
                    oembed_object.caption_for_media = "(neither title nor author)";
                }
                var limited_caption = oembed_object.caption_for_media.substr(0, MAX_OEMBED_CAPTION_LENGTH);
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
     * parameters ... any number of string, jQuery, HTMLElement
     * @return {jQuery}
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
        return {
            animation: 150,
            group: 'contributions',
            handle: '.grip',
            ghostClass: 'drop-hint',
            draggable: '.sup-contribution',
            onMove: function sortable_dragging(evt) {
                var target_candidate = evt.related;
                if (is_in_popup(target_candidate)) {
                    console.error("Whoa that's a popup, don't drag me here bro.");
                    return MOVE_CANCEL;
                }
                var cat = CategoryWord.from_element(target_candidate);
                if (cat === null) {
                    console.error("Unexpected drop candidate outside any category", evt);
                }
                if (is_in_frou(target_candidate)) {
                    if (cat.valve.is_open()) {
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
                if (cat === lex.cats.by_name.about) {
                    if ( ! lex.am_i_admin()) {
                        // NOTE:  Only the admin will be able to move TO the about section.
                        return MOVE_CANCEL;
                    }
                }
                if (cat === lex.cats.by_name.anon) {
                    // TODO:  Instead of this clumsiness, don't make the anon category
                    //        into a functional .category.  Just make it look like one with info.
                    //        Or go ahead and make it a Category object, but instantiate it
                    //        "with anon characteristics".
                    if ( ! lex.am_i_authenticated()) {
                        // NOTE:  Anonymous users can't interact with other anonymous content.
                        return MOVE_CANCEL;
                    }
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
                var movee_cont = ContributionWord.from_element(evt.item);

                var from_cat = CategoryWord.from_element(evt.from);
                if (from_cat === null) {
                    console.error("Unexpected drop from outside any category", evt);
                }
                var to_cat = CategoryWord.from_element(evt.to);
                if (to_cat === null) {
                    console.error("Unexpected drop to outside any category", evt);
                }

                if (is_in_frou(evt.to)) {   // drop into a closed category -- place all the way left
                    console.log(
                        "Frou drop", to_cat.obj.text,
                        "where cont", dom_from_$($movee).id,
                        "goes into cat", to_cat.idn
                    );
                    // locate_contribution_at_category_left_edge($cat_of(evt.to), $movee);
                    to_cat.insert_left(movee_cont);
                }

                // NOTE:  buttee means the contribution shoved over to the right, if any
                var $buttee = $movee.nextAll('.sup-contribution');
                var buttee_idn;
                var buttee_txt_excerpt;
                if ($buttee.length === 0) {
                    buttee_idn = lex.idn_of.rightmost;   // this means the empty place to the right of them all
                    buttee_txt_excerpt = "[right edge]";
                } else {
                    // FALSE WARNING:  Argument type string is not assignable to parameter type
                    //                 (this:void, value: any, index: number, obj: any[]) => boolean
                    // noinspection JSCheckFunctionSignatures
                    var $cont_buttee = $buttee.find('.contribution');
                    buttee_idn = $cont_buttee.attr('id');
                    buttee_txt_excerpt = $cont_buttee.text().substr(0, 20) + "...";
                }
                console.log(
                    "rearranged contribution", movee_cont.idn,
                    "from", from_cat.obj.text + "#" + String(evt.oldDraggableIndex),
                    "to", to_cat.obj.text + "#" + String(evt.newDraggableIndex),
                    "butting in before", buttee_idn, buttee_txt_excerpt
                );
                var is_same_category = from_cat.idn === to_cat.idn;
                var is_same_contribution = evt.newDraggableIndex === evt.oldDraggableIndex;
                if (is_same_category && is_same_contribution) {
                    console.log("(put back where it came from)");
                } else {
                    lex.create_word('rearrange', {
                        category: to_cat.idn,
                        contribute: movee_cont.idn,
                        locus: parseInt(buttee_idn)
                    }, function rearrange_done(word) {
                        console.debug("Rearrange word", word);
                        // EXAMPLE:  Rearrange word {
                        //     idn: 7510,
                        //     whn: 1633523666800,
                        //     user: Array(2) [167, '103620384189003122864'],
                        //     vrb: 202,
                        //     contribute: 4685,
                        //     category: 1435,
                        //     locus: 7126
                        // }
                        settle_down();
                        lex.assert_consistent();
                    }, function rearrange_fail(message) {
                        console.error("REARRANGE FAIL", message);
                        revert_drag();
                        lex.assert_consistent();
                    });
                }

                function revert_drag() {
                    var $from_cat = $(evt.from);
                    $movee.detach();   // so as to simplify the numbering for where to put it back.
                    var $from_neighbor = $from_cat.find('.sup-contribution').eq(evt.oldDraggableIndex);
                    if ($from_neighbor.length === 1) {
                        console.warn("Revert to before", first_word($from_neighbor.text()));
                        $from_neighbor.before($movee);
                        // SEE:  later_stillness.before(earlier_motion),
                        //       With .before(), the content to be inserted comes from the method's
                        //       argument: $(target).before(contentToBeInserted).
                    } else {
                        console.warn("Revert to end of category", from_cat.idn);
                        $from_cat.append($movee);
                    }
                }
            }
        };
    }
    //
    // function create_word(vrb_name, named_sub_nits, done_callback, fail_callback) {
    //     done_callback = done_callback || function () {};
    //     fail_callback = fail_callback || function (message) { console.error(message); };
    //     qoolbar.post(
    //         'create_word',
    //         {
    //             vrb_name: vrb_name,
    //             named_sub_nits: JSON.stringify(named_sub_nits)
    //         },
    //         /**
    //          * Handle a valid response from the create-word ajax.
    //          *
    //          * @param response_object
    //          * @param response_object.jsonl - JSON of array of the created word's bytes and nits.
    //          */
    //         function create_word_maybe_done(response_object) {
    //             var word_jsonl = response_object.jsonl;
    //             var word_decoded = word_decode(word_jsonl);
    //             if (word_decoded === false) {
    //                 fail_callback("JSONL error");
    //             } else {
    //                 done_callback(word_decoded);
    //             }
    //         },
    //         fail_callback
    //     );
    // }

    // function contributions_becoming_visible_for_the_first_time_maybe() {
    //     initial_thumb_size_adjustment();
    //     // resizer_nudge('.render-bar iframe');
    //     resizer_nudge_all();
    // }
    //
    // function new_contribution_just_created() {
    //     initial_thumb_size_adjustment();
    // }
    //
    // function new_rendering_of_a_contribution() {
    //     initial_thumb_size_adjustment();
    // }

    /**
     * Contribution thumbnails must be fiddled with by JavaScript once.
     */
    function initial_thumb_size_adjustment() {
        $('.size-adjust-once:visible').each(function () {
            // NOTE:  Only visible, rendered contributions should be size-adjusted.

            var $element = $(this);
            $element.removeClass('size-adjust-once');

            thumb_size_adjust($element);
            // TODO:  Omg, is this only adjusting text quote sizes?  Guess that has value in valve()
            //        Also caption needs fixing after valve() expands a category for the first time.
            //        But this is the only place where this code calls thumb_size_adjust(), so
            //        surely simplification is possible...

            // console.debug("Init", Contribution_from_element($element).id_attribute);
            // var cont = Contribution_from_element($element);
            // if (cont === null) {
            //     console.error("Visible but not in DOM??", cont);
            // } else if ( ! cont.is_dom_rendered()) {
            //     console.error("Visible but not rendered??", cont);
            // } else {
            //     if (cont.is_media && ! cont.is_noembed_error) {
            //         var width_cont = cont.$render_bar.outerWidth();
            //         width_cont = Math.max(width_cont, px_from_rem(WIDTH_MAX_EM.hard));
            //         cont.$cont.outerWidth(width_cont);
            //         // console.debug("Fudge", cont.id_attribute, width_cont);
            //         // NOTE:  So editing a media contribution shows the URL in the same width
            //         //        as the thumbnail.  Just do this once.
            //
            //         // function is_save_bar_too_wide() {
            //         //     return cont.$save_bar.outerWidth() > cont.$render_bar.outerWidth();
            //         // }
            //         // if (is_save_bar_too_wide()) {
            //         //     console.debug("Too wide", cont.id_attribute, cont.caption_text);
            //         //     cont.$save_bar.find('.expand .wordy-label').hide();
            //         //     // NOTE:  Try hiding "expand" first.  If still not enough hide "play" too.
            //         //     if (is_save_bar_too_wide()) {
            //         //         console.debug("Too too wide");
            //         //         cont.$save_bar.find('.play .wordy-label').hide();
            //         //     }
            //         // }
            //         // NOTE:  The above was a nice idea, hiding "expand" then "play" if needed for space.
            //         //        But it will have to wait until we get desperate enough
            //         //        to defer this function call until the render bar is fully loaded.
            //         //        Which would probably be a good idea someday anyway.
            //     }
            // }
            // NOTE:  This was overwrought.  Just make the URL editing MAX.soft wide.
            //        And that was done in render_media() before we got here.  (Or render_error().)
        });
    }

    // TODO:  Make Contribution method?
    function thumb_size_adjust(element_or_selector) {
        var cont = ContributionWord.from_element(element_or_selector);
        if (cont.is_media) {
            // if (cont.is_noembed_error) {
            //     size_adjust(cont.$render_bar, cont.cat.thumb_specs.for_width, cont.cat.thumb_specs.for_height);
            //     console.debug("Adjust noembed error", cont.$render_bar.width(), cont.$render_bar.height());
            // } else {
            //     // cont.$cont.outerWidth(cont.$render_bar.outerWidth());
            // }
        } else {
            size_adjust(cont.$cont, cont.cat.thumb_specs.for_width, cont.cat.thumb_specs.for_height);
            // console.debug("Adjust quote", cont.$cont.width(), cont.$cont.height());
        }
        cont.fix_caption_width();

        // var $target = cont.is_media ?  : cont.$cont;
        // if (cont.is_about_category) {
        //     // DONE:  Make this distinction when the categories are instantiated.
        //     //        Then here defer to something in the cont.cat object.
        //     size_adjust($target, WIDTH_MAX_EM_ABOUT, HEIGHT_MAX_EM_ABOUT);
        // } else {
        //     size_adjust($target, WIDTH_MAX_EM, HEIGHT_MAX_EM);
        // }
    }

    js_for_unslumping.thumb_size_adjust = thumb_size_adjust;   // for console use

    // TODO:  Contribution method
    function resizer_nudge_all() {
        $('.sup-contribution').each(function () {
            var cont = ContributionWord.from_element(this);
            if (cont.is_dom_rendered() && cont.is_media) {
                cont.resizer_nudge();
                cont.zero_iframe_recover();
                // NOTE:  Reload any zero-width or zero-height iframe, a workaround for an
                //        apparent bug in iFrameResizer.  Or just bad internet.
            }
        });
    }

    function size_adjust($element, width_max_em, height_max_em) {
        var width_em = size_adjust_each($element, 'width', width_max_em);
        // NOTE:  Width before height, so paragraph wrap.
        var height_em = size_adjust_each($element, 'height', height_max_em);
        return {
            width_em: width_em,
            height_em: height_em
        };
    }

    function size_adjust_each($element, dimension, max_em) {
        $element[dimension]('auto');
        var natural_px = $element[dimension]();
        var natural_em = em_from_px(natural_px, $element);
        var adjusted_em;
        if (natural_em <= max_em.hard) {
            adjusted_em = null;
            if (DEBUG_SIZE_ADJUST) console.log (
                "Easy", dimension, first_word($element.text()),
                natural_em.toFixed(0)
            );
        } else if (natural_em < max_em.extreme) {
            adjusted_em = max_em.hard;
            if (DEBUG_SIZE_ADJUST) console.log(
                "Hard", dimension, first_word($element.text()),
                adjusted_em.toFixed(0), "<-", natural_em.toFixed(0)
            );
        } else {
            adjusted_em = max_em.soft;
            if (DEBUG_SIZE_ADJUST) console.log(
                "Soft", dimension, first_word($element.text()),
                adjusted_em.toFixed(0), "<=", natural_em.toFixed(0)
            );
        }
        if (adjusted_em !== null) {
            set_em($element, dimension, adjusted_em);
        }
        return adjusted_em || natural_em;
    }

    function set_em($element, dimension, em) {
        var property = {};
        property[dimension] = em.toFixed(2) + 'rem';
        $element.css(property);
    }

    function px_from_rem(em) {
        return px_from_em(em, window.document.body);
    }

    function px_from_em(em, element) {
        console.assert(is_specified(element));
        return em * parseFloat($(element).css('font-size'));
    }

    function em_from_px(px, $element) {
        $element = $element || $(window.document.body);
        return px / parseFloat($element.css('font-size'));
    }

    // /**
    //  * Move or store a contribution to the left edge of a category.
    //  *
    //  * Works to either move a sup-contribution, or store it for the first time, in the DOM.
    //  *
    //  * @param {jQuery} $cat - e.g. $categories[MONTY.IDN.CAT_MY]
    //  * @param {jQuery} $movee - e.g. Contribution('1461')
    //  */
    // function locate_contribution_at_category_left_edge($cat, $movee) {
    //     var $container_entry = $cat.find('.container-entry');
    //     if ($container_entry.length > 0) {
    //         // Drop after contribution entry form (the one in 'my' category))
    //         $container_entry.last().after($movee);
    //     } else {
    //         // drop into any other category, whether empty or not
    //         $cat.prepend($movee);
    //     }
    //     // THANKS:  https://www.elated.com/jquery-removing-replacing-moving-elements/
    //     //          'While there are no specific jQuery methods for moving elements around the DOM
    //     //          tree, in fact it's very easy to do. All you have to do is select the element(s)
    //     //          you want to move, then call an "adding" method such as append()'
    // }

    // /**
    //  * Is this element being dropped in an open-valved category?
    //  *
    //  * @param element
    //  * @return {boolean}
    //  */
    // function is_open_drop(element) {
    //     var cat = Category.from_element(element);
    //     var cat_idn = $cat_of(element).attr('id');
    //     var cat_txt = Category_from_idn(parseInt(cat_idn)).txt;
    //     // var is_open = get_valve($_from_id(id_valve(cat_txt)));
    //     var is_open = cat.valve.is_open();
    //     return is_open;
    // }

    // /**
    //  * What's the div.category element for this element inside it?
    //  *
    //  * @param element - any element inside div.sup-category
    //  * @return {jQuery} - the div.category element
    //  */
    // function $cat_of(element) {
    //     var $sup_category = $(element).closest('.sup-category');
    //     if ($sup_category.length === 0) {
    //         console.error("How can it not be in a sup-category!?", element);
    //         return null;
    //     }
    //     var $cat = $sup_category.find('.category');
    //     return $cat;
    // }

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
        var $enter_some_text = $('#enter_some_text');
        var $enter_a_caption = $('#enter_a_caption');
        var text = $enter_some_text.val();
        var caption_text = $enter_a_caption.val();
        if (text.length === 0) {
            $enter_some_text.focus();
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

            // TODO:  Use edit_submit() or something like it here?
            lex.create_word(
                'contribute',
                {
                    text: text
                },
                function post_contribute_done(cont_word) {
                    console.log("contribution", cont_word);
                    if (caption_text.length === 0) {
                        build_posted_contribution(cont_word);
                    } else {
                        lex.create_word(
                            'caption',
                            {
                                contribute: cont_word.idn,
                                text: caption_text
                            },
                            function post_caption_done(capt_word) {
                                if (is_specified(capt_word)) {
                                    console.log("caption", capt_word);
                                }
                                build_posted_contribution(cont_word);
                            },
                            failed_post
                        );
                    }
                },
                failed_post
            );
            // var cont_sentence = {
            //     // vrb_idn: MONTY.IDN.CONTRIBUTE,
            //     // obj_idn: MONTY.IDN.QUOTE,
            //     vrb_idn: contribution_lexi.idn_of.contribute,
            //     obj_idn: OBJECT_IDN_FOR_CONTRIBUTION,
            //     txt: text
            // };
            // qoolbar.sentence(
            //     cont_sentence,
            //     function post_it_done_1(cont_word) {
            //         // console.log("contribution", cont_word);
            //         if (caption_text.length === 0) {
            //             // build_posted_contribution(cont_word, null);
            //         } else {
            //             var capt_sentence = {
            //                 // vrb_idn: MONTY.IDN.CAPTION,
            //                 vrb_idn: contribution_lexi.idn_of.caption,
            //                 obj_idn: cont_word.idn,
            //                 txt: caption_text
            //             };
            //             qoolbar.sentence(
            //                 capt_sentence,
            //                 function post_it_done_2(capt_word) {
            //                     // // NOTE:  contribution_word and caption_word may be missing the
            //                     // //        was_submitted_anonymous attribute, as exists in MONTY.w[]
            //                     // //        but is not fed back via ajax here.
            //                     // if (is_specified(capt_word)) {
            //                     //     console.log("caption", capt_word);
            //                     //     // contribute_word.jbo = [caption_word];
            //                     // }
            //                     // build_posted_contribution(cont_word, capt_word);
            //                 }/*,
            //                 failed_post*/
            //             );
            //         }
            //     }/*,
            //     failed_post*/
            // );
        }

        function build_posted_contribution(cont) {
            // var $sup_cont = build_contribution_dom(cont_word, capt_word);
            // contribution_lexi.contribute_word(cont_word);
            // contribution_lexi.caption_word(capt_word);
            // if (cont_word !== null) {
            //     contribution_lexi.word_resolve(cont_word);
            //     contribution_lexi.word_handle(cont_word);
            // }
            // if (capt_word !== null) {
            //     contribution_lexi.word_resolve(capt_word);
            //     contribution_lexi.word_handle(capt_word);
            // }

            // var cont = lex.cont_from_idn(cont_word.idn);
            cont.build_dom();
            
            // categories.by_name.my.insert_left(cont);
            // NOTE:  Already done by create_word() -- NO IT WAS NOT!!!
            cont.cat.insert_left(cont);
            // NOTE:  Contribution already knows it's in the 'my' category because LexContribution
            //        .contribute_word() calls .starting_cat() and puts it there.


            // NOTE:  From this point on, the new contribution is in the DOM.

            $enter_some_text.val("");
            $enter_a_caption.val("");
            post_it_button_appearance();

            cont.rebuild_bars(function () {
                settle_down();
                lex.assert_consistent();
            });
        }
    }

    /**
     * Build the body from scratch.
     */
    // TODO:  Faster bypassing jQuery, https://howchoo.com/g/mmu0nguznjg/
    //        learn-the-slow-and-fast-way-to-append-elements-to-the-dom
    function build_body_dom() {
        $(window.document.body).empty();
        // FIXME:  This obliterates all <script> elements, which are at the end of the body element.
        //         Yet they seem to continue to run fine on Win/Chrome.
        //         Including jQuery and MONTY and THIS contribution.js script and a bunch of others!
        //         But is that a problem for some other browser??
        //         Should we instead empty and append a div within body?
        //         Or put the js in the header?
        //         What good is it in the body if the page is all JavaScript generated?

        $(window.document.body).addClass('dirty-nowhere');

        // var $up_top_spacer = $('<div>', { id: 'up-top-TOP_SPACER_REM' });
        // // NOTE:  #up-top-spacer is a position:static element that takes one for the "team" of other
        // //        position:static elements (which begin with .sup-category-first).
        // //        It is hidden under the position:fixed #up-top element, so the "team" is not.
        var $up_top = $('<div>', { id: 'up-top' });
        // $(window.document.body).append($up_top_spacer);
        $(window.document.body).append($up_top);

        var $status_prompt = $('<div>', { id: 'status-prompt' });
        $status_prompt.text("");
        var conts_we_are_limited_to = cont_array_from_query_string();
        if (conts_we_are_limited_to !== null) {
            $status_prompt.append("contribution " + conts_we_are_limited_to.join(", ") + " - ");
            $status_prompt.append($('<a>', { href: url_with_no_query_string() }).text("see all"));
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
            .append($('<option>', {value: PLAY_BOT_FROM_MY}))       // .text("from my playlist"))
            .append($('<option>', {value: PLAY_BOT_FROM_OTHERS}))   // .text("from others playlist"))
        );
        $bot.append($('<select>', {id: 'play_bot_speech'})
            .append($('<option>', {value: PLAY_BOT_SPEECH_OUT_LOUD}).text("quotes are spoken out loud"))
            .append($('<option>', {value: PLAY_BOT_SPEECH_ANIMATED}).text("quotes are silently animated"))
            .append($('<option>', {value: PLAY_BOT_SPEECH_OFF}).text("quotes are silent"))
        );
        $up_top.append($bot);

        var $login_prompt = $('<div>', {
            id: 'login-prompt',
            title: "your idn is " + JSON.stringify(lex.me_idn)
        });
        // EXAMPLE:  your idn is [167,"103620384189003122864"]
        $login_prompt.html(MONTY.login_html);
        $up_top.append($login_prompt);

        var $login_left = $('<div>', {id: 'top-right-blurb'});
        $up_top.append($login_left);

        // build_category_dom(me_title(),  categories.by_name.my.idn,    true, true);
        // build_category_dom("others",    categories.by_name.their.idn, true, true);
        // build_category_dom("anonymous", categories.by_name.anon.idn,  true, false);
        // build_category_dom("trash",     categories.by_name.trash.idn, true, false);
        // build_category_dom("about",     categories.by_name.about.idn, true, false);


        // category_rendering();
        lex.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
            cat.build_dom();
        });
        lex.cats.first().$sup.addClass('sup-category-first');

        var $entry = $('<div>', {'class': 'container-entry'});
        $entry.append($('<textarea>', {id: 'enter_some_text', placeholder: "enter a quote or video"}));
        $entry.append($('<input>', {id: 'enter_a_caption', placeholder: "and a caption"}));
        $entry.append($('<button>', {id: 'post_it_button'}).text("post it"));
        $entry.append($('<span>', {id: 'entry_feedback'}));
        // TODO:  Make global-ish variables.  E.g. $enter_some_text instead of $('#enter_some_text')
        // $categories[categories.by_name.my.idn].prepend($entry);
        lex.cats.by_name.my.$cat.prepend($entry);

        if ( ! lex.am_i_authenticated()) {
            var $anon_blurb = $('<p>', {id: 'anon-v-anon-blurb'}).text(ANON_V_ANON_BLURB);
            // $categories[categories.by_name.anon.idn].append($anon_blurb);
            // $sup_categories[categories.by_name.anon.idn].addClass('double-anon');
            lex.cats.by_name.anon.$cat.append($anon_blurb);
            lex.cats.by_name.anon.$sup.addClass('double-anon');
            // Anonymous users see a faded anonymous category with explanation.
        }

        // NOTE:  Now all categories have DOM objects, but they're not in the (visible) DOM yet.

        lex.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
            $(window.document.body).append(cat.$sup);
        });
        // NOTE:  Now the category DOM objects are a visible part of the DOM.

        var $popup_screen = $('<div>', { id: 'popup-screen' });
        $(window.document.body).append($popup_screen);

        refresh_labels_in_play_bot_from();
        // NOTE:  Must come after play_bot_from is in DOM.
        //        Must come after categories are countable.
        //        (I think that happens in ContributionsUnslump.word_pass().)



        // NOTE:  Categories are now in the DOM.
        //        Contribution objects are instantiated, but none are yet in the DOM.
        //        Everything below requires this.
        //        After this the Contribution constructor may be called.



        var $introductory_blurb = $('<p>', { id: 'introductory-blurb' }).append(INTRODUCTORY_BLURB);
        // if (num_contributions_in_category(categories.by_name.my.idn) === 0) {
        if (lex.cats.by_name.my.conts.num_words() === 0) {
            // $categories[categories.by_name.my.idn].append($introductory_blurb);
            lex.cats.by_name.my.$cat.append($introductory_blurb);
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
                // console.log("Media handler loaded:", handler.$script.attr('src'));
                // EXAMPLE:  Media handler loaded: http://localhost:5000/meta/static/code/media_youtube.js
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
                when_we_are_done_loading_handlers(function () {
                    lex.cats.loop(/** @param {CategoryWord} cat */ function (cat) {
                        var number_of_conts_to_show_initially;
                        var initial_cat_cont = parseInt(query_get(
                            INITIAL_CAT_CONT_QUERY,
                            INITIAL_CAT_CONT
                        ));
                        if (DO_WHOLE_UNRENDERED_PIECES) {
                            var total_num = cat.conts.num_words();
                            var unwhole_unrendered_num = total_num - initial_cat_cont;
                            var whole_unrendered_num = (
                                Math.floor(unwhole_unrendered_num / MORE_CAT_CONT) *
                                MORE_CAT_CONT
                            );
                            number_of_conts_to_show_initially = total_num - whole_unrendered_num;
                        } else {
                            number_of_conts_to_show_initially = initial_cat_cont;
                        }
                        cat.render_some_conts(number_of_conts_to_show_initially);
                        cat.show_unrendered_count();
                    });

                    // NOTE:  Now each category has at least some rendered contribution DOM objects.

                    lex.assert_consistent();
                });
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
            //       "...the example sets the src attribute after attaching the handler."
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
                String(num_loaded),
                "of",
                String(Object.keys(media_handlers).length),
                "media handlers loaded,",
                num_failed, "failed,",
                num_registered, "registered"
            );
        }, MEDIA_HANDLER_LOAD_CHECK_MS);
    }

    // function mem() {
    //     // THANKS:  Chrome-only memory stats, https://stackoverflow.com/a/9860215/673991
    //     // SEE:  Quantized stats, https://webplatform.github.io/docs/apis/timing/properties/memory/
    //     //       Avoid by running Chrome with --enable-precise-memory-info
    //     // NOTE:  Quantized or not, this number is VERY noisy and variable.
    //     if (
    //         window.performance &&
    //         window.performance.memory &&
    //         window.performance.memory.usedJSHeapSize
    //     ) {
    //         return window.performance.memory.usedJSHeapSize;
    //     } else {
    //         return 0;
    //     }
    // }

    /**
     * Regenerate the two option texts for the drop-down menu #play_bot_from.
     *
     * So they show the latest quantities.
     */
    function refresh_labels_in_play_bot_from() {
        var $select = $('#play_bot_from');
        looper(PLAY_BOT_FROM_STUFF, function (_, stuff) {
            var $option = $select.find('[value=' + $.escapeSelector(stuff.option_value) + ']');
            var cat = lex.cats.by_name[stuff.option_value];
            var num_cont = cat.conts.num_words();
            var formatted_label = f(stuff.label, {number: num_cont});
            // console.debug(stuff.option_value, formatted_label, cat_idn, num_cont);
            // EXAMPLE:  my from my playlist (76) 735 76
            $option.text(formatted_label);
        });
    }

    // TODO:  Move this to qiki.js
    window.qiki = window.qiki || {};
    window.qiki.media_register = function js_for_unslumping_media_register(media) {
        var $script = $(window.document.currentScript);
        console.assert($script.length === 1, "currentScript broke", window.document.currentScript);
        var handler_index = $script.data('handler-index');
        // TODO:  Point instead directly at handler object?
        console.assert(is_defined(handler_index), "handler-index broke", $script);
        var handler = media_handlers[handler_index];
        console.assert(is_defined(handler), "handler object broke", handler_index, media_handlers);
        if (is_defined(handler)) {
            // console.log("Media handler registered:", media.description_long);
            // EXAMPLE:  Media handler registered: noembed.com handler for qiki media applications
            handler.media = media;
            handler.did_register = true;
        }
    };

    function when_we_are_done_loading_handlers(then) {
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
            console.log("Media handlers", media_handlers);
            then();
        }
    }

    function does_query_string_allow(cont_idn) {
        var conts_were_limited_to = cont_array_from_query_string();
        if (conts_were_limited_to === null) {
            return true;
        } else if (has(conts_were_limited_to, String(cont_idn))) {
            return true;
        } else {
            console.log(f("Not rendering {cont_idn} - query-string has cont={conts_limited_to}", {
                cont_idn: cont_idn,
                conts_limited_to: query_get('cont')
            }));
            return false;
        }
    }

    function cont_array_from_query_string() {
        var cont_parameter_value = query_get('cont', null);
        if (cont_parameter_value === null) {
            return null;
        } else {
            return cont_parameter_value.split(',');
        }
    }

    function url_with_no_query_string() {
        return window.location.href.split('?')[0];
    }
    // TODO:  Instead, just strip the 'cont' variable from the query string.

    function augment_title_with_query_string_constraints() {
        var conts_were_limited_to = cont_array_from_query_string();
        if (conts_were_limited_to !== null) {
            window.document.title += " - " + conts_were_limited_to.join(", ");
        }
    }
    augment_title_with_query_string_constraints();

    function our_oembed_relay_url(parameters) {
        console.assert(is_associative_array(parameters), parameters);
        return MONTY.OEMBED_CLIENT_PREFIX + "?" + $.param(parameters);
        // THANKS:  jQuery query string, https://stackoverflow.com/a/31599255/673991
    }

    // /**
    //  * Get the txt for a word in the MONTY.w array, given its idn.
    //  *
    //  * @param idn
    //  * @returns {null}
    //  */
    // function monty_txt_from_idn(idn) {
    //     type_should_be(idn, Number);
    //     var return_txt = null;
    //     looper(MONTY.w, function (_, word) {
    //         if (word.idn === idn) {
    //             return_txt = word.txt;
    //             return false;
    //         }
    //     });
    //     return return_txt;
    // }

    // Category.prototype.build_dom = function Category_build_dom(title, is_initially_open) {
    //     var that = this;
    //     that.$sup = $('<div>', {'class': 'sup-category'});
    //     that.$sup.data('category-object', that);
    //
    //     var $title = $('<h2>', {'class': 'frou-category'});
    //     // NOTE:  "frou" refers to the decorative stuff associated with a category.
    //     //        In this case, that's just the <h2> heading,
    //     //        which contains the category valve (the open-close triangles).
    //     //        In a closed category, this frou is all we see,
    //     //        so we have to deal with dropping there.
    //
    //     // $title.append(title);
    //
    //     that.$sup.append($title);
    //     that.$cat = $('<div>', {id: that.idn, 'class': 'category'});
    //     that.$cat.addClass('category-' + that.txt);
    //     that.$sup.append(that.$cat);
    //     that.valve = new Valve({
    //         name: that.txt,
    //         is_initially_open: is_initially_open,
    //         on_open: function() {
    //             var doc_top = $(window).scrollTop();
    //             var doc_bottom = doc_top + $(window).height();
    //             var cat_top = that.$cat.offset().top;
    //             var cat_pixels_in_view = doc_bottom - cat_top;
    //             if (cat_pixels_in_view < MIN_OPEN_CATEGORY_VIEW) {
    //                 // NOTE:  Category is scrolled down too far, not enough content is visible.
    //                 dom_from_$(that.$sup).scrollIntoView({
    //                     block: 'nearest',
    //                     inline: 'nearest'
    //                 });
    //                 doc_top = $(window).scrollTop();
    //                 var sup_top = that.$sup.offset().top;
    //                 var cat_pixels_above_browser_top = doc_top - sup_top;
    //                 var cat_pixels_above_up_top = cat_pixels_above_browser_top + TOP_SPACER_PX;
    //                 if (cat_pixels_above_up_top > 0) {
    //                     // NOTE:  Category is scrolled up too far, underneath #up-top.
    //                     window.scrollBy(0, - TOP_SPACER_PX);
    //                 }
    //             }
    //         }
    //     });
    //     var $valve = that.valve.$valve;
    //     $title.prepend($valve);   // triangles go BEFORE the heading text
    //
    //     $valve.append(title);
    //     // NOTE:  Include title inside valve element, so clicking the word opens and closes,
    //     //        along with the triangle symbols.
    //
    //     var $how_many = $('<span>', {'class': 'how-many'});
    //     $valve.append($how_many);   // (n) anti-valve goes AFTER the heading text
    //     // NOTE:  Number is clickable to expand also.
    //
    //     that.valve.control(that.$cat, $how_many);
    //     var $unrendered = $('<div>', {'class': 'unrendered'});
    //     // NOTE:  Until show_unrendered_count() is called, this element's 'count' data
    //     //        will remain unspecified.
    //     that.$cat.append($unrendered);
    // }

    // Contribution.prototype.build_dom = function Contribution_build_dom(txt) {
    //     var that = this;
    //
    //     var $sup = $('<div>', {'class': 'sup-contribution word size-adjust-once'});
    //     that.dom_link($sup);
    //
    //     var $cont = $('<div>', {'class': 'contribution', id: that.id_attribute});
    //     that.$sup.append($cont);
    //     console.assert(that.$cont.is($cont));
    //
    //     // that.$cont.text(leading_spaces_indent(that.unrendered_content));
    //     // // TODO:  Should the .content property getter change those leading spaces back?
    //     // that.unrendered_content = null;
    //     // // NOTE:  Conceivably save memory by MOVING the contribution text, instead of copying.
    //
    //     that.$cont.text(leading_spaces_indent(txt));
    //
    //     var $render_bar = $('<div>', {'class': 'render-bar'});
    //     var $caption_bar = $('<div>', {'class': 'caption-bar'});
    //     var $save_bar = $('<div>', {'class': 'save-bar'});
    //     $save_bar.append($('<button>', {'class': 'edit'}).text("edit"));
    //     $save_bar.append($('<button>', {'class': 'cancel'}).text("cancel"));
    //     $save_bar.append($('<button>', {'class': 'save'}).text("save"));
    //     $save_bar.append($('<button>', {'class': 'discard'}).text("discard"));
    //     $save_bar.append(
    //         $('<button>', {
    //             'class': 'expand',
    //             title: "expand"
    //         })
    //             .append($icon('fullscreen'))
    //             .append($('<span>', {'class': 'wordy-label'}).text(" bigger"))
    //     );
    //     $save_bar.append(
    //         $('<button>', {'class': 'play'})
    //             .append($icon('play_arrow'))
    //             .append($('<span>', {'class': 'wordy-label'}).text(" play"))
    //     );
    //     var $external_link = $('<a>', {'class': 'external-link among-buttons'});
    //     $external_link.append($icon('launch'))
    //     $save_bar.append($external_link);
    //
    //     that.$sup.append($render_bar);
    //     that.$sup.append($caption_bar);
    //     that.$sup.append($save_bar);
    //
    //     var $grip = $('<span>', {'class': 'grip'});
    //     $caption_bar.append($grip);
    //     $grip.text(GRIP_SYMBOL);
    //     var $caption_span = $('<span>', {'class': 'caption-span'});
    //     $caption_bar.append($caption_span);
    //
    //     $caption_span.append(that.caption_text);
    //     // TODO:  Why .append() here, versus .text() when looping through CAPTION words?
    //
    //     if (that.was_submitted_anonymous) {
    //         that.$sup.addClass('was-submitted-anonymous');
    //     }
    // }

    // /**
    //  *
    //  * @return {{cat: [], cont: {}}} - .cat - array of category idns in display order
    //  *                                 .cont - association from each category idn to an array
    //  *                                         of its contributions in order
    //  */
    // function order_of_contributions_in_each_category() {
    //     var order = { cat:[], cont:{} };
    //
    //     $('.category').each(function () {
    //         var cat = $(this).attr('id');
    //         order.cat.push(cat);
    //         order.cont[cat] = [];
    //         $(this).find('.contribution').each(function () {
    //             order.cont[cat].push(this.id);
    //         });
    //     });
    //     return order;
    // }
    //
    // /**
    //  *
    //  * @param order {{cat: [], cont: {}}}
    //  * @return {string}
    //  */
    // function order_report(order) {
    //     var cont_nonempty = order.cat.filter(function (cat) {
    //         return has(order.cont, cat) && order.cont[cat].length > 0
    //     });
    //     var cont_strings = cont_nonempty.map(function (cat) {
    //         var first_words = order.cont[cat].map(function (cont) {
    //             console.assert(is_laden(cont), cat, "`" + cont + "`", order.cont[cat]);
    //             return safe_string(first_word_from_cont(cont));
    //         });
    //         return Category_from_idn(cat).txt + ":" + first_words.join(" ");
    //     });
    //     return cont_strings.join("\n");
    // }

    function safe_string(string) {
        var safer = JSON.stringify(string);
        safer = safer.replace(/^"/, '');
        safer = safer.replace(/"$/, '');
        safer = safer.replace(/^\\"/, '');
        safer = safer.replace(/\\"$/, '');
        // NOTE:  Strip nested quotes from '"\\"string\\""' === JSON.stringify('"string"')
        return safer;
    }
    assert_equal('string', safe_string('string'));
    assert_equal('back\\\\slash line\\nfeed', safe_string('back\\slash line\nfeed'));
    assert_equal('42', safe_string(42));

    assert_equal('"' + '\\' + '"' + 'string' + '\\' + '"' + '"', JSON.stringify('"string"'));
    assert_equal(                   'string',                       safe_string('"string"'));

    /**
     * After major changes:
     *
     * 1. log the first words of each contribution, in each category.
     * 2. Refresh the how-many numbers in anti-valved fields (stuff that shows when closed).
     */
    function settle_down() {
        // console.log(order_report(order_of_contributions_in_each_category()));
        lex.refresh_how_many();
        refresh_labels_in_play_bot_from();
    }

    // /**
    //  * Update all the (count) indicators that show when a category is collapsed.
    //  */
    // function refresh_how_many() {
    //     // looper(MONTY.cat.order, function recompute_category_anti_valves(_, cat) {
    //     //     var num_cont_string;
    //     //     var num_cont_int = num_contributions_in_category(cat);
    //     //     if (num_cont_int === 0) {
    //     //         num_cont_string = "";
    //     //     } else {
    //     //         num_cont_string = " (" + String(num_cont_int) + ")";
    //     //     }
    //     //     $sup_categories[cat].find('.how-many').text(num_cont_string);
    //     // });
    //     categories.loop(function recompute_category_anti_valves(_, category) {
    //         var num_cont = category.cont_sequence.len();
    //         var num_cont_string = num_cont === 0 ? "" : f(" ({n})", {n:num_cont});
    //         category.$sup.find('.how-many').text(num_cont_string);
    //     });
    // }

    // /**
    //  * Report some malfeasance or kerfuffle to the server.
    //  */
    // // TODO:  In the timeless words of Captain Herbert Sobel:  Find some.
    // function flub(report) {
    //     qoolbar.sentence({
    //         vrb_idn: MONTY.IDN.FIELD_FLUB,
    //         obj_idn: MONTY.IDN.LEX,
    //         txt: report,
    //         use_already: false
    //     }, function () {
    //         console.error("Flub:", report);
    //     }, function () {
    //         console.error("FLUB NOT RECORDED:", report);
    //     });
    // }

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
                $enter_a_caption.outerWidth($enter_some_text.outerWidth());
            }
            new MutationObserver(caption_tracks_text).observe(
                dom_from_$($enter_some_text),
                {
                    attributes: true,
                    attributeFilter: ['style']
                }
            );
            caption_tracks_text();
            // THANKS:  div events, MutationObserver, https://stackoverflow.com/a/42805882/673991
        }
    }



    ///////////////////////////////////////////////
    ////// valve() - click to open - click to close
    ///////////////////////////////////////////////

    /**
     * Clickable opener and closer.
     * 
     * 
     * @param opt - {name, is_initially_open, on_open}
     * @return {Valve}
     * @constructor
     */
    function Valve(opt) {
        var that = this;
        type_should_be(that, Valve);
        that.opt = opt;
        type_should_be(that.opt, Object);
        type_should_be(that.opt.name, String);
        type_should_be(that.opt.is_initially_open = that.opt.is_initially_open || false, Boolean);
        type_should_be(that.opt.on_open = that.opt.on_open || function () {}, Function);

        that.build_dom();
    }

    Object.defineProperties(Valve.prototype, {
        _id_valve_control:  { get: function () {return this.opt.name + '-valve';}},
        _class_valved:      { get: function () {return this.opt.name + '-valved';}},
        _class_anti_valved: { get: function () {return this.opt.name + '-anti-valved';}}
    });

    Valve.prototype.build_dom = function () {
        var that = this;
        that.$valve = $('<span>', {id: that._id_valve_control, 'class': 'valve'});
        that.$valve.data('opt', that.opt);
        var $closer = $('<span>', {'class': 'closer'}).text(UNICODE.BLACK_DOWN_POINTING_TRIANGLE);
        var $opener = $('<span>', {'class': 'opener'}).text(UNICODE.BLACK_RIGHT_POINTING_TRIANGLE);
        that.$valve.append($closer, $opener);

        that.set_openness(that.opt.is_initially_open);
        // NOTE:  Cannot toggle valve-hidden on "-valved" objects here,
        //        because they can't have been "controlled" yet.

        that.$valve.on('click', function () {
            var old_open = that.is_open();
            var new_open = ! old_open;
            that.set_openness(new_open);
            if (new_open) {
                that.opt.on_open();
                setTimeout(function () {
                    // NOTE:  Give contributions a chance to render.
                    initial_thumb_size_adjustment();
                    resizer_nudge_all();
                    // NOTE:  This may be the first time some contribution renderings become
                    //        visible.  Can't size-adjust until they're visible.
                }, 1);
            }
        });
    };

    Valve.prototype.is_open = function () {
        var that = this;
        return ! that.$valve.hasClass('valve-closed');
    };

    Valve.prototype.set_openness = function (should_be_open) {
        var that = this;
        that.$valve.toggleClass('valve-opened',   should_be_open);
        that.$valve.toggleClass('valve-closed', ! should_be_open);
        $_from_class(that._class_valved     ).toggleClass('valve-hidden', ! should_be_open);
        $_from_class(that._class_anti_valved).toggleClass('valve-hidden',   should_be_open);
    }

    /**
     * Identify what gets opened and closed when clicking on the valve triangles.
     *
     * @param $elements - what's visible when "open"
     * @param $anti_elements - what's visible when "closed"
     */
    Valve.prototype.control = function ($elements, $anti_elements) {
        var that = this;
        // TODO:  Pass these parameters as fields to valve() options.
        //        Big problem with that!  Currently, between valve() and  valve_control() call,
        //        The element returned by valve() must be appended into the DOM.
        //        What breaks if that doesn't happen?  I forget...
        //        Well it may be a problem that the valved and anti-valved elements cannot
        //        be conveniently placed until the $valve element exists.
        //        But maybe the solution to all this is to create an empty element and
        //        pass that TO valve() who then fills it in with triangles.
        //        Maybe the "name" (and its derivatives) can be inferred from that element's id.
        $elements.addClass(that._class_valved);
        $anti_elements.addClass(that._class_anti_valved);
        var is_open = that.is_open();
        $elements.toggleClass('valve-hidden', ! is_open);
        $anti_elements.toggleClass('valve-hidden', is_open);
    }



    ////////////////////////////
    ////// Generic stuff follows
    ////////////////////////////

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

    function exit_full_screen() {
        // // NO THANKS:  Exit full screen, https://stackoverflow.com/a/36672683/673991
        // if (window.document.exitFullscreen) {
        //     var exit_full_screen_promise = window.document.exitFullscreen();
        //     exit_full_screen_promise.catch(function (error_message) {
        //         console.error("Exit full screen error:", error_message);
        //     });
        // } else if (window.document.webkitExitFullscreen) {
        //     window.document.webkitExitFullscreen();
        // } else if (window.document.mozCancelFullScreen) {
        //     window.document.mozCancelFullScreen();
        // } else if (window.document.msExitFullscreen) {
        //     window.document.msExitFullscreen();
        // } else {
        //     console.error("No function to exit full screen.");
        // }
        
        
        
        var dom_object = window.document;  
        // NOTE:  document appears to have exit-full-screen capabilities,
        //        even if a doubly embedded iframe entered full screen.

        if ('exitFullscreen' in dom_object) {
            dom_object.exitFullscreen()
                .then(function () {
                    console.debug("Successfully exited full screen");
                })
                .catch(function (error_message) {
                    console.error("Exit full screen error:", error_message);
                })
            ;
        } else if ('webkitExitFullscreen' in dom_object) {
            dom_object.webkitExitFullscreen();
        } else if ('mozExitFullScreen' in dom_object) {
            dom_object.mozExitFullScreen();
        } else if ('msExitFullscreen' in dom_object) {
            dom_object.msExitFullscreen();
        } else {
            console.error("No way to exit full screen.");
        }
        // THANKS:  Freakish capital S for moz, https://stackoverflow.com/a/30044770/673991
    }

    function embed_enter_full_screen() {
        if (is_popup()) {
            popped_cont.embed_message({ action: 'full_screen' });
        } else {
            console.info("Ignoring the f-key when there is nothing to switch to full-screen.");
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
        enough_milliseconds = enough_milliseconds || LONG_PRESS_DEFAULT_MS;
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
}

// NOTE:  Reasons why IE11 won't work:
//        window.document.currentScript is needed to match media handler code and objects.
//        window.speechSynthesis to speak quotes
//        window.SpeechSynthesisUtterance is where it actually crashes
//        $('iframe').on('load') event never happens.
//        window.ResizeObserver has cosmetic advantage only, not a factor

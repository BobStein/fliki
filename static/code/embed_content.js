// embed_content.js - for oembed iframe

// noinspection JSUnusedGlobalSymbols
/**
 * @param window
 * @param window.document
 * @param window.iFrameResizer
 * @param window.location.href
 * @param window.parentIFrame
 * @param window.parentIFrame.getId
 * @param window.URLSearchParams
 * @param window.YT
 * @param window.YT.Player
 * @param window.YT.PlayerState
 * @param window.YT.PlayerState.UNSTARTED - -1
 * @param window.YT.PlayerState.ENDED     -  0
 * @param window.YT.PlayerState.PLAYING   -  1
 * @param window.YT.PlayerState.PAUSED    -  2
 * @param window.YT.PlayerState.BUFFERING -  3
 * @param window.YT.PlayerState.CUED      -  5 (e.g. at the beginning before playing)
 *
 * @param {function} $
 * @param {function} $.extend
 * @param {function} $.getScript
 * @param {function} $.param
 *
 * @param {object}      MONTY
 * @param {array}       MONTY.matched_groups
 * @param {object|null} MONTY.oembed
 * @param {object}      MONTY.oembed.error
 * @param {object}      MONTY.oembed.height
 * @param {object}      MONTY.oembed.html
 * @param {object}      MONTY.oembed.thumbnail_url
 * @param {object}      MONTY.oembed.width
 * @param {string}      MONTY.target_origin
 * @param {number}      MONTY.THUMB_MAX_HEIGHT
 * @param {number}      MONTY.THUMB_MAX_WIDTH
 *
 * @property {object}   yt_player
 * @property {function} yt_player.getCurrentTime
 * @property {function} yt_player.getPlayerState
 * @property {function} yt_player.pauseVideo
 * @property {function} yt_player.playVideo
 * @property {function} yt_player.seekTo
 * @property {function} yt_player.stopVideo
 */
function embed_content_js(window, $, MONTY) {
    type_should_be(window, Window);
    type_should_be($, Function);
    type_should_be($(), $);
    type_should_be($().jquery, String);
    type_should_be(MONTY, Object);
    // TODO:  Assert window and MONTY are not null without generating mfing
    //        PyCharm warnings from the eager beaver type nazi.

    var POLL_MILLISECONDS = 1000;   // Try this often to "fix" embedded content
    var POLL_REPETITIONS = 10;   // Try this many times to "fix" embedded content
    // NOTE:  If this doesn't go on long enough, the fancy-pants embedded html
    //        from the provider may not have enough time to transmogrify
    //        itself into whatever elements it's going to become.
    //        So the "fix_embedded_content" may be incomplete.

    // var POP_UP_ANIMATION_MS = 500;
    // var POP_UP_ANIMATION_TIMEOUT_MS = 1500;   // Fix for the ASS-OS bug.

    // TODO:  Why does twitter + IE11 + fit_height() go on changing height in EVERY repetition?

    var num_cycles = 0;
    var num_changes = 0;
    var cycle_of_last_change = 0;
    var description_of_last_change = "(none)";
    var $body;

    var url_outer_iframe = query_get('url');
    var id_attribute = query_get('id_attribute');

    var is_auto_play = query_get('auto_play', 'false') === 'true';
    // NOTE:  is_auto_play is not:
    //        whether the Bot is running a sequence of contributions, vs manual.
    //        Nor is it whether the media is dynamic (video) versus static (photo).
    //        Nor is it whether the media is popped up versus a thumbnail.
    //        It's whether the object has some automated lifetime,
    //             versus sitting there forever waiting for the user to do something.
    //        TRUE:   (These events are recorded as an interaction work in the lex.)
    //            the "play" button is clicked on individual media contributions, youtube only
    //            the Bot pops up media, a youtube video or instagram photo
    //        FALSE:   (These do not merit recording a lex interaction word.)
    //            the "bigger" button is clicked on an individual contribution, video or photo
    //            this is a thumbnail for a noembed contribution, but there's no thumbnail image,
    //                or the image is broken
    //                so the thumbnail is live media, e.g. twitter or dropbox
    //        is_auto_play is a subset of is_pop_up.  (I.e. we never automate thumbnails.)
    // TODO:  Should the timing of Bot-driven static media happen in THIS file embed_content.js
    //        instead of in the FSM of contribution.js?  This would make "auto_play" youtube behave
    //        slightly more like "auto_play" instagram, e.g.

    var is_pop_up = query_get('is_pop_up', 'false') === 'true';
    var oppressed_width = query_get('width', 'auto');
    var oppressed_height = query_get('height', 'auto');
    var oppressed_duration = parseInt(query_get('duration', '500'));
    var oppressed_easing = query_get('easing', 'swing');   // swing or linear

    var domain_simple = simplified_domain_from_url(url_outer_iframe);
    window.document.title = domain_simple + " - " + window.document.title;
    var is_youtube = (domain_simple === 'youtube' || domain_simple === 'youtu.be');
    var is_pop_youtube = is_pop_up && is_youtube;
    var is_dynamic = is_youtube;   // future dynamic media suppliers go here...

    var YOUTUBE_EMBED_PREFIX = 'https://www.youtube.com/embed/';
    // THANKS:  URL, https://developers.google.com/youtube/player_parameters#Manual_IFrame_Embeds

    var yt_player = null;
    var is_yt_player_ready = false;
    var t = Timing();
    var ms_load = new Date().getTime();

    function seconds_since_load() {
        var ms_now = new Date().getTime();
        return (ms_now - ms_load) / 1000.0;
    }

    window.iFrameResizer = {
        targetOrigin: MONTY.target_origin,
        onReady: function resizer_ready() {
            t.moment("resizer");
            if (is_auto_play) {
                if (is_pop_youtube) {
                    // NOTE:  This right here is the dynamic versus static decision.
                    //        Not yet begun playing, but it's gonna.
                    //        Let the parent know this is dynamic, playable media
                    //        versus a static photo.
                    parent_message('auto-play-presaged', {
                        id_attribute: id_attribute
                    });
                } else {
                    // NOTE:  Not something that plays like a video.
                    //        Let the parent know this is static media.
                    // NOTE:  YouTube thumbnails (i.e. not popped up) don't get to embed_content.js,
                    //        but if they did they'd be static, and they'd come here.
                    parent_message('auto-play-static', {
                        id_attribute: id_attribute,
                        current_time: seconds_since_load()
                    });
                }
            }
            $(function document_ready() {
                t.moment("$");

                $body = $(window.document.body);
                // noinspection JSIncompatibleTypesComparison
                if (is_laden(MONTY.oembed.error)) {
                    var $p = $('<p>', {
                        'class': 'oembed-error',
                        'data-iframe-width': 'x'
                    });
                    $p.text(MONTY.oembed.error);
                    $body.prepend($p);
                    // EXAMPLE:
                    //     /meta/oembed/?url=https://www.youtube.com/watch?v=bAD2_MVMUlE&idn=1931
                    //     https://noembed.com/embed?url=https://www.youtube.com/watch?v=bAD2_MVMUlE
                    //     MONTY.oembed = {
                    //         "error":"401 Unauthorized",
                    //         "url":"https://www.youtube.com/watch?v=bAD2_MVMUlE"
                    //     }
                    //     https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=bAD2_MVMUlE
                    // EXAMPLE:
                    //     https://noembed.com/embed?url=https://www.youtube.com/watch?v=qqLIH2UiPXg
                    //     {"url":"https://www.youtube.com/watch?v=qqLIH2UiPXg","error":"401 Unauthorized"}
                    // EXAMPLE:
                    //     MONTY.oembed = {
                    //         "error":"no matching providers found",
                    //         "url":"https://www.youtube.com/watch?time_continue=206"
                    //     },
                    //     https://www.youtube.com/watch?time_continue=206&v=ubTJI_UphPk&feature=emb_logo&ab_channel=DoctorWho
                    fix_embedded_content();
                    console.warn("Noembed error on", id_attribute, url_outer_iframe);
                    parent_message('noembed-error-notify', {
                        id_attribute: id_attribute,
                        error_message: "noembed error " + MONTY.oembed.error
                    });
                } else if (is_pop_youtube) {
                    youtube_iframe_api(function youtube_api_ready() {
                        t.moment("yt-code");
                        var $youtube_iframe = $youtube_build_dom();
                        tag_width($youtube_iframe);
                        $youtube_iframe.width(MONTY.THUMB_MAX_WIDTH);
                        $youtube_iframe.height(MONTY.THUMB_MAX_HEIGHT);
                        $body.prepend($youtube_iframe);
                        animate_surely($youtube_iframe, {
                            width: oppressed_width,
                            height: oppressed_height
                        }, {
                            complete: function () {
                                dynamic_player();
                            },
                            duration: oppressed_duration,
                            easing: oppressed_easing
                        });
                    });
                } else {
                    $body.html(MONTY.oembed.html);
                    $body.on('load', function () {
                        console.debug("BodyLoaded", id_attribute, "-", $body.html().length, "bytes");
                    });
                    fix_embedded_content();
                    var interval = setInterval(function () {
                        // noinspection SpellCheckingInspection
                        if (num_cycles >= POLL_REPETITIONS) {
                            // if (num_changes === 0) {
                            //     console.log(
                            //         domain_simple, "- no changes"
                            //     );
                            // } else {
                            //     console.log(
                            //         id_attribute + ".",
                            //         domain_simple, "-",
                            //         num_changes, "changes,",
                            //         "last", description_of_last_change,
                            //         "cycle", cycle_of_last_change, "of", POLL_REPETITIONS,
                            //         // "codes", JSON.stringify(MONTY.matched_groups),
                            //         "lag", lag_report()
                            //     );
                            // }
                            // EXAMPLE:
                            //     1871. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["3j0ji-tn4Cc"] lag 551ms 78ms
                            //     1857. soundcloud - 2 changes, last IFRAME.fit_height(300x400-225x300) cycle 0 of 10 codes [] lag 548ms 83ms
                            //     1834. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["bYubEn15eH4"] lag 400ms 92ms
                            //     1831. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["5BfWll_Inwg"] lag 392ms 98ms
                            //     1823. flickr - 5 changes, last tag_width cycle 2 of 10 codes [] lag 303ms 35ms
                            //     1822. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["5BfWll_Inwg"] lag 300ms 42ms
                            //     1813. twitter - 4 changes, last TWITTER-WIDGET.fit_height(220x421-157x300) cycle 4 of 10 codes ["ICRC","799571646331912192"] lag 296ms 48ms
                            //     1825. twitter - 5 changes, last TWITTER-WIDGET.fit_height(299x489-184x300) cycle 4 of 10 codes ["marinamaral2","1161324087362367488"] lag 268ms 48ms
                            //     1748. twitter - 5 changes, last TWITTER-WIDGET.fit_height(220x409-161x300) cycle 4 of 10 codes ["QuotesOnline4Me","1158728987914276864"] lag 280ms 53ms
                            //     1754. flickr - 6 changes, last tag_width cycle 1 of 10 codes [] lag 389ms 56ms
                            //     1851. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["uwjbvhRReZo"] lag 255ms 203ms
                            //     1795. dropbox - 3 changes, last IMG.fit_width cycle 0 of 10 codes ["dropbox.com/s/k3yjtkxdh28d4jt/Haitham-in-Aleppo---ICRC.jpg"] lag 522ms 113ms
                            //     1746. vimeo - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes [] lag 521ms 128ms
                            //     1741. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["f3u3Xs8sQwQ"] lag 436ms 204ms
                            //     1739. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["4e4eP_g2E7w"] lag 446ms 213ms
                            //     1733. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["o9tDO3HK20Q"] lag 518ms 158ms
                            //     1849. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 codes ["uwjbvhRReZo"] lag 585ms 8ms
                            // EXAMPLE:  (10 second delay!  Might explain why some contributions stay zero-size.)
                            //     1825. twitter - 14 changes, last TWITTER-WIDGET.fit_width cycle 10 of 10 lag 876ms 149ms
                            // EXAMPLE:
                            //     14:28:43.268 embed_content.js?mtime=1571184096.953:273 1872. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 958ms 308ms
                            //     14:28:43.277 embed_content.js?mtime=1571184096.953:273 1823. flickr - 6 changes, last tag_width cycle 3 of 10 lag 1157ms 317ms
                            //     14:28:43.292 embed_content.js?mtime=1571184096.953:273 1874. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 810ms 324ms
                            //     14:28:43.301 embed_content.js?mtime=1571184096.953:273 1871. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 735ms 327ms
                            //     14:28:43.309 embed_content.js?mtime=1571184096.953:273 1834. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 697ms 334ms
                            //     14:28:44.101 embed_content.js?mtime=1571184096.953:273 1831. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1435ms 259ms
                            //     14:28:44.110 embed_content.js?mtime=1571184096.953:273 1822. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1180ms 266ms
                            //     14:28:44.124 embed_content.js?mtime=1571184096.953:273 1813. twitter - 14 changes, last TWITTER-WIDGET.fit_width cycle 10 of 10 lag 1018ms 271ms
                            //     14:28:44.174 embed_content.js?mtime=1571184096.953:273 1825. twitter - 16 changes, last TWITTER-WIDGET.fit_width cycle 10 of 10 lag 991ms 283ms
                            //     14:28:44.327 embed_content.js?mtime=1571184096.953:273 1857. soundcloud - 3 changes, last IFRAME.fit_height(200x267-125x166) cycle 0 of 10 lag 1225ms 405ms
                            //     14:28:44.463 embed_content.js?mtime=1571184096.953:273 1748. twitter - 15 changes, last TWITTER-WIDGET.fit_width cycle 10 of 10 lag 1256ms 52ms
                            //     14:28:44.478 embed_content.js?mtime=1571184096.953:273 1754. flickr - 7 changes, last target_blank cycle 0 of 10 lag 1225ms 64ms
                            //     14:28:44.847 embed_content.js?mtime=1571184096.953:273 1938. twitter - 14 changes, last TWITTER-WIDGET.fit_width cycle 10 of 10 lag 1149ms 159ms
                            //     14:28:44.924 embed_content.js?mtime=1571184096.953:273 1795. dropbox - 5 changes, last IMG.fit_height(200x199-167x166) cycle 0 of 10 lag 1176ms 75ms
                            //     14:28:44.924 embed_content.js?mtime=1571184096.953:273 1739. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1045ms 103ms
                            //     14:28:44.925 embed_content.js?mtime=1571184096.953:273 1733. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1033ms 107ms
                            //     14:28:44.925 embed_content.js?mtime=1571184096.953:273 1936. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 966ms 142ms
                            //     14:28:44.925 embed_content.js?mtime=1571184096.953:273 1746. vimeo - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1179ms 133ms
                            //     14:28:44.925 embed_content.js?mtime=1571184096.953:273 1741. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 1217ms 148ms
                            //     14:28:44.926 embed_content.js?mtime=1571184096.953:273 1851. youtu.be - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 951ms 204ms
                            //     14:28:44.926 embed_content.js?mtime=1571184096.953:273 1849. youtube - 2 changes, last IFRAME.fit_width cycle 0 of 10 lag 926ms 216ms
                            clearInterval(interval);
                            return;
                        }
                        num_cycles++;
                        fix_embedded_content();   // Again, after provider processing.
                    }, POLL_MILLISECONDS);
                }
                $(window.document).on('keydown', keyboard_shortcut_handler);
                // TODO:  Does this ever happen?  Appears the intermediate iframe never has focus.
            });
        },
        onMessage: function resizer_message(message) {
            // noinspection JSRedundantSwitchStatement
            // TODO:  Make these action names constant, e.g. MONTY.EMBED_ACTION.UN_POP_UP
            //        And of course the parent should use them too.
            switch (message.action) {
            case 'un-pop-up':
                if (is_dynamic) {
                    if (is_yt_player_ready) {
                        type_should_be(yt_player.pauseVideo, Function);
                        var youtube_state = yt_player.getPlayerState();
                        console.log("UN POP UP, youtube state", youtube_state);
                        if (quitable_state(youtube_state)) {
                            parent_message('auto-play-quit', {
                                id_attribute: id_attribute,
                                current_time: yt_player.getCurrentTime()
                            });
                            // NOTE:  This is an unnatural, manual end of a YouTube video.
                            //        The natural, automated end of a YouTube video is noted in the
                            //        handler for the YT.PlayerState.ENDED event.
                            //        The Bot will take credit for it there.
                        }
                    } else if (is_laden(MONTY.oembed.error)) {
                        console.log("Harmlessly popping down video with an error", id_attribute);
                    } else {
                        // Reasons for getting here:
                        //     - YouTube API might be loading
                        //     - popup animation in progress (yt_player is set when that's done)
                        // console.error("Unhandled dynamic pop-down.", window.location.search, yt_player);
                        console.warn("Unhandled dynamic pop-down.", MONTY.oembed);
                    }
                } else {   // NOTE:  Static media pop down, e.g. instagram photo
                    if (is_auto_play) {   // NOTE:  Static media was kinda "playing".
                        var action;
                        if (message.did_bot_transition) {
                            action = 'auto-play-end-static';
                            // NOTE:  The Bot ended the static contribution.  Or there was an error.
                        } else {
                            action = 'auto-play-quit';
                            // NOTE:  The user prematurely quit this static contribution.
                        }
                        parent_message(action, {
                            id_attribute: id_attribute,
                            current_time: seconds_since_load()
                        });
                    }
                }
                // noinspection JSJQueryEfficiency
                $('#youtube_iframe').animate({
                    width: message.width,
                    height: message.height
                }, {
                    duration: message.duration,
                    easing: message.easing
                });
                break;
            case 'pause':
                if (is_yt_player_ready) {
                    type_should_be(yt_player.pauseVideo, Function);
                    yt_player.pauseVideo();
                } else if (is_auto_play) {
                    // NOTE:  Static media popup, or YouTube iFrame API failure
                    // TODO:  Why if is_auto_play?  Is that to prevent double-reporting of a pause?
                    //        Not sure that's possible in this non-youtube case.
                    parent_message("auto-play-paused", {
                        id_attribute: id_attribute,
                        current_time: seconds_since_load()
                    });
                } else {
                    console.warn("Not ready to pause", id_attribute, url_outer_iframe);
                }
                break;
            case 'resume':
                if (is_yt_player_ready) {
                    type_should_be(yt_player.pauseVideo, Function);
                    yt_player.playVideo();
                } else if (is_auto_play) {
                    // TODO:  Why if is_auto_play?
                    console.error('Resume message on failed dynamic media', id_attribute);
                    // parent_message('auto-play-resume', {
                    //     id_attribute: id_attribute,
                    //     current_time: seconds_since_load()
                    // });
                } else {
                    console.error("Resume message on thumbnail", id_attribute);   // manual play?
                }
                break;
            case 'seek_relative':
                if (is_yt_player_ready) {
                    var old_position = yt_player.getCurrentTime();
                    var new_position = old_position + message.seconds;
                    yt_player.seekTo(new_position, true);
                    console.debug("Seek", message.seconds, "-", old_position, "to", new_position);
                } else {
                    console.error("Cannot seek relative", message.seconds);
                }
                break;
            case 'full_screen':
                console.debug("Embedded full screen attempt");
                // noinspection JSJQueryEfficiency
                enter_full_screen('#youtube_iframe');
                break;
            default:
                console.error(
                    "Unknown action, parent --> child",
                    '"' + message.action + '"'
                );
                break;
            }
        }
    };

    function enter_full_screen(selector) {
        var dom_object = dom_from_$(selector);
        if ('requestFullscreen' in dom_object) {
            dom_object.requestFullscreen()
                .then(function () {
                    console.debug("Successfully entered full screen");
                })
                .catch(function (error_message) {
                    console.error("Enter full screen error:", error_message);
                })
            ;
        } else if ('webkitRequestFullscreen' in dom_object) {
            dom_object.webkitRequestFullscreen();
        } else if ('mozRequestFullScreen' in dom_object) {
            dom_object.mozRequestFullScreen();
        } else if ('msRequestFullscreen' in dom_object) {
            dom_object.msRequestFullscreen();
        } else {
            console.error(
                "No way to enter full screen.",
                selector,
                typeof dom_object.requestFullscreen,
                type_name(dom_object.requestFullscreen)
            );
        }
    }
    // THANKS:  Full screen clues, https://stackoverflow.com/a/20289540/673991
    //          But beware:  in his example code, `$` is NOT jQuery.
    // THANKS:  has own method, up the prototype chain, https://stackoverflow.com/a/41008152/673991
    //          unlike .hasOwnProperty().  Although typeof ... 'function' would have worked too,
    //          except the IDE might not recognize it.  Without naming JetBrains by name.
    // THANKS:  Freakish capital S for moz, https://stackoverflow.com/a/30044770/673991

    if (am_i_in_an_iframe()) {
        $.getScript(
            'https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/' +
            'iframeResizer.contentWindow.js'
        );
    } else {
        console.log("Stand-alone embed.");
        window.iFrameResizer.onReady();
        // NOTE:  Make this page work stand-alone, for development purposes.
        //        That is, when browsing a URL like this:
        //        https://unslumping.org/meta/oembed/?url=https://www.youtu.be/3SwNXQMoNps
    }

    var NO_YOUTUBE_STATE = -999;

    function name_from_code(state_code) {
        type_should_be(state_code, Number);
        switch (state_code) {
        case window.YT.PlayerState.UNSTARTED: return "UNSTARTED";
        case window.YT.PlayerState.ENDED:     return "ENDED";
        case window.YT.PlayerState.PLAYING:   return "PLAYING";
        case window.YT.PlayerState.PAUSED:    return "PAUSED";
        case window.YT.PlayerState.BUFFERING: return "BUFFERING";
        case window.YT.PlayerState.CUED:      return "CUED";
        case NO_YOUTUBE_STATE:                return "(none)";
        default:                              return f("(unknown state {n})", {n:state_code});
        }
    }
    function keyboard_shortcut_handler(evt) {
        switch (evt.key) {
        case 'Escape':
            console.debug("ESCAPE GOES HERE");
            break;
        }
    }
    /**
     * Begin dynamic-media auto-play if we're doing that.  Get event handlers ready.
     *
     * Expect #youtube_iframe to already be in the DOM.
     * Expect resizer is ready, document is loaded, YouTube API has been loaded.
     * Expect we are popping up.
     *
     * NOTE:  PlayerState sequences:
     *        cued->unstarted->buffering->playing->ended
     *        5->-1->3->    1->0  --  usually
     *        5->-1->3->-1->1->0  --  once
     *        2->3->1  --  clicking the timeline
     *
     *        YouTube API state codes:
     *        -1 – unstarted
     *         0 – ended
     *         1 – playing
     *         2 – paused
     *         3 – buffering
     *         5 – video cued
     */
    function dynamic_player() {
        t.moment("pop");
        console.assert($('#youtube_iframe').length === 1);
        var first_state_change = true;
        var previous_state = NO_YOUTUBE_STATE;
        type_should_be(window.YT.Player, Function);
        // FALSE WARNING:  Unused property onStateChange
        // noinspection JSUnusedGlobalSymbols
        var yt_event_handlers = {
            onReady: function (/*yt_event*/) {
                is_yt_player_ready = true;
                if (is_auto_play) {
                    t.moment("yt-play");
                    type_should_be(yt_player.playVideo, Function);
                    // NOTE:  This checks for a problem that was possibly caused by
                    //        calling dynamic_player() twice.
                    //        (From a botched fix for the ASS-OS bug.)

                    yt_player.playVideo();

                    parent_message('auto-play-begun', {
                        id_attribute: id_attribute
                    });
                    // NOTE:  Let contribution.js know that it's now
                    //        okay to send a 'pause' message,
                    //        which will cause yt_player.pauseVideo()

                }
                if (yt_player.getPlayerState() === window.YT.PlayerState.UNSTARTED) {
                    console.warn("Unstarted", id_attribute, "-- Chrome blocked?");
                }
            },
            onStateChange: function (yt_event) {
                console.log(
                    "YT API",
                    id_attribute,
                    name_from_code(previous_state),
                    "->",
                    name_from_code(yt_event.data)
                );
                if (first_state_change) {
                    first_state_change = false;
                    parent_message('auto-play-woke', {   // TODO:  Use or lose?
                        id_attribute: id_attribute
                    });
                    t.moment("yt-state");

                    console.log(id_attribute, domain_simple + ",", "lag", t.report());
                    // EXAMPLE (busy):  popup_1990 youtube, lag 11.025:
                    //     resizer 1.137, jquery 0.233, yt-code 0.834,
                    //     pop 0.414, yt-play 7.017, yt-state 1.390
                    // EXAMPLE (easy):  popup_1990 youtube, lag 1.125:
                    //     resizer 0.063, jquery 0.019, yt-code 0.092,
                    //     pop 0.466, yt-play 0.404, yt-state 0.081
                }
                // SEE:  yt_event.data, not yt_player.getPlayerState(), for new state,
                //       https://developers.google.com/youtube/iframe_api_reference#onStateChange
                switch (yt_event.data) {
                case window.YT.PlayerState.ENDED:
                    parent_message('auto-play-end-dynamic', {
                        id_attribute: id_attribute,
                        current_time: yt_player.getCurrentTime()
                    });
                    break;
                case window.YT.PlayerState.PAUSED:
                    parent_message('auto-play-paused', {
                        id_attribute: id_attribute,
                        current_time: yt_player.getCurrentTime()
                    });
                    // TODO:  getCurrentTime() is wrong when changing the play point on
                    //        the time-line.  It shows the NEW video time, not the one
                    //        left behind time.  Is that good??
                    //        By the way, the sequence when that happens is:
                    //            pause (2), buffering (3), playing (1)
                    //        So the lex records interactions:
                    //            pause, start
                    //        Ala idns 3751, 3752.
                    //        One way to fix this would be setInterval(sample getCurrentTime)
                    //        But how soon does that change before the pause event??
                    break;
                case window.YT.PlayerState.PLAYING:
                    // if (previous_state === window.YT.PlayerState.PAUSED) {
                    //     // TODO:  Is this reliable?  Could some state
                    //     //        come after pause before play?
                    //     console.log("EMBED RESUME", yt_player.getCurrentTime());
                    //     parent_message('auto-play-resume', {
                    //         id_attribute: id_attribute,
                    //         current_time: yt_player.getCurrentTime()
                    //     });
                    // } else {
                        console.log("EMBED PLAYING", yt_player.getCurrentTime());
                        parent_message('auto-play-playing', {
                            id_attribute: id_attribute,
                            current_time: yt_player.getCurrentTime()
                        });
                    // }
                    break;
                default:
                    break;
                }
                previous_state = yt_event.data;
            },
            onError: function (yt_event) {
                console.warn("Player error", yt_event.data);
                parent_message('auto-play-error', {
                    id_attribute: id_attribute,
                    error_message: "YouTube Player error " + yt_event.data.toString()
                });
                // EXAMPLE:  "error 150" on Six Feet Under finale video axVxgCT3YD0
                // SEE:  error 150 causes, https://stackoverflow.com/a/5189003/673991
            }
        };
        try {
            yt_player = new window.YT.Player('youtube_iframe', { events: yt_event_handlers });
        } catch (e) {
            var error_message = e.toString();
            console.error("YOUTUBE API INSTANTIATION FAILURE", e);
            parent_message('auto-play-instantiation', {
                id_attribute: id_attribute,
                error_message: "YOUTUBE API INSTANTIATION FAILURE: " + error_message
            });
            // NOTE:  Pop Up Blocker for Chrome - poperblocker.com [sic] breaks instantiation:
            //            TypeError: Cannot read properties of undefined (reading 'match')
            //            at Mb (www-widgetapi.js:176:24) ...
            //        Apparently an iframe.src becomes undefined when that extension is enabled.
        }
    }

    /**
     * Is the YouTube player in a state where quitting is a notable interaction.
     *
     * Includes states:
     *     1 - PLAYING
     *     2 - PAUSED
     *     3 - BUFFERING
     * But not:
     *    -1 - UNSTARTED
     *     0 - ENDED
     *     5 - CUED
     *
     * @param state
     * @return {boolean}
     */
    function quitable_state(state) {
        return has([
            window.YT.PlayerState.PLAYING,
            window.YT.PlayerState.PAUSED,
            window.YT.PlayerState.BUFFERING
        ], state);
    }

    function parent_message(action, etc) {
        var message = $.extend({ action: action }, etc);
        parent_iframe().sendMessage(message, window.iFrameResizer.targetOrigin);
    }
    // TODO:  Make action names constant, e.g. MONTY.PARENT_ACTION.AUTO_PLAY_QUIT

    function parent_iframe() {
        if (is_specified(window.parentIFrame)) {
            return window.parentIFrame;
        } else {
            console.error("NOT LOADED PARENT IFRAME");
            return {
                getId: function () { return "not loaded id"; },
                sendMessage: function () { console.error("no loaded send"); }
            }
        }
    }

    function query_string_from_url(url) {
        var $throw_away_hyperlink = $('<a>').prop('href', url);
        var query_string = $throw_away_hyperlink.prop('search');
        // THANKS:  url parts, https://stackoverflow.com/a/28772794/673991
        return query_string;
    }
    assert_equal('?foo=bar', query_string_from_url('https://example.com/?foo=bar'));

    /**
     * Adjust the size of this embedded iframe.
     *
     * If thumbnail set it to MONTY.THUMB_MAX
     * If popup set it to the oppressed dimensions passed in the URL query string
     */
    function fix_embedded_content() {
        var $child = $body.children().first();
        var $grandchild = $child.children().first();
        // NOTE:  flickr.com needs the $grandchild to get fit,
        //        which is an img-tag inside an a-tag.
        //        Dropbox images may have the same need.

        // NOTE:  Each of the following changes have a light touch.
        //        That is, they don't "change" a setting if it was already at that value.
        //        That's because applying some settings, even redundantly,
        //        triggers JavaScript events, and maybe iFrameResizer resizing events,
        //        which cause visual churn and slowness.

        tag_width($child);
        tag_width($grandchild);

        if (is_pop_up) {
            $body.outerWidth(oppressed_width);
            $body.outerHeight(oppressed_height);
            $child.outerWidth(oppressed_width);
            $child.outerHeight(oppressed_height);
            // NOTE:  An exception, this appears not to need a light touch, and setting these
            //        over and over does not churn visually.
        } else {
            fit_element(
                $grandchild,
                MONTY.THUMB_MAX_WIDTH,
                MONTY.THUMB_MAX_HEIGHT,
                function (report) {
                    count_a_change(domain_simple + " grandchild " + report)
                }
            );
            setTimeout(function () {
                fit_element(
                    $child,
                    MONTY.THUMB_MAX_WIDTH,
                    MONTY.THUMB_MAX_HEIGHT,
                    function (report) {
                        count_a_change(domain_simple + " child " + report)
                    }
                );
            });
            // NOTE:  Shrinking the grandchild first seems to always mean we don't need to shrink
            //        the child.  But this only works with the setTimeout().  Otherwise the child
            //        always needs shrinking too, at least in Chrome.


            // TODO:  Don't call both, only the larger one.

            // NOTE:  $child before $body fixes SoundCloud too skinny bug.
            //        Because $body shrinkage for some reason constricted $child width,
            //        but not its height.  So its skinny apparent aspect ratio was preserved.
            //        Then noticed $body doesn't need to be "fitted" at all.

            target_blank($('body > a'));
            // NOTE:  This fixes a boneheaded flickr issue.
            //        (Which may foul up only in Chrome, didn't check.)
            //        Without it, when you click on a flickr embed,
            //        you see a sad-faced paper emoji.
            //        Hovering over that you see below it:
            //        www.flickr.com refused to connect
            //        and in the javascript console you can see:
            //            Refused to display 'https://www.flickr.com/...'
            //            in a frame because it set 'X-Frame-Options'
            //            to 'sameorigin'.
            //        Twitter, Dropbox, Instagram already do target=_blank
            //        which pops up a new browser tab, avoiding the XSS issue.
        }
    }

    /**
     * Make sure an element isn't too big.  Shrink width & height so both fit, preserving aspect ratio.
     *
     * @param $element
     * @param max_width
     * @param max_height
     * @param callback_shrinkage - optional callback, with text report on shrinkage, if any happened.
     */

    function fit_element($element, max_width, max_height, callback_shrinkage) {
        if ($element.length === 1) {
            var old_width = $element.width();
            var old_height = $element.height();
            $element.css('max-width', max_width);
            $element.css('max-height', max_height);
            var actual_width = $element.width();
            var actual_height = $element.height();
            var did_change_width = actual_width !== old_width;
            var did_change_height = actual_height !== old_height;
            var reports = [];
            if (actual_width > max_width + 1.0 && ! $element.data('bust-width-notified')) {
                $element.data('bust-width-notified', true);
                reports.push("BUST-WIDTH " + (actual_width - max_width).toFixed(0) + "px too wide");
            }
            if (actual_height > max_height + 1.0) {
                reports.push("BUST-HEIGHT " + (actual_height - max_height).toFixed(0) + "px too high");
            }
            if (did_change_width) {
                reports.push("w " + old_width.toFixed(0) + " -> " + actual_width.toFixed(0));
            }
            if (did_change_height) {
                reports.push("h " + old_height.toFixed(0) + " -> " + actual_height.toFixed(0));
            }
            if (reports.length > 0) {
                callback_shrinkage(reports.join(", "));
            }
        }
    }

    function count_a_change(description) {
        cycle_of_last_change = num_cycles;
        description_of_last_change = description;
        num_changes++;
        // console.log(id_attribute + ". CHANGE", description);
        // EXAMPLE:
        //    CHANGE IFRAME.fit_height(300x400-225x300)
        //    CHANGE TWITTER-WIDGET.fit_height(220x421.063-156.7461401262994x300)
        //    CHANGE IMG.fit_height(300x468.281-192.19229479735458x300)
        //    CHANGE BLOCKQUOTE.fit_height(220x302-218.5430463576159x300)
        //
        //    CHANGE tag_width
        //    CHANGE twitter grandchild h 432 -> 128
        //    CHANGE twitter child BUST-WIDTH 60px too wide
    }

    function target_blank($element) {
        if ($element.length === 1 && $element.attr('target') !== '_blank') {
            $element.attr('target', '_blank');
            count_a_change("target_blank");
        }
    }

    /**
     * Tell iFrameResizer this element should determine the width of the iframe.
     *
     * Requires the option widthCalculationMethod: 'taggedElement'
     */
    function tag_width($element) {
        if ($element.length === 1 && ! is_defined($element.attr('data-iframe-width'))) {
            $element.attr('data-iframe-width', "x");
            // NOTE:  The value of this attribute doesn't appear to matter.
            count_a_change("tag_width");
        }
    }

    function $youtube_build_dom() {
        var $youtube_iframe = $('<iframe>', {
            id: 'youtube_iframe',
            width: MONTY.oembed.width,
            height: MONTY.oembed.height,
            type: 'text/html',
            src: youtube_embed_url({
                enablejsapi: '1',
                // NOTE:  enablejsapi query parameter works.
                //        It enables JavaScript to animate the video.

                rel: '0',
                // THANKS:  rel=0 prevents (some) related videos at the end.
                //          https://www.youtube.com/watch?v=ZUTzJG212Vo
                // TODO:  Further eliminate pesky related video billboards
                //        https://stackoverflow.com/q/48386252/673991

                autoplay: '0'
                // THANKS:  disable "UP NEXT" auto play after video done

                // NOTE:  I couldn't get the `origin` option to work:
                // , origin: 'http://example.com'
                // , origin: 'locavore.unslumping.org'
                // , origin: 'http://localhost'
                // , origin: 'http://localhost/'
                // , origin: 'http://localhost:5000/'
                // , origin: 'http://locavore.unslumping.org'
                // , origin: 'http://locavore.unslumping.org/'
                // , origin: 'http://locavore.unslumping.org:5000/'
                // , origin: 'http://locavore.unslumping.org:5000/meta/oembed/'
                // , origin: 'http://locavore.unslumping.org:5000/meta/oembed/?idn=popup_1990&is_pop_up=true&auto_play=false&width=1710&height=719&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D3SwNXQMoNps%26rel%3D0'
                // , origin: 'http://locavore.unslumping.org:5000/meta/oembed/?idn=popup_1990&is_pop_up=true&auto_play=true&width=1349&height=544&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D3SwNXQMoNps%26rel%3D0'
                // , origin: window.location.href
                // FIXME:  Why do none of the above `origin` values work??
                //         Symptom, Bot play pops up but the video doesn't start.
                //         Possible cause, domains resolve to 127.0.0.1?
                //         Possible cause, not https??
                // https://developers.google.com/youtube/player_parameters#origin
            }),
            frameborder: '0',
                  allowFullScreen : 'true',
               mozallowFullScreen : 'true',
            webkitallowFullScreen : 'true',
            allow: 'autoplay; fullscreen'
            // enablejsapi: '1'
        });
        // NOTE:  enablejsapi attribute on iframe element does not work.
        // SEE:  enablejsapi attribute on iframe element,
        //       https://developers.google.com/youtube/iframe_api_reference#Examples
        // THANKS:  Doesn't work as iframe element attribute,
        //          https://stackoverflow.com/q/51109436/673991
        //          Required instead in src query string,
        //          otherwise onReady is never called.
        // THANKS:  inner full screen, https://stackoverflow.com/a/25308193/673991
        //          Firefox requires both inner and outer iframes to have
        //          allowFullScreen attribute(s) set.  (This iframe is inner.)
        //          The allow attribute is not enough.
        //          This was true 2019.0113 in Firefox 72, despite:
        //          https://developer.mozilla.org/Web/HTML/Element/iframe
        //              allowfullscreen ...  is considered a legacy attribute
        //              and redefined as allow="fullscreen".

        return $youtube_iframe;
    }

    function youtube_embed_url(additional_parameters) {
        additional_parameters = additional_parameters || {};
        console.assert(MONTY.matched_groups.length === 1);
        var url_inner_iframe = YOUTUBE_EMBED_PREFIX + MONTY.matched_groups[0];

        // NOTE:  Now copy the t=NNN parameter from the outer URL
        //        to the start=NNN parameter of the inner URL
        // SEE:  embed start, https://developers.google.com/youtube/player_parameters#start

        var you_params = new window.URLSearchParams(query_string_from_url(url_outer_iframe));
        var t_start = you_params.get('t');
        if (t_start !== null) {
            $.extend(additional_parameters, {start: t_start});
        }
        url_inner_iframe += '?' + $.param(additional_parameters);
        return url_inner_iframe;
    }

    var _youtube_iframe_api_when_ready = null;

    function youtube_iframe_api(when_ready) {
        console.assert(_youtube_iframe_api_when_ready === null);
        console.assert( ! is_defined(window.YT));   // TODO:  Support multiple calls
        _youtube_iframe_api_when_ready = when_ready;
        $.getScript("https://www.youtube.com/iframe_api");
    }

    embed_content_js.youtube_iframe_api_ready = function () {
        type_should_be(_youtube_iframe_api_when_ready, Function);
        type_should_be(window.YT.Player, Function);
        _youtube_iframe_api_when_ready();
    };
}

// noinspection JSUnusedGlobalSymbols
/**
 * YouTube Player API on-load event.  Invoke the callback passed to youtube_iframe_api().
 *
 * SEE:  https://developers.google.com/youtube/iframe_api_reference#Requirements
 *       "The API will call this function when the page has finished downloading the JavaScript
 *       for the player API"
 */
function onYouTubeIframeAPIReady() {
    console.log("Outer YouTube api ready");
    embed_content_js.youtube_iframe_api_ready();
}

/**
 * Is this page inside an iframe?
 *
 * THANKS:  https://stackoverflow.com/a/326076/673991
 */
function am_i_in_an_iframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}
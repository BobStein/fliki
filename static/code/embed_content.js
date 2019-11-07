// embed_content.js - for oembed iframe

// noinspection JSUnusedGlobalSymbols
/**
 * @param window
 * @param window.document
 * @param window.iFrameResizer
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
 * @param window.YT.PlayerState.CUED      -  5
 *
 * @param {function} $
 * @param {function} $.extend
 * @param {function} $.getScript
 * @param {function} $.param
 *
 * @param {object}      MONTY
 * @param {array}       MONTY.matcher_groups
 * @param {object|null} MONTY.oembed
 * @param {object}      MONTY.oembed.error
 * @param {object}      MONTY.oembed.height
 * @param {object}      MONTY.oembed.html
 * @param {object}      MONTY.oembed.thumbnail_url
 * @param {object}      MONTY.oembed.width
 * @param {string}      MONTY.target_origin
 * @param {string}      MONTY.THUMB_MAX_HEIGHT
 * @param {string}      MONTY.THUMB_MAX_WIDTH
 *
 * @property {object}   yt_player
 * @property {function} yt_player.getPlayerState
 * @property {function} yt_player.pauseVideo
 * @property {function} yt_player.playVideo
 */
function embed_content_js(window, $, MONTY) {
    console.assert(typeof window === 'object');
    console.assert(typeof $ === 'function');
    console.assert(typeof MONTY === 'object');

    var POLL_MILLISECONDS = 1000;   // Try this often to "fix" embedded content
    var POLL_REPETITIONS = 10;   // Try this many times to "fix" embedded content
    // NOTE:  If this doesn't go on long enough, the fancy-pants embedded html
    //        from the provider may not have enough time to transmogrify
    //        itself into whatever elements it's going to become.
    //        So the "fix_embedded_content" may be incomplete.
    // TODO:  Why does twitter + IE11 + fit_height() go on changing height in EVERY repetition?

    var SHOW_YOUTUBE_THUMBS = false;  // true=thumbnails, false=live tiny videos
    // TODO:  Get EweBoob thumbnails to work sanely.

    var num_cycles = 0;
    var num_changes = 0;
    var cycle_of_last_change = 0;
    var description_of_last_change = "(none)";
    var $body;

    var url_outer_iframe = query_get('url');
    var contribution_idn = query_get('idn');
    var is_auto_play = query_get('auto_play', 'false') === 'true';
    var is_pop_up = query_get('is_pop_up', 'false') === 'true';
    var domain_simple = simplified_domain_from_url(url_outer_iframe);
    window.document.title = domain_simple + " - " + window.document.title;
    var is_youtube = (domain_simple === 'youtube' || domain_simple === 'youtu.be');
    var is_pop_youtube = is_pop_up && is_youtube;
    var is_dynamic = is_pop_youtube && is_auto_play;

    var YOUTUBE_EMBED_PREFIX = 'https://www.youtube.com/embed/';
    // THANKS:  URL, https://developers.google.com/youtube/player_parameters#Manual_IFrame_Embeds

    var yt_player = null;
    var t = Timing();

    window.iFrameResizer = {
        targetOrigin: MONTY.target_origin,
        onReady: function iframe_resizer_content_ready() {
            t.moment("resizer");
            if (is_dynamic) {
                parent_message('auto-play-presaged', { contribution_idn: contribution_idn });
                // NOTE:  Not yet begun, bit it's gonna.
            }
            $(window.document).ready(function () {
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
                    fix_embedded_content();
                    // TODO:  Trigger a resize, so containing iframe doesn't expose
                    //        a bit of blank area below this <p>.  Or something.
                    //        Sometimes the message is cut off (div needs to be bigger).
                    //        Maybe this?
                    //            parent_iframe().autoResize(false);
                    //            parent_iframe().autoResize(true);
                    console.debug("Noembed error on", contribution_idn, url_outer_iframe);
                    parent_message('noembed-error-notify', { contribution_idn: contribution_idn });
                } else if (is_pop_youtube) {
                    youtube_iframe_api(function () {
                        t.moment("yt-code");

                        var $you_frame = $('<iframe>', {
                            id: 'youtube_iframe',
                            width: MONTY.oembed.width,
                            height: MONTY.oembed.height,
                            type: 'text/html',
                            src: youtube_embed_url({enablejsapi: '1'}),
                            frameborder: '0',
                            allow: 'autoplay; fullscreen'
                            // enablejsapi: '1'
                        });
                        // SEE:  enablejsapi,
                        //       https://developers.google.com/youtube/iframe_api_reference#Examples
                        // THANKS:  Doesn't work as iframe element attribute,
                        //          https://stackoverflow.com/q/51109436/673991
                        //          Required instead in src query string for onReady to get called.

                        tag_width($you_frame);
                        fit_width(MONTY.THUMB_MAX_WIDTH, $you_frame);
                        fit_height(MONTY.THUMB_MAX_HEIGHT, $you_frame);
                        $body.prepend($you_frame);
                        $you_frame.animate({
                            width: query_get('width'),
                            height: query_get('height'),
                            easing: 'linear'
                        }, {
                            complete: function () {
                                t.moment("pop");
                                console.assert($('#youtube_iframe').length === 1);
                                var first_state_change = true;

                                // noinspection JSUnusedGlobalSymbols
                                yt_player = new window.YT.Player('youtube_iframe', {
                                    events: {
                                        onReady: function (/*yt_event*/) {
                                            if (is_auto_play) {
                                                t.moment("yt-play");
                                                // yt_event.target.playVideo();
                                                yt_player.playVideo();
                                                parent_message('auto-play-begun', {
                                                    contribution_idn: contribution_idn
                                                });
                                                // NOTE:  Okay to yt_player.pauseVideo().

                                            }
                                            if (
                                                yt_player.getPlayerState() ===
                                                window.YT.PlayerState.UNSTARTED
                                            ) {
                                                console.warn(
                                                    "Unstarted",
                                                    contribution_idn,
                                                    "-- Chrome blocked?"
                                                );
                                            }
                                        },
                                        onStateChange: function (yt_event) {
                                            if (first_state_change) {
                                                first_state_change = false;
                                                parent_message(
                                                    'auto-play-woke',
                                                    { contribution_idn: contribution_idn }
                                                );
                                                t.moment("yt-state");

                                                console.log(
                                                    "popup_" + contribution_idn,
                                                    domain_simple + ",",
                                                    "lag", t.report()
                                                );
                                                // EXAMPLE (busy):  popup_1990 youtube, lag 11.025:
                                                //     resizer 1.137, jquery 0.233, yt-code 0.834,
                                                //     pop 0.414, yt-play 7.017, yt-state 1.390
                                                // EXAMPLE (easy):  popup_1990 youtube, lag 1.125:
                                                //     resizer 0.063, jquery 0.019, yt-code 0.092,
                                                //     pop 0.466, yt-play 0.404, yt-state 0.081
                                            }
                                            // noinspection JSRedundantSwitchStatement
                                            switch (yt_event.data) {
                                            case window.YT.PlayerState.ENDED:
                                                if (is_auto_play) {
                                                    parent_message(
                                                        'auto-play-ended',
                                                        { contribution_idn: contribution_idn }
                                                    );
                                                }
                                                break;
                                            case window.YT.PlayerState.PAUSED:
                                                if (is_auto_play) {
                                                    parent_message(
                                                        'auto-play-paused',
                                                        { contribution_idn: contribution_idn }
                                                    );
                                                }
                                                break;
                                            case window.YT.PlayerState.PLAYING:
                                                if (is_auto_play) {
                                                    parent_message(
                                                        'auto-play-playing',
                                                        { contribution_idn: contribution_idn }
                                                    );
                                                }
                                                break;
                                            default:
                                                break;
                                            }
                                            console.log("YT API", contribution_idn, yt_event.data);
                                        },
                                        onError: function (yt_event) {
                                            console.warn(
                                                "Player error",
                                                yt_event.data
                                            );
                                        }
                                    }
                                });
                                console.log("You are here-ish", yt_player);
                            }
                        });
                    });
                    // NOTE:  PlayerState sequences:
                    //        cued=>unstarted=>buffering=>playing=>ended
                    //        5=>-1=>3=>    1=>0  --  usually
                    //        5=>-1=>3=>-1=>1=>0  --  once
                    //        2=>3=>1  --  clicking the timeline
                    // State codes:
                    // -1 – unstarted
                    //  0 – ended
                    //  1 – playing
                    //  2 – paused
                    //  3 – buffering
                    //  5 – video cued
                } else if (is_youtube && SHOW_YOUTUBE_THUMBS) {
                    var src = MONTY.oembed.thumbnail_url;

                    src = src.replace(/hqdefault/, 'default');
                    // THANKS:  No black bars, https://stackoverflow.com/a/18978874/673991
                    // SEE:  More on stupid mother effing over-effed-with ew-tube thumbnails
                    //       https://stackoverflow.com/a/20542029/673991

                    var $a = $('<a>', {
                        href: url_outer_iframe,
                        target: '_blank'
                    });
                    // noinspection HtmlRequiredAltAttribute,RequiredAttributes
                    var $img = $('<img>', {
                        'class': 'oembed-thumb',
                        'data-iframe-width': 'x',
                        src: src
                    });
                    $a.append($img);
                    $body.prepend($a);
                    // NOTE:  prepend() instead of append() or iFrameResizer could get a
                    //        phantom div in BEFORE this element, because it is being an eager
                    //        beaver and inserting a data-iframe-width=x attribute.
                    fix_embedded_content();
                } else {
                    $body.html(MONTY.oembed.html);
                    fix_embedded_content();
                    var interval = setInterval(function () {
                        // noinspection SpellCheckingInspection
                        if (num_cycles >= POLL_REPETITIONS) {
                            // if (num_changes === 0) {
                            //     console.debug(
                            //         domain_simple, "- no changes"
                            //     );
                            // } else {
                            //     console.debug(
                            //         query_get('id_attribute') + ".",
                            //         domain_simple, "-",
                            //         num_changes, "changes,",
                            //         "last", description_of_last_change,
                            //         "cycle", cycle_of_last_change, "of", POLL_REPETITIONS,
                            //         // "codes", JSON.stringify(MONTY.matcher_groups),
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
                        fix_embedded_content();
                    }, POLL_MILLISECONDS);
                }
            });
        },
        onMessage: function iframe_resizer_content_message(message) {
            // noinspection JSRedundantSwitchStatement
            switch (message.action) {
            case 'un-pop-up':
                // noinspection JSJQueryEfficiency
                $('#youtube_iframe').animate({
                    width: message.width,
                    height: message.height
                });
                break;
            case 'pause':
                if (yt_player !== null) {
                    if (typeof yt_player.pauseVideo === 'function') {
                        yt_player.pauseVideo();
                    } else {
                        console.warn(
                            "Unable to pause",
                            contribution_idn,
                            "with a",
                            typeof yt_player.pauseVideo
                        );
                    }
                } else {
                    console.warn("Not ready to pause", contribution_idn, url_outer_iframe);
                }
                break;
            case 'resume':
                if (yt_player !== null) {
                    yt_player.playVideo();
                } else {
                    console.warn("Don't know how to resume", contribution_idn, url_outer_iframe);
                }
                break;
            default:
                console.error(
                    "Unknown action, parent ==> child",
                    '"' + message.action + '"'
                );
                break;
            }
        }
    };

    if (am_i_in_an_iframe()) {
        $.getScript(
            'https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/' +
            'iframeResizer.contentWindow.js'
        );
    } else {
        // NOTE:  Make this page work stand-alone.  For development purposes.
        //        That is, when browsing a URL like this:
        //
        console.log("Stand-alone embed.");
        window.iFrameResizer.onReady();
    }

    function parent_message(action, etc) {
        var message = $.extend({ action: action }, etc);
        parent_iframe().sendMessage(message, window.iFrameResizer.targetOrigin);
    }

    function parent_iframe() {
        if (typeof window.parentIFrame === 'object') {
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
        return $('<a>').prop('href', url).prop('search');
        // THANKS:  url parts, https://stackoverflow.com/a/28772794/673991
    }
    console.assert('?foo=bar' === query_string_from_url('https://example.com/?foo=bar'));

    function fix_embedded_content() {
        var $child = $body.children().first();
        var $grandchild = $child.children().first();
        // NOTE:  flickr.com needs the $grandchild fit,
        //        which is an img-tag inside an a-tag.
        //        Dropbox images may have the same need.

        // NOTE:  Each of the following changes have a light touch.
        //        That is, they don't "change" a setting if it was already at that value.
        //        That's because applying some settings, even redundantly,
        //        triggers JavaScript events, and maybe iFrameResizer resizings,
        //        which cause visual churn and slowness.

        tag_width($child);
        // tag_width($child2);
        tag_width($grandchild);

        if (is_pop_up) {
            var pop_width = query_get('width', 'auto');
            var pop_height = query_get('height', 'auto');
            $body.css({width: pop_width, height: pop_height});
            $child.css({width: pop_width, height: pop_height});
        } else {
            fit_width(MONTY.THUMB_MAX_WIDTH, $grandchild);
            fit_width(MONTY.THUMB_MAX_WIDTH, $child);
            // fit_width(MONTY.THUMB_MAX_WIDTH, $body);

            fit_height(MONTY.THUMB_MAX_HEIGHT, $grandchild);
            fit_height(MONTY.THUMB_MAX_HEIGHT, $child);
            // fit_height(MONTY.THUMB_MAX_HEIGHT, $body);

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

    function count_a_change(description) {
        cycle_of_last_change = num_cycles;
        description_of_last_change = description;
        num_changes++;
        // console.log("CHANGE", description);
        // EXAMPLE:
        //    CHANGE IFRAME.fit_height(300x400-225x300)
        //    CHANGE TWITTER-WIDGET.fit_height(220x421.063-156.7461401262994x300)
        //    CHANGE IMG.fit_height(300x468.281-192.19229479735458x300)
        //    CHANGE BLOCKQUOTE.fit_height(220x302-218.5430463576159x300)
    }

    function target_blank($element) {
        if ($element.length === 1 && $element.attr('target') !== '_blank') {
            $element.attr('target', '_blank');
            count_a_change("target_blank");
        }
    }

    function tag_width($element) {
        if ($element.length === 1 && ! is_defined($element.attr('data-iframe-width'))) {
            $element.attr('data-iframe-width', "x");
            // NOTE:  Tag elements for width determination.  This is part of the
            //        iFrameResizer option widthCalculationMethod: 'taggedElement'
            //        The value of this attribute doesn't appear to matter.
            count_a_change("tag_width");
        }
    }

    function fit_width(max_width, $element) {
        if ($element.length === 1 && max_width < $element.width()) {
            var old_width = $element.width();
            var old_height = $element.height();
            var new_width = max_width;
            var new_height = old_height * max_width / old_width;
            $element.height(new_height);
            $element.width(new_width);
            // NOTE:  Once thought I saw a clue that order matters.
            //        Or maybe I was just desperately trying stuff.
            count_a_change($element[0].tagName + ".fit_width");
        }
    }

    function fit_height(max_height, $element) {
        if ($element.length === 1 && max_height < $element.height()) {
            var old_height = $element.height();
            var old_width = $element.width();
            var new_height = max_height;
            var new_width = old_width * max_height / old_height;
            $element.width(new_width);
            $element.height(new_height);
            count_a_change(
                $element[0].tagName + ".fit_height" +
                "(" +
                old_width.toFixed() +
                "x" +
                old_height.toFixed() +
                "-" +
                new_width.toFixed() +
                "x" +
                new_height.toFixed() +
                ")"
            );
        }
    }

    function youtube_embed_url(additional_parameters) {
        additional_parameters = additional_parameters || {};
        console.assert(MONTY.matcher_groups.length === 1);
        var url_inner_iframe = YOUTUBE_EMBED_PREFIX + MONTY.matcher_groups[0];

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
        console.assert(typeof _youtube_iframe_api_when_ready === 'function');
        console.assert(typeof window.YT === 'object');
        _youtube_iframe_api_when_ready();
    };
}

// noinspection JSUnusedGlobalSymbols
/**
 * @property YT
 * @property YT.Player
 */
function onYouTubeIframeAPIReady() {
    console.log("Outer YouTube api ready");
    embed_content_js.youtube_iframe_api_ready();
}

/**
 * Polyfill for window.URLSearchParams.get(), so it works in IE11
 *
 * THANKS:  https://stackoverflow.com/a/50756253/673991
 */
(function (w) {
    w.URLSearchParams = w.URLSearchParams || function (searchString) {
        var self = this;
        self.searchString = searchString;
        self.get = function (name) {
            var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
            if (results === null) {
                return null;
            } else {
                return decodeURI(results[1]) || 0;
            }
        };
    }
})(window);

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
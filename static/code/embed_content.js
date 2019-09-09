// embed_content.js - for oembed iframe

// noinspection JSUnusedGlobalSymbols
/**
 * @param window
 * @param {function} $
 * @param {function} $.getScript
 * @param {function} $.param
 * @param {object}  MONTY
 * @param {array}   MONTY.matcher_groups
 * @param {object}  MONTY.oembed
 * @param {string}  MONTY.target_origin
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

    // TODO:  Why does twitter + IE11 + fit_height() go on for all repetitions?

    var num_cycles = 0;
    var num_changes = 0;
    var cycle_of_last_change = 0;
    var description_of_last_change = "(none)";
    var $body;

    var url_outer_iframe = query_get('url');
    var domain = domain_from_url(url_outer_iframe);
    var domain_simple = domain
        .toLowerCase()
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
    ;
    var is_pop_up = query_get('is_pop_up', 'false') === 'true';
    var is_pop_youtube = is_pop_up && (
        domain_simple === 'youtube' ||
        domain_simple === 'youtu.be'
    );
    var THUMB_MAX_WIDTH = 300;
    var THUMB_MAX_HEIGHT = 300;
    var YOUTUBE_EMBED_PREFIX = 'https://www.youtube.com/embed/';
    // THANKS:  URL, https://developers.google.com/youtube/player_parameters#Manual_IFrame_Embeds

    // console.assert(domain === MONTY.domain);
    // console.assert(domain_simple === MONTY.domain_simple);
    // console.assert(is_pop_youtube === MONTY.is_pop_youtube);

    var did_resizer_ready_itself = false;
    var moment_called = new Date();

    window.iFrameResizer = {
        targetOrigin: MONTY.target_origin,
        onReady: function iframe_resizer_content_ready() {
            did_resizer_ready_itself = true;
            var moment_resizer = new Date();
            var lag_resizer = moment_resizer - moment_called;

            $(window.document).ready(function () {
                var moment_jquery = new Date();
                var lag_jquery = moment_jquery - moment_resizer;

                function lag_report() {
                    return lag_resizer.toFixed() + "ms " + lag_jquery.toFixed() + "ms";
                    // EXAMPLE:  39-58ms for popup
                    // EXAMPLE:  376-601ms for embedded thumbnails
                }

                $body = $(window.document.body);
                if (is_pop_youtube) {
                    youtube_iframe_api(function () {
                        var $you_frame = $('<iframe>', {
                            id: 'youtube_iframe',
                            width: MONTY.oembed.width,
                            height: MONTY.oembed.height,
                            type: 'text/html',
                            src: youtube_embed_url(),
                            frameborder: '0'
                        });
                        tag_width($you_frame);
                        fit_width(THUMB_MAX_WIDTH, $you_frame);
                        fit_height(THUMB_MAX_HEIGHT, $you_frame);
                        $body.append($you_frame);
                        $you_frame.animate({
                            width: query_get('width'),
                            height: query_get('height')
                        });
                        console.log(
                            "popup_" + query_get('idn') + ".",
                            domain_simple, "api ready,",
                            "lag", lag_report()
                        );
                    });
                } else {
                    $body.html(MONTY.oembed.html);
                    fix_embedded_content();
                    var interval = setInterval(function () {
                        if (num_cycles >= POLL_REPETITIONS) {
                            if (num_changes === 0) {
                                console.debug(
                                    domain_simple, "- no changes"
                                );
                            } else {
                                console.debug(
                                    query_get('idn') + ".",
                                    domain_simple, "-",
                                    num_changes, "changes,",
                                    "last", description_of_last_change,
                                    "cycle", cycle_of_last_change, "of", POLL_REPETITIONS,
                                    // "codes", JSON.stringify(MONTY.matcher_groups),
                                    "lag", lag_report()
                                );
                            }
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

                            // if (typeof window.parentIFrame === 'object') {
                            //     // NOTE:  Step 1 in the mother-daughter message demo.
                            //     window.parentIFrame.sendMessage(
                            //         {'foo':'bar'},
                            //         window.iFrameResizer.targetOrigin
                            //     );
                            // } else {
                            //     console.error("");
                            // }
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
                $('#youtube_iframe').animate({
                    width: message.width,
                    height: message.height
                });
                break;
            default:
                console.error("Undefined messaged action", message.action);
                break;
            }
            // NOTE:  Step 3 in the mother-daughter message demo.
            // console.log("Daughter Message In", window.parentIFrame.getId(), message);
            // EXAMPLE:  Daughter Message In iframe_1849 {moo: "butter"}
        }
    };

    if (am_i_in_an_iframe()) {
        $.getScript(
            'https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/' +
            'iframeResizer.contentWindow.js'
        );
    } else {
        // NOTE:  Make this page work stand-alone.  For development purposes.
        console.log("Stand-alone embed.");
        window.iFrameResizer.onReady();
    }

    // noinspection JSUnusedLocalSymbols
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

    function domain_from_url(url) {
        return $('<a>').prop('href', url).prop('hostname');
        // THANKS:  domain from url, https://stackoverflow.com/a/4815665/673991
    }
    console.assert('example.com' === domain_from_url('https://example.com/?foo=bar'), domain_from_url('https://example.com/?foo=bar'));

    function query_string_from_url(url) {
        return $('<a>').prop('href', url).prop('search');
        // THANKS:  url parts, https://stackoverflow.com/a/28772794/673991
    }
    console.assert('?foo=bar' === query_string_from_url('https://example.com/?foo=bar'), query_string_from_url('https://example.com/?foo=bar'));

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
        tag_width($grandchild);

        var is_pop_up = query_get('is_pop_up', false);
        if (is_pop_up) {
            var pop_width = query_get('width', 'auto');
            var pop_height = query_get('height', 'auto');
            $body.css({width: pop_width, height: pop_height});
            $child.css({width: pop_width, height: pop_height});
        } else {
            fit_width(THUMB_MAX_WIDTH, $grandchild);
            fit_width(THUMB_MAX_WIDTH, $child);
            // fit_width(THUMB_MAX_WIDTH, $body);

            fit_height(THUMB_MAX_HEIGHT, $grandchild);
            fit_height(THUMB_MAX_HEIGHT, $child);
            // fit_height(THUMB_MAX_HEIGHT, $body);
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
        if ($element.length === 1 && 'undefined' === typeof $element.attr('data-iframe-width')) {
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

    function youtube_embed_url() {
        console.assert(MONTY.matcher_groups.length === 1);
        var url_inner_iframe = YOUTUBE_EMBED_PREFIX + MONTY.matcher_groups[0];

        // NOTE:  Now copy the t=NNN parameter from the outer URL
        //        to the start=NNN parameter of the inner URL
        // SEE:  embed start, https://developers.google.com/youtube/player_parameters#start

        var you_params = new window.URLSearchParams(query_string_from_url(url_outer_iframe));
        var t_start = you_params.get('t');
        if (t_start !== null) {
            url_inner_iframe += '?' + $.param({start: t_start});
        }
        return url_inner_iframe;
    }

    function query_get(name, default_value) {
        var query_params = new window.URLSearchParams(window.location.search);
        var value = query_params.get(name);
        if (value === null) {
            return default_value;
        } else {
            return value;
        }
    }

    var _youtube_iframe_api_when_ready = null;

    function youtube_iframe_api(when_ready) {
        console.assert(_youtube_iframe_api_when_ready === null);
        console.assert(typeof window.YT === 'undefined');   // TODO:  Support multiple calls
        $.getScript("https://www.youtube.com/iframe_api");
        _youtube_iframe_api_when_ready = when_ready;
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
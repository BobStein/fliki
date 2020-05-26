// NoEmbed media handler

// noinspection JSUnusedLocalSymbols
(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    var MAX_CAPTION_LENGTH = 100;  // Because some oembed titles are huge
    var media = {
        description_short: "noembed",   // should be unique within a domain
        description_long: "noembed.com handler for qiki media applications",
        url_patterns: [
            RegExp("^https?://(?:www\\.)?vimeo\\.com/.+$"),
            RegExp("^https?://(?:www|mobile\\.)?twitter\\.com/(?:#!/)?([^/]+)/status(?:es)?/(\\d+)$"),
            RegExp("^https?://twitter\\.com/.*/status/.*$"),
            RegExp("^https?://.*\\.flickr\\.com/photos/.*$"),
            RegExp("^https?://flic\\.kr/p/.*$"),
            RegExp("^https?://www\\.(dropbox\\.com/s/.+\\.(?:jpg|png|gif))$"),
            RegExp("^https?://db\\.tt/[a-zA-Z0-9]+$"),
            RegExp("^https?://soundcloud\\.com/.*$"),
            RegExp("^https?://www\\.dailymotion\\.com/video/.*$")
        ],
        render_thumb: function noembed_render_thumb(cont) {
            var that = this;
            console.assert(that.description_short === "noembed");
            console.assert(that === cont.handler.media);   // Hint object organization could improve
            qoolbar.post('noembed_meta', {
                url: cont.content
            }, function (oembed_response) {
                var oembed = oembed_response.oembed;

                var is_title_a_copy_of_url = oembed.title === oembed.url;
                // NOTE:  Twitter does this, title same as url, WTF?!?
                //        https://twitter.com/ICRC/status/799571646331912192
                //        possibly because Twitter titles contain the tweet, so can be long.
                //        but in that case author_name === 'ICRC'
                //        Another example from facebook:
                //        https://www.facebook.com/priscila.s.iwama/videos/10204886348423453/
                //        And that oembed has no thumbnail_url
                //        Okay trying the official facebook oembed endpoint, there is no title, so
                //        it's probably noembed.com that copies the url to the title.

                var is_error_usable = is_laden(oembed.error);
                var is_title_usable = is_laden(oembed.title) && ! is_title_a_copy_of_url;
                var is_caption_usable = is_laden(cont.caption_text);
                var is_author_usable = is_laden(oembed.author_name);
                var caption_for_media;
                if (is_error_usable) {
                    console.warn("Not an oembed URL", cont.content, oembed.error);
                    caption_for_media = "(" + oembed.error + ")";
                } else if (is_title_usable) {
                    caption_for_media = oembed.title + " (" + cont.media_domain + ")";
                } else if (is_caption_usable) {
                    caption_for_media = cont.caption_text + " (" + cont.media_domain + ")";
                } else if (is_author_usable) {
                    caption_for_media = oembed.author_name + " (" + cont.media_domain + ")";
                } else {
                    caption_for_media = "(neither title nor author, on " + cont.media_domain + ")";
                }
                caption_for_media = caption_for_media.substr(0, MAX_CAPTION_LENGTH);
                if (typeof oembed.error === 'undefined') {
                    if (typeof oembed.thumbnail_url === 'string') {
                        cont.thumb_image(
                            oembed.thumbnail_url,
                            caption_for_media,
                            function thumb_url_error() {
                                console.warn(
                                    cont.media_domain,
                                    "busted thumb",
                                    oembed.thumbnail_url,
                                    "-- revert to iframe"
                                );
                                cont.live_media_iframe({url: cont.media_url});
                            }
                        );
                    } else {   // oembed data is missing a thumbnail URL
                        cont.live_media_iframe({url: cont.media_url});
                    }
                } else {   // oembed error message
                    var error_message;
                    if (cont.media_domain === 'no_domain') {
                        error_message = oembed.error;
                    } else {
                        error_message = oembed.error + " for '" + cont.media_domain + "'";
                    }
                    cont.render_error(error_message)
                    // EXAMPLE:  no matching providers found for 'adage'
                    // EXAMPLE:  no matching providers found for 'pinterest'
                }
            });
        },
        can_play: function (_) { return false; }   // Noembed is no help animating an embed.
    };
    window.qiki.media_register(media);
}(window, jQuery));

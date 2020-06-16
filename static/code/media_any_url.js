// NoEmbed media handler - fallback for all URLs not matched by other handlers.

// noinspection JSUnusedLocalSymbols
(function (window, $) {
    var media = {
        description_short: "any url",   // should be unique within a domain
        description_long: "URL fallback handler for qiki media applications",
        url_patterns: [
            RegExp("^https?://")
        ],
        render_thumb: function noembed_render_thumb(cont, _) {
            var that = this;
            console.assert(that.description_short === "any url");
            console.assert(that === cont.handler.media);   // Hint object organization could improve
             /**
             * @param oembed_response
             * @param oembed_response.oembed
             * @param oembed_response.oembed.author_name
             * @param oembed_response.oembed.error
             * @param oembed_response.oembed.provider_name
             * @param oembed_response.oembed.thumbnail_url
             * @param oembed_response.oembed.title
             * @param oembed_response.oembed.url
             */
           qoolbar.post('noembed_meta', {
                url: cont.content
            }, function (oembed_response) {
                var oembed = oembed_response.oembed;
                if (is_laden(oembed.error)) {
                    if (cont.media_domain === 'no_domain') {
                        cont.render_error(oembed.error);
                    } else {
                        cont.render_error(oembed.error + " for '" + cont.media_domain + "'");
                    }
                } else {
                    // NOTE:  No check for 'no_domain' here because it almost certainly would have
                    //        resulted in an oembed.error.
                    var provider_name = oembed.provider_name || "((unspecified))";
                    if (typeof oembed.thumbnail_url === 'string') {
                        cont.render_error(
                            cont.media_domain +
                            " is not yet supported, though noembed may support it. " +
                            "Provider: " +
                            provider_name
                        );
                    } else {   // oembed data is missing a thumbnail URL
                        cont.render_error(
                            cont.media_domain +
                            " is not supported.  noembed provides some info but not a thumbnail. " +
                            "Provider: " +
                            provider_name
                        );
                        // EXAMPLE:  facebook is not supported.
                        //           noembed provides some info but not a thumbnail.
                        //           Provider: Facebook
                    }
                }
            });
        },
        can_play: function (_) { return false; }
    };
    window.qiki.media_register(media);
}(window, jQuery));

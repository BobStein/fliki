// YouTube media handler

(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    window.qiki.media_register({
        description_short: "youtube",   // should be unique within a domain
        description_long: "YouTube handler for qiki media applications",
        url_patterns: [
            "https?://(?:[^\\.]+\\.)?youtube\\.com/watch/?\\?(?:.+&)?v=([^&]+)",
            "https?://(?:[^\\.]+\\.)?(?:youtu\\.be|youtube\\.com/embed)/([a-zA-Z0-9_-]+)"
            // THANKS:  Media URL patterns, https://noembed.com/providers
        ],
        render_thumb: function youtube_render_thumb(cont, media_url, media_match) {
            var youtube_id = media_match[1];
            console.assert(typeof youtube_id === 'string' && youtube_id.length === 11);
            thumb_media_img(
                cont,
                media_url,
                youtube_id,
                function youtube_render_thumb_fallback_to_iframe() {
                    live_media_iframe(cont, media_url, youtube_id);
                }
            );
        },
        render_screen: function youtube_render_screen(cont, media_url, media_match, extra_parameters) {
            var youtube_id = media_match[1];
            console.assert(typeof youtube_id === 'string' && youtube_id.length === 11);
            live_media_iframe(cont, media_url, youtube_id);
        }
    });

    function live_media_iframe(cont, media_url, youtube_id, more_parameters) {
        // TODO:  e.g. <iframe src="https://www.youtube.com/embed/o9tDO3HK20Q?enablejsapi=1" ...>
        //        Same object generation as $('<iframe>', {...}); in embed_content.js
        //        We will bypass <iframe src=".../meta/oembed/...">
        //        because we already know how to handle youtube media.
        //        (In other words without cross-site iframe??)
    }

    /**
     * Create an <img> DOM object.  Install it on a contribution's render bar.
     *
     * @param cont
     * @param media_url
     * @param youtube_id
     * @param error_callback
     */
    function thumb_media_img(cont, media_url, youtube_id, error_callback) {
        var thumb_url = youtube_mq_url(youtube_id);
        var caption = "YouTube page for " + cont.caption_text;
        var $a = $('<a>', {
            id: 'thumb_' + cont.id_attribute,
            class: 'thumb-link',
            href: media_url,
            target: '_blank',
            title: caption
        });
        // noinspection HtmlRequiredAltAttribute,RequiredAttributes
        var $img = $('<img>', {
            class: 'thumb thumb-loading',
            alt: caption
        });
        cont.$render_bar.empty().append($a);
        $a.append($img);
        cont.fix_caption_width('thumb loading');
        $img.one('load.thumb1', function render_img_load() {
            $img.off('.thumb1');
            $img.removeClass('thumb-loading');
            $img.addClass('thumb-loaded');
            cont.fix_caption_width('thumb loaded');
        });
        $img.one('error.thumb1', function render_img_error() {
            $img.off('.thumb1');
            console.log("YouTube broken thumb", thumb_url);
            error_callback();
        });
        // NOTE:  .src is set after the load and error event handlers,
        //        so one of those handlers is sure to get called.
        $img.attr('src', thumb_url);
    }

    /**
     * Medium quality thumbnail jpeg.
     *
     * @param youtube_id - e.g. 'o9tDO3HK20Q'
     * @return {string}
     */
    function youtube_mq_url(youtube_id) {
        return 'https://img.youtube.com/vi/' + youtube_id + '/mqdefault.jpg';
    }
}(window, jQuery));

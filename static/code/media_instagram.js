// Instagram media handler

(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    window.qiki.media_register({
        description_short: "instagram",   // should be unique within a domain
        description_long: "Instagram handler for qiki media applications",
        url_patterns: [
            RegExp("^https?://www\\.instagram\\.com/p/([^/]+)/?$"),
            RegExp(      "^https?://instagram\\.com/p/([^/]+)/?$"),
            RegExp("^https?://www\\.instagr\\.am/p/([^/]+)/?$"),
            RegExp(      "^https?://instagr\\.am/p/([^/]+)/?$")
        ],
        render_thumb: function instagram_render_thumb(cont, media_url, media_match) {
            var media_id = media_match[1];
            console.assert(
                is_valid_media_id(media_id),
                "Not an Instagram ID for thumb",
                "'" + media_id + "'"
            );
            render_media_img(
                cont,
                media_url,
                media_id,
                THUMB_SIZE,
                function instagram_thumb_error() {
                    render_media_img(
                        cont,
                        media_url,
                        media_id,
                        LARGE_SIZE,
                        function instagram_large_error() {
                            console.warn("Instagram thumb failure.");
                        }
                    );
                }
            );
        },
        render_screen: function instagram_render_screen(cont, media_url, media_match, extra_parameters) {
            var media_id = media_match[1];
            console.assert(
                is_valid_media_id(media_id),
                "Not an Instagram ID for screen",
                "'" + media_id + "'"
            );
            render_media_img(
                cont,
                media_url,
                media_id,
                LARGE_SIZE,
                function instagram_large_error() {
                    console.warn("Instagram screen failure.");
                }
            );
        }
    });

    function is_valid_media_id(media_id) {
        return (
            typeof media_id === 'string' &&
            media_id.length >= 9 &&   // e.g. 10 characters 'fA9uwTtkSN'
            media_id.length <= 13     // e.g. 11 characters 'B8zk1SAllSy'
        );
    }

    // noinspection JSUnusedLocalSymbols
    function live_media_iframe(cont, media_url, media_id, more_parameters) {
        // TODO:  e.g. <iframe src="https://www.instagram.com/p/fA9uwTtkSN" ...>
        //        Bypass <iframe src=".../meta/oembed/...">
        //        because we already know how to handle instagram media.
        //        (In other words without cross-site iframe??)
    }

    /**
     * Create an <img> DOM object.  Install it on a contribution's render bar.
     *
     * @param cont
     * @param media_url
     * @param media_id
     * @param size_code
     * @param error_callback
     */
    function render_media_img(cont, media_url, media_id, size_code, error_callback) {
        var thumb_url = image_url(media_id, size_code);
        var caption = "Instagram page for " + cont.caption_text;
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

    // noinspection JSUnusedLocalSymbols
    var MEDIUM_SIZE = 'm';
    var LARGE_SIZE = 'l';
    var THUMB_SIZE = 't';

    /**
     * Instagram image jpeg.
     *
     * SEE:  https://stackoverflow.com/a/57517881/673991
     * THANKS:  https://www.instagram.com/developer/embedding/#media_redirect
     *
     * @param media_id - e.g. 'fA9uwTtkSN'
     * @param size_code - t=thumbnail, m=medium, l=large
     * @return {string}
     */
    function image_url(media_id, size_code) {
        return 'https://instagram.com/p/' + media_id + '/media/?size=' + size_code;
    }
}(window, jQuery));

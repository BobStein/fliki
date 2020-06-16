// Instagram media handler

// noinspection JSUnusedLocalSymbols
(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    var media = {
        description_short: "instagram",   // should be unique within a domain
        description_long: "Instagram handler for qiki media applications",
        url_patterns: [
            RegExp('^https?://(?:www\\.)?(?:instagram\\.com|instagr\\.am)/p/([^/]+)/?$')
        ],
        render_thumb: function instagram_render_thumb(cont, then) {
            var that = this;
            console.assert(that.description_short === "instagram");
            console.assert(that === cont.handler.media);   // Hint object organization could improve
            var pattern_match_object = cont.handler.match_object;
            console.assert(pattern_match_object.length === 2, cont.content, pattern_match_object);
            var media_id = pattern_match_object[1];
            console.assert(is_valid_media_id(media_id));
            var caption = cont.caption_text + " (" + that.description_short + ")";
            cont.thumb_image(
                image_url(media_id, THUMB_SIZE),
                caption,
                then,
                function instagram_render_thumb_take_2() {
                    cont.thumb_image(
                        image_url(media_id, MEDIUM_SIZE),
                        caption,
                        then,
                        function instagram_render_thumb_take_3() {
                            cont.thumb_image(
                                image_url(media_id, LARGE_SIZE),
                                caption,
                                then,
                                function instagram_render_thumb_give_up() {
                                    console.error("No instagram images", cont.content);
                                }
                            );
                        }
                    );
                }
            );
        },
        can_play: function (cont) { return false; }
    };
    console.assert(media.url_patterns[0].test('https://www.instagram.com/p/BNCeThsAhVT/'));
    console.assert(media.url_patterns[0].test('https://instagram.com/p/BNCeThsAhVT/'));
    console.assert(media.url_patterns[0].test('https://instagr.am/p/BNCeThsAhVT/'));
    window.qiki.media_register(media);

    function is_valid_media_id(media_id) {
        return (
            typeof media_id === 'string' &&
            media_id.length >= 9 &&   // e.g. 10 characters 'fA9uwTtkSN'
            media_id.length <= 13     // e.g. 11 characters 'B8zk1SAllSy'
        );
    }

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

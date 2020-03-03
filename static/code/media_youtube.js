// YouTube media handler

// noinspection JSUnusedLocalSymbols
(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    var media = {
        description_short: "youtube",   // should be unique within a domain
        description_long: "YouTube handler for qiki media applications",
        url_patterns: [
            RegExp("^https?://(?:[^.]+\\.)?youtube\\.com/watch/?\\?(?:.+&)?v=([a-zA-Z0-9_-]+)")
            // THANKS:  Media URL patterns, https://noembed.com/providers
        ],
        render_thumb: function youtube_render_thumb(cont, pattern_match_object) {
            console.assert(pattern_match_object.length === 1, cont.content, pattern_match_object);
            var media_id = pattern_match_object[1];
            console.assert(typeof media_id === 'string' && media_id.length === 11);
            var thumbnail_url = 'https://img.youtube.com/vi/' + media_id + '/mqdefault.jpg';
            // THANKS:  Thumbnail options, https://stackoverflow.com/a/20542029/673991
            var caption = cont.caption_text + " (youtube)";
            cont.thumb_image(
                thumbnail_url,
                caption,
                function youtube_render_thumb_take_2() {
                    thumbnail_url = 'https://img.youtube.com/vi/' + media_id + '/2.jpg';
                    cont.thumb_image(
                        thumbnail_url,
                        caption,
                        function youtube_render_thumb_give_up() {
                            console.error("No youtube images", cont.content);
                        }
                    );
                }
            );
        }
    };
    function assert_match( url) {
        var match_object = url.match(media.url_patterns[0]);
        console.assert(match_object !== null, url);
        if (match_object !== null) {
            console.assert(match_object[1] === 'ID_11_CHARS', url);
        }
    }
    assert_match('https://www.youtube.com/watch?v=ID_11_CHARS');
    assert_match('https://www.youtube.com/watch?v=ID_11_CHARS&feature=em-uploademail');
    assert_match('https://www.youtube.com/embed/ID_11_CHARS?start=1034&end=1247');
    assert_match('https://youtu.be/ID_11_CHARS?t=42');
    window.qiki.media_register(media);
}(window, jQuery));

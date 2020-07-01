// YouTube media handler

// noinspection JSUnusedLocalSymbols
(function (window, $) {
    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
    var media = {
        description_short: "youtube",   // should be unique within a domain
        description_long: "YouTube handler for qiki media applications",
        url_patterns: [
            RegExp("^https?://(?:[^.]+\\.)?youtube\\.com/watch/?\\?(?:.+&)?v=([a-zA-Z0-9_-]+)"),
            RegExp("^https?://(?:[^.]+\\.)?(?:youtu\\.be|youtube\\.com/embed)/([a-zA-Z0-9_-]+)")
            // THANKS:  Media URL patterns, https://noembed.com/providers
        ],
        render_thumb: function youtube_render_thumb(cont, then) {
            var that = this;
            console.assert(that.description_short === "youtube");
            console.assert(that === cont.handler.media);   // Hint object organization could improve
            var pattern_match_object = cont.handler.match_object;
            console.assert(pattern_match_object.length === 2, cont.content, pattern_match_object);
            var media_id = pattern_match_object[1];
            type_should_be(media_id, 'String') && console.assert(media_id.length === 11);
            var thumbnail_1 = 'https://img.youtube.com/vi/' + media_id + '/mqdefault.jpg';
            var thumbnail_2 = 'https://img.youtube.com/vi/' + media_id + '/2.jpg';
            // THANKS:  Thumbnail options, https://stackoverflow.com/a/20542029/673991
            var caption = cont.caption_text + " (" + that.description_short + ")";
            cont.thumb_image(
                thumbnail_1,
                caption,
                then,
                function youtube_render_thumb_take_2() {
                    cont.thumb_image(
                        thumbnail_2,
                        caption,
                        then,
                        function youtube_render_thumb_give_up() {
                            cont.render_error("YouTube video not found");
                            // NOTE:  Never actually gets here
                            // SEE:  https://img.youtube.com/vi/BOGUS_BOGUS/mqdefault.jpg
                        }
                    );
                }
            );
        },
        can_play: function (cont) { return true; }
    };
    function assert_match(index, url) {
        var match_object = url.match(media.url_patterns[index]);
        console.assert(match_object !== null, url);
        if (match_object !== null) {
            console.assert(match_object.length === 2);
            console.assert(match_object[1] === 'ID_11_CHARS', url);
        }
    }
    assert_match(0, 'https://www.youtube.com/watch?v=ID_11_CHARS');
    assert_match(0, 'https://www.youtube.com/watch?v=ID_11_CHARS&feature=em-uploademail');
    assert_match(1, 'https://www.youtube.com/embed/ID_11_CHARS?start=1034&end=1247');
    assert_match(1, 'https://youtu.be/ID_11_CHARS?t=42');
    window.qiki.media_register(media);
}(window, jQuery));

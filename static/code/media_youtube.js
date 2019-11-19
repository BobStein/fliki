// YouTube media handler
(function (window, $) {
    // noinspection JSUnusedGlobalSymbols
    js_for_contribution.media_register({
        description_short: "youtube",   // should be unique within a domain
        description_long: "YouTube handler for fliki Contribution applications",
        render_thumb: function youtube_render_thumb(cont, media_url, media_match) {
            var youtube_id = media_match[1];
            console.assert(typeof youtube_id === 'string' && youtube_id.length === 11);
            thumb_media_img(
                cont,
                media_url,
                youtube_id,
                function youtube_img_error() {
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
    }

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
        // NOTE:  .src is set below so either load or error above is sure to happen.
        $img.attr('src', thumb_url);
    }

    function youtube_mq_url(youtube_id) {
        return 'https://img.youtube.com/vi/' + youtube_id + '/mqdefault.jpg';
    }
}(window, jQuery));

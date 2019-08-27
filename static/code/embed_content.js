// embed_content.js - for oembed iframe

var POLL_MILLISECONDS = 1000;   // Try this often to "fix" embedded content
var POLL_REPETITIONS = 10;   // Try this many times to "fix" embedded content
// NOTE:  If this doesn't go on long enough, the fancy-pants embedded html
//        from the provider may not have enough time to transmogrify
//        itself into whatever elements it's going to become.

// TODO:  Why does twitter + IE11 + fit_height() go on for all repetitions?

var num_cycles = 0;
var num_changes = 0;
var cycle_of_last_change = 0;
var description_of_last_change = "(none)";

/**
 * @param window
 * @param {function} $
 */
(function(window, $) {
    console.assert(typeof $ === 'function');
    console.assert(typeof window === 'object');

    fix_embedded_content();

    // window.iFrameResizer = {
    //     onReady: function() {
            $(window.document).ready(function () {
                var interval = setInterval(function () {
                    if (num_cycles >= POLL_REPETITIONS) {
                        var domain = $('body').data('oembed-domain');
                        var domain_simple = domain.replace(/\.com$/, "").replace(/^www\./, "");
                        if (num_changes === 0) {
                            console.debug(
                                "embed_contents -", domain_simple, "- no changes"
                            );
                        } else {
                            console.debug(
                                "embed_contents -", domain_simple, "-",
                                num_changes, "changes,",
                                "last was", description_of_last_change,
                                "on cycle", cycle_of_last_change, "of", POLL_REPETITIONS
                            );
                        }
                        clearInterval(interval);
                        return;
                    }
                    num_cycles++;
                    fix_embedded_content();
                }, POLL_MILLISECONDS);
            });
    //     }
    // };

    function fix_embedded_content() {
        var $body = $(window.document.body);
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

        fit_width(300, $body);
        fit_width(300, $child);
        fit_width(300, $grandchild);

        fit_height(300, $body);
        fit_height(300, $child);
        fit_height(300, $grandchild);

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
        //        which pops up a new browser tab.

    }

    function count_a_change(description) {
        cycle_of_last_change = num_cycles;
        description_of_last_change = description;
        num_changes++;
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
            var new_width = max_width;
            var new_height = $element.height() * max_width / $element.width();
            $element.height(new_height);
            $element.width(new_width);
            // NOTE:  Once thought I saw a clue that order matters.
            //        Or maybe I was just desperately trying stuff.
            count_a_change($element[0].tagName + ".fit_width");
        }
    }

    function fit_height(max_height, $element) {
        if ($element.length === 1 && max_height < $element.height()) {
            var new_height = max_height;
            var new_width = $element.width() * max_height / $element.height();
            $element.width(new_width);
            $element.height(new_height);
            count_a_change($element[0].tagName + ".fit_height");
        }
    }
})(window, jQuery);

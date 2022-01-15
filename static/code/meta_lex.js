// FALSE WARNING:  Unused function js_for_meta_lex
//                 Because PyCharm doesn't see call to js_for_meta_lex() in fliki.py.
// FALSE WARNING:  'if' statement can be simplified
//                 Because sometimes true and false should be more explicit.
// noinspection JSUnusedGlobalSymbols,RedundantIfStatementJS

// meta_lex.js
// -----------
// Render the geeky innards of a lex in the cloud.
// requires lex.js
/**
 * JavaScript for the /meta/lex
 *
 * @param window
 * @param $
 * @param MONTY
 * @param MONTY.LEX_URL
 * @param MONTY.NOW
 */
function js_for_meta_lex(window, $, MONTY) {

    $(function document_ready() {
        // FALSE WARNING:  Invalid number of arguments, expected 0
        //                 because PyCharm doesn't see th qiki.Lex class in lex.js
        // noinspection JSCheckFunctionSignatures
        var lex = new LexMeta(MONTY.LEX_URL);
        lex.word_class = WordMeta;
        lex.$ol = $('<ol>', {class: 'lex-list'});
        lex.$ol.hide();
        lex.$progress = $('<div>', {id: 'progress'});
        $(window.document.body).append(lex.$progress);
        $(window.document.body).append(lex.$ol);
        lex.$progress.append("Scanning ... ");
        window.setTimeout(function () {
            lex.scan(function () {
                lex.$progress.append(since() + " ... Rendering ... ");
                window.setTimeout(function () {
                    lex.$ol.show();
                    lex.$progress.append(since() + " ... Finishing ... ");
                    window.setTimeout(function () {
                        lex.$progress.text("");
                        console.log(
                            lex.constructor.name, "has",
                            lex.num_lines, "lines,",
                            lex.num_def, "definition-words,",
                            lex.num_ref, "reference-words",
                            lex
                        );
                    }, 100);
                }, 100);
            }, function (error_message) {
                lex.$ol.show();
                lex.$progress.text(error_message);
                lex.$progress.addClass('scan-fail');
            });
        }, 100);
    });

    var browse_time = seconds_since_1970();
    var since_last = browse_time;
    function since() {   // How long since since() was called?  E.g. " 2.9sec "
        var now = seconds_since_1970();
        var since_seconds = now - since_last;
        since_last = now;
        return " " + since_seconds.toFixed(1) + "sec ";
    }

    class LexMeta extends qiki.LexCloud {

        $progress = null;
        $ol = null;

        scan(url, done, fail) {
            var that = this;
            that.num_def = 0;
            that.num_ref = 0;
            that.word_rendered_previously = null;
            super.scan(url, function () {
                that.word_rendered_previously.render_whn_delta(null);
                // NOTE:  Show the triangle below the last word, indicating time since browsing.
                done();
            }, fail);

        }
        each_word(word) {
            var that = this;
            super.each_word(word);
            // TODO:  Move the following logic to the WordMeta constructor.
            //        Then we can get rid of each_word() everywhere.
            word.render(that.word_rendered_previously);
            that.$ol.append(word.$li);
            that.word_rendered_previously = word;
        }
        each_definition_word(word) {
            var that = this;
            super.each_definition_word(word);
            that.num_def++;
            // that.say(word.idn, word.obj.name.toUpperCase(), word.obj.fields.join(","));
        }
        // FALSE WARNING:  Unused method each_reference_word
        //                 because PyCharm doesn't see qiki.Lex in lex.js
        // noinspection JSUnusedGlobalSymbols
        each_reference_word(word) {
            var that = this;
            super.each_reference_word(word);
            that.num_ref++;
            // that.say(word.idn, word.vrb_name(), JSON.stringify(word.obj));
        }
    }

    class WordMeta extends qiki.Word {

        render(word_prev) {
            var that = this;
            that.$li = $('<li>', {id:that.idn, value:that.idn, class:'word-rendering'});
            var $statement = $('<span>');
            that.$li.append($statement);
            if (that.lex.is_early_in_the_scan() || that.is_definition()) {
                that.$li.addClass('definition-word');
                var is_reflexive = that.obj.parent === that.idn;
                var $name = $('<span>', {class: 'name'});
                var $amble = $('<span>', {class: 'amble'});
                $statement.append($name, " ", $amble);
                $name.text(that.obj.name);
                if (is_reflexive) {
                    that.$li.addClass('reflexive')
                    // $amble.text("is self-defined");
                } else {
                    var parent_word = that.lex.by_idn[that.obj.parent];
                    $amble.text(f("is a {parent_name}", {parent_name: parent_word.obj.name,}));
                }
                if (that.obj.fields.length > 0) {
                    var $fields = $('<span>', {class: 'fields'});
                    $statement.append($fields);
                    $fields.append(", with fields");
                    var separator = " ";
                    looper(that.obj.fields, function (_, field_idn) {
                        var field_definition = that.lex.by_idn[field_idn];
                        var $field_name = $('<span>', {class: 'field-name'});
                        $field_name.text(field_definition.obj.name);
                        $fields.append(separator);
                        $fields.append($field_name);
                        separator = ", ";
                    });
                }
            } else {
                that.$li.addClass('reference-word');
                var $sbj = $('<span>', {class: 'sbj'});
                var $vrb = $('<span>', {class: 'vrb'});
                var $obj = $('<span>', {class: 'obj'});
                $statement.append($sbj, " ", $vrb, " ", $obj);

                that.$li.toggleClass('anonymous', that.is_sbj_anonymous());
                that.$li.toggleClass('google-user', that.is_sbj_google_user());

                var sbj_class = that.render_sbj($sbj)
                that.$li.addClass(sbj_class);

                $vrb.text(that.vrb_name());

                $obj.text(JSON.stringify(that.obj));
            }

            var $whn = $('<span>', {class: 'whn'});
            that.$whn_delta = $('<svg>', {class: 'whn-delta'});
            $statement.append(" ", $whn, that.$whn_delta);
            that.render_whn($whn);
            if (is_specified(word_prev)) {
                word_prev.render_whn_delta(that);
                // NOTE:  render_whn_delta() deals with two words, but order is flipped.
            }
        }
        render_sbj($sbj) {
            var that = this;
            var sbj_class;
            if (that.sbj === that.lex.idn_of.lex) {
                $sbj.append($('<span>', {class:'lex'}).text("lex"));
                sbj_class = 'sbj-lex';
            } else if (has(that.lex.from_user, that.sbj)) {
                var user_info = that.lex.from_user[that.sbj];
                if (is_specified(user_info.icon)) {
                    // FALSE WARNING:  Element img doesn't have required attribute src
                    // FALSE WARNING:  Missing required 'alt' attribute
                    // noinspection HtmlRequiredAltAttribute,RequiredAttributes
                    var $icon = $('<img>', {class:'user-icon', src: user_info.icon});
                    if (is_specified(user_info.name)) {
                        $icon.attr('title', user_info.name);
                        $icon.attr('alt', user_info.name);
                    }
                    $sbj.append($icon);
                    sbj_class = 'sbj-icon';
                } else if (is_specified(user_info.name)) {
                    $sbj.append($('<span>', {class:'user-name'}).text(user_info.name));
                    sbj_class = 'sbj-name';
                } else {
                    $sbj.append($('<span>', {class:'user-literal'}).text(that.sbj));
                    sbj_class = 'sbj-unnamed';
                }
            } else if (that.is_sbj_anonymous()) {
                var anonymous_nits = that.sbj.slice(1);
                $sbj.append($('<span>', {class:'anonymous-nits'}).text(anonymous_nits.join(";")));
                sbj_class = 'sbj-unnamed-anonymous';
            } else if (that.is_sbj_google_user()) {
                var google_nits = that.sbj.slice(1);
                $sbj.append($('<span>', {class:'google-nits'}).text("google user " + google_nits.join(";")));
                sbj_class = 'sbj-unnamed-google';
            } else {
                $sbj.append($('<span>', {class:'unknown-sbj'}).text("UNKNOWN " + that.sbj.toString()));
                sbj_class = 'sbj-unknown';
            }
            return sbj_class;
        }
        render_whn($whn) {
            var that = this;
            var word_date = that.whn_date();
            var delta = delta_format(MONTY.NOW - that.whn_seconds());
            $whn.addClass(delta.units_long);
            $whn.text(delta.description_short);
            var fractional = that.whn_seconds() % 1.0;
            var then_utc = amend_fractional_seconds(word_date.toUTCString(), fractional);
            var then_local = amend_fractional_seconds(word_date.toLocaleString(), fractional);
            $whn.attr('title', f("{ago_long} ago: {then_utc} -or- {then_local} local", {
                ago_long: delta.description_long,
                then_utc: then_utc,
                then_local: then_local,
            }));
        }
        // render_whn_delta($li, $whn_delta, whn_seconds_previous) {
        /**
         * Draw the triangle indicating time between words, to the left of and below this word.
         *
         * Also draw a border between words separated by more than an hour.
         * The triangle is associated with the EARLIER word.
         * The border is associated with the LATER word.
         *
         * @param word_next - the word below, or null for the last word (triangle but no border).
         */
        render_whn_delta(word_next) {
            // NOTE:  The whn-delta triangle svg is inside the earlier element (`that` in this
            //        function).  I vaguely recall that is because putting it inside the later
            //        element led to some css headaches with it appearing underneath text.
            //        Or maybe it had to do with the double-fencepost problem of N words needing
            //        N-1 triangles plus one more triangle at the bottom to show since-load time.
            //        But that's not ideal if a line wraps, then the triangle should be at the
            //        bottom of the word, not at the bottom of the FIRST LINE of the word.
            //        Meta lex classic had the same problem.
            var that = this;
            var next_whn_seconds = is_specified(word_next) ? word_next.whn_seconds() : browse_time;
            var between = delta_format(next_whn_seconds - that.whn_seconds());
            if (is_specified(word_next) && between.num >= 60*60) {
                word_next.$li.css('border-top-color', gray_scale(log_time_scale(between.num, 333, 0)));
                if (between.num >= 7*24*60*60) {
                    word_next.$li.css('border-top-width', log_time_scale(between.num, -150, 100));
                    // XXX:  Not sure why -150 ended up here.  I think if the output is nonpositive
                    //       css ignores it and the border is 1 pixel high.  This and the if-clause
                    //       with the 1-week boundary is freaky but the results seem to look okay.
                }
            }
            // that.$whn_delta.text(between.description_short);


            function point_join(array_of_points) {
                return array_of_points.map(function each_point(p) {
                    return p.map(function each_coordinate(x) {
                        return x.toString();
                    }).join(',');
                }).join(' ');
            }

            var SREND_FONT_SIZE = 16;
            var MIN_SHOW_DELTA_SECONDS = 10;   // Below this, delta-whn times are hidden, unless you hover.
            var MAX_SCRUNCH_DELTA_SECONDS = .1;  // Below this delta-whn, sentences are scrunched together.
            var LIGHTEST_GRAY = 255;   // TODO:  Should be body background.  D.R.Y.
            var DARKEST_GRAY = 0;

            var $svg = that.$whn_delta;

            var h = SREND_FONT_SIZE * 1.20;
            var w = log_time_scale(between.num, h*0.33, h*3.00);
            if (isNaN(w)) { w = h*5.0; }   // NOTE:  Negative time busts the logarithm.
            var triangle_array = [[0,0], [0,h], [w,h/2]];
            var triangle_string = point_join(triangle_array);
            var gray = gray_scale(log_time_scale(between.num, LIGHTEST_GRAY, DARKEST_GRAY));
            // FALSE WARNING:  Element polygon doesn't have required attribute points
            // noinspection RequiredAttributes
            var $triangle = $('<polygon>', {points: triangle_string, fill: gray});
            $svg.append($triangle);

            var $triangle_title = $('<title>');
            $triangle.append($triangle_title);
            $triangle_title.text(between.description_long);

            var $text = $('<text>', {x: 1, y: 12, fill: between.num < 60 ? 'black' : 'white'});
            $svg.append($text);
            // $text.text(between.description_short);
            // $text.attr('x', '1');
            // $text.attr('y', '12');
            // $text.attr('fill', between.num < 60 ? 'black' : 'white');
            $text.addClass('whn-label');
            $text.toggleClass('whn-scrunch', between.num <= MAX_SCRUNCH_DELTA_SECONDS);
            $text.toggleClass('whn-hide', between.num < MIN_SHOW_DELTA_SECONDS);
            $text.text(between.description_short);

            var $text_title = $('<title>');
            $text.append($text_title);
            $text_title.text(between.description_long);

            that.$li.html(that.$li.html());
            // THANKS:  Crude way to construct SVG with jQuery, by "refreshing" the source,
            //          https://stackoverflow.com/a/13654655/673991
        }
    }

    /**
     * Convert x from an input range to an output range.  Interpolation if between.
     *
     * @param x
     * @param i_min \ range of input - x is somewhere on this continuum
     * @param i_max /
     * @param o_min \ range of output
     * @param o_max /
     * @return {*} - the same point on the output range, as x was on the input range
     */
    function scale(x, i_min, i_max, o_min, o_max) {
        return (x - i_min) * (o_max - o_min) / (i_max - i_min) + o_min;
    }
    console.assert(0.5 === scale(50,   0,100,   0,1.0));

    /**
     * Add milliseconds to a JavaScript timestamp.
     */
    function amend_fractional_seconds(timestamp, fractional_seconds) {
        var fractional_seconds_string = strip_leading_zeros(fractional_seconds.toFixed(3));
        var amended_timestamp = timestamp.replace(
            /\d\d:\d\d:\d\d/,
            "$&" + fractional_seconds_string
        );
        return amended_timestamp;
    }
    console.assert(
        'Sat, 23 Nov 2019 16:30:44.388 GMT' === amend_fractional_seconds(
        'Sat, 23 Nov 2019 16:30:44 GMT', 0.388)
    );

    var MINIMUM_RENDERED_SECONDS = 0.1;   // tenth of a second
    var MAXIMUM_RENDERED_SECONDS = 3600*24*365*100;   // century
    /**
     * Convert seconds to a log scale.
     *
     * @param seconds
     * @param output_min - output value to represent MINIMUM_RENDERED_SECONDS
     * @param output_max - output value to represent MAXIMUM_RENDERED_SECONDS
     * @return {*} - a number between output_min and output_max
     */
    function log_time_scale(seconds, output_min, output_max) {
        var log_sec = Math.log(seconds);
        var omin = output_min;
        var omax = output_max;
        var log_min = Math.log(MINIMUM_RENDERED_SECONDS);
        var log_max = Math.log(MAXIMUM_RENDERED_SECONDS);
        var output = scale(log_sec, log_min, log_max, omin, omax);
        output = Math.min(output, Math.max(omin, omax));
        output = Math.max(output, Math.min(omin, omax));
        return output;
    }

    function gray_scale(gray) {
        var HH = hex_2_digits(gray);
        return '#' + HH + HH + HH;
    }
    console.assert("#000000" === gray_scale(0));
    console.assert("#ffffff" === gray_scale(255));

    function hex_2_digits(number) {
        return ('00' + Math.round(number).toString(16)).substr(-2);
        // THANKS:  Hex with zero-pad, https://stackoverflow.com/a/9909166/673991
    }
    console.assert("01" === hex_2_digits(1));
    console.assert("ff" === hex_2_digits(255));
}

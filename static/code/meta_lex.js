
// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
 * @param listing_words
 * @param listing_words[].is_anonymous
 * @param MONTY
 * @param MONTY.IDN_LEX
 */
function js_for_meta_lex(window, $, listing_words, MONTY) {
    $(document).ready(function() {
        $('.word-rendering').each(function word_pass() {
            render_word(this);
        });
    });

    function render_word(word) {
        var $word = $(word);
        var $sbj_span = $('<span>', {class: 'sbj'});
        var $dash1 = $('<span>').text("-");
        var $vrb_span = $('<span>', {class: 'vrb'});
        var $dash2 = $('<span>').text("-");
        var $obj_span = $('<span>', {class: 'obj'});
        $word.append($sbj_span, $dash1, $vrb_span, $dash2, $obj_span);

        sub($word, 'sbj', $sbj_span);
        sub($word, 'vrb', $vrb_span);
        sub($word, 'obj', $obj_span);
        // var sbj_idn = $word.data('sbj');
        // var $sbj_word = $_from_id(sbj_idn);
        // if ($sbj_word.length === 1) {
        //     var $sbj_named = $('<span>', {class: 'named'});
        //     $sbj_span.append($sbj_named);
        //     var sbj_txt = $sbj_word.data('txt');
        //     $sbj_named.text(sbj_txt);
        // }
    }
    function $_from_id(id) {
        return $(selector_from_id(id));
    }
    function selector_from_id(id) {
        return '#' + $.escapeSelector(id);
    }
    function sub($word, sub, $span) {
        var $inner;
        var idn = $word.data(sub);
        if (listing_words.hasOwnProperty(idn)) {
            var listed = listing_words[idn];
            $inner = $('<span>');
            $span.append($inner);
            $inner
                .addClass('named')
                .text(listed.txt)
            ;
            if (listed.is_anonymous) {
                $inner.addClass('anonymous');
            }
        } else {
            var $faraway_word = $_from_id(idn);
            if ($faraway_word.length === 1) {
                $inner = $('<span>');
                $span.append($inner);
                var faraway_txt = $faraway_word.data('txt');
                $inner
                    .addClass('named')
                    .text(faraway_txt)
                ;
                if (idn === MONTY.IDN_LEX) {
                    $inner.addClass('lex');
                }
            }
        }
    }
}

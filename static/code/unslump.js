// Stuff for unslumping.org for now

// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
 * @param MONTY
 * @param MONTY.AJAX_URL
 * @param MONTY.me_idn
 * @param MONTY.lex_idn
 */
function js_for_unslumping(window, $, MONTY) {

    qoolbar.ajax_url(MONTY.AJAX_URL);
    $(document).ready(function() {
        qoolbar.i_am(MONTY.me_idn);
        var $status =  $('#status');
        $status.text("Loading qoolbar...");
        qoolbar.html('#my-qoolbar', function() {
            $status.text("Decorating words...");
            qoolbar.bling('.word');
            $status.text("");
        });
        qoolbar.target('.word');   // Each of these elements must have a data-idn attribute.
        $(document).on('click', '#enter_ump', function ump_click() {
            var text_ump = $('#text_ump').val();
            qoolbar.post(
                'sentence',
                {
                    vrb_txt: 'unslump',
                    obj_idn: MONTY.lex_idn,
                    txt: text_ump
                },
                function ump_done(response) {
                    // var new_words = $.parseJSON(response.new_words);
                    // console.log("Ump", new_words.length, new_words[0].idn, new_words[0].txt);
                });
        });
        $('#show_anonymous').on('change', function () {
            enforce_anonymous();
        });
        enforce_anonymous();
    });

    function enforce_anonymous() {
        if ($('#show_anonymous').is(':enabled:checked')) {
            $('.anonymous').removeClass('anonymous_hide');
        } else {
            $('.anonymous').addClass('anonymous_hide');
        }
    }
}

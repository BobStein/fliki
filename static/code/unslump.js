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
        $(document).on('click', '#enter_ump', function ump_click() {
            var text_ump = $('#text_ump').val();
            console.debug("Enter unslump", text_ump);
            qoolbar.post(
                'sentence',
                {
                    vrb_txt: 'unslump',
                    obj_idn: MONTY.lex_idn,
                    txt: text_ump
                },
                function ump_done(response) {
                    var new_words = $.parseJSON(response.new_words);
                    console.log("Ump", new_words.length, new_words[0].idn, new_words[0].txt);
                });
        });
    });
}

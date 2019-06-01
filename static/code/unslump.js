// Stuff for unslumping.org for now

// noinspection JSUnusedGlobalSymbols
/**
 *
 * @param window
 * @param $
 * @param MONTY
 * @param MONTY.AJAX_URL
 * @param MONTY.me_idn
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
        $(document).on('click', '#enter_ump', function enter_ump_click() {
            var text_ump = $('#text_ump').val();
            console.debug("Enter unslump", text_ump);
        });
    });
}

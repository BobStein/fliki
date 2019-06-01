// Stuff for unslumping.org for now

function js_for_unslumping(window, $, MONTY) {

    qoolbar.ajax_url(MONTY.AJAX_URL);
    $(document).ready(function() {
        qoolbar.i_am(MONTY.me_idn);
        $('#status').text("Loading qoolbar...");
        qoolbar.html('#my-qoolbar', function() {
            var $status =  $('#status');
            $status.text("Decorating words...");
            qoolbar.bling('.word');
            $status.text("");
        });
        $(document).on('click', '#enter_uns', function enter_uns_click() {
            var text_uns = $('#text_uns').value();
            console.debug("Enter unslump", text_uns);
        });
    });
}

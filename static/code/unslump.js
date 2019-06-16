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

            $('#show_anonymous').on('change', function () {
                enforce_anonymous();
            });
            enforce_anonymous();

            $('#show_deleted').on('change', function () {
                enforce_deleted();
            });
            enforce_deleted();

            $('#show_spam').on('change', function () {
                enforce_spam();
            });
            enforce_spam();
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
                    var new_words = JSON.parse(response.new_words);
                    console.log("Ump", new_words.length, new_words[0].idn, new_words[0].txt.substring(0,80));
                    qoolbar.page_reload();
                });
        });
    });

    function enforce_anonymous() {
        // if ($('#show_anonymous').is(':enabled:checked')) {
        //     $('#their_ump .anonymous').removeClass('anonymous_hide');
        //     // NOTE:  Limit the hiding to "their" contributions.
        //     //        Always show "my" anonymous contributions.
        // } else {
        //     $('#their_ump .anonymous').addClass('anonymous_hide');
        // }
        $('#their_ump .anonymous').toggleClass(
            'anonymous_hide',
            !$('#show_anonymous').is(':enabled:checked')
        );
    }

    function enforce_deleted() {
        // if ($('#show_deleted').is(':enabled:checked')) {
        //     $('[data-qool-delete-me]').removeClass('deleted_hide');
        // } else {
        //     $('[data-qool-delete-me]').addClass('deleted_hide');
        // }
        $('[data-qool-delete-me]').toggleClass(
            'deleted_hide',
            !$('#show_deleted').is(':enabled:checked')
        );
    }

    function enforce_spam() {
        $('[data-qool-spam-me], [data-qool-spam-they]').toggleClass(
            'spam_hide',
            !$('#show_spam').is(':enabled:checked')
        );
        // TODO:  But if I give something a negative spam score, then show it to me,
        //        whatever score others give it.
        //        Also if the sum of everyone else's score is negative, and mine is
        //        nonpositive, then show me.
        //        And if I wrote it, show it to me unless I also spam-scored it positive.
    }
}

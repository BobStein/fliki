// requires lex.js


// FALSE WARNING:  Unused function js_for_meta_lex
// noinspection JSUnusedGlobalSymbols
function js_for_meta_lex(window, $, MONTY) {

    class LexUnslumping extends Lex {
        scan(done, fail) {
            var that = this;
            that.num_def = 0;
            that.num_non_def = 0;
            super.scan(done, fail);
        }
        each_word(word) {
            var that = this;
            super.each_word(word);
        }
        each_definition_word(word) {
            var that = this;
            super.each_definition_word(word);
            that.num_def++;
        }
        each_reference_word(word) {
            var that = this;
            super.each_reference_word(word);
            that.num_non_def++;
        }
    }

    class WordUnslumping extends Word {
    }

    $(function document_ready() {
        $(window.document.body).append("Yo to the mix");
        var lex = new LexUnslumping(MONTY.LEX_URL, WordUnslumping, {});
        lex.scan(function () {
            console.log(
                "Lex!",
                lex.num_def, "definitions,",
                lex.num_non_def, "non-definitions",
                lex
            );
        }, function (error_message) {
            console.error(error_message);
        });
    });
}

// requires lex.js


// FALSE WARNING:  Unused function js_for_meta_lex
// noinspection JSUnusedGlobalSymbols
function js_for_meta_lex(window, $, MONTY) {

    class LexUnslumping extends Lex {
        $speech = null;
        scan(done, fail) {
            var that = this;
            that.num_def = 0;
            that.num_ref = 0;
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
            that.say(word.idn, word.obj.name.toUpperCase(), word.obj.fields.join(","));
        }
        each_reference_word(word) {
            var that = this;
            super.each_reference_word(word);
            that.num_ref++;
            // that.say(word.idn, that.by_idn[word.vrb].obj.name, JSON.stringify(word.obj));
            that.say(word.idn, word.vrb_name(), JSON.stringify(word.obj));
        }
        say(...stuff) {
            var that = this;
            that.$speech.append(stuff.join(" ") + "\n");
        }
    }

    class WordUnslumping extends Word {
        static lex = null;
    }

    $(function document_ready() {
        $(window.document.body).append("Yo to the mix");
        var lex = new LexUnslumping(MONTY.LEX_URL, WordUnslumping, {});
        // WordUnslumping.lex = lex;
        lex.$speech = $('<div>', {id: 'speech', style:'font-family: monospace; white-space: pre;'});
        $(window.document.body).append(lex.$speech);
        lex.scan(function () {
            console.log(
                "Lex!",
                lex.num_def, "definition-words,",
                lex.num_ref, "reference-words",
                lex
            );
        }, function (error_message) {
            console.error(error_message);
        });
    });
}

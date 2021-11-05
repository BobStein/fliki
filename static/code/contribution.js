/**
 * contribution.js - multimedia contributions, e.g. quotes or YouTube videos
 *
 * Classes:
 *     Category
 *     Contribution
 *     Caption
 *     Lexi
 *     CategoryLexi
 *     ContributionLexi
 *     IdnSequence
 */




/**
 *  //// Category //// What we need to know about each category.
 *
 * @param idn - e.g. categories.by_name.my.idn
 * @return {Category}
 * @constructor
 *
 * Properties not set by the constructor, but maybe added to an instance later:
 *     observer
 *     (must be others)
 */
function Category(idn) {
    var that = this;
    type_should_be(that, Category);
    type_should_be(idn, Number);
    that.idn = idn;
    that.cont_sequence = new IdnSequence();   // Contributions in each Category
    that.txt = "";
}

// noinspection JSUnusedGlobalSymbols
Category.prototype.destructor = function Category_destructor() {
    // NOTE:  Not sure if we'd ever need to destroy a category object, but if we do,
    //        here go the issues to keep track of.
};

/**
 * //// Contribution //// Quote or video.  May be rendered as a thumbnail or popup.
 *
 * Example instance:
 *    cont.idn              1821
 *    cont.idn_string       '1821'
 *    cont.id_prefix        'popup_'
 *    cont.id_attribute     'popup_1821'
 *
 * @param {number} idn - the idn of the contribution word in the lex, e.g. 1821
 * @return {Contribution}
 * @constructor
 *
 * cont.unrendered_content is set from the data stream soon after construction.
 * When a contribution is rendered (maybe much later), it is moved to the DOM.
 * From then on, the text is fetched from the DOM.
 * Not to be confused with superseding, which permanently ends the rendering of content.
 * cont.unrendered_content is only about what's hiding beneath the "20 more" clickables.
 *
 */
function Contribution(idn) {
    var that = this;
    type_should_be(that, Contribution || console.error("Did you mean new Contribution()?"));
    type_should_be(idn, Number);
    that.idn = idn;
    that.unrendered_content = null;
    that.cat = null;
    that.superseded_by_idn = null;
}
// TODO:  must override:  Contribution.superseded_by()
// TODO:  must override:  Contribution.supersedes()
// TODO:  must override:  Contribution.is_superseded (a property)

/**
 * //// Caption //// What we need to know about each caption.
 *
 * @param idn
 * @return {Caption}
 * @constructor
 */
function Caption(idn) {
    var that = this;
    type_should_be(that, Caption) || console.error("Did you mean new Caption()?");
    type_should_be(idn, Number);
    that.idn = idn;
    that.txt = "";
    that.owner = null;
}

/**
 * //// User ////
 *
 * EXAMPLE:
 *    new User([167,"103620384189003122864"])
 *    new User([168,"1267"])
 *
 * @param idn
 * @return {User}
 * @constructor
 */
function User(idn) {
    var that = this;
    type_should_be(that, User) || console.error("Did you mean new User()?");
    type_should_be(idn, Array);
    // type_should_be(idn, String);
    // NOTE:  Authenticated and Anonymous users have an array as an identifier.
    //        So their words have an sbj identifier as a String.
    //        Lex definitions have sbj set to the Number 0, but those words should never instantiate
    //        a User object.
    that.idn = idn;
    that.name = "";
    // that.is_anonymous = false;
    that.is_authenticated = false;
    that.is_admin = false;
    that.num_references = 0;
}

User.prototype.possessive = function User_possessive() {
    var that = this;
    if (that.name === "") {
        return "my";
    } else {
        return that.name + "'s";
    }
}

/**
 /* //// Lexi //// Freakish name for a thing that stores idn-referenced stuff.
 *
 * It's almost sorta maybe like the Python Lex class.
 * An idn is an integer number here.
 *
 * Contrast IdnSequence, a simpler container of idns (array-like).
 * A lexi is a container of words (associative-array-like).  Each word is keyed by its idn.
 *
 * To enable notifications on the console, a subclass can:
 *     that.notify = console.log.bind(console);
 *
 * @param word_class constructs instances for the lexi.  Takes an idn to construct.
 * @return {Lexi}
 * @constructor
 */
function Lexi(word_class) {
    var that = this;
    type_should_be(that, Lexi) || console.error("Did you mean new Lexi()?");
    that.word_class = word_class;
    that._word_from_idn = {};
    // that.idn = {};
    that.notify = function () {};
}

// /**
//  * Remember the idn of a name.
//  */
// Lexi.prototype.remember_idn = function (name, value) {
//     var that = this;
//     that.idn[name] = value;
// }
// NOTE:  Deleted this because x.remember_idn(n,v) was less clear than x.idn[n] = v

// Lexi.prototype.define_some_IDNS = function (idn_dictionary) {
//     var that = this;
//     that.IDN = $.extend({}, that.IDN, idn_dictionary);
//     // NOTE:  Shallow copy, avoid changing other IDN properties.  (May be overcautious.)
// }
// TODO:  Shouldn't this happen instead by passing WORDS through?
//        the words that define the IDNs?

Lexi.prototype.has = function Lexi_has(idn) {
    var that = this;
    return has(that._word_from_idn, idn);
};

/**
 * Get a word from this Lex by its idn.
 *
 * @param idn
 * @param default_word
 * @returns {null|*} - returns the word,
 *                     or default_word if no such idn,
 *                     or null if no such idn and no default_word specified
 */
Lexi.prototype.get = function Lexi_get(idn, default_word) {
    var that = this;
    default_word = default_word || null;
    if (that.has(idn)) {
        return that._word_from_idn[idn];
    } else {
        // console.error(type_name(that), "has not got", idn);
        return default_word;
    }
};

Lexi.prototype.add = function Lexi_add(idn) {
    var that = this;
    if (that.has(idn)) {
        console.error(type_name(that), "already added", idn);
    } else {
        var word_gets_instantiated_here = new that.word_class(idn);
        that._word_from_idn[idn] = word_gets_instantiated_here;
    }
    return that._word_from_idn[idn];
};

Lexi.prototype.add_if_new = function Lexi_add_if_new(idn) {
    var that = this;
    if (that.has(idn)) {
        return that.get(idn);
    } else {
        return that.add(idn);
    }
};

/**
 * Iterate through all idns and words in this lex.
 *
 * @param {function(int,object)} callback - passed (idn, word)
 *                                          return false (not just falsy) to terminate loop early
 */
Lexi.prototype.loop = function Lexi_loop(callback) {
    var that = this;
    looper(that._word_from_idn, function (idn_string, word) {
        var idn = parseInt(idn_string);
        // THANKS:  Because numeric Object() property "names" are turned into strings,
        //          https://stackoverflow.com/a/3633390/673991
        return callback(idn, word);
    });
}

/**
 * //// UserLexi //// Know about all Users.
 *
 * @return {UserLexi}
 * @constructor
 */
function UserLexi(word_class) {
    var that = this;
    type_should_be(that, UserLexi);
    Lexi.call(that, word_class);
    // that.by_name = {};
}
UserLexi.prototype = Object.create(Lexi.prototype);
UserLexi.prototype.constructor = UserLexi;

/**
 * //// CategoryLexi //// Know about all Categories.  A container of Category objects.
 *
 * @return {CategoryLexi}
 * @constructor
 */
function CategoryLexi(word_class) {
    var that = this;
    type_should_be(that, CategoryLexi);
    Lexi.call(that, word_class);
    that.cat_idns = new IdnSequence();   // Categories in order
    // that.define_some_IDNS({
    //     LEX: null,
    //     DEFINE: null,
    //     CATEGORY: null
    // });
    that.by_name = {};
}
CategoryLexi.prototype = Object.create(Lexi.prototype);
CategoryLexi.prototype.constructor = CategoryLexi;

// CategoryLexi.prototype.word_pass = function CategoryLexi(word) {
//     var that = this;
//     if (
//         word.sbj === that.IDN.LEX &&
//         word.vrb === that.IDN.DEFINE &&
//         word.obj === that.IDN.CATEGORY
//     ) {
//         that.add_cat(word.idn, word.txt);
//     } else {
//         that.notify("Passing a non-category word to CategoryLexi.word_pass()", word, that.IDN);
//     }
// }

CategoryLexi.prototype.add_cat = function CategoryLexi_add_cat(idn, category_internal_name) {
    var that = this;
    var cat = that.add(idn);
    cat.txt = category_internal_name;
    that.cat_idns.sequence_left(idn);

    that.by_name[cat.txt] = cat;
    // NOTE:  This step allows
    //            categories.by_name.about
    //        as a shorthand to
    //            categories.get(IDN_FOR_ABOUT)
    // NOTE:  In anticipation of future user-defined categories, this trick was moved to the
    //        by_name sub-property, so it could not e.g. conflict with other category object
    //        properties.  Hmm, not sure we'd need this trick for those exotic things anyway.

    return cat;
}

/**
 * //// ContributionLexi //// Know about contributions.
 *
 * A container of Contribution objects.
 * (But not all of them -- popup Contribution objects are not stored in any Lexi.)
 *
 * @return {ContributionLexi}
 * @constructor
 */
function ContributionLexi(word_class, category_lexi) {
    var that = this;
    type_should_be(that, ContributionLexi);
    Lexi.call(that, word_class);
    that.category_lexi = category_lexi;
}
ContributionLexi.prototype = Object.create(Lexi.prototype);
ContributionLexi.prototype.constructor = ContributionLexi;

// /**
//  * Handle a word that is relevant to contributions and categories.
//  *
//  * Check authorization first.
//  * Keep category sequences in sync.
//  *
//  * A relevant word has one of these verbs:
//  *     'contribute'   (instantiate a Contribution object and stow it here in this ContributionLexi)
//  *     'caption'      (give a Contribution a shiny new Caption object)
//  *     'edit'         (change a Contribution's text)
//  *     example categorization & ordering verbs:   (which change a Contribution's Category)
//  *         'my'
//  *         'their'
//  *         'anon'
//  *         'trash'
//  *         'about'
//  *
//  * .word_pass() after constructing a new Contribution knowing only its idn, affect these fields:
//  *     .was_submitted_anonymous
//  *     .cat
//  *     .cat.cont_sequence
//  *     .owner
//  *     .capt
//  *     .capt.idn
//  *     .capt.txt
//  *     .capt.owner
//  *     .superseded_by_idn
//  *     .supersedes_idn
//  *
//  * Notably ignored, the .txt or .content of the contribution.  Though the .capt.txt is set.
//  *
//  * CAUTION:  This does not manage the rendered parts of the Contributions,
//  *           i.e. the .$sup property!  So the caller must deal with that.
//  *
//  * @param word - properties idn, sbj, vrb, obj, num, txt
//  */
// // TODO:  Option to delete superseded contributions or not.
// ContributionLexi.prototype.word_pass = function ContributionLexi_word_pass(word) {
//     var that = this;
//     switch (word.vrb) {
//     case that.idn_of.contribute:
//         that.contribute_word(word);
//         break;
//     case that.idn_of.caption:
//         that.caption_word(word);
//         break;
//     case that.idn_of.edit:
//         that.edit_word(word);
//         break;
//     default:
//         if (that.category_lexi.has(word.vrb)) {
//             that.cat_ordering_word(word);
//         } else {
//             that.notify("Passing a non-contribution word to ContributionLexi.word_pass()", word, that.IDN);
//         }
//     }
// }

ContributionLexi.prototype.contribute_word = function (word) {
    var that = this;
    var new_cont_idn = word.idn;
    var new_cont_owner = word.sbj;
    var the_text = word.obj.text;   // is_defined(word.text) ? word.text : word.txt;

    var cont = that.add(new_cont_idn);
    // Contribution objects are all instantiated here.

    // if (word.was_submitted_anonymous) {
    if ( ! that.is_user_authenticated(new_cont_owner)) {
        cont.was_submitted_anonymous = true;
        // NOTE:  Pink is the color of anonymous contributions.
        //        Captioning or moving a contribution retains its .was_submitted_anonymous
        //        But editing by a logged-in user removes it.
    }
    cont.cat = that.starting_cat(word);
    console.assert(cont.cat instanceof Category, "Not a category", cont.cat);
    cont.cat.cont_sequence.sequence_left(new_cont_idn);   // insert LEFT end, nothing ever goes wrong with that
    cont.owner = new_cont_owner;
    cont.unrendered_content = the_text;
    // NOTE:  Captioning does not change a contribution's owner.
    //        (It does change the caption's owner.)
    //        Moving and editing do change the contribution's owner.
    //        (They do not change the caption's owner.  One way this could be weird:
    //        if I move an anonymous contribution to "my" category, then that user
    //        edits the caption, I will see the new caption too.  So this is a possible
    //        leak between anonymous users.)
    that.notify(f("{idn}. {owner} contributes {n} bytes to {cat}", {
        idn: new_cont_idn,
        owner: that.user_name_short(new_cont_owner),
        cat: cont.cat.txt,
        n: cont.unrendered_content.length
    }));
}

ContributionLexi.prototype.caption_word = function (word) {
    var that = this;
    type_should_be(word, Object);
    type_should_be(word.idn, Number);
    type_should_be(word.sbj, Array);
    type_should_be(word.obj, Object);
    type_should_be(word.obj.text, String);

    var cont_idn = word.obj.contribute;   // word.contribute || word.obj;
    var new_capt_idn = word.idn;
    var new_capt_txt = word.obj.text;   // is_defined(word.text) ? word.text : word.txt;
    var new_capt_owner = word.sbj;

    // TODO:  Justify why I'm not handling word.was_submitted_anonymous for captions?
    //        Ah is it because we don't COLOR captions with anonymous pink?
    //        I fell prey to the misconception that JavaScript is where I should enforce
    //        ANY security.  That must all be taken care of in Python!

    if (that.has(cont_idn)) {
        var cont = that.get(cont_idn);
        var is_capt_already = is_specified(cont.capt);
        var old_capt_owner;
        if (is_capt_already) {
            old_capt_owner = cont.capt.owner;
        } else {
            old_capt_owner = cont.owner;
        }
        if (that.is_authorized(word, old_capt_owner, "caption")) {
            cont.capt = new Caption(new_capt_idn);
            cont.capt.txt = new_capt_txt;
            cont.capt.owner = new_capt_owner;
        }
    } else {
        that.notify(f("{capt_idn}. (Can't caption {cont_idn})", {
            cont_idn: cont_idn,
            capt_idn: new_capt_idn
        }));
    }
}

ContributionLexi.prototype.edit_word = function (word) {
    var that = this;
    type_should_be(word, Object);
    type_should_be(word.idn, Number);
    type_should_be(word.sbj, Array);
    type_should_be(word.obj, Object);
    type_should_be(word.obj.contribute, Number);
    type_should_be(word.obj.text, String);

    // TODO:  Is it true and desirable that .was_submitted_anonymous is NOT copied?
    //        So edits are not anonymous, even if edited by an anonymous person?
    //        Does this create a leak?
    //        No but logged in users see it without the pink, though still in anon cat.
    //        There may be other leaky behavior, such as editing or dragging a
    //        contribution inadvertently making it visible to other anonymous users.
    var old_cont_idn = word.obj.contribute;   // word.contribute || word.obj;
    var new_cont_idn = word.idn;
    var new_cont_owner = word.sbj;
    var edit_text = word.obj.text;   // is_defined(word.text) ? word.text : word.txt;
    var new_cont;

    if (that.has(old_cont_idn)) {
        var old_cont = that.get(old_cont_idn);
        var old_cont_owner = old_cont.owner;
        if (that.is_authorized(word, old_cont_owner, "edit")) {
            new_cont = that.add(new_cont_idn);
            new_cont.cat = old_cont.cat;
            new_cont.capt = old_cont.capt;
            new_cont.owner = new_cont_owner;
            // TODO:  Should a lesser-privileged caption owner
            //        be replaced by new_cont_owner?
            //        Maybe always do this here:
            //            new_cont.capt.owner = new_cont_owner;
            //        Is there a downside?
            //        What does it mean to "own" a contribution or caption??
            //        It's certainly not equivalent to being permitted to edit it.
            new_cont.unrendered_content = edit_text;
            new_cont.cat.cont_sequence.renumber(old_cont_idn, new_cont_idn);
            if (old_cont.is_superseded) {
                console.warn(
                    "Edit fork",
                    old_cont_idn,
                    "superseded by",
                    old_cont.superseded_by_idn,
                    "and",
                    new_cont_idn
                );
                // Probably harmless.  Different non-admin users, editing the same cont?
                // TODO:  Report the sequence of owners too?
                //        that.get( old_cont_idn).owner == old_cont_owner
                //        that.get(fork_cont_idn).owner
                //        that.get( new_cont_idn).owner ==~== new_cont_owner
                // NOTE:  This is probably not the only fork.
            }
            // old_cont.superseded_by_idn = new_cont_idn;
            old_cont.superseded_by(new_cont);
            new_cont.supersedes(old_cont.idn);

            // TODO:  Maybe superseded contributions can be destroyed:
            //        del that.
        }
    } else if (that.is_me(new_cont_owner)) {
        // NOTE:  Weird situation:  I did this edit, but for some reason the old contribution
        //        that this edit displaces was not in my view.  Oh well, treat the edit itself
        //        as a new contribution from me.  This is problematic of course if I was merely
        //        edited some contribution somewhere that was subsequently lost.  I don't
        //        necessarily want it elevated to my category.  But I guess it's better than
        //        not seeing it at all.
        new_cont = that.add(new_cont_idn);
        new_cont.cat = that.starting_cat(word);
        new_cont.owner = new_cont_owner;
        new_cont.cat.cont_sequence.sequence_left(new_cont.idn);
        new_cont.supersedes(old_cont_idn);
        that.notify(f("{new_cont_idn}. Resurrecting my edit of ghostly #{old_cont_idn})", {
            new_cont_idn: new_cont_idn,
            old_cont_idn: old_cont_idn
        }));
    } else {
        that.notify(f("{new_cont_idn}. (Can't edit {old_cont_idn})", {
            new_cont_idn: new_cont_idn,
            old_cont_idn: old_cont_idn
        }));
    }
}

// ContributionLexi.prototype.cat_ordering_word = function (word) {
//     var that = this;
//     var reordering_idn = word.idn;
//     var new_cont_owner = word.sbj;
//     var new_cat_idn = word.vrb;
//     var new_cat = that.category_lexi.get(new_cat_idn);
//     var cont_idn = word.obj;
//     var idn_to_the_right = word.num;
//     var is_far_right = is_equal_idn(idn_to_the_right, new_cat.cont_sequence.fence_post_right);
//
//     if (that.has(cont_idn)) {
//         var cont = that.get(cont_idn);
//         var old_cat = cont.cat;
//         var old_cont_owner = cont.owner;
//         var action_template = is_far_right
//             ? "drop on right end of {cat},"
//             : "drop left of #{idn} in {cat},";
//         var action = f(action_template, {
//             cat: new_cat.txt,
//             idn: idn_to_the_right
//         });
//         if (that.is_authorized(word, old_cont_owner, action)) {
//             if (is_specified(old_cat)) {
//                 old_cat.cont_sequence.delete(cont_idn, cat_ordering_error);
//             }
//             new_cat.cont_sequence.insert(cont_idn, idn_to_the_right, function (seq_message) {
//                 var cat_message = new_cat.txt + " - " + seq_message;
//                 // NOTE:  IdnSequence.insert() didn't know what category we're moving to,
//                 //        but here, we know.  So we prepend it to insert()'s error message.
//                 cat_ordering_error(cat_message);
//             });
//             cont.cat = new_cat;
//             cont.owner = new_cont_owner;
//             // TODO:  Commandeer the caption ownership too?
//             //        cont.capt.owner = new_cont_owner;
//         }
//
//         function cat_ordering_error(message) {
//             that.notify(f("{idn}. {message}", {
//                 idn: reordering_idn,
//                 message: message
//             }));
//         }
//     } else {
//         that.notify(f("{reordering_idn}. (Can't reorder {cont_idn})", {
//             reordering_idn: reordering_idn,
//             cont_idn: cont_idn
//         }));
//     }
// }

ContributionLexi.prototype.rearrange_word = function (word) {
    var that = this;
    type_should_be(word, Object);
    type_should_be(word.idn, Number);
    type_should_be(word.sbj, Array);
    type_should_be(word.obj, Object);
    type_should_be(word.obj.contribute, Number);
    type_should_be(word.obj.category, Number);
    type_should_be(word.obj.locus, Number);

    // var reordering_idn = word.idn;   --> nit.idn
    // var new_cont_owner = word.sbj;   --> nit.user
    // var new_cat_idn = word.vrb;   --> nit.category
    var new_cat = that.category_lexi.get(word.obj.category);
    // var cont_idn = word.obj;   --> nit.contribute
    // var idn_to_the_right = word.num;
    var is_far_right = is_equal_idn(word.obj.locus, new_cat.cont_sequence.fence_post_right);

    if (that.has(word.obj.contribute)) {
        var cont = that.get(word.obj.contribute);
        var old_cat = cont.cat;
        var old_cont_owner = cont.owner;
        var action_template = is_far_right
            ? "rearrange to right end of {cat},"
            : "rearrange to the left of #{idn} in {cat},";
        var action = f(action_template, {
            cat: new_cat.txt,
            idn: word.obj.locus
        });
        if (that.is_authorized(word, old_cont_owner, action)) {
            if (is_specified(old_cat)) {
                old_cat.cont_sequence.delete(word.obj.contribute, cat_ordering_error);
            }
            new_cat.cont_sequence.insert(word.obj.contribute, word.obj.locus, function (seq_message) {
                var cat_message = new_cat.txt + " - " + seq_message;
                // NOTE:  IdnSequence.insert() didn't know what category we're moving to,
                //        but here, we know.  So we prepend it to insert()'s error message.
                cat_ordering_error(cat_message);
            });
            cont.cat = new_cat;
            cont.owner = word.sbj;
            // TODO:  Commandeer the caption ownership too?
            //        cont.capt.owner = new_cont_owner;
        }

        function cat_ordering_error(message) {
            that.notify(f("{idn}. {message}", {
                idn: word.idn,
                message: message
            }));
        }
    } else {
        that.notify(f("{reordering_idn}. (Can't find contribution {cont_idn} to rearrange)", {
            reordering_idn: word.idn,
            cont_idn: word.obj.contribute
        }));
    }
}



/**
 * Should we let this word change the Collections?
 *
 * The hierarchy of changes to a contribution:
 *     original contributor < system admin < me (browsing user)
 *
 * So once I (logged-in user) changes a contribution, I will ignore changes by others.
 * Before that, admin changes similarly stop original author changes.
 *
 * @param word - the word causing a change (e.g. edit or re-categorization or rearrangement)
 *               word.idn is the idn number of the word
 *               word.sbj is the idn qstring of the user who initiated this change.
 *               word.vrb is the idn number of the verb
 *               word.obj is the idn number of the object
 * @param old_owner - tricky - id of the last person we authorized to change this contribution.
 *                It starts off as the original contributor.
 *                But then if I (the browsing user) moved it or edited it, then I'm the owner.
 *                But before that if the system admin moved or edited it,
 *                then they became the owner.
 *                This field comes from the data-owner attribute.  BUT if we return true,
 *                then we expect data-owner to be overridden by whoever initiated THIS change!
 * @param action - text describing the change.
 *                 (This may be briefly word.vrb.txt, as if that were accessible in JS,
 *                 or it may be longer, e.g. "drop on right end of my")
 * @return {boolean}
 */
ContributionLexi.prototype.is_authorized = function ContributionLexi_is_authorized(
    word,
    old_owner,
    action
) {
    var that = this;

// DONE:  Don't let owner or admin "drag to my.*"  (not even before I do)
//            Shame that removes the Seuss quote, and the top will be empty for new users.
//        Nor other.* nor anon.*
//            (It's weird that we allow recategorizations to there at all,
//            less weird that we allow rearrangements within those categories,
//            but it would be weirder if we allowed anyone ELSE do those FOR me.)
//            But this eliminates admin rearranging the "other" category.
//            Which would be problematic anyway, as different users already have
//            different stuff there.  So admin placing X to the left of Y would
//            already be unusable to the user who created Y (or moved it to category 'my')
//            because it wouldn't then be in category 'other'.
//        But do allow owner or admin to "drag to trash.*"
//            And that affects everyone else, unless of course I drag it elsewhere later.
//            A little weird that owner or admin rearrangements WITHIN trash affect
//            everyone.
//        Do allow admin to "drag to about.*" (Only admin can create those words anyway.)
//            And those actions rightly affect everyone.
// TODO:  The confusion above is a symptom of the deeper confusion:
//            Are categories user-interest partitions, or user-origin partitions?
//            IOW are we separating things by where they came from?
//                (anonymous users, me, other logged-in users)
//            or by what we want to do with them?
//                (my unslumping, others, trash)

    // var change_idn = word.idn;
    // var new_owner = word.sbj;
    // var change_vrb = word.vrb;
    // var target = word.obj;
    var change_idn = word.idn;
    var new_owner = word.sbj;
    var change_vrb = word.vrb;
    var target = word.obj.contribute || word.idn;

    // First stage of decision-making:
    var is_change_mine = that.is_me(new_owner);
    var did_i_change_last = that.is_me(old_owner);
    var is_change_admin = that.is_user_admin(new_owner);
    var did_admin_change_last = that.is_user_admin(old_owner);
    var is_same_owner = is_equal_idn(new_owner, old_owner);

    // Second stage of decision making:
    var let_admin_change = ! did_i_change_last                            && is_change_admin;
    var let_owner_change = ! did_i_change_last && ! did_admin_change_last && is_same_owner;

    var ok;
    if (that.is_verb_guardrailed(change_vrb)) {
        ok = is_change_mine;
    } else {
        ok = is_change_mine || let_admin_change || let_owner_change;
    }

    // Decision:
    if (ok) {
        that.notify(
            change_idn +
            ". Yes " +
            that.user_name_short(new_owner) +
            " may " +
            action +
            " " +
            target +
            ", work of " +
            that.user_name_short(old_owner),
        );
    } else {
        that.notify(
            change_idn +
            ". Nope " +
            that.user_name_short(new_owner) +
            " won't " +
            action +
            " " +
            target +
            ", work of " +
            that.user_name_short(old_owner)
        );
        if (let_owner_change) {
            that.notify("     ...because only owner can recategorize like this.");
            // TODO:  Misleading because admin might be able to change too?
        } else if (let_admin_change) {
            that.notify("     ...because only admin can recategorize like this.");
        }
        // TODO:  Display more thorough explanations on why or why not ok.
        //        This might be a big idea:
        //        Explain reasons by seeing which boolean inputs were critical,
        //        that is, which if flipped, would have changed the "ok" output.
        //        Would this really be interesting and complete?
        //        What about pairs of inputs that together change the output
        //        but don't individually?  Are there any such pairs?  Or triples?
        //        How to compose the human-readable explanations once we know which
        //        inputs were critical?
    }
    return ok;
}

ContributionLexi.prototype.starting_cat = function ContributionLexi_starting_cat(_word_) {
    throw Error("You should override the .starting_cat() method.");
}

/**
 * Is this verb something a user only does to himself?
 *
 * In other words, ignore the action if merely the owner or administrator did it.
 */
ContributionLexi.prototype.is_verb_guardrailed = function ContributionLexi_is_verb_guardrailed(_verb_idn_) {
    throw Error("You should override the .is_verb_guardrailed() method.");
}
ContributionLexi.prototype.user_name_short = function ContributionLexi_user_name_short(_user_idn_) {
    throw Error("You should override the .user_name_short() method.");
};
ContributionLexi.prototype.is_user_admin = function ContributionLexi_is_user_admin(_user_idn_) {
    throw Error("You should override the .is_user_admin(idn) method.");
};
ContributionLexi.prototype.is_user_authenticated = function ContributionLexi_is_user_authenticated(_user_idn_) {
    throw Error("You should override the .is_user_authenticated(idn) method.");
};
ContributionLexi.prototype.is_me = function ContributionLexi_is_me(_user_idn_) {
    throw Error("You should override the .is_me(idn) method.");
}



/**
 * //// IdnSequence //// A sequence of idns, e.g. for the contributions in a category.
 *
 * Differences between a Lexi and an IdnSequence:
 * - A Lexi contains words, each word is indexed by an idn.
 * - An IdnSequence is an ordered sequence of simple idns.
 *   Each idn probably refers to a word in some Lexi,
 *   but the word is not contained by the IdnSequence.
 * - An IdnSequence encapsulates the order of a set of idns.
 *
 * Members:
 *     fence_post_right - special idn value to represent right-most edge.
 *                        (To represent any crack BETWEEN a sequence of idns,
 *                        then use the idn to the RIGHT of the crack,
 *                        i.e. that idn represents the crack to the LEFT of the idn.
 *                        So the first idn represents the left-most edge.
 *                        And fence_post_right will represent the right-edge crack.)
 * @return {Category}
 * @constructor
 */
function IdnSequence() {
    var that = this;
    type_should_be(that, IdnSequence);
    that._sequence = [];   // array of idns
    that.fence_post_right = null;
}

/**
 * Get an array of the idns, a shallow copy of the internal idn array.
 *
 * @return {*[]}
 */
IdnSequence.prototype.idn_array = function IdnSequence_idn_array() {
    var that = this;
    return that._sequence.slice(0);
    // THANKS:  Array shallow copy, https://stackoverflow.com/a/21514254/673991
}

/**
 * Delete an idn from the sequence
 *
 * @param {number} idn - by value, not by index
 * @param {function(string)} error_callback - in case it was never there
 */
IdnSequence.prototype.delete = function IdnSequence_delete(idn, error_callback) {
    var that = this;
    error_callback = error_callback || function () {};
    var index = that._sequence.indexOf(idn);
    if (index === -1) {
        error_callback(f("Can't delete {idn} in:\n{idns}", {
            idn: idn,
            idns: that._sequence.join(" ")
        }));
    } else {
        that._sequence.splice(index, 1);
    }
}

/**
 * Length of sequence.
 *
 * Not calling it .length so as to distinguish from Arrays.
 *
 * @return {number}
 */
IdnSequence.prototype.len = function IdnSequence_len() {
    var that = this;
    return that._sequence.length;
}

/**
 * Iterate through all idns in this sequence.
 *
 * @param {function(int,int)} callback - passed (nearly_useless_index, idn)
 *                                       return false (not just falsy) to terminate loop early
 */

IdnSequence.prototype.loop = function IdnSequence_loop(callback) {
    var that = this;
    looper(that._sequence, callback);
}

/**
 * Does this sequence contain a particular idn?
 *
 * @param idn
 * @return {boolean}
 */
IdnSequence.prototype.has = function IdnSequence_has(idn) {
    var that = this;
    var index = that._sequence.indexOf(idn);
    return index !== -1;
};

/**
 * Renumber (NOT MOVE) an idn in the sequence.
 *
 * (To move an idn, changing the order, call .delete() then .insert().)
 *
 * @param idn_old
 * @param idn_new
 * @param {function(string)} error_callback
 */
IdnSequence.prototype.renumber = function IdnSequence_renumber(idn_old, idn_new, error_callback) {
    var that = this;
    error_callback = error_callback || function () {};
    var index = that._sequence.indexOf(idn_old);
    if (index === -1) {
        error_callback(f("Can't renumber {idn_old} to {idn_new} in:\n{idns}", {
            idn_old: idn_old,
            idn_new: idn_new,
            idns: that._sequence.join(" ")
        }));
        that._sequence.push(idn_new);
    } else {
        that._sequence[index] = idn_new;
    }
}

/**
 * Insert a new idn in the sequence
 *
 * Conceptually the sequence goes from left to right, but it need not be rendered that way.
 * (The CategoryLexi.cat_idns are rendered top to bottom.)
 *
 * @param idn - new idn to be added to the sequence.
 * @param idn_to_right - first idn inserts on the left edge (typically the earliest).
 *                       fence_post_right inserts on right (latest).
 * @param {function(string)} error_callback
 */
IdnSequence.prototype.insert = function IdnSequence_insert(idn, idn_to_right, error_callback) {
    var that = this;
    error_callback = error_callback || function () {};
    if (is_specified(idn_to_right)) {
        if (is_equal_idn(idn_to_right, that.fence_post_right)) {
            that.insert_right(idn);
        } else {
            var index = that._sequence.indexOf(idn_to_right);
            if (index === -1) {
                error_callback(f("Can't insert {idn} at {idn_to_right} in:\n{idns} --- {fp}", {
                    idn: idn,
                    idn_to_right: idn_to_right,
                    idns: that._sequence.join(" "),
                    fp: that.fence_post_right
                }));
                that.sequence_left(idn);
            } else {
                that._sequence.splice(index, 0, idn);
            }
        }
    } else {
        // TODO:  console.error()?
        that.sequence_left(idn);
    }
}
// THANKS:  callback parameters in JSDoc, https://stackoverflow.com/a/38586423/673991

IdnSequence.prototype.sequence_left = function IdnSequence_sequence_left(idn) {
    var that = this;
    that._sequence.unshift(idn);
}

IdnSequence.prototype.insert_right = function IdnSequence_insert_right(idn) {
    var that = this;
    that._sequence.push(idn);
}

function is_equal_idn(idn1, idn2) {
    return idn1.toString() === idn2.toString();
    // THANKS:  Compare arrays as strings, https://stackoverflow.com/a/42186143/673991
}
console.assert(true === is_equal_idn([11,"22"], [11,"22"]));

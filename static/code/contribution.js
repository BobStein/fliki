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
 * @param idn - e.g. MONTY.cat_words[n].idn -- which will eventually be categories.my.idn
 * @return {Category}
 * @constructor
 *
 * Properties not set by the constructor, but maybe added to an instance later:
 *     observer
 *     (must be others)
 */
function Category(idn) {
    var that = this;
    if ( ! (that instanceof Category)) {
        return new Category(idn);
    }
    type_should_be(idn, 'Number');
    that.idn = idn;
    that.cont_sequence = IdnSequence();
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
 * Properties not set by the constructor, but maybe added to an instance later:
 *     (must be some)
 */
function Contribution(idn) {
    var that = this;
    if ( ! (that instanceof Contribution)) {
        return new Contribution(idn);
    }
    // THANKS:  Automatic 'new', https://stackoverflow.com/a/383503/673991
    type_should_be(idn, 'Number');
    that.idn = idn;
}

/**
 * //// Caption //// What we need to know about each caption.
 *
 * @param idn
 * @return {Caption}
 * @constructor
 */
function Caption(idn) {
    var that = this;
    if ( ! (that instanceof Caption)) {
        return new Caption(idn);
    }
    that.idn = idn;
    that.txt = "";
    that.owner = null;
}

/**
 /* //// Lexi //// Freakish name for a thing that stores idn-referenced stuff.
 *
 * It's almost sorta maybe like the Python Lex class.
 * An idn is an integer number here.
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
    if ( ! (that instanceof Lexi)) {
        return new Lexi(word_class);
    }
    that.word_class = word_class;
    that._word_from_idn = {};
    that.IDN = {};
    that.notify = function () {};
}

/**
 * Symbols for key IDN values.
 *
 * CAUTION:  Must call after base-class constructor.
 *           Should call before .word_pass().
 *
 * @param idn_dictionary, e.g. { LEX: 0, DEFINE: 1, NOUN: 2, ...}
 */
Lexi.prototype.define_some_IDNS = function (idn_dictionary) {
    var that = this;
    that.IDN = $.extend({}, that.IDN, idn_dictionary);
    // NOTE:  Shallow copy, avoid changing other IDN properties.  (May be overcautious.)
}
// TODO:  Shouldn't this happen instead by passing WORDS through?
//        the words that define the IDNs?

Lexi.prototype.has = function Lexi_has(idn) {
    var that = this;
    return has(that._word_from_idn, idn);
}

Lexi.prototype.get = function Lexi_get(idn) {
    var that = this;
    if (that.has(idn)) {
        return that._word_from_idn[idn];
    } else {
        console.error(type_name(that), "has not got", idn);
        return null;
    }
}

Lexi.prototype.add = function Lexi_add(idn) {
    var that = this;
    if (that.has(idn)) {
        console.error(type_name(that), "already added", idn);
    } else {
        var word_gets_instantiated_here = that.word_class(idn);
        that._word_from_idn[idn] = word_gets_instantiated_here;
    }
    return that._word_from_idn[idn];
}

/**
 * Iterate through all idns and words.
 *
 * @param callback - passed (idn, word)
 *                   return false (not just falsy) to terminate loop early
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
 * //// CategoryLexi //// Know about all Categories.  A container of Category objects.
 *
 * @return {CategoryLexi}
 * @constructor
 */
function CategoryLexi(word_class) {
    var that = this;
    if ( ! (that instanceof CategoryLexi)) {
        return new CategoryLexi(word_class);
    }
    Lexi.call(that, word_class);
    that.cat_idns = IdnSequence();
    that.define_some_IDNS({
        LEX: null,
        DEFINE: null,
        CATEGORY: null
    });
}
CategoryLexi.prototype = Object.create(Lexi.prototype);
CategoryLexi.prototype.constructor = CategoryLexi;

// /**
//  * Initialize a category list from ordering and names.
//  *
//  * @param {Array<number>} cat_order - array of category idns in top-down display order
//  * @param txt_from_idn - associative array of category names, indexed by category idn
//  * @return {CategoryLexi}
//  */
// CategoryLexi.prototype.from_monty = function CategoryLexi_from_monty(cat_order, txt_from_idn) {
//     var that = this;
//     looper(cat_order, function (_, cat_idn) {
//         var cat = that.add(cat_idn);
//         cat.txt = txt_from_idn[cat_idn];
//     });
//     return that;
// }

CategoryLexi.prototype.word_pass = function CategoryLexi(word) {
    var that = this;
    if (
        word.sbj === that.IDN.LEX &&
        word.vrb === that.IDN.DEFINE &&
        word.obj === that.IDN.CATEGORY
    ) {
        var cat = that.add(word.idn);
        cat.txt = word.txt;
        that.cat_idns.insert_left(word.idn);

        that[cat.txt] = cat;
        // NOTE:  This sneaky step allows
        //            categories.about
        //        as a shortcut to
        //            categories.get(IDN_FOR_ABOUT)
    } else {
        that.notify("Passing a non-category word to CategoryLexi.word_pass()", word, that.IDN);
    }
}

CategoryLexi.prototype.starting_cat = function CategoryLexi_starting_cat(_word_) {
    throw Error("You should override the .starting_cat() method.");
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
    if ( ! (that instanceof ContributionLexi)) {
        return new ContributionLexi(word_class, category_lexi);
    }
    Lexi.call(that, word_class);
    that.category_lexi = category_lexi;
    that.define_some_IDNS({
        CONTRIBUTE: null,
        CAPTION: null,
        EDIT: null,
        me: null   // idn qstring of the browsing user
    });
}
ContributionLexi.prototype = Object.create(Lexi.prototype);
ContributionLexi.prototype.constructor = ContributionLexi;

/**
 * Build up an understanding of contributions by passing through relevant words, one at a time.
 *
 * Relevant words are words with these verbs:
 *     'contribute'
 *     'caption'
 *     'edit'
 *     categorization & ordering verbs:
 *         'my'
 *         'their'
 *         'anon'
 *         'trash'
 *         'about'
 *
 * .word_pass() after constructing a Contribution knowing only its idn, affect these fields:
 *     .was_submitted_anonymous
 *     .cat
 *     .cat.cont_sequence
 *     .owner
 *     .capt
 *     .capt.idn
 *     .capt.txt
 *     .capt.owner
 *     .superseded_by_idn
 *
 * Notably ignored, the .txt or .content of the contribution.  Though the .capt.txt is set.
 *
 * CAUTION:  This does not manage the rendered parts of the Contributions,
 *           i.e. the .$sup property!  So the caller must deal with that.
 *
 * @param word - properties idn, sbj, vrb, obj, num, txt
 */
// TODO:  Option to delete superseded contributions or not.
ContributionLexi.prototype.word_pass = function ContributionLexi_word_pass(word) {
    var that = this;
    switch (word.vrb) {
    // case MONTY.IDN.UNSLUMP_OBSOLETE:
    case that.IDN.CONTRIBUTE:
        contribute_word(word);
        break;
    case that.IDN.CAPTION:
        caption_word(word);
        break;
    case that.IDN.EDIT:
        edit_word(word);
        break;
    default:
        if (that.category_lexi.has(word.vrb)) {
            cat_ordering_word(word);
        } else {
            that.notify("Passing a non-contribution word to ContributionLexi.word_pass()", word, that.IDN);
        }
    }

    function contribute_word(word) {
        var new_cont_idn = word.idn;
        var new_cont_owner = word.sbj;

        var cont = that.add(new_cont_idn);
        // Contribution objects are all instantiated here.

        if (word.was_submitted_anonymous) {
            cont.was_submitted_anonymous = true;
            // NOTE:  Captioning or moving a contribution retains its .was_submitted_anonymous
            //        But editing by a logged-in user removes it.
        }
        cont.cat = that.category_lexi.starting_cat(word);
        console.assert(cont.cat instanceof Category, "Not a category", cont.cat);
        cont.cat.cont_sequence.insert_left(new_cont_idn);   // insert LEFT end, nothing ever goes wrong with that
        cont.owner = new_cont_owner;
        // NOTE:  Captioning does not change a contribution's owner.
        //        (It does change the caption's owner.)
        //        Moving and editing do change the contribution's owner.
        //        (They do not change the caption's owner.  One way this could be weird:
        //        if I move an anonymous contribution to "my" category, then that user
        //        edits the caption, I will see the new caption too.  So this is a possible
        //        leak between anonymous users.)
        that.notify(f("{idn}. {owner} contributes to {cat}", {
            idn: new_cont_idn,
            owner: that.user_name_short(new_cont_owner),
            cat: cont.cat.txt
        }));
    }

    function caption_word(word) {
        var cont_idn = word.obj;
        var new_capt_idn = word.idn;
        var new_capt_txt = word.txt;
        var new_capt_owner = word.sbj;

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
                cont.capt = Caption(new_capt_idn);
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

    function edit_word(word) {
        // TODO:  Is it true and desirable that .was_submitted_anonymous is NOT copied?
        //        So edits are not anonymous, even if edited by an anonymous person?
        //        Does this create a leak?
        //        No but logged in users see it without the pink, though still in anon cat.
        //        There may be other leaky behavior, such as editing or dragging a
        //        contribution inadvertently making it visible to other anonymous users.
        var old_cont_idn = word.obj;
        var new_cont_idn = word.idn;
        var new_cont_owner = word.sbj;
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
                    //        that.get( new_cont_idn).owner === new_cont_owner
                    // NOTE:  This is probably not the only fork.
                }
                // old_cont.superseded_by_idn = new_cont_idn;
                old_cont.superseded_by(new_cont);
                new_cont.supersedes_idn(old_cont.idn);

                // TODO:  Maybe superseded contributions can be destroyed:
                //        del that.
            }
        } else if (word.sbj === that.IDN.me) {
            new_cont = that.add(new_cont_idn);
            new_cont.cat = that.category_lexi.starting_cat(word);
            new_cont.owner = word.sbj;
            new_cont.cat.cont_sequence.insert_left(new_cont.idn);
            new_cont.supersedes_idn(old_cont_idn);
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

    function cat_ordering_word(word) {
        var reordering_idn = word.idn;
        var new_cont_owner = word.sbj;
        var new_cat_idn = word.vrb;
        var new_cat = that.category_lexi.get(new_cat_idn);
        var cont_idn = word.obj;
        var idn_to_the_right = word.num;
        // var is_far_right = idn_to_the_right === MONTY.IDN.FENCE_POST_RIGHT;
        var is_far_right = idn_to_the_right === new_cat.cont_sequence.fence_post_right;

        if (that.has(cont_idn)) {
            var cont = that.get(cont_idn);
            var old_cat = cont.cat;
            var old_cont_owner = cont.owner;
            var action_template = is_far_right
                ? "drop on right end of {cat},"
                : "drop left of #{idn} in {cat},";
            var action = f(action_template, {
                cat: new_cat.txt,
                idn: idn_to_the_right
            });
            if (that.is_authorized(word, old_cont_owner, action)) {
                if (is_specified(old_cat)) {
                    old_cat.cont_sequence.delete(cont_idn, cat_ordering_error);
                }
                new_cat.cont_sequence.insert(cont_idn, idn_to_the_right, function (message) {
                    var cat_message = new_cat.txt + " - " + message;
                    // NOTE:  IdnSequence.insert() didn't know what category we're moving to,
                    //        but here, we know.
                    cat_ordering_error(cat_message);
                });
                cont.cat = new_cat;
                cont.owner = new_cont_owner;
                // TODO:  Commandeer the caption ownership too?
                //        cont.capt.owner = new_cont_owner;
            }

            function cat_ordering_error(message) {
                that.notify(f("{idn}. {message}", {
                    idn: reordering_idn,
                    message: message
                }));
            }
        } else {
            that.notify(f("{reordering_idn}. (Can't reorder {cont_idn})", {
                reordering_idn: reordering_idn,
                cont_idn: cont_idn
            }));
        }
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

// function is_authorized(word, old_owner, action, reporter) {
//     reporter = reporter || function () {};
    var change_idn = word.idn;
    var new_owner = word.sbj;
    var change_vrb = word.vrb;
    var target = word.obj;

    // First stage of decision-making:
    var is_change_mine = new_owner === that.IDN.me;
    var did_i_change_last = old_owner === that.IDN.me;
    var is_change_admin = that.is_admin(new_owner);
    var did_admin_change_last = that.is_admin(old_owner);
    var is_same_owner = new_owner === old_owner;

    // Second stage of decision making:
    var let_admin_change = ! did_i_change_last                            && is_change_admin;
    var let_owner_change = ! did_i_change_last && ! did_admin_change_last && is_same_owner;

    // Third stage of decision making:
    // var only_i_can_do_these = [
    //     // NOTE:  These rearranging actions are only allowed by the browsing user.
    //     //        Not the admin nor the owner (if they're somebody else of course).
    //     MONTY.IDN.CAT_MY,
    //     MONTY.IDN.CAT_THEIR,
    //     MONTY.IDN.CAT_ANON
    // ];
    var ok;
    // if (has(only_i_can_do_these, change_vrb)) {
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
            that.user_name_short(old_owner)
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

/**
 * Is this verb something a user only does to himself?
 *
 * In other words, ignore the action if the owner or administrator did it.
 */
ContributionLexi.prototype.is_verb_guardrailed = function ContributionLexi_is_verb_guardrailed(_verb_idn_) {
    throw Error("You should override the .is_verb_guardrailed() method.");
}

ContributionLexi.prototype.user_name_short = function ContributionLexi_user_name_short(_user_idn_) {
    throw Error("You should override the .user_name_short() method.");
};

ContributionLexi.prototype.is_admin = function ContributionLexi_is_admin(_user_idn_) {
    throw Error("You should override the .is_admin() method.");
};

// function user_name_short(user_idn) {
//     if (is_defined(user_idn)) {
//         if (has(MONTY.u, user_idn)) {
//             return MONTY.u[user_idn].name_short;
//         } else {
//             return user_idn;
//         }
//     } else {
//         return "(unowned)";
//     }
// }
//
// function is_admin(user_idn) {
//     if (has(MONTY.u, user_idn)) {
//         return MONTY.u[user_idn].is_admin;
//     } else {
//         return false;
//     }
// }
//



/**
 * //// IdnSequence //// A sequence of idns, e.g. for the contributions in a category.
 *
 * Differences between a Lexi and an IdnSequence:
 * - A Lexi contains words, each word is indexed by an idn.
 * - An IdnSequence is an ordered sequence of idns.
 *   Each idn probably refers to a word in some Lexi,
 *   but the word is not contained by the IdnSequence.
 * - An IdnSequence is ordered.  A Lexi is not.
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
    if ( ! (that instanceof IdnSequence)) {
        return new IdnSequence();
    }
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
 * @param {function} error_callback - in case it was never there
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
 * @param error_callback
 */
IdnSequence.prototype.renumber = function IdnSequence_insert(idn_old, idn_new, error_callback) {
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
 * @param error_callback
 */
IdnSequence.prototype.insert = function IdnSequence_insert(idn, idn_to_right, error_callback) {
    var that = this;
    error_callback = error_callback || function () {};
    if (is_specified(idn_to_right)) {
        if (idn_to_right === that.fence_post_right) {
            that.insert_right(idn);
        } else {
            var index = that._sequence.indexOf(idn_to_right);
            if (index === -1) {
                error_callback(f("Can't insert {idn} at {idn_to_right} in:\n{idns}", {
                    idn: idn,
                    idn_to_right: idn_to_right,
                    idns: that._sequence.join(" ")
                }));
                that.insert_left(idn);
            } else {
                that._sequence.splice(index, 0, idn);
            }
        }
    } else {
        // TODO:  console.error()?
        that.insert_left(idn);
    }
}

IdnSequence.prototype.insert_left = function IdnSequence_insert_left(idn) {
    var that = this;
    that._sequence.unshift(idn);
}

IdnSequence.prototype.insert_right = function IdnSequence_insert_right(idn) {
    var that = this;
    that._sequence.push(idn);
}

/**
 * contribution.js
 * ---------------
 * Parse the contribution words in a lex, along with their retinue:
 * category, edit, caption, rearrange.
 *
 * No user interface here (other than the developer console), allowing multiple presentations to
 * use the same logic.  Also testing.
 */


/**
 * Collection of multi-media contributions:  plain text or a url for e.g. a video or image.
 *
 * Contributions are categorized and ordered within their categories.
 *
 * @property LexContribution.cat_words.by_name.my
 * @property LexContribution.cat_words.by_name.their
 * @property LexContribution.cat_words.by_name.anon
 * @property LexContribution.cat_words.by_name.trash
 * @property LexContribution.cat_words.by_name.about
 * @property LexContribution.idn_of.contribute
 * @property LexContribution.idn_of.edit
 * @property LexContribution.idn_of.caption
 * @property LexContribution.idn_of.rearrange
 * @property LexContribution.idn_of.rightmost
 */
class LexContribution extends qiki.LexClient {
    constructor(...args) {
        super(...args)
        var that = this;
        that.expect_definitions(
            'category',
            'locus',
            'contribute',
            'caption',
            'edit',
            'rearrange',
            'rightmost',
            'interact',
        );
        // NOTE:  The categories are not here (my, their, trash, etc.).
        //        Those idns are available as e.g. lex.cat_words.by_name.my.idn

        // NOTE:  The interact verbs are not here (bot, start, pause, quit, etc.).
        //        They are not defined until and unless they're used.
        //        And we allow new ones to come and go without complaint.
        //        And they are referred to only by name in this code, not idn.
        // FIXME:  Going to have to rejigger all this so (a) users can't specify a name for an
        //         interaction that the lex then goes ahead and defines, and (b) so each
        //         child (verb, I guess we're calling them verbs) gets its own namespace, e.g.
        //         now we couldn't have a category named 'play' or an interaction named 'edit'.

        that.cat_words = new qiki.Bunch();
        that.notify = function () {};

        that.do_track_superseding = false;
        // NOTE:  true - edit words remember words they superseded, can call .report_edit_history()
        //        false - save memory, must never call .report_edit_history()

        that._category_handlers = [];
    }

    get me() { return this.agent_from_idn(this.options.me_idn); }

    /**
     * Use different Word subclasses for different verbs.
     *
     * Use CategoryWord for each category definition.
     * Use a custom class for each verb:  contribute, edit, caption, rearrange
     * Notice that ContributeOriginalWord and EditWord are both derived from ContributionWord
     *
     * TODO:  There's a lot of power here.  Maybe it would be better imbued in some registered
     *        word handlers.  Less inheritance, more composition perhaps?
     *        {contribute: function () {...}, edit: function () {...}, category: ...}
     *        Had something like that once, but it wasn't odorless.
     *        Or maybe {contribute:Contribute, edit:Edit, category:Category, ...}
     */
    word_class(idn, whn, sbj, vrb, ...obj_values) {
        var that = this;
        switch (vrb) {

        case that.idn_of.contribute:   return ContributeOriginalWord;
        case that.idn_of.edit:         return EditWord;
        case that.idn_of.caption:      return CaptionWord;
        case that.idn_of.rearrange:    return RearrangeWord;

        case that.idn_of.define:
            if (sbj === that.idn_of.lex) {
                parent = obj_values[qiki.LexClient.I_DEFINITION_PARENT];
                if (parent === that.idn_of.category) {
                    return CategoryWord;
                }
            }
            break;
        }
        return qiki.Word;
    }

    /**
     * Handle the instantiation of a CategoryWord.
     */
    on_category(handler) {
        this._category_handlers.push(handler);
    }
    trigger_category(category_word) {
        var that = this;
        looper(that._category_handlers, function (_, handler) {
            handler(category_word);
        });
    }
    /**
     * Should we let this reference-word affect our rendering?
     *
     * The hierarchy of changes to a contribution are:
     *     original contributor < system admin < me (browsing user)
     *
     * So once I (a logged-in user) changes a contribution, I will ignore changes by others.
     * Before that, admin changes similarly stop original author changes.
     *
     * @param word - the word causing a change (e.g. edit or re-categorization or rearrangement)
     *               word.idn is the idn number of the word
     *               word.sbj is the idn qstring of the user who initiated this change.
     *               word.vrb is the idn number of the verb
     *               word.obj is the idn number of the object
     * @param old_owner - tricky - id of the last person we authorized to change this
     *                    contribution.  It starts off as the original contributor.
     *                    But then if I (the browsing user) moved it or edited it, then I'm the
     *                    owner.  But before that if the system admin moved or edited it,
     *                    then they became the owner.  This field was stored in the word.sbj.
     *                    BUT if we return true, then we expect the .sbj to be
     *                    overridden by whoever initiated THIS change!
     * @param action - text describing the change.
     *                 (This may be briefly word.vrb.txt, as if that were accessible in JS,
     *                 or it may be longer, e.g. "drop on right end of my")
     * @return {boolean}
     */
    is_authorized(
        word,
        old_owner,
        action
    ) {
        var that = this;

        // NOTE:  We don't let owner or admin "drag to my.*"  (not even for virgin users)
        //            Shame that removes the Seuss quote, and the top will be empty for new
        //            users.
        //        Nor other.* nor anon.*
        //            (It's weird that we allow recategorizations to there at all,
        //            less weird that we allow rearrangements within those categories,
        //            but it would be weirder if we allowed anyone ELSE do those FOR me.)
        //            But this eliminates admin rearranging the "other" category.
        //            Which would be problematic anyway, as different users already have
        //            different stuff there.  So admin placing X to the left of Y would
        //            already be unusable to the user who created Y (or moved it to category
        //            'my') because it wouldn't then be in category 'other'.
        //        But we do allow owner or admin to "drag to trash.*"
        //            And that affects everyone else, unless of course I drag it elsewhere
        //            later.  A little weird that owner or admin rearrangements WITHIN trash
        //            affect everyone.
        //        We do allow admin to "drag to about.*" (Only admin can create those words
        //            anyway.)  And those actions rightly affect everyone.
        // TODO:  The confusion above is a symptom of the deeper confusion:
        //            Are categories user-interest partitions, or user-origin partitions?
        //            IOW are we separating things by where they came from?
        //                (anonymous users, me, other logged-in users)
        //            or by what we want to do with them?
        //                (my unslumping, others, trash)

        var new_owner = word.agent;

        // First stage of decision-making, what are the factors:
        var is_change_mine = that.me === new_owner;
        var did_i_change_last = that.me === old_owner;
        var is_change_admin = new_owner.is_admin;
        var did_admin_change_last = old_owner.is_admin
        var is_same_owner = new_owner === old_owner;   // qiki.Lex.is_equal_idn(new_owner, old_owner);
        var is_guarded = that.is_word_guarded(word);
        var welcome_oppression = ! is_guarded && ! did_i_change_last;

        // Second stage of decision making, do we let the owner or admin change things for us:
        var let_admin_change = welcome_oppression                            && is_change_admin;
        var let_owner_change = welcome_oppression && ! did_admin_change_last && is_same_owner;

        // Third stage, ok or not:
        var ok = is_change_mine || let_admin_change || let_owner_change;

        // Decision:
        if (ok) {
            that.notify(f("{idn}. Yes {user} may {action} {cont_idn}, work of {author}", {
                idn: word.idn,
                user: new_owner.name_presentable(),
                action: action,
                cont_idn: word.obj.contribute,
                author: old_owner.name_presentable()
            }));
        } else {
            that.notify(f("{idn}. Nope {user} won't {action} {cont_idn}, work of {author}", {
                idn: word.idn,
                user: new_owner.name_presentable(),
                action: action,
                cont_idn: word.obj.contribute,
                author: old_owner.name_presentable()
            }));

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
    starting_cat(word) {
        var that = this;
        console.assert(
            (
                is_specified(that.cat_words.by_name.my) &&
                is_specified(that.cat_words.by_name.their) &&
                is_specified(that.cat_words.by_name.anon)
            ),
            "Categories not defined yet:",
            that.cat_words.by_name,
            "\nidns defined:",
            that.idn_of
        );
        if (that.me === word.agent) {
            return that.cat_words.by_name.my;
        } else if ( ! word.agent.is_authenticated()) {
            return that.cat_words.by_name.anon;
        } else {
            return that.cat_words.by_name.their;
        }
    }
    /**
     * Find a ContributionWord instance by its idn.  2D loop through all cont_words in all cats.
     *
     * @param cont_idn
     * @returns {ContributionWord|null} - null = there is no contribution with that idn.
     */
    cont_word_from_idn(cont_idn) {
        var that = this;
        type_should_be(cont_idn, Number);
        var cont_word = null;
        that.cat_words.loop(function (/** @type {CategoryWord} */ cat) {
            cont_word = cat.cont_words.get(cont_idn);
            if (cont_word !== null) {
                return false;
            }
        });
        return cont_word;
    }
    /**
     * A guarded word is a rearrange to the my, other, or anon categories.
     *
     * Owner or admin rearrangements to those categories don't affect anyone else.
     */
    is_word_guarded(word) {
        var that = this;
        var guarded_categories = [
            that.cat_words.by_name.my.idn,
            that.cat_words.by_name.their.idn,
            that.cat_words.by_name.anon.idn
        ];
        return word.vrb === that.idn_of.rearrange && has(guarded_categories, word.obj.category);
    }
    /**
     * Report all contribution edit histories in the console.
     *
     * Only edits that were "authorized" (e.g. we made them, etc.)
     *
     * EXAMPLE:
     *     2.2Y     1911. e "From this day to the ending of the world, \nWe in (420)
     *         5d   1891. c "From this day to the ending of the world,\n...we  (422)
     *
     * Meaning 2.2 years ago a contribution was edited (to 420 characters),
     * and 5 days before that, the original was submitted (422 characters long).
     */
    // TODO:  Track caption edits too.
    report_edit_history_in_console(report) {
        var that = this;
        const MAX_DEPTH = 20;
        var superseded_idns = [];
        var active_idns = [];
        if (that.do_track_superseding) {
            report("Edit history:");
        } else {
            report(
                "%cEdit history won't work unless you set .do_track_superseding = true",
                'color:red;'
            );
            report(
                "%cBut here's what we know:",
                'color:red;'
            );
        }
        that.cat_words.loop(function (/** @type {CategoryWord} */ cat) {
            active_idns = active_idns.concat(cat.cont_words.idn_array());
            cat.cont_words.loop(function (/** @type {ContributionWord} */ cont_word) {
                if (cont_word.vrb !== that.idn_of.contribute) {
                    var this_cont = cont_word;
                    var later_cont = null;
                    report("");
                    var i_depth = 0;
                    do {
                        var delta, whn;
                        var is_first_line_and_latest_version = later_cont === null;
                        if (is_first_line_and_latest_version) {
                            delta = delta_format(
                                seconds_since_1970() -
                                this_cont.whn_seconds()
                            );
                            whn = delta.amount_long + delta.units_short;
                        } else {
                            delta = delta_format(
                                later_cont.whn_seconds() - this_cont.whn_seconds()
                            );
                            whn = "    " + delta.amount_short + delta.units_short;
                            superseded_idns.push(this_cont.idn);
                        }
                        whn =           whn.padEnd(4 + 2 + 1);
                        var whn_blank = " ".padEnd(4 + 2 + 1);
                        var idn_padded = String(this_cont.obj.contribute).padStart(5);
                        var idn_blank =                               " ".padStart(5);
                        var one_line = f("{whn} {idn}. {vrb} {text} ({len})", {
                            whn: whn,
                            idn: String(this_cont.idn).padStart(5),
                            vrb: that.by_idn[this_cont.vrb].obj.name.substring(0,1),
                            text: JSON.stringify(this_cont.obj.text).substring(0,50),
                            len: this_cont.obj.text.length
                        });
                        var is_cont_word = this_cont.vrb === that.idn_of.contribute;
                        var is_superseding = is_specified(this_cont.supersedes);
                        if (is_cont_word && is_superseding) {
                            report("%c\t" + one_line, 'color:magenta;');
                            var unexpectedly_superseded = f(
                                "{whn} {idn}  " +
                                "Unexpectedly, this contribute word supersedes {idn_superseded}",
                                {
                                    whn: whn_blank,
                                    idn: idn_blank,
                                    idn_superseded: this_cont.supersedes.idn
                                }
                            );
                            report("%c\t" + unexpectedly_superseded, 'color:magenta;');
                            // NOTE:  Only edit words are expected to supersede.
                        } else if ( ! is_cont_word && ! is_superseding) {
                            report("%c\t" + one_line, 'color:red;');
                            var all_we_know_about_superseded_word = f(
                                "{whn} {idn}. " +
                                "Unexpectedly, this edit word doesn't remember " +
                                "the word it superseded",
                                {
                                    whn: whn_blank,
                                    idn: idn_padded
                                }
                            );
                            report("%c\t" + all_we_know_about_superseded_word, 'color:red;');
                            // NOTE:  All edit words are expected to supersede.
                        } else {
                            report("\t" + one_line);
                        }
                        later_cont = this_cont;
                        this_cont = this_cont.supersedes;
                        i_depth++;
                        if (i_depth >= MAX_DEPTH && is_specified(this_cont)) {
                            console.warn("Edit history is more than", MAX_DEPTH, "levels");
                            break;
                        }
                    } while (is_specified(this_cont))
                }
            });
        });
        report("Active:", active_idns.join(" "));
        report("Superseded:", superseded_idns.join(" "));
        var duplicated_idns = find_duplicates(active_idns.concat(superseded_idns));
        if (duplicated_idns.length === 0) {
            report("No duplicates.");
        } else {
            console.error("Duplicated:", duplicated_idns);
        }
    }
    /**
     * Affirm that Categories and Contributions are self-consistent.
     *
     * Step 1.  For each category, for each contribution within it...
     *          Each contribution should know what category it's in.
     */
    assert_consistent() {
        var that = this;
        that.cat_words.loop(function (/** @type {CategoryWord} */ cat_word) {
            cat_word.cont_words.loop(function (/** @type {ContributionWord} */ cont_word) {
                console.assert(
                    cat_word === cont_word.cat,   // NOTE:  object instance comparison
                    "INCONSISTENT:  cat",
                    cat_word.obj.name,
                    cat_word.idn,
                    "has cont",
                    cont_word.idn,
                    "- but it's in cat",
                    cont_word.cat.obj.name,
                    cont_word.cat.idn,
                );
            });
        });
    }
}


class CategoryWord extends qiki.Word {
    constructor(...args) {
        super(...args);
        var that = this;
        that.cont_words = new qiki.Bunch();
        that.lex.cat_words.add_rightmost(that, that.obj.name);
        that.lex.trigger_category(that);
    }
}


class ContributionWord extends qiki.Word {
    constructor(...args) {
        super(...args)
        var that = this;

        that.capt = null;

        // noinspection SillyAssignmentJS
        /** @type {CategoryWord} */ that.cat = that.cat;
        // NOTE:  Tell JetBrains .cat will be a property, eye-roll emoji.
        //        We can't assign it until we get to the derived class constructor.

    }
}


class ContributeOriginalWord extends ContributionWord {
    constructor(...args) {
        super(...args)
        var that = this;
        if (that.agent.is_authenticated() && ! that.agent.is_named()) {
            // NOTE:  Authenticated users should get named by the lex when they first log
            //        in, and any time after that if their name changes.
            console.warn(
                "Contribution word", that.idn,
                "scan line", that.num_words,
                "unknown authenticated user", that.agent.idn_presentable()
            );
        }
        if ( ! (
            is_specified(that.lex.cat_words.by_name.my) &&
            is_specified(that.lex.cat_words.by_name.anon) &&
            is_specified(that.lex.cat_words.by_name.their)
        )) {
            that.lex.scan_fail(
                "Contribution word", that.idn,
                "before categories defined", that.lex.cat_words.by_name
            );
        }
        that.cat = that.lex.starting_cat(that);
        that.cat.cont_words.add_leftmost(that);

        // NOTE:  Captioning does not change a contribution's owner.
        //        (It does change the caption's owner.)
        //        Moving and editing do change the contribution's owner.
        //        (They do not change the caption's owner.  One way this could be weird:
        //        if I move an anonymous contribution to "my" category, then that user
        //        edits the caption, I will see the new caption too.  So this is a possible
        //        leak between anonymous users.)

        that.lex.notify(f("{idn}. {author} contributes {n} bytes to {cat}", {
            idn: that.idn,
            author: that.agent.name_presentable(),
            cat: that.cat.obj.name,
            n: that.obj.text.length
        }));
    }
}


class EditWord extends ContributionWord {
    constructor(...args) {
        super(...args)
        var that = this;
        that.supersedes = null;   // the ContributionWord eclipsed (null=not found, not allowed)
        var old_cont = that.lex.cont_word_from_idn(that.obj.contribute);
        if (old_cont === null) {
            if (that.lex.me === that.agent) {
                // NOTE:  Weird situation:  I (the browsing user) did this edit, but for some
                //        reason the old
                //        contribution that this edit displaced was not in my view.  Oh well,
                //        treat the edit itself as a new contribution from me.  This is
                //        problematic of course, if I was merely editing some contribution
                //        somewhere.  I don't necessarily want it elevated to my category.  But
                //        because it was lost that's what now happens.  I guess it's better than
                //        not seeing it at all.
                that.cat = that.lex.starting_cat(that);
                that.cat.cont_words.add_leftmost(that);
                that.lex.notify(f(
                    "{new_cont_idn}. Resurrecting my edit of ghostly #{old_cont_idn})", {
                        new_cont_idn: that.idn,
                        old_cont_idn: that.obj.contribute
                    }
                ));
            } else {
                that.lex.notify(f("{new_cont_idn}. (Can't edit {old_cont_idn})", {
                    new_cont_idn: that.idn,
                    old_cont_idn: that.obj.contribute
                }));
            }
        } else {
            if (that.lex.is_authorized(that, old_cont.agent, "edit")) {
                old_cont.cat.cont_words.replace(that.obj.contribute, that);
                that.cat = old_cont.cat;
                that.capt = old_cont.capt;
                // TODO:  Should a lesser-privileged caption owner
                //        be replaced by new_cont_owner?
                //        Maybe always do this here:
                //            that.capt.owner = that.sbj;
                //        Is there a downside?
                //        What does it mean to "own" a contribution or caption??
                //        It's certainly not equivalent to being permitted to edit it.
                if (that.lex.do_track_superseding) {
                    that.supersedes = old_cont;
                    // NOTE:  This maintains a reference to the older, superseded contribute
                    //        word (or edit word).  There is a theoretical memory penalty to
                    //        doing this.  If instead .do_track_superseding is false, and garbage
                    //        collection actually happens, then the memory used by the old
                    //        word could be recovered.
                }
                console.assert(
                    ! that.cat.cont_words.has(old_cont.idn),
                    "WTF, this contribution should be gone from cat", that.cat.obj.name,
                    old_cont
                );
                console.assert(
                    that.lex.cont_word_from_idn(old_cont.idn) === null,
                    "WTF, superseded contribution should be gone from all categories",
                    old_cont
                );
                // TODO:  Maybe superseded contributions can be destroyed:
                //        old_cont.destroy()
            }
        }
        // if ( ! that.agent.is_authenticated()) {
        //     that.was_submitted_anonymous = true;
        //     // NOTE:  Editing by an anonymous agent makes a post anonymous, though
        //     //        it may not move it to the anonymous category.
        //     //        The only way it gets in play anyway, is if it was edited by the
        //     //        browsing user.
        // }
    }
}


class CaptionWord extends qiki.Word {
    constructor(...args) {
        super(...args)
        var that = this;
        var cont_word = that.lex.cont_word_from_idn(that.obj.contribute);
        if (cont_word === null) {
            that.lex.notify(f("{capt_idn}. (Can't caption {cont_idn})", {
                cont_idn: that.obj.contribute,
                capt_idn: that.idn
            }));
        } else {
            var old_capt_owner;
            if (is_specified(cont_word.capt)) {
                old_capt_owner = cont_word.capt.agent;
            } else {
                old_capt_owner = cont_word.agent;
            }
            if (that.lex.is_authorized(that, old_capt_owner, "caption")) {
                cont_word.capt = that;
            }
        }
    }
}


class RearrangeWord extends qiki.Word {
    constructor(...args) {
        super(...args)
        var that = this;
        if ( ! qiki.Lex.is_idn_defined(that.lex.idn_of.rightmost)) {
            that.lex.scan_fail("Rearrange before 'rightmost' definition", that.idn);
        }
        if ( ! that.lex.cat_words.has(that.obj.category)) {
            that.lex.scan_fail(
                "Rearrange before category definition",
                that.idn,
                that.obj.category
            );
        }
        var cont_word = that.lex.cont_word_from_idn(that.obj.contribute);
        if (cont_word === null) {
            that.lex.notify(f(
                "{reordering_idn}. (Can't find contribution {cont_idn} to rearrange)", {
                    reordering_idn: that.idn,
                    cont_idn: that.obj.contribute
                }
            ));
        } else {
            var new_cat = that.lex.cat_words.get(that.obj.category);
            var is_rightmost = qiki.Lex.is_equal_idn(that.obj.locus, that.lex.idn_of.rightmost);
            var old_cat = cont_word.cat;
            var old_cont_owner = cont_word.agent;
            var action_template = is_rightmost
                ? "rearrange to right end of {cat},"
                : "rearrange to the left of #{idn} in {cat},";
            var action = f(action_template, {
                cat: new_cat.obj.name,
                idn: that.obj.locus
            });
            if (that.lex.is_authorized(that, old_cont_owner, action)) {
                if (is_specified(old_cat)) {
                    old_cat.cont_words.delete(that.obj.contribute);
                } else {
                    console.error(
                        "Why didn't contribution have a category?",
                        type_name(old_cat),
                        cont_word.cat,
                        cont_word
                    );
                }
                if (is_rightmost) {
                    new_cat.cont_words.add_rightmost(cont_word);
                } else {
                    if ( ! new_cat.cont_words.add_left_of(cont_word, that.obj.locus)) {
                        new_cat.cont_words.add_leftmost(cont_word);
                        // NOTE:  locus can't be found, insert leftmost instead.
                    }
                }
                cont_word.cat = new_cat;

                cont_word.sbj = that.sbj;   // HACK:  Confusifying, eg because idn is unchanged.
                // NOTE:  This used to transfer ownership from the original author to
                //        the person who rearranged it:
                //            cont_word.owner = that.sbj;
                //        What was the rationale for that?
                //        Taking ownership of a contribution by moving it.
                //        Makes more sense moving to my than moving from other to trash.
                //        If we don't have to maintain a separate owner property for each
                //        contribution (in addition to sbj as original author).
                // TODO:  Commandeer the caption ownership too?
                //        cont_word.capt.owner = new_cont_owner;
            }
        }
    }
}

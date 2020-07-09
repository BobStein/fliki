"""
fliki is a qiki implemented in Flask and Python.

Authentication courtesy of flask-login and authomatic.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

# from __future__ import unicode_literals
# NOTE:  The above line doesn't work when WSGIScriptAlias mentions this .py file.
# THANKS:  import locally (from .wsgi file named in WSGIScriptAlias) to make unicode_literals work
#     https://stackoverflow.com/q/38149698/673991#comment63730322_38149698
#     "If the script is compiled with flags = 0, the __future__ statements will be useless.
#     Try using import to actually get your module. - o11c"
#     (Still don't know what o11c meant by "flags = 0".)
#     But from __future__ import print_function appears to work anyway!

import abc
import functools
import json
import logging
import os
import re
import sys
import threading
import time

import traceback
import uuid

import authomatic
import authomatic.adapters
import authomatic.core
import authomatic.providers.oauth2
import flask   # , send_from_directory
import flask_login
import git
import six
import six.moves.urllib as urllib
import werkzeug.local
import werkzeug.useragents

import qiki
from qiki.number import type_name
import secure.credentials
import to_be_released.web_html as web_html


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '3.4.1'   # https://developers.google.com/speed/libraries/#jquery
JQUERYUI_VERSION = '1.12.1'   # https://developers.google.com/speed/libraries/#jquery-ui
DO_MINIFY = False
config_names = ('AJAX_URL', 'JQUERY_VERSION', 'JQUERYUI_VERSION')
config_dict = {name: globals()[name] for name in config_names}      # TODO:  Enumerant class
SCRIPT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))   # e.g. '/var/www/flask'
PARENT_DIRECTORY = os.path.dirname(SCRIPT_DIRECTORY)             # e.g. '/var/www'
GIT_SHA = git.Repo(SCRIPT_DIRECTORY).head.object.hexsha
GIT_SHA_10 = GIT_SHA[ : 10]
NUM_QOOL_VERB_NEW = qiki.Number(1)
NUM_QOOL_VERB_DELETE = qiki.Number(0)
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS = 10
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_ANSWERS = 60
THUMB_MAX_WIDTH = 160
THUMB_MAX_HEIGHT = 128
NON_ROUTABLE_IP_ADDRESS = '10.255.255.1'   # THANKS:  https://stackoverflow.com/a/904609/673991
NON_ROUTABLE_URL = 'https://' + NON_ROUTABLE_IP_ADDRESS + '/'   # for testing
SHOW_LOG_AJAX_NOEMBED_META = True
CATCH_JS_ERRORS = False
POPUP_ID_PREFIX = 'popup_'
INTERACTION_VERBS = dict(
    BOT='bot',         # |>  global play button
    START='start',     # |>  individual media play
    QUIT='quit',       # []  ARTIFICIAL, manual stop, skip, or pop-up close
    END='end',         # ..  NATURAL, automatic end of the media
    PAUSE='pause',     # ||  either the global pause or the pause within the iframe
    RESUME='resume',   # |>
    ERROR='error',     #     something went wrong, human-readable txt
    UNBOT='unbot',     #     bot ended, naturally or artificially (but not crash)
)
# TODO:  Move to WorkingIdns.__init__() yet still bunch together somehow?
#        Problem is, I'd like to define new ones without necessarily generating words for them,
#        until of course they are used.


YOUTUBE_PATTERNS = [
    "https?://(?:[^\\.]+\\.)?youtube\\.com/watch/?\\?(?:.+&)?v=([^&]+)",
    "https?://(?:[^\\.]+\\.)?(?:youtu\\.be|youtube\\.com/embed)/([a-zA-Z0-9_-]+)",
]
# THANKS:  Media URL patterns, https://noembed.com/providers


INSTAGRAM_PATTERNS = [
    "https?://instagram\\.com/p/.*",
    "https?://instagr\\.am/p/.*",
    "https?://www\\.instagram\\.com/p/.*",
    "https?://www\\.instagr\\.am/p/.*",
    "https?://instagram\\.com/p/.*",
    "https?://instagr\\.am/p/.*",
    "https?://www\\.instagram\\.com/p/.*",
    "https?://www\\.instagr\\.am/p/.*",
]


# noinspection SpellCheckingInspection
NOEMBED_PATTERNS = (
    YOUTUBE_PATTERNS +
    INSTAGRAM_PATTERNS +
    [
        "https?://(?:www\\.)?vimeo\\.com/.+",

        "https?://(?:www|mobile\\.)?twitter\\.com/(?:#!/)?([^/]+)/status(?:es)?/(\\d+)",
        "https?://twitter\\.com/.*/status/.*",

        "https?://.*\\.flickr\\.com/photos/.*",
        "https?://flic\\.kr/p/.*",

        "https?://www\\.(dropbox\\.com/s/.+\\.(?:jpg|png|gif))",
        "https?://db\\.tt/[a-zA-Z0-9]+",

        "https?://soundcloud\\.com/.*",   # but it can't currently be animated

        "https?://www\\.dailymotion\\.com/video/.*",

        # NON_ROUTABLE_URL,   # for testing
    ]
)

time_lex = qiki.TimeLex()
t_last_anonymous_question = time_lex.now_word()
t_last_anonymous_answer = time_lex.now_word()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
log_handler = logging.StreamHandler(sys.stdout)
log_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asc' 'time)s - %(name)s - %(level''name)s - %(message)s')
log_handler.setFormatter(formatter)
logger.addHandler(log_handler)
# THANKS:  Log to stdout, http://stackoverflow.com/a/14058475/673991

flask_app = flask.Flask(
    __name__,
    static_url_path='/meta/static',
    static_folder='static'
)
flask_app.config.update(
    # SERVER_NAME=secure.credentials.Options.server_domain_port,
    # NOTE:  setting SERVER_NAME has benefits:  url_for() can be used with app_context()
    #        setting SERVER_NAME has drawbacks:  alternate domain hits get 404

    SESSION_COOKIE_DOMAIN=secure.credentials.Options.session_cookie_domain,
    # NOTE:  Without this, two different fliki servers running on different subdomains
    #        could share the same set of session variables.
    # SEE:  Session domain, https://flask.palletsprojects.com/en/1.1.x/config/#SESSION_COOKIE_DOMAIN
    # SEE:  Host-only cookie, set to False, https://stackoverflow.com/a/28320172/673991
)
flask_app.secret_key = secure.credentials.flask_secret_key


@flask_app.before_first_request
def flask_earliest_convenience():
    version_report()


@flask_app.before_request
def before_request():
    parts = urllib.parse.urlparse(flask.request.url)
    if parts.netloc in secure.credentials.Options.redirect_domain_port:
        new_netloc = secure.credentials.Options.redirect_domain_port[parts.netloc]

        # noinspection PyProtectedMember
        new_parts = parts._replace(netloc=new_netloc)
        # NOTE:  netloc is host:port, but ports 80 or 443 are implicit
        # SEE:  _replace() method suggestion,
        #       https://docs.python.org/library/urllib.parse.html#urllib.parse.urlparse
        # THANKS:  hostname and port substitution, https://stackoverflow.com/a/21629125/673991

        new_url = urllib.parse.urlunparse(new_parts)
        print("REDIRECT from", parts.netloc, "to", new_url)
        return flask.redirect(new_url, code=301)
        # THANKS:  Domain change with redirect, https://stackoverflow.com/a/10964868/673991

        # NOTE:  apache .conf RewriteRule can redirect http to https


class WorkingIdns(object):

    # NOTE:  For a given lex (database) these idns will never change.
    #        The instantiation of LexFliki actually represents a *connection* to the lex,
    #        which comes and goes every session (i.e. every HTTP request-response cycle.
    #        What object can better represent the lex itself, including these idns?
    def __init__(self, lex):
        with flask_app.app_context():
            # FIXME:  Why the eff is app_context() called??
            #         Maybe so this class can be instantiated once at server startup to
            #         detect errors with IDN definitions a little earlier.
            if lex is not None:
                self.LEX               = lex.noun(u'lex').idn
                self.VERB              = lex.noun(u'verb').idn
                self.DEFINE            = lex.verb(u'define').idn
                self.LISTING           = lex.noun(u'listing').idn
                self.NAME              = lex.verb(u'name').idn
                self.BROWSE            = lex.verb(u'browse').idn
                self.SESSION_OBSOLETE  = lex.verb(u'session').idn
                self.IP_ADDRESS_OBSOLETE = lex.verb(u'IP address').idn
                self.PATH              = lex.noun(u'path').idn
                self.QUESTION_OBSOLETE = lex.noun(u'question').idn
                self.ANSWER            = lex.noun(u'answer').idn
                self.TAG               = lex.verb(u'tag').idn
                self.IP_ADDRESS_TAG    = lex.define(self.TAG, u'ip address tag').idn
                self.USER_AGENT_TAG    = lex.define(self.TAG, u'user agent tag').idn
                self.REFERRER          = lex.verb(u'referrer').idn
                self.ICONIFY           = lex.verb(u'iconify').idn
                self.ANONYMOUS_LISTING = lex.define(self.LISTING, u'anonymous').idn
                self.GOOGLE_LISTING    = lex.define(self.LISTING, u'google user').idn
                self.QOOL              = lex.verb(u'qool').idn
                self.UNSLUMP_OBSOLETE  = lex.verb(u'unslump').idn

                self.RESOURCE          = lex.noun(u'resource').idn
                self.QUOTE             = lex.define(self.RESOURCE, u'quote').idn

                self.CONTRIBUTE        = lex.verb(u'contribute').idn
                self.CAPTION           = lex.verb(u'caption').idn

                self.CATEGORY          = lex.verb(u'category').idn
                self.CAT_MY            = lex.define(self.CATEGORY, u'my').idn
                self.CAT_THEIR         = lex.define(self.CATEGORY, u'their').idn
                self.CAT_ANON          = lex.define(self.CATEGORY, u'anon').idn
                self.CAT_TRASH         = lex.define(self.CATEGORY, u'trash').idn
                self.CAT_ABOUT         = lex.define(self.CATEGORY, u'about').idn
                self.FENCE_POST_RIGHT  = lex.noun(u'fence post right').idn
                # TODO:  Rename FENCE_POST_END?
                #        Because order could be vertical, e.g. categories,
                #        not to mention right-to-left in arabic/hebrew.

                # self.EDIT_TXT          = lex.verb(u'edit txt').idn
                # self.CONTRIBUTE_EDIT   = lex.define(self.EDIT_TXT, u'contribute edit').idn
                self.EDIT              = lex.verb(u'edit').idn

                # lex[lex](self.EXPLAIN, use_already=True)[self.FENCE_POST_RIGHT] = \
                #     u"Represent the contribution to the right of the right-most contribution in a category.", 2
                # lex[lex](self.EXPLAIN, use_already=True)[self.FENCE_POST_RIGHT] = \
                #     u"Use it for a reordering number, instead of a contribution idn. " \
                #     u"Call it a psuedo-contribution-idn. " \
                #     u"So when we say a new contribution goes to the left of this, " \
                #     u"we mean it goes all the way on the right. " \
                #     u"It solves this fence-post-problem: " \
                #     u"when 3 contributions exist already, there are 4 places a new one could go."
                # NOTE:  Oops, these step on each other.  Each thinks it's overwriting the other, because
                #        use_already looks at the latest s,v,o match.

                self.FIELD_FLUB        = lex.verb(u'field flub').idn   # report of some wrongness from the field

                self.INTERACT          = lex.verb(u'interact').idn   # UX action


    def dictionary_of_qstrings(self):
        of_idns = self.idn_from_symbol()
        of_qstrings = {name: idn.qstring() for name, idn in of_idns.items()}
        return of_qstrings

    def dictionary_of_ints(self):
        of_idns = self.idn_from_symbol()
        of_ints = {name: int(idn) for name, idn in of_idns.items()}
        return of_ints

    def idn_from_symbol(self):
        dict_members = dict_from_object(self)
        # members = dict_from_object(LexFliki._IDNS_READ_ONCE_AT_STARTUP).values()
        dict_idns = {k: v for k, v in dict_members.items() if isinstance(v, qiki.Number)}
        assert \
            all(isinstance(idn, qiki.Number) for idn in dict_idns.values()), \
            "Expecting Numbers.  These are not: " + repr(
                {n: type_name(x) for n, x in dict_idns.items() if not isinstance(x, qiki.Number)}
            ) + "  Did you forget `.idn` at the end?"
        return dict_idns

    def idns(self):
        return self.idn_from_symbol().values()


def dict_from_object(o):
    properties_and_functions_and_underscores = vars(o)
    properties = [
        p for p in properties_and_functions_and_underscores
        if not p.startswith('_') and not callable(p)
    ]
    the_dict = {p: getattr(o, p) for p in properties}
    return the_dict


class GoogleFlaskUser(flask_login.UserMixin):
    """Flask_login model for a Google user."""
    # TODO:  Merge this with GoogleQikiUser somehow

    def __init__(self, google_user_id):
        self.id = google_user_id


class LexFliki(qiki.LexMySQL):

    _credentials = secure.credentials.for_fliki_lex_database

    _IDNS_READ_ONCE_AT_STARTUP = None

    _global_lock = threading.Lock()
    # NOTE:  Redefining a singleton lock here, just for all the LexFliki instances,
    #        has the effect of limiting the resolving of race conditions.
    #        Other LexMySQL classes and instances are not involved.

    def __init__(self):
        self.query_count = 0
        # NOTE:  lex.IDN is made for use by e.g. cat_cont_order(),
        #        and therefore for spoofing by test_fliki.py which would test cat_cont_order()

        class WordFlikiSentence(qiki.Word):
            is_anonymous = False

            def to_json(self):
                dictionary = super(WordFlikiSentence, self).to_json()
                # if isinstance(self.sbj, self.lex.word_anon_class):
                if self.sbj.is_anonymous:
                    dictionary['was_submitted_anonymous'] = True
                return dictionary

            @property
            def name(self):
                if self.is_lex():
                    return "Lex"
                else:
                    raise NotImplementedError("WordFlikiSentence " + repr(self) + " has no name.")

            @property
            def is_admin(self):
                if self.is_lex():
                    return False
                else:
                    raise NotImplementedError("WordFlikiSentence " + repr(self) + " is neither admin nor not.")

            # TODO:  @property is_anonymous() too ?

        lex_fliki_instance = self

        class WordFlikiUser(qiki.Word):
            """
            Can be the sbj of a LexFliki sentence.  Anonymous or logged in.

            word.is_admin determination:
                secure.credentials.Options.system_administrator_users

            word.is_admin consequences (at least will try to remember to keep up here):
                Auth.login_html() prompt amended "(admin)"
                Can drag contributions to the About category
                    (enforced on both client and server sides)
                Contribution_home() HTML MONTY.u elements have "is_admin":true,
                Edits and category moves are used by other users
                    (if those users don't edit or move later than that)
            """
            lex = lex_fliki_instance

            def __init__(self, user_id, meta_idn):
                self.index = qiki.Number(user_id)
                self.meta_idn = meta_idn
                self.is_named = False
                self.is_admin = False
                self._name = None
                idn = qiki.Number(
                    self.meta_idn,
                    qiki.Suffix(qiki.Suffix.Type.LISTING, self.index)
                )
                super(WordFlikiUser, self).__init__(idn)

            @property
            def name(self):
                """
                Short name for the user.

                NOTE:  This has to be a decorated method, not a property variable,
                       because self._name is determined after the word becomes choate.
                """
                self._choate()
                return self._name

        class WordGoogle(WordFlikiUser):
            is_anonymous = False

            def __init__(self, google_id):
                assert self.lex.IDN is not None
                super(WordGoogle, self).__init__(google_id, self.lex.IDN.GOOGLE_LISTING)
                try:
                    self.is_admin = self.idn in secure.credentials.Options.system_administrator_users
                except AttributeError:
                    self.is_admin = False
                # TODO:  Find a (much) better way to elevate user powers.

            def _from_idn(self, idn):
                assert self.idn.is_suffixed()
                assert isinstance(self.meta_idn, qiki.Number)
                assert isinstance(self.index, qiki.Number)
                namings = self.lex.find_words(
                    sbj=self.lex.IDN_LEX,   # TODO:  sbj=meta_idn?  Meaning the listing tags the user with their name.
                    vrb=self.lex.IDN.NAME,
                    obj=idn,
                )
                try:
                    latest_naming = namings[-1]
                    # DONE:  This used to get the EARLIEST naming.
                except IndexError:
                    user_name = "(unnamed googloid {})".format(int(self.index))
                    # EXAMPLE:  (unnamed googloid 0q82_12__8A059E058E6A6308C8B0_1D0B00)
                    # FIXME:  Log out here
                    #         This can happen when switching the MySQL table,
                    #         flask session remembers the qiki user id
                    #         (idn shown in example above -- google id is inside the suffix)
                    #         but the new table has never named that idn.
                    #         Oh wow, big coincidence that the meta_idn is the same in both tables!
                    #         That sure can't be relied upon.
                    #         If it doesn't happen, then something else breaks.
                    #         Anyway, here we need to GTF out.
                    #         This is perhaps a small skirmish in the overall war
                    #         against ever giving data control over code.
                else:
                    user_name = latest_naming.txt
                    self.is_named = True
                txt = qiki.Text(user_name)
                num = qiki.Number(1)
                self.populate_from_num_txt(num, txt)
                self._name = user_name

        class WordAnon(WordFlikiUser):
            is_anonymous = True

            def __init__(self, session_id):
                assert self.lex.IDN is not None
                super(WordAnon, self).__init__(session_id, self.lex.IDN.ANONYMOUS_LISTING)

            def _from_idn(self, idn):
                assert self.idn.is_suffixed()
                assert isinstance(self.meta_idn, qiki.Number)
                assert isinstance(self.index, qiki.Number)
                parts = []
                ips = self.lex.find_words(
                    sbj=idn,   # TODO:  sbj=meta_idn here instead of composite_idn too?
                    vrb=self.lex.IDN.IP_ADDRESS_TAG,
                    obj=self.index,
                )
                try:
                    parts.append(six.text_type(ips[-1].txt))
                    # TODO:  Not just the latest IP address EVER, but the latest one tagged
                    #        in the context this txt will be USED.  (Somehow.)
                    #        This would depend on the sentence_word.whn for which
                    #        the idn passed to this function == sentence_word.sbj.idn
                    #        So above lex.find_words(idn_max = sentence_word.sbj.idn) or something.
                except IndexError:
                    '''session was never ip-address-tagged'''

                parts.append("session #" + render_num(self.index))

                uas = self.lex.find_words(
                    sbj=idn,
                    vrb=self.lex.IDN.USER_AGENT_TAG,
                    obj=self.index,
                    # TODO:  Combine these two find_words() calls.
                )
                try:
                    user_agent_str = six.text_type(uas[-1].txt)
                except IndexError:
                    '''session was never user-agent-tagged'''
                else:
                    try:
                        user_agent_object = werkzeug.useragents.UserAgent(user_agent_str)
                    except AttributeError:
                        parts.append("(indeterminate user agent)")
                    else:
                        # noinspection PyUnresolvedReferences
                        parts.append(user_agent_object.browser)   # "(browser?)")
                        # noinspection PyUnresolvedReferences
                        parts.append(user_agent_object.platform)   # "(platform?)")

                # TODO:  Make ip address, user agent, browser, platform
                #        separately available in anon and google word instances too.

                parts_not_null = (p for p in parts if p is not None)
                session_description = " ".join(parts_not_null)
                txt = qiki.Text(session_description)
                num = qiki.Number(1)
                self.populate_from_num_txt(num, txt)
                self._name = "anon#" + render_num(self.index)

        self.word_google_class = WordGoogle
        self.word_anon_class = WordAnon
        self.word_user_class = WordFlikiUser

        self.IDN = None
        # NOTE:  Shouldn't need self.IDN, and can't have it, until this Lex is initialized.
        #        One way this may break is if read_word() for a suffixed word
        #        were somehow called by the Lex initialization.

        super(LexFliki, self).__init__(word_class=WordFlikiSentence, **self._credentials)

        if LexFliki._IDNS_READ_ONCE_AT_STARTUP is None:

            LexFliki._IDNS_READ_ONCE_AT_STARTUP = WorkingIdns(self)
            # THANKS:  Class property gotchas, https://stackoverflow.com/a/69067/673991
            #          Must use the class name (not `self`) to write to a static class property.

            idns = LexFliki._IDNS_READ_ONCE_AT_STARTUP.idns()
            LexFliki._txt_from_idn = {idn: self[idn].txt for idn in idns}

        self.IDN = LexFliki._IDNS_READ_ONCE_AT_STARTUP
        self.txt_from_idn = LexFliki._txt_from_idn
        self.youtube_matches = None

    def _execute(self, cursor, query, parameters=()):
        self.query_count += 1
        return super(LexFliki, self)._execute(cursor, query, parameters)

    @classmethod
    def split_listing_idn(cls, idn):
        """Return (meta_idn, index) from a listing word's idn.  Or raise ValueError."""
        try:
            return idn.unsuffixed, idn.suffix(qiki.Suffix.Type.LISTING).number
        except (AttributeError, ValueError) as e:
            raise ValueError("Not a Listing idn: " + repr(idn) + " - " + six.text_type(e))

    def read_word(self, idn_ish):
        if idn_ish is None:
            return super(LexFliki, self).read_word(None)

        idn = self.idn_ify(idn_ish)
        if idn is None:
            return super(LexFliki, self).read_word(idn_ish)

        if idn.is_suffixed():
            meta_idn, index = self.split_listing_idn(idn)

            assert self.IDN is not None
            # NOTE:  Should never have to read a user word before LexFliki is instantiated.

            if meta_idn == self.IDN.ANONYMOUS_LISTING:
                the_word = self.word_anon_class(index)
            elif meta_idn == self.IDN.GOOGLE_LISTING:
                the_word = self.word_google_class(index)
            else:
                raise ValueError("Unexpected Listing meta-idn " + repr(meta_idn) + " from " + repr(idn))

            # noinspection PyProtectedMember
            assert the_word._is_inchoate, repr(idn_ish) + ", " + repr(idn)
            # NOTE:  read_word() going choate here means infinite recursion.
            #        So all members but idn are verboten until populate_word_from_idn().
            return the_word

        return super(LexFliki, self).read_word(idn)


def connect_lex():
    try:
        lex = LexFliki()
    except LexFliki.ConnectError as e:
        print("CANNOT CONNECT", str(e))
        return None
    else:
        return lex


def static_url(relative_path, **kwargs):
    return flask.url_for('static', filename=relative_path, **kwargs)


def static_code_url( relative_path, **kwargs):
    return static_url('code/' + relative_path, **kwargs)


_ = WorkingIdns(connect_lex()).dictionary_of_ints()  # catch missing ".idn"


# IDN = WorkingIdns(connect_lex())   # TODO:  Call this only via WSGI, not test_fliki.py


def seconds_until_anonymous_question():
    # TODO:  This feature should be its own lex, or word, or something.
    #        And sysadmins should be able to change it.  With a word.
    return (
        MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS -
        time_lex[t_last_anonymous_question.idn]('differ')[time_lex.now_word()].num
    )


def seconds_until_anonymous_answer():
    return (
        MINIMUM_SECONDS_BETWEEN_ANONYMOUS_ANSWERS -
        time_lex[t_last_anonymous_answer]('differ')[qiki.Number.NAN].num
    )


def anonymous_question_happened():
    global t_last_anonymous_question
    t_last_anonymous_question = time_lex.now_word()


class UNICODE(object):
    BLACK_RIGHT_POINTING_TRIANGLE = u'\u25B6'
    VERTICAL_ELLIPSIS = u'\u22EE'   # 3 vertical dots, aka &vellip; &#x022ee; &#8942;
    VERTICAL_FOUR_DOTS = u'\u205E'   # 4 vertical dots
    HORIZONTAL_LINE_EXTENSION = u'\u23AF'


# TODO:  Combine classes, e.g. GoogleUser(flask_login.UserMixin, qiki.Listing)
#        But this causes JSON errors because json can't encode qiki.Number.
#        But there are so many layers to the serialization for sessions there's probably a way.
#        Never found a way to do that in qiki.Number only, darn.
#        All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


def setup_application_context():
    if hasattr(flask.g, 'lex'):
        print("WHOOPS, ALREADY SETUP WITH A LEX")

    flask.g.lex = connect_lex()
    flask.g.is_online = flask.g.lex is not None
    if flask.g.is_online:
        lex = flask.g.lex

        def report_dup_def(_, message):
            print("DUP DUP", message)

        lex.duplicate_definition_notify(report_dup_def)


@flask_app.teardown_appcontext
def teardown_application_context(exc=None):
    if hasattr(flask.g, 'lex') and hasattr(flask.g.lex, 'disconnect') and callable(flask.g.lex.disconnect):
        if flask.g.is_online:
            flask.g.lex.disconnect()
            flask.g.pop('lex')
    if exc is not None:
        print("teardown exception", type_name(exc), str(exc))


GOOGLE_PROVIDER = 'google'
authomatic_global = authomatic.Authomatic(
    {
        GOOGLE_PROVIDER: {
            'class_': authomatic.providers.oauth2.Google,
            'consumer_key': secure.credentials.google_client_id,
            'consumer_secret': secure.credentials.google_client_secret,

            'scope':
                authomatic.providers.oauth2.Google.user_info_scope
                # + ['https://gdata.youtube.com']
                # SEE:  get a users's YouTube uploads, https://stackoverflow.com/a/21987075/673991
                # The gdata.youtube.com field means that logging in for the first time
                # asks if you want to allow the app to "Manage your YouTube account"
            ,

            'id': 42,
            # NOTE:  See exception in core.py Credentials.serialize() ~line 810:
            #            "To serialize credentials you need to specify a"
            #            "unique integer under the "id" key in the config"
            #            "for each provider!"
            #        This happened when calling login_result.user.to_dict()
        }
    },
    secure.credentials.authomatic_secret_key,
)
STALE_LOGIN_ERROR = 'Unable to retrieve stored state!'


login_manager = flask_login.LoginManager()
# noinspection PyTypeChecker
login_manager.init_app(flask_app)


class Auth(object):
    """Qiki generic logging in."""
    # TODO:  Move to qiki/auth.py?
    # TODO:  Morph this into a Session lex?

    def __init__(
        self,
        this_lex,
        is_authenticated,
        is_anonymous,
        ip_address_txt,
        user_agent_txt,
    ):
        self.lex = this_lex
        self.is_authenticated = is_authenticated
        self.is_anonymous = is_anonymous
        self.ip_address_txt = ip_address_txt

        if not self.has_session_qstring:
            print("NEWBIE", user_agent_txt)   # NOTE:  Should be very common
            self.session_new()
            # TODO:  Instead of a new session, just record in session vars a few stats
            #        Only record if they ever come back.
            #        This in preparation to eliminate the torrent of boring anonymous session
            #        words in the unslumping.org lex.  Presumably they're from digital ocean
            #        monitoring.  But they could be malefactors.
            #        Or find some other way to ignore the monitoring traffic.
            #        E.g. see what's in access_log.
            #        Maybe count newbie events, but don't log the details.
        else:
            try:
                session_qstring = self.session_qstring
            except (KeyError, IndexError, AttributeError) as e:
                print("INACCESSIBLE QSTRING", type_name(e), str(e))
                self.session_new()
            else:
                try:
                    session_uuid = self.session_uuid
                except (KeyError, IndexError, AttributeError) as e:
                    print("BAD UUID SESSION VARIABLE", type_name(e), str(e))
                    self.session_new()
                else:
                    try:
                        session_idn = qiki.Number.from_qstring(session_qstring)
                        self.session_verb = self.lex[session_idn]
                    except ValueError:
                        print("BAD SESSION IDENTIFIER", session_qstring)
                        self.session_new()
                    else:
                        if not self.session_verb.exists():
                            print("NO SUCH SESSION IDENTIFIER", session_qstring)
                            self.session_new()
                        elif (
                            self.session_verb.sbj.idn != self.lex.IDN.LEX or
                            self.session_verb.vrb.idn != self.lex.IDN.DEFINE or
                            self.session_verb.obj.idn != self.lex.IDN.BROWSE
                        ):
                            print("NOT A SESSION IDENTIFIER", session_qstring)
                            self.session_new()
                        elif self.session_verb.txt != session_uuid:
                            print(
                                "NOT A RECOGNIZED SESSION",
                                session_qstring,
                                "is the idn, but",
                                self.session_verb.txt,
                                "!=",
                                session_uuid
                            )
                            self.session_new()
                        else:
                            '''old session word is good, keep it'''

        if self.is_authenticated:
            self.qiki_user = self.lex.word_google_class(self.authenticated_id())

            # if not self.qiki_user.is_named:
            #     print("NOT A NAMED USER", self.qiki_user.idn)
            #     self.is_authenticated = False
            #     flask_login.logout_user()
            # FIXME:  The above means the user NEVER gets their name.
            #         Maybe they need to be authenticated and unnamed for a bit at the beginning.

            # TODO:  tag session_verb with google user, or vice versa
            #        if they haven't been paired yet,
            #        or aren't the most recent pairing
            #        (or remove that last thing, could churn if user is on two devices at once)
        elif self.is_anonymous:
            self.qiki_user = self.lex.word_anon_class(self.session_verb.idn)
            # TODO:  Tag the anonymous user with the session (like authenticated user)
            #        rather than embedding the session ID so prominently
            #        although, that session ID is the only way to identify anonymous users
            #        so maybe not
        else:
            self.qiki_user = None
            print("User is neither authenticated nor anonymous.")
            return

        ip_words = self.lex.find_words(
            sbj=self.qiki_user,
            vrb=self.lex.IDN.IP_ADDRESS_TAG,
            obj=self.session_verb,
            idn_ascending=True,
        )
        if len(ip_words) == 0 or ip_words[-1].txt != ip_address_txt:
            self.qiki_user(self.lex.IDN.IP_ADDRESS_TAG, use_already=False)[self.session_verb] = ip_address_txt
            # TODO:  How could this get a duplicate key?
            #        mysql.connector.errors.IntegrityError: 1062 (23000):
            #        Duplicate entry '\x821' for key 'PRIMARY'
            #        '\x821' === Number('0q82_31').raw, which is the idn for session_verb
            #        (i.e. the obj=WORD.BROWSE word)
            #        override_idn should have been None all the way down
            #        So was this a race condition in word.py in lex.max_idn()??
            #        That function does cause nested cursors.

        ua_words = self.lex.find_words(
            sbj=self.qiki_user,
            vrb=self.lex.IDN.USER_AGENT_TAG,
            obj=self.session_verb,
            idn_ascending=True,
        )
        if len(ua_words) == 0 or ua_words[-1].txt != user_agent_txt:
            self.qiki_user(self.lex.IDN.USER_AGENT_TAG, use_already=False)[self.session_verb] = user_agent_txt

    def session_new(self):
        self.session_uuid = self.unique_session_identifier()
        self.session_verb = self.lex.create_word(
            # sbj=self.qiki_user,
            # NOTE:  Subject can't be user, when the user depends
            #        on the about-to-be-created session word
            #        (It's the payload in the suffix of the anon user idn.)
            #        Or can it?!  That would be a feat.
            #        Would require some shenanigans inside the max_idn_lock.
            sbj=self.lex.IDN.LEX,
            vrb=self.lex.IDN.DEFINE,
            obj=self.lex.IDN.BROWSE,
            txt=self.session_uuid,
            use_already=False
        )
        self.session_qstring = self.session_verb.idn.qstring()
        print("New session", self.session_verb.idn.qstring(), self.ip_address_txt)

    @abc.abstractmethod
    def unique_session_identifier(self):
        """
        These are never really used for anything,
        but it's kind of a policy that each vrb=define word has a unique txt.
        So you could return uuid.uuid4(), though '' might not break anything.
        """
        raise NotImplementedError

    @property
    def qoolbar(self):
        qoolbar = qiki.QoolbarSimple(self.lex)
        return qoolbar

    @property
    @abc.abstractmethod
    def has_session_qstring(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def session_qstring(self):
        raise NotImplementedError
        # CAUTION:  May raise KeyError

    @session_qstring.setter
    @abc.abstractmethod
    def session_qstring(self, qstring):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def session_uuid(self):
        raise NotImplementedError

    @session_uuid.setter
    @abc.abstractmethod
    def session_uuid(self, the_uuid):
        raise NotImplementedError

    # def session_get(self):
    #     raise NotImplementedError
    #
    # def session_set(self, session_string):
    #     raise NotImplementedError

    def authenticated_id(self):
        raise NotImplementedError

    @property
    def current_url(self):
        """E.g. '/python/yield'"""
        raise NotImplementedError

    @property
    def current_path(self):
        """E.g. 'https://qiki.info/python/yield'"""
        raise NotImplementedError

    @property
    def current_host(self):
        """E.g. 'qiki.info'"""
        raise NotImplementedError

    @property
    def login_url(self):
        raise NotImplementedError

    @property
    def logout_url(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def then_url(self):
        raise NotImplementedError

    @then_url.setter
    @abc.abstractmethod
    def then_url(self, new_url):
        raise NotImplementedError

    # def static_url(self, relative_path):
    #     raise NotImplementedError

    @abc.abstractmethod
    def form(self, variable_name):
        raise NotImplementedError

    def login_html(self, then_url=None):
        """
        Log in or out link.  Redirected to then_url, defaults to current_url
        """
        if then_url is None:
            self.then_url = self.current_url
        else:
            self.then_url = then_url
        # NOTE:  The timing of setting this URL is weird.
        #
        #        Here we are presumably generating a login link for some page.
        #        We're remembering the URL of that page in order to "return" to that page.
        #        That is, we expect to use that page-URL some time after
        #        the login-link is clicked and the login is completed.
        #
        #        Will this really be the right URL to "return" to after login?
        #        It just smacks of a global variable that could get stale or something.
        #
        #        Like what if that user generated some SECOND page on some SECOND browser
        #        window?  Then went back to the FIRST page and clicked login.
        #        Then the first browser window would go to the second page after logging in.
        #
        #        Might it be better to record that page-URL WHEN the login-link is clicked.
        #        But how to do that?  Can't futz with the URL itself, that breaks login.
        #        Maybe some ajax request, just before the link is followed.
        #
        #        Or maybe go ahead and add then_url to the query string but strip it off
        #        (by cloning the Request object -- request.args is immutable)
        #        before passing it to Authomatic.login().

        if self.is_authenticated:
            display_name = self.qiki_user.name
            if self.qiki_user.is_admin:
                display_name += " (admin)"
            return (
                u"<a href='{logout_link}'>"
                u"logout"
                u"</a>"
                u" "
                u"{display_name}"
            ).format(
                display_name=display_name,
                logout_link=self.logout_url,
            )
        elif self.is_anonymous:
            return (
                u"<a href='{login_link}' title='{login_title}'>"
                u"login"
                u"</a>"
            ).format(
                login_title=u"You are " + self.qiki_user.txt,
                login_link=self.login_url,
            )
        else:
            return "neither auth nor anon???"

    # noinspection PyMethodMayBeStatic,PyUnusedLocal
    def is_enough_anonymous_patience(self, delay):
        # TODO
        return True

    def idn(self, word_or_idn):
        return self.lex.idn_ify(word_or_idn)


    # def monty_cat(self):
    #     idns_in_order = self.get_category_idns_in_order()
    #     txt_from_cat_idn = {int(idn): self.lex.txt_from_idn[idn] for idn in idns_in_order}
    #     return dict(
    #         order=idns_in_order,
    #         txt=txt_from_cat_idn,
    #     )


    def get_category_idns_in_order(self):
        """The order the categories should appear on the site."""
        # TODO:  Support custom user categories
        return [
            self.lex.IDN.CAT_MY,
            self.lex.IDN.CAT_THEIR,
            self.lex.IDN.CAT_ANON,
            self.lex.IDN.CAT_TRASH,
            self.lex.IDN.CAT_ABOUT,
        ]

    def vet(self, words):
        """Filter out anonymous contributions from other anonymous users."""
        sbj_warnings = set()

        if self.is_anonymous:

            def allowed_word(word):
                try:
                    is_logged_in = not word.sbj.is_anonymous
                except AttributeError:
                    if word.sbj.idn == self.lex.IDN.LEX:
                        # NOTE:  This test is buried because sbj=lex words are expected to be rare.
                        return True
                    sbj = self.idn(word.sbj)
                    if sbj not in sbj_warnings:
                        sbj_warnings.add(sbj)
                        print("sbj", sbj, "is neither user nor lex, starting with", repr(word))
                    return False

                return is_logged_in or word.sbj == self.qiki_user

            vetted_words = [w for w in words if allowed_word(w)]
            n_removed = len(words) - len(vetted_words)
            if n_removed > 0:
                print("Vetting removed", n_removed, "words")
        else:
            vetted_words = words
        return vetted_words

    def vetted_find_by_verbs(self, verbs):
        qc = list()
        qc.append(self.lex.query_count)
        vetted_list = self.vet(self.lex.find_words(vrb=verbs, idn_ascending=True))
        qc.append(self.lex.query_count)
        # if len(vetted_list) > 0:
        #     max_idn = vetted_list[-1].idn
        # else:
        #     max_idn = 0
        # max_idint = int(max_idn)
        # vetted_array = [None] * (max_idint + 1)
        user_table = dict()
        for word in vetted_list:
            # idint = int(word.idn)
            # assert 0 <= idint <= max_idint, str(idint)
            # vetted_array[idint] = word

            user_qstring = word.sbj.idn.qstring()
            if user_qstring not in user_table:   # conserves number of queries
                # if word.sbj.is_lex():
                #     name_short = "Lex"
                # else:
                #     name_short = word.sbj.name
                name_short = word.sbj.name
                user_table[user_qstring] = dict(
                    name_short=name_short,
                    name_long=word.sbj.txt,
                    is_admin=word.sbj.is_admin,
                )
        qc.append(self.lex.query_count)
        qc_delta = [qc[i+1] - qc[i] for i in range(len(qc)-1)]
        # TODO:  Bake this timing and query-counting into multi-inherited class

        print("Vetted deltas", ",".join(str(x) for x in qc_delta))
        return dict(
            u=user_table,
            w=vetted_list,
        )
        # TODO:  Do this some other way without so many holes?
        #        Could provide a dict by idn, and a list of idns in chronological order
        #        or just the dict, and let js sort the idns.

    def may_create_word(self, word_dict):
        """Is the current user allowed to create this word?"""
        if word_dict['vrb'].idn == self.lex.IDN.CAT_ABOUT:
            ok = word_dict['sbj'].is_admin
        else:
            ok = True
        return ok


class AuthFliki(Auth):
    """Fliki / Authomatic specific implementation of logging in"""
    def __init__(self, ok_to_print=True):
        setup_application_context()
        self.is_online = flask.g.is_online
        if self.is_online:
            self.flask_user = flask_login.current_user
            super(AuthFliki, self).__init__(
                this_lex=flask.g.lex,
                is_authenticated=self.flask_user.is_authenticated,
                is_anonymous=self.flask_user.is_anonymous,
                ip_address_txt=qiki.Text.decode_if_you_must(flask.request.remote_addr),
                user_agent_txt=qiki.Text.decode_if_you_must(flask.request.user_agent.string),
            )
            # THANKS:  User agent fields, https://stackoverflow.com/a/33706555/673991
            # SEE:  https://werkzeug.palletsprojects.com/en/0.15.x/utils/#module-werkzeug.useragents

            auth_anon = (
                "logged in" if self.is_authenticated else "" +
                "anonymous" if self.is_anonymous else ""
            )
            if ok_to_print:
                print(
                    "AUTH",
                    self.qiki_user.idn.qstring(),
                    auth_anon,
                    self.qiki_user.txt
                )
            self.path_word = None
            self.browse_word = None

    def hit(self, path_str):
        # path_str = flask.request.full_path
        # if path_str.startswith('/'):
        #     path_str = path_str[1 : ]
        #     # NOTE:  Strip leading slash so old hits still count
        self.path_word = self.lex.define(
            self.lex.IDN.PATH,
            qiki.Text.decode_if_you_must(path_str)
        )
        self.browse_word = self.lex.create_word(
            sbj=self.qiki_user,
            vrb=self.session_verb,
            obj=self.path_word,
            use_already=False,
        )
        this_referrer = flask.request.referrer
        if this_referrer is not None:
            self.lex.create_word(
                sbj=self.qiki_user,
                vrb=self.lex.IDN.REFERRER,
                obj=self.browse_word,
                txt=qiki.Text.decode_if_you_must(this_referrer),
                use_already=False,   # TODO:  Could be True?  obj should be unique.
            )

    SESSION_QSTRING = 'qiki_session_qstring'   # where we store the session verb's idn
    SESSION_UUID = 'qiki_session_uuid'   # where we store the session verb's idn

    def unique_session_identifier(self):
        return str(uuid.uuid4())
        # NOTE:  Something that didn't work:  return flask.session['_id']
        #        I only saw the '_id' variable after googly login anyway.
        #        See https://stackoverflow.com/a/43505668/673991

    @property
    def has_session_qstring(self):
        return self.SESSION_QSTRING in flask.session

    @property
    def session_qstring(self):
        return flask.session[self.SESSION_QSTRING]
        # CAUTION:  May raise KeyError

    @session_qstring.setter
    def session_qstring(self, qstring):
        flask.session[self.SESSION_QSTRING] = qstring

    @property
    def session_uuid(self):
        return flask.session[self.SESSION_UUID]

    @session_uuid.setter
    def session_uuid(self, the_uuid):
        flask.session[self.SESSION_UUID] = the_uuid

    def authenticated_id(self):
        return self.flask_user.get_id()
        # the_id = self.flask_user.get_id()
        # assert isinstance(the_id, six.text_type), type_name(the_id) + " - " + repr(the_id)
        # if the_id == 'None':
        #     return None
        # else:
        #     return the_id
        # TODO:  Where did the 'None' STRING come from?
        #        Looks as if get_id() converts to a string
        #        Did the original None come from

    @property
    def current_url(self):
        return flask.request.url
        # SEE:  path vs url, http://flask.pocoo.org/docs/api/#incoming-request-data

    @property
    def current_path(self):
        return flask.request.path
        # NOTE:  Do NOT include query string,
        #        because quirky Flask appends an empty '?' even if there was none.
        # SEE:  path vs url, http://flask.pocoo.org/docs/api/#incoming-request-data

    @property
    def current_host(self):
        """
        Domain we're serving.  Port is appended if not 80.

        EXAMPLE:  'unslumping.org:8080'
        """
        return flask.request.host

    @property
    def login_url(self):
        return flask.url_for(u'login')
        # NOTE:  Adding a parameter to the query string makes Authomatic.login()
        #        return None.

    @property
    def logout_url(self):
        return flask.url_for('logout')

    @property
    def then_url(self):
        """Get next URL from session variable.  Default to home."""
        then_url_default = flask.url_for('home_or_root_directory')
        then_url_actual = flask.session.get('then_url', then_url_default)
        return then_url_actual

    @then_url.setter
    def then_url(self, new_url):
        flask.session['then_url'] = new_url

    _not_specified = object()   # like None but more obscure, so None CAN be specified

    class FormVariableMissing(KeyError):
        """auth.form('no such variable')"""

    def form(self, variable_name, default=_not_specified):
        value = flask.request.form.get(variable_name, default)
        if value is self._not_specified:
            raise self.FormVariableMissing("No form variable " + variable_name)
        else:
            return value

    def convert_unslump_words(self, words):

        def convert(word):
            if word.vrb.idn == self.lex.IDN.UNSLUMP_OBSOLETE:
                word_dict = word.to_json()
                word_dict['vrb'] = self.lex.IDN.CONTRIBUTE
                return word_dict
                # NOTE:  Sneaky return of modified dict, instead of word.  But it's all the same
                #        to json, which is where these words are all headed anyway.
            else:
                return word

        converted_words = [convert(word) for word in words]
        return converted_words


def is_qiki_user_anonymous(user_word):
    # return isinstance(user_word, AnonymousQikiUser)
    try:
        return user_word.is_anonymous
    except AttributeError:
        return False


class SessionVariableName(object):
    QIKI_USER = 'qiki_user'


@login_manager.user_loader
def user_loader(google_user_id_string):
    # print("user_loader", google_user_id_string)
    # EXAMPLE:  user_loader 103620384189003122864 (Bob Stein's google user id, apparently)
    #           hex 0x59e058e6a6308c8b0 (67 bits)
    #           qiki 0q8A_059E058E6A6308C8B0 (9 qigits)
    #           (Yeah well it better not be a security thing to air this number like a toynbee tile.)
    new_flask_user = GoogleFlaskUser(google_user_id_string)
    # TODO:  Validate with google?
    return new_flask_user


@flask_app.route('/meta/logout', methods=('GET', 'POST'))
@flask_login.login_required
def logout():
    flask_login.logout_user()
    return flask.redirect(get_then_url())


def get_then_url():
    """Get next URL from session variable.  Default to home."""
    then_url_default = flask.url_for('home_or_root_directory')
    then_url_actual = flask.session.get('then_url', then_url_default)
    # TODO:  Make this work better if a user has multiple tabs open at once.
    #        sessionStorage?
    # SEE:  Tab-specific user data, https://stackoverflow.com/q/27137562/673991
    return then_url_actual


def set_then_url(then_url):
    flask.session['then_url'] = then_url


# FALSE WARNING (several places):  Unresolved attribute reference 'name' for class 'str'
# no noinspection PyUnresolvedReferences
@flask_app.route('/meta/login', methods=('GET', 'POST'))
def login():
    setup_application_context()
    if not flask.g.is_online:
        return "offline"

    lex = flask.g.lex

    response = flask.make_response(" Play ")
    login_result = authomatic_global.login(
        authomatic.adapters.WerkzeugAdapter(flask.request, response),
        GOOGLE_PROVIDER,
        # NOTE:  The following don't help persist the logged-in condition, duh,
        #        they just rejigger the brief, ad hoc session supporting the banter with the provider:
        #            session=flask.session,
        #            session_saver=lambda: flask_app.save_session(flask.session, response),
    )

    logged_in_user = login_result.user
    # TODO:  Instead of this intermediate variable, work out the type warnings such as
    #            Unresolved attribute reference 'name' for class 'str'
    #        using typing hints or annotations.  Then use e.g. login_result.user.name

    # print(repr(login_result))
    if login_result:
        if hasattr(login_result, 'error') and login_result.error is not None:
            print("Login error:", str(login_result.error))
            # EXAMPLE:
            #     Failed to obtain OAuth 2.0 access token from https://accounts.google.com/o/oauth2/token!
            #     HTTP status: 400, message: {
            #       "error" : "invalid_grant",
            #       "error_description" : "Invalid code."
            #     }.
            # e.g. after a partial login crashes, trying to resume with a URL such as:
            # http://.../meta/login?state=f45ad ... 4OKQ#

            url_has_question_mark_parameters = flask.request.path != flask.request.full_path
            is_stale = str(login_result.error) == STALE_LOGIN_ERROR
            if is_stale and url_has_question_mark_parameters:
                print(
                    "Redirect from {from_}\n"
                    "           to {to_}".format(
                        from_=flask.escape(flask.request.full_path),
                        to_=flask.escape(flask.request.path),
                    )
                )
                return flask.redirect(flask.request.path)  # Hopefully not a redirect loop.
            else:
                print("Whoops")
                response.set_data("Whoops")
        else:
            if hasattr(login_result, 'user') and hasattr(logged_in_user, 'id'):
                if logged_in_user is None:
                    print("None user!")
                else:
                    if logged_in_user.id is None or logged_in_user.name is None:   # Try #1
                        print(
                            "Fairly routine, user data needed updating",
                            repr(logged_in_user.id),
                            repr(logged_in_user.name),
                        )
                        logged_in_user.update()
                        # SEE:  about calling user.update() only if id or name is missing,
                        #       http://authomatic.github.io/authomatic/#log-the-user-in

                    if logged_in_user.id is None or logged_in_user.name is None:   # Try #2
                        print(
                            "Freakish!  "
                            "Updated, but something is STILL None, "
                            "user id:", repr(logged_in_user.id),
                            "name:", repr(logged_in_user.name),
                        )
                    else:

                        # EXAMPLE:  2019.1028 - logged_in_user
                        #     User(
                        #         provider=Google(...),
                        #         credentials=Credentials(...),
                        #         data={
                        #             'id': '103620384189003122864',
                        #             'name': {
                        #                 'familyName': 'Stein',
                        #                 'givenName': 'Bob'
                        #             },
                        #             'displayName': 'Bob Stein',
                        #             'image': {
                        #                 'url': 'https://lh3.googleusercontent.com/a-/AAuE7mDmUoEqODezLnr1LEwU_DW-Rkyvu1-3fvrdA34Fog=s50'
                        #             },
                        #             'emails': [
                        #                 {
                        #                     'value': 'visibone@gmail.com',
                        #                     'type': 'ACCOUNT'
                        #                 }
                        #             ],
                        #             'language': 'en',
                        #             'kind': 'plus#person',
                        #             'etag': '%EgUCAwolLhoDAQUH'
                        #         },
                        #         content=str(...),
                        #         id=str(...),
                        #         name='Bob Stein',
                        #         first_name='Bob',
                        #         last_name='Stein',
                        #         locale='en',
                        #         email='visibone@gmail.com',
                        #         picture=str(...)
                        #     )

                        # EXAMPLE:  2018.1204 - logged_in_user.picture
                        #     https://lh5.googleusercontent.com/-_K6qO6tjH1A/AAAAAAAAAAI/AAAAAAAAKbQ/N14tJbQVKCc/photo.jpg?sz=50
                        # EXAMPLE:  2019.0519 - logged_in_user.picture
                        #     https://lh5.googleusercontent.com/-_K6qO6tjH1A/AAAAAAAAAAI/AAAAAAAAKbQ/N14tJbQVKCc/s50/photo.jpg
                        # EXAMPLE:  2019.1028 - logged_in_user.picture (first appeared 2019.0820)
                        #     https://lh3.googleusercontent.com/a-/AAuE7mDmUoEqODezLnr1LEwU_DW-Rkyvu1-3fvrdA34Fog=s50

                        flask_user = GoogleFlaskUser(logged_in_user.id)
                        qiki_user = lex.word_google_class(logged_in_user.id)

                        picture_size_string = url_var(logged_in_user.picture, 'sz', '0')
                        try:
                            picture_size_int = int(picture_size_string)
                        except ValueError:
                            picture_size_int = 0
                        avatar_width = qiki.Number(picture_size_int)
                        # TODO:  avatar_width is always 0 - recompute?  Alternative?

                        avatar_url = logged_in_user.picture or ''
                        display_name = logged_in_user.name or ''
                        print("Logging in", qiki_user.index, qiki_user.idn.qstring())
                        # EXAMPLE:   Logging in 0q8A_059E058E6A6308C8B0 0q82_15__8A059E058E6A6308C8B0_1D0B00
                        lex[lex](lex.IDN.ICONIFY, use_already=True)[qiki_user.idn] = (
                            avatar_width,
                            avatar_url
                        )
                        lex[lex](lex.IDN.NAME, use_already=True)[qiki_user.idn] = display_name
                        flask_login.login_user(flask_user)
                        return flask.redirect(get_then_url())
                        # TODO:  Why does Chrome put a # on the end of this URL (empty fragment)?
                        # SEE:  Fragment on redirect, https://stackoverflow.com/q/2286402/673991
                        # SEE:  Fragment of resource, https://stackoverflow.com/a/5283528/673991
            else:
                print("No user!")
            if login_result.provider:
                print("Provider:", repr(login_result.provider))
    else:
        '''Is this where anonymous users go?'''
        pass
        # print("not logged in", repr(login_result))
        # EXAMPLE:  None (e.g. with extraneous variable on request query, e.g. ?then_url=...)

    return response


def url_var(url, key, default):
    """
    Look up a variable from a URL query string.

    If redundant values, gets the last.

    :param url: - e.g. 'http://example.com/?foo=bar'
    :param key:                     - e.g. 'foo'
    :param default:                     - e.g. 'bar'
    :return:                            - e.g. 'bar'
    """
                        # THANKS:  Parse URL query-string, http://stackoverflow.com/a/21584580/673991
    the_parts = urllib.parse.urlsplit(url)
    the_dict = urllib.parse.parse_qs(the_parts.query)
    the_value = the_dict.get(key, [default])[-1]
    return the_value
assert 'bar' == url_var('http://example.com/?foo=bar', 'foo', 'qux')
assert 'qux' == url_var('http://example.com/',         'foo', 'qux')


@flask_app.route('/module/qiki-javascript/<path:filename>')
def static_response_from_qiki_javascript(filename):
    """
    Make a pseudo-static directory out of the qiki-javascript repo.

    Prevent penetrating into .idea, etc.
    TODO:  Prevent nonexistent
    """
    only_file_name_no_slashes = r'^[\w.]+$'
    if re.search(only_file_name_no_slashes, filename):
        try:
            return flask.send_file(os_path_qiki_javascript(filename))
        except IOError:
            flask.abort(404, "No such qiki-javascript file " + filename)
    else:
        flask.abort(404, "Not a file in qiki-javascript, " + filename)


def os_path_static(relative_url):
    """
    Convert url to path, for static files.

    EXAMPLE:  '/var/www/static/foo.bar' == os_path_static('foo.bar')
    """
    return flask.safe_join(flask_app.static_folder, relative_url)


def os_path_qiki_javascript(relative_url):
    return flask.safe_join(PARENT_DIRECTORY, 'qiki-javascript', relative_url)
    # NOTE:  Assume the fliki and qiki-javascript repos are in sibling directories.


def web_path_qiki_javascript(relative_url):
    return flask.url_for('static_response_from_qiki_javascript', filename=relative_url)


class Parse(object):
    """ Remove a prefix and deal with what remains. """

    def __init__(self, original_string):
        self.remains = original_string

    def remove_prefix(self, prefix):
        if self.remains.startswith(prefix):
            self.remains = self.remains[len(prefix) : ]
            return True
        return False

    def remove_re(self, pattern):
        if re.search(pattern, self.remains):
            self.remains = re.sub(pattern, '', self.remains)
            return True
        return False

    def __str__(self):
        return self.remains
parser = Parse("rethink")
assert True is parser.remove_prefix("re")
assert "think" == parser.remains


class FlikiHTML(web_html.WebHTML):
    """Custom HTML for the fliki project."""

    def __init__(self, name=None, **kwargs):
        super(FlikiHTML, self).__init__(name, **kwargs)
        self.do_minify = DO_MINIFY
        if name == 'html':
            self(lang='en')

    def header(self, title):
        with self.head(newlines=True) as head:
            head.title(title)
            head.meta(charset='utf-8')
            head.meta(name='viewport', content='width=device-width, initial-scale=0.7')
            head.link(
                rel='shortcut icon',
                href=web_path_qiki_javascript('favicon.ico')
            )
            head.css_stamped(web_path_qiki_javascript('qoolbar.css'))
            return head

    def footer(self):
        self(newlines=True)
        self.jquery(JQUERY_VERSION)
        self.js('//ajax.googleapis.com/ajax/libs/jqueryui/{}/jquery-ui.min.js'.format(JQUERYUI_VERSION))
        self.js_stamped(web_path_qiki_javascript('jquery.hotkeys.js'))
        self.js_stamped(web_path_qiki_javascript('qoolbar.js'))
        return self

    @classmethod
    def os_path_from_url(cls, url):
        url_parse = Parse(url)
        if url_parse.remove_prefix(static_url('')):
            return os_path_static(url_parse.remains)
        elif url_parse.remove_prefix(web_path_qiki_javascript('')):
            return os_path_qiki_javascript(url_parse.remains)
        else:
            raise RuntimeError("Unrecognized url " + url)


@flask_app.template_filter('cache_bust')
def cache_bust(s):
    return FlikiHTML.url_stamp(s)


@flask_app.route('/', methods=('GET', 'HEAD'))
def home_or_root_directory():
    return contribution_home(secure.credentials.Options.home_page_title)


@flask_app.route('/meta/contrib', methods=('GET', 'HEAD'))
def meta_contrib():
    return contribution_home(secure.credentials.Options.home_page_title)


def contribution_home(home_page_title):
    # TODO:  rename unslumping_home()?
    """
    User contributions (quotes, videos, etc.) in categories (mine, others, etc.).

    An unslumping.org inspired application.

    Generate JSON for unslumping.js to process.

    MONTY.w - selected (and vetted) words from the lex
    MONTY.u - info about users, anonymous and logged-in
    MONTY.cat - category names and ordering
    MONTY.IDN - idns by name
    """
    t_start = time.time()
    auth = AuthFliki()
    if not auth.is_online:
        return "lex database offline"
    q_start = auth.lex.query_count
    # auth.hit(auth.current_path)   Commented out to suppress early churn
    if auth.is_enough_anonymous_patience(MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS):
        with FlikiHTML('html') as html:
            with html.header(home_page_title) as head:
                head.css_stamped(static_code_url('contribution.css'))
                head.css('https://fonts.googleapis.com/css?family=Literata&display=swap')
                head.css('https://fonts.googleapis.com/icon?family=Material+Icons')
            html.body("Loading . . .")
            with html.footer() as foot:
                foot.js('https://cdn.jsdelivr.net/npm/sortablejs@1.9.0/Sortable.js')
                # foot.comment("SEE:  /meta/static/code/Sortable-LICENSE.txt")

                foot.js('https://cdn.jsdelivr.net/npm/jquery-sortablejs@1.0.0/jquery-sortable.js')
                # foot.comment("SEE:  /meta/static/code/jquery-sortable-LICENSE.txt")

                # foot.js('https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/iframeResizer.min.js')
                foot.js(static_code_url('iframeResizer.js'))
                foot.comment("SEE:  /meta/static/code/iframe-resizer-LICENSE.txt")

                # foot.js('https://use.fontawesome.com/49adfe8390.js')   # req by talkify
                # foot.js('https://cdn.jsdelivr.net/npm/talkify-tts@2.6.0/dist/talkify.min.js')
                # NOTE:  Commenting the above lines out is how talkify is disabled.
                #        Might want to revive it someday,
                #        because talkify voices seemed better than the standard browser voices.

                foot.js_stamped(static_code_url('util.js'))
                foot.js_stamped(static_code_url('contribution.js'))
                foot.js_stamped(static_code_url('unslumping.js'))

                verbs = []
                verbs += auth.get_category_idns_in_order()
                verbs += [
                    auth.lex.IDN.CONTRIBUTE,
                    auth.lex.IDN.UNSLUMP_OBSOLETE,
                    auth.lex.IDN.CAPTION,
                    auth.lex.IDN.EDIT,
                ]

                words_for_js = auth.vetted_find_by_verbs(verbs)

                words_for_js['w'] = auth.convert_unslump_words(words_for_js['w'])
                cat_words = [{
                    'idn': idn,
                    'sbj': auth.lex[idn].sbj.idn,
                    'vrb': auth.lex[idn].vrb.idn,
                    'obj': auth.lex[idn].obj.idn,
                    'txt': auth.lex[idn].txt,
                } for idn in auth.get_category_idns_in_order()]
                with foot.script() as script:
                    monty = dict(
                        me_idn=auth.qiki_user.idn.qstring(),
                        me_txt=auth.qiki_user.txt,
                        is_anonymous=auth.is_anonymous,
                        URL_HERE=auth.current_url,
                        AJAX_URL=AJAX_URL,
                        IDN=auth.lex.IDN.dictionary_of_ints(),
                        NOW=float(time_lex.now_word().num),
                        login_html=auth.login_html(),
                        cat_words=cat_words,
                        WHAT_IS_THIS_THING=secure.credentials.Options.what_is_this_thing,
                        OEMBED_CLIENT_PREFIX=secure.credentials.Options.oembed_client_prefix,
                        OEMBED_OTHER_ORIGIN=secure.credentials.Options.oembed_other_origin,
                        THUMB_MAX_WIDTH=THUMB_MAX_WIDTH,
                        THUMB_MAX_HEIGHT=THUMB_MAX_HEIGHT,
                        MEDIA_HANDLERS=[
                            static_code_url('media_youtube.js', _external=True),
                            static_code_url('media_instagram.js', _external=True),
                            static_code_url('media_noembed.js', _external=True),
                            static_code_url('media_any_url.js', _external=True),
                        ],
                        # NOTE:  FIRST matching media handler wins, high priority first, catch-all
                        #        last.
                        INTERACTION=INTERACTION_VERBS,
                        POPUP_ID_PREFIX=POPUP_ID_PREFIX,
                        STATIC_IMAGE=static_url('image'),
                    )
                    monty.update(words_for_js)
                    script.raw_text('var MONTY = {json};\n'.format(json=json_pretty(monty)))
                    if CATCH_JS_ERRORS:
                        script.raw_text('''
                            window.onerror = function (a,b,c,d,e,f) {
                                // document.getElementsByTagName('body')[0].prepend(
                                error_alert(
                                    "Error Event: " + 
                                    s(a) + ", " +
                                    s(b) + ", " +
                                    s(c) + ", " +
                                    s(d) + ", " +
                                    s(e) + ", " +
                                    s(f) + 
                                    "\\n\\n" +
                                    "Please reload."
                                );
                            };
                            try {
                                js_for_unslumping(window, jQuery, qoolbar, MONTY, window.talkify);
                            } catch (e) {
                                error_alert(
                                    "Exception: " + e.stack.toString() + 
                                    "\\n\\n" +
                                    "Please reload."
                                );
                                // document.getElementsByTagName('body')[0].innerHTML = (
                                //     "<p>" + 
                                //         "Exception: " + e.stack.toString() + 
                                //     "</p>\\n" +
                                //     "<p>" + 
                                //         "Please " + 
                                //         "<a href='javascript:window.location.reload(); return false;'>" + 
                                //             "reload" + 
                                //         "</a>." + 
                                //     "</p>\\n"
                                // );
                            }
                            var error_alerted = false;
                            // Because emeffing Chrome thinks its helpful to auto-close alert popups.
                            function error_alert(message) { 
                                console.error(message);
                                if ( ! error_alerted) {
                                    error_alerted = true;
                                    alert(message);
                                    throw new Error("Something went terribly wrong.");
                                }
                            }
                            function s(z) { 
                                return z === undefined ? "((undefined))" : z.toString(); 
                            }
                       \n''')
                        # EXAMPLE syntax error in contribution.js:
                        #         ReferenceError: js_for_unslumping is not defined at
                        #         http://localhost.visibone.com:5000/:3320:29
                        # NOTE:  The above gyrations were trying to debug Opera Mobile.
                        #        To no avail.
                    else:
                        script.raw_text('''
                            js_for_unslumping(window, jQuery, qoolbar, MONTY, window.talkify);
                       \n''')
            t_end = time.time()
            q_end = auth.lex.query_count
            print("/meta/contrib {q:d} queries, {t:.3f} sec".format(
                q=q_end - q_start,
                t=t_end - t_start,
            ))
            return html.doctype_plus_html()

    return "Please wait a bit..."   # TODO:  Never gets here.


# DONE:  Categories:
#        my unslumping - what I've entered, or dragged here, and not deleted
#            Enter or drag stuff here that you find inspires you out of a slump.
#        other's unslumping - entered by logged in users, and not dragged to my stuff
#        anonymous unslumping - entered anonymously, and not dragged to my stuff
#        trash
# TODO:
#        spam
#        |____| (your category name here)


@flask_app.route('/meta/raw', methods=('GET', 'HEAD'))   # Experimental
def meta_raw():
    """Raw json dump of all words in the lex."""
    auth = AuthFliki()
    if not auth.is_online:
        return "lex offline"
    if auth.is_anonymous:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Omit anonymous content for anonymous users (except their own).

    t_start = time.time()
    qc_start = auth.lex.query_count
    words = auth.lex.find_words()
    t_find = time.time()
    num_suffixed = 0
    num_anon = 0
    num_google = 0
    for word in words:
        if word.sbj.idn.is_suffixed():
            num_suffixed += 1
            meta_idn, index = qiki.Listing.split_compound_idn(word.sbj.idn)
            if meta_idn == auth.lex.IDN.ANONYMOUS_LISTING:
                num_anon += 1
            elif meta_idn == auth.lex.IDN.GOOGLE_LISTING:
                num_google += 1
    t_loop = time.time()
    response = valid_response('words', words)
    t_end = time.time()
    print(
        "RAW LEX,",
        auth.lex.query_count - qc_start, "queries,",
        len(words), "words,",
        "{:.3f} + {:.3f} + {:.3f} = {:.3f}".format(
            t_find - t_start,
            t_loop - t_find,
            t_end - t_loop,
            t_end - t_start,
        ),
        "sec,",
        len(response) // 1000, "Kbytes,",
        num_suffixed, "suffixed",
        num_anon, "anon",
        num_google, "google",
    )
    return flask.Response(response, mimetype='application/json')
    # THANKS:  Flask mime type, https://stackoverflow.com/a/11774026/673991
    # THANKS:  JSON mime type, https://stackoverflow.com/a/477819/673991


@flask_app.route('/slam_test', methods=('GET', 'HEAD'))
@flask_login.login_required
def slam_test():
    """
    Test frequent lex create_word()'s.

    This revealed that Lex.insert_word() was not thread-safe without SQL command
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED.
    """

    auth = AuthFliki()
    if not auth.is_online:
        return "lex offline"
    if auth.is_anonymous:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    slam_verb = auth.lex.verb('slam')

    with FlikiHTML('html') as html:
        html.header(title="Slam Test")
        with html.body(class_='test-container', newlines=True) as body:
            body.button("go", id='go')
        with html.footer() as foot:
            foot.script('''
                $(function document_ready() {
                    qoolbar.ajax_url("'''  + AJAX_URL + '''");
                    var in_process = false;
                    var counter = 0;
                    $('#go').on('click', function () {
                        in_process = true;
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                        slam();
                    });
                    
                    function slam() {
                        var string = "slam " + window.location.search + " " + counter.toString();
                        qoolbar.sentence({
                            vrb_idn: "''' + slam_verb.idn.qstring() + '''",
                            obj_idn: "''' + auth.lex.IDN.LEX.qstring() + '''",
                            txt: string
                        }, function (new_word) {
                            console.log("done", string, new_word.idn);
                        }, function () {
                            console.warn("FAIL", string);
                        });
                        counter++;
                    }
                });
            \n''')
            return html.doctype_plus_html()


@flask_app.route('/meta/lex', methods=('GET', 'HEAD'))
def meta_lex():

    auth = AuthFliki()
    if not auth.is_online:
        return "lex offline"
    if not auth.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Omit anonymous content for anonymous users (except their own).

    t_start = time.time()
    qc_start = auth.lex.query_count
    with FlikiHTML('html') as html:
        with html.header("Lex") as head:
            head.css_stamped(static_code_url('meta_lex.css'))


        with html.body(class_='target-environment', newlines=True) as body:
            user_idn_qstring = auth.qiki_user.idn.qstring()
            with body.div(id='login-prompt', title='your idn is ' + user_idn_qstring) as div_login:
                div_login.raw_text(auth.login_html())

            words = auth.lex.find_words()

            listing_dict = dict()

            def listing_log(sub, **kwargs):
                q = sub.idn.qstring()
                if q not in listing_dict:
                    listing_dict[q] = dict()
                listing_dict[q].update(kwargs)

            qc_find = auth.lex.query_count

            def z(idn):
                """Convert qiki.Number into something more efficient to compare."""
                # TODO:  Eye roll, got to make Numbers more efficient.  Damn the normalizing.
                # return idn           # to compare Numbers
                # return idn.hex()     # to compare strings
                return idn.raw       # to compare bytes

            class Z(object):
                IP_ADDRESS_TAG = z(auth.lex.IDN.IP_ADDRESS_TAG)
                NAME           = z(auth.lex.IDN.NAME)
                ICONIFY        = z(auth.lex.IDN.ICONIFY)
                USER_AGENT_TAG = z(auth.lex.IDN.USER_AGENT_TAG)

            with body.ol(class_='lex-list') as ol:
                for word in words:
                    tooltip = "idn = " + word.idn.qstring() + " (" + render_num(word.idn) + ")"
                    with ol.li(**{
                        'class': 'srend',
                        'value': render_num(word.idn),
                        'id': word.idn.qstring(),
                        'data-idn-native': render_num(word.idn),
                        'data-whn': render_whn(word.whn),
                        'title': tooltip,
                    }) as li:
                        li.span(**{'class': 'wrend sbj', 'data-idn': word.sbj.idn.qstring()}).span(class_='named')
                        li.span(**{'class': 'wrend vrb', 'data-idn': word.vrb.idn.qstring()}).span(class_='named')
                        li.span(**{'class': 'wrend obj', 'data-idn': word.obj.idn.qstring()}).span(class_='named')
                        li.span(**{'class': 'num'})
                        li.span(**{'class': 'txt', 'title': "txt is {} characters".format(len(word.txt))})
                        li.span(**{'class': 'whn'})
                        li.svg(**{'class': 'whn-delta'})
                        if word.txt != "":
                            li(**{'data-txt': str(word.txt)})
                        if word.num != 1:
                            li(**{'data-num': render_num(word.num)})
                            li(**{'data-num-qstring': word.num.qstring()})

                    # if isinstance(word.sbj.lex, qiki.Listing):
                    if isinstance(word.sbj, word.sbj.lex.word_user_class):
                        listing_log(
                            word.sbj,
                            meta_idn=word.sbj.meta_idn.qstring(),
                            is_anonymous=word.sbj.is_anonymous,
                            lex_class=type_name(word.sbj.lex),
                            word_class=type_name(word.sbj),
                            index=word.sbj.index.qstring(),
                            index_number=native_num(word.sbj.index),
                        )

                    vrb_z = z(word.vrb.idn)
                    if vrb_z == Z.IP_ADDRESS_TAG:
                        listing_log(word.sbj, ip_address=word.txt)
                    elif vrb_z == Z.NAME:
                        listing_log(word.obj, name=word.txt)
                    elif vrb_z == Z.ICONIFY:
                        listing_log(word.obj, iconify=word.txt, name=word.obj.txt)
                    elif vrb_z == Z.USER_AGENT_TAG:
                        ua = werkzeug.useragents.UserAgent(word.txt)
                        # noinspection PyUnresolvedReferences
                        listing_log(
                            word.sbj,
                            user_agent=word.txt,
                            browser=ua.browser,
                            platform=ua.platform,
                        )

            t_lex = time.time()
            qc_foot = auth.lex.query_count
            with body.footer() as foot:
                foot.js_stamped(static_code_url('d3.js'))
                # TODO:  Is d3.js here just to draw delta-time triangles?  If so replace it.
                #        Or use it for cool stuff.
                #        Like better drawn words or links between words!
                foot.js_stamped(static_code_url('util.js'))
                foot.js_stamped(static_code_url('meta_lex.js'))
                with foot.script() as script:
                    script.raw_text('\n')
                    monty = dict(
                        IDN=auth.lex.IDN.dictionary_of_qstrings(),
                        LISTING_WORDS=listing_dict,
                        NOW=float(time_lex.now_word().num),
                        URL_HERE=auth.current_url,
                        URL_PREFIX_QUESTION=url_from_question(''),
                    )
                    script.raw_text('var MONTY = {json};\n'.format(json=json_pretty(monty)))
                    script.raw_text('js_for_meta_lex(window, window.$, MONTY);\n')
    t_render = time.time()
    response = html.doctype_plus_html()
    t_end = time.time()
    print(
        "META LEX TIMING,",
        qc_find - qc_start,
        qc_foot - qc_find,
        auth.lex.query_count - qc_foot,
        "queries,",
        len(words),
        "words,",
        "{:.3f} {:.3f} {:.3f} =  {:.3f}".format(
            t_lex - t_start,
            t_render - t_lex,
            t_end - t_render,
            t_end - t_start,
        ),
        "sec"
    )
    return response


def url_from_question(question_text):
    return flask.url_for('answer_qiki', url_suffix=question_text, _external=True)
    # THANKS:  Absolute url, https://stackoverflow.com/q/12162634/673991#comment17401215_12162726


# @flask_app.route('/meta/all', methods=('GET', 'HEAD'))
# def legacy_meta_all():
#     # TODO:  verb filter checkboxes (show/hide each one, especially may want to hide "questions")
#
#     auth = AuthFliki()
#     if not auth.is_online:
#         return "meta offline"
#     if not auth.is_authenticated:
#         return auth.login_html()   # anonymous viewing not allowed, just show "login" link
#         # TODO:  Instead of rejecting all anonymous-user viewing,
#         #        maybe just omit anonymous-content.
#         #        That is, where sbj.lex.meta_word.txt == 'anonymous'
#
#     lex = auth.lex
#     browse_verb = lex[lex.IDN.BROWSE]
#
#     with FlikiHTML('html') as html:
#         html.header("Lex all")
#
#         with html.body(class_='target-environment') as body:
#             with body.p() as p:
#                 p.raw_text(auth.login_html())
#
#             qc_start = lex.query_count
#             t_start = time.time()
#             words = lex.find_words()
#             t_find_words = time.time()
#             qc_find_words = lex.query_count
#
#             words = list(words)[ : ]
#             all_subjects = {word.sbj for word in words}
#
#
#
#             def limbo_idns():
#                 for word in words:
#                     for sub_word in (word.sbj, word.vrb, word.obj):
#                         if sub_word.lex.__class__.__name__ == 'ListingLimbo':
#                             yield sub_word.idn
#
#             limbo_set = set(list(limbo_idns()))
#
#             with body.pre() as pre:
#                 for limbo_idn in sorted(limbo_set):
#                     pre.text("Limbo {idn}\n".format(idn=limbo_idn))
#
#
#
#             lex_words = lex.find_words(txt='lex')
#             define_words = lex.find_words(txt='define')
#             listing_words = lex.find_words(txt='listing')
#             with body.pre() as pre:
#                 if len(lex_words) != 1:
#                     for word in lex_words:
#                         pre.text("lex: {}\n".format(word.idn))
#                 if len(define_words) != 1:
#                     for word in define_words:
#                         pre.text("define: {}\n".format(word.idn))
#                 if len(listing_words) != 1:
#                     for word in listing_words:
#                         pre.text("listing: {}\n".format(word.idn))
#             # Could loop through and beknight words that either use the first lex & define
#             # or at that moment lex and define aren't defined yet
#             # then later the strings have to be consistent
#
#
#
#             def latest_iconifier_or_none(s):
#                 iconifiers = lex.find_words(obj=s, vrb=lex.IDN.ICONIFY)
#                 try:
#                     return iconifiers[-1]
#                 except IndexError:
#                     return None
#
#             subject_icons_nones = {s: latest_iconifier_or_none(s) for s in all_subjects}
#             subject_icons = {s: i for s, i in subject_icons_nones.items() if i is not None}
#             # print("Subject icons", repr(subject_icons))
#             # EXAMPLE:  Subject icons {
#             #     Word('user'): Word(338),
#             #     Word(0q82_A7__8A059E058E6A6308C8B0_1D0B00): Word(864)
#             # }
#
#             def word_identification(w):
#                 w_idn = w.idn.qstring()
#                 if not w.idn.is_suffixed() and w.idn.is_whole():
#                     w_idn += " ({})".format(render_num(w.idn))
#                 w_idn += " " + w.lex.__class__.__name__
#                 return w_idn
#
#             def word_identification_text(w):
#                 return "{idn}: {txt}".format(
#                     idn=word_identification(w),
#                     txt=safe_txt(w),
#                 )
#
#             def show_sub_word(element, w, title_prefix="", **kwargs):
#                 if w.obj == browse_verb:
#                     w_txt = "session #" + str(native_num(w.idn))
#                 elif w.vrb is not None and w.vrb.obj == browse_verb:
#                     w_txt = "hit #" + str(native_num(w.idn))
#                 else:
#                     w_txt = compress_txt(safe_txt(w))
#                 return show_sub_word_txt(element, w, w_txt, title_prefix=title_prefix, **kwargs)
#
#             def show_sub_word_txt(element, w, w_txt, title_prefix="", a_href=None, **kwargs):
#                 """Diagram a sbj, vrb, or obj."""
#                 with element.span(**kwargs) as span_sub_word:
#                     if a_href is None:
#                         inner = span_sub_word
#                     else:
#                         inner = span_sub_word.a(
#                             href=a_href,
#                             target='_blank',
#                         )
#
#                     if w in subject_icons:
#                         inner.img(
#                             src=subject_icons[w].txt,
#                             title=title_prefix + word_identification_text(w)
#                         )
#                         # NOTE:  w.__class__.__name__ == 'WordDerivedJustForThisListing'
#                     else:
#                         classes = ['named']
#                         # if isinstance(w.lex, AnonymousQikiListing):
#                         if is_qiki_user_anonymous(w):
#                             classes.append('anonymous')
#                         elif w.idn == lex.IDN.LEX:
#                             classes.append('lex')
#                         with inner.span(classes=classes) as span_named:
#                             span_named(w_txt, title=title_prefix + word_identification(w))
#                     return span_sub_word
#
#             def quoted_compressed_txt(element, txt):
#                 element.char_name('ldquo')
#                 element.text(compress_txt(txt))
#                 element.char_name('rdquo')
#
#             def show_iconify_obj(element, word, title_prefix=""):
#                 show_sub_word(element, word.obj, class_='wrend obj vrb-iconify', title_prefix=title_prefix)
#                 with element.span(class_='txt') as span_txt:
#                     span_txt.text(" ")
#                     span_txt.img(src=word.txt, title="txt = " + compress_txt(word.txt))
#
#             def show_question_obj(element, word, title_prefix=""):
#
#                 if word.obj.txt == '':
#                     show_sub_word(element, word.obj, class_='wrend obj vrb-question', title_prefix=title_prefix)
#                 else:
#                     show_sub_word(
#                         element,
#                         word.obj,
#                         class_='wrend obj vrb-question',
#                         title_prefix=title_prefix,
#                         a_href=url_from_question(word.obj.txt)
#                     )
#
#                 if word.txt != '':   # When vrb=question_verb, txt was once the referrer.
#                     if word.txt == auth.current_url:
#                         element.span(" (here)", class_='referrer', title="was referred from here")
#                     elif word.txt == url_from_question(word.obj.txt):
#                         element.span(" (self)", class_='referrer', title="was referred from itself")
#                     else:
#                         # TODO:  Remove these crufty if-clauses,
#                         #        because the referrer url is now stored in the txt
#                         #        of a separate referrer_verb word that objectifies the hit
#                         element.text(" ")
#                         with element.a(
#                             href=word.txt,
#                             title="referrer",
#                             target='_blank',
#                         ) as a:
#                             a.span("(ref)", class_='referrer')
#
#             def show_num(element, word):
#                 if word.num != qiki.Number(1):
#                     with element.span(class_='num', title="num = " + word.num.qstring()) as num_span:
#                         num_span.text(" ")
#                         num_span.char_name('times')
#                         num_span.text(render_num(word.num))
#
#             def show_txt(element, word):
#                 if word.txt != '':
#                     if word.vrb == lex[lex.IDN.REFERRER]:
#                         if word.txt == url_from_question(word.obj.obj.txt):
#                             with element.span(class_='referrer', title="was referred from itself") as ref_span:
#                                 ref_span.text(" (self)")
#                             return
#                         if word.txt == auth.current_url:
#                             with element.span(class_='referrer', title="was referred from here") as ref_span:
#                                 ref_span.text(" (here)")
#                             return
#                     with element.span(class_='txt') as txt_span:
#                         txt_span.text(" ")
#                         quoted_compressed_txt(txt_span, word.txt)
#
#             body.comment(["My URL is", auth.current_url])
#             with body.ol(class_='lex-list') as ol:
#                 last_whn = None
#                 first_word = True
#                 ago_lex = AgoLex()
#
#                 t_loop = time.time()
#                 t_words = list()
#
#                 for word in words:
#                     if first_word:
#                         first_word = False
#                         delta = None
#                         extra_class = ''
#                     else:
#                         delta = DeltaTimeLex()[last_whn](u'differ')[word.whn]
#                         extra_class = ' delta-' + delta.units_long
#                     with ol.li(
#                         value=render_num(word.idn),   # the "bullet" of the list
#                         title="idn = " + word.idn.qstring(),
#                         class_='srend' + extra_class,
#                     ) as li:
#                         if delta is not None:
#                             units_class = delta.units_long
#                             if 0.0 < delta.num < 1.0:
#                                 units_class = 'subsec'
#                             with li.span(class_='delta-triangle ' + units_class) as triangle:
#                                 triangle(title=delta.description_long)
#                                 triangle.text(UNICODE.BLACK_RIGHT_POINTING_TRIANGLE)
#                             with li.span(class_='delta-amount ' + units_class) as amount:
#                                 amount.text(delta.amount_short + delta.units_short)
#
#                         show_sub_word(li, word.sbj, class_='wrend sbj', title_prefix= "sbj = ")
#
#                         show_sub_word(li, word.vrb, class_='wrend vrb', title_prefix="vrb = ")
#
#                         if word.vrb.txt == 'iconify':
#                             show_iconify_obj(li, word, title_prefix="obj = ")
#                         elif word.vrb == lex[lex.IDN.QUESTION_OBSOLETE]:
#                             show_question_obj(li, word, title_prefix="obj = ")
#                         elif word.vrb.obj == browse_verb:
#                             show_question_obj(li, word, title_prefix="obj = ")
#                         else:
#                             show_sub_word(li, word.obj, class_='wrend obj', title_prefix="obj = ")
#                             show_num(li, word)
#                             show_txt(li, word)
#
#                         li.span(" ")
#                         ago = ago_lex.describe(word.whn)
#                         with li.span(
#                             title="whn = " + ago.description_longer,   # e.g. "34.9 hours ago: 2019.0604.0459.02"
#                             class_='whn ' + ago.units_long,       # e.g. "hours"
#                         ) as whn_span:
#                             whn_span.text(ago.description_short)       # e.g. "35h"
#                         last_whn = word.whn
#
#                     t_now = time.time()
#                     t_elapsed = t_now - t_loop
#                     t_loop = t_now
#                     t_words.append(t_elapsed)
#
#             body.footer()
#
#     qc_loop = lex.query_count
#
#     print(
#         "ALL TIMING "
#         "find {qc_find}:{t_find:.3f}, "
#         "{n}*loop {qc_loop} : {t_min:.3f} / {t_max:.3f} / {t_avg:.3f}, "
#         "total {t_total:.3f}".format(
#             qc_find=qc_find_words - qc_start,
#             t_find=t_find_words - t_start,
#             qc_loop=qc_loop - qc_find_words,
#             t_min=min(t_words),
#             t_max=max(t_words),
#             t_avg=sum(t_words)/len(t_words),
#             t_total=t_loop - t_start,
#             n=len(words),
#         )
#     )
#
#     return html.doctype_plus_html()


MAX_TXT_LITERAL = 120
BEFORE_DOTS = 80
AFTER_DOTS = 20


def compress_txt(txt):
    if txt is None:
        return "(((None)))"
    if len(txt) > MAX_TXT_LITERAL:
        before = txt[ : BEFORE_DOTS]
        after = txt[-AFTER_DOTS : ]
        n_more = len(txt) - BEFORE_DOTS - AFTER_DOTS
        return "{before}...({n_more} more characters)...{after}".format(
            before=before,
            n_more=n_more,
            after=after,
        )
    else:
        return txt


class DeltaTimeLex(qiki.TimeLex):
    """Augment the time interval feature with more formatting."""

    def differ(self, word, sbj, vrb, obj):
        """
        Intercept a time_lex[t1]('differ')[t2] word lookup.

        Augment this word with extra information
            amount_short
            amount_long
            units_short
            units_long
            description_short
            description_long

        :param word: - a TimeLex word representing a time interval
        :param sbj: - a TimeLex word representing the earlier time.
        :param vrb: - 'differ' to get here
        :param obj:- a TimeLex word representing the later time.
        :return: - true if this time interval "exists" (otherwise caller will raise NotFound)
        """
        does_exist = super(DeltaTimeLex, self).differ(word, sbj, vrb, obj)
        if does_exist:

            def div(n, d):
                return "{:.0f}".format(float(n)/d)

            def div1(n, d):
                return "{:.1f}".format(float(n)/d)

            delta_seconds = word.num
            if delta_seconds ==                                   0.000:
                word.amount_short = ""
                word.amount_long = ""
                word.units_short = "z"
                word.units_long = "zero"
            elif delta_seconds <=                               120*1:
                word.amount_short = div(delta_seconds,            1)
                word.amount_long = div1(delta_seconds,            1)
                word.units_short = "s"
                word.units_long = "seconds"
            elif delta_seconds <=                            120*60:
                word.amount_short = div(delta_seconds,           60)
                word.amount_long = div1(delta_seconds,           60)
                word.units_short = "m"
                word.units_long = "minutes"
            elif delta_seconds <=                          48*60*60:
                word.amount_short = div(delta_seconds,        60*60)
                word.amount_long = div1(delta_seconds,        60*60)
                word.units_short = "h"
                word.units_long = "hours"
            elif delta_seconds <=                       90*24*60*60:
                word.amount_short = div(delta_seconds,     24*60*60)
                word.amount_long = div1(delta_seconds,     24*60*60)
                word.units_short = "d"
                word.units_long = "days"
            elif delta_seconds <=                    24*30*24*60*60:
                word.amount_short = div(delta_seconds,  30*24*60*60)
                word.amount_long = div1(delta_seconds,  30*24*60*60)
                word.units_short = "M"
                word.units_long = "months"
            else:
                word.amount_short = div(delta_seconds, 365*24*60*60)
                word.amount_long = div1(delta_seconds, 365*24*60*60)
                word.units_short = "Y"
                word.units_long = "years"

            word.description_short = word.amount_short + word.units_short
            word.description_long = word.amount_long + " " + word.units_long
        return does_exist


class AgoLex(DeltaTimeLex):
    """Time interval between now and some word in the past."""
    # TODO  Support future time too, "hence" instead of ago.

    def __init__(self, **kwargs):
        super(AgoLex, self).__init__(**kwargs)
        self._now = self.now_word()

    def differ(self, word, sbj, vrb, obj):
        does_exist = super(AgoLex, self).differ(word, sbj, vrb, obj)
        if does_exist:
            time_n_date_of_original_event = self[sbj.whn].txt
            word.description_longer = "{description_long} ago: {time_n_date}".format(
                description_long=word.description_long,
                time_n_date=time_n_date_of_original_event,
            )
        return does_exist

    def describe(self, t):
        return self[t](u'differ')[self._now]


@flask_app.route('/meta/all words', methods=('GET', 'HEAD'))   # the older, simpler way
def legacy_even_older_meta_all_words():
    """Primitive dump entire lex."""
    # NOTE:  The following logs itself, but that gets to be annoying:
    #            the_path = flask.request.url
    #            word_for_the_path = lex.define(path, the_path)
    #            me(browse)[word_for_the_path] = 1, referrer(flask.request)
    #        Or is it the viewing code's responsibility to filter out tactical cruft?

    auth = AuthFliki()
    if not auth.is_online:
        return "words offline"
    if not auth.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    lex = auth.lex

    qc_start = lex.query_count
    t_start = time.time()
    words = lex.find_words()
    t_find_words = time.time()
    qc_find_words = lex.query_count

    t_loop = time.time()
    t_words = list()
    reports = []
    for word in words:

        reports.append(dict(
            i=render_num(word.idn),
            idn_qstring=word.idn.qstring(),
            s=safe_txt(word.sbj),
            v=safe_txt(word.vrb),
            o=safe_txt(word.obj),
            s_idn=word.sbj.idn,
            v_idn=word.vrb.idn,
            o_idn=word.obj.idn,
            t=word.txt,
            # n=word.num,
            xn="" if word.num == 1 else "&times;" + render_num(word.num)
        ))
        t_now = time.time()
        t_elapsed = t_now - t_loop
        t_loop = t_now
        t_words.append(t_elapsed)
    qc_loop = lex.query_count

    response = flask.render_template(
        'meta.html',
        domain=auth.current_host,
        reports=reports,
        **config_dict
    )
    t_rendered = time.time()
    qc_rendered = lex.query_count

    print(
        "LEGACY ALL WORDS TIMING "
        "find {qc_find}:{t_find:.3f}, "
        "{n}*loop {qc_loop} : {t_min:.3f} / {t_max:.3f} / {t_avg:.3f}, "
        "render {qc_render:d}:{t_render:.3f} "
        "total {t_total:.3f}".format(
            qc_find=qc_find_words - qc_start,
            t_find=t_find_words - t_start,
            qc_loop=qc_loop - qc_find_words,
            t_min=min(t_words),
            t_max=max(t_words),
            t_avg=sum(t_words)/len(t_words),
            qc_render=qc_rendered - qc_loop,
            t_render=t_rendered - t_loop,
            t_total=t_rendered - t_start,
            n=len(words),
        )
    )
    return response


def safe_txt(w):
    try:
        return w.txt
    except qiki.Word.NotAWord:
        return "[non-word {}]".format(w.idn.qstring())
    except qiki.Listing.NotAListing:
        return "[non-listing {}]".format(w.idn.qstring())


if secure.credentials.Options.oembed_server_prefix is not None:
    # noinspection SpellCheckingInspection
    @flask_app.route(secure.credentials.Options.oembed_server_prefix, methods=('GET', 'HEAD'))
    def oembed_html():
        """
        Serve the iframe contents for embedded media, based on its URL.

        Pass the url for the media as a user might browse it.

        EXAMPLE:  url=https://www.youtube.com/watch?v=o9tDO3HK20Q
        EXAMPLE:  url=https://www.instagram.com/p/BkVQRWuDigy/

        """
        # print("oembed_html", json.dumps(flask.request.full_path))
        # EXAMPLE:
        #     oembed_html "/meta/oembed/?idn=1938&url=https%3A%2F%2Ftwitter.com
        #                  %2FICRC%2Fstatus%2F799571646331912192"
        url = flask.request.args.get('url')
        idn = flask.request.args.get('idn', default="(idn unknown)")
        matched_groups = matcher_groups(url, NOEMBED_PATTERNS)
        if matched_groups is not None:
            return noembed_render(url, idn, matched_groups)
        else:
            oembed_dict = noembed_get(url)
            if 'html' in oembed_dict:
                provider_name = oembed_dict.get('provider_name', "((unspecified))")
                but_why = "Though noembed may support it. Provider: " + provider_name
            else:
                error = oembed_dict.get('error', "((for some reason))")
                but_why = "Anyway noembed says: " + error
            print("Unsupported", json.dumps(url), but_why)
            return error_render(
                message="{domain} - unsupported domain.  {but_why}".format(
                    domain=json.dumps(domain_from_url(url)),
                    but_why=but_why,
                ),
                title=idn,
                # TODO:  simplified domain - idn
            )


def noembed_render(url, idn, matched_groups):
    """
    Render and wrangle noembed-supplied html.  For use by an iframe of embedded media.

    Not only is viewing this page in isolation minimalist
    (it starts with an empty body element), but it won't work at all.
    Because it waits for iFrameResizer of the parent page to load first.
    At least I think that's why.
    """
    url = fix_noembed_bug_with_instagram(url)
    oembed_dict = noembed_get(url)
    with FlikiHTML('html') as html:
        monty = dict(
            matched_groups=matched_groups,
            # TODO:  Do we really have to go through all patterns again?
            oembed=oembed_dict,
            original_url=url,
            target_origin=secure.credentials.Options.oembed_target_origin,
            THUMB_MAX_WIDTH=THUMB_MAX_WIDTH,
            THUMB_MAX_HEIGHT=THUMB_MAX_HEIGHT,
            POPUP_ID_PREFIX=POPUP_ID_PREFIX,
        )
        with html.head(newlines=True) as head:
            head.title("{idn}".format(idn=idn))
            # TODO:  Add caption.
            head.css_stamped(static_code_url('embed_content.css'))
            head.jquery(JQUERY_VERSION)
            head.js_stamped(static_code_url('util.js'))
            head.js_stamped(static_code_url('embed_content.js'))
            with head.script(type='text/javascript') as script:
                script.raw_text('\n')
                script.raw_text('var MONTY = {json};\n'.format(json=json_pretty(monty)))
                script.raw_text('embed_content_js(window, jQuery, MONTY);\n')

        html.body()
        return html.doctype_plus_html()


def fix_noembed_bug_with_instagram(url):
    """noembed.com chokes on the www before instagram.com"""
    return re.sub(
        '^https?://(?:www\\.)?(?:instagram\\.com|instagr\\.am)',
        'https://instagram.com',
        url
    )


def noembed_get(media_url):
    """Get the noembed scoop on a media url."""
    noembed_request = 'https://noembed.com/embed?url=' + media_url
    oembed_dict = json_get(noembed_request)
    oembed_dict = oembed_dict or dict(
        error="Unable to load " + media_url
    )
    return oembed_dict


def error_render(message, title=""):
    """Explain why this url can't be embedded."""
    with FlikiHTML('html') as html:
        with html.head(newlines=True) as head:
            head.title(title)
            # head.js(static_code_url('iframeResizer.contentWindow.js'))
            head.js('https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/iframeResizer.contentWindow.js')
            # NOTE:  So there are fewer console warnings.

            head.style('body {background-color:#FFF8F0}')
            # NOTE:  So error messages aren't transparent popped up.
        with html.body(newlines=True) as body:
            body.p(message, style='margin:0; min-width: 10em;', **{'data-iframe-width': 'x'})
        return html.doctype_plus_html()


def domain_from_url(url):
    return urllib.parse.urlsplit(url).netloc


@flask_app.route('/<path:url_suffix>', methods=('GET', 'HEAD'))
# SEE:  Wildcard custom converter, https://stackoverflow.com/a/33296155/673991
# TODO:  Study HEAD-to-GET mapping, http://stackoverflow.com/q/22443245/673991
def answer_qiki(url_suffix):
    """
    This is the wide open window, where qiki has an answer for everything.

    Everything has a name.
    Or a /context/name
    Or a /context/context/name

    Obviously the lex has a WORD for each of these answer-y pages
    that has ever been "questioned" by virtue of being browsed to.

    Maybe each such word gets its context by some other word. Maybe by pre-vrb:
        vrb=define txt='youtube'
        vrb=youtube txt='HttF5HVYtlQ'
    Or by post-obj:
        idn=x vrb=define obj=path txt='youtube/HttF5HVYtlQ'
        vrb=context obj=x

    :param url_suffix:  example "php/strlen"
                        example "youtube/HttF5HVYtlQ"
                        usually of the form context "/" name
                                 but maybe context "/" context "/" name
    :return:
    """

    if url_suffix == 'favicon.ico':
        return static_response_from_qiki_javascript(filename=url_suffix)
        # SEE:  favicon.ico in root, https://realfavicongenerator.net/faq#why_icons_in_root

    if not secure.credentials.Options.enable_answer_qiki:
        flask.abort(404)


    auth = AuthFliki()
    if not auth.is_online:
        return "answers offline"

    auth.hit(url_suffix)   # flask.request.path has an initial slash
    lex = auth.lex

    qoolbar_verbs = auth.qoolbar.get_verbs()
    question_bling_json = json_from_words(lex.find_words(
        obj=auth.path_word,
        vrb=qoolbar_verbs,
    ))

    answers = lex.find_words(
        vrb=lex.IDN.ANSWER,
        obj=auth.path_word,
        jbo_vrb=qoolbar_verbs,
        idn_ascending=False,
        jbo_ascending=True,
    )
    # TODO:  Alternatives to find_words()?
    #        answers = lex.find(vrb=answer, obj=auth.this_path,
    for answer in answers:
        answer.jbo_json = json_from_words(answer.jbo)
        # print("Answer", repr(a), a.jbo_json)
        # EXAMPLE:  Answer Word(102) [
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q82_CF"},
        #    {"sbj": "0q82_A8__82AB_1D0300", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q82_D8"},
        #    {"sbj": "0q82_A8__82AB_1D0300", "vrb": "0q82_86", "txt": "", "num": 2, "idn": "0q83_0105"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 2, "idn": "0q83_0135"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 3, "idn": "0q83_017F"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q83_0180"}
        # ]
        picture_words = lex.find_words(vrb=lex.IDN.ICONIFY, obj=answer.sbj)
        picture_word = picture_words[0] if len(picture_words) >= 1 else None
        name_words = lex.find_words(vrb=lex.IDN.NAME, obj=answer.sbj)
        name_word = name_words[-1] if len(name_words) >= 1 else answer.sbj
        name_txt = name_word.txt
        # TODO:  Get latest name instead of earliest name
        if picture_word is not None:
            author_img = "<img src='{url}' title='{name}' class='answer-author'>".format(
                url=picture_word.txt,
                name=name_txt,
            )
        elif name_txt:
            author_img = "({name})".format(name=name_txt)
        else:
            author_img = ""

        answer.author = author_img
    question_words = lex.find_words(vrb=lex.IDN.QUESTION_OBSOLETE, obj=auth.path_word)   # old hits
    session_words = lex.find_words(obj=lex.IDN.BROWSE)
    hit_words = lex.find_words(vrb=session_words, obj=auth.path_word)   # new hits
    # TODO:  browses = lex.words(vrb_obj=WORD.BROWSE)
    # TODO:  browses = lex.jbo(session_words)
    # TODO:  browses = lex(obj=lex(vrb=WORD.BROWSE, obj=auth.this_path))
    # TODO:  browses = lex.find_words(obj=lex.find_words(vrb=WORD.BROWSE, obj=auth.this_path))
    render_question = legacy_youtube_render(url_suffix)
    if render_question is None:
        render_question = "Here is a page for '{}'".format(flask.escape(url_suffix))
    return flask.render_template(
        'answer.html',
        question=url_suffix,
        question_idn=auth.path_word.idn.qstring(),
        question_jbo_json=question_bling_json,
        answers=answers,
        len_answers=len(answers),
        len_questions=len(question_words) + len(hit_words),
        me_idn=auth.qiki_user.idn,
        log_html=auth.login_html(),
        render_question=render_question,
        dot_min='.min' if DO_MINIFY else '',
        **config_dict
    )


def legacy_youtube_render(url_suffix):
    found = re.search(r'^youtube/([a-zA-Z0-9_-]{11})$', url_suffix)
    # THANKS:  YouTube video id, https://stackoverflow.com/a/4084332/673991
    # SEE:  v3 API, https://stackoverflow.com/a/31742587/673991
    if found:
        video_id = found.group(1)
        iframe = web_html.WebHTML('iframe')
        iframe(
            width='480',
            height='270',
            src='https://www.youtube.com/embed/{video_id}'.format(video_id=video_id),
            frameborder='0',
            allow='autoplay; encrypted-media',
            allowfullscreen='allowfullscreen',
        )
        # TODO:  Does this `allow` do anything?
        # SEE:  https://developer.mozilla.org/Web/HTTP/Feature_Policy#Browser_compatibility
        return six.text_type(iframe)
    else:
        return None


def json_from_words(words):
    """Convert a Python list of words to a JavaScript (json) array of word-like objects."""
    # TODO:  Replace with json_encode()
    #        Obviously that function has to support lists, etc. first.
    dicts = []
    for word in words:
        word_dict = dict(
            idn=word.idn.qstring(),
            sbj=word.sbj.idn.qstring(),
            vrb=word.vrb.idn.qstring(),
            # NOTE:  The obj field is not needed when words come from jbo:
            #            obj=word.obj.idn.qstring(),
            #        ...because word.obj is itself.  That is, a.jbo[i].obj == a
            num=native_num(word.num),
            txt=word.txt
        )
        dicts.append(word_dict)
    return json.dumps(
        dicts,
        allow_nan=False,
        separators=(',', ':'),   # NOTE:  Less whitespace
    )
    # TODO:  try-except OverflowError if NaN or Infinity got into dicts somehow.


def render_num(num):
    return str(native_num(num))


def render_whn(whn):
    return "{:.3f}".format(float(whn))


def native_num(num):
    if num.is_suffixed():
        # TODO:  Complex?
        return num.qstring()
    elif not num.is_reasonable():
        # THANKS:  JSON is a dummy about NaN, inf,
        #          https://stackoverflow.com/q/1423081/673991#comment52764219_1424034
        # THANKS:  None to nul, https://docs.python.org/library/json.html#py-to-json-table
        return None
    elif num.is_whole():
        return int(num)
    else:
        # TODO:  Ludicrous numbers should become int.
        return float(num)


@flask_app.route(AJAX_URL, methods=('POST',))
def ajax():
    t_start = time.time()
    auth = None
    action = None
    qc_start = 0
    ok_to_print = (
        SHOW_LOG_AJAX_NOEMBED_META or
        flask.request.form.get('action', '_') != 'noembed_meta'
    )
    etc = None

    try:
        auth = AuthFliki(ok_to_print=ok_to_print)

        if not auth.is_online:
            return invalid_response("ajax offline")

        qc_start = auth.lex.query_count

        lex = auth.lex
        action = auth.form('action')
        # TODO:  class Action(Enumerant), or SomeClass.action = Action() instance or something.
        if action == 'answer':
            question_path = auth.form('question')
            answer_txt = auth.form('answer')
            question_word = lex.define(lex.IDN.PATH, question_path)
            auth.qiki_user(lex.IDN.ANSWER)[question_word] = 1, answer_txt
            return valid_response('message', "Question {q} answer {a}".format(
                q=question_path,
                a=answer_txt,
            ))
        elif action == 'qoolbar_list':
            verbs = list(auth.qoolbar.get_verb_dicts())

            # print("qoolbar - " + " ".join(v[b'name'] + " " + str(v[b'qool_num']) for v in verbs))
            # EXAMPLE:  qoolbar delete 1 like 1
            # EXAMPLE:  qoolbar - like 1 delete 1 laugh 0 spam 1 laugh 1

            return valid_response('verbs', verbs)
            # print(verbs) (I guess)
            # EXAMPLE:
            #     {"is_valid": true, "verbs": [
            #         {"idn": "0q82_86",   "icon_url": "http://tool.qiki.info/icon/thumbsup_16.png", "name": "like"},
            #         {"idn": "0q82_89",   "icon_url": "http://tool.qiki.info/icon/delete_16.png",   "name": "delete"},
            #         {"idn": "0q83_01FC", "icon_url": null,                                         "name": "laugh"}
            #     ]}

        elif action == 'sentence':
            obj_idn = auth.form('obj_idn')
            vrb_txt = auth.form('vrb_txt', None)
            if vrb_txt is None:
                # TODO:  Should vrb_idn have priority over vrb_txt instead?
                vrb_idn = auth.form('vrb_idn')
                vrb = lex[qiki.Number(vrb_idn)]
            else:
                vrb = lex.verb(vrb_txt)
                # FIXME:  can we allow browser trash to define a verb?

            txt = auth.form('txt')
            use_already = auth.form('use_already', False)
            obj = lex[qiki.Number(obj_idn)]
            num_add_str = auth.form('num_add', None)
            num_str = auth.form('num', None)
            num_add = None if num_add_str is None else qiki.Number(num_add_str)
            num = None if num_str is None else qiki.Number(num_str)
            new_word_kwargs = dict(
                sbj=auth.qiki_user,
                vrb=vrb,
                obj=obj,
                num=num,
                num_add=num_add,
                txt=txt,
                use_already=use_already,
            )
            if auth.may_create_word(new_word_kwargs):
                new_word = lex.create_word(**new_word_kwargs)
                return valid_response('new_words', [new_word])
                # TODO:  Maybe exclude txt form new_word to save bandwidth?
            else:
                return invalid_response("not authorized")

        elif action == 'new_verb':
            new_verb_name = auth.form('name')
            new_verb = lex.create_word(
                sbj=auth.qiki_user,
                vrb=lex.IDN.DEFINE,
                obj=lex.IDN.VERB,
                txt=new_verb_name,
                use_already=True,
            )
            lex.create_word(
                sbj=auth.qiki_user,
                vrb=lex.IDN.QOOL,
                obj=new_verb,
                num=NUM_QOOL_VERB_NEW,
                use_already=True,
            )
            etc = new_verb.idn.qstring()
            return valid_response('idn', new_verb.idn.qstring())

        elif action == 'delete_verb':
            old_verb_idn = qiki.Number(auth.form('idn'))

            lex.create_word(
                sbj=auth.qiki_user,
                vrb=lex.IDN.QOOL,
                obj=old_verb_idn,
                num=NUM_QOOL_VERB_DELETE,
                use_already=True,
            )
            return valid_response('idn', old_verb_idn.qstring())

        # elif action == 'contribution_order':
        #     return valid_response('order', auth.cat_cont_order())

        elif action == 'anon_question':
            return valid_response('seconds', float(seconds_until_anonymous_question()))

        elif action == 'anon_answer':
            return valid_response('seconds', float(seconds_until_anonymous_answer()))

        elif action == 'noembed_meta':
            url = auth.form('url')
            oembed_dict = noembed_get(url)
            return valid_response('oembed', oembed_dict)

        elif action == 'interact':
            interaction_name = auth.form('name')   # e.g. MONTY.INTERACTION.PAUSE == 'pause'
            interaction_obj = auth.form('obj')     # e.g. idn of a contribution
            interaction_num = auth.form('num', default=1)     # e.g. 15 sec (video), 92 chars (text)
            interaction_txt = auth.form('txt', default="")
            interaction_verb = lex.define(lex.IDN.INTERACT, qiki.Text(interaction_name))
            interaction_word = lex.create_word(
                sbj=auth.qiki_user,
                vrb=interaction_verb,
                obj=qiki.Number(interaction_obj),
                num=qiki.Number(interaction_num),
                txt=qiki.Text(interaction_txt),
                use_already=False,
            )
            etc = interaction_word.idn.qstring()
            return valid_response()

        else:
            return invalid_response("Unknown action " + action)

    except (KeyError, IndexError, ValueError, qiki.word.LexMySQL.QueryError) as e:
        # EXAMPLE:  werkzeug.exceptions.BadRequestKeyError
        # EXAMPLE:  fliki.AuthFliki.FormVariableMissing
        # EXAMPLE:  qiki.word.LexSentence.CreateWordError
        # EXAMPLE:  qiki.word.LexMySQL.QueryError

        print("AJAX ERROR", type_name(e), str(e))
        traceback.print_exc()
        # EXAMPLE:  (request with no action, before Auth.form() was created)
        #     AJAX ERROR 400 Bad Request: The browser (or proxy) sent a request
        #           that this server could not understand.
        #     Traceback (most recent call last):
        #       File "...\fliki\fliki.py", line 1222, in ajax
        #         action = auth.form('action')
        #       File "...\lib\site-packages\werkzeug\datastructures.py", line 442, in __getitem__
        #         raise exceptions.BadRequestKeyError(key)
        #     werkzeug.exceptions.HTTPException.wrap.<locals>.newcls: 400 Bad Request:
        #     The browser (or proxy) sent a request that this server could not understand.
        #     127.0.0.1 - - [13/Jun/2019 18:56:28] "POST /meta/ajax HTTP/1.1" 200 -
        # EXAMPLE:  (action=sentence with no other vars)
        #     AJAX ERROR FormVariableMissing 'No form variable obj_idn'
        #     Traceback (most recent call last):
        #       File "D:\PyCharmProjects\fliki\fliki.py", line 1543, in ajax
        #         obj_idn = auth.form('obj_idn')
        #       File "D:\PyCharmProjects\fliki\fliki.py", line 449, in form
        #         raise self.FormVariableMissing("No form variable " + variable_name)
        #     AuthFliki.FormVariableMissing: 'No form variable obj_idn'
        #     127.0.0.1 - - [17/Jun/2019 10:07:40] "POST /meta/ajax HTTP/1.1" 200 -

        return invalid_response("request error")

    finally:
        t_end = time.time()
        if auth is None or not auth.is_online:
            print("AJAX CRASH, {t:.3f} sec".format(t=t_end - t_start))
        else:
            qc_end = auth.lex.query_count
            if ok_to_print:
                print(
                    "Ajax {action}{etc}, {qc} queries, {t:.3f} sec".format(
                        action=repr(action),
                        etc=" " + etc   if etc is not None else   "",
                        qc=qc_end - qc_start,
                        t=t_end - t_start
                    )
                )
                # TODO:  Add idn or other details from the action.


def retry(exception_to_check, tries=4, delay=3, delay_multiplier=2):
    """
    Retry function using an exponentially increasing delay.

    Retry happens if decorated function raises exception_to_check.

    1st try happens first.  If it raises exception_to_check,
    2nd try happens after delay seconds.  If another exception
    3rd try happens after delay * delay_multiplier seconds.  If another exception,
    :
    : (and so on)
    :
    Nth try happens (4th if tries is 4).  This time exception bubbles up to caller.

    http://www.saltycrane.com/blog/2009/11/trying-out-retry-decorator-python/
    original from: http://wiki.python.org/moin/PythonDecoratorLibrary#Retry

    :param exception_to_check: the exception to check. may be a tuple of
        exceptions to check
    :type exception_to_check: Exception or tuple
    :param tries: number of times to try (not retry) before giving up
    :type tries: int
    :param delay: initial delay between retries in seconds
    :type delay: int
    :param delay_multiplier: delay multiplier e.g. 2 will double the delay each retry
    :type delay_multiplier: int
    """
    # THANKS:  @retry use example, https://stackoverflow.com/a/9446765/673991
    def decorated_function(function_to_retry):

        @functools.wraps(function_to_retry)
        def retry_looper(*args, **kwargs):
            tries_remaining, delay_next = tries, delay
            while tries_remaining > 1:
                try:
                    return function_to_retry(*args, **kwargs)
                except exception_to_check as e:
                    print("{exception}, Retrying in {delay} seconds...".format(
                        exception=str(e),
                        delay=delay_next,
                    ))
                    time.sleep(delay_next)
                    tries_remaining -= 1
                    delay_next *= delay_multiplier
            return function_to_retry(*args, **kwargs)   # final try, may raise exception

        return retry_looper  # true decorator

    return decorated_function


@retry(urllib.error.URLError, tries=4, delay=3, delay_multiplier=2)
def _urlopen_with_retries(url):
    return urllib.request.urlopen(url)


# EXAMPLE _urlopen_with_retries() failure:
#     try:
#         _urlopen_with_retries(NON_ROUTABLE_URL)
#     except urllib.error.URLError:
#         print("URLError as expected")
#     else:
#         print("THIS SHOULD NOT HAVE WORKED!")
#     <urlopen error [WinError 10060] A connection attempt failed because the connected party
#                                     did not properly respond after a period of time,
#                                     or established connection failed because connected host
#                                     has failed to respond>, Retrying in 3 seconds...
#     <urlopen error [WinError 10060] A connection ........>, Retrying in 6 seconds...
#     <urlopen error [WinError 10060] A connection ........>, Retrying in 12 seconds...
#     URLError as expected


def json_get(url):
    """
    HTTP get a json resource.  Decode to unicode.  Output dict, list, or whatever.

    Return None on failure to get the resource, after multiple tries.
    """
    try:
        response = _urlopen_with_retries(url)
    except urllib.error.URLError as e:
        print("json_get gives up", str(e), url)
        return None

    with response:
        # EXAMPLE:  Exception during poor internet connection:
        #     urllib.error.URLError: <urlopen error [WinError 10053]
        #     An established connection was aborted by the software in your host machine>
        response_headers = dict(response.info())
        # EXAMPLE:  {
        #     'Server': 'nginx/1.10.3',
        #     'Content-Type': 'text/javascript; charset=utf-8',
        #     'Via': '1.1 varnish',
        #     'Content-Length': '608',
        #     'Accept-Ranges': 'bytes',
        #     'Date': 'Sun, 11 Aug 2019 15:58:37 GMT',
        #     'Age': '13952',
        #     'Connection': 'close',
        #     'X-Served-By': 'cache-mdw17338-MDW, cache-dfw18648-DFW',
        #     'X-Cache': 'MISS, HIT',
        #     'X-Cache-Hits': '0, 1',
        #     'X-Timer': 'S1565539118.670819,VS0,VE2',
        #     'Access-Control-Allow-Headers': 'Origin, Accept, Content-Type',
        #     'Access-Control-Allow-Methods': 'GET',
        #     'Access-Control-Allow-Origin': '*'
        # }
        try:
            content_type = response_headers['Content-Type']   # possible KeyError
            charset_match = re.search(r'charset=(.*)', content_type)
            charset = charset_match.group(1)   # possible AttributeError or IndexError
        except (KeyError, AttributeError, IndexError):
            charset = 'utf-8'
        response_json = response.read().decode(charset)
        # THANKS:  Bytes read, Unicode json'ed, https://stackoverflow.com/q/6862770/673991

    response_native = json.loads(response_json)
    return response_native


def matcher_groups(url, pattern_list):
    """
    Find a pattern that matches a url.

    :param url:
    :param pattern_list: - array of regular expressions
    :return: None if no patterns matched
             list of sub-groups if there were any match -- WHICH MIGHT BE AN EMPTY LIST

    CAUTION:  may return [] on a match, if there were no sub-groups in the pattern,
              and [] is falsy, just like None is.
              So check if return value is identical to None, e.g.
              if matcher_groups(u, p) is None: ...
              if matcher_groups(u, p) is not None: ...
    """
    for pattern in pattern_list:
        match_object = re.search(pattern, url)
        if match_object:
            return list(match_object.groups())
    return None


# def matcher(url, pattern_list):
#     any_pattern_matched = any(re.search(p, url) for p in pattern_list)
#     return any_pattern_matched


def valid_response(name=None, value=None):
    if name is None or value is None:
        return json_encode(dict([('is_valid', True)]))
    else:
        return json_encode(dict([('is_valid', True), (name, value)]))


def invalid_response(error_message):
    return json.dumps(dict(
        is_valid=False,
        error_message=error_message,
    ))


JSON_SEPARATORS_NO_SPACES = (',', ':')


def json_encode(x, **kwargs):
    """ JSON encoding a dict, including custom objects with a .to_json() method. """
    # TODO:  Support encoding list, etc.  ((WTF does this mean?))
    json_almost = json.dumps(
        x,
        cls=WordEncoder,
        separators=JSON_SEPARATORS_NO_SPACES,
        allow_nan=False,
        **kwargs
        # NOTE:  The output will have no newlines.
        #        If there APPEAR to be newlines when viewed in a browser Ctrl-U page source,
        #        it may just be the browser wrapping on the commas.
    )

    json_for_script = json_almost.replace('<', r'\u003C')
    # SEE:  (my answer) JSON for a script element, https://stackoverflow.com/a/57796324/673991
    # THANKS:  Jinja2 html safe json dumps utility, for inspiration
    #          https://github.com/pallets/jinja/blob/90595070ae0c8da489faf24f153b918d2879e759/jinja2/utils.py#L549

    return json_for_script


def json_pretty(x):
    return json_encode(
        x,
        sort_keys=True,
        indent=4,
    )


class WordEncoder(json.JSONEncoder):
    """Custom converter for json_encode()."""

    def default(self, w):
        if hasattr(w, 'to_json') and callable(w.to_json):
            return w.to_json()
        else:
            return super(WordEncoder, self).default(w)
            # NOTE:  Raises a TypeError, unless a multi-derived class
            #        calls a sibling class.  (If that's even how multiple
            #        inheritance works.)
            # NOTE:  This is not the same TypeError as the one that
            #        complains about custom dictionary keys.


def fix_dict(thing):
    """Replace qiki Number keys with qstrings in dictionaries, recursively."""
    if isinstance(thing, dict):
        for key, value in thing.items():
            if isinstance(key, qiki.Number):
                key = key.qstring()
                # TODO:  use "to_json" method instead.
            if isinstance(value, dict):
                value = dict(fix_dict(value))
            elif isinstance(value, list):
                value = list(fix_dict(value))
            elif isinstance(value, tuple):
                value = tuple(fix_dict(value))
            yield key, value
    elif isinstance(thing, (list, tuple)):
        for value in thing:
            if isinstance(value, dict):
                value = dict(fix_dict(value))
            yield value
    else:
        yield thing


def version_report():
    print((
        "Fliki {yyyy_mmdd_hhmm_ss}" +
        " - " +
        "git {git_sha_10}" +
        " - " +
        "Python {python_version}" +
        " - " +
        "Flask {flask_version}" +
        " - " +
        "qiki {qiki_version}"
    ).format(
        yyyy_mmdd_hhmm_ss=qiki.TimeLex().now_word().txt,
        git_sha_10=GIT_SHA_10,
        python_version=".".join(str(x) for x in sys.version_info),
        flask_version=flask.__version__,
        qiki_version=qiki.__version__,
    ))
    # EXAMPLES:
    #     Fliki 2019.0603.1144.11, git e74a46d9ed, Python 2.7.15.candidate.1, Flask 1.0.3, qiki 0.0.1.2019.0603.0012.15
    #     Fliki 2019.0603.1133.40, git a34d72cdc6, Python 2.7.16.final.0, Flask 1.0.2, qiki 0.0.1.2019.0603.0012.15
    #     Fliki 2019.0822.0932.33 - git 379d8bcd48 - Python 3.7.3.final.0 - Flask 1.1.1 - qiki 0.0.1.2019.0728.1919.04


if __name__ == '__main__':
    '''Run locally, fliki.py spins up its own web server.'''
    flask_app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/


application = flask_app

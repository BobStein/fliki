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
import json
import logging
import os
import re
import sys
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
# noinspection PyUnresolvedReferences
import six.moves.urllib as urllib
import werkzeug.local
import werkzeug.useragents

import qiki
from qiki.number import type_name
import secure.credentials
import to_be_released.web_html as web_html


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '3.3.1'   # https://developers.google.com/speed/libraries/#jquery
JQUERYUI_VERSION = '1.12.1'   # https://developers.google.com/speed/libraries/#jquery-ui
DO_MINIFY = False
config_names = ('AJAX_URL', 'JQUERY_VERSION', 'JQUERYUI_VERSION')
config_dict = {name: globals()[name] for name in config_names}
SCRIPT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))   # e.g. '/var/www/flask'
PARENT_DIRECTORY = os.path.dirname(SCRIPT_DIRECTORY)             # e.g. '/var/www'
GIT_SHA = git.Repo(SCRIPT_DIRECTORY).head.object.hexsha
GIT_SHA_10 = GIT_SHA[ : 10]
NUM_QOOL_VERB_NEW = qiki.Number(1)
NUM_QOOL_VERB_DELETE = qiki.Number(0)
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS = 10
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_ANSWERS = 60

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
flask_app.secret_key = secure.credentials.flask_secret_key


@flask_app.before_first_request
def flask_earliest_convenience():
    version_report()


class WorkingIdns(object):

    # TODO:  The instance of this class, "IDN" should probably be a member of
    #        LexFliki, except we don't want the lookups here to run every
    #        session.  For a given lex (database) these idns will never change.
    #        The instantiation of LexFliki actually represents a *connection* to the lex,
    #        which comes and goes every session.  What object can better represent the
    #        lex itself, including these idns?
    def __init__(self, lex):
        with flask_app.app_context():
            # setup_lex()
            # if flask.g.is_online:
            #     lex = flask.g.lex
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
                self.GOOGLE_LISTING    = lex.define(self.LISTING, u'google user').idn
                self.ANONYMOUS_LISTING = lex.define(self.LISTING, u'anonymous').idn
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
                # self.CAT_MINE_OBSOLETE = lex.define(self.CATEGORY, u'mine').idn
                # self.CAT_THINE_OBSOLETE= lex.define(self.CATEGORY, u'thine').idn


                # self.REORDER           = lex.verb(u'reorder').idn

                # self.EXPLAIN           = lex.verb(u'explain').idn
                self.FENCE_POST_RIGHT  = lex.noun(u'fence post right').idn

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

    def dictionary_of_qstrings(self):
        of_idns = dict_from_object(self)
        assert \
            all(isinstance(idn, qiki.Number) for idn in of_idns.values()), \
            "Expecting Numbers.  These members are not: " + repr(
                {n: type_name(x) for n, x in of_idns.items() if not isinstance(x, qiki.Number)}
            )
        of_qstrings = {name: idn.qstring() for name, idn in of_idns.items()}
        return of_qstrings


class LexFliki(qiki.LexMySQL):

    def __init__(self, **kwargs):
        self.query_count = 0
        # NOTE:  lex.IDN is made for use by e.g. cat_cont_order(),
        #        and therefore for spoofing by test_fliki.py which would test cat_cont_order()
        super(LexFliki, self).__init__(**kwargs)

    def _execute(self, cursor, query, parameters=()):
        self.query_count += 1
        return super(LexFliki, self)._execute(cursor, query, parameters)


def connect_lex():
    try:
        lex = LexFliki(**secure.credentials.for_fliki_lex_database)
    except LexFliki.ConnectError as e:
        print("CANNOT CONNECT", str(e))
        return None
    else:
        return lex


IDN = WorkingIdns(connect_lex())   # TODO:  Call this only via WSGI, not test_fliki.py


def setup_lex():
    if hasattr(flask.g, 'lex'):
        print("WHOOPS, ALREADY SETUP WITH A LEX")

    flask.g.lex = connect_lex()
    flask.g.lex.IDN = IDN   # these lookups were done once at startup, now reused by this session
    flask.g.is_online = flask.g.lex is not None


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


class GoogleFlaskUser(flask_login.UserMixin):
    """Flask_login model for a Google user."""

    def __init__(self, google_user_id):
        self.id = google_user_id


class GoogleQikiListing(qiki.Listing):

    class GoogleQikiUser(qiki.WordListed):
        is_anonymous = False

    def __init__(self, meta_word, word_class=None, **kwargs):
        if word_class is None:
            word_class = self.GoogleQikiUser
        super(GoogleQikiListing, self).__init__(meta_word=meta_word, word_class=word_class, **kwargs)

    def lookup(self, google_user_id):
        """
        Qiki model for a Google user.

        :param google_user_id:  a qiki.Number for the google user-id
        """
        idn = self.composite_idn(google_user_id)
        # EXAMPLE:  0q82_A7__8A059E058E6A6308C8B0_1D0B00

        namings = self.meta_word.lex.find_words(
            sbj=self.meta_word.lex[self.meta_word.lex],
            vrb=IDN.NAME,   # Ooh, will this bubble out of Listing to LexMySQL?
            obj=idn,
        )
        try:
            latest_naming = namings[0]
        except IndexError:
            the_name = "(unnamed googloid {})".format(idn)
        else:
            the_name = latest_naming.txt
        return the_name, qiki.Number(1)


class AnonymousQikiListing(qiki.Listing):

    class AnonymousQikiUser(qiki.WordListed):
        is_anonymous = True

    def __init__(self, meta_word, word_class=None, **kwargs):
        if word_class is None:
            word_class = self.AnonymousQikiUser
        super(AnonymousQikiListing, self).__init__(meta_word=meta_word, word_class=word_class, **kwargs)

    def lookup(self, session_verb_idn):
        parts = []
        anon_user = self.composite_idn(session_verb_idn)

        ips = self.root_lex.find_words(
            sbj=anon_user,
            vrb=IDN.IP_ADDRESS_TAG,
            obj=session_verb_idn,
        )
        try:
            parts.append(str(ips[-1].txt))
        except IndexError:
            '''session was never ip-address-tagged'''

        parts.append("session #" + render_num(session_verb_idn))

        uas = self.root_lex.find_words(
            sbj=anon_user,
            vrb=IDN.USER_AGENT_TAG,
            obj=session_verb_idn,
        )
        try:
            user_agent_str = str(uas[-1].txt)
        except IndexError:
            '''session was never user-agent-tagged'''
        else:
            try:
                user_agent_object = werkzeug.useragents.UserAgent(user_agent_str)
            except AttributeError:
                parts.append("(indeterminate user agent)")
            else:
                parts.append(user_agent_object.browser)   # "(browser?)")
                parts.append(user_agent_object.platform)   # "(platform?)")

        # TODO:  Make ip address, user agent, browser, platform
        #        available to logged-in users too.

        parts_not_null = (p for p in parts if p is not None)
        txt = qiki.Text(" ".join(parts_not_null))
        return txt, qiki.Number(1)


# TODO:  Combine classes, e.g. GoogleUser(flask_login.UserMixin, qiki.Listing)
#        But this causes JSON errors because json can't encode qiki.Number.
#        But there are so many layers to the serialization for sessions there's probably a way.
#        Never found a way to do that in qiki.Number only, darn.
#        All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


def dict_from_object(o):
    properties_and_underscores = vars(o)
    properties = [
        p for p in properties_and_underscores
        if not p.startswith('__')
    ]
    the_dict = {p: getattr(o, p) for p in properties}
    return the_dict


def setup_application_context():
    setup_lex()
    if flask.g.is_online:
        lex = flask.g.lex

        def report_dup_def(_, message):
            print("DUP DUP", message)

        lex.duplicate_definition_notify(report_dup_def)

        flask.g.google_qiki_listing = GoogleQikiListing(meta_word=lex[IDN.GOOGLE_LISTING])
        flask.g.anonymous_qiki_listing = AnonymousQikiListing(meta_word=lex[IDN.ANONYMOUS_LISTING])


@flask_app.teardown_appcontext
def teardown_application_context(exc=None):
    if hasattr(flask.g, 'lex'):
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
            'scope': authomatic.providers.oauth2.Google.user_info_scope + ['https://gdata.youtube.com'],
            # SEE:  get a users's YouTube uploads, https://stackoverflow.com/a/21987075/673991
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

        try:
            session_idn_qstring = self.session_idn_qstring
        except (KeyError, IndexError, AttributeError):
            self.session_new()
        else:
            try:
                session_idn = qiki.Number.from_qstring(session_idn_qstring)
                self.session_verb = self.lex[session_idn]
            except ValueError:
                print("BAD SESSION IDENTIFIER", session_idn_qstring)
                self.session_new()
            else:
                if self.session_verb.obj.idn == IDN.BROWSE:
                    '''old session word is good, keep it'''
                else:
                    print("NOT A SESSION IDENTIFIER", session_idn_qstring)
                    self.session_new()

        if self.is_authenticated:
            self.qiki_user = flask.g.google_qiki_listing[self.authenticated_id()]
            # TODO:  tag session_verb with google user, or vice versa
            #        if they haven't been paired yet,
            #        or aren't the most recent pairing
            #        (or remove that last thing, could churn if user is on two devices at once)
        elif self.is_anonymous:
            self.qiki_user = flask.g.anonymous_qiki_listing[self.session_verb.idn]
            # TODO:  Tag the anonymous user with the session (like authenticated user)
            #        rather than embedding the session ID so prominently
            #        although, that session ID is the only way to identify anonymous users
            #        so maybe not
        else:
            self.qiki_user = None
            print("User is neither authenticated nor anonymous.")

        ip_words = self.lex.find_words(
            sbj=self.qiki_user,
            vrb=IDN.IP_ADDRESS_TAG,
            obj=self.session_verb,
            idn_ascending=True,
        )
        if len(ip_words) == 0 or ip_words[-1].txt != ip_address_txt:
            self.qiki_user(IDN.IP_ADDRESS_TAG, use_already=False)[self.session_verb] = ip_address_txt
            # TODO:  How could this get a duplicate key?
            #        mysql.connector.errors.IntegrityError: 1062 (23000): Duplicate entry '\x821' for key 'PRIMARY'
            #        '\x821' === Number('0q82_31').raw, which is the idn for session_verb
            #        (i.e. the obj=WORD.BROWSE word)
            #        override_idn should have been None all the way down
            #        So was this a race condition in word in lex.max_idn()??
            #        That function does cause nested cursors.

        ua_words = self.lex.find_words(
            sbj=self.qiki_user,
            vrb=IDN.USER_AGENT_TAG,
            obj=self.session_verb,
            idn_ascending=True,
        )
        if len(ua_words) == 0 or ua_words[-1].txt != user_agent_txt:
            self.qiki_user(IDN.USER_AGENT_TAG, use_already=False)[self.session_verb] = user_agent_txt

    def session_new(self):
        self.session_verb = self.lex.create_word(
            # sbj=self.qiki_user,
            # NOTE:  Subject can't be user, when the user depends
            #        on the about-to-be-created session word
            #        (It's the payload in the suffix of the anon user idn.)
            #        Or can it?!  That would be a feat.
            #        Would require some shenanigans inside the max_idn_lock.
            sbj=IDN.LEX,
            vrb=IDN.DEFINE,
            obj=IDN.BROWSE,
            txt=self.unique_session_identifier(),
            use_already=False
        )
        self.session_idn_qstring = self.session_verb.idn.qstring()
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
    def session_idn_qstring(self):
        raise NotImplementedError

    @session_idn_qstring.setter
    @abc.abstractmethod
    def session_idn_qstring(self, qstring):
        raise NotImplementedError

    def session_get(self):
        raise NotImplementedError

    def session_set(self, session_string):
        raise NotImplementedError

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

    def static_url(self, relative_path):
        raise NotImplementedError

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
            return (
                u"<a href='{logout_link}'>"
                u"logout"
                u"</a>"
                u" "
                u"{display_name}"
            ).format(
                display_name=self.qiki_user.txt,
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


class AuthFliki(Auth):
    """Fliki / Authomatic specific implementation of logging in"""
    def __init__(self):
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
                " logged in" if self.is_authenticated else "" +
                " anonymous" if self.is_anonymous else ""
            )
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
            IDN.PATH,
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
                vrb=IDN.REFERRER,
                obj=self.browse_word,
                txt=qiki.Text.decode_if_you_must(this_referrer),
                use_already=False,   # TODO:  Could be True?  obj should be unique.
            )

    SESSION_VARIABLE_NAME = 'qiki_user'   # where we store the session verb's idn

    def unique_session_identifier(self):
        return str(uuid.uuid4())
        # NOTE:  Something that didn't work:  return flask.session['_id']
        #        I only saw the '_id' variable after googly login anyway.
        #        See https://stackoverflow.com/a/43505668/673991

    @property
    def session_idn_qstring(self):
        return flask.session[self.SESSION_VARIABLE_NAME]

    @session_idn_qstring.setter
    def session_idn_qstring(self, qstring):
        flask.session[self.SESSION_VARIABLE_NAME] = qstring

    def session_get(self):
        try:
            return flask.session[self.SESSION_VARIABLE_NAME]
        except KeyError:
            return None

    def session_set(self, session_string):
        flask.session[self.SESSION_VARIABLE_NAME] = session_string

    def authenticated_id(self):
        return self.flask_user.get_id()

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

    def static_url(self, relative_path):
        return flask.url_for('static', filename=relative_path)


def is_qiki_user_anonymous(user_word):
    return isinstance(user_word.lex, AnonymousQikiListing)


class SessionVariableName(object):
    QIKI_USER = 'qiki_user'


@login_manager.user_loader
def user_loader(google_user_id_string):
    # print("user_loader", google_user_id_string)
    # EXAMPLE:  user_loader 103620384189003122864 (Bob Stein's google user id, apparently)
    #           hex 0x59e058e6a6308c8b0 (67 bits)
    #           qiki 0q8A_059E058E6A6308C8B0 (9 qigits)
    #           (Yeah well it better not be a security thing to air this number like a toynbee tile.)

    # try:
    #     new_qiki_user = google_qiki_listing[qiki.Number(google_user_id_string)]
    # except qiki.Listing.NotFound:
    #     print("\t", "QIKI LISTING NOT FOUND")
    #     return None
    # else:
    #     # print("user idn", new_qiki_user.idn.qstring())
    #     # EXAMPLE:  idn 0q82_A7__8A059E058E6A6308C8B0_1D0B00

    new_flask_user = GoogleFlaskUser(google_user_id_string)
    # TODO:  Validate with google??
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
    return then_url_actual


def set_then_url(then_url):
    flask.session['then_url'] = then_url


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
            if hasattr(login_result, 'user') and login_result.user is not None:
                login_result.user.update()
                flask_user = GoogleFlaskUser(login_result.user.id)
                qiki_user = flask.g.google_qiki_listing[login_result.user.id]
                picture_parts = urllib.parse.urlsplit(login_result.user.picture)
                picture_dict = urllib.parse.parse_qs(picture_parts.query)
                # THANKS:  Parse URL query-string, http://stackoverflow.com/a/21584580/673991
                picture_size_string = picture_dict.get('sz', ['0'])[0]
                avatar_width = qiki.Number(picture_size_string)   # width?  height?  size??
                avatar_url = login_result.user.picture
                display_name = login_result.user.name
                print("Logging in", qiki_user.index, qiki_user.idn.qstring())
                # EXAMPLE:   Logging in 0q8A_059E058E6A6308C8B0 0q82_15__8A059E058E6A6308C8B0_1D0B00
                lex[lex](IDN.ICONIFY, use_already=True)[qiki_user.idn] = avatar_width, avatar_url
                lex[lex](IDN.NAME, use_already=True)[qiki_user.idn] = display_name
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
        pass
        # print("not logged in", repr(login_result))
        # EXAMPLE:  None (e.g. with extraneous variable on request query, e.g. ?then_url=...)

    return response


@flask_app.route('/module/qiki-javascript/<path:filename>')
def qiki_javascript(filename):
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
    # print("os_path_static", SCRIPT_DIRECTORY, flask_app.static_folder, relative_url)
    # EXAMPLE:  os_path_static D:\PyCharmProjects\fliki D:\PyCharmProjects\fliki\static code/meta_lex.css
    # Oops, this was broken:  return os.path.join(SCRIPT_DIRECTORY, flask_app.static_folder, relative_url)
    return flask.safe_join(flask_app.static_folder, relative_url)


def os_path_qiki_javascript(relative_url):
    return flask.safe_join(PARENT_DIRECTORY, 'qiki-javascript', relative_url)
    # NOTE:  Assume the fliki and qiki-javascript repos are in sibling directories.


class Parse(object):

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
            head.link(
                rel='shortcut icon',
                href=flask.url_for('qiki_javascript', filename='favicon.ico')
            )
            head.css_stamped(flask.url_for('static', filename='code/meta_lex.css'))
            head.css_stamped(flask.url_for('qiki_javascript', filename='qoolbar.css'))
            return head

    def footer(self):
        self(newlines=True)
        self.jquery(JQUERY_VERSION)
        self.js('//ajax.googleapis.com/ajax/libs/jqueryui/{}/jquery-ui.min.js'.format(JQUERYUI_VERSION))
        self.js_stamped(flask.url_for('qiki_javascript', filename='jquery.hotkeys.js'))
        self.js_stamped(flask.url_for('qiki_javascript', filename='qoolbar.js'))
        return self

    @classmethod
    def os_path_from_url(cls, url):
        url_parse = Parse(url)
        if url_parse.remove_prefix(flask.url_for('static', filename='')):
            return os_path_static(url_parse.remains)
        elif url_parse.remove_prefix(flask.url_for('qiki_javascript', filename='')):
            return os_path_qiki_javascript(url_parse.remains)
        else:
            raise RuntimeError("Unrecognized url " + url)


@flask_app.template_filter('cache_bust')
def cache_bust(s):
    return FlikiHTML.url_stamp(s)


@flask_app.route('/', methods=('GET', 'HEAD'))
def home_or_root_directory():
    return contribution_home()


@flask_app.route('/home', methods=('GET', 'HEAD'))
def home_subdirectory():
    return unslumping_home_obsolete()


@flask_app.route('/meta/contrib', methods=('GET', 'HEAD'))
def meta_contrib():
    return contribution_home()


def contribution_home():
    t_start = time.time()
    auth = AuthFliki()
    # auth.hit(auth.current_path)   Suppress early churn
    if auth.is_enough_anonymous_patience(MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS):
        with FlikiHTML('html') as html:
            with html.header("Unslumping") as head:
                head.css_stamped(auth.static_url('code/contribution.css'))
                head.css('https://fonts.googleapis.com/css?family=Literata&display=swap')
            html.body("Loading...")
            with html.footer() as foot:
                foot.js('https://cdn.jsdelivr.net/npm/sortablejs@1.9.0/Sortable.js')
                foot.js('https://cdn.jsdelivr.net/npm/jquery-sortablejs@1.0.0/jquery-sortable.js')
                foot.js_stamped(auth.static_url('code/contribution.js'))
                with foot.script() as script:
                    # script.raw_text('contribution = ' + contribution_json(auth) + ';\n')
                    monty = dict(
                        me_idn=auth.qiki_user.idn.qstring(),
                        me_txt=auth.qiki_user.txt,
                        is_anonymous=auth.is_anonymous,
                        URL_HERE=auth.current_url,
                        AJAX_URL=AJAX_URL,
                        IDN=IDN.dictionary_of_qstrings(),
                        NOW=float(time_lex.now_word().num),
                        login_html=auth.login_html(),
                        order=cat_cont_order(auth),
                        WHAT_IS_THIS_THING="unslumping",
                        # order.cat - list of categories in order
                        # order.cont - dict by category of lists of contributions in order
                        words=cat_cont_words(auth),
                        # words.cat - dict by category of category words
                        # words.cont - list of contribution words
                    )
                    script.raw_text('var MONTY = {json};\n'.format(
                        json=json_encode(
                            monty,
                            indent=4,
                            sort_keys=True,
                        )
                    ))
                    script.raw_text('js_for_contribution(window, jQuery, qoolbar, MONTY);\n')
    t_end = time.time()
    print("/meta/contrib {:.3f} sec".format(t_end - t_start))
    return html.doctype_plus_html()


# TODO:  New sections:
#        my unslumping - what I've entered, or dragged here, and not deleted
#            Enter or drag stuff here that you find inspires you out of a slump.
#        other's unslumping - entered by logged in users, and not dragged to my stuff
#        anonymous unslumping - entered anonymously, and not dragged to my stuff
#        trash
#        spam
#        |____| (your category name here)

def cat_cont_words(auth):
    lex = auth.lex

    lex_category_verbs = lex.find_words(
        idn = (IDN.CAT_MY, IDN.CAT_THEIR, IDN.CAT_ANON, IDN.CAT_TRASH),
        # sbj=IDN.LEX,   # but this may include obsolete mine, thine
        # vrb=IDN.DEFINE,
        # obj=IDN.CATEGORY
    )
    user_category_verbs = lex.find_words(
        sbj=auth.qiki_user,
        vrb=IDN.DEFINE,
        obj=IDN.CATEGORY,
    )
    category_verbs = lex_category_verbs + user_category_verbs
    interesting_verbs = category_verbs + [lex[IDN.CAPTION]]

    # resource_nouns = lex.find_words(obj=IDN.RESOURCE)
    contributed_resources = lex.find_words(
        vrb=IDN.CONTRIBUTE,
        # obj=resource_nouns,   # this could be huge, so not helpful
        jbo_vrb=interesting_verbs,
        jbo_ascending=True,
    )

    do_grandfathering = True
    if do_grandfathering:
        contributed_resources += lex.find_words(
            vrb=IDN.UNSLUMP_OBSOLETE,
            jbo_vrb=interesting_verbs,
            jbo_ascending=True,
        )

    vetted_words = vet(contributed_resources, auth)

    # vetted_words.sort(key=lambda word: -word.idn)   (order handled elsewhere

    return dict(
        cat={w.idn.qstring() : w for w in category_verbs},
        cont=vetted_words,
    )


def vet(words, auth):
    """Filter out illicit words:  anonymous contributions from other anonymous users."""
    sbj_warnings = set()

    if auth.is_anonymous:

        def allowed_word(word):
            try:
                is_logged_in = not word.sbj.is_anonymous
            except AttributeError:
                if word.sbj.idn == IDN.LEX:
                    # NOTE:  This test is buried because sbj=lex words are expected to be rare.
                    return True
                sbj = auth.idn(word.sbj)
                if sbj not in sbj_warnings:
                    sbj_warnings.add(sbj)
                    print("sbj", sbj, "is neither user nor lex, starting with", repr(word))
                return False

            return is_logged_in or word.sbj == auth.qiki_user

        vetted_words = [w for w in words if allowed_word(w)]
        n_removed = len(words) - len(vetted_words)
        if n_removed > 0:
            print("Vetting removed", n_removed, "words")
    else:
        vetted_words = words
    return vetted_words


def cat_cont_order(auth):
    """
    Determine order of categories and contributions.

    (1) error messages marked may be untestable
    """

    cat_order = [
        auth.lex.IDN.CAT_MY,
        auth.lex.IDN.CAT_THEIR,
        auth.lex.IDN.CAT_ANON,
        auth.lex.IDN.CAT_TRASH,
        # TODO:  user-defined categories
    ]
    cont_order = dict()   # dictionary of contribution lists, keyed by category
    cat_from_cont = dict()  # current category of each contribution
    error_messages = list()

    words = vet(auth.lex.find_words(), auth)

    for word in words:

        def error(*args):
            error_messages.append(" ".join(str(arg) for arg in args))

        def cat_room(cat):
            cat = auth.idn(cat)
            if cat not in cont_order:
                cont_order[cat] = []

        def add_cont(cat, cont, insert_index):
            cat = auth.idn(cat)
            cont = auth.idn(cont)
            if cat not in cat_order:  error("CAT", cat, "unknown"); return   # (1)
            cat_from_cont[cont] = cat
            cat_room(cat)
            cont_order[cat].insert(insert_index, cont)

        def remove_cont(cont):
            cont = auth.idn(cont)
            if cont not in cat_from_cont:  error("CAT unrecorded for", cont); return
            old_cat = cat_from_cont[cont]
            if old_cat not in cont_order:  error("CAT", old_cat, "has no contribution list"); return   # (1)
            if cont not in cont_order[old_cat]:  error("CAT", old_cat, "lost", cont); return   # (1)
            cont_order[old_cat].remove(cont)

        def index_cont(cat, cont):
            cat = auth.idn(cat)
            cont = auth.idn(cont)
            cat_room(cat)
            if cont == auth.lex.IDN.FENCE_POST_RIGHT:
                return len(cont_order[cat])
            try:
                return cont_order[cat].index(cont)
            except ValueError:
                error("Reorder point", cont, "missing from", cat)
                return 0   # desperate fallback to leftmost position, when reorder location makes no sense

        if word.vrb.idn in (auth.lex.IDN.CONTRIBUTE, auth.lex.IDN.UNSLUMP_OBSOLETE):
            if word.sbj == auth.qiki_user:
                add_cont(auth.lex.IDN.CAT_MY, word, 0)
            elif isinstance(word.sbj, AnonymousQikiListing.AnonymousQikiUser):
                add_cont(auth.lex.IDN.CAT_ANON, word, 0)
            else:
                add_cont(auth.lex.IDN.CAT_THEIR, word, 0)
        elif word.vrb.idn in cat_order:
            if word.sbj == auth.qiki_user:
                remove_cont(word.obj)
                add_cont(word.vrb, word.obj, index_cont(word.vrb, word.num))

    order_dict = dict(cat=cat_order, cont=cont_order)
    if len(error_messages) > 0:
        order_dict['error_messages'] = error_messages
    return order_dict


def unslumping_home_obsolete():
    auth = AuthFliki()
    lex = auth.lex
    auth.hit(auth.current_path)   # e.g. "/home"
    with FlikiHTML('html') as html:
        head = html.header("Ump The Former")
        head.css_stamped(auth.static_url('code/contribution.css'))
        head.style('''
            /** Vestigial stuff for unslumping_home_obsolete() **/
            .deleted_hide,
            .spam_hide,
            .anonymous_hide {
                display: none;
            }
            input:disabled + label {
                color: #AAAAAA;
            }
            /* THANKS:  Disabled label, https://stackoverflow.com/a/19363036/673991 */
        \n''')

        with html.body() as body:
            with body.div(id='login-prompt') as div_login:
                div_login.raw_text(auth.login_html())
            body.div(id='my-qoolbar')
            body.div(id='status')

            is_allowable_throughput = True
            if auth.is_anonymous:
                wait = seconds_until_anonymous_question()
                if wait > 0:
                    is_allowable_throughput = False
                    between = MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS
                    ago = between - wait
                    body.div.text(
                        "Oops, this site only supports anonymous views every {between:.0f} seconds. "
                        "Someone was here just {ago:.0f} seconds ago. "
                        "Please try again in {wait:.0f} seconds.".format(
                            between=float(between),
                            wait=float(wait),
                            ago=float(ago),
                        )
                    )
                    # TODO:  Change "Someone" to "You" if it was (use cookies)
                else:
                    anonymous_question_happened()

            if is_allowable_throughput:
                with body.div(id='my_ump', class_='target-environment') as my_ump:
                    my_ump.h2("Stuff you find inspiring")
                    my_contributions = my_ump.div(id='my_contributions')
                    with my_contributions.div(id='box_ump', class_='container-entry') as box_ump:
                        box_ump.textarea(id='text_ump', placeholder="a quote")
                        box_ump.br()
                        box_ump.button(id='enter_ump').text("save")

                with body.div(id='their_ump', class_='target-environment') as their_ump:
                    their_ump.h2("Stuff others find inspiring")
                    with their_ump.p(class_='show-options') as show_options:
                        show_options.text("show ")

                        anon_input = show_options.input(id='show_anonymous', type='checkbox')
                        anon_label = show_options.label(for_='show_anonymous').text("anonymous")

                        show_options.char_name('nbsp')
                        show_options.text(" ")

                        show_options.input(id='show_deleted', type='checkbox')
                        show_options.label(for_='show_deleted', title="if you deleted it").text("deleted")

                        show_options.char_name('nbsp')
                        show_options.text(" ")

                        show_options.input(id='show_spam', type='checkbox')
                        show_options.label(for_='show_spam', title="if anybody tags something spam").text("spam")
                    their_contributions = their_ump.div(id='their_contributions')

                    if auth.is_anonymous:
                        anon_input(disabled='disabled')
                        anon_label(title='Logged-in users can see anonymous contributions.')
                    else:
                        pass
                        # anon_input(checked='checked')
                        # NOTE:  authenticated user, checkbox to see anonymous content defaults OFF

                unslumps = lex.find_words(vrb=IDN.DEFINE, txt=u'unslump')
                uns_words = lex.find_words(
                    vrb=unslumps,
                    jbo_vrb=auth.qoolbar.get_verbs(),
                    obj=lex[lex],
                    idn_ascending=False,
                    jbo_ascending=True,
                )

                # body.p("unslumps: {}".format(repr(unslumps)))
                # EXAMPLE:  unslumps: [Word('unslump'), Word('unslump')]
                # body.p("uns_words: {}".format(repr(uns_words)))
                # EXAMPLE:  uns_words: [Word(956), Word(953), Word(947), Word(882)]

                # TODO:  Send these as json instead?  Construct in unslump.js?
                #        Ooh, imagine a long-poll where new contributions would show up as
                #        a "show new stuff" button!!
                for uns_word in uns_words:
                    is_my_contribution = uns_word.sbj == auth.qiki_user

                    # body.p("{me_or_they}({they_idn}, {they_lex_class}) "
                    #        "unslumped by {uns_idn}: {uns_txt:.25s}...".format(
                    #     they_idn=uns_word.sbj.idn.qstring(),
                    #     they_lex_class=type_name(uns_word.sbj.lex),
                    #     me_or_they="me" if is_me else "they",
                    #     uns_idn=uns_word.idn,
                    #     uns_txt=str(uns_word.txt),
                    # ))
                    # EXAMPLE:
                    #     they(0q82_A7__8A05F9A0A1873A14BD1C_1D0B00, GoogleQikiListing)
                    #         unslumped by 0q83_03BC: It is interesting to cont...
                    #     me(0q82_A7__8A059E058E6A6308C8B0_1D0B00, GoogleQikiListing)
                    #         unslumped by 0q83_03B9: profound...
                    #     they(0q82_A8__82AB_1D0300, AnonymousQikiListing)
                    #         unslumped by 0q83_03B3: Life has loveliness to se...
                    #     me(0q82_A7__8A059E058E6A6308C8B0_1D0B00, GoogleQikiListing)
                    #         unslumped by 0q83_0372: pithy...

                    is_me_anon = auth.qiki_user.is_anonymous
                    try:
                        is_they_anon = uns_word.sbj.is_anonymous
                    except AttributeError:
                        print("USER WORD WITHOUT is_anonymous member", repr(uns_word.sbj))
                        is_they_anon = True

                    short_d, long_d = short_long_description(uns_word.sbj)

                    def add_container(parent, class_):
                        parent.text(" ")

                        container_classes = ['container', 'word', class_]
                        if is_they_anon:
                            container_classes += ['anonymous', 'anonymous_hide']

                        with parent.div(classes=container_classes) as this_container:
                            with this_container.div(class_='contribution') as contribution:
                                contribution.text(str(uns_word.txt))
                            with this_container.div(class_='caption', title=long_d) as contribution_caption:
                                with contribution_caption.span(class_='grip') as grip:
                                    grip.text(
                                        UNICODE.VERTICAL_ELLIPSIS +
                                        UNICODE.VERTICAL_ELLIPSIS +
                                        " "   # TODO:  Make this a margin instead.
                                    )
                                contribution_caption.text(short_d)
                            return this_container

                    if is_my_contribution:
                        container = add_container(my_contributions, 'mine')
                        # my_contributions.text(" ")
                        # with my_contributions.div(class_='container word') as container:
                        #     container.div(class_='contribution mine').text(str(uns_word.txt))
                    else:
                        if is_me_anon and is_they_anon:
                            container = None
                            # NOTE:  Don't expose anonymous contributions to OTHER
                            #        anonymous users' browsers.
                            #        (But anons should see their own contributions)
                        else:
                            container = add_container(their_contributions, 'thine')

                    if container is not None:
                        container(
                            **({
                                'data-idn': uns_word.idn.qstring(),
                                'data-jbo': json_from_words(uns_word.jbo),
                            })
                        )

                foot = body.footer()
                foot.js('https://cdn.jsdelivr.net/npm/sortablejs@1.9.0/Sortable.js')
                foot.js('https://cdn.jsdelivr.net/npm/jquery-sortablejs@1.0.0/jquery-sortable.js')
                foot.js_stamped(auth.static_url('code/unslump.js'))
                with foot.script() as script:
                    script.raw_text('\n')
                    monty = dict(
                        me_idn=auth.qiki_user.idn.qstring(),
                        AJAX_URL=AJAX_URL,
                        IDN_LEX=lex[lex].idn.qstring(),
                    )
                    script.raw_text('var MONTY = {json};\n'.format(json=json.dumps(
                        monty,
                        sort_keys=True,
                        indent=4,
                    )))
                    script.raw_text('js_for_unslumping(window, window.$, MONTY);\n')

    return html.doctype_plus_html()


def short_long_description(user_word):
    try:
        user_naming_txt = user_word.txt
    except (IndexError, AttributeError):
        user_naming_txt = "(unknown contributor)"

    short_description = user_naming_txt

    if isinstance(user_word.lex, AnonymousQikiListing):
        long_description = "Anonymous user {ip_address}".format(ip_address=user_naming_txt)
    elif isinstance(user_word.lex, GoogleQikiListing):
        long_description = "Google user {googly_name}".format(googly_name=user_naming_txt)
    else:
        long_description = "User lex class {lex_class} user {user_txt}".format(
            lex_class=type_name(user_word.lex),
            user_txt=user_naming_txt
        )

    return short_description, long_description


@flask_app.route('/meta/raw', methods=('GET', 'HEAD'))
def meta_raw():

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
            if meta_idn == IDN.ANONYMOUS_LISTING:
                num_anon += 1
            elif meta_idn == IDN.GOOGLE_LISTING:
                num_google += 1
    t_loop = time.time()
    response = valid_response('words', words)
    t_end = time.time()
    print(
        "RAW LEX TIMING,",
        auth.lex.query_count - qc_start,
        "queries,",
        len(words),
        "words,",
        "{:.3f} + {:.3f} + {:.3f} = {:.3f}".format(
            t_find - t_start,
            t_loop - t_find,
            t_end - t_loop,
            t_end - t_start,
        ),
        "sec,",
        len(response) // 1000,
        "Kbytes,",
        num_suffixed,
        "suffixed",
        num_anon,
        "anon",
        num_google,
        "google",
    )
    return flask.Response(response, mimetype='application/json')
    # THANKS:  Flask mime type, https://stackoverflow.com/a/11774026/673991
    # THANKS:  JSON mime type, https://stackoverflow.com/a/477819/673991


@flask_app.route('/meta/lex', methods=('GET', 'HEAD'))
def meta_lex():

    auth = AuthFliki()
    if not auth.is_online:
        return "lex offline"
    if auth.is_anonymous:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Omit anonymous content for anonymous users (except their own).

    t_start = time.time()
    qc_start = auth.lex.query_count
    with FlikiHTML('html') as html:
        html.header("Lex")

        with html.body(class_='target-environment', newlines=True) as body:
            body.div(id='login-prompt').raw_text(auth.login_html())
            # body.button(id='toggle_idn')

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
                # return idn
                # return idn.hex()
                return idn.raw

            class Z(object):
                IP_ADDRESS_TAG = z(IDN.IP_ADDRESS_TAG)
                NAME           = z(IDN.NAME)
                ICONIFY        = z(IDN.ICONIFY)
                USER_AGENT_TAG = z(IDN.USER_AGENT_TAG)

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

                    if isinstance(word.sbj.lex, qiki.Listing):
                        listing_log(
                            word.sbj,
                            meta_idn=word.sbj.lex.meta_word.idn.qstring(),
                            is_anonymous=word.sbj.is_anonymous,
                            lex_class=type_name(word.sbj.lex),
                            word_class=word.sbj.lex.word_class.__name__,
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
                        listing_log(
                            word.sbj,
                            user_agent=word.txt,
                            browser=ua.browser,
                            platform=ua.platform,
                        )

            t_lex = time.time()
            qc_foot = auth.lex.query_count
            with body.footer() as foot:
                foot.js_stamped(auth.static_url('code/d3.js'))
                foot.js_stamped(auth.static_url('code/meta_lex.js'))
                with foot.script() as script:
                    script.raw_text('\n')
                    monty = dict(
                        IDN=IDN.dictionary_of_qstrings(),
                        LISTING_WORDS=listing_dict,
                        NOW=float(time_lex.now_word().num),
                        URL_HERE=auth.current_url,
                        URL_PREFIX_QUESTION=url_from_question(''),
                    )
                    script.raw_text('var MONTY = {json};\n'.format(json=json.dumps(
                        monty,
                        sort_keys=True,
                        indent=4,
                    )))
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


@flask_app.route('/meta/all', methods=('GET', 'HEAD'))
def meta_all():
    # TODO:  verb filter checkboxes (show/hide each one, especially may want to hide "questions")

    auth = AuthFliki()
    if not auth.is_online:
        return "meta offline"
    if auth.is_anonymous:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Instead of rejecting all anonymous-user viewing,
        #        maybe just omit anonymous-content.
        #        That is, where sbj.lex.meta_word.txt == 'anonymous'

    lex = auth.lex
    browse_verb = lex[IDN.BROWSE]

    with FlikiHTML('html') as html:
        html.header("Lex all")

        with html.body(class_='target-environment') as body:
            with body.p() as p:
                p.raw_text(auth.login_html())

            qc_start = lex.query_count
            t_start = time.time()
            words = lex.find_words()
            t_find_words = time.time()
            qc_find_words = lex.query_count

            words = list(words)[ : ]
            all_subjects = {word.sbj for word in words}



            def limbo_idns():
                for word in words:
                    for sub_word in (word.sbj, word.vrb, word.obj):
                        if sub_word.lex.__class__.__name__ == 'ListingLimbo':
                            yield sub_word.idn

            limbo_set = set(list(limbo_idns()))

            with body.pre() as pre:
                for limbo_idn in sorted(limbo_set):
                    pre.text("Limbo {idn}\n".format(idn=limbo_idn))



            lex_words = lex.find_words(txt='lex')
            define_words = lex.find_words(txt='define')
            listing_words = lex.find_words(txt='listing')
            with body.pre() as pre:
                if len(lex_words) != 1:
                    for word in lex_words:
                        pre.text("lex: {}\n".format(word.idn))
                if len(define_words) != 1:
                    for word in define_words:
                        pre.text("define: {}\n".format(word.idn))
                if len(listing_words) != 1:
                    for word in listing_words:
                        pre.text("listing: {}\n".format(word.idn))
            # Could loop through and beknight words that either use the first lex & define
            # or at that moment lex and define aren't defined yet
            # then later the strings have to be consistent



            def latest_iconifier_or_none(s):
                iconifiers = lex.find_words(obj=s, vrb=IDN.ICONIFY)
                try:
                    return iconifiers[-1]
                except IndexError:
                    return None

            subject_icons_nones = {s: latest_iconifier_or_none(s) for s in all_subjects}
            subject_icons = {s: i for s, i in subject_icons_nones.items() if i is not None}
            # print("Subject icons", repr(subject_icons))
            # EXAMPLE:  Subject icons {
            #     Word('user'): Word(338),
            #     Word(0q82_A7__8A059E058E6A6308C8B0_1D0B00): Word(864)
            # }

            def word_identification(w):
                w_idn = w.idn.qstring()
                if not w.idn.is_suffixed() and w.idn.is_whole():
                    w_idn += " ({})".format(render_num(w.idn))
                w_idn += " " + w.lex.__class__.__name__
                return w_idn

            def word_identification_text(w):
                return "{idn}: {txt}".format(
                    idn=word_identification(w),
                    txt=safe_txt(w),
                )

            def show_sub_word(element, w, title_prefix="", **kwargs):
                if w.obj == browse_verb:
                    w_txt = "session #" + str(native_num(w.idn))
                elif w.vrb is not None and w.vrb.obj == browse_verb:
                    w_txt = "hit #" + str(native_num(w.idn))
                else:
                    w_txt = compress_txt(safe_txt(w))
                return show_sub_word_txt(element, w, w_txt, title_prefix=title_prefix, **kwargs)

            def show_sub_word_txt(element, w, w_txt, title_prefix="", a_href=None, **kwargs):
                """Diagram a sbj, vrb, or obj."""
                with element.span(**kwargs) as span_sub_word:
                    if a_href is None:
                        inner = span_sub_word
                    else:
                        inner = span_sub_word.a(
                            href=a_href,
                            target='_blank',
                        )

                    if w in subject_icons:
                        inner.img(
                            src=subject_icons[w].txt,
                            title=title_prefix + word_identification_text(w)
                        )
                        # NOTE:  w.__class__.__name__ == 'WordDerivedJustForThisListing'
                    else:
                        classes = ['named']
                        if isinstance(w.lex, AnonymousQikiListing):
                            classes.append('anonymous')
                        elif w.idn == IDN.LEX:
                            classes.append('lex')
                        with inner.span(classes=classes) as span_named:
                            span_named(w_txt, title=title_prefix + word_identification(w))
                    return span_sub_word

            def quoted_compressed_txt(element, txt):
                element.char_name('ldquo')
                element.text(compress_txt(txt))
                element.char_name('rdquo')

            def show_iconify_obj(element, word, title_prefix=""):
                show_sub_word(element, word.obj, class_='wrend obj vrb-iconify', title_prefix=title_prefix)
                with element.span(class_='txt') as span_txt:
                    span_txt.text(" ")
                    span_txt.img(src=word.txt, title="txt = " + compress_txt(word.txt))

            def show_question_obj(element, word, title_prefix=""):

                if word.obj.txt == '':
                    show_sub_word(element, word.obj, class_='wrend obj vrb-question', title_prefix=title_prefix)
                else:
                    show_sub_word(
                        element,
                        word.obj,
                        class_='wrend obj vrb-question',
                        title_prefix=title_prefix,
                        a_href=url_from_question(word.obj.txt)
                    )

                if word.txt != '':   # When vrb=question_verb, txt was once the referrer.
                    if word.txt == auth.current_url:
                        element.span(" (here)", class_='referrer', title="was referred from here")
                    elif word.txt == url_from_question(word.obj.txt):
                        element.span(" (self)", class_='referrer', title="was referred from itself")
                    else:
                        # TODO:  Remove these crufty if-clauses,
                        #        because the referrer url is now stored in the txt
                        #        of a separate referrer_verb word that objectifies the hit
                        element.text(" ")
                        with element.a(
                            href=word.txt,
                            title="referrer",
                            target='_blank',
                        ) as a:
                            a.span("(ref)", class_='referrer')

            def show_num(element, word):
                if word.num != qiki.Number(1):
                    with element.span(class_='num', title="num = " + word.num.qstring()) as num_span:
                        num_span.text(" ")
                        num_span.char_name('times')
                        num_span.text(render_num(word.num))

            def show_txt(element, word):
                if word.txt != '':
                    if word.vrb == auth.lex[IDN.REFERRER]:
                        if word.txt == url_from_question(word.obj.obj.txt):
                            with element.span(class_='referrer', title="was referred from itself") as ref_span:
                                ref_span.text(" (self)")
                            return
                        if word.txt == auth.current_url:
                            with element.span(class_='referrer', title="was referred from here") as ref_span:
                                ref_span.text(" (here)")
                            return
                    with element.span(class_='txt') as txt_span:
                        txt_span.text(" ")
                        quoted_compressed_txt(txt_span, word.txt)

            body.comment(["My URL is", auth.current_url])
            with body.ol(class_='lex-list') as ol:
                last_whn = None
                first_word = True
                ago_lex = AgoLex()

                t_loop = time.time()
                t_words = list()

                for word in words:
                    if first_word:
                        first_word = False
                        delta = None
                        extra_class = ''
                    else:
                        delta = DeltaTimeLex()[last_whn](u'differ')[word.whn]
                        extra_class = ' delta-' + delta.units_long
                    with ol.li(
                        value=render_num(word.idn),   # the "bullet" of the list
                        title="idn = " + word.idn.qstring(),
                        class_='srend' + extra_class,
                    ) as li:
                        if delta is not None:
                            units_class = delta.units_long
                            if 0.0 < delta.num < 1.0:
                                units_class = 'subsec'
                            with li.span(class_='delta-triangle ' + units_class) as triangle:
                                triangle(title=delta.description_long)
                                triangle.text(UNICODE.BLACK_RIGHT_POINTING_TRIANGLE)
                            with li.span(class_='delta-amount ' + units_class) as amount:
                                amount.text(delta.amount_short + delta.units_short)

                        show_sub_word(li, word.sbj, class_='wrend sbj', title_prefix= "sbj = ")

                        show_sub_word(li, word.vrb, class_='wrend vrb', title_prefix="vrb = ")

                        if word.vrb.txt == 'iconify':
                            show_iconify_obj(li, word, title_prefix="obj = ")
                        elif word.vrb == auth.lex[IDN.QUESTION_OBSOLETE]:
                            show_question_obj(li, word, title_prefix="obj = ")
                        elif word.vrb.obj == browse_verb:
                            show_question_obj(li, word, title_prefix="obj = ")
                        else:
                            show_sub_word(li, word.obj, class_='wrend obj', title_prefix="obj = ")
                            show_num(li, word)
                            show_txt(li, word)

                        li.span(" ")
                        ago = ago_lex.describe(word.whn)
                        with li.span(
                            title="whn = " + ago.description_longer,   # e.g. "34.9 hours ago: 2019.0604.0459.02"
                            class_='whn ' + ago.units_long,       # e.g. "hours"
                        ) as whn_span:
                            whn_span.text(ago.description_short)       # e.g. "35h"
                        last_whn = word.whn

                    t_now = time.time()
                    t_elapsed = t_now - t_loop
                    t_loop = t_now
                    t_words.append(t_elapsed)

            body.footer()

    qc_loop = lex.query_count

    print(
        "ALL TIMING "
        "find {qc_find}:{t_find:.3f}, "
        "{n}*loop {qc_loop} : {t_min:.3f} / {t_max:.3f} / {t_avg:.3f}, "
        "total {t_total:.3f}".format(
            qc_find=qc_find_words - qc_start,
            t_find=t_find_words - t_start,
            qc_loop=qc_loop - qc_find_words,
            t_min=min(t_words),
            t_max=max(t_words),
            t_avg=sum(t_words)/len(t_words),
            t_total=t_loop - t_start,
            n=len(words),
        )
    )

    return html.doctype_plus_html()


def url_from_question(question_text):
    return flask.url_for('answer_qiki', url_suffix=question_text, _external=True)
    # THANKS:  Absolute url, https://stackoverflow.com/q/12162634/673991#comment17401215_12162726


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
def legacy_meta_all_words():
    """Primitive dump entire lex."""
    # NOTE:  The following logs itself, but that gets to be annoying:
    #            the_path = flask.request.url
    #            word_for_the_path = lex.define(path, the_path)
    #            me(browse)[word_for_the_path] = 1, referrer(flask.request)
    #        Or is it the viewing code's responsibility to filter out tactical cruft?

    auth = AuthFliki()
    if not auth.is_online:
        return "words offline"
    if auth.is_anonymous:
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
        return qiki_javascript(filename=url_suffix)
        # SEE:  favicon.ico in root, https://realfavicongenerator.net/faq#why_icons_in_root

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
        vrb=IDN.ANSWER,
        obj=auth.path_word,
        jbo_vrb=qoolbar_verbs,
        idn_ascending=False,
        jbo_ascending=True,
    )
    # TODO:  Alternatives to find_words()?
    #        answers = lex.find(vrb=answer, obj=auth.this_path,
    for a in answers:
        a.jbo_json = json_from_words(a.jbo)
        # print("Answer", repr(a), a.jbo_json)
        # EXAMPLE:  Answer Word(102) [
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q82_CF"},
        #    {"sbj": "0q82_A8__82AB_1D0300", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q82_D8"},
        #    {"sbj": "0q82_A8__82AB_1D0300", "vrb": "0q82_86", "txt": "", "num": 2, "idn": "0q83_0105"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 2, "idn": "0q83_0135"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 3, "idn": "0q83_017F"},
        #    {"sbj": "0q82_A7__8A059E058E6A6308C8B0_1D0B00", "vrb": "0q82_86", "txt": "", "num": 1, "idn": "0q83_0180"}
        # ]
        pictures = lex.find_words(vrb=IDN.ICONIFY, obj=a.sbj)
        picture = pictures[0] if len(pictures) >= 1 else None
        names = lex.find_words(vrb=IDN.NAME, obj=a.sbj)
        name = names[-1] if len(names) >= 1 else a.sbj.txt
        # TODO:  Get latest name instead of earliest name
        if picture is not None:
            author_img = "<img src='{url}' title='{name}' class='answer-author'>".format(url=picture.txt, name=name)
        elif name:
            author_img = "({name})".format(name=name)
        else:
            author_img = ""

        a.author = author_img
    question_words = lex.find_words(vrb=IDN.QUESTION_OBSOLETE, obj=auth.path_word)   # old hits
    session_words = lex.find_words(obj=IDN.BROWSE)
    hit_words = lex.find_words(vrb=session_words, obj=auth.path_word)   # new hits
    # TODO:  browses = lex.words(vrb_obj=WORD.BROWSE)
    # TODO:  browses = lex.jbo(session_words)
    # TODO:  browses = lex(obj=lex(vrb=WORD.BROWSE, obj=auth.this_path))
    # TODO:  browses = lex.find_words(obj=lex.find_words(vrb=WORD.BROWSE, obj=auth.this_path))
    render_question = youtube_render(url_suffix)
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


def youtube_render(url_suffix):
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
        # SEE:  https://developer.mozilla.org/en-US/docs/Web/HTTP/Feature_Policy#Browser_compatibility
        return six.text_type(iframe)
    else:
        return None


def json_from_words(words):
    """Convert a Python list of words to a JavaScript (json) array of word-like objects."""
    dicts = []
    for word in words:
        dicts.append(dict(
            idn=word.idn.qstring(),
            sbj=word.sbj.idn.qstring(),
            vrb=word.vrb.idn.qstring(),
            # NOTE:  The obj field is not needed when words come from jbo:
            #            obj=word.obj.idn.qstring(),
            #        ...because word.obj is itself.  That is, a.jbo[i].obj == a
            num=native_num(word.num),
            txt=word.txt
        ))
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

    auth = AuthFliki()
    if not auth.is_online:
        return invalid_response("ajax offline")

    t_start = time.time()
    qc_start = auth.lex.query_count

    lex = auth.lex
    action = None

    try:
        # flask_user, qiki_user = my_login()
        action = auth.form('action')
        if action == 'answer':
            question_path = auth.form('question')
            answer_txt = auth.form('answer')
            question_word = lex.define(IDN.PATH, question_path)
            auth.qiki_user(IDN.ANSWER)[question_word] = 1, answer_txt
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
            new_word = lex.create_word(
                sbj=auth.qiki_user,
                vrb=vrb,
                obj=obj,
                num=num,
                num_add=num_add,
                txt=txt,
                use_already=use_already,
            )
            return valid_response('new_words', json_from_words([new_word]))
        elif action == 'new_verb':
            new_verb_name = auth.form('name')
            new_verb = lex.create_word(
                sbj=auth.qiki_user,
                vrb=IDN.DEFINE,
                obj=IDN.VERB,
                txt=new_verb_name,
                use_already=True,
            )
            lex.create_word(
                sbj=auth.qiki_user,
                vrb=IDN.QOOL,
                obj=new_verb,
                num=NUM_QOOL_VERB_NEW,
                use_already=True,
            )
            return valid_response('idn', new_verb.idn.qstring())

        elif action == 'delete_verb':
            old_verb_idn = qiki.Number(auth.form('idn'))

            lex.create_word(
                sbj=auth.qiki_user,
                vrb=IDN.QOOL,
                obj=old_verb_idn,
                num=NUM_QOOL_VERB_DELETE,
                use_already=True,
            )
            return valid_response('idn', old_verb_idn.qstring())

        elif action == 'contribution_order':
            return valid_response('order', cat_cont_order(auth))

        elif action == 'anon_question':
            return valid_response('seconds', float(seconds_until_anonymous_question()))

        elif action == 'anon_answer':
            return valid_response('seconds', float(seconds_until_anonymous_answer()))

        else:
            return invalid_response("Unknown action " + action)

    except (KeyError, IndexError, ValueError) as e:
        # EXAMPLE:  werkzeug.exceptions.BadRequestKeyError
        # EXAMPLE:  qiki.word.LexSentence.CreateWordError
        # EXAMPLE:  fliki.AuthFliki.FormVariableMissing

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
        qc_end = auth.lex.query_count
        print(
            "Ajax {action}, {qc} queries, {t:.3f} sec".format(
                action=repr(action),
                qc=qc_end - qc_start,
                t=t_end - t_start
            )
        )


class WordEncoder(json.JSONEncoder):
    """Support JSON of qiki Word instances."""
    # TODO:  Unify with json_from_words()
    def default(self, w):
        if isinstance(w, qiki.WordListed):
            return dict(
                idn=w.idn.qstring(),
                index=w.index,
                txt=w.txt,
            )
        elif isinstance(w, qiki.Word):
            d = dict(
                idn=w.idn.qstring(),
                sbj=w.sbj.idn.qstring(),
                vrb=w.vrb.idn.qstring(),
                obj=w.obj.idn.qstring(),
                whn=float(w.whn),
            )

            if w.txt != "":
                d['txt'] = w.txt

            if w.num != 1:
                d['num'] = native_num(w.num)

            if isinstance(w.sbj, AnonymousQikiListing.AnonymousQikiUser):
                d['was_submitted_anonymous'] = True
                # NOTE:  Not bothering to clutter up other words with anon False

            if hasattr(w, 'jbo') and len(w.jbo) > 0:
                d['jbo'] = w.jbo

            return d
        elif isinstance(w, qiki.Number):
            return w.qstring()
        else:
            try:
                return super(WordEncoder, self).default(w)
            except TypeError:
                raise


def valid_response(name, value):
    return json_encode(dict([
        ('is_valid', True),
        (name, value)
    ]))


JSON_SEPARATORS_NO_SPACES = (',', ':')


def fix_dict(thing):
    if isinstance(thing, dict):
        for key, value in thing.items():
            if isinstance(key, qiki.Number):
                key = key.qstring()
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


def json_encode(dictionary, **kwargs):
    return json.dumps(
        dict(fix_dict(dictionary)),
        cls=WordEncoder,
        separators=JSON_SEPARATORS_NO_SPACES,
        allow_nan=False,
        **kwargs
        # NOTE:  If there APPEAR to be newlines when viewed in a browser,
        #        it may just be the browser wrapping lines on the commas.
    )


def invalid_response(error_message):
    return json.dumps(dict(
        is_valid=False,
        error_message=error_message,
    ))


def version_report():
    print(
        "Fliki {yyyy_mmdd_hhmm_ss}, "
        "git {git_sha_10}, "
        "Python {python_version}, "
        "Flask {flask_version}, "
        "qiki {qiki_version}".format(
            yyyy_mmdd_hhmm_ss=qiki.TimeLex().now_word().txt,
            git_sha_10=GIT_SHA_10,
            python_version=".".join(str(x) for x in sys.version_info),
            flask_version=flask.__version__,
            qiki_version=qiki.__version__,
        )
    )
    # EXAMPLES:
    #     Fliki 2019.0603.1144.11, git e74a46d9ed, Python 2.7.15.candidate.1, Flask 1.0.3, qiki 0.0.1.2019.0603.0012.15
    #     Fliki 2019.0603.1133.40, git a34d72cdc6, Python 2.7.16.final.0, Flask 1.0.2, qiki 0.0.1.2019.0603.0012.15


if __name__ == '__main__':
    '''Run locally, fliki.py spins up its own web server.'''
    flask_app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/


application = flask_app

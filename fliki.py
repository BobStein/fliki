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

import json
import logging
import os
import re
import sys

# print("Python version", ".".join(str(x) for x in sys.version_info))
# EXAMPLE:  Python version 2.7.15.candidate.1

# print("sys.path", "\n".join(sys.path))
# EXAMPLE:
#     /var/www/fun.unslumping.org/fliki   <-- SEE:  fun.unslumping.org-le-ssl.conf WSGIDaemonProcess
#     /usr/lib/python2.7
#     /usr/lib/python2.7/plat-x86_64-linux-gnu
#     /usr/lib/python2.7/lib-tk
#     /usr/lib/python2.7/lib-old
#     /usr/lib/python2.7/lib-dynload
#     /usr/local/lib/python2.7/dist-packages
#     /usr/lib/python2.7/dist-packages

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
GIT_SHA = git.Repo(SCRIPT_DIRECTORY).head.object.hexsha
GIT_SHA_10 = GIT_SHA[ : 10]
NUM_QOOL_VERB_NEW = qiki.Number(1)
NUM_QOOL_VERB_DELETE = qiki.Number(0)

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


class MyUnicode(object):
    RIGHT_ARROW = 0x2192
    BLACK_RIGHT_POINTING_TRIANGLE = 0x25B6


lex = qiki.LexMySQL(**secure.credentials.for_fliki_lex_database)
path = lex.noun(u'path')
question = lex.verb(u'question')
browse = lex.verb(u'browse')
answer = lex.verb(u'answer')

iconify_word = lex.verb(u'iconify')   # TODO:  Why in the world was this noun??   lex.noun('iconify')
name_word = lex.verb(u'name')   # TODO:  ffs why wasn't this a verb??

me = lex.define('agent', u'user')  # TODO:  Authentication
me(iconify_word, use_already=True)[me] = u'http://tool.qiki.info/icon/ghost.png'
qoolbar = qiki.QoolbarSimple(lex)


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


class GoogleFlaskUser(flask_login.UserMixin):
    """Flask_login model for a Google user."""

    def __init__(self, google_user_id):
        self.id = google_user_id


class GoogleQikiListing(qiki.Listing):

    def lookup(self, google_user_id):
        """
        Qiki model for a Google user.

        :param google_user_id:  a qiki.Number for the google user-id
        """
        idn = self.composite_idn(google_user_id)
        # EXAMPLE:  0q82_A7__8A059E058E6A6308C8B0_1D0B00

        namings = self.meta_word.lex.find_words(
            sbj=self.meta_word.lex[self.meta_word.lex],
            vrb=name_word,
            obj=idn
        )
        try:
            latest_naming = namings[0]
        except IndexError:
            the_name = "(unknown {})".format(idn)
        else:
            the_name = latest_naming.txt
        return the_name, qiki.Number(1)


class AnonymousQikiListing(qiki.Listing):

    def lookup(self, ip_address_idn):
        return lex[ip_address_idn].txt, qiki.Number(1)


# TODO:  Combine classes, e.g. GoogleUser(flask_login.UserMixin, qiki.Listing)
#        But this causes JSON errors because json can't encode qiki.Number.
#        But there are so many layers to the serialization for sessions there's probably a way.
#        Never found a way to do that in qiki.Number only, darn.
#        All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


listing = lex.noun(u'listing')

google_user = lex.define(listing, u'google user')
google_qiki_user = GoogleQikiListing(meta_word=google_user)

anonymous_user = lex.define(listing, u'anonymous')
anonymous_qiki_user = AnonymousQikiListing(meta_word=anonymous_user)

ip_address = lex.noun(u'IP address')


def is_qiki_user_anonymous(user_word):
    return isinstance(user_word.lex, AnonymousQikiListing)


def my_login():
    # XXX:  Objectify
    flask_user = flask_login.current_user
    assert isinstance(flask_user, werkzeug.local.LocalProxy)   # was flask_login.LocalProxy

    if flask_user.is_authenticated:
        qiki_user = google_qiki_user[flask_user.get_id()]
    elif flask_user.is_anonymous:
        # print(repr(flask_user), flask.request.remote_addr)
        # EXAMPLE:  <flask_login.mixins.AnonymousUserMixin object at 0x0000000004304D30> 127.0.0.1
        # EXAMPLE:  <flask_login.mixins.AnonymousUserMixin object at 0x7fd3fc2fda50> 173.20.2.109
        anonymous_identifier = lex.define(ip_address, txt=qiki.Text.decode_if_you_must(flask.request.remote_addr))
        qiki_user = anonymous_qiki_user[anonymous_identifier.idn]   # (flask.request.remote_addr)
        # FIXME:  This needs to use some random hash from a cookie in the idn too
        #         (in addition to the IP address), so e.g.
        #         anonymous users at the same IP address
        #         won't see each others' contributions.
        #         Anonymous users with no cookies could also be warned they won't
        #         be able to see their own contributions.
        #         Unless they sign up and "claim" them?  No can't allow them to claim them
        #         either, that will have to be cookie based too. They'll be forever anonymous.
    else:
        qiki_user = None
        logger.fatal("User is neither authenticated nor anonymous.")

    # try:
    #     user_idn = "idn " + qiki_user.idn.qstring()
    # except AttributeError:
    #     user_idn = ""
    # print("User is", end=" ")
    # print(len(str(qiki_user)), end=" ")
    # print("chars,", end=" ")
    # print(str(qiki_user), end=" ")
    # print(user_idn, end=" ")
    # print(qiki_user.lex.__class__.__name__, end=" ")
    # print(qiki_user.lex.meta_word.txt, end=" ")
    # print(qiki_user.lex.meta_word.idn.qstring(), end=" ")
    # print()
    # EXAMPLE:  User is 9 chars, Bob Stein idn 0q82_A7__8A059E058E6A6308C8B0_1D0B00 GoogleQikiUser google user 0q82_A7
    # EXAMPLE:  User is 9 chars, 127.0.0.1 idn 0q82_A8__82AB_1D0300 AnonymousQikiUser anonymous 0q82_A8
    # EXAMPLE:  User is 12 chars, 173.20.2.109 idn 0q82_16__8218_1D0300 AnonymousQikiUser anonymous 0q82_16

    # print("User is", str(qiki_user), user_idn)
    # TODO:  Why did this line crash sometimes?
    #        IOError: [Errno 22] Invalid argument
    #        May have happened after closing PyCharm to update, leaving fliki running.

    return flask_user, qiki_user


def log_link(flask_user, qiki_user, then_url):
    """
    Log in or out link.

    :param flask_user:
    :param qiki_user:
    :param then_url: e.g. the URL of some page displaying the login link.
    :return:
    """
    qiki_user_txt = qiki_user.txt

    set_then_url(then_url)
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

    if flask_user.is_authenticated:
        return (
            u"<a href='{logout_link}'>"
            u"logout"
            u"</a>"
            u" "
            u"{display_name}"
        ).format(
            display_name=qiki_user_txt,
            logout_link=flask.url_for('logout'),
        )
    elif flask_user.is_anonymous:
        return (
            u"<a href='{login_link}' title='{login_title}'>"
            u"login"
            u"</a>"
        ).format(
            login_title=u"You are " + qiki_user_txt,
            login_link=flask.url_for(u'login'),
            # login_link=flask.url_for('login', next=then_url),
            # login_link=flask.url_for('login', then_url=then_url),
            # NOTE:  Adding a parameter to the query string makes Authomatic.login()
            #        return None.
        )
    else:
        return "neither auth nor anon???"


@login_manager.user_loader
def user_loader(google_user_id_string):
    # print("user_loader", google_user_id_string)
    # EXAMPLE:  user_loader 103620384189003122864

    # try:
    #     new_qiki_user = google_qiki_user[qiki.Number(google_user_id_string)]
    # except qiki.Listing.NotFound:
    #     print("\t", "QIKI LISTING NOT FOUND")
    #     return None
    # else:
    #     # print("user idn", new_qiki_user.idn.qstring())
    #     # EXAMPLE:  idn 0q82_A7__8A059E058E6A6308C8B0_1D0B00

    new_flask_user = GoogleFlaskUser(google_user_id_string)
    # HACK:  Validate with google!!
    return new_flask_user


def referrer(request):
    this_referrer = request.referrer
    if this_referrer is None:
        return qiki.Text(u'')
    else:
        return qiki.Text.decode_if_you_must(this_referrer)


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
            # http://localhost.visibone.com:5000/meta/login?state=f45ad ... 4OKQ#

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
                qiki_user = google_qiki_user[login_result.user.id]
                picture_parts = urllib.parse.urlsplit(login_result.user.picture)
                picture_dict = urllib.parse.parse_qs(picture_parts.query)
                # THANKS:  Parse URL query-string, http://stackoverflow.com/a/21584580/673991
                picture_size_string = picture_dict.get('sz', ['0'])[0]
                avatar_width = qiki.Number(picture_size_string)   # width?  height?  size??
                avatar_url = login_result.user.picture
                display_name = login_result.user.name
                print("Logging in", qiki_user.index, qiki_user.idn.qstring())
                # EXAMPLE:   Logging in 0q8A_059E058E6A6308C8B0 0q82_15__8A059E058E6A6308C8B0_1D0B00
                lex[lex](iconify_word, use_already=True)[qiki_user.idn] = avatar_width, avatar_url
                lex[lex](name_word, use_already=True)[qiki_user.idn] = display_name
                flask_login.login_user(flask_user)
                # return flask.redirect(flask.url_for('play'))
                # then_url = flask.request.args.get('then_url', flask.url_for('home'))
                # then_url = flask.session.get('then_url', flask.url_for('home'))
                # print("Referrer", flask.request.referrer)   # None
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

    assert '/var/www/static/foo.bar' == os_path_static('foo.bar')
    """
    return os.path.join(SCRIPT_DIRECTORY, flask_app.static_folder, relative_url)


def os_path_qiki_javascript(relative_url):
    return os.path.join(SCRIPT_DIRECTORY, '..', 'qiki-javascript', relative_url)
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
        with self.head() as head:
            head.title(title)
            head.meta(charset='utf-8')
            head.link(
                rel='shortcut icon',
                href=flask.url_for('qiki_javascript', filename='favicon.ico')
            )
            head.css_stamped(flask.url_for('static', filename='code/css.css'))
            head.css_stamped(flask.url_for('qiki_javascript', filename='qoolbar.css'))
            return head

    def footer(self):
        self.jquery(JQUERY_VERSION)
        self.js('//ajax.googleapis.com/ajax/libs/jqueryui/{}/jquery-ui.min.js'.format(JQUERYUI_VERSION))
        self.js('//cdn.jsdelivr.net/jquery.cookie/1.4.1/jquery.cookie.js')
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


def what_do_we_show_as_the_home_page():
    return unslumping_home()
    # return "home page not available"


@flask_app.route('/home', methods=('GET', 'HEAD'))
def home_subdirectory():
    return unslumping_home()


def unslumping_home():
    flask_user, qiki_user = my_login()
    log_html = log_link(flask_user, qiki_user, then_url=flask.request.path)
    with FlikiHTML('html') as html:
        head = html.header("Unslumping")
        head.css_stamped(flask.url_for('static', filename='code/unslump.css'))

        with html.body() as body:
            with body.div(id='logging') as div:
                div.raw_text(log_html)
            body.div(id='my-qoolbar')
            body.div(id='status')

            with body.div(id='my_ump', class_='target-environment') as my_ump:
                my_ump.h2("Stuff you find inspiring")
                my_contributions = my_ump.div(id='their_contributions')
                with my_contributions.div(id='box_ump', class_='container entry') as box_ump:
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
                if flask_user.is_anonymous:
                    anon_input(disabled='disabled')
                    anon_label(title='Logged-in users can see anonymous contributions.')
                else:
                    pass
                    # anon_input(checked='checked')
            body.js_stamped(flask.url_for('static', filename='code/unslump.js'))

            unslumps = lex.find_words(vrb=lex[u'define'], txt=u'unslump')
            uns_words = lex.find_words(
                vrb=unslumps,
                jbo_vrb=qoolbar.get_verbs(),
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
                is_my_contribution = uns_word.sbj == qiki_user

                # body.p("{me_or_they}({they_idn}, {they_lex_class}) unslumped by {uns_idn}: {uns_txt:.25s}...".format(
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

                is_me_anon = is_qiki_user_anonymous(qiki_user)
                is_they_anon = is_qiki_user_anonymous(uns_word.sbj)
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

            monty = dict(
                me_idn=qiki_user.idn.qstring(),
                AJAX_URL=AJAX_URL,
                lex_idn=lex[lex].idn.qstring(),
            )
            foot = body.footer()
            with foot.script(newlines=True) as script:
                script.raw_text('var MONTY = {json};'.format(json=json.dumps(
                    monty,
                    sort_keys=True,
                    indent=4,
                    separators=(',', ': '),
                )))
                script.raw_text('js_for_unslumping(window, window.$, MONTY);')

    return html.doctype_plus_html()


def short_long_description(user_word):
    # namings = lex.find_words(obj=user_word, vrb=name_word)
    try:
        # user_naming_txt = namings[-1].txt
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


# noinspection PyPep8Naming
@flask_app.route('/meta/all', methods=('GET', 'HEAD'))
def meta_all():
    # TODO:  verb filter checkboxes (show/hide each one, especially may want to hide "questions")
    with FlikiHTML('html') as html:
        html.header("Lex all")

        with html.body(class_='target-environment') as body:

            words = lex.find_words()
            all_subjects = {word.sbj for word in words}

            def latest_iconifier_or_none(s):
                iconifiers = lex.find_words(obj=s, vrb=iconify_word)
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
                    w_idn += " ({:d})".format(int(w.idn))
                w_idn += " " + w.lex.__class__.__name__
                return w_idn

            def word_identification_text(w):
                return "{idn}: {txt}".format(
                    idn=word_identification(w),
                    txt=safe_txt(w),
                )

            def show_sub_word(element, w, title_prefix="", **kwargs):
                """Diagram a sbj, vrb, or obj."""
                with element.span(**kwargs) as span_sub_word:
                    w_txt = compress_txt(safe_txt(w))
                    if w in subject_icons:
                        span_sub_word.img(
                            src=subject_icons[w].txt,
                            title=title_prefix + word_identification_text(w)
                        )
                        # NOTE:  w.__class__.__name__ == 'WordDerivedJustForThisListing'
                    else:
                        classes = ['named']
                        if isinstance(w.lex, AnonymousQikiListing):
                            classes.append('anonymous')
                        elif isinstance(w.lex, qiki.Lex):
                            classes.append('lex')
                        with span_sub_word.span(classes=classes) as span_named:
                            span_named(w_txt, title=title_prefix + word_identification(w))
                    return span_sub_word

            MAX_TXT_LITERAL = 120
            BEFORE_DOTS = 80
            AFTER_DOTS = 20

            def compress_txt(txt):
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

            def show_txt(element, txt):
                element.char_name('ldquo')
                element.text(compress_txt(txt))
                element.char_name('rdquo')

            def show_vrb_iconify(element, word, title_prefix=""):
                show_sub_word(element, word.obj, class_='word obj', title_prefix=title_prefix)
                with element.span(class_='word txt') as span_txt:
                    span_txt.text(" ")
                    span_txt.img(src=word.txt, title="txt = " + compress_txt(word.txt))

            def url_from_question(question_text):
                if question == '':
                    return None
                else:
                    return flask.url_for('answer_qiki', url_suffix=question_text, _external=True)
                    # THANKS:  Absolute url, https://stackoverflow.com/q/12162634/673991#comment17401215_12162726

            def show_vrb_question(element, word, title_prefix=""):
                question_url = url_from_question(word.obj.txt)
                if question_url is None:
                    show_sub_word(element, word.obj, class_='word obj', title_prefix=title_prefix)
                else:
                    with element.a(
                        href=question_url,
                        target='_blank',
                    ) as a:
                        show_sub_word(a, word.obj, class_='word obj', title_prefix=title_prefix)

                if word.txt != '':   # When vrb=question, txt is the referrer.
                    if word.txt == flask.request.url:
                        element.span(" (here)", class_='referrer', title="was referred from here")
                    elif word.txt == question_url:
                        element.span(" (self)", class_='referrer', title="was referred from itself")
                    else:
                        element.text(" ")
                        with element.a(
                            href=word.txt,
                            title="referrer",
                            target='_blank',
                        ) as a:
                            a.span("(ref)", class_='referrer')

            body.p("Hello Whorled!")
            body.comment(["My URL is", flask.request.url])
            with body.ol as ol:
                last_whn = None
                first_word = True
                ago_lex = AgoLex()
                for word in words:
                    if first_word:
                        first_word = False
                        delta = None
                        extra_class = ''
                    else:
                        # _, delta_whn_description, delta_whn_class = whn_format(last_whn, word.whn)
                        delta = DeltaTimeLex()[last_whn](u'differ')[word.whn]
                        extra_class = ' delta-' + delta.units_long
                    with ol.li(
                        value=str(int(word.idn)),
                        title="idn = " + word.idn.qstring(),
                        class_='word-description' + extra_class,
                    ) as li:
                        if delta is not None:
                            units_class = delta.units_long
                            if 0.0 < delta.num < 1.0:
                                units_class = 'subsec'
                            with li.span(class_='delta-triangle ' + units_class) as triangle:
                                triangle(title=delta.description_long)
                                triangle.char_code(MyUnicode.BLACK_RIGHT_POINTING_TRIANGLE)
                            with li.span(class_='delta-amount ' + units_class) as amount:
                                amount.text(delta.amount_short + delta.units_short)
                        show_sub_word(li, word.sbj, class_='word sbj', title_prefix= "sbj = ")
                        li.span("-")
                        show_sub_word(li, word.vrb, class_='word vrb', title_prefix = "vrb = ")
                        li.span("-")

                        if word.vrb.txt == 'iconify':
                            show_vrb_iconify(li, word, title_prefix = "obj = ")
                        elif word.vrb.txt == 'question':
                            show_vrb_question(li.span(), word, title_prefix = "obj = ")
                        else:
                            show_sub_word(li, word.obj, class_='word obj', title_prefix = "obj = ")
                            if word.num != qiki.Number(1):
                                with li.span(class_='word num', title="num = " + word.num.qstring()) as span:
                                    span.text(" ")
                                    span.char_name('times')
                                    span.text(render_num(word.num))
                            if word.txt != '':
                                with li.span(class_='word txt') as span:
                                    span.text(" ")
                                    show_txt(span, word.txt)

                        li.span(" ")
                        # show_whn(li, word.whn, class_='word whn', title_prefix = "whn = ")
                        ago = ago_lex.describe(word.whn)
                        with li.span(
                            title="whn = " + ago.description_longer,   # e.g. "34.9 hours ago: 2019.0604.0459.02"
                            class_='word whn ' + ago.units_long,       # e.g. "hours"
                        ) as whn_span:
                            whn_span.text(ago.description_short)       # e.g. "35h"
                        last_whn = word.whn

            body.footer()

    return html.doctype_plus_html()


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
def meta_all_words():
    """Primitive dump entire lex."""
    # NOTE:  The following logs itself, but that gets to be annoying:
    #            the_path = flask.request.url
    #            word_for_the_path = lex.define(path, the_path)
    #            me(browse)[word_for_the_path] = 1, referrer(flask.request)
    #        Or is it the viewing code's responsibility to filter out tactical cruft?

    words = lex.find_words()
    logger.info("Lex has " + str(len(words)) + " words.")
    reports = []

    for word in words:
        reports.append(dict(
            i=int(word.idn),
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
    print("all done")
    response = flask.render_template(
        'meta.html',
        reports=reports,
        **config_dict
    )
    print("rendered")
    return response


def safe_txt(w):
    try:
        return w.txt
    except qiki.Word.NotAWord:
        return "[non-word {}]".format(w.idn.qstring())
    except qiki.Listing.NotAListing:
        return "[non-listing {}]".format(w.idn.qstring())


@flask_app.route('/', methods=('GET', 'HEAD'))
def home_or_root_directory():
    return what_do_we_show_as_the_home_page()


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
    flask_user, qiki_user = my_login()
    log_html = log_link(flask_user, qiki_user, then_url=flask.request.path)
    word_for_path = lex.define(path, qiki.Text.decode_if_you_must(url_suffix))

    if str(word_for_path) == 'favicon.ico':
        return qiki_javascript(filename=six.text_type(word_for_path))
        # SEE:  favicon.ico in root, https://realfavicongenerator.net/faq#why_icons_in_root

    qiki_user(question)[word_for_path] = 1, referrer(flask.request)

    # print("ANSWER", *[repr(w.idn) + " " + w.txt + ", " for w in qoolbar.get_verbs()])
    # EXAMPLE:  ANSWER Number('0q82_86') like,  Number('0q82_89') delete,  Number('0q83_01FC') laugh,

    question_words = lex.find_words(
        idn=word_for_path.idn,
        jbo_vrb=qoolbar.get_verbs(),
        jbo_ascending=True,
    )
    assert len(question_words) == 1
    question_word = question_words[0]
    question_jbo_json = json_from_words(question_word.jbo)
    answers = lex.find_words(
        vrb=answer,
        obj=word_for_path,
        jbo_vrb=qoolbar.get_verbs(),
        idn_ascending=False,
        jbo_ascending=True,
    )
    # TODO:  Alternatives to find_words()?
    #        answers = lex.find(vrb=answer, obj=word_for_path,
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
        pictures = lex.find_words(vrb=iconify_word, obj=a.sbj)
        picture = pictures[0] if len(pictures) >= 1 else None
        names = lex.find_words(vrb=name_word, obj=a.sbj)
        name = names[0] if len(names) >= 1 else a.sbj.txt
        # TODO:  Get latest name instead of earliest name
        if picture is not None:
            author_img = "<img src='{url}' title='{name}' class='answer-author'>".format(url=picture.txt, name=name)
        elif name:
            author_img = "({name})".format(name=name)
        else:
            author_img = ""

        a.author = author_img
    questions = lex.find_words(vrb=question, obj=word_for_path)
    render_question = youtube_render(url_suffix)
    if render_question is None:
        render_question = "Here is a page for '{}'".format(flask.escape(url_suffix))
    return flask.render_template(
        'answer.html',
        question=url_suffix,
        question_idn=word_for_path.idn.qstring(),
        question_jbo_json=question_jbo_json,
        answers=answers,
        len_answers=len(answers),
        len_questions=len(questions),
        me_idn=qiki_user.idn,
        log_html=log_html,
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
    return json.dumps(dicts, allow_nan=False)
    # TODO:  try-except OverflowError if NaN or Infinity got into dicts somehow.


def render_num(num):
    return str(native_num(num))


def native_num(num):
    if num.is_suffixed():
        # TODO:  Complex?
        return repr(num)
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
    flask_user, qiki_user = my_login()
    action = flask.request.form['action']
    if action == 'answer':
        question_path = flask.request.form['question']
        answer_txt = flask.request.form['answer']
        question_word = lex.define(path, question_path)
        qiki_user(answer)[question_word] = 1, answer_txt
        return valid_response('message', "Question {q} answer {a}".format(
            q=question_path,
            a=answer_txt,
        ))
    elif action == 'qoolbar_list':
        verbs = list(qoolbar.get_verb_dicts())

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
        form = flask.request.form

        try:
            obj_idn = form['obj_idn']
        except KeyError:
            return invalid_response("Missing obj")

        try:
            vrb_txt = form['vrb_txt']
        except KeyError:
            # TODO:  Should vrb_idn have priority over vrb_txt instead?
            try:
                vrb_idn = form['vrb_idn']
            except KeyError:
                return invalid_response("Missing vrb_txt and vrb_idn")
            else:
                vrb = lex[qiki.Number(vrb_idn)]
        else:
            # vrb = lex[vrb_txt]
            vrb = lex.verb(vrb_txt)
            # FIXME:  can we allow browser trash to define a verb?

        try:
            txt = form['txt']
        except KeyError:
            return invalid_response("Missing txt")

        use_already = form.get('use_already', False)

        obj = lex[qiki.Number(obj_idn)]
        num_add_str = form.get('num_add', None)
        num_str = form.get('num', None)
        try:
            num_add = None if num_add_str is None else qiki.Number(num_add_str)
            num = None if num_str is None else qiki.Number(num_str)
        except ValueError as e:
            return invalid_response("num or num_add invalid: " + str(e))
        else:
            new_word = lex.create_word(
                sbj=qiki_user,
                vrb=vrb,
                obj=obj,
                num=num,
                num_add=num_add,
                txt=txt,
                use_already=use_already,
            )
            return valid_response('new_words', json_from_words([new_word]))
    elif action == 'new_verb':
        try:
            new_verb_name = flask.request.form['name']
        except KeyError:
            return invalid_response("Missing name")
        new_verb = lex.create_word(
            sbj=qiki_user,
            vrb=lex[u'define'],
            obj=lex[u'verb'],
            txt=new_verb_name,
            use_already=True,
        )
        lex.create_word(
            sbj=qiki_user,
            vrb=lex[u'qool'],
            obj=new_verb,
            num=NUM_QOOL_VERB_NEW,
            use_already=True,
        )
        return valid_response('idn', new_verb.idn.qstring())

    elif action == 'delete_verb':
        try:
            old_verb_idn = qiki.Number(flask.request.form['idn'])
        except (KeyError, ValueError):
            return invalid_response("Missing or malformed idn: " + flask.request.form.get('idn', "(missing)"))

        lex.create_word(
            sbj=qiki_user,
            vrb=lex[u'qool'],
            obj=old_verb_idn,
            num=NUM_QOOL_VERB_DELETE,
            use_already=True,
        )
        return valid_response('idn', old_verb_idn.qstring())

    else:
        return invalid_response("Unknown action " + action)


def valid_response(name, value):
    return json.dumps(dict([
        ('is_valid', True),
        (name, value)
    ]))


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
            yyyy_mmdd_hhmm_ss=qiki.TimeLex()[qiki.Number.NAN].txt,
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
    flask_app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/


application = flask_app

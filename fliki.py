"""
fliki is a qiki implemented in Flask and Python.

Authentication courtesy of flask-login and authomatic.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
import json
import logging
import os
import re
import sys
import time

import authomatic
import authomatic.adapters
import authomatic.core
import authomatic.providers.oauth2
import flask   # , send_from_directory
import flask_login
import six
# noinspection PyUnresolvedReferences
import six.moves.urllib as urllib
import werkzeug.local

import qiki
import secure.credentials
import to_be_released.web_html as web_html


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '3.3.1'   # https://developers.google.com/speed/libraries/#jquery
JQUERYUI_VERSION = '1.12.1'   # https://developers.google.com/speed/libraries/#jquery-ui
config_names = ('AJAX_URL', 'JQUERY_VERSION', 'JQUERYUI_VERSION')
config_dict = {name: globals()[name.encode('ascii')] for name in config_names}


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

lex = qiki.LexMySQL(**secure.credentials.for_fliki_lex_database)
path = lex.noun('path')
question = lex.verb('question')
browse = lex.verb('browse')
answer = lex.verb('answer')

iconify_word = lex.noun('iconify')
name_word = lex.noun('name')

me = lex.define('agent', 'user')  # TODO:  Authentication
me(iconify_word, use_already=True)[me] = 'http://tool.qiki.info/icon/ghost.png'
qoolbar = qiki.QoolbarSimple(lex)


GOOGLE_PROVIDER = b'google'
authomatic_global = authomatic.Authomatic(
    {
        GOOGLE_PROVIDER: {
            b'class_': authomatic.providers.oauth2.Google,
            b'consumer_key': secure.credentials.google_client_id,
            b'consumer_secret': secure.credentials.google_client_secret,
            b'scope': authomatic.providers.oauth2.Google.user_info_scope + [b'https://gdata.youtube.com'],
            b'id': 42,
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
login_manager.init_app(flask_app)


class GoogleFlaskUser(flask_login.UserMixin):
    """Flask_login model for a Google user."""

    def __init__(self, google_user_id):
        self.id = google_user_id


class GoogleQikiUser(qiki.Listing):

    def lookup(self, google_user_id):
        """
        Qiki model for a Google user.

        :param google_user_id:  a qiki.Number for the google user-id
        """
        idn = self.composite_idn(google_user_id)
        # EXAMPLE:  0q82_A7__8A059E058E6A6308C8B0_1D0B00

        namings = self.meta_word.lex.find_words(
            sbj=self.meta_word.lex['lex'],
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


class AnonymousQikiUser(qiki.Listing):
    def lookup(self, ip_address_idn):
        return "anonymous " + lex[ip_address_idn].txt, qiki.Number(1)


# TODO:  Combine classes, e.g. GoogleUser(flask_login.UserMixin, qiki.Listing)
#        But this causes JSON errors because json can't encode qiki.Number.
#        But there are so many layers to the serialization for sessions there's probably a way.
#        Never found a way to do that in qiki.Number only, darn.
#        All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


listing = lex.noun('listing')

google_user = lex.define(listing, 'google user')
google_qiki_user = GoogleQikiUser(meta_word=google_user)

anonymous_user = lex.define(listing, 'anonymous')
anonymous_qiki_user = AnonymousQikiUser(meta_word=anonymous_user)

ip_address = lex.noun('IP address')


def my_login():
    # XXX:  Objectify
    flask_user = flask_login.current_user
    assert isinstance(flask_user, werkzeug.local.LocalProxy)   # was flask_login.LocalProxy
    if flask_user.is_authenticated:
        qiki_user = google_qiki_user[flask_user.get_id()]
    elif flask_user.is_anonymous:
        print(repr(flask_user), flask.request.remote_addr)
        anonymous_identifier = lex.define(ip_address, txt=qiki.Text.decode_if_you_must(flask.request.remote_addr))
        qiki_user = anonymous_qiki_user[anonymous_identifier.idn]   # (flask.request.remote_addr)
    else:
        qiki_user = None
        logger.fatal("User is neither authenticated nor anonymous.")
    print("User is", repr(flask_user))
    print("User is", str(qiki_user))
    return flask_user, qiki_user


def log_link(flask_user, qiki_user):
    """
    Log in or out link.

    :param flask_user:
    :param qiki_user:
    :return:
    """
    qiki_user_txt = qiki_user.txt
    if flask_user.is_authenticated:
        return (
            "<a href='{logout_link}'>"
            "logout"
            "</a>"
            " "
            "{display_name}"
        ).format(
            display_name=qiki_user_txt,
            logout_link=flask.url_for('logout'),
        )
    elif flask_user.is_anonymous:
        return (
            "<a href='{login_link}' title='{login_title}'>"
            "login"
            "</a>"
        ).format(
            login_title="You are " + qiki_user_txt,
            login_link=flask.url_for('login'),
        )
    else:
        return "neither auth nor anon???"


@login_manager.user_loader
def user_loader(google_user_id_string):
    print("user_loader", google_user_id_string)
    try:
        new_qiki_user = google_qiki_user[qiki.Number(google_user_id_string)]
    except qiki.Listing.NotFound:
        print("\t", "QIKI LISTING NOT FOUND")
        return None
    else:
        print("\t", "idn", new_qiki_user.idn.qstring())
        new_flask_user = GoogleFlaskUser(google_user_id_string)
        # HACK:  Validate with google!!
        return new_flask_user


def referrer(request):
    this_referrer = request.referrer
    if this_referrer is None:
        return qiki.Text('')
    else:
        return qiki.Text.decode_if_you_must(this_referrer)


@flask_app.route('/meta/logout', methods=('GET', 'POST'))
@flask_login.login_required
def logout():
    flask_login.logout_user()
    return flask.redirect(flask.url_for('play'))


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
                # THANKS:  Parse URL query, http://stackoverflow.com/a/21584580/673991
                picture_size_string = picture_dict.get('sz', ['0'])[0]
                avatar_width = qiki.Number(picture_size_string)   # width?  height?  size??
                avatar_url = login_result.user.picture
                display_name = login_result.user.name
                print("Logging in", qiki_user.index, qiki_user.idn.qstring())
                lex['lex'](iconify_word, use_already=True)[qiki_user.idn] = avatar_width, avatar_url
                lex['lex'](name_word, use_already=True)[qiki_user.idn] = display_name
                flask_login.login_user(flask_user)
                return flask.redirect(flask.url_for('play'))
            else:
                print("No user!")
            if login_result.provider:
                print("Provider:", repr(login_result.provider))

    return response


@flask_app.route('/module/qiki-javascript/<path:filename>')
def qiki_javascript(filename):
    return flask.send_file(os_path_qiki_javascript(filename))


SCRIPT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))   # e.g. '/var/www/flask'


def os_path_static(relative_url):
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
            return head

    def footer(self):
        self.jquery(JQUERY_VERSION)
        self.js('//ajax.googleapis.com/ajax/libs/jqueryui/{}/jquery-ui.min.js'.format(JQUERYUI_VERSION))
        self.js('//cdn.jsdelivr.net/jquery.cookie/1.4.1/jquery.cookie.js')
        self.js_stamped(flask.url_for('qiki_javascript', filename='jquery.hotkeys.js'))
        self.js_stamped(flask.url_for('qiki_javascript', filename='qoolbar.js'))

    @classmethod
    def os_path_from_url(cls, url):
        static_prefix = flask.url_for('static', filename='')
        qiki_javascript_prefix = flask.url_for('qiki_javascript', filename='')

        url_parse = Parse(url)
        if url_parse.remove_prefix(static_prefix):
            return os_path_static(url_parse.remains)
        elif url_parse.remove_prefix(qiki_javascript_prefix):
            return os_path_qiki_javascript(url_parse.remains)
        else:
            raise RuntimeError("Unrecognized url " + url)
        #
        # if url.startswith(static_prefix):
        #     return os_path_static(url[len(static_prefix) : ])
        # elif url.startswith(qiki_javascript_prefix):
        #     return os_path_qiki_javascript(url[len(qiki_javascript_prefix) : ])
        # else:
        #     raise RuntimeError("Unrecognized url " + url)


@flask_app.template_filter('cache_bust')
def cache_bust(s):
    return FlikiHTML.url_stamp(s)


@flask_app.route('/meta/all', methods=('GET', 'HEAD'))
def meta_all():

    with FlikiHTML('html') as html:
        html.header("Lex all")

        with html.body() as body:

            words = lex.find_words()
            all_subjects = {word.sbj for word in words}

            def latest_iconifier_or_none(s):
                iconifiers = lex.find_words(obj=s, jbo_vrb=iconify_word)
                try:
                    return iconifiers[0]
                except IndexError:
                    return None

            subject_icons_nones = {s: latest_iconifier_or_none(s) for s in all_subjects}
            subject_icons = {s: i for s, i in subject_icons_nones.items() if i is not None}

            def show_sub_word(element, w, **kwargs):
                with element.span(**kwargs) as span_sub_word:
                    w_txt = safe_txt(w)
                    if w in subject_icons:
                        span_sub_word.img(src=subject_icons[w].txt, title=w_txt)
                    else:
                        span_sub_word(w_txt)
                    return span_sub_word

            body.p("Hello Whorled!")
            with body.ol as ol:
                for word in words:
                    with ol.li(value=str(int(word.idn)), title="idn " + word.idn.qstring()) as li:
                        show_sub_word(li, word.sbj, class_='word sbj')
                        li.span(": ")
                        show_sub_word(li, word.vrb, class_='word vrb')
                        li.span(" ")
                        show_sub_word(li, word.obj, class_='word obj')
                        if word.num != qiki.Number(1):
                            with li.span(class_='word num') as span:
                                span.text(" ")
                                span.raw_text("&times;")
                                span.text(render_num(word.num))
                        if word.txt != '':
                            with li.span(class_='word txt') as span:
                                span.text(" ")
                                span.raw_text("&ldquo;")
                                span.text(word.txt)
                                span.raw_text("&rdquo;")
                        li.span(" ")
                        show_whn(li, word.whn, class_='word whn')

            body.p(repr(subject_icons))

            body.footer()

    return html.doctype_plus_html()


SECONDS_PER_WEEK = 7*24*60*60


def show_whn(element, whn, **kwargs):

    def div(n, d):
        return str((n + d//2) // d)

    def fdiv(n, d):
        return "{:.1f}".format(n/d)

    class_ = kwargs.pop(b'class_', '')
    seconds_ago = int(lex.now() - whn)
    if seconds_ago <=                   120:
        ago_short = str(seconds_ago)               + "s"
        ago_long  = str(seconds_ago)               + " seconds ago"
        additional_class = 'seconds'
    elif seconds_ago <=              120*60:
        ago_short = div(seconds_ago,           60) + "m"
        ago_long = fdiv(seconds_ago,           60) + " minutes ago"
        additional_class = 'minutes'
    elif seconds_ago <=            48*60*60:
        ago_short = div(seconds_ago,        60*60) + "h"
        ago_long = fdiv(seconds_ago,        60*60) + " hours ago"
        additional_class = 'hours'
    elif seconds_ago <=         90*24*60*60:
        ago_short = div(seconds_ago,     24*60*60) + "d"
        ago_long = fdiv(seconds_ago,     24*60*60) + " days ago"
        additional_class = 'days'
    elif seconds_ago <=      24*30*24*60*60:
        ago_short = div(seconds_ago,  30*24*60*60) + "M"
        ago_long = fdiv(seconds_ago,  30*24*60*60) + " months ago"
        additional_class = 'months'
    else:
        ago_short = div(seconds_ago, 365*24*60*60) + "Y"
        ago_long = fdiv(seconds_ago, 365*24*60*60) + " years ago"
        additional_class = 'years'

    class_ += ' ' + additional_class
    time_of_it = time.localtime(int(whn))
    time_date = time.strftime(b"%H:%M:%S %d-%b-%Y", time_of_it)
    # TODO:  show day of week if within a week
    if seconds_ago <= SECONDS_PER_WEEK:
        time_date += time.strftime(b", %a", time_of_it)
    title = "{ago_long}: {time_date}".format(ago_long=ago_long, time_date=time_date)
    return element.span(ago_short, title=title, class_=class_, **kwargs)


@flask_app.route('/meta/all words', methods=('GET', 'HEAD'))   # the older, simpler way
def meta_all_words():
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


@flask_app.route('/<path:url_suffix>', methods=('GET', 'HEAD'))
# TODO:  Study HEAD, http://stackoverflow.com/q/22443245/673991
def answer_qiki(url_suffix):
    flask_user, qiki_user = my_login()
    log_html = log_link(flask_user, qiki_user)
    word_for_path = lex.define(path, qiki.Text.decode_if_you_must(url_suffix))
    # DONE:  lex.define(path, url_suffix)
    if str(word_for_path) == 'favicon.ico':
        return qiki_javascript(filename=six.text_type(word_for_path))
        # SEE:  favicon.ico in root, https://realfavicongenerator.net/faq#why_icons_in_root
    qiki_user(question)[word_for_path] = 1, referrer(flask.request)
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
        a.jbo_json = json_from_jbo(a.jbo)
        pictures = lex.find_words(vrb=iconify_word, obj=a.sbj)
        picture = pictures[0] if len(pictures) >= 1 else None
        names = lex.find_words(vrb=name_word, obj=a.sbj)
        name = names[0] if len(names) >= 1 else a.sbj.txt
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
        answers=answers,
        len_answers=len(answers),
        len_questions=len(questions),
        me_idn=qiki_user.idn,
        log_html=log_html,
        render_question=render_question,
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


def json_from_jbo(jbo):
    jbo_list = []
    for word in jbo:
        jbo_list.append(dict(
            idn=word.idn.qstring(),
            sbj=word.sbj.idn.qstring(),
            vrb=word.vrb.idn.qstring(),
            # NOTE:  The following line is not needed...
            #            obj=word.obj.idn.qstring(),
            #        ...because jbo.obj is itself; a.jbo[i].obj == a
            num=native_num(word.num),
            txt=word.txt
        ))
    return json.dumps(jbo_list)


def render_num(num):
    return str(native_num(num))


def native_num(num):
    if num.is_suffixed():
        return repr(num)
    elif num.is_whole():
        return int(num)
    else:
        # TODO:  Complex? Ludicrous? Transfinite?
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
        return valid_response('verbs', list(qoolbar.get_verb_dicts()))
    elif action == 'sentence':
        form = flask.request.form
        try:
            obj_idn = form['obj_idn']
        except KeyError:
            return invalid_response("Missing obj")
        try:
            vrb_txt = form['vrb_txt']
        except KeyError:
            try:
                vrb_idn = form['vrb_idn']
            except KeyError:
                return invalid_response("Missing vrb_txt and vrb_idn")
            else:
                vrb = lex[qiki.Number(vrb_idn)]
        else:
            vrb = lex[vrb_txt]
        try:
            txt = form['txt']
        except KeyError:
            return invalid_response("Missing txt")
        obj = lex[qiki.Number(obj_idn)]
        num_add_str = form.get('num_add', None)
        num_add = None if num_add_str is None else qiki.Number(int(num_add_str))
        num_str = form.get('num', None)
        num = None if num_str is None else qiki.Number(int(num_str))
        new_jbo = lex.create_word(
            sbj=qiki_user,
            vrb=vrb,
            obj=obj,
            num=num,
            num_add=num_add,
            txt=txt,
        )
        return valid_response('jbo', json_from_jbo([new_jbo]))
    elif action == 'new_verb':
        form = flask.request.form
        try:
            new_verb_name = form['name']
        except KeyError:
            return invalid_response("Missing name")
        new_verb = lex.create_word(
            sbj=qiki_user,
            vrb=lex['define'],
            obj=lex['verb'],
            txt=new_verb_name,
            use_already=True,
        )
        lex.create_word(
            sbj=qiki_user,
            vrb=lex['qool'],
            obj=new_verb,
            use_already=True,
        )
        return valid_response('idn', new_verb.idn.qstring())

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


if __name__ == '__main__':
    flask_app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/

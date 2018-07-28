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
import sys

import authomatic
import authomatic.adapters
import authomatic.core
import authomatic.providers.oauth2
import flask   # , send_from_directory
import flask_login
# import flask.ext.login -- ExtDeprecationWarning: Importing flask.ext.login is deprecated, use flask_login instead.
# SEE:  http://flask.pocoo.org/docs/0.11/extensiondev/#ext-import-transition
# noinspection PyUnresolvedReferences
import six.moves.urllib as urllib
import werkzeug.local

import qiki
import secure.credentials


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
# logger.debug("Hi ho")

flask_app = flask.Flask(
    __name__,
    static_url_path='/meta/static',
    static_folder='../qiki-javascript/'
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
me(iconify_word)[me] = 'http://tool.qiki.info/icon/ghost.png'
qoolbar = qiki.QoolbarSimple(lex)

GOOGLE_PROVIDER = b'google'
authomatic_global = authomatic.Authomatic(
    {
        GOOGLE_PROVIDER: {
            b'class_': authomatic.providers.oauth2.Google,
            b'consumer_key': secure.credentials.google_client_id,
            b'consumer_secret': secure.credentials.google_client_secret,
            b'scope': authomatic.providers.oauth2.Google.user_info_scope + [b'https://gdata.youtube.com'],
            b'id': 42,   # See exception in core.py Credentials.serialize() ~line 810:
            # "To serialize credentials you need to specify a"
            # "unique integer under the "id" key in the config"
            # "for each provider!"
            # This happened when calling login_result.user.to_dict()
        }
    },
    secure.credentials.authomatic_secret_key,
    # logger=logger,   # Gets pretty verbose.
)
STALE_LOGIN_ERROR = 'Unable to retrieve stored state!'

login_manager = flask_login.LoginManager()
login_manager.init_app(flask_app)


class GoogleFlaskUser(flask_login.UserMixin):
    """Flask_login model for a Google user."""
    def __init__(self, google_user_id):
        self.id = google_user_id


class GoogleQikiUser(qiki.Listing):
    # def __init__(self, google_user_id_string):
    #     google_user_id = qiki.Number(google_user_id_string)
    #     super(GoogleQikiUser, self).__init__(google_user_id)

    def lookup(self, google_user_id):
        """
        Qiki model for a Google user.
        :param google_user_id:  a qiki.Number for the google user-id
        """
        idn = self.composite_idn(google_user_id)
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
        # print(
        #     "lookup",
        #     "sbj", self.meta_word.lex['lex'],
        #     "vrb", name_word,
        #     "obj", idn,
        #     "==>", the_name,
        #     "<~~", repr(namings),
        # )
        # EXAMPLE:  lookup
        # sbj lex
        # vrb name
        # obj 0q82_A7__8A059E058E6A6308C8B0_1D0B00
        # ==> Bob Stein <~~ [Word(299)]
        return the_name, qiki.Number(1)

    # def get_id(self):
    #     return self.index
    #
    # def get_name(self):
    #     return self.txt
    #
    # def get_provider_user_id(self):
    #     return six.text_type(int(self.idn.get_suffix(qiki.Number.Suffix.TYPE_LISTING).payload_number()))


class AnonymousQikiUser(qiki.Listing):
    def lookup(self, ip_address_idn):
        return "anonymous " + lex[ip_address_idn].txt, qiki.Number(1)


# TODO:  Combine classes GoogleUser(flask_login.UserMixin, qiki.Listing)
# But this causes JSON errors because json can't encode qiki.Number.
# But there are so many layers to the serialization for sessions there's probably a way.
# Never found a way to to that in qiki.Number only, darn.
# All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


listing = lex.noun('listing')
# qiki.Listing.install(listing)   # Silly to do this, right?

google_user = lex.define(listing, 'google user')
# GoogleQikiUser.install(google_user)
google_qiki_user = GoogleQikiUser(meta_word=google_user)

anonymous_user = lex.define(listing, 'anonymous')
# AnonymousQikiUser.install(anonymous_user)
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
    # noinspection PyUnresolvedReferences
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


@flask_app.route('/meta/play', methods=('GET', 'POST'))
def play():
    flask_user, qiki_user = my_login()
    # noinspection PyUnresolvedReferences
    qiki_user_txt = qiki_user.txt
    if flask_user.is_authenticated:
        some_html = """
            <a href='{logout_url}'>logout</a>
            as {user_name}
            (local id {user_id})
            (provider's id {provider_user_id})
        """.format(
            logout_url=flask.url_for('logout'),
            user_id=qiki_user.idn.qstring(),
            user_name=qiki_user_txt,
            provider_user_id=qiki_user.index,
        )
    else:
        some_html = """
            <a href='{login_url}'>login
                from {where}</a>
        """.format(
            login_url=flask.url_for('login'),
            where=qiki_user_txt,
        )
    return """
        <p>
            {some_html}
        </p>
        <p>
            {log_link}
        </p>
    """.format(
        some_html=some_html,
        log_link=log_link(flask_user, qiki_user)
    )


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
        # The following don't help persist the logged-in condition, duh,
        # they just rejigger the brief, ad hoc session supporting the banter with the provider.
        # session=flask.session,
        # session_saver=lambda: flask_app.save_session(flask.session, response),
    )
    # print(repr(login_result))
    if login_result:
        if hasattr(login_result, 'error') and login_result.error is not None:
            print("Login error:", str(login_result.error))
            # Example login_result.error:
            #
            # Failed to obtain OAuth 2.0 access token from https://accounts.google.com/o/oauth2/token!
            # HTTP status: 400, message: {
            #   "error" : "invalid_grant",
            #   "error_description" : "Invalid code."
            # }.
            # e.g. after a partial login crashes, trying to resume with a URL such as:
            # http://localhost.visibone.com:5000/meta/login?state=f45ad ... 4OKQ#
            #
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
                # user = login_result.user
                login_result.user.update()
                flask_user = GoogleFlaskUser(login_result.user.id)
                qiki_user = google_qiki_user[login_result.user.id]
                # user.authomatic_user = login_result.user
                # print("\t" "user before update", repr(user))
                # print("\t" "user data before update", repr(user.data))
                # user_data_before_update = json.dumps(user.data, indent=4)
                # print("\t" "user  after update", repr(user))
                # print("\t" "user data  after update", repr(user.data))
                # user.id = login_result.user.id
                picture_parts = urllib.parse.urlsplit(login_result.user.picture)
                picture_dict = urllib.parse.parse_qs(picture_parts.query)
                # THANKS:  For parsing URL query by name, http://stackoverflow.com/a/21584580/673991
                picture_size_string = picture_dict.get('sz', ['0'])[0]
                avatar_width = qiki.Number(picture_size_string)   # width?  height?  size??
                avatar_url = login_result.user.picture
                display_name = login_result.user.name
                print("Logging in", qiki_user.index, qiki_user.idn.qstring())
                lex['lex'](iconify_word, use_already=True)[qiki_user.idn] = avatar_width, avatar_url
                lex['lex'](name_word, use_already=True)[qiki_user.idn] = display_name
                # print("Picture size", picture_size_string)
                flask_login.login_user(flask_user)
                return flask.redirect(flask.url_for('play'))

                # response.set_data(
                #     """
                #         <p>
                #             Hello
                #             <img src='{url}'>
                #             {name} of {provider}.
                #             Your id is {id}.
                #         </p>
                #
                #         <!-- pre>{user_dictionary}</pre -->
                #         <!-- pre>{provider_dictionary}</pre -->
                #         <!-- pre>{config_dictionary}</pre -->
                #     """.format(
                #         name=user.name,
                #         provider=login_result.provider.name,
                #         url=user.picture,
                #         id=qiki.Number(user.id).qstring(),
                #         user_dictionary=json.dumps(user.to_dict(), indent=4),
                #         # user_dictionary=user_data_before_update,
                #         provider_dictionary=json.dumps(login_result.provider.to_dict(), indent=4),
                #         config_dictionary="\n".join(config_generator(flask_app.config)),
                #     )
                # )
                # HACK:  Remove all this radioactive information -- HTML comments are not hid enough.
            else:
                print("No user!")
            if login_result.provider:
                print("Provider:", repr(login_result.provider))

                # if login_result.provider.User:
                #     print(repr(login_result.provider.User))
                # else:
                #     print("no provider.User")

                # This didn't work
                # user = authomatic.core.User(login_result.provider)
                # user.update()
                # print("\t" "user ", repr(user))
                # print("\t" "email ", str(user.email))
                # print("\t" "picture ", str(user.picture))
            else:
                print("No provider!")
    # else:
    #     print("login processing...")

    return response


# def config_generator(config):
#
#     return {"%s = %s" % (str(k), repr(v)) for k, v in config.iteritems()}

    # return {
    #     "{k} = {v}".format(
    #         k=str(k),
    #         v=repr(v)
    #     ) for k, v in config.iteritems()
    # }

    # for k, v in config.iteritems():
    #     yield "{k} = {v}".format(
    #         k=str(k),
    #         v=repr(v)
    #     )


@flask_app.route('/meta/all words', methods=('GET', 'HEAD'))
def hello_world():
    the_path = flask.request.url
    word_for_the_path = lex.define(path, the_path)
    # me(browse)[word_for_the_path] = 1, flask.request.referrer
    me(browse)[word_for_the_path] = 1, referrer(flask.request)

    words = lex.find_words()
    logger.info("Lex has " + str(len(words)) + " words.")
    reports = []

    def safe_txt(w):
        try:
            return w.txt
        except qiki.Word.NotAWord:
            return "[non-word {}]".format(w.idn.qstring())
        except qiki.Listing.NotAListing:
            return "[non-listing {}]".format(w.idn.qstring())

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

    # """<p>Hello Worldly world!</p>
    # {reports}
    # """.format(
    #     reports="\n".join(reports),
    # )


# To make another static directory...
# @flask_app.route('/static/<path:path>')
# def send_static(path):
#     pass
    # print("Hello again.")
    # print(path, file=sys.stderr)
    # logger.info("Static " + path)
    # # return send_from_directory('static', path)
    # THANKS:  Static file response, http://stackoverflow.com/a/20648053/673991


@flask_app.route('/<path:url_suffix>', methods=('GET', 'HEAD'))
# TODO:  Study HEAD, http://stackoverflow.com/q/22443245/673991
def answer_qiki(url_suffix):
    flask_user, qiki_user = my_login()
    log_html = log_link(flask_user, qiki_user)
    word_for_path = lex.define(path, qiki.Text.decode_if_you_must(url_suffix))
    # TODO:  lex.define(path, url_suffix)
    qiki_user(question)[word_for_path] = 1, referrer(flask.request)
    answers = lex.find_words(
        vrb=answer,
        obj=word_for_path,
        jbo_vrb=qoolbar.get_verbs(),
        idn_ascending=False,
        jbo_ascending=True,
    )
    # TODO:  Alternatives to find_words()?
    # answers = lex.find(vrb=answer, obj=word_for_path,
    for a in answers:
        a.jbo_json = json_from_jbo(a.jbo)
        pictures = lex.find_words(vrb=iconify_word, obj=a.sbj)
        picture = pictures[0] if len(pictures) >= 1 else None
        names = lex.find_words(vrb=name_word, obj=a.sbj)
        name = names[0] if len(names) >= 1 else a.sbj.txt
        if picture is not None:
            author_img = "<img src='{url}' title='{name}'>".format(url=picture.txt, name=name)
        elif name:
            author_img = "({name})".format(name=name)
        else:
            author_img = ""

        a.author = author_img
    questions = lex.find_words(vrb=question, obj=word_for_path)
    return flask.render_template(
        'answer.html',
        question=url_suffix,
        answers=answers,
        len_answers=len(answers),
        len_questions=len(questions),
        me_idn=qiki_user.idn,
        log_html=log_html,
        **config_dict
    )


def json_from_jbo(jbo):
    jbo_list = []
    for word in jbo:
        jbo_list.append(dict(
            idn=word.idn.qstring(),
            sbj=word.sbj.idn.qstring(),
            vrb=word.vrb.idn.qstring(),
            # obj=word.obj.idn.qstring(),   # Not needed; jbo.obj is itself; a.jbo[i].obj == a
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
        # new_jbo = qiki_user.says(
        #     vrb=vrb,
        #     obj=obj,
        #     num=num,
        #     num_add=num_add,
        #     txt=txt,
        # )

        new_jbo = lex.create_word(
            sbj=qiki_user,
            vrb=vrb,
            obj=obj,
            num=num,
            num_add=num_add,
            txt=txt,
        )

        # new_jbo = qiki_user(vrb, num=num, num_add=num_add, txt=txt)[obj]

        return valid_response('jbo', json_from_jbo([new_jbo]))
        # error_message = (
        #     "Got " + ",".join(
        #         [
        #             str(key) + "=" + str(value)
        #             for key, value in flask.request.form.iteritems()
        #         ]
        #     )
        # )
        # logger.debug(error_message)
        # return invalid_response(error_message)
    else:
        return invalid_response("Unknown action " + action)
    # logger.info("Action " + action)


def valid_response(name, value):
    return json.dumps(dict([
        ('is_valid', True),
        (name, value)
    ]))
    # response_dict = dict(
    #     is_valid=True,
    # )
    # response_dict[name] = value
    # return json.dumps(response_dict)


def invalid_response(error_message):
    return json.dumps(dict([
        ('is_valid', False),
        ('error_message', error_message)
    ]))
    # return json.dumps(dict(
    #     is_valid=False,
    #     error_message=error_message,
    # ))


# def unicode_from_str(s):
#     """
#     Converts native string to unicode.
#
#     Python 2:  Assume str is utf-8, decode to unicode type.
#     Python 3:  Pass native unicode through.
#
#     Should be in six.py.
#     :param s:  str
#     """
#     if six.PY2:
#         return s.decode('utf-8')
#     else:
#         return s


if __name__ == '__main__':
    flask_app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/

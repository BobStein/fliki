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

import qiki
import secure.credentials


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '2.1.4'   # https://developers.google.com/speed/libraries/#jquery
JQUERYUI_VERSION = '1.11.4'   # https://developers.google.com/speed/libraries/#jquery-ui
config_names = ('AJAX_URL', 'JQUERY_VERSION', 'JQUERYUI_VERSION')
config_dict = {name: globals()[name] for name in config_names}


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler(sys.stdout)
ch.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asc' 'time)s - %(name)s - %(level''name)s - %(message)s')
ch.setFormatter(formatter)
logger.addHandler(ch)
# THANKS:  Log to stdout, http://stackoverflow.com/a/14058475/673991
# logger.debug("Hi ho")

app = flask.Flask(
    __name__,
    static_url_path='/meta/static',
    static_folder='../qiki-javascript/'
)
app.secret_key = secure.credentials.flask_secret_key

lex = qiki.LexMySQL(**secure.credentials.for_fliki_lex_database)
path = lex.noun(u'path')
question = lex.verb(u'question')
browse = lex.verb(u'browse')
answer = lex.verb(u'answer')
me = lex.define(u'agent', u'user')  # TODO:  Authentication
qoolbar = qiki.QoolbarSimple(lex)

GOOGLE_PROVIDER = b'google'
# noinspection SpellCheckingInspection
autho = authomatic.Authomatic(
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
    }, secure.credentials.authomatic_secret_key,
    # logger=logger,   # Gets pretty verbose.
)
STALE_LOGIN_ERROR = 'Unable to retrieve stored state!'


def referrer(request):
    this_referrer = request.referrer
    if this_referrer is None:
        return qiki.Text(u'')
    else:
        return qiki.Text.decode_if_you_must(this_referrer)


@app.route(u'/meta/play', methods=('GET', 'POST'))
def play():
    response = flask.make_response(" Play ")
    login_result = autho.login(
        authomatic.adapters.WerkzeugAdapter(flask.request, response),
        GOOGLE_PROVIDER,
        # The following don't help persist the logged-in condition,
        # they just rejigger the ad hoc session supporting the banter with the provider.
        # session=flask.session,
        # session_saver=lambda: app.save_session(flask.session, response),
    )
    print(repr(login_result))
    if login_result:
        if hasattr(login_result, 'error') and login_result.error is not None:
            print("Login error:", str(login_result.error))
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
                user = login_result.user
                # print("\tuser before update", repr(user))
                # print("\tuser data before update", repr(user.data))
                # user_data_before_update = json.dumps(user.data, indent=4)
                user.update()
                # print("\tuser  after update", repr(user))
                # print("\tuser data  after update", repr(user.data))
                response.set_data(
                    """
                        <p>
                            Hello
                            <img src='{url}'>
                            {name} of {provider}.
                            Your id is {id}.
                        </p>

                        <!-- pre>{user_dictionary}</pre -->
                        <!-- pre>{provider_dictionary}</pre -->
                        <!-- pre>{config_dictionary}</pre -->
                    """.format(
                        name=user.name,
                        provider=login_result.provider.name,
                        url=user.picture,
                        id=qiki.Number(user.id).qstring(),
                        user_dictionary=json.dumps(user.to_dict(), indent=4),
                        # user_dictionary=user_data_before_update,
                        provider_dictionary=json.dumps(login_result.provider.to_dict(), indent=4),
                        config_dictionary="\n".join(config_generator(app.config)),
                    )
                )
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
                # print("\tuser ", repr(user))
                # print("\tname ", str(user.name))
                # print("\temail ", str(user.email))
                # print("\tpicture ", str(user.picture))
            else:
                print("No provider!")
    else:
        print("No result, login must be in process...")

    return response


def config_generator(config):

    return {"%s = %s" % (str(k), repr(v)) for k, v in config.iteritems()}

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


@app.route(u'/meta/hello', methods=('GET', 'HEAD'))
def hello_world():
    this_path = flask.request.url
    path_word = lex.define(path, this_path)
    # me(browse)[path_word] = 1, flask.request.referrer
    me(browse)[path_word] = 1, referrer(flask.request)

    words = lex.find_words()
    logger.info("Main " + str(len(words)) + " words.")
    reports = []
    for word in words:
        reports.append(dict(
            i=int(word.idn),
            s=word.sbj.txt,
            v=word.vrb.txt,
            o=word.obj.txt,
            t=word.txt,
            n=word.num,
            xn="" if word.num == 1 else "&times;" + render_num(word.num)
        ))

    return flask.render_template(
        'meta.html',
        reports=reports,
    )

    # u"""<p>Hello Worldly world!</p>
    # {reports}
    # """.format(
    #     reports=u"\n".join(reports),
    # )


# To make another static directory...
# @app.route('/static/<path:path>')
# def send_static(path):
#     pass
    # print("Hello again.")
    # print(path, file=sys.stderr)
    # logger.info("Static " + path)
    # # return send_from_directory('static', path)
    # THANKS:  Static file response, http://stackoverflow.com/a/20648053/673991


@app.route(u'/<path:url_suffix>', methods=('GET', 'HEAD'))
def send_qiki(url_suffix):
    this_path = lex.define(path, qiki.Text.decode_if_you_must(url_suffix))
    me(question)[this_path] = 1, referrer(flask.request)
    answers = lex.find_words(vrb=answer, obj=this_path, jbo_vrb=qoolbar.get_verbs(), idn_order='DESC', jbo_order='ASC')
    for a in answers:
        a.jbo_json = json_from_jbo(a.jbo)
    questions = lex.find_words(vrb=question, obj=this_path)
    return flask.render_template(
        'answer.html',
        question=url_suffix,
        answers=answers,
        len_answers=len(answers),
        len_questions=len(questions),
        me_idn=me.idn,
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
        return float(num)


@app.route(AJAX_URL, methods=('POST',))
def ajax():
    action = flask.request.form['action']
    if action == u'answer':
        question_path = flask.request.form['question']
        answer_txt = flask.request.form['answer']
        question_word = lex.define(path, question_path)
        me(answer)[question_word] = 1, answer_txt
        return valid_response('message', u"Question {q} answer {a}".format(
            q=question_path,
            a=answer_txt,
        ))
    elif action == u'qoolbar_list':
        return valid_response('verbs', list(qoolbar.get_verb_dicts()))
    elif action == u'sentence':
        form = flask.request.form
        try:
            obj_idn = form['obj_idn']
        except KeyError:
            return invalid_response(u"Missing obj")
        try:
            vrb_txt = form['vrb_txt']
        except KeyError:
            try:
                vrb_idn = form['vrb_idn']
            except KeyError:
                return invalid_response(u"Missing vrb_txt and vrb_idn")
            else:
                vrb = lex[qiki.Number(vrb_idn)]
        else:
            vrb = lex[vrb_txt]
        try:
            txt = form['txt']
        except KeyError:
            return invalid_response(u"Missing txt")
        obj = lex[qiki.Number(obj_idn)]
        num_add_str = form.get('num_add', None)
        num_add = None if num_add_str is None else qiki.Number(int(num_add_str))
        num_str = form.get('num', None)
        num = None if num_str is None else qiki.Number(int(num_str))
        new_jbo = me.says(
            vrb=vrb,
            obj=obj,
            num=num,
            num_add=num_add,
            txt=txt,
        )
        return valid_response('jbo', json_from_jbo([new_jbo]))
        # error_message = (
        #     u"Got " + ",".join(
        #         [
        #             str(key) + "=" + str(value)
        #             for key, value in flask.request.form.iteritems()
        #         ]
        #     )
        # )
        # logger.debug(error_message)
        # return invalid_response(error_message)
    else:
        return invalid_response(u"Unknown action " + action)
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
    app.run(debug=True)


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/

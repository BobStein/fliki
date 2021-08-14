"""
secure.template/credentials.py   (((THIS FILE IS A TEMPLATE)))
------------------------------
Credentials and configuration options for a fliki server.

((( INSTRUCTIONS:
    1. Copy this file to secure/credentials.py
    2. Change everything with "my" or "88" (except "MySQL")
    3. Read notes in triple parentheses and remove them.

    SEE:  Safe credential hosting, https://security.stackexchange.com/a/117634/20266
)))


MySQL statements used to prepare this server:

    CREATE DATABASE `my_database`;
    CREATE USER 'my_user'@'my.mysql.server.example.com';
    ALTER USER  'my_user'@'my.mysql.server.example.com'
        IDENTIFIED BY 'my_password';
    GRANT CREATE, INSERT, SELECT
        ON `my_database`.*
        TO 'my_user'@'my.mysql.server.example.com';

    (((Suggest you edit, copy, paste, and run the above SQL.)))
    (((Maintain it in tandem with the `for_fliki_lex_database` dictionary below.)))

Secret keys may be created with:

    https://www.random.org/strings/
        3 random strings
        14 characters long
        numeric, uppercase, lowercase
        unique
    https://textmechanic.com/text-tools/randomization-tools/random-string-generator/
        Object Input Box
            abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=
        1 random string
        42 objects in length

Google credentials come from:

    https://console.developers.google.com/apis/credentials?project=my-project
        Credentials
            API keys
                my_browser_key
            OAuth 2.0 client IDs
                my_web_client

"""


import pathlib


for_fliki_lex_database = dict(
    language= 'MySQL',
    host=     'my.mysql.server.example.com',   # or 'localhost' or '127.0.0.1'
    port=     8888,   # defaults to 3306
    user=     'my_user',
    password= 'my_password',
    database= 'my_database',
    table=    'word',
)

# noinspection SpellCheckingInspection
flask_secret_key = 'my secret key for flask'

# noinspection SpellCheckingInspection
authomatic_secret_key = 'my secret key for authomatic'

# SEE:  Google Cloud credentials,
#       https://console.cloud.google.com/apis/credentials?project=my-project

# noinspection SpellCheckingInspection
google_client_id     = 'my_client_id.apps.googleusercontent.com'
google_client_secret = 'my client secret'


MY_GOOGLE_IDN = '0q82_88__8A088888888888888888_1D0B00'
# NOTE:  This q-string is a printable representation of the qiki Number which represents you
#        after you log in to your fliki server for the first time.
#        It appears when you hover over your logout prompt.
#        Or look for "me_idn" in the fliki home page source code.  Again after you log in.
#        The unsuffixed part of such idns (82_88) is lex-specific.  (I forget what this means too.)


class Options(object):
    """
    what_is_this_thing - name for the site's content.  For unslumping.org this is set to "unslumping".
                         If you set it to "stuff" then anonymous users see "my stuff" as the top
                         category.  Logged in user Jan sees "Jan's stuff".

    session_cookie_domain = None - the server's domain and each sub-domain will have separate
                                        sessions
    session_cookie_domain = 3rd-level-domain - e.g. 'sub.example.com'
                                        only this domain (and maybe -- eye roll -- sub-sub-domains)
                                        will use sessions created here
    session_cookie_domain = 2nd-level-domain - e.g. 'example.com'
                                        this domain and subdomains will share sessions
                                        In particular, this domain will stomp on any 3rd-level
                                        fliki server set to e.g. session_cookie_domain =
                                        'sub.example.com'

    redirect_domain_port - dictionary of domain-port redirection directives
                           {'f.com': 't.com'} redirects domain only, port 80 or 443 implied
                           {'f.com:5000': 't.com:4000'} redirects domain and port number

    oembed_server_prefix - the relative URL where this oembed server will pay out oembed contents,
                           or None to disable the oembed server here.
                           An active oembed server will expect an incoming url=x query string.

    oembed_client_prefix - the absolute URL for contribution render-bar iframe src attribute.
                           contribution.js sends this out with a url=x query string on it.

    oembed_other_origin - Who should the PARENT code expect to communicate with?
                          May be the same as oembed_target_origin.  Tricky.  Easy to get wrong. (!)
                          What's tricky:  This setting and the next apply to this fliki web SERVER.
                          Not for a web SITE.  A web site may use different servers, one for
                          parent code (contribution.js) at / (root), another for
                          embedded code (embed_content.js) at /meta/oembed/.
                          Setting up a web SITE in this way may be slightly safer, or less ad
                          infested, by taking advantage of browser cross-origin restrictions.
                          This is suggested at https://oembed.com/#section3:
                              "When a consumer displays HTML (as with video embeds),
                              there's a vector for XSS attacks from the provider.
                              To avoid this, it is recommended that consumers display
                              the HTML in an iframe, hosted from another domain.
                              This ensures that the HTML cannot access cookies from
                              the consumer domain."
                          In that paragraph "consumer" is fliki.
                          The provider is YouTube, flickr, etc.
                          Consequences if other origin is wrong:

                              Unexpected message received from: https://... for iframe_NNNN.
                              Message was: [iFrameSizer]iframe_NNNN:128:220:mutationObserver.
                              This error can be disabled by setting the checkOrigin: false option
                              or by providing of array of trusted domains.

                              This URL is probably the correct value for the other origin setting.

    oembed_target_origin - Who should the EMBEDDED code expect to communicate with?
                           This setting controls behavior of EMBEDDED code, from embed_content.js.
                           The value is some URL (scheme-domain-port) that will serve parent code
                           from / (root) hits.  (Those hits may from from this same server, or they
                           may not.)
                           This setting lets the contents inside an iframe know where its parent
                           came from.  So messages to that parent only work for that parent.
                           '*' for unrestricted.
                           Consequences if target origin is wrong:

                           1. This warning in the console in Chrome DevTools on localhost:
                               [iFrameSizer][Host page: iframe_9999]
                               IFrame has not responded within 5 seconds.
                               Check iFrameResizer.contentWindow.js has been loaded in iFrame.
                               This message can be ignored if everything is working,
                               or you can set the warningTimeout option to a higher value
                               or zero to suppress this warning.
                               (Though this message may appear anyway, or for other reasons.)

                           2. This error in Firefox or Chrome on a live https server:

                               Failed to execute 'postMessage' on 'DOMWindow': The target origin provided
                               ('https://...') does not match the recipient window's origin
                               ('https://...').

                               The FIRST URL in this message will be the same as this setting.
                               The SECOND URL is probably what this setting should be instead.

                           3. iframes won't resize to fit their contents.
                              (Though they might resize anyway, sheesh,
                              apparently postMessage isn't needed for everything.)

    SEE:  targetOrigin, https://developer.mozilla.org/Web/API/Window/postMessage
    """
    home_page_title = "my title"
    enable_answer_qiki = False
    what_is_this_thing = "thing"   # So user Fred would see "Fred's thing" as the top category.
    server_domain = "my.example.com"
    server_domain_port = server_domain   # 80 or 443 implicit
    session_cookie_domain = server_domain   # or None
    redirect_domain_port = {
        'www.my.example.com': server_domain_port,
    }
    system_administrator_users = [
        MY_GOOGLE_IDN,
    ]
    oembed_server_prefix = '/meta/oembed/'   # should start and end with slash

    oembed_client_prefix = 'https://my.other.example.com' + oembed_server_prefix   # should end with slash
    oembed_other_origin  = 'https://my.other.example.com'   # should NOT end with a slash

    oembed_target_origin = 'https://my.example.com'

    path_public_key = pathlib.Path(__file__).with_name('my.crt')
    path_private_key = pathlib.Path(__file__).with_name('my.key')
    # NOTE:  These keys are for the testing Flask web server.  They're not used by Apache or WSGI.
    #        They are used when running fliki.py directly.
    # THANKS:  this directory, alternate file, https://stackoverflow.com/a/65174822/673991
    # THANKS:  Flask cert, https://kracekumar.com/post/54437887454/ssl-for-flask-local-development/
    # THANKS:  Flask cert, https://stackoverflow.com/a/42906465/673991

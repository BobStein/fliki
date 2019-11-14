"""
Credentials and configuration options for a fliki server.  (((THIS FILE IS A TEMPLATE)))

SEE:  Safe credential hosting, https://security.stackexchange.com/a/117634/20266

Your MySQL server might be prepared with:   (((Suggest you edit, copy, paste, run this SQL.)))

    CREATE DATABASE `my_database`;
    CREATE USER 'my_user'@'my.mysql.server.example.com';
    ALTER USER  'my_user'@'my.mysql.server.example.com'
        IDENTIFIED BY 'my_password';
    GRANT CREATE, INSERT, SELECT
        ON `my_database`.*
        TO 'my_user'@'my.mysql.server.example.com';

The secret keys may be created with:

    https://www.random.org/strings/
        3 random strings
        14 characters long
        numeric, uppercase, lowercase
        unique
    http://textmechanic.com/text-tools/randomization-tools/random-string-generator/
        Object Input Box
            abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=
        1 random string
        42 objects in length

The google credentials come from:

    https://console.developers.google.com/apis/credentials?project=my-project
        Credentials
            API keys
                my_browser_key
            OAuth 2.0 client IDs
                my_web_client

"""

for_fliki_lex_database = dict(
    language= 'MySQL',
    host=     'my.mysql.server.example.com',   # or 'localhost' or '127.0.0.1'
    port=     3306,
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
    session_domain = None - the server's domain and each sub-domain will have separate sessions
    session_domain = 3rd-level-domain - e.g. 'sub.example.com'
                                        only this domain (and maybe -- eye roll -- sub-sub-domains)
                                        will use sessions created here
    session_domain = 2nd-level-domain - e.g. 'example.com'
                                        this domain and subdomains will share sessions
                                        In particular, this domain will stomp on any 3rd-level
                                        fliki server set to e.g. session_domain = 'sub.example.com'

    redirect_domain_port - dictionary of domain-port redirection directives
                           {'f.com': 't.com'} redirects domain only, port 80 or 443 implied
                           {'f.com:5000': 't.com:4000'} redirects domain and port number

    oembed_server_prefix - the relative URL where this oembed server will pay out oembed contents,
                           or None to disable the oembed server here.
                           An active oembed server will expect an incoming url=x query string.

    oembed_client_prefix - the absolute URL for contribution render-bar iframe src attribute.
                           contribution.js sends this out with a url=x query string on it.

    oembed_other_origin - may be the same as oembed_target_origin.
                          Make it a different domain to be a little safer with embedded media,
                          as suggested at https://oembed.com/#section3:
                              "When a consumer displays HTML (as with video embeds),
                              there's a vector for XSS attacks from the provider.
                              To avoid this, it is recommended that consumers display
                              the HTML in an iframe, hosted from another domain.
                              This ensures that the HTML cannot access cookies from
                              the consumer domain."
                          In that paragraph "consumer" is fliki.
                          The provider is YouTube, flickr, etc.

    oembed_target_origin - the URL (scheme, domain, port) that will be using this oembed server.
                           This is your fliki server.
                           This tells the oembed server (contents of the iframe)
                           who should be their client (has an iframe).
                           '*' for unrestricted.
                           Consequences if target origin does not match scheme, domain, and port:
                           1. This warning in the console:
                               [iFrameSizer][Host page: iframe_9999]
                               IFrame has not responded within 5 seconds.
                               Check iFrameResizer.contentWindow.js has been loaded in iFrame.
                               This message can be ignored if everything is working,
                               or you can set the warningTimeout option to a higher value
                               or zero to suppress this warning.
                               (Though this message may appear anyway, or for other reasons.)
                           2. iframes won't resize to fit their contents.
                              (Though they might resize anyway, sheesh,
                              apparently postMessage isn't needed for everything.)
    SEE:  targetOrigin, https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
    """
    home_page_title = "My Title"
    enable_answer_qiki = False
    what_is_this_thing = "my thing"
    session_domain = "my.main.fliki.example.com"   # or None
    redirect_domain_port = {
        'some.other.domain.example.com': session_domain,
    }
    system_administrator_users = [
        MY_GOOGLE_IDN,
    ]
    oembed_server_prefix = '/meta/oembed/'   # should start and end with slash
    oembed_client_prefix = 'https://my.other.fliki.example.com/meta/oembed/'   # should end with slash
    oembed_other_origin  = 'https://my.other.fliki.example.com/'
    oembed_target_origin = 'https://my.main.fliki.example.com/'

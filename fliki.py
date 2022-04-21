"""
fliki is a qiki implemented in Flask and Python.

Authentication courtesy of flask-login and authomatic.
"""

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

import authomatic
import authomatic.adapters
import authomatic.core
import authomatic.providers.oauth2
import flask
import flask_login
import git
import urllib.error
import urllib.parse
import urllib.request
import werkzeug.local
import werkzeug.useragents
import werkzeug.user_agent
import werkzeug.utils

import secure.credentials
import to_be_released.web_html as web_html
from individual_functions import *


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '3.6.0'   # https://developers.google.com/speed/libraries/#jquery
DO_MINIFY = False
SCRIPT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))   # e.g. '/var/www/flask'
PARENT_DIRECTORY = os.path.dirname(SCRIPT_DIRECTORY)             # e.g. '/var/www'
THUMB_MAX_WIDTH = 160
THUMB_MAX_HEIGHT = 128
NON_ROUTABLE_IP_ADDRESS = '10.255.255.1'   # THANKS:  https://stackoverflow.com/a/904609/673991
NON_ROUTABLE_URL = 'https://' + NON_ROUTABLE_IP_ADDRESS + '/'   # for testing
SHOW_LOG_AJAX_NOEMBED_META = False
CATCH_JS_ERRORS = False
ENABLE_TALKIFY = False    # NOTE:  talkify voices seemed better than the standard browser voices.
ALLOW_ANONYMOUS_CONTRIBUTIONS = False   # False disables ALL word creation for anon users.
INTERACT_VERBS = [
    'bot',      # |>  global play button
    'start',    # |>  individual media play
    'quit',     # []  ARTIFICIAL, manual stop, skip, or pop-up close
    'end',      #     NATURAL, automatic end of the media
    'pause',    # ||  either the global pause or the pause within the iframe
    'resume',   # |>
    'error',    #     something went wrong, human-readable txt
    'unbot',    #     bot ended, naturally or artificially (but not crash)
]
VERBS_USERS_MAY_USE = {
    'contribute',
    'caption',
    'edit',
    'rearrange',
    'browse',
}.union(INTERACT_VERBS)

JSONL_EXTENSION = '.jsonl'
MIME_TYPE_JSONL  = 'application/jsonl+json'
# SEE:  (my comment) on using the +json suffix,
#       https://stackoverflow.com/q/51690624/673991#comment122920211_67807011
#       It is technically a lie, but it allows direct browsing in Chrome to display the file.
#       With this MIME type on the other hand, Chrome just downloads the file:  application/jsonl
#       Another possibility:  text/x.jsonl+json


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

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
log_handler = logging.StreamHandler(sys.stdout)
log_handler.setLevel(logging.DEBUG)
log_formatter = logging.Formatter('%(asc' 'time)s - %(name)s - %(level''name)s - %(message)s')
log_handler.setFormatter(log_formatter)
logger.addHandler(log_handler)
# THANKS:  Log to stdout, http://stackoverflow.com/a/14058475/673991

login_manager = flask_login.LoginManager()

flask_app = flask.Flask(
    __name__,
    static_url_path='/meta/static',
    static_folder='static'
)
# SEE:  "Ideally your web server is configured to serve [static files] for you"
#       https://flask.palletsprojects.com/en/2.0.x/quickstart/#static-files
# EXAMPLE:  Apache settings redundant to the above.  Except mistakenly for /static not /meta/static!
#       Alias /static /var/www/example.com/fliki/static
#       <Directory /var/www/example.com/fliki/static/>
#           Order allow,deny
#           Allow from all
#           Options -Indexes
#       </Directory>


class UNICODE(object):
    BLACK_RIGHT_POINTING_TRIANGLE = '\u25B6'
    VERTICAL_ELLIPSIS = '\u22EE'   # 3 vertical dots, aka &vellip; &#x022ee; &#8942;
    VERTICAL_FOUR_DOTS = '\u205E'
    HORIZONTAL_LINE_EXTENSION = '\u23AF'


def static_url(relative_path, **kwargs):
    return flask.url_for('static', filename=relative_path, **kwargs)


def static_code_url( relative_path, **kwargs):
    return static_url('code/' + relative_path, **kwargs)


def static_data_url( relative_path, **kwargs):
    return static_url('data/' + relative_path, **kwargs)


def os_path_static(relative_url):
    """
    Convert url to path, for static files.

    EXAMPLE:  '/var/www/static/foo.bar' == os_path_static('foo.bar')
    """
    return werkzeug.utils.safe_join(flask_app.static_folder, relative_url)
    # NOTE:  Was flask.safe_join(), then:
    #        DeprecationWarning: 'flask.helpers.safe_join' is deprecated and will be removed
    #        in Flask 2.1. Use 'werkzeug.utils.safe_join' instead.


def os_path_qiki_javascript(relative_url):
    return werkzeug.utils.safe_join(PARENT_DIRECTORY, 'qiki-javascript', relative_url)
    # NOTE:  Assume the fliki and qiki-javascript repos are in sibling directories.


def os_path_data(file_name):
    return os_path_static(werkzeug.utils.safe_join('data', file_name))


def os_path_workshop(file_name):
    return werkzeug.utils.safe_join(SCRIPT_DIRECTORY, 'workshop', file_name)


def web_path_qiki_javascript(relative_url):
    return flask.url_for('static_response_from_qiki_javascript', filename=relative_url)


class NamedElements(object):
    """A dictionary that can be de-referenced as properties:  d.foo instead of d['foo']."""
    def __init__(self, starting_dict = None):
        self._dict = dict()
        if starting_dict is not None:
            for name, value in starting_dict.items():
                self.add(name, value)

    def to_dict(self):
        return self._dict
        # CAUTION:  Not doing a deepcopy here means the caller can modify the internal _dict.
        #           But copy.deepcopy() seemed to produce weird recursive error messages.
        #           Or those were a red herring to some other bug, such as words pointing to
        #           words in a cyclic loop.  (E.g. the noun definition is its own parent.)
        #           Anyway it was never clear that a deepcopy fixed or caused any bugs.

    def key_list(self):
        return list(self._dict.keys())

    def value_list(self):
        return list(self._dict.values())

    def len(self):
        return len(self._dict)

    def to_json(self):
        return self.value_list()

    def add(self, name, value):
        self._dict[name] = value

    def has(self, name):
        return name in self._dict

    def names(self):
        return ",".join(name for name in self._dict.keys())

    _UNSPECIFIED = object()

    def get(self, name, default_value=_UNSPECIFIED):
        if default_value is self._UNSPECIFIED:
            return self._dict[name]   # may raise KeyError
        else:
            return self._dict.get(name, default_value)

    def remove(self, name):
        if name in self._dict:
            return_value = self._dict[name]
            del self._dict[name]
            return return_value
        else:
            return None

    def __getattr__(self, item):
        if item in self._dict:
            return self._dict[item]
        else:
            raise AttributeError(repr_safe(self) + " has no attribute " + repr_safe(item))


class UserLex(object):
    """
    A local memory cache of all that we want to remember or process about users.

    A UserLex instance is coupled with a UserWord subclass.
        The lex instance has a `word_class` instance-variable.
        The word class has a `lex` class-variable.
    """
    _lex_instances = list()

    def __init__(self, word_class, meta_idn):
        self.word_class = word_class
        self.meta_idn = meta_idn
        self._users = list()
        self._lex_instances.append(self)

    def users(self):
        for user in self._users:
            yield user

    @classmethod
    def word_from_idn(cls, idn):
        """
        Instantiate a user word from its idn.  Consider all UserLex instances.

        If the idn is formatted properly, consider all UserLex instances,
        and all the user words they already store.
        But if not stored there, and the meta-idn applies to one of the lexes,
        then instantiate a new word and store it there.
        """
        if cls.valid_idn(idn):
            for lex_instance in cls._lex_instances:
                if lex_instance.meta_idn == cls.meta_from_idn(idn):
                    user_word = lex_instance.word_from_index(cls.index_from_idn(idn))
                    return user_word
        return None

    def word_from_index(self, user_index):
        """
        Factory function for instantiating words, given a UserLex and a user index (aka id).

        Pull an instance from self._users[], or instantiate a new one, and store it there.
        """
        for user_word in self.users():
            if user_word.index == user_index:
                break
        else:
            user_word = self.word_class(user_index)
            self._users.append(user_word)
        return user_word

    @classmethod
    def idn_from_parts(cls, meta_idn, index):
        return tuple((meta_idn, index))

    @classmethod
    def meta_from_idn(cls, idn):
        return idn[0]

    @classmethod
    def index_from_idn(cls, idn):
        return idn[1]

    @classmethod
    def valid_idn(cls, idn):
        return (
            isinstance(idn, (list, tuple)) and
            len(idn) == 2 and
            isinstance(cls.meta_from_idn(idn), int) and
            FlikiWord.Ancestry(cls.meta_from_idn(idn)).is_offspring_of(FlikiWord.idn_of.user)
        )

    def to_json(self):
        return self._users


class UserWord(object):
    lex = None

    def __init__(self, user_index):
        self.index = user_index
        self.obj = NamedElements()

    @property
    def idn(self):
        return self.lex.idn_from_parts(self.lex.meta_idn, self.index)

    def to_json(self):
        mock_dictionary = dict(
            idn=self.idn,
            obj=self.obj.to_dict(),
        )
        if hasattr(self, 'is_authenticated'):
            mock_dictionary['is_authenticated'] = self.is_authenticated
        if hasattr(self, 'is_anonymous'):
            mock_dictionary['is_anonymous'] = self.is_anonymous
        # NOTE:  is_authenticated and is_anonymous come from UserMixin or AnonymousUserMixin
        return mock_dictionary

    def get_id(self):
        """What UserMixin calls an id, we call an index, which is part of the idn (identifier)."""
        return self.index

    def name(self):
        if self.obj.has('name'):
            return self.obj.name
        else:
            return "UNNAMED USER " + repr_safe(self.idn)

    def is_admin(self):
        return self.obj.has('admin') and self.obj.admin == 1


class GoogleWord(UserWord, flask_login.UserMixin):
    """
    Explicitly instantiated in Flask Login, login manager, (1) user loader, and (2) login.

    But not directly, only via factory function GoogleWord.lex.user_word_from_index().
    """


class AnonymousWord(UserWord, flask_login.AnonymousUserMixin):
    """Implicitly instantiated automagically into Flask Login, current user."""
    def __init__(self, index=None):
        if index is None:
            index = flask.request.remote_addr
        super(AnonymousWord, self).__init__(index)
        self.obj.add('name', "(anonymous {})".format(index))


class FlikiWord(object):   # qiki.nit.Nit):   # pity, all that work in nit.py for nought
    """
    Combines the word and lex roles for the nit-based Contribution class of applications.

    So, wow this will need some refactoring but for now, just getting it to work.

    FlikiWord class:

        Write words to the lex file.  Be thread-safe.  A singleton (the class is the object).

    FlikiWord instance:

        A nit with named sub-nits.  This is a hint of a generic word, which could be
        a container of named sub-words.  Or let's just say sub-nits.  Because whn
        could be a Nit subclass for time, and user could be a Nit subclass for a user.

    Interesting simplicity in this:  the class is the lex, instances are words.
    Runs afoul of making the lex itself a nit -- you'd need bytes and nits class methods.

    Holy crap, there's another confusion.  The word for the lex itself (idn zero) and the
    lex itself.  What if they were the same thing?  If a word in the lex actually WAS the lex!
    Another confusion, the user word and the word for 'user'.
    There is a sbj=user word versus the sbj=lex word.  Very different rules for
    creation and uses put to.  Then what if the word for users was itself the class
    that allowed sbj=user words to be created.

    Not sure what I'm saying here, but getting the inkling I'm on to something.
    A collection of ridiculously broad things, could include a thing for creating
    whole worlds of things.
    This meshes with the confusion over whether sbj=user words and sbj=lex words should
    be in different lexes, as in different nit-stream-files.
    And the other confusion over whether exterior lexes could be integrated in,
    such as the world of google users with their umpteen bit numbers.
    And the other confusion over whether every user could have their own lex, which
    could refer to other lexes and words in those lexes.

    So anyway, I know, I get it, this class is a shit-show of object oriented crimes.
    But it's also a stepping stone to something somehow better.
    Better than it is now of course, but maybe just maybe better than OOP.
    So I fall back on my procedural roots.
    """

    lex_file_name = 'unslumping.lex.jsonl'
    # NOTE:  This could kinda sorta be basis for the URL of the lex,
    #        which is also the bytes part of the lex's "root" nit.
    #        Inline with the notion that everything is a Nit.
    #        Akin to the idn of each word being its bytes part.
    # TODO:  Move this name to secure/credentials.py?

    max_idn = None
    lines_in_file = None
    lock = None

    # NOTE:  The following are fleshed out by FlikiWord.open_lex()
    by_idn = dict()
    idn_of = NamedElements()
    _vrb_from_idn = None
    _vrb_from_idn_alternate = None

    MINIMUM_JSONL_ELEMENTS = 4   # Each word contains at a minimum:  idn, whn, sbj, vrb
    MAXIMUM_JSONL_CHARACTERS = 10000   # No word's JSON string should be longer than this

    @classmethod
    def lex_url(cls):
        return static_data_url(cls.lex_file_name)

    @classmethod
    def lex_path(cls):
        return os_path_data(cls.lex_file_name)

    @classmethod
    def open_lex(cls):
        """
        Initialize at start of runtime.

        Compute from the lex jsonl file:
            FlikiWord.max_idn
            FlikiWord.idn_of
            FlikiWord.by_idn
        """
        p = Probe()
        cls.lock = threading.Lock()

        idn_lex = None
        idn_define = None
        # TODO:  There was a reason for storing these in local variables, not in
        #        FlikiWord.idn_of.  What was it?
        #        It wasn't just the brevity.  idn_lex versus cls.idn_of.lex
        #        Oh right, it was because pass 2 triggered a duplicate definition error.
        #        Was it??  Cannot find any duplicate detection.
        #        But that goes away if we combine pass 1 and 2.
        #        That requires insisting that the lex and define definitions come first.  Can do.
        word = None
        try:
            for word in cls.all_words_unresolved():   # pass 1:  idn_lex, idn_define
                if word.idn == word.sbj and word.obj_values[1] == 'lex':
                    idn_lex = word.idn
                if word.idn == word.vrb and word.obj_values[1] == 'define':
                    idn_define = word.idn
                need_more_early_definitions = idn_lex is None or idn_define is None
                if not need_more_early_definitions:
                    break

            cls.max_idn = 0
            cls.lines_in_file = 0
            prev_idn = None
            prev_whn = None
            word = None
            for word in cls.all_words_unresolved():   # pass 2:  idn_of, by_idn, max_idn, lines_in_file
                cls.lines_in_file += 1
                if word.sbj == idn_lex and word.vrb == idn_define:
                    word.resolve_and_remember_definition()

                if cls.max_idn < word.idn:
                    cls.max_idn = word.idn
                if prev_idn is not None and word.idn <= prev_idn:
                    Auth.print(
                        "IDN OUT OF ORDER:  after", prev_idn, "is", word.idn,
                        "on line", word.line_number
                    )
                    # NOTE:  Out of order IDNs is not a fatal error.
                    # TODO:  Duplicate IDNs (in any order) should be a fatal error.
                prev_idn = word.idn

                if prev_whn is not None and word.whn < prev_whn:
                    Auth.print(
                        "WHN OUT OF ORDER:  after", prev_whn, "is", word.whn,
                        "on line", word.line_number
                    )
                prev_whn = word.whn

            p.at("def")

            word = None
            for word in cls.by_idn.values():   # resolve lex-defined fields
                word.resolve()

            word = None
            for word in cls.by_idn.values():   # validate lex-defined fields
                word.validate_definition_word()

            GoogleWord.lex = UserLex(GoogleWord, cls.idn_of.google_user)
            AnonymousWord.lex = UserLex(AnonymousWord, cls.idn_of.anonymous)

            p.at("DEF")

            word = None
            cls._vrb_from_idn = dict()
            cls._vrb_from_idn_alternate = list()
            for word in cls.all_words_unresolved():   # pass 3:  Make a lookup table of verb idns for all reference words
                if not word.is_definition():
                    cls._vrb_from_idn[word.idn] = word.vrb
                    cls._vrb_from_idn_alternate.append((word.idn, word.vrb))

            p.at("ref")

            word = None
            for word in cls.all_words_unresolved():   # pass 4:  Take a swing at resolving all reference words
                if not word.is_definition():
                    word.resolve()
                    word.check_if_lex_is_referencing_a_user()
                    word.validate_reference_word(cls.vrb_from_idn)
                    word.check_forref_in_reference_word()

            p.at("REF")

        except (ValueError, KeyError, AttributeError, TypeError, IndexError) as e:
            if word is None:
                raise cls.OpenError("{file}\n    {e}".format(
                    file=cls.lex_file_name,
                    e=repr_safe(e),
                )) from e
                # THANKS:  Amend exception, Py3, https://stackoverflow.com/a/29442282/673991
            else:
                raise cls.OpenError("{file} line {line_number}\n    {e}".format(
                    file=cls.lex_file_name,
                    line_number=word.line_number,
                    e=repr_safe(e),
                )) from e
        else:
            vfi_third = [False] * (cls.max_idn + 1)
            for idn, vrb in cls._vrb_from_idn.items():
                vfi_third[idn] = vrb

            Auth.print(
                "Scanned",
                cls.lines_in_file, "lines,",
                "max idn", cls.max_idn,
                p.report(),
                sys.getsizeof(cls._vrb_from_idn),   # Potentially ginormous idn reference cache.
                sys.getsizeof(cls._vrb_from_idn_alternate),   # Less ginormous?  42K vs 148K
                len(cls._vrb_from_idn),                       # 5K pairs
                sys.getsizeof(vfi_third),                     # sparse list 69K vs pair list 42K
            )

    @classmethod
    def vrb_from_idn(cls, idn):
        """ What vrb does a reference-word use? """
        if cls._vrb_from_idn is None:
            raise cls.WordError("Cannot look up verbs before they're tallied")
        return cls._vrb_from_idn[idn]   # may raise a KeyError for a bogus idn

    @classmethod
    def close_lex(cls):
        pass

    def resolve_and_remember_definition(self):
        if len(self.obj_values) != 3:
            raise self.FieldError(
                "Definition {idn} should have 3 fields, not {actual_number}".format(
                    idn=self.idn,
                    actual_number=len(self.obj_values),
                )
            )
        self.name_an_obj(0, 'parent')
        self.name_an_obj(1, 'name')
        self.name_an_obj(2, 'fields')
        self.obj_values = []
        assert isinstance(self.obj, NamedElements)
        if not isinstance(self.obj.name, str):
            raise self.FieldError(
                "Definition {idn}, name should be a string, not {name}".format(
                    idn=self.idn,
                    name=repr_safe(self.obj.name),
                )
            )
        if not isinstance(self.obj.parent, int):
            raise self.FieldError(
                "Definition {idn}, parent should be an idn, not {parent}".format(
                    idn=self.idn,
                    parent=repr_safe(self.obj.parent),
                )
            )
        if not isinstance(self.obj.fields, list):
            raise self.FieldError(
                "Definition {idn}, fields should be a list, not {fields}".format(
                    idn=self.idn,
                    fields=repr_safe(self.obj.fields),
                )
            )
        if not all(isinstance(field, int) for field in self.obj.fields):
            raise self.FieldError(
                "Definition {idn}, fields should be a list of idns, not {fields}".format(
                    idn=self.idn,
                    fields=repr_safe(self.obj.fields),
                )
            )
        self.idn_of.add(self.obj.name, self.idn)
        self.by_idn[self.idn] = self
        self.check_forref_in_definition_word()

    def check_forref_in_definition_word(self):
        """Report (nonfatal) a definition-word with a forward-reference."""
        word_description = "'{name_defined}' define word {idn_defined}".format(
            name_defined=self.obj.name,
            idn_defined=self.idn,
        )
        self.check_forref(self.vrb, word_description, "verb")
        # EXAMPLE:  Forward reference in 'lex' define word 0 -- verb refers to word 1
        #           Can't figure out how to avoid this one forward reference.
        #           Expect one day I'll just suppress it.
        self.check_forref(self.obj.parent, word_description, "parent")
        for index_field_1_based, idn_field in enumerate(self.obj.fields, start=1):
            # THANKS:  1-based enumeration, https://stackoverflow.com/a/28072982/673991
            field_description = "field {index_field}/{num_field}".format(
                index_field=index_field_1_based,
                num_field=len(self.obj.fields),
            )
            self.check_forref(idn_field, word_description, field_description)

    def check_forref_in_reference_word(self):
        """
        Report (nonfatal) a reference-word with a forward-reference.

        This can be done either on an existing word scanned from the lex,
        or on a new word that has just been stowed into the lex.
        It cannot be performed BEFORE a new word is stowed, because it has no idn yet.
        """
        vrb = self.validated_vrb()
        word_description = "{vrb_name} word {idn}".format(
            vrb_name=vrb.obj.name,
            idn=self.idn,
        )
        self.check_forref(self.vrb, word_description, "verb")
        # EXAMPLE:  Forward reference in contribute word 882 --
        #           verb refers to contribute, whose idn is 1408
        for (field_index_1_based, (field_idn, field_value)) in (
            enumerate(zip(vrb.obj.fields, self.obj.value_list()), start=1)
        ):
            field_ancestry = self.Ancestry(field_idn)
            if field_ancestry.founder().idn == self.idn_of.noun:
                '''Field is noun-founded, meaning its value is an idn (or has an idn).'''
                field_description = "field ref {index_field}/{num_field}".format(
                    index_field=field_index_1_based,
                    num_field=len(vrb.obj.fields),
                )
                # print(
                #     vrb.obj.name.upper(), "WORD", self.idn,
                #     "FIELD", field_index_1_based,
                #     "IS", field_ancestry.child().obj.name, field_value
                # )
                # EXAMPLE:  ICONIFY WORD 516 FIELD 1 IS user [167, '103620384189003122864']
                if isinstance(field_value, int):
                    '''Field should be an idn.  Make sure it's not bigger than self.idn'''
                    self.check_forref(field_value, word_description, field_description)
                    # EXAMPLE:  Forward reference in caption word 1433 --
                    #           field ref 1/2 refers to word 1450
                elif isinstance(field_value, list):
                    '''Field should have an idn in a sub-nit.  Shouldn't be bigger than self.idn.'''
                    # NOTE:  A noun-founded field has already been validated as either int or list.
                    #        If it's list, it's already been checked that the first element
                    #        (nit.bytes) is DESCENDED from the field-definition idn.  We still need
                    #        to check that this descendent not a forward reference.
                    complex_description = "complex " + field_description
                    self.check_forref(field_value[0], word_description, complex_description)

            else:
                '''
                Field is not noun-founded.  That is, its value is not an idn.
                So this is not a forward reference because it's not a reference to any word at all.
                '''
                # print(
                #     vrb.obj.name, "word", self.idn,
                #     "field", field_index_1_based,
                #     "is a", field_ancestry.child().obj.name
                # )
                # EXAMPLE:  iconify word 516 field 2 is a url

    def check_forref(self, idn_referent, word_description, part_description):
        """Report a reference if it is a forward-reference."""
        if idn_referent == self.idn:
            '''
            A word may refer to itself.  Fundamental definitions do this:  
            lex, define, noun, text, integer, sequence.
            '''
            # print(
            #     "Self reference:  "
            #     "{name_defined} (word {idn_defined}) -- "
            #     "{description} refers to itself".format(
            #         idn_defined=self.idn,
            #         name_defined=self.obj.name,
            #         description=description,
            #     )
            # )
            # EXAMPLE:  Self reference:  sequence (word 198) -- parent refers to itself
        elif idn_referent > self.idn:
            try:
                referent_description = "{def_name}, whose idn is {def_idn}".format(
                    def_name=self.by_idn[idn_referent].obj.name,
                    def_idn=idn_referent,
                )
            except KeyError:
                referent_description = "word {not_a_def_idn}".format(
                    not_a_def_idn=idn_referent,
                )
            if self.idn == 0 and idn_referent == 1:
                '''Ignore where the `lex` definition-word uses the `define` verb.'''
                # EXAMPLE:  (benign)
                #     Forward reference in 'lex' define word 0 -- verb refers to word 1
            else:
                print(
                    "Forward reference in "
                    "{word_description} -- "
                    "{part_description} refers to "
                    "{referent_description}".format(
                        word_description=word_description,
                        part_description=part_description,
                        referent_description=referent_description,
                    )
                )

    @classmethod
    def create_word_by_lex(cls, vrb_idn, obj_dictionary):
        """Instantiate and store a sbj=lex word.   (Not a define word.)"""
        assert vrb_idn != cls.idn_of.define, (
            "Definitions must not result from outside events. " +
            repr_safe(obj_dictionary)
        )
        new_lex_word = cls(
            sbj=cls.idn_of.lex,
            vrb=vrb_idn,
            **obj_dictionary
        )
        new_lex_word.stow()
        return new_lex_word

    @classmethod
    def create_word_by_user(cls, auth, vrb_name, sub_nit_dict):
        """
        Instantiate and store a user word.  (Not a lex word.)

        Its JSON is a line in the lex file.
        .to_dict() gives named sub-nits

        :param auth: - AuthFliki instance, representing an authenticated or anonymous user
        :param vrb_name: - NAME of the verb, not it's idn.  Disallowed verb is a CreateError.
        :param sub_nit_dict: - named sub-nits.  Wrong or missing names is a CreateError.
        """
        # TODO:  The following code looks eerily similar to that of
        #        .resolve() and .validate...() methods.  D.R.Y. somehow?
        #        Maybe a better encapsulation of fields and resolving?
        #        One difference is file-origin words come with unnamed obj fields (to save bytes)
        #        but browser-origin words have named obj fields (to detect parameter mismatches).
        #        So, different conversion and validation needs.
        if vrb_name not in VERBS_USERS_MAY_USE:
            raise cls.CreateError("May not create a word with verb " + repr_safe(vrb_name))
        else:
            try:
                vrb_idn = cls.idn_of.get(vrb_name)
                vrb = cls.by_idn[vrb_idn]
            except KeyError as e:
                raise cls.CreateError(
                    "Cannot create a word with verb " + repr_safe(vrb_name)
                ) from e
            else:
                unused = set(sub_nit_dict.keys())
                obj_dict = dict()
                for field_idn in vrb.obj.fields:
                    field = cls.by_idn[field_idn]
                    try:
                        field_value = sub_nit_dict[field.obj.name]
                    except KeyError as e:
                        raise cls.CreateError(
                            "Underspecified {vrb_name} - {error_message}".format(
                                vrb_name=vrb_name,
                                error_message=repr_safe(e),
                            )
                        ) from e
                    else:
                        unused.remove(field.obj.name)
                        obj_dict[field.obj.name] = field_value
                        # NOTE:  Dictionary is in vrb definition order, not caller-specified order.
                        # SEE:  Dictionary is ordered, https://stackoverflow.com/a/39537308/673991
                if len(unused) > 0:
                    raise cls.CreateError(
                        "Overspecified {vrb_name} - {unused_fields}".format(
                            vrb_name=vrb_name,
                            unused_fields=", ".join(unused),
                        )
                    )
                else:
                    word = cls(
                        sbj=auth.flask_user.idn,    # e.g. [167,"103620384189003122864"]
                        vrb=vrb.idn,
                        **obj_dict
                    )
                    word.vrb_name = vrb_name

                    word.validate_reference_word(cls.vrb_from_idn)
                    # NOTE:  Browser-created words are already resolved.  That is, fields are named.
                    # NOTE:  validate before stow, so invalid words don't get into the file.
                    # NOTE:  idn-to-vrb mapping is used to validate fields that are idns.

                    word.stow()

                    word.check_forref_in_reference_word()
                    # NOTE:  Forward reference is near impossible, but anyway it must be checked
                    #        after stowed because only then is word.idn known.

                    return word


    # TODO:  Move that obj naming somewhere more general-purpose.
    # TODO:  Populate a virgin .lex.jsonl with the definitions for the Contribution application.
    #        In multiple tiers of generality:  most (lex, define), less (contribute, edit)


    def __init__(self, idn=None, whn=None, sbj=None, vrb=None, *obj_values, **obj_dict):
        """
        Assemble a nit for the word.  Stow its json as a new line in the lex file.  Threadsafe.

        Generate the idn and whn parts of the nit.  The caller already supplied sbj (user), vrb,
        and the other sub-nits when the word was instantiated.
        """
        self.idn = idn
        self.whn = whn
        self.sbj = sbj
        self.vrb = vrb
        self.obj_values = list(obj_values)
        self.obj = NamedElements(obj_dict)
        self.line_number = None

        # FIXME:  Uh oh there's a problem in this happy world where .obj parts are dot-dereferenced
        #         e.g. .obj.name.  NamedElements instances have lots of generic-sounding methods
        #         that therefore could never be lex fields.
        #         Maybe all NamedElements methods should be obfuscated.
        #         Ending with an underscore makes me want to ralph.
        #         Much less emetic would be to stuff them all into one sub-object.
        #         Instead of
        #             word.obj.value_list()
        #         how about
        #             word.obj._.value_list()
        #         Oh wait, would that be a private member?
        #             word.obj.x.value_list()
        #             word.obj.x_value_list()
        #             word.obj.m_value_list()

    def name_an_obj(self, field_index_0_based, name):
        """
        Name an unresolved obj.

        Copy it from the numbered .obj_values array, to the named .obj associative array.
        """
        try:
            self.obj.add(name, self.obj_values[field_index_0_based])
        except IndexError as e:
            raise self.FieldError("Word {idn} is missing field {field_1}, named {name}".format(
                idn=self.idn,
                field_1=field_index_0_based + 1,
                name=repr_safe(name),
            )) from e

    # TODO:  What are the benefits of the Nit model?  API for storage.
    # def bytes(self):
    #     if self.idn is None:
    #         return bytes()
    #     else:
    #         return qiki.nit.Integer(self.idn).bytes
    #
    # def nits(self):
    #     return (
    #         [N(self.whn), N(self.sbj), N(self.vrb)] +
    #         [N(v) for v in self.obj_values] +
    #         [N(v) for v in self.obj.value_list()]
    #     )

    def __repr__(self):
        return repr(self.to_dict())

    def to_dict(self):
        """
        Make this word into a Python dictionary.

        Named obj's are still named in a sub-dictionary,
        but each value that is itself a word is reduced to its idn.
        This is why the example below has 'parent': 2,
        instead of 'parent': {...another dictionary...}


        EXAMPLE:  {
            'idn': 133,
            'whn': 1460029834816,
            'sbj': 0,
            'vrb': 1,
            'obj_values': [],
            'obj': {
                'name': 'iconify',
                'parent': 2,
                'fields': [166, 203]
            }
        }
        """
        obj_dict = self.obj.to_dict()
        assert all(not isinstance(v, FlikiWord) for v in obj_dict.values())
        return dict(
            idn=self.idn,
            whn=self.whn,
            sbj=self.sbj,
            vrb=self.vrb,
            obj_values=self.obj_values,
            obj=obj_dict,
        )

    def to_dict_no_obj(self):
        """
        Make this word into a Python dictionary.
        """
        return dict(
            idn=self.idn,
            whn=self.whn,
            sbj=self.sbj,
            vrb=self.vrb,
        )
        # SEE:  Dictionary is ordered, https://stackoverflow.com/a/39537308/673991

    def to_json(self):
        """
        Make this word into a list, so json_encode() could make it a line in a .lex.jsonl stream.

        EXAMPLE:
             [133,1460029834816,0,1,2,"iconify",166,203]
             [882,1559479179156,[167,"103620384189003122864"],1408,"pithy"]
        """

        return list(self.to_dict_no_obj().values()) + list(self.obj.to_dict().values())
    # FIXME:  Oops, the example doesn't work, does it.  Fields is a sub-array when it's resolved.
    #         Is the answer to support fields that are arrays somehow?
    #         Could be used for define (array of defines aka fields)
    #         and for bot (array of contributes).

    def jsonl(self):
        """Return a JSON string of the word.  Ready to become a line in the .lex.jsonl file."""
        word_as_json_array = json_encode(self)
        if len(word_as_json_array) > self.MAXIMUM_JSONL_CHARACTERS:
            raise self.StorageError("too long " + repr_safe(len(word_as_json_array)))
        else:
            return word_as_json_array

    def stow(self):
        """
        Assemble a nit for the word.  Stow its json as a new line in the lex file.  Threadsafe.

        Generate the idn and whn parts of the word and nit.
        Caller already supplied sbj, vrb, and obj field sub-nits when the word was instantiated.
        Update the following class variables:  (also threadsafe)
            max_idn
            lines_in_file
            _vrb_from_idn
        """
        with FlikiWord.lock:
            self.idn = FlikiWord.max_idn + 1
            self.whn = milliseconds_since_1970_utc()
            try:
                word_jsonl = self.jsonl()
            except ValueError as e:
                raise self.StorageError("JSONL\n    {e}".format(e=repr_safe(e))) from e
            else:
                try:
                    with open(self.lex_path(), 'a') as f:
                        f.write(word_jsonl + '\n')
                except OSError as e:
                    raise self.StorageError("Open {file}\n    {e}".format(
                        file=self.lex_file_name,
                        e=repr_safe(e),
                    )) from e
                else:
                    # TODO:  Open file in open_lex().  Close in close_lex().  Flush here.
                    #        More efficient.
                    self.line_number = FlikiWord.lines_in_file
                    FlikiWord.max_idn = self.idn
                    FlikiWord.lines_in_file += 1
                    FlikiWord._vrb_from_idn[self.idn] = self.vrb

        # TODO:  Broadcast the new word to other users who are long-polling for it.

        # print("Stowed nit", word_nit_json)
        # EXAMPLE:  [8562,1641478056503,[167,"103620384189003122864"],1440,8557,735,8547]

        # print("Stowed word", json_pretty(self.to_dict()))
        # EXAMPLE:  {
        #     "idn":8562,
        #     "obj":{
        #         "category":735,
        #         "contribute":8557,
        #         "locus":8547
        #     },
        #     "obj_values":[],
        #     "sbj":[
        #         167,
        #         "103620384189003122864"
        #     ],
        #     "vrb":1440,
        #     "whn":1641478056503
        # }

    @classmethod
    def all_words_unresolved(cls):
        """
        Iterate through all words in the lex.  Yield words with unnamed obj's in word.obj_values.

        Raise ReadError if something goes wrong with reading or interpreting the file.
        Every line in the lex file either yields a word or raises an exception.
        Therefore the word count is the same as the line number.

        CAUTION:  Do not stow a word until the iterator ends, due to the class lock being not
                  an RLock - that is, not recursive.  Neither should you nest this function, e.g.:
                      for word_1 in cls.all_words():
                          for word_2 in cls.all_words():   # RACE CONDITION
                              pass
        :rtype: Iterator[:class:`FlikiWord`]
        """

        line_number = None
        with cls.lock:
            try:
                with open(cls.lex_path(), newline=None) as f:
                    line_number = 0
                    for word_json in f:
                        line_number += 1
                        if len(word_json) > cls.MAXIMUM_JSONL_CHARACTERS:
                            raise cls.ReadError("Line {line_number} is too long: {length}".format(
                                length = len(word_json),
                                line_number=line_number,
                            ))
                        else:
                            try:
                                word_list = json.loads(word_json)
                            except json.JSONDecodeError as e:
                                raise cls.ReadError(
                                    "Bad JSON, line {line_number}: {line}\n    {e}".format(
                                        line_number=line_number,
                                        line=word_json[ : 40],
                                        e=repr_safe(e),
                                    )
                                ) from e
                            else:
                                if (
                                    isinstance(word_list, list) and
                                    len(word_list) >= cls.MINIMUM_JSONL_ELEMENTS and
                                    isinstance(word_list[0], int) and
                                    isinstance(word_list[1], int)
                                ):
                                    unresolved_word = cls(*word_list)
                                    unresolved_word.line_number = line_number
                                    yield unresolved_word
                                else:
                                    raise cls.ReadError(
                                        "Malformed line {line_number} - {line}".format(
                                            line_number=line_number,
                                            line=repr_safe(word_json)
                                        )
                                    )
            except OSError as e:
                raise cls.ReadError("OS {file} line {line}\n    {e}".format(
                    file=cls.lex_file_name,
                    line=repr(line_number),   # may be None
                    e=repr_safe(e),
                )) from e

    @classmethod
    def all_words(cls):
        """
        Yield each word resolved with named fields, e.g. word.obj.contribute, word.obj.text

        :rtype: Iterator[:class:`FlikiWord`]
        """
        for each_word in cls.all_words_unresolved():
            each_word.resolve()
            yield each_word

    def is_definition(self):
        return self.sbj == self.idn_of.lex and self.vrb == self.idn_of.define

    def num_fields(self):
        """
        How many fields does this word actually have?  Works whether resolved (named) or not.

        Call on a user-word, not a lex-definition-word.
        """
        return len(self.obj_values) + self.obj.len()

    def is_resolved(self):
        return len(self.obj_values) == 0

    def resolve(self):
        """
        Turn .obj_values into named .obj fields.

        Requires that .idn_of.lex and .idn_of.define have been set.
        For a definition word
        """
        try:
            vrb = self.by_idn[self.vrb]
        except KeyError as e:
            raise self.FieldError("Word {idn} has an undefined verb {vrb_idn}".format(
                idn=self.idn,
                vrb_idn=self.vrb,
            )) from e
        else:
            if self.is_definition():
                '''Definition words don't need resolving.  For one thing they have no fields.'''
            else:
                num_fields_vrb_expected = len(vrb.obj.fields)
                num_fields_obj_actual = len(self.obj_values)
                if num_fields_obj_actual != num_fields_vrb_expected:
                    raise self.FieldError(
                        "Word {idn} has {n_obj} fields {obj_values}, "
                        "but a {vrb_name} word is supposed to have "
                        "{n_vrb} fields ({vrb_names})".format(
                            idn=self.idn,
                            n_obj=num_fields_obj_actual,
                            obj_values=repr_safe(self.obj_values),
                            n_vrb=num_fields_vrb_expected,
                            vrb_names=",".join(self.by_idn[f].obj.name for f in vrb.obj.fields),
                            vrb_name=vrb.obj.name,
                        )
                    )
                for field_idn, field_value in zip(vrb.obj.fields, self.obj_values):
                    field_definition = self.by_idn[field_idn]
                    self.obj.add(field_definition.obj.name, field_value)
                    # TODO:  Use .name_an_obj().  Or D.R.Y. up the call to self.obj.add() there.
                self.obj_values = []

    def check_if_lex_is_referencing_a_user(self):
        if self.sbj == self.idn_of.lex and self.obj.len() == 2 and self.obj.key_list()[0] == 'user':
            self.user_cache(self.obj.user, self.vrb_name(), self.obj.value_list()[1])

    from_user = dict()

    @classmethod
    def user_record(cls, user_idn, property_name, property_value):
        """
        If this property of a user has a new value, store it in both remote and local lexes.

        :param user_idn: e.g. [167,"103620384189003122864"] (authenticated)
                           or [168,"127.0.0.1"] (anonymous)
        :param property_name: e.g. ip_address, user_agent, name, iconify
        :param property_value:
        """
        user_word = UserLex.word_from_idn(user_idn)
        if user_word is None:
            raise cls.FieldError("Invalid user idn", repr_safe(user_idn))

        if user_word.obj.get(property_name, default_value=None) == property_value:
            '''Latest property value is the same, no need to update remote lex or local user-lex.'''
        else:
            try:
                vrb_idn = cls.idn_of.get(property_name)
                vrb_word = cls.by_idn[vrb_idn]
            except KeyError:
                raise cls.FieldError("Undefined user property {name} for {user}".format(
                    name=repr_safe(property_name),
                    user=repr_safe(user_idn),
                ))
            else:
                # TODO:  Encapsulate most of the following user idn decoding and validating logic
                #        in some kind of definition word object.
                #        Hmm how about `Vrb`.  Then instead of the over-used and worn-out `User` I
                #        could make a type called `Sbj`.  This could include humans as well as bots.
                #        This might be part of a desirable partition between user-created "verbs"
                #        and the geeky internal vrb that's part of every word.  A verb might be a
                #        special case of a vrb.
                #        Anyway qiki.Vrb could subclass a qiki.Word and have rich methods for
                #        dealing with its fields.  Scan-time validation could use that too.
                #        qiki.Sbj could be something else.  It's not a word but it wants to
                #        know words that the lex has thrown at it, like name and user-agent.
                #        Then when instantiating a Word, its sbj and vrb properties could become
                #        Sbj and Vrb instances.
                field_words = [cls.by_idn[field_idn] for field_idn in vrb_word.obj.fields]
                if len(field_words) != 2 or field_words[0].obj.name != 'user':
                    raise cls.FieldError(
                        "Invalid user property {name}, fields {fields}, for {user}".format(
                            name=repr_safe(property_name),
                            fields=repr_safe(field_words),
                            user=repr_safe(user_idn),
                        )
                    )
                obj = dict(user=user_idn)
                second_field_type = field_words[1].obj.name
                obj[second_field_type] = property_value

                # Auth.print(
                #     "CHANGED",
                #     user_idn,
                #     property_name,
                #     cls.repr_limited(field_words),
                #     cls.repr_limited(obj)
                # )
                # EXAMPLE:
                #     CHANGED
                #     (167, '110221274882432613660')
                #     iconify
                #     [[166,1478081379890,0,1,2,"user",[]],[170,147 ... (27 more)
                #     {"user":[167,"110221274882432613660"],"url":" ... (89 more)

                cls.create_word_by_lex(vrb_idn, obj)
                cls.user_cache(user_idn, property_name, property_value)

    @classmethod
    def user_cache(cls, user_idn, property_name, property_value):
        """Store a user property in the local UserLex."""
        user_word = UserLex.word_from_idn(user_idn)
        user_word.obj.add(property_name, property_value)

    def vrb_name(self):
        if self.vrb in self.by_idn:
            return self.by_idn[self.vrb].obj.name
        else:
            return "(undefined verb {})".format(self.vrb)

    def validate_definition_word(self):
        """
        Check resolved lex definition for consistency.

        Expect this word to have:  parent, name, fields.
        """
        # NOTE:  self.idn was already validated in all_words_unresolved()
        # NOTE:  self.whn was already validated in all_words_unresolved()
        # NOTE:  self.sbj is validated below, after we know it's not a lex-definition word
        # NOTE:  self.vrb was already validated in resolve()

        if isinstance(self.obj.fields, list):
            for field_index_1_based, field_idn in enumerate(self.obj.fields, start=1):
                try:
                    self.validate_field_definition(field_idn)
                except self.FieldError as e:
                    field_ordinal = "field {i} of {n}".format(
                        i=field_index_1_based,
                        n=len(self.obj.fields)
                    )
                    raise self.FieldError(
                        "{name} definition (idn {idn}) "
                        "{field_ordinal} in {fields}\n"
                        "    {e}".format(
                            name=self.obj.name,
                            idn=self.idn,
                            field_ordinal=field_ordinal,
                            fields=repr_safe(self.obj.fields),
                            e=repr_safe(e),
                        )
                    ) from e
                    # THANKS:  amend exception, https://stackoverflow.com/a/29442282/673991
                    #          (In this case the definition name and idn and field index
                    #          are known here, but they won't be known to
                    #          validate_field_definition() if it raises an exception.)
        else:
            raise self.FieldError(
                "Definition {idn} fields should be a list, not {fields}".format(
                    idn=self.idn,
                    fields=repr_safe(self.obj.fields),
                ))

    def validate_reference_word(self, vrb_from_idn_lookup=None):
        """
        Check a resolved word parts for consistency, especially field references.

        Checks reference words.  A reference word includes:
            - user word
            - lex word that is not a definition
              e.g. when the lex tags a user with their latest user agent

        Not for checking lex definition-words.

        This can be done either on an existing word scanned from the lex,
        or on a new word about to be stowed into the lex.  (self.idn is not needed.)
        """

        if not self.is_resolved():
            raise self.FieldError("Cannot validate unresolved word {word}".format(
                word=repr_safe(self)
            ))

        self.validate_sbj()
        vrb = self.validated_vrb()

        # NOTE:  The following rechecks for consistency between this word's actual named
        #        (i.e. resolved) obj fields and what's expected by virtue of this word's vrb.
        #        This was already done by .resolve() but is done also here for two reasons.
        #        1. In case .resolve() didn't convert unnamed to named objs correctly.
        #        2. Browser-origin words don't pass through .resolve().  They come through some
        #           resolve-like code in .create_word_by_user() which has over-specify and
        #           under-specify exceptions of its own, but we recheck them here.
        #           That function whines about it's repetition of .resolve() code, so here's
        #           some more whining about that.
        num_fields_vrb_expected = len(vrb.obj.fields)
        num_fields_obj_actual = len(self.obj.value_list())
        if num_fields_obj_actual != num_fields_vrb_expected:
            raise self.FieldError(
                "Word {idn} has {n_obj} fields {obj_names}, "
                "but a {vrb_name} word is supposed to have "
                "{n_vrb} fields ({vrb_names})".format(
                    idn=self.idn,
                    n_obj=num_fields_obj_actual,
                    obj_names=self.obj.names(),
                    n_vrb=num_fields_vrb_expected,
                    vrb_names=",".join(self.by_idn[f].obj.name for f in vrb.obj.fields),
                    vrb_name=vrb.obj.name,
                )
            )

        for (field_index_1_based, (field_idn, field_value)) in (
            enumerate(zip(vrb.obj.fields, self.obj.value_list()), start=1)
        ):
            # NOTE:  field_index 0-based is the key to two arrays,
            #            field definition - array of idns pointing to definitions
            #                               This array is in the definition for the verb,
            #                               and specified the type of each field.
            #            field reference - array of unresolved (unnamed) obj parts of each word.
            #        field_idn is the value from the def array, which is the idn of the
            #            definition that says what type the field value should be
            #        field_value is the value from the ref array, could be idn, text, array
            field_ordinal = "field {i} of {n}".format(
                i=field_index_1_based,
                n=len(vrb.obj.fields)
            )
            try:
                self.validate_field_reference(field_idn, field_value, vrb_from_idn_lookup)
            except self.FieldError as e:
                raise self.FieldError("{name} word {idn}, {field_ordinal}\n    {e}".format(
                    name=vrb.obj.name,
                    idn=self.idn,
                    field_ordinal=field_ordinal,
                    e=repr_safe(e),
                )) from e

    def validate_sbj(self):
        if self.sbj == self.idn_of.lex:
            '''
            Ok, the sbj is the lex itself.
            The lex could be:
                defining something, e.g. that 'about' is a child of 'category', 
                or declaring something, e.g. the icon or user agent of a user.
            '''
        elif self.is_user(self.sbj):
            ''' This sbj is a user. '''
        else:
            raise self.FieldError("Malformed sbj {sbj}".format(sbj=repr_safe(self.sbj)))

    @classmethod
    def is_user(cls, maybe_user):
        # TODO:  Instead, pass through UserLex.word_from_idn(), and make that as strict.
        return (
            isinstance(maybe_user, (list, tuple)) and
            len(maybe_user) >= 2 and
            isinstance(maybe_user[0], int) and
            cls.Ancestry(maybe_user[0]).is_offspring_of(cls.idn_of.user)
        )

    @classmethod
    def validate_field_definition(cls, field_idn):
        """
        From a lex-definition word, make sure a field idn points to another definition.

        We assume anything from by_idn[] has proper attributes (parent, name, fields),
        and they're the proper types (int, str, list),
        because all that was checked by resolve_and_remember_definition() before it
        remembered each definition word in by_idn[].
        What we do check here is that the parent and fields refer to definitions that exist.
        Because of forward references, that could not be checked by
        resolve_and_remember_definition()
        """
        # TODO:  Call out forward references.
        if isinstance(field_idn, int):
            try:
                field_def_word = cls.by_idn[field_idn]
            except KeyError as e:
                raise cls.FieldError("Field def {field_idn} is not defined".format(
                    field_idn=field_idn,
                )) from e
            else:
                try:
                    _ = cls.by_idn[field_def_word.obj.parent]
                except KeyError as e:
                    raise cls.FieldError(
                        "Field {field_idn} parent {parent_idn} is not defined".format(
                            field_idn=field_idn,
                            parent_idn=field_def_word.obj.parent,
                        )
                    ) from e
                else:
                    return field_def_word
        else:
            raise cls.FieldError("Field def {field_idn} should be an integer".format(
                field_idn=repr_safe(field_idn),
            ))

    def validated_vrb(self):
        """Return the definition word that this vrb points to.  Or raise a WordError."""
        try:
            return self.by_idn[self.vrb]
        except KeyError as e:
            raise self.WordError("{vrb_idn} is not defined vrb".format(vrb_idn=self.vrb)) from e

    @classmethod
    def validate_field_reference(cls, field_idn, field_value, vrb_from_idn_lookup=None):
        """
        Anything fishy with this field from a reference-word?  Raise FieldError if so.

        The field value comes from a value in a user-word's .obj dictionary-like thing.

        The field definition can be know via a word's vrb.  word.vrb is the idn of a lex-definition
        word.  That vrb_word has a field named 'fields' in its .obj.  That is a list of
        field_idn's which refer to other lex-definition words.

        The founder ancestor of field_idn determines how to validate the field_value.

        All field definitions (lex-define words) should be validated (by
        .validate_field_definition()) before any field references are validated here.

        :param field_idn: - idn of a definition word, specifies what type this field should be
        :param field_value: - value of the field in the wild
        :param vrb_from_idn_lookup: - optional function to convert user word idn to vrb idn
        """
        assert field_idn in cls.by_idn, field_idn
        # NOTE:  Okay to assume field_idn is a valid definition because it came from the
        #        validated fields of a validated definition.
        #        That is because validate_field_definition() checked all that already.

        field_ancestry = cls.Ancestry(field_idn)

        if field_ancestry.founder().idn == cls.idn_of.integer:
            if isinstance(field_value, int):
                '''Ok, an integer field is an int.'''
            else:
                raise cls.FieldError("A {name} field should be an integer, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=repr_safe(field_value),
                ))
        elif field_ancestry.founder().idn == cls.idn_of.text:
            if isinstance(field_value, str):
                '''Ok, a text field is a str.'''
            else:
                raise cls.FieldError("A {name} field should be a string, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=repr_safe(field_value),
                ))
        elif field_ancestry.founder().idn == cls.idn_of.sequence:
            if isinstance(field_value, list):
                '''Ok, a sequence field is like a list.'''
                if all(isinstance(x, int) for x in field_value):
                    '''Ok, a sequence of integers is all we expect and check for.'''
                else:
                    raise cls.FieldError(
                        "A {name} field should be a list of integers, not {value}".format(
                            name=field_ancestry.child().obj.name,
                            value=repr_safe(field_value),
                        )
                    )
            else:
                raise cls.FieldError("A {name} field should be a list, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=repr_safe(field_value),
                ))
        elif field_ancestry.founder().idn == cls.idn_of.noun:
            '''
            The value of a field, whose field-definition is descended from noun, is either:
                the idn of a word whose vrb is the field definition idn
                a list (nit) whose first element (nit.bytes) is the field definition idn
                         and whose second element is an appropriate value
                         But haven't worked out what's appropriate, e.g. google-user value.
            '''
            if isinstance(field_value, int):
                if field_value in cls.by_idn:
                    # NOTE:  This field is supposed to be an idn.
                    #        (because the ancestral founder of field_idn is a noun)
                    #        and the field value is the idn of a lex-definition.
                    referent_ancestry = cls.Ancestry(field_value)
                    if referent_ancestry.is_offspring_of(field_idn):
                        '''Ok, field value is descended from the field definition'''
                    else:
                        raise cls.FieldError(
                            "{ref_name} (idn {value}) "
                            "is a {ref_parent} "
                            "but it is not a {def_name}".format(
                                value=repr_safe(field_value),
                                value_name=repr_safe(field_value),
                                ref_name=referent_ancestry.child().obj.name,
                                ref_parent=referent_ancestry.parent().obj.name,
                                def_name=field_ancestry.child().obj.name,
                            )
                        )
                else:
                    # NOTE:  The field is supposed to be an idn, but it's not that of a definition.
                    #        Could it be the idn of a user word?
                    if vrb_from_idn_lookup is None:
                        '''
                        Ok for now.
                        An int might be a valid idn.
                        Without a way to randomly access a user word's vrb via its idn, 
                        give it the benefit of the doubt.
                        '''
                    else:
                        try:
                            user_word_vrb = vrb_from_idn_lookup(field_value)
                        except KeyError as e:
                            raise cls.FieldError(
                                "Field ref {field_value} is not a {name} idn".format(
                                    field_value=field_value,
                                    name=field_ancestry.child().obj.name,
                                )
                            ) from e
                        else:
                            vrb_ancestry = cls.Ancestry(user_word_vrb)
                            if vrb_ancestry.is_offspring_of_or_same_as(field_idn):
                                '''
                                Ok, the field value is the idn of a word whose vrb 
                                is descended from the field definition idn.
                                Or it IS the field definition idn!  That's okay too.
                                '''
                            else:
                                raise cls.FieldError(
                                    "{value} is the idn of a {vrb_name} word, "
                                    # "which is a {vrb_parent}, "
                                    "but it should be a {def_name} word".format(
                                        value=repr_safe(field_value),
                                        value_name=repr_safe(field_value),
                                        vrb_name=vrb_ancestry.child().obj.name,
                                        vrb_parent=vrb_ancestry.parent().obj.name,
                                        def_name=field_ancestry.child().obj.name,
                                    )
                                )

            elif isinstance(field_value, list):
                if len(field_value) == 0:
                    raise cls.FieldError(
                        "A {field_name} field should not be [] an empty list".format(
                            field_name=cls.by_idn[field_idn].obj.name,
                        )
                    )
                else:
                    sub_idn = field_value[0]
                    try:
                        referent_ancestry = cls.Ancestry(sub_idn)
                    except cls.FieldError as e:
                        raise cls.FieldError(
                            "Field value {field_value} "
                            "is supposed to be a {def_name}\n"
                            "    {e}".format(
                                field_value=repr_safe(field_value),
                                def_name=field_ancestry.child().obj.name,
                                e=repr_safe(e),
                            )
                        ) from e

                    if referent_ancestry.is_offspring_of(field_idn):
                        '''
                        Yay, even though the field value is a complicated nit with sub-nits,
                        its bytes part indicates that it's a descendent of the defined field type.
                        '''
                    else:
                        raise cls.FieldError(
                            "Field value {field_value} is a compound {ref_name}, "
                            "which is not a {def_name}".format(
                                field_value=repr_safe(field_value),
                                ref_name=referent_ancestry.child().obj.name,
                                def_name=field_ancestry.child().obj.name,
                            )
                        )
            else:
                # A noun-founded field was not an int or list.
                raise cls.FieldError(
                    "Field value {field_value} "
                    "should be a {field_name}".format(
                        field_value=repr_safe(field_value),
                        field_name=cls.by_idn[field_idn].obj.name,
                    )
                )
        else:
            raise cls.FieldError("Unable to process a {names} field with value {value}".format(
                names=field_ancestry.names(),
                value=repr_safe(field_value),
            ))

    class Ancestry(object):
        """Wrapper class for the procedural FlikiWord._ancestry() function, and its uses."""
        def __init__(self, child_idn):
            self.words = FlikiWord._ancestry(child_idn)

        def founder(self):
            """
            A founder definition is its own parent.  It is at the top of the ancestry chain.

            The original recursion in _ancestry() continued until it hit one of those.
            A founder has behavior outside the scope of the lex, e.g. integer, text, sequence.
            See the outermost if-tree in validate_field_reference() for the handling of all
            founders.
            """
            return self.words[-1]

        def child(self):
            """Word for the original child_idn."""
            return self.words[0]

        def parent(self):
            if len(self.words) < 2:
                return self.founder()
                # NOTE:  If there's only one word in the ancestry, then
                #        child == parent == founder.
            else:
                return self.words[1]

        def is_offspring_of_or_same_as(self, ancestral_idn):
            """
            Is the original child_idn a descendent of some ancestral_idn?  Or equal to it?

            So the question:  is C descended from A?
            is answered by first computing the entire family history of C,
            then asking if A is among it.
            """
            return any(ancestral_idn == w.idn for w in self.words)

        def is_offspring_of(self, ancestral_idn):
            """
            Is the original child_idn a descendent of some ancestral_idn?

            (1) Being the same (ancestral_idn == self.child()) doesn't count.
            (2) Except, if child_idn was a founder, then do include it.

            Contingency (1) is reflected in the `words[1 : ]` slice.
            Contingency (2) is reflected in the `or ancestral == founder`

            So if a category is called for, any category descendent will suffice (my, their, etc.),
            but not the idn for the definition word of category itself!
            But if a noun is called for, any word will suffice, including noun itself.
            Because noun is a founder definition, i.e. it's own parent.
            """
            return (
                any(ancestral_idn == w.idn for w in self.words[1 : ]) or
                ancestral_idn == self.founder().idn
            )

        def names(self):
            return ",".join(f.obj.name for f in self.words)

    MAX_ANCESTRAL_RECURSION = 10

    @classmethod
    def _ancestry(cls, child_idn, max_depth=MAX_ANCESTRAL_RECURSION):
        """ Return a list of ancestor definition words, child first, founder last.  Recursive. """
        if not isinstance(child_idn, int):
            raise cls.FieldError("{child_idn} is not an idn".format(
                child_idn=repr_safe(child_idn),
            ))
        try:
            child = cls.by_idn[child_idn]
        except KeyError as e:
            raise cls.FieldError("{child_idn} is not defined".format(
                child_idn=child_idn,
            )) from e
        if child.obj.parent == child.idn or max_depth <= 1:
            return [child]
        else:
            return [child] + cls._ancestry(child.obj.parent, max_depth - 1)

    class CreateError(ValueError):
        """Word inputs are missing or wrong.  Raised by create_word_by_user()"""

    class StorageError(ValueError):
        """Word could not be stored.  Raised by stow() and jsonl()"""

    class OpenError(ValueError):
        """Problem with startup.  Raised by open_lex()"""

    class ReadError(ValueError):
        """Problem with reading the lex stream.  Raised by all_words_unresolved()"""

    class WordError(ValueError):
        """Word object has something wrong with it."""

    class FieldError(ValueError):
        """Word object values do not agree with the fields specified by its verb."""


@flask_app.before_first_request
def before_first_request():
    version_report()


@flask_app.before_request
def before_every_request():
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
        Auth.print("REDIRECT from", repr_safe(parts.netloc), "to", repr_safe(new_url))
        return flask.redirect(new_url, code=301)
        # THANKS:  Domain change with redirect, https://stackoverflow.com/a/10964868/673991

        # NOTE:  Apache RewriteRule can redirect http to https
        # EXAMPLE:   in sites-available/example.com
        #     RewriteEngine on
        #     RewriteCond %{SERVER_NAME} =www.example.com [OR]
        #     RewriteCond %{SERVER_NAME} =example.com
        #     RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]


@flask_app.teardown_appcontext
def teardown_application_context(exc=None):
    if exc is not None:
        Auth.print("teardown exception", type(exc).__name__, repr_safe(exc))


class Auth(object):
    """
    Qiki on Flask, generic logging in.

    THANKS:  "is_anonymous() and is_authenticated() are each other's inverse"
             https://stackoverflow.com/a/19533025/673991
    """
    # TODO:  Move to qiki/auth.py?
    # TODO:  Morph this into a Session lex?

    _print_lock = threading.Lock()

    @classmethod
    def print(cls, *args, **kwargs):
        """
        Threadsafe print().  Otherwise Fliki console messages step all over each other.

        SEE:  Alternative, no lock, one string, https://stackoverflow.com/a/33071625/673991
        """
        with cls._print_lock:
            print(*args, **kwargs)
            # EXAMPLE:  OSError: [Errno 22] Invalid argument
            #           A real WTF error message.  Turns out it was coming from a ghost Flask server
            #           I thought I'd already shut down when I closed PyCharm, but I guess I didn't.
            # THANKS:  Shut down a ghost Flask server, https://stackoverflow.com/a/57231562/673991

    def __init__(
        self,
        ip_address_txt,
        user_agent_txt,
        flask_user,
    ):
        self.ip_address_txt = ip_address_txt
        self.user_agent_txt = user_agent_txt
        self.flask_user = flask_user

        if self.flask_user.is_authenticated:
            pass
        elif self.flask_user.is_anonymous:
            pass
        else:
            self.print("User is neither authenticated nor anonymous.")
            return

    @property
    def current_url(self):
        """E.g. '/python/yield'"""
        raise NotImplementedError

    @property
    def login_url(self):
        raise NotImplementedError

    @property
    def logout_url(self):
        raise NotImplementedError

    @abc.abstractmethod
    def form(self, variable_name):
        raise NotImplementedError

    def login_html(self):
        """
        Show a login link or a logout link, as appropriate.  Show the user name if logged in.

        Remember the current URL.  Then if the link is clicked, other code will redirect back to it
        when done with logging in or out.  See that happen at the calls to then_url.get()
        """

        then_url.set(self.current_url)

        if self.flask_user.is_authenticated:
            with web_html.WebHTML('span') as span:
                with span.a(href=self.logout_url) as a:
                    a.text("logout")
                span.text(" ")
                span.text(self.flask_user.name())
                if self.flask_user.is_admin():
                    span.text(" (admin)")
                return str(span)
        elif self.flask_user.is_anonymous:
            with web_html.WebHTML('span') as span:
                with span.a(href=self.login_url) as a:
                    a.text("login")
                return str(span)
        else:
            return "Impossible situation, neither authenticated nor anonymous."

    def create_word_by_user(self, vrb_name, obj_dict):
        FlikiWord.user_record(self.flask_user.idn, 'ip_address', self.ip_address_txt)
        FlikiWord.user_record(self.flask_user.idn, 'user_agent', self.user_agent_txt)
        return FlikiWord.create_word_by_user(self, vrb_name, obj_dict)


class AuthFliki(Auth):
    """ Fliki / Authomatic specific implementation of logging in """
    def __init__(self, ok_to_print=True):
        super(AuthFliki, self).__init__(
            # ip_address_txt=qiki.Text.decode_if_you_must(flask.request.remote_addr),
            # user_agent_txt=qiki.Text.decode_if_you_must(flask.request.user_agent.string),
            ip_address_txt=flask.request.remote_addr,
            user_agent_txt=flask.request.user_agent.string,
            flask_user=flask_login.current_user,
        )
        # THANKS:  User agent fields, https://stackoverflow.com/a/33706555/673991
        # SEE:  https://werkzeug.palletsprojects.com/en/0.15.x/utils/#module-werkzeug.useragents

        auth_anon = (
            "logged in" if self.flask_user.is_authenticated else "" +
            "anonymous" if self.flask_user.is_anonymous else ""
        )
        if ok_to_print:
            self.print(
                "AUTH",
                repr_safe(self.flask_user.idn),
                auth_anon,
            )
            # flask.request.user_agent.platform,
            # flask.request.user_agent.browser,
            # flask.request.user_agent.version,
            # EXAMPLE:  windows chrome 94.0.4606.81
            #           DeprecationWarning: The built-in user agent parser is deprecated and
            #           will be removed in Werkzeug 2.1. The 'platform' property will be 'None'.
            #           Subclass 'werkzeug.user_agent.UserAgent' and set
            #           'Request.user_agent_class' to use a different parser.
        self.path_word = None
        self.browse_word = None

    def hit(self, path_str):
        self.create_word_by_user('browse', dict(url=path_str))

    @property
    def current_url(self):
        return flask.request.url
        # SEE:  path vs url, http://flask.pocoo.org/docs/api/#incoming-request-data

    @property
    def login_url(self):
        return flask.url_for('login')
        # NOTE:  Adding a parameter to the query string makes Authomatic.login()
        #        return None.

    @property
    def logout_url(self):
        return flask.url_for('logout')

    _not_specified = object()   # like None but more obscure, so None CAN be specified

    def form(self, variable_name, default=_not_specified):
        value = flask.request.form.get(variable_name, default)
        if value is self._not_specified:
            raise self.FormVariableMissing("No form variable " + variable_name)
        else:
            return value

    class FormVariableMissing(KeyError):
        """E.g. auth.form('nonexistent variable')"""


class SessionProperty(object):
    def __init__(self, name):
        self.name = name

    def get(self, default_value):
        return flask.session.get(self.name, default_value)

    def set(self, value):
        flask.session[self.name] = value


then_url = SessionProperty('then_url')


@login_manager.user_loader
def user_loader(google_user_id_string):
    # EXAMPLE:  user_loader 103620384189003122864 (Bob Stein's google user id, apparently)
    #           hex 0x59e058e6a6308c8b0 (67 bits)
    #           (It better not be a security thing to air this number like a toynbee tile.)
    new_flask_user = GoogleWord.lex.word_from_index(google_user_id_string)
    # TODO:  Validate with google?  Did authomatic do that for us?
    return new_flask_user


@flask_app.route('/meta/logout', methods=('GET', 'POST'))
@flask_login.login_required
def logout():
    flask_login.logout_user()
    return flask.redirect(then_url.get(flask.url_for('home_or_root_directory')))
    # NOTE:  This default value cannot be specified when the `then_url` variable was instantiated.
    #        Otherwise you'd get this error:
    #            Attempted to generate a URL without the application context being pushed.
    #            This has to be executed when application context is available.


STALE_LOGIN_ERROR_MESSAGE = 'Unable to retrieve stored state!'


@flask_app.route('/meta/login', methods=('GET', 'POST'))
def login():
    response = flask.make_response(" Play ")   # HACK
    login_result = authomatic_global.login(
        authomatic.adapters.WerkzeugAdapter(flask.request, response),
        GOOGLE_PROVIDER,
        # NOTE:  The following don't help persist the logged-in condition, duh, they just rejigger
        #        the brief, ad hoc session supporting the banter with the provider:
        #            session=flask.session,
        #            session_saver=lambda: flask_app.save_session(flask.session, response),
    )

    if login_result:
        if hasattr(login_result, 'error') and login_result.error is not None:
            Auth.print("Login error:", repr_safe(login_result.error))
            # EXAMPLE:
            #     Failed to obtain OAuth 2.0 access token from
            #     https://accounts.google.com/o/oauth2/token!
            #     HTTP status: 400, message: {
            #       "error" : "invalid_grant",
            #       "error_description" : "Invalid code."
            #     }.
            # e.g. after a partial login crashes, trying to resume with a URL such as:
            # http://.../meta/login?state=f45ad ... 4OKQ#
            # EXAMPLE:  Unable to retrieve stored state!
            # EXAMPLE:  The returned state csrf cookie "c5..." doesn't match with the stored state!
            #           Solved maybe by deleting cookies on session_cookie_domain
            #           and apparently the embedded domain too
            # INSTRUCTIONS:
            #           Chrome | Settings | Privacy and security | Cookies and other site data |
            #           See all cookies and site data | Search cookies | unslumping.org
            #           authomatic X <--- maybe that's the one that fixed it
            # TODO:  Delete cookies automatically here.
            #        Apparent cookie names:  authomatic, session
            #        https://stackoverflow.com/questions/14386304/flask-how-to-remove-cookies

            url_has_question_mark_parameters = flask.request.path != flask.request.full_path
            is_stale = str(login_result.error) == STALE_LOGIN_ERROR_MESSAGE
            if is_stale and url_has_question_mark_parameters:
                Auth.print(
                    "Redirect from {from_}\n"
                    "           to {to_}".format(
                        from_=repr_safe(flask.request.full_path),
                        to_=repr_safe(flask.request.path),
                    )
                )
                return flask.redirect(flask.request.path)  # Hopefully not a redirect loop.
            else:
                Auth.print("Whoops, don't know how to handle this login error.")

        else:
            if hasattr(login_result, 'user'):

                logged_in_user = login_result.user
                # TODO:  Instead of this intermediate variable, work out the type warnings such as
                #            Unresolved attribute reference 'name' for class 'str'
                #        using typing hints or annotations.  Then use e.g. login_result.user.name

                if logged_in_user is None:
                    Auth.print("None user!")
                else:
                    if (
                        not hasattr(login_result.user, 'id'  ) or logged_in_user.id   is None or
                        not hasattr(login_result.user, 'name') or logged_in_user.name is None
                    ):                                                             # Try #1
                        # SEE:  about calling user.update() only if id or name is missing,
                        #       http://authomatic.github.io/authomatic/#log-the-user-in

                        # Auth.print(
                        #     "Fairly routine, user data needs updating because it was:",
                        #     repr_attr(logged_in_user, 'id'),
                        #     repr_attr(logged_in_user, 'name'),
                        # )
                        logged_in_user.update()
                        # Auth.print(
                        #     "    Now it's:",
                        #     repr_attr(logged_in_user, 'id'),
                        #     repr_attr(logged_in_user, 'name'),
                        # )
                        # EXAMPLE:
                        #     Fairly routine, user data needs updating because it was: None ''
                        #         Now it's: '103620384189003122864' 'Bob Stein'

                    if logged_in_user.id is None or logged_in_user.name is None:   # Try #2
                        Auth.print(
                            "Freakish!  "
                            "Updated, but something is STILL None, "
                            "user id:", repr_safe(logged_in_user.id),
                            "name:", repr_safe(logged_in_user.name),
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
                        #                 'url': 'https://lh3.googleusercontent.com/a-/AAu...'
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
                        # EXAMPLE:  2021.0314 - logged_in_user.picture
                        #     https://lh3.googleusercontent.com/a-/AOh14GhrEooRaagQh246ncMAtBotUwcgFk3zwXTK0ZTvSQ=s96-c

                        flask_user = GoogleWord.lex.word_from_index(logged_in_user.id)
                        avatar_url = logged_in_user.picture or ''
                        display_name = logged_in_user.name or ''
                        try:
                            FlikiWord.user_record(flask_user.idn, 'name', display_name)
                            FlikiWord.user_record(flask_user.idn, 'iconify', avatar_url)
                        except ValueError as e:
                            Auth.print(repr_safe(e))
                            raise
                        else:
                            flask_login.login_user(flask_user)
                            return flask.redirect(then_url.get(flask.url_for('home_or_root_directory')))
                            # TODO:  Why does Chrome put a # on the end of this URL (empty fragment)?
                            # SEE:  Fragment on redirect, https://stackoverflow.com/q/2286402/673991
                            # SEE:  Fragment of resource, https://stackoverflow.com/a/5283528/673991
            else:
                Auth.print("No user!")
            if hasattr(login_result, 'provider'):
                Auth.print("Provider:", repr_safe(login_result.provider))
    else:
        Auth.print("Strange login limbo, authomatic login() returned", repr_safe(login_result))
        # TODO:  Figure out what it means when we get here.
        #        Anonymous users do not go here -- login() is never called for them.

    return response


@flask_app.route('/module/qiki-javascript/<path:filename>')
def static_response_from_qiki_javascript(filename):
    """
    Make a pseudo-static directory out of the qiki-javascript repo.

    TODO:  There has got to be a better way to use a sibling repo.

    Prevent penetrating into .git, .idea, etc.
    By the way, using .. in the path seems to never even get here.  Possibly it gets 304-redirected.
    """
    only_file_name_no_slashes = r'^\w[\w.]+$'
    # NOTE:  prevents access to .gitignore
    if re.search(only_file_name_no_slashes, filename):
        try:
            return flask.send_file(os_path_qiki_javascript(filename))
        except IOError:
            flask.abort(404, "No such qiki-javascript file " + filename)
    else:
        flask.abort(404, "Not a file in qiki-javascript, " + filename)


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
            return head

    def footer(self):
        self(newlines=True)
        self.jquery(JQUERY_VERSION)
        # TODO:  Can I remove jQuery UI now?
        #        self.js('//ajax.googleapis.com/ajax/libs/jqueryui/{version}/jquery-ui.min.js'.format(
        #            version=JQUERYUI_VERSION
        #        ))
        self.js_stamped(web_path_qiki_javascript('jquery.hotkeys.js'))
        self.js_stamped(web_path_qiki_javascript('qoolbar.js'))
        return self

    @classmethod
    def os_path_from_url(cls, url):
        url_parse = Parse(url)
        # TODO:  Ugh, use urllib.parse and pathlib instead.
        if url_parse.remove_prefix(static_url('')):
            return os_path_static(url_parse.remains)
        elif url_parse.remove_prefix(web_path_qiki_javascript('')):
            return os_path_qiki_javascript(url_parse.remains)
        else:
            raise RuntimeError("Unrecognized url " + url)


@flask_app.route('/favicon.ico')
def favicon_ico():
    return flask.send_file(os_path_static('image/favicon/favicon.ico'))


if __name__ == '__main__':

    @flask_app.route(flask_app.static_url_path + '/' + '<path:path>' + JSONL_EXTENSION)
    def jsonl_mime_type(path):
        """
        MIME type for .jsonl files.

        Reinvent a static web server for development only that puts a Content-Type in
        response headers for any file in the static directory with an extension .jsonl
        This precludes the standard Flask static server for URLs ending in .jsonl

        For production, this route rule doesn't run.  Instead this Apache directive works better:
            AddType application/jsonl+json jsonl

        SEE:  Apache MIME type, https://httpd.apache.org/docs/2.4/mod/mod_mime.html#AddType

        SEE:  Alternative (other than AddType) to associate Apache MIME type with a file extension,
              https://askubuntu.com/a/457474/215820
              Short version:  /etc/mime.types

        SEE:  (my answer) Flask static MIME type, https://stackoverflow.com/a/70598074/673991
        """
        return flask.send_from_directory(
            directory=flask_app.static_folder,
            path=path + JSONL_EXTENSION,
            mimetype=MIME_TYPE_JSONL
        )


@flask_app.route('/', methods=('GET', 'HEAD'))
def home_or_root_directory():
    return unslumping_home(secure.credentials.Options.home_page_title)


def unslumping_home(home_page_title):
    """
    User contributions (quotes, videos, etc.) in categories (mine, others, etc.).

    An unslumping.org inspired application.
    """
    p = Probe()
    auth = AuthFliki(ok_to_print=False)
    p.at("auth")

    with FlikiHTML('html') as html:
        with html.header(home_page_title) as head:
            head.css_stamped(web_path_qiki_javascript('qoolbar.css'))

            head.css_stamped(static_code_url('unslumping.css'))
            # EXAMPLE:  net::ERR_TOO_MANY_RETRIES on this file.
            #           Occasional (10%) of loads on LUnslumping
            # SEE:  Self-signed cert, https://stackoverflow.com/a/58689370/673991

            head.css('https://fonts.googleapis.com/css?family=Literata&display=swap')
            head.css('https://fonts.googleapis.com/icon?family=Material+Icons')
            # noinspection SpellCheckingInspection
            head.raw_text('''
                <link rel="shortcut icon" href="{path}/favicon.ico">
                <link rel="apple-touch-icon" sizes="180x180" href="{path}/apple-touch-icon.png">
                <link rel="icon" type="image/png" sizes="32x32" href="{path}/favicon-32x32.png">
                <link rel="icon" type="image/png" sizes="16x16" href="{path}/favicon-16x16.png">
                <link rel="manifest" href="{path}/site.webmanifest">
                <link rel="mask-icon" href="{path}/safari-pinned-tab.svg" color="#5bbad5">
                <meta name="msapplication-TileColor" content="#da532c">
                <meta name="theme-color" content="#ffffff">
            \n'''.format(path=static_url('image/favicon')))
        # THANKS:  real favicon generator, https://realfavicongenerator.net/
        # NOTE:  Hoping the "shortcut icon" will get browsers to stop hitting root /favicon.ico
        html.body("Loading . . .")
        with html.footer() as foot:
            foot.js('https://cdn.jsdelivr.net/npm/sortablejs@1.9.0/Sortable.js')
            # foot.comment("SEE:  /meta/static/code/Sortable-LICENSE.txt")

            foot.js('https://cdn.jsdelivr.net/npm/jquery-sortablejs@1.0.0/jquery-sortable.js')
            # foot.comment("SEE:  /meta/static/code/jquery-sortable-LICENSE.txt")

            # foot.js('https://cdn.jsdelivr.net/npm/iframe-resizer@4.1.1/js/iframeResizer.min.js')
            foot.js(static_code_url('iframeResizer.js'))
            foot.comment("SEE:  /meta/static/code/iframe-resizer-LICENSE.txt")

            if ENABLE_TALKIFY:
                foot.js('https://use.fontawesome.com/49adfe8390.js')   # req by talkify
                foot.js('https://cdn.jsdelivr.net/npm/talkify-tts@2.6.0/dist/talkify.min.js')

            foot.js_stamped(static_code_url('util.js'))
            foot.js_stamped(static_code_url('lex.js'))
            foot.js_stamped(static_code_url('contribution.js'))
            foot.js_stamped(static_code_url('unslumping.js'))

            with foot.script() as script:

                monty = dict(
                    AJAX_URL=AJAX_URL,
                    INTERACT_VERBS=INTERACT_VERBS,
                    LEX_GET_URL=FlikiWord.lex_url(),
                    login_html=auth.login_html(),
                    me_idn=auth.flask_user.idn,
                    MEDIA_HANDLERS=[
                        static_code_url('media_youtube.js', _external=True),
                        static_code_url('media_instagram.js', _external=True),
                        static_code_url('media_noembed.js', _external=True),
                        static_code_url('media_any_url.js', _external=True),
                        # NOTE:  FIRST matching media handler wins, high priority first,
                        #        catch-all last.
                    ],
                    OEMBED_CLIENT_PREFIX=secure.credentials.Options.oembed_client_prefix,
                    OEMBED_OTHER_ORIGIN=secure.credentials.Options.oembed_other_origin,
                    STATIC_IMAGE=static_url('image'),
                    WHAT_IS_THIS_THING=secure.credentials.Options.what_is_this_thing,
                    ALLOW_ANONYMOUS_CONTRIBUTIONS=ALLOW_ANONYMOUS_CONTRIBUTIONS,
                )
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
                    # NOTE:  The above javascript gyrations (javations? javascryrations?)
                    #        were an attempt to debug Opera Mobile.  To no avail.
                else:
                    script.raw_text('''
                        js_for_unslumping(window, jQuery, qoolbar, MONTY, window.talkify);
                    \n''')

        p.at("foot")

        # NOTE:  NOT calling auth.user_record() here for anonymous users, waiting for user to do
        #        something important, such as rearrange or submit.  This prevents the geological
        #        accumulation of fake bot users for hits to the home page.

        if not auth.flask_user.is_anonymous:
            # NOTE:  Only record page hits for logged-in users.  This avoids all the bot hits
            #        that I assume are doing happy benevolent DigitalOcean monitoring.
            relative_url = flask.request.full_path.rstrip('?')
            # THANKS:  Request url with query, https://stackoverflow.com/a/52131059/673991
            # THANKS:  Parts of request url, https://stackoverflow.com/a/15975041/673991
            auth.hit(relative_url)

        p.at("hit")

        Auth.print("unslumping home: ", p.report())

        html_response = html.doctype_plus_html()
        flask_response = flask.Response(html_response)

        # flask_response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
        # NOTE:  The above hail-mary attempt to fix broken Instagram thumbnails was misguided.
        #        I think I misunderstood the Chrome message about this.  Anyway Firefox
        #        fails too.  A clue is in the Chrome-F12-Network highlighting of the
        #        "same-origin" value in the *instagram* response header, not the fliki header.
        #        In other words, fixing this requires a change on the instagram servers.
        #        They're being stingy with sharing their images now.
        # SEE:  CORS policy change Feb 2021, https://stackoverflow.com/q/66336314/673991
        # SEE:  Possible solution in a deleted answer, is this an instagram proxy?
        #       https://rapidapi.com/restyler/api/instagram40

        return flask_response


@flask_app.route('/meta/lex', methods=('GET', 'HEAD'))
def meta_lex():
    """
    Show the lex and its words in a slightly-analyzed internal representation.

    Less geeky than directly browsing the .lex.jsonl file.
    """
    p = Probe()
    auth = AuthFliki()
    p.at("auth")

    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    with FlikiHTML('html') as html:
        with html.header(title="lex" + secure.credentials.Options.home_page_title) as head:
            head.css_stamped(static_code_url('meta_lex.css'))

            head.css('//fonts.googleapis.com/css?family=Source+Sans+Pro&display=swap')
            # THANKS: link better than import, https://stackoverflow.com/a/12380004/673991
            # THANKS:  Source Sans Pro, https://fonts.google.com/specimen/Source+Sans+Pro

        with html.body(class_='target-environment', newlines=True) as body:

            with body.footer() as foot:
                foot.js_stamped(static_code_url('d3.js'))
                foot.js_stamped(static_code_url('util.js'))
                foot.js_stamped(static_code_url('lex.js'))
                foot.js_stamped(static_code_url('meta_lex.js'))

                with foot.script() as script:
                    script.raw_text('\n')
                    monty = dict(
                        LEX_GET_URL=FlikiWord.lex_url(),
                        NOW=seconds_since_1970_utc(),
                    )
                    script.raw_text('js_for_meta_lex(window, window.$, {json});\n'.format(
                        json=json_pretty(monty)
                    ))

        response = html.doctype_plus_html()
    p.at("html")
    print("meta lex: ", p.report())
    return response


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
        #     oembed_html "/meta/oembed/?id_attribute=1938&url=https%3A%2F%2Ftwitter.com
        #                  %2FICRC%2Fstatus%2F799571646331912192"
        url = flask.request.args.get('url')
        id_attribute = flask.request.args.get('id_attribute', default="(idn unknown)")
        matched_groups = matcher_groups(url, NOEMBED_PATTERNS)
        if matched_groups is not None:
            return noembed_render(url, id_attribute, matched_groups)
        else:
            oembed_dict = noembed_get(url)
            if 'html' in oembed_dict:
                provider_name = oembed_dict.get('provider_name', "((unspecified))")
                but_why = "Though noembed may support it. Provider: " + provider_name
            else:
                error = oembed_dict.get('error', "((for some reason))")
                but_why = "Anyway noembed says: " + error
            Auth.print("Unsupported", repr_safe(url), but_why)
            return error_render(
                message="{domain} - unsupported domain.  {but_why}".format(
                    domain=repr_safe(domain_from_url(url)),
                    but_why=repr_safe(but_why),
                ),
                title=id_attribute,
            )


def noembed_render(url, id_attribute, matched_groups):
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
        )
        with html.head(newlines=True) as head:
            head.title("{id_attribute}".format(id_attribute=id_attribute))
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
        html_response = html.doctype_plus_html()
        flask_response = flask.Response(html_response)
        return flask_response


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


@flask_app.route(AJAX_URL, methods=('POST',))
def ajax():
    p = Probe()
    auth = None
    action = None
    ok_to_print = (
        SHOW_LOG_AJAX_NOEMBED_META or
        flask.request.form.get('action', '_') != 'noembed_meta'
    )

    try:
        auth = AuthFliki(ok_to_print=ok_to_print)
        p.at("auth")

        action = auth.form('action')

        if action == 'noembed_meta':
            url = auth.form('url')
            oembed_dict = noembed_get(url)
            return valid_response('oembed', oembed_dict)

        elif action == 'create_word':
            vrb_name = auth.form('vrb_name')

            if not auth.flask_user.is_authenticated and not ALLOW_ANONYMOUS_CONTRIBUTIONS:
                if vrb_name not in INTERACT_VERBS:
                    return invalid_response("anonymous contributions are not supported")
                # NOTE:  Allowing anonymous interactions, to see if anyone is using the site,
                #        But not remembering edits or rearranges, so unauthenticated users don't
                #        affect other unauthenticated users.  (IP address is HARDLY sufficient.)

            objs_by_name_json = auth.form('objs_by_name')   # nits that follow idn,whn,user,vrb
            obj_dict = json.loads(objs_by_name_json)
            try:
                word = auth.create_word_by_user(vrb_name, obj_dict)
            except ValueError as e:
                auth.print("CREATE WORD ERROR", type(e).__name__, auth.flask_user.idn, repr_safe(e))
                return invalid_response("create_word error")
            else:
                return valid_response('jsonl', word.jsonl())

        else:
            return invalid_response("Unknown action " + action)

    except (KeyError, IndexError, ValueError, TypeError) as e:
        # EXAMPLE:  werkzeug.exceptions.BadRequestKeyError
        # EXAMPLE:  fliki.AuthFliki.FormVariableMissing

        Auth.print("AJAX ERROR", type(e).__name__, repr_safe(e))
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

        return invalid_response("ajax error")

    finally:
        p.at("response")
        if auth is None:   # or not auth.is_online:
            Auth.print("AJAX CRASH: ", p.report())
        else:
            if ok_to_print:
                auth.print("Ajax {action}:  {report}".format(
                    action=repr_safe(action),
                    report=p.report(),
                ))


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

    https://www.saltycrane.com/blog/2009/11/trying-out-retry-decorator-python/
    original from: https://wiki.python.org/moin/PythonDecoratorLibrary#Retry

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
            tries_remaining = tries
            delay_next = delay
            while tries_remaining > 1:
                try:
                    return function_to_retry(*args, **kwargs)
                except exception_to_check as e:
                    Auth.print("{exception}, Retrying in {delay} seconds...".format(
                        exception=repr_safe(e),
                        delay=delay_next,
                    ))
                    time.sleep(delay_next)
                    tries_remaining -= 1
                    delay_next *= delay_multiplier
            return function_to_retry(*args, **kwargs)   # final try, may raise exception

        return retry_looper  # true decorator

    return decorated_function


# FALSE WARNING:  Expected type 'Union[Exception, tuple]', got 'Type[URLError]' instead
#                 because URLError is a OSError is a ... Exception
# noinspection PyTypeChecker
@retry(urllib.error.URLError, tries=4, delay=3, delay_multiplier=2)
def _urlopen_with_retries(url):
    return urllib.request.urlopen(url)

    # EXAMPLE of a _urlopen_with_retries() failure:
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
        Auth.print("json_get gives up", repr_safe(e), url)
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


def valid_response(name=None, value=None):
    return json_encode(dict([
        ('is_valid', True),
        (name, value)
    ]))


def invalid_response(error_message):
    return json_encode(dict(
        is_valid=False,
        error_message=error_message,
    ))


class Git:
    """GitHub glue."""

    SHA_UNAVAILABLE = '(sha unavailable)'
    SHA_FILE_NAME = 'git_sha.txt'

    @classmethod
    def sha(cls):
        try:
            return cls.sha_by_module()
        except ValueError:
            # EXAMPLE:
            #    ValueError: SHA could not be resolved, git returned: b''
            # SEE:  GitHub security oppression,
            #    https://github.blog/2022-04-12-git-security-vulnerability-announced/
            try:
                return cls.sha_by_file()
            except FileNotFoundError:
                return cls.SHA_UNAVAILABLE

    @classmethod
    def sha_by_module(cls):
        return git.Repo(SCRIPT_DIRECTORY).head.object.hexsha

    @classmethod
    def number_uncommitted_files(cls):
        try:
            return len(git.Repo(SCRIPT_DIRECTORY).index.diff(None))
        except git.GitCommandError:
            # EXAMPLE:
            #     git.exc.GitCommandError: Cmd('git') failed due to: exit code(129)
            # SEE:  GitHub security oppression,
            #    https://github.blog/2022-04-12-git-security-vulnerability-announced/
            return 0

    @classmethod
    def sha_by_file(cls):
        with open(os_path_data(cls.SHA_FILE_NAME)) as f:
            return f.read().strip()


def version_report():
    # git_stuff = dict(
    #     sha_excerpt=git.Repo(SCRIPT_DIRECTORY).head.object.hexsha[0 : 7],   # first 7, ala GitHub
    #     num_uncommitted=len(git.Repo(SCRIPT_DIRECTORY).index.diff(None)),
    # )
    git_stuff = dict(
        sha_excerpt=Git.sha()[0 : 7],   # first 7 digits of the latest commit sha, ala GitHub
        num_uncommitted=Git.number_uncommitted_files(),
    )
    if git_stuff['num_uncommitted'] == 0:
        git_report = "{sha_excerpt}".format(**git_stuff)
    else:
        git_report = "{sha_excerpt} ({num_uncommitted} FILES UNCOMMITTED)".format(**git_stuff)

    Auth.print((
        "Fliki {yyyy_mmdd_hhmm_ss}" +
        " - " +
        "git {git_report}" +
        " - " +
        "Python {python_version}" +
        " - " +
        "Flask {flask_version}"
    ).format(
        yyyy_mmdd_hhmm_ss=time_format_yyyy_mmdd_hhmm_ss(seconds_since_1970_utc()),
        git_report=git_report,
        python_version=".".join(str(x) for x in sys.version_info),
        flask_version=flask.__version__,
    ))
    # EXAMPLES:
    #     Fliki 2019.0603.1144.11, git e74a46d9ed, Python 2.7.15.candidate.1, Flask 1.0.3, qiki 0.0.1.2019.0603.0012.15
    #     Fliki 2019.0603.1133.40, git a34d72cdc6, Python 2.7.16.final.0, Flask 1.0.2, qiki 0.0.1.2019.0603.0012.15
    #     Fliki 2019.0822.0932.33 - git 379d8bcd48 - Python 3.7.3.final.0 - Flask 1.1.1 - qiki 0.0.1.2019.0728.1919.04
    #     Fliki 2022.0106.2219.24 - git 39F81D5C31 (2 FILES UNCOMMITTED) - Python 3.9.6.final.0 - Flask 2.0.1


flask_app.config.update(
    SERVER_NAME=secure.credentials.Options.server_domain_port,
    # NOTE:  setting SERVER_NAME has benefits:  url_for() can be used with app_context()
    #                                           Otherwise this raises the exception:
    #                                           RuntimeError: Application was not able to create a
    #                                           URL adapter for request independent URL generation.
    #                                           You might be able to fix this by setting the
    #                                           SERVER_NAME config variable.
    #        setting SERVER_NAME has drawbacks:  alternate domain hits get 404
    #                                            So if you want your site to work on example.com
    #                                            and www.example.com, don't set SERVER_NAME.

    SESSION_COOKIE_DOMAIN=secure.credentials.Options.session_cookie_domain,
    # NOTE:  Without this, two different fliki servers running on different subdomains
    #        could share the same set of session variables.
    # SEE:  Session domain, https://flask.palletsprojects.com/en/1.1.x/config/#SESSION_COOKIE_DOMAIN
    # SEE:  Host-only cookie, set to False, https://stackoverflow.com/a/28320172/673991
)
flask_app.secret_key = secure.credentials.flask_secret_key

GOOGLE_PROVIDER = 'google'
authomatic_global = authomatic.Authomatic(
    {
        GOOGLE_PROVIDER: {
            'class_': authomatic.providers.oauth2.Google,
            'consumer_key': secure.credentials.google_client_id,
            'consumer_secret': secure.credentials.google_client_secret,

            'scope': authomatic.providers.oauth2.Google.user_info_scope,
                # + ['https://gdata.youtube.com']
                # SEE:  get a user's YouTube uploads, https://stackoverflow.com/a/21987075/673991
                #       The gdata.youtube.com field means that logging in for the first time
                #       asks if you want to allow the app to "Manage your YouTube account"

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

FlikiWord.open_lex()

login_manager.anonymous_user = AnonymousWord
login_manager.init_app(flask_app)

if __name__ == '__main__':
    flask_app.run(
        debug=True,

        use_reloader=False,
        # NOTE:  Disable automatic reload when code changes.
        #        Also avoids running twice when clicking the re-run button.

        ssl_context=(
            secure.credentials.Options.path_public_key,
            secure.credentials.Options.path_private_key,
        ),
    )
    # NOTE:  A mostly functional https server, for local development.  You will have to make
    #        a domain name resolve to 127.0.0.1, such as localhost.visibone.com.
    #        You still get "Your connection is not private" in Chrome, and have to use the
    #        Advanced option:  Proceed to localhost ... (unsafe)
    # EXAMPLE:  Failure when internet is down, because users can't be authenticated:
    #       File "C:\Program Files\Python39\lib\socketserver.py", line 452, in __init__
    #         self.server_bind()
    #       File "C:\Program Files\Python39\lib\http\server.py", line 138, in server_bind
    #         socketserver.TCPServer.server_bind(self)
    #       File "C:\Program Files\Python39\lib\socketserver.py", line 466, in server_bind
    #         self.socket.bind(self.server_address)
    #     socket.gaierror: [Errno 11001] getaddrinfo failed
    #
    #     Process finished with exit code 1
    #     (I think this means flask_app.config.update(SERVER_NAME,...) can't be DNS resolved.)

application = flask_app   # export for fliki.wsgi

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
import ipaddress
import json
import logging
import os
import re
import sys
import threading
import time

import traceback
# import uuid

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
import werkzeug.user_agent
import werkzeug.utils

import qiki
from qiki.number import type_name
# import qiki.nit
# from qiki.nit import N
import secure.credentials
import to_be_released.web_html as web_html


AJAX_URL = '/meta/ajax'
JQUERY_VERSION = '3.6.0'   # https://developers.google.com/speed/libraries/#jquery
JQUERYUI_VERSION = '1.12.1'   # https://developers.google.com/speed/libraries/#jquery-ui
DO_MINIFY = False
config_names = ('AJAX_URL', 'JQUERY_VERSION', 'JQUERYUI_VERSION')
config_dict = {name: globals()[name] for name in config_names}      # TODO:  Enumerant class
SCRIPT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))   # e.g. '/var/www/flask'
PARENT_DIRECTORY = os.path.dirname(SCRIPT_DIRECTORY)             # e.g. '/var/www'
GIT_SHA = git.Repo(SCRIPT_DIRECTORY).head.object.hexsha
GIT_SHA_10 = GIT_SHA[ : 10]
# NUM_QOOL_VERB_NEW = qiki.Number(1)
# NUM_QOOL_VERB_DELETE = qiki.Number(0)
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS = 10
MINIMUM_SECONDS_BETWEEN_ANONYMOUS_ANSWERS = 60
THUMB_MAX_WIDTH = 160
THUMB_MAX_HEIGHT = 128
NON_ROUTABLE_IP_ADDRESS = '10.255.255.1'   # THANKS:  https://stackoverflow.com/a/904609/673991
NON_ROUTABLE_URL = 'https://' + NON_ROUTABLE_IP_ADDRESS + '/'   # for testing
SHOW_LOG_AJAX_NOEMBED_META = False
CATCH_JS_ERRORS = False
POPUP_ID_PREFIX = 'popup_'
FINISHER_METHOD_NAME = 'fin'   # see qiki.js
JSON_SEPARATORS_NO_SPACES = (',', ':')
INTERACT_VERBS = [
    'bot',      # |>  global play button
    'start',    # |>  individual media play
    'quit',     # []  ARTIFICIAL, manual stop, skip, or pop-up close
    'end',      # ..  NATURAL, automatic end of the media
    'pause',    # ||  either the global pause or the pause within the iframe
    'resume',   # |>
    'error',    #     something went wrong, human-readable txt
    'unbot',    #     bot ended, naturally or artificially (but not crash)
]
# NOTE:  The above dictionary maps JavaScript names to Lex names.  E.g.
#            javascript:  interact.START(idn, media_seconds);
#            lex:  [me](start)[contribution]
#        It constrains the IDE editor to approved interact verbs.
#        These are not yet among the "relevant" verbs in MONTY.IDN or MONTY.w.
# TODO:  Move to WorkingIdns.__init__() yet still bunch together somehow?
#        Problem is, I'd like to define new ones without necessarily generating words for them,
#        until of course they are used.

IDN_SEQUENCE = secure.credentials.Options.spare_idns[0]
IDN_ADMIN_VERB = secure.credentials.Options.spare_idns[1]
IDN_ADMIN_ASSIGNMENT = secure.credentials.Options.spare_idns[2]
IDN_LOCUS = secure.credentials.Options.spare_idns[3]
IDN_REARRANGE = secure.credentials.Options.spare_idns[4]
IDN_URL = secure.credentials.Options.spare_idns[5]


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
log_formatter = logging.Formatter('%(asc' 'time)s - %(name)s - %(level''name)s - %(message)s')
log_handler.setFormatter(log_formatter)
logger.addHandler(log_handler)
# THANKS:  Log to stdout, http://stackoverflow.com/a/14058475/673991


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
            raise AttributeError(repr(self) + " has no attribute " + repr(item))


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
            return "UNNAMED USER " + json_encode(self.idn)

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

    file_name = 'unslumping.lex.jsonl'
    # NOTE:  This could kinda sorta be basis for the URL of the lex,
    #        which is also the bytes part of the lex's "root" nit.
    # TODO:  Move this name to secure/credentials.py?

    max_idn = None
    lines_in_file = None
    lock = None

    # NOTE:  The following are fleshed out by FlikiWord.open_lex()
    by_idn = dict()
    idn_of = NamedElements()
    _vrb_from_idn = None

    MINIMUM_JSONL_ELEMENTS = 4   # Each word contains at a minimum:  idn, whn, sbj, vrb
    MAXIMUM_JSONL_CHARACTERS = 10000   # No word's JSON string should be longer than this
    VERBS_USERS_MAY_USE = {'contribute', 'caption', 'edit', 'rearrange', 'browse'}.union(INTERACT_VERBS)

    @classmethod
    def file_path(cls):
        return os_path_data(cls.file_name)

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
            for word in cls.all_words_unresolved():   # pass 3:  Make a lookup table of verb idns for all reference words
                if not word.is_definition():
                    cls._vrb_from_idn[word.idn] = word.vrb

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
                    file=cls.file_name,
                    e=str(e),
                )) from e
                # THANKS:  Amend exception, Py3, https://stackoverflow.com/a/29442282/673991
            else:
                raise cls.OpenError("{file} line {line_number}\n    {e}".format(
                    file=cls.file_name,
                    line_number=word.line_number,
                    e=str(e),
                )) from e
        else:
            Auth.print(
                "Scanned",
                cls.lines_in_file, "lines,",
                "max idn", cls.max_idn,
                p.report(),
                sys.getsizeof(cls._vrb_from_idn),
            )
            # Auth.print(
            #     "USERS GALORE, " +
            #     "google:\n" +
            #     json_pretty(GoogleWord.lex) + "\n" +
            #     "anonymous:\n" +
            #     json_pretty(AnonymousWord.lex)
            # )

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
                    name=repr(self.obj.name),
                )
            )
        if not isinstance(self.obj.parent, int):
            raise self.FieldError(
                "Definition {idn}, parent should be an idn, not {parent}".format(
                    idn=self.idn,
                    parent=repr(self.obj.parent),
                )
            )
        if not isinstance(self.obj.fields, list):
            raise self.FieldError(
                "Definition {idn}, fields should be a list, not {fields}".format(
                    idn=self.idn,
                    fields=repr(self.obj.fields),
                )
            )
        if not all(isinstance(field, int) for field in self.obj.fields):
            raise self.FieldError(
                "Definition {idn}, fields should be a list of idns, not {fields}".format(
                    idn=self.idn,
                    fields=repr(self.obj.fields),
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
            print(
                "Forward reference in "
                "{word_description} -- "
                "{part_description} refers to "
                "{referent_description}".format(
                    word_description=word_description,
                    part_description=part_description,
                    referent_description=referent_description,
                    idn_referent=idn_referent,
                )
            )

    @classmethod
    def create_word_by_lex(cls, vrb_idn, obj_dictionary):
        """Instantiate and store a sbj=lex word.   (Not a define word.)"""
        assert vrb_idn != cls.idn_of.define, (
            "Definitions must not result from outside events. " +
            cls.repr_limited(obj_dictionary)
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
        if vrb_name not in cls.VERBS_USERS_MAY_USE:
            raise cls.CreateError("May not create a word with verb " + repr(vrb_name))
        else:
            try:
                vrb_idn = cls.idn_of.get(vrb_name)
                vrb = cls.by_idn[vrb_idn]
            except KeyError as e:
                raise cls.CreateError("Cannot create a word with verb " + repr(vrb_name)) from e
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
                                error_message=str(e),
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

                    # Auth.print("ABOUT TO VALIDATE", repr(word))
                    word.validate_reference_word(cls.vrb_from_idn)
                    # NOTE:  Browser-created words are already resolved.  That is, fields are named.
                    # NOTE:  validate before stow, so invalid words don't get into the file.
                    # NOTE:  idn-to-vrb mapping is used to validate user-word idns.

                    word.stow()

                    word.check_forref_in_reference_word()
                    # NOTE:  Forward reference is near impossible, but anyway it must be checked
                    #        after stowed because only then is word.idn known.
                    return word


    # TODO:  Move that obj naming somewhere more general-purpose.
    # TODO:  Populate a virgin .lex.jsonl with the definitions for the Contribution application.


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
        #         that obviously can never then be lex fields.  Maybe all NamedElements
        #         methods should be obfuscated.  Ending with an underscore makes me want to ralph.

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
                name=repr(name),
            )) from e

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
            raise self.StorageError("too long " + str(len(word_as_json_array)))
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
            self.whn = self.milliseconds_since_1970_utc()
            try:
                word_jsonl = self.jsonl()
            except ValueError as e:
                raise self.StorageError("JSONL\n    {e}".format(e=str(e))) from e
            else:
                try:
                    with open(self.file_path(), 'a') as f:
                        f.write(word_jsonl + '\n')
                except OSError as e:
                    raise self.StorageError("Open {file}\n    {e}".format(
                        file=self.file_name,
                        e=str(e),
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
        # EXAMPLE:  Stowed nit [7519,1633730345229,[167,"103620384189003122864"],202,1911,1435,7515]

        # print("Stowed word", json_pretty(self.to_dict()))
        # EXAMPLE:  Stowed word {"idn":7519,"whn":1633730345229,"sbj":[167,"103620384189003122864"],
        #           "vrb":202,"c...(25 more characters)...":1435,"locus":7515}

        # p.at("writ")
        # print(str(self.idn) + ".", self.vrb_name, "stowed --", p.report())
        # EXAMPLE:  7521. rearrange stowed writ .001s or .000s

    @staticmethod
    def milliseconds_since_1970_utc():
        return int(time_lex.now_word().num * 1000.0)

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
                with open(cls.file_path(), newline=None) as f:
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
                                        e=str(e),
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
                                            line=cls.repr_limited(word_json)
                                        )
                                    )
            except OSError as e:
                raise cls.ReadError("OS {file} line {line}\n    {e}".format(
                    file=cls.file_name,
                    line=repr(line_number),   # may be None
                    e=str(e),
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
                            obj_values=self.repr_limited(self.obj_values),
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
            raise cls.FieldError("Invalid user idn", cls.repr_limited(user_idn))

        if user_word.obj.get(property_name, default_value=None) == property_value:
            '''Latest property value is the same, no need to update remote lex or local user-lex.'''
            # Auth.print("UNCHANGED", user_idn, property_name)
        else:
            try:
                vrb_idn = cls.idn_of.get(property_name)
                vrb_word = cls.by_idn[vrb_idn]
            except KeyError:
                raise cls.FieldError("Undefined user property {name} for {user}".format(
                    name=cls.repr_limited(property_name),
                    user=cls.repr_limited(user_idn),
                ))
            else:
                # TODO:  Encapsulate most of the following logic in some kind of definition word
                #        object.  Hmm how about `Vrb`.  Then instead of the over-used and worn-out
                #        `User` I could make a type called `Sbj`.  This could include humans as
                #        well as bots.
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
                            name=cls.repr_limited(property_name),
                            fields=cls.repr_limited(field_words),
                            user=cls.repr_limited(user_idn),
                        )
                    )
                obj = dict(user=user_idn)
                if property_value is not None:
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
                            fields=repr(self.obj.fields),
                            e=str(e),
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
                    fields=repr(self.obj.fields),
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
            raise self.FieldError("Cannot validate unresolved word {word}".format(word=repr(self)))

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
                    e=str(e),
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
            raise self.FieldError("Malformed sbj {sbj}".format(sbj=self.repr_limited(self.sbj)))

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
                field_idn=repr(field_idn),
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
        # NOTE:  We presume field_idn is a valid definition because it came from the
        #        validated fields of a validated definition.
        #        validate_field_definition() should have checked all that already.

        field_ancestry = cls.Ancestry(field_idn)

        if field_ancestry.founder().idn == cls.idn_of.integer:
            if isinstance(field_value, int):
                '''Ok, an integer field is an int.'''
            else:
                raise cls.FieldError("A {name} field should be an integer, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=cls.repr_limited(field_value),
                ))
        elif field_ancestry.founder().idn == cls.idn_of.text:
            if isinstance(field_value, str):
                '''Ok, a text field is a str.'''
            else:
                raise cls.FieldError("A {name} field should be a string, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=cls.repr_limited(field_value),
                ))
        elif field_ancestry.founder().idn == cls.idn_of.sequence:
            if isinstance(field_value, list):
                '''Ok, a sequence field is a list.'''
                if all(isinstance(x, int) for x in field_value):
                    '''Ok, a sequence of integers is all we expect and check for no.'''
                else:
                    raise cls.FieldError(
                        "A {name} field should be a list of integers, not {value}".format(
                            name=field_ancestry.child().obj.name,
                            value=cls.repr_limited(field_value),
                        )
                    )
            else:
                raise cls.FieldError("A {name} field should be a list, not {value}".format(
                    name=field_ancestry.child().obj.name,
                    value=cls.repr_limited(field_value),
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
                                value=cls.repr_limited(field_value),
                                value_name=cls.repr_limited(field_value),
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
                                        value=cls.repr_limited(field_value),
                                        value_name=cls.repr_limited(field_value),
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
                                field_value=cls.repr_limited(field_value),
                                def_name=field_ancestry.child().obj.name,
                                e=str(e),
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
                                field_value=cls.repr_limited(field_value),
                                ref_name=referent_ancestry.child().obj.name,
                                def_name=field_ancestry.child().obj.name,
                            )
                        )
            else:
                # A noun-founded field was not an int or list.
                raise cls.FieldError(
                    "Field value {field_value} "
                    "should be a {field_name}".format(
                        field_value=cls.repr_limited(field_value),
                        field_name=cls.by_idn[field_idn].obj.name,
                    )
                )
        else:
            raise cls.FieldError("Unable to process a {names} field with value {value}".format(
                names=field_ancestry.names(),
                value=cls.repr_limited(field_value),
            ))

    @staticmethod
    def repr_limited(x):
        """ Like repr() but the output is JSON, compact, and the length is limited. """
        might_be_long = json_encode(x)
        how_long = len(might_be_long)
        max_out = 60
        overhead = 15
        if how_long > max_out:
            show_this_many = max_out - overhead
            omit_this_many = how_long - show_this_many
            return might_be_long[0 : show_this_many] + " ... ({} more)".format(omit_this_many)
        else:
            return might_be_long

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
                child_idn=cls.repr_limited(child_idn),
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


flask_app = flask.Flask(
    __name__,
    static_url_path='/meta/static',
    static_folder='static'
)
# SEE:  "Ideally your web server is configured to serve [static files] for you"
#       https://flask.palletsprojects.com/en/2.0.x/quickstart/#static-files
# EXAMPLE:  Apache settings redundant to the above.  Except mistakenly for /static not /meta/static!
#       Alias /static /var/www/unslumping.org/fliki/static
#       <Directory /var/www/unslumping.org/fliki/static/>
#           Order allow,deny
#           Allow from all
#           Options -Indexes
#       </Directory>

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
        Auth.print("REDIRECT from", parts.netloc, "to", new_url)
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
                self.LEX               = lex.noun('lex').idn
                self.DEFINE            = lex.verb('define').idn
                self.NOUN              = lex.noun('noun').idn
                self.VERB              = lex.noun('verb').idn
                self.AGENT             = lex.noun('agent').idn   # added to repurpose
                self.LISTING           = lex.noun('listing').idn
                self.NAME              = lex.verb('name').idn
                self.BROWSE            = lex.verb('browse').idn
                self.SESSION_OBSOLETE  = lex.verb('session').idn
                self.IP_ADDRESS_OBSOLETE = lex.verb('IP address').idn
                self.PATH              = lex.noun('path').idn
                self.QUESTION_OBSOLETE = lex.noun('question').idn
                self.ANSWER            = lex.noun('answer').idn
                self.TAG               = lex.verb('tag').idn
                self.IP_ADDRESS_TAG    = lex.define(self.TAG, 'ip address tag').idn
                self.USER_AGENT_TAG    = lex.define(self.TAG, 'user agent tag').idn
                self.REFERRER          = lex.verb('referrer').idn
                self.ICONIFY           = lex.verb('iconify').idn
                self.ANONYMOUS_LISTING = lex.define(self.LISTING, 'anonymous').idn
                self.GOOGLE_LISTING    = lex.define(self.LISTING, 'google user').idn
                self.QOOL              = lex.verb('qool').idn

                self.UNSLUMP_OBSOLETE  = lex.verb('unslump').idn
                # CAUTION:  LUnslumping defined more than one of these obsolete 'unslump' verbs
                #           (881 and 948).  And used both in intermingled ways.
                #           Unslumping.org defined it once (21) but never used it.

                self.RESOURCE          = lex.noun('resource').idn
                self.QUOTE             = lex.define(self.RESOURCE, 'quote').idn

                self.CONTRIBUTE        = lex.verb('contribute').idn
                self.CAPTION           = lex.verb('caption').idn

                self.CATEGORY          = lex.verb('category').idn
                self.CAT_MY            = lex.define(self.CATEGORY, 'my').idn
                self.CAT_THEIR         = lex.define(self.CATEGORY, 'their').idn
                self.CAT_ANON          = lex.define(self.CATEGORY, 'anon').idn
                self.CAT_TRASH         = lex.define(self.CATEGORY, 'trash').idn
                self.CAT_ABOUT         = lex.define(self.CATEGORY, 'about').idn
                self.FENCE_POST_RIGHT  = lex.noun('fence post right').idn
                # TODO:  Rename FENCE_POST_END?  Or FENCEPOST_END?  Or FENCEPOST??
                #        Because order could be vertical, e.g. categories,
                #        not to mention right-to-left in arabic/hebrew.
                #        Rename RIGHTMOST?  Or END?

                # self.EDIT_TXT          = lex.verb('edit txt').idn
                # self.CONTRIBUTE_EDIT   = lex.define(self.EDIT_TXT, 'contribute edit').idn
                self.EDIT              = lex.verb('edit').idn

                # lex[lex](self.EXPLAIN, use_already=True)[self.FENCE_POST_RIGHT] = \
                #     u"Represent the contribution to the right of the right-most contribution in a category.", 2
                # lex[lex](self.EXPLAIN, use_already=True)[self.FENCE_POST_RIGHT] = \
                #     u"Use it for a reordering number, instead of a contribution idn. " \
                #     u"Call it a pseudo-contribution-idn. " \
                #     u"So when we say a new contribution goes to the left of this, " \
                #     u"we mean it goes all the way on the right. " \
                #     u"It solves this fence-post-problem: " \
                #     u"when 3 contributions exist already, there are 4 places a new one could go."
                # NOTE:  Oops, these step on each other.  Each thinks it's overwriting the other, because
                #        use_already looks at the latest s,v,o match.

                self.FIELD_FLUB        = lex.verb('field flub').idn   # report of some wrongness from the field

                self.INTERACT          = lex.verb('interact').idn   # UX action


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

    def __init__(self, google_user_id, name=None, icon=None):
        self.id = google_user_id
        self.name = name
        self.icon = icon


class LexFliki(qiki.LexMySQL):

    _credentials = secure.credentials.for_fliki_lex_database

    _IDNS_READ_ONCE_AT_STARTUP = None

    _global_lock = threading.Lock()
    # NOTE:  Redefining the LexSentence singleton lock here, for all the LexFliki instances
    #        (that is, for all the browsing users) limits the resolving of race conditions.
    #        Other LexMySQL classes and instances (if there ever are any) are not involved.

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
                dictionary['sbj_lineage'] = self.sbj.lineage()
                # dictionary['sbj'] = self.sbj.lineage()
                # # NOTE:  Drastic step of clobbering the (almost certain) qstring output of
                # #        Number.to_json(), replacing it with the new improved tentative guess at
                # #        a future syntax of:
                # #            local-idn   colon   remote-number-of-some-sort-opaque-to-us
                dictionary['sbj'] = self.sbj.jsonl()
                dictionary['whn'] = float(self.whn)
                return dictionary

            @property
            def name(self):
                if self.is_lex():
                    return "Lex"
                else:
                    raise NotImplementedError(
                        "WordFlikiSentence #{idn}, {word_repr} has no name.".format(
                            word_repr=repr(self),
                            idn=str(self.idn),
                        )
                    )

            @property
            def is_admin(self):
                if self.is_lex():
                    return False
                else:
                    raise NotImplementedError("WordFlikiSentence " + repr(self) + " is neither admin nor not.")

            # noinspection PyMethodMayBeStatic
            def lineage(self):
                return None

            # noinspection PyMethodMayBeStatic
            def jsonl(self):
                return None

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

            def lineage(self):
                return "{}:{}".format(int(self.meta_idn), int(self.index))

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

            def jsonl(self):
                # return [int(self.meta_idn), int(self.index)]
                # return '{},{}'.format(int(self.meta_idn), int(self.index))
                return [int(self.meta_idn), str(int(self.index))]
                # NOTE:  A Google user id is bigger than 53 bits, hence encoded as a string.
                # SEE:  JavaScript Number.MAX_SAFE_INTEGER,
                #       https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER   # noqa
                #       2**53 - 1 or 9007199254740991 is the maximum safe integer in JavaScript.
                #       Anything bigger should be encoded as a string.

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

            def jsonl(self):
                ip_address_number = self.index
                ip_address_int = int(ip_address_number)
                ip_address_txt = str(ipaddress.ip_address(ip_address_int))
                return [int(self.meta_idn), ip_address_txt]

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
                        # user_agent_object = werkzeug.useragents.UserAgent(user_agent_str)
                        user_agent_object = werkzeug.user_agent.UserAgent(user_agent_str)
                    except AttributeError:
                        parts.append("(indeterminate user agent)")
                    else:
                        # noinspection PyUnresolvedReferences
                        parts.append(user_agent_object.browser)   # "(browser?)")
                        # noinspection PyUnresolvedReferences
                        parts.append(user_agent_object.platform)   # "(platform?)")

                # FIXME:  pip install ua-parser
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
        # TODO:  This code resembles Lex.read_word().  Explain the duplication or avoid it.
        #        Did I start to move this logic to Lex.read_word() and not finish the job?
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


# def connect_lex():
#
#
#     try:
#         lex = LexFliki()
#     except LexFliki.ConnectError as e:
#         print("CANNOT CONNECT", str(e))
#         return None
#     else:
#         return lex


def static_url(relative_path, **kwargs):
    return flask.url_for('static', filename=relative_path, **kwargs)


def static_code_url( relative_path, **kwargs):
    return static_url('code/' + relative_path, **kwargs)


# _ = WorkingIdns(connect_lex()).dictionary_of_ints()   # catch missing ".idn"
# DONE:  Remove this when nits rule.
#        I think this was only done so the CANNOT CONNECT (to MySQL) error appeared
#        when restarting.


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
    BLACK_RIGHT_POINTING_TRIANGLE = '\u25B6'
    VERTICAL_ELLIPSIS = '\u22EE'   # 3 vertical dots, aka &vellip; &#x022ee; &#8942;
    VERTICAL_FOUR_DOTS = '\u205E'   # 4 vertical dots
    HORIZONTAL_LINE_EXTENSION = '\u23AF'


# TODO:  Combine classes, e.g. GoogleUser(flask_login.UserMixin, qiki.Listing)
#        But this causes JSON errors because json can't encode qiki.Number.
#        But there are so many layers to the serialization for sessions there's probably a way.
#        Never found a way to do that in qiki.Number only, darn.
#        All the methods have to be fudged in the json.dumps() caller(s).  Yuck.
# SEE:  http://stackoverflow.com/questions/3768895/how-to-make-a-class-json-serializable


# very_first_request = True


# def setup_application_context():
#     # global very_first_request
#     # if very_first_request:
#     #     very_first_request = False
#     #     FlikiWord.open_lex()
#
#
#     if hasattr(flask.g, 'lex'):
#         Auth.print("WHOOPS, ALREADY SETUP WITH A LEX")
#
#     flask.g.lex = connect_lex()
#     flask.g.is_online = flask.g.lex is not None
#     if flask.g.is_online:
#         lex = flask.g.lex
#
#         def report_dup_def(_, message):
#             Auth.print("DUP DUP", message)
#
#         lex.duplicate_definition_notify(report_dup_def)


@flask_app.teardown_appcontext
def teardown_application_context(exc=None):
    # if hasattr(flask.g, 'lex') and hasattr(flask.g.lex, 'disconnect') and callable(flask.g.lex.disconnect):
    #     if flask.g.is_online:
    #         flask.g.lex.disconnect()
    #         flask.g.pop('lex')
    # FlikiWord.close_lex()
    if exc is not None:
        Auth.print("teardown exception", type_name(exc), str(exc))


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
                # SEE:  get a user's YouTube uploads, https://stackoverflow.com/a/21987075/673991
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
login_manager.anonymous_user = AnonymousWord
# noinspection PyTypeChecker
login_manager.init_app(flask_app)


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
        # this_lex,
        # is_authenticated,
        # is_anonymous,
        ip_address_txt,
        user_agent_txt,
        flask_user,
    ):
        self.lex = None   # this_lex
        # self.is_authenticated = flask_user.is_authenticated
        # self.is_anonymous = flask_user.is_anonymous
        self.ip_address_txt = ip_address_txt
        self.user_agent_txt = user_agent_txt
        self.flask_user = flask_user
        # self.full_disclosure = False

        # self.print("COOKIES!", ",".join(flask.request.cookies.keys()))
        # # EXAMPLE:  session

        # if not self.has_session_qstring:
        #     self.print("NEWBIE", user_agent_txt)   # NOTE:  Should be very common
        #     self.session_new()
        #     # TODO:  Instead of a new session, just record in session vars a few stats
        #     #        Only record if they ever do anything worth recording in the lex.
        #     #        This in preparation to eliminate the torrent of boring anonymous session
        #     #        words in the unslumping.org lex.  Presumably they're from digital ocean
        #     #        monitoring.  But they could be malefactors.
        #     #        Or find some other way to ignore the monitoring traffic.
        #     #        E.g. see what's in access_log.
        #     #        Maybe count newbie events, but don't log the details.
        # else:
        #     try:
        #         session_qstring = self.session_qstring
        #     except (KeyError, IndexError, AttributeError) as e:
        #         self.print("INACCESSIBLE QSTRING", type_name(e), str(e))
        #         self.session_new()
        #     else:
        #         try:
        #             session_uuid = self.session_uuid
        #         except (KeyError, IndexError, AttributeError) as e:
        #             self.print("BAD UUID SESSION VARIABLE", type_name(e), str(e))
        #             self.session_new()
        #         else:
        #             try:
        #                 session_idn = qiki.Number.from_qstring(session_qstring)
        #                 self.session_verb = self.lex[session_idn]
        #             except ValueError:
        #                 self.print("BAD SESSION IDENTIFIER", session_qstring)
        #                 self.session_new()
        #             else:
        #                 if not self.session_verb.exists():
        #                     self.print("NO SUCH SESSION IDENTIFIER", session_qstring)
        #                     self.session_new()
        #                 elif (
        #                     self.session_verb.sbj.idn != self.lex.IDN.LEX or
        #                     self.session_verb.vrb.idn != self.lex.IDN.DEFINE or
        #                     self.session_verb.obj.idn != self.lex.IDN.BROWSE
        #                 ):
        #                     self.print("NOT A SESSION IDENTIFIER", session_qstring)
        #                     self.session_new()
        #                 elif self.session_verb.txt != session_uuid:
        #                     self.print(
        #                         "NOT A RECOGNIZED SESSION",
        #                         session_qstring,
        #                         "is the idn, but",
        #                         self.session_verb.txt,
        #                         "!=",
        #                         session_uuid
        #                     )
        #                     self.session_new()
        #                 else:
        #                     '''old session word is good, keep it'''
        #                     self.print("old session", session_idn, session_qstring, session_uuid)
        #                     # EXAMPLE:  0q83_1C15 0q83_1C15 5eb2298a-902b-446e-ad03-029d93cac76e
        # NOTE:  Giving up on anonymous-contributed content.
        #        So we no longer need to track anonymous users.  Much.
        self.session_verb = None

        if self.flask_user.is_authenticated:
            pass
            # self.qiki_user = self.lex.word_google_class(self.authenticated_id())

            # if not self.qiki_user.is_named:
            #     self.print("NOT A NAMED USER", self.qiki_user.idn)
            #     self.is_authenticated = False
            #     flask_login.logout_user()
            # FIXME:  The above means the user NEVER gets their name.
            #         Maybe they need to be authenticated and unnamed for a bit at the beginning.

            # TODO:  tag session_verb with google user, or vice versa
            #        if they haven't been paired yet,
            #        or aren't the most recent pairing
            #        (or remove that last thing, could churn if user is on two devices at once)
        elif self.flask_user.is_anonymous:
            pass
            # self.qiki_user = self.lex.word_anon_class(self.session_verb.idn)
            # ip_address_int = int(ipaddress.ip_address(ip_address_txt))
            # THANKS:  ip address to 32-bit integer, https://stackoverflow.com/a/22272197/673991
            # self.qiki_user = self.lex.word_anon_class(ip_address_int)
            # TODO:  Tag the anonymous user with the session (like authenticated user)
            #        rather than embedding the session ID so prominently
            #        although, that session ID is the only way to identify anonymous users
            #        so maybe not
        else:
            # self.qiki_user = None
            self.print("User is neither authenticated nor anonymous.")
            return


    @property
    def qoolbar(self):
        qoolbar = qiki.QoolbarSimple(self.lex)
        return qoolbar

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

        if self.flask_user.is_authenticated:
            display_name = self.flask_user.name()   # HACK self.qiki_user.name
            if self.flask_user.is_admin():   # HACK self.qiki_user.is_admin:
                display_name += " (admin)"
            return (
                "<a href='{logout_link}'>"
                    "logout" +
                "</a>"
                " "
                "{display_name}"
            ).format(
                display_name=display_name,
                logout_link=self.logout_url,
            )
        elif self.flask_user.is_anonymous:
            return (
                # "<a href='{login_link}' title='{login_title}'>"
                "<a href='{login_link}'>"
                    "login"
                "</a>"
            ).format(
                # login_title=u"You are " + self.qiki_user.txt,
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

        if self.flask_user.is_anonymous:

            def allowed_word(word):
                # if self.full_disclosure:
                #     return True
                try:
                    is_logged_in = not word.sbj.is_anonymous
                except AttributeError:
                    if word.sbj.idn == self.lex.IDN.LEX:
                        # NOTE:  This test is buried because sbj=lex words are expected to be rare.
                        return True
                    sbj = self.idn(word.sbj)
                    if sbj not in sbj_warnings:
                        sbj_warnings.add(sbj)
                        self.print("sbj", sbj, "is neither user nor lex, starting with", repr(word))
                    return False
                else:
                    return is_logged_in or word.sbj == self.flask_user.idn

            vetted_words = [w for w in words if allowed_word(w)]
            n_removed = len(words) - len(vetted_words)
            if n_removed > 0:
                self.print("Vetting removed", n_removed, "words")
        else:
            vetted_words = words
        return vetted_words

    def vetted_find_by_verbs(self, verbs):
        # TODO:  Would it be feasible to have a pre-formed list of nits with anonymous data scrubbed,
        #        that anonymous users would see?
        #        Would need to augment it with that anonymous users own contributions.
        #        For that matter, feed it to logged-in users too.
        #        And when they open the anonymous category, THEN fetch and render anonymous
        #        contributions
        #        Would still need to determine how much anonymous material there is, for the "(N)".
        #        But that is one datum for everyone.
        #        Except anonymous users who contributed their own stuff, and logged-in users who
        #        moved stuff, would want to see a lesser number in "(N)".
        """
        Generate dictionaries of relevant words and users from the lex.

        The u sub-dictionary contains info on users that appear in the sbj of the vetted words.
        So it does not care whether users visit or log in.  Only if they contribute, edit,
        caption, rearrange, or interact.

        :param verbs:
        :return: e.g. dict(
            u={
                "0q82_12__88888888888888888888_1D0B00":{
                    "is_admin":true,
                    "name_long":"Bob Stein",
                    "name_short":"Bob Stein"
                },
                "0q82_13__8234_1D0300":{
                    "is_admin":false,
                    "name_long":"67.255.7.88 session #52",
                    "name_short":"anon#52"
                },
            },
            w=[
                {
                    "idn":50,
                    "obj":23,
                    "sbj":"0q82_12__8A059E058E6A6308C8B0_1D0B00",
                    "txt":"\u201cAnd when you're in a Slump,\nyou're not in for much fun.\n"
                          "Un-slumping yourself\nis not easily done.\u201d",
                    "vrb":24
                },
                {
                    "idn":51,
                    "obj":50,
                    "sbj":"0q82_12__8A059E058E6A6308C8B0_1D0B00",
                    "txt":"Dr. Seuss, Oh the Places You'll Go",
                    "vrb":25
                },
            ],
        )
        """
        qc = list()
        qc.append(self.lex.query_count)
        vetted_list = self.vet(self.lex.find_words(vrb=verbs, idn_ascending=True))
        qc.append(self.lex.query_count)
        user_table = dict()
        for word in vetted_list:
            # user_qstring = word.sbj.idn.qstring()
            # try:
            #     user_lineage = word.sbj.lineage()
            # except AttributeError:
            #     self.print("Subject doesn't have a lineage", repr(word), repr(word.sbj), word.sbj)
            # else:
            if isinstance(word.sbj, word.sbj.lex.word_user_class):
                # NOTE:  This test was != self.lex.IDN.LEX,
                #        but that didn't exclude other non-user sbj words, e.g. LUnslumping #165
                #        Now we include only user words in the w array.
                sbj_lineage = word.sbj.lineage()
                if sbj_lineage not in user_table:   # conserves number of queries
                    name_short = word.sbj.name
                    meta_idn, index = qiki.Listing.split_compound_idn(word.sbj.idn)
                    # user_table[user_qstring] = dict(
                    user_table[sbj_lineage] = dict(
                        name_short=name_short,
                        name_long=word.sbj.txt,
                        is_admin=word.sbj.is_admin,
                        type_name=type_name(word.sbj),
                        listing_idn=int(meta_idn),
                        listing_index=index,   # e.g. the 21-digit, 67-bit Google user number
                        listing_txt=self.lex[word.sbj.idn.unsuffixed].txt,
                        lineage=sbj_lineage,
                        jsonl=word.sbj.jsonl(),
                        # idn_qstring=user_qstring,
                    )
        qc.append(self.lex.query_count)
        # qc_delta = [qc[i+1] - qc[i] for i in range(len(qc)-1)]
        # TODO:  Bake this timing and query-counting into some kind of code monitoring class
        # self.print("Vetted deltas", ",".join(str(x) for x in qc_delta))

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

    # def me_idn(self):
    #     raise NotImplementedError

    def user_stuff(self):   # cls, auth, ip_address_txt, user_agent_txt):
        """Remember details of a user's interaction."""

        FlikiWord.user_record(self.flask_user.idn, 'ip_address', self.ip_address_txt)
        FlikiWord.user_record(self.flask_user.idn, 'user_agent', self.user_agent_txt)

        # ip_int = FlikiWord.idn_of.ip_address   # int(self.lex.IDN.IP_ADDRESS_TAG)
        # ua_int = FlikiWord.idn_of.user_agent   # int(self.lex.IDN.USER_AGENT_TAG)
        # lex_int = FlikiWord.idn_of.lex   # int(self.lex.IDN.LEX)
        # user_list = self.me_idn()   # HACK self.qiki_user.jsonl()
        #
        # # assert ip_int == FlikiWord.idn_of.ip_address, repr(FlikiWord.idn_of.ip_address)
        # # assert ua_int == FlikiWord.idn_of.user_agent
        # # assert lex_int == FlikiWord.idn_of.lex
        #
        # ip_latest = None
        # ua_latest = None
        # name_latest = None
        # icon_latest = None
        #
        # # TODO:  Instead of the following loop,
        # #        maintain latest ip and ua for (at least some) users in memory
        #
        # for each_word in FlikiWord.all_words():
        #     if each_word.sbj == lex_int and each_word.obj.has('user') and each_word.obj.user == user_list:
        #         if each_word.vrb == ip_int:
        #             ip_latest = each_word.obj.text
        #         elif each_word.vrb == ua_int:
        #             ua_latest = each_word.obj.text
        #         elif each_word.vrb == FlikiWord.idn_of.name:
        #             name_latest = each_word.obj.text
        #         elif each_word.vrb == FlikiWord.idn_of.iconify:
        #             icon_latest = each_word.obj.url
        #
        # Auth.print("User falderal", name_latest, self.me_idn(), self.flask_user.name, ",".join(dir(self.flask_user)))
        # if not self.is_anonymous:
        #     # NOTE:  Redundant to tag anonymous users with IP address
        #     #        because it's part of their user idn.
        #     if self.ip_address_txt != ip_latest:
        #         Auth.print("Was", user_list, ip_latest)
        #         ip_word = self.create_word_by_lex(ip_int, dict(user=user_list, text=self.ip_address_txt))
        #         Auth.print(str(ip_word.idn) + ".", "User", ip_word.obj.user, "ip", ip_word.obj.text)
        # if self.user_agent_txt != ua_latest:
        #     Auth.print("Was", user_list, ua_latest)
        #     ua_word = self.create_word_by_lex(ua_int, dict(user=user_list, text=self.user_agent_txt))
        #     Auth.print(str(ua_word.idn) + ".", "User", ua_word.obj.user, "ua", ua_word.obj.text)

        # parsed = werkzeug.user_agent.UserAgent(w.obj['text'])
        # print(
        #     str(w.idn) + ".",
        #     "User", w.obj['user'],
        #     parsed.platform,
        #     parsed.browser,
        #     parsed.version,
        # )
        # NO THANKS:  https://tedboy.github.io/flask/generated/generated/werkzeug.UserAgent.html
        # SEE:  No UA parsing, https://werkzeug.palletsprojects.com/en/2.0.x/utils/?highlight=user%20agent#useragent-parsing-deprecated   # noqa
        # SEE:  UA parsing, https://github.com/ua-parser/uap-python

    def create_word_by_user(self, vrb_name, obj_dictionary):
        self.user_stuff()
        return FlikiWord.create_word_by_user(self, vrb_name, obj_dictionary)

    # @classmethod
    # def create_word_by_lex(cls, vrb_idn, obj_dictionary):
    #     """Instantiate and store a sbj=lex word.   (Not a define word.)"""
    #     assert vrb_idn != FlikiWord.idn_of.define, "Definitions must not result from outside events."
    #     # assert int(self.lex.IDN.LEX) == FlikiWord.idn_of.lex, repr(FlikiWord.idn_of.lex)
    #     new_lex_word = FlikiWord(
    #         sbj=FlikiWord.idn_of.lex,
    #         vrb=vrb_idn,
    #         **obj_dictionary
    #     )
    #     new_lex_word.stow()
    #     return new_lex_word


class Probe(object):
    """
    Time a series of events.  Optionally count some countable things along the way.

    EXAMPLE:
        p = Probe();

        step1()
        p.at("step1")

        step2()
        p.at("step2")

        step3()
        p.at("step3")

        print("\n".join(p.report_lines()))
    EXAMPLE OUTPUT:
        step1 0.312 s
        step2 4.806 s
        step3 0.006 s
        total 5.125 s
    """
    def __init__(self, countables_initial=None):
        """
        Begin the timing and counting.

        .records is an array of triples:
            unix timestamp (seconds since 1970)
            event name, e.g. "authorization"
            countables dictionary, e.g. dict(queries=3, records=333)

        :param countables_initial: - a dictionary of name:count pairs, some measure other than time.
        """
        self.t_initial = time.time()
        self.c_initial = countables_initial
        self.records = []

    def at(self, event_name="", **kwargs):
        self.records.append((time.time(), event_name, kwargs))

    def report_lines(self):

        def report_line(_event_name, t_delta, countables_late, countables_early):

            def countable_deltas():
                for k, v in countables_late.items():
                    # FALSE WARNING:  Cannot find reference 'get' in 'None'
                    # noinspection PyUnresolvedReferences
                    v_delta = v   if countables_early is None else   v - countables_early.get(k, 0)
                    if v_delta != 0:
                        yield "{v_delta} {k}".format(k=k, v_delta=v_delta)

            times = ["{t_delta:.3f}s".format(t_delta=t_delta).lstrip('0')]
            counts = list(countable_deltas())
            return "{event_name} {commas}".format(
                event_name=_event_name,
                commas=" ".join(times + counts)
            )

        if len(self.records) == 0:
            yield "(no events)"
        else:
            t_prev = self.t_initial
            c_prev = self.c_initial
            for t_event, event_name, countables in self.records:
                yield report_line(event_name, t_event - t_prev, countables, c_prev)
                c_prev = countables
                t_prev = t_event
            if len(self.records) > 1:
                yield report_line("total", t_prev - self.t_initial, c_prev, self.c_initial)

    def report(self):
        return ";  ".join(self.report_lines())


class AuthFliki(Auth):
    """
    Fliki / Authomatic specific implementation of logging in

    .is_online - Do we have a lex?  E.g. False if MySQL is down.

    """
    def __init__(self, ok_to_print=True):
        # setup_application_context()
        # self.is_online = flask.g.is_online   # Do we have a lex?  False if MySQL is down.
        # if self.is_online:

        super(AuthFliki, self).__init__(
            # this_lex=flask.g.lex,
            # is_authenticated=self.flask_user.is_authenticated,
            # is_anonymous=self.flask_user.is_anonymous,
            ip_address_txt=qiki.Text.decode_if_you_must(flask.request.remote_addr),
            user_agent_txt=qiki.Text.decode_if_you_must(flask.request.user_agent.string),
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
                # self.qiki_user.idn.qstring(),
                json_encode(self.flask_user.idn),
                auth_anon,
                # self.qiki_user.name,
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

    # def me_idn(self):
    #     if self.is_authenticated:
    #         # return tuple((FlikiWord.idn_of.google_user, str(self.flask_user.get_id())))
    #         return self.flask_user.idn
    #     else:
    #         return tuple((FlikiWord.idn_of.anonymous, str(flask.request.remote_addr)))

    def hit(self, path_str):
        self.create_word_by_user('browse', dict(url=path_str))

        # path_str = flask.request.full_path
        # if path_str.startswith('/'):
        #     path_str = path_str[1 : ]
        #     # NOTE:  Strip leading slash so old hits still count
        #
        # self.path_word = self.lex.define(
        #     self.lex.IDN.PATH,
        #     qiki.Text.decode_if_you_must(path_str)
        # )
        # self.browse_word = self.lex.create_word(
        #     sbj=self.qiki_user,
        #     vrb=self.session_verb,
        #     obj=self.path_word,
        #     use_already=False,
        # )
        # # TODO:  Nit incarnation -- sbj=lex, vrb=hit, obj=[user, path idn]
        # this_referrer = flask.request.referrer
        # if this_referrer is not None:
        #     self.lex.create_word(
        #         sbj=self.qiki_user,
        #         vrb=self.lex.IDN.REFERRER,
        #         obj=self.browse_word,
        #         txt=qiki.Text.decode_if_you_must(this_referrer),
        #         use_already=False,   # TODO:  Could be True?  obj should be unique.
        #     )

    SESSION_QSTRING = 'qiki_session_qstring'   # where we store the session verb's idn
    SESSION_UUID = 'qiki_session_uuid'   # where we store the session verb's idn
    SESSION_THEN_URL = 'then_url'

    # def unique_session_identifier(self):
    #     return str(uuid.uuid4())
    #     # NOTE:  Something that didn't work:  return flask.session['_id']
    #     #        I only saw the '_id' variable after googly login anyway.
    #     #        See https://stackoverflow.com/a/43505668/673991
    #
    # @property
    # def session_qstring(self):
    #     return flask.session[self.SESSION_QSTRING]
    #     # CAUTION:  May raise KeyError
    #
    # @session_qstring.setter
    # def session_qstring(self, qstring):
    #     flask.session[self.SESSION_QSTRING] = qstring
    #
    # @property
    # def has_session_qstring(self):
    #     # FIXME:  Broken in Firefox?  Reloading forgets session variables, starts new session.
    #     #         Final straw before abandoning anonymous tracking.
    #     return self.SESSION_QSTRING in flask.session
    #
    # @property
    # def session_uuid(self):
    #     return flask.session[self.SESSION_UUID]
    #
    # @session_uuid.setter
    # def session_uuid(self, the_uuid):
    #     flask.session[self.SESSION_UUID] = the_uuid

    @property
    def has_session_uuid(self):
        return self.SESSION_UUID in flask.session

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
        return flask.url_for('login')
        # NOTE:  Adding a parameter to the query string makes Authomatic.login()
        #        return None.

    @property
    def logout_url(self):
        return flask.url_for('logout')

    @property
    def then_url(self):
        """Get next URL from session variable.  Default to home."""
        then_url_default = flask.url_for('home_or_root_directory')
        then_url_actual = flask.session.get(self.SESSION_THEN_URL, then_url_default)
        return then_url_actual

    @then_url.setter
    def then_url(self, new_url):
        flask.session[self.SESSION_THEN_URL] = new_url

    _not_specified = object()   # like None but more obscure, so None CAN be specified

    class FormVariableMissing(KeyError):
        """E.g. auth.form('nonexistent variable')"""

    def form(self, variable_name, default=_not_specified):
        value = flask.request.form.get(variable_name, default)
        if value is self._not_specified:
            raise self.FormVariableMissing("No form variable " + variable_name)
        else:
            return value

    @classmethod
    def form_keys(cls):
        return flask.request.form.keys()

    def convert_unslump_words(self, words):
        """Account for an archaic verb in the lex:  make 'unslump' look like 'contribute'. """
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

    def idn_from_name(self, vrb_name):
        if vrb_name == 'rearrange':
            return IDN_REARRANGE
        else:
            return int(self.lex[vrb_name].idn)


# def is_qiki_user_anonymous(user_word):
#     # return isinstance(user_word, AnonymousQikiUser)
#     try:
#         return user_word.is_anonymous
#     except AttributeError:
#         return False


class SessionVariableName(object):
    QIKI_USER = 'qiki_user'


@login_manager.user_loader
def user_loader(google_user_id_string):
    # EXAMPLE:  user_loader 103620384189003122864 (Bob Stein's google user id, apparently)
    #           hex 0x59e058e6a6308c8b0 (67 bits)
    #           qiki 0q8A_059E058E6A6308C8B0 (9 qigits)
    #           (Yeah well it better not be a security thing to air this number like a toynbee tile.)
    new_flask_user = GoogleWord.lex.word_from_index(google_user_id_string)
    # TODO:  Validate with google?  Did authomatic do that for us?
    return new_flask_user


@flask_app.route('/meta/logout', methods=('GET', 'POST'))
@flask_login.login_required
def logout():
    flask_login.logout_user()
    return flask.redirect(get_then_url())


def get_then_url():
    """Get next URL from session variable.  Default to home."""
    then_url_default = flask.url_for('home_or_root_directory')
    then_url_actual = flask.session.get(AuthFliki.SESSION_THEN_URL, then_url_default)
    # TODO:  Make this work better if a user has multiple tabs open at once.
    #        sessionStorage?
    # SEE:  Tab-specific user data, https://stackoverflow.com/q/27137562/673991
    return then_url_actual


# def set_then_url(then_url):
#     flask.session[AuthFliki.SESSION_THEN_URL] = then_url
# NOTE:  set_then_url() is never needed.  See instead AuthFliki.then_url property setter.

# FALSE WARNING (several places):  Unresolved attribute reference 'name' for class 'str'
# no noinspection PyUnresolvedReferences
@flask_app.route('/meta/login', methods=('GET', 'POST'))
def login():
    # setup_application_context()
    # if not flask.g.is_online:
    #     return "offline"
    #
    # lex = flask.g.lex

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
            Auth.print("Login error:", str(login_result.error))
            # EXAMPLE:
            #     Failed to obtain OAuth 2.0 access token from https://accounts.google.com/o/oauth2/token!
            #     HTTP status: 400, message: {
            #       "error" : "invalid_grant",
            #       "error_description" : "Invalid code."
            #     }.
            # e.g. after a partial login crashes, trying to resume with a URL such as:
            # http://.../meta/login?state=f45ad ... 4OKQ#
            # EXAMPLE:  Unable to retrieve stored state!
            # EXAMPLE:  The returned state csrf cookie "c5...2b" doesn't match with the stored state!
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
            is_stale = str(login_result.error) == STALE_LOGIN_ERROR
            if is_stale and url_has_question_mark_parameters:
                Auth.print(
                    "Redirect from {from_}\n"
                    "           to {to_}".format(
                        from_=flask.escape(flask.request.full_path),
                        to_=flask.escape(flask.request.path),
                    )
                )
                return flask.redirect(flask.request.path)  # Hopefully not a redirect loop.
            else:
                Auth.print("Whoops")
                # TODO:  WTF "Unexpected argument"?  It's supposed to take a string.
                # noinspection PyArgumentList
                response.set_data("Whoops")
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
                        Auth.print(
                            "Fairly routine, user data needed updating",
                            repr_attr(logged_in_user, 'id'),
                            repr_attr(logged_in_user, 'name'),
                        )
                        # EXAMPLE:  Fairly routine, user data needed updating None ''

                        logged_in_user.update()
                        # SEE:  about calling user.update() only if id or name is missing,
                        #       http://authomatic.github.io/authomatic/#log-the-user-in

                    if logged_in_user.id is None or logged_in_user.name is None:   # Try #2
                        Auth.print(
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

                        # flask_user = GoogleFlaskUser(logged_in_user.id, logged_in_user.name, logged_in_user.picture)

                        flask_user = GoogleWord.lex.word_from_index(logged_in_user.id)

                        # Auth.print("Ephemeris", FlikiWord.repr_limited(flask_user))
                        # EXAMPLE:  Ephemeris {"idn":[167,"103620384189003122864"],"obj":{" ... (332 more)
                        # qiki_user = lex.word_google_class(logged_in_user.id)

                        # picture_size_string = url_var(logged_in_user.picture, 'sz', '0')
                        # try:
                        #     picture_size_int = int(picture_size_string)
                        # except ValueError:
                        #     picture_size_int = 0
                        # avatar_width = qiki.Number(picture_size_int)
                        # NOTE:  avatar_width is always 0
                        #
                        avatar_url = logged_in_user.picture or ''
                        display_name = logged_in_user.name or ''

                        # Auth.print("Logging in", qiki_user.index, qiki_user.jsonl())
                        # EXAMPLE:   Logging in 0q8A_059E058E6A6308C8B0 [167, '103620384189003122864']

                        # lex[lex](lex.IDN.ICONIFY, use_already=True)[qiki_user.idn] = (
                        #     avatar_width,
                        #     avatar_url
                        # )
                        # lex[lex](lex.IDN.NAME, use_already=True)[qiki_user.idn] = display_name
                        # NOTE:  Above bracket notation is falling out of my favor,
                        #        in spite of how clever and visionary and creative it made me feel.
                        #        I may be procedural down to my ever-loving soul.

                        # lex.create_word(
                        #     sbj=lex.IDN.LEX,
                        #     vrb=lex.IDN.ICONIFY,
                        #     use_already=True,
                        #     obj=qiki_user,
                        #     num=avatar_width,
                        #     txt=avatar_url,
                        # )
                        # lex.create_word(
                        #     sbj=lex.IDN.LEX,
                        #     vrb=lex.IDN.NAME,
                        #     use_already=True,
                        #     obj=qiki_user,
                        #     txt=display_name,
                        # )
                        try:
                            FlikiWord.user_record(flask_user.idn, 'name', display_name)
                            FlikiWord.user_record(flask_user.idn, 'iconify', avatar_url)
                        except ValueError as e:
                            Auth.print(str(e))
                            raise
                        else:
                            flask_login.login_user(flask_user)
                            return flask.redirect(get_then_url())
                            # TODO:  Why does Chrome put a # on the end of this URL (empty fragment)?
                            # SEE:  Fragment on redirect, https://stackoverflow.com/q/2286402/673991
                            # SEE:  Fragment of resource, https://stackoverflow.com/a/5283528/673991
            else:
                Auth.print("No user!")
            if hasattr(login_result, 'provider'):
                Auth.print("Provider:", repr(login_result.provider))
    else:
        '''Is this where anonymous users go?'''
        pass
        # Auth.print("not logged in", repr(login_result))
        # EXAMPLE:  None (e.g. with extraneous variable on request query, e.g. ?then_url=...)

    return response


def repr_attr(z, attribute_name):
    """Represent the attribute of an object in a safe way, even if it has no such attribute."""
    if hasattr(z, attribute_name):
        return repr(getattr(z, attribute_name))
    else:
        return "Undefined"


class TestReprAttr:
    string = "string"
    none = None
assert  "'string'" == repr_attr(TestReprAttr, 'string')
assert      "None" == repr_attr(TestReprAttr, 'none')
assert "Undefined" == repr_attr(TestReprAttr, 'undefined')


def url_var(url, key, default):
    """
    Look up a variable from a URL query string.

    If redundant values, gets the last.

    :param url: - e.g. 'https://example.com/?foo=bar'
    :param key:                      - e.g. 'foo'
    :param default:                      - e.g. 'bar'
    :return:                             - e.g. 'bar'
    """
    # THANKS:  Parse URL query-string, http://stackoverflow.com/a/21584580/673991
    the_parts = urllib.parse.urlsplit(url)
    the_dict = urllib.parse.parse_qs(the_parts.query)
    the_value = the_dict.get(key, [default])[-1]
    return the_value
assert 'bar' == url_var('https://example.com/?foo=bar', 'foo', 'qux')
assert 'qux' == url_var('https://example.com/',         'foo', 'qux')


@flask_app.route('/module/qiki-javascript/<path:filename>')
def static_response_from_qiki_javascript(filename):
    """
    Make a pseudo-static directory out of the qiki-javascript repo.

    TODO:  There has got to be a better way to use a sibling repo.

    Prevent penetrating into .git, .idea, etc.
    TODO:  Prevent nonexistent
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
    # return werkzeug.utils.safe_join(SCRIPT_DIRECTORY, 'data', file_name)


def os_path_workshop(file_name):
    return werkzeug.utils.safe_join(SCRIPT_DIRECTORY, 'workshop', file_name)


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
            # head.css_stamped(web_path_qiki_javascript('qoolbar.css'))
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


@flask_app.template_filter('cache_bust')
def cache_bust(s):
    return FlikiHTML.url_stamp(s)


@flask_app.route('/favicon.ico')
def favicon_ico():
    return flask.send_file(os_path_static('image/favicon/favicon.ico'))


@flask_app.route('/', methods=('GET', 'HEAD'))
def home_or_root_directory():
    return unslumping_home(secure.credentials.Options.home_page_title)


# @flask_app.route('/meta/contrib', methods=('GET', 'HEAD'))
# def meta_contrib():
#     return unslumping_home(secure.credentials.Options.home_page_title)


def unslumping_home(home_page_title):
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
    auth = AuthFliki(ok_to_print=False)

    # if not auth.is_online:
    #     return "lex database offline"
    # if not auth.is_enough_anonymous_patience(MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS):
    #     return "wait a bit"

    # q_start = auth.lex.query_count

    # auth.hit(auth.current_path)
    # NOTE:  Commented out to suppress early churn from all my hits.

    with FlikiHTML('html') as html:
        with html.header(home_page_title) as head:
            head.css_stamped(web_path_qiki_javascript('qoolbar.css'))

            head.css_stamped(static_code_url('contribution.css'))
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
            \n'''.format(path=static_url('image/favicon')))   # was path='/meta/static/image/favicon'
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

            # foot.js('https://use.fontawesome.com/49adfe8390.js')   # req by talkify
            # foot.js('https://cdn.jsdelivr.net/npm/talkify-tts@2.6.0/dist/talkify.min.js')
            # NOTE:  Commenting the above lines out is how talkify is disabled.
            #        Might want to revive it someday,
            #        because talkify voices seemed better than the standard browser voices.

            foot.js_stamped(static_code_url('util.js'))
            # foot.js_stamped(static_code_url('qiki.js'))
            foot.js_stamped(static_code_url('lex.js'))
            # foot.js_stamped(static_code_url('contribution.js'))
            foot.js_stamped(static_code_url('unslumping.js'))

            with foot.script() as script:

                # monty = contribution_dictionary(auth)
                monty = dict()

                monty.update(dict(
                    AJAX_URL=AJAX_URL,
                    login_html=auth.login_html(),
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
                        # NOTE:  FIRST matching media handler wins, high priority first,
                        #        catch-all last.
                    ],
                    POPUP_ID_PREFIX=POPUP_ID_PREFIX,
                    STATIC_IMAGE=static_url('image'),
                    me_idn=auth.flask_user.idn,   # HACK was auth.qiki_user.jsonl(),
                    INTERACT_VERBS=INTERACT_VERBS,
                ))
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

        t_stuff = time.time()

        # NOTE:  NOT calling auth.user_stuff() here for anonymous users, waiting for user to do something important,
        #        such as rearrange or submit.  This prevents the geological accumulation of
        #        fake bot users for hits to the home page.

        if not auth.flask_user.is_anonymous:
            # NOTE:  Only record page hits for logged-in users.  This avoids all the bot hits
            #        that I assume are doing happy benevolent DigitalOcean monitoring.
            relative_url = flask.request.full_path.rstrip('?')
            # THANKS:  Request url with query, https://stackoverflow.com/a/52131059/673991
            # THANKS:  Parts of request url, https://stackoverflow.com/a/15975041/673991
            auth.hit(relative_url)

        t_end = time.time()
        # q_end = auth.lex.query_count
        Auth.print("unslumping home {t1:.3f} {t2:.3f} sec".format(
            # q=q_end - q_start,
            t1=t_stuff - t_start,
            t2=t_end - t_stuff,
        ))
        # TODO:  If t2 gets too big, start remembering latest user stuff.

        html_response = html.doctype_plus_html()
        flask_response = flask.Response(html_response)
        # flask_response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
        # NOTE:  This hail-mary attempt to fix broken Instagram thumbnails was misguided.
        #        I think I misunderstood the Chrome message about this.  Anyway Firefox
        #        fails too.  A clue is in the Chrome-F12-Network highlighting of the
        #        "same-origin" value in the *instagram* response header, not the fliki header.
        #        In other words, fixing this requires a change on the instagram servers.
        #        They're being stingy with sharing their images now.
        # SEE:  CORS policy change Feb 2021, https://stackoverflow.com/q/66336314/673991
        # SEE:  Possible solution in a deleted answer, is this an instagram proxy?
        #       https://rapidapi.com/restyler/api/instagram40
        return flask_response


def contribution_dictionary(auth, more_verb_idns=None):
    """Put the relevant contribution information from the lex into a dictionary."""
    # if not auth.is_online:
    #     return dict(error="lex database offline")
    # if not auth.is_enough_anonymous_patience(MINIMUM_SECONDS_BETWEEN_ANONYMOUS_QUESTIONS):
    #     return dict(error="wait a bit")

    verbs = []
    verbs += auth.get_category_idns_in_order()
    verbs += [
        auth.lex.IDN.CONTRIBUTE,
        auth.lex.IDN.UNSLUMP_OBSOLETE,
        auth.lex.IDN.CAPTION,
        auth.lex.IDN.EDIT,
    ]
    if more_verb_idns is not None:
        verbs += more_verb_idns



    words_for_js = auth.vetted_find_by_verbs(verbs)
    words_for_js['w'] = auth.convert_unslump_words(words_for_js['w'])



    cat_words = [{
        'idn': idn,
        'sbj': auth.lex[idn].sbj.idn,
        'vrb': auth.lex[idn].vrb.idn,
        'obj': auth.lex[idn].obj.idn,
        'txt': auth.lex[idn].txt,
    } for idn in auth.get_category_idns_in_order()]

    monty = dict(
        # me_idn=auth.qiki_user.idn.qstring(),
        # me_lineage=auth.qiki_user.lineage(),
        me_idn=auth.flask_user.idn,
        me_txt=auth.flask_user.name(),
        is_anonymous=auth.flask_user.is_anonymous,
        URL_HERE=auth.current_url,
        IDN=auth.lex.IDN.dictionary_of_ints(),
        NOW=float(time_lex.now_word().num),
        cat_words=cat_words,
    )
    monty.update(words_for_js)
    return monty


@flask_app.route('/meta/contribution_json', methods=('GET', 'HEAD'))
def meta_contribution_json():
    auth = AuthFliki()

    # if not auth.is_online:
    #     return dict(error="lex database offline")
    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    monty = contribution_dictionary(auth)
    return flask.Response(json_pretty(monty), mimetype='application/json')


# IDN_WHN_ABSOLUTE = -1
# IDN_WHN_RELATIVE = -2
# IDN_SEQUENCE = -3   # bot playlist sequence
# IDN_ADMIN_ASSIGNMENT = -4
# IDN_ADMIN_VERB = -5
# IDN_STARTER_ALIAS = -6


MIME_TYPE_TRIPLE = 'application/javascript'
MIME_TYPE_NIX    = 'application/javascript'
# MIME_TYPE_JSONL  = 'text/x.jsonl+json'
# MIME_TYPE_JSONL  = 'application/jsonl'   # Chrome won't display, just downloads MULTIPLE TIMES!
MIME_TYPE_JSONL  = 'application/jsonl+json'   # Chrome displays like text/plain
# SEE:  MIME type for newline-terminated json, https://stackoverflow.com/q/51690624/673991
#       text/plain; charset=utf8
#       application/x-ndjson
#       application/x-jsonlines
#       application/jsonlines
# SEE:  MIME type for newline-terminated json, https://stackoverflow.com/q/59938644/673991
#       application/json-lines
#       application/jsonl
#       application/x-...
# SEE:  x. versus x-, https://en.wikipedia.org/wiki/Media_type#Unregistered_tree
#       including discouragement for using either one.
# SEE:  +json suffix, https://en.wikipedia.org/wiki/Media_type#Suffix
# SEE:  JSON Lines, .jsonl, https://jsonlines.org/
# SEE:  Newline Delimited JSON, http://ndjson.org/
# SEE:  Assigned mime types, iana.org/assignments/media-types/media-types.xhtml


@flask_app.route('/meta/nits', methods=('GET', 'HEAD'))
def meta_nits():
    """
    Recast the 7-tuple words in the LexMySQL into a new syntax, based on nits.

    URL arguments:
        before_file - THIS STRING SHOULD END WITH A NEWLINE
        after_file
        before_assign
        argot=triple   (default)
        argot=nix
        argot=jsonl               (send file .lex.jsonl)
        argot=jsonl&mysql_jsonl
        argot=nix,triple   (example of multiple argots for comparison)

    Argot is the dialect of the output.
        triple - JavaScript or Python or maybe C code
        nix - also js/py but dict/associative array entries with nested calls to N()
        jsonl - newline-separated JSON of nested arrays of integers and strings, sorted by idn

    Examples:
        triple
            contribute = locus(1408, "contribute", user, text);
            contribute(882, u0, "pithy");
        nix
            1408: N(1562335912940,201, 'contribute', 166, 4),
            882: N(1559479179156,1408, N(167,103620384189003122864), 'pithy'),
        jsonl
            [882,1559479179156,[167,"103620384189003122864"], 1408,"pithy"]
            [1408,1562335912940,0, 1,201,"contribute",4]

    """
    p = Probe()
    # TODO:  AuthFliki.probe = Probe(overall_context=inspect.getouterframes()[1][3])
    #        https://stackoverflow.com/a/2654130/673991

    before_file = flask.request.args.get('before_file', '')
    after_file = flask.request.args.get('after_file', '')
    before_assign = flask.request.args.get('before_assign', '')
    # is_static_jsonl = flask.request.args.get('static_jsonl', False) is not False
    is_mysql_jsonl = flask.request.args.get('mysql_jsonl', False) is not False

    argot = flask.request.args.get('argot', 'triple').split(',')
    is_argot_triple = 'triple' in argot
    is_argot_nix    = 'nix'    in argot
    is_argot_jsonl  = 'jsonl'  in argot
    if not is_argot_triple and not is_argot_nix and not is_argot_jsonl:
        return invalid_response("No known argot specified: " + repr(argot))

    # is_hack_dour = flask.request.args.get('hack_dour', False) is not False
    # # NOTE:  Allow anonymous browsing (e.g. from wget) to capture anonymous contributions.

    is_code_py = flask.request.args.get('code_py', False) is not False
    # NOTE:  This only matters for


    p.at("req", queries=0)   # request has been parsed
    if is_argot_jsonl and not is_mysql_jsonl:
        Auth.print("nits STATIC json: ", p.report())
        # return flask.send_file(os_path_workshop('luns.js'))   # noqa
        return flask.send_file(FlikiWord.file_path(), mimetype=MIME_TYPE_JSONL)



    auth = AuthFliki()

    # if not auth.is_online:
    #     return dict(error="lex database offline")
    # if not auth.flask_user.is_authenticated and not is_hack_dour:   # only for porting to Nits
    #     return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    p.at("auth", queries=auth.lex.query_count)


    idn_lex = int(auth.lex['lex'].idn)
    idn_define = int(auth.lex['define'].idn)
    idn_bot = int(auth.lex['bot'].idn)
    idn_iconify = int(auth.lex['iconify'].idn)

    def int_from_name(name):
        """Safe conversion because fun.unslumping.org never defined 'pause'."""
        try:
            return int(auth.lex[name].idn)
        except ValueError:
            return None

    # interact_idns = [int(auth.lex[n].idn) for n in INTERACT_VERBS]
    interact_idns_and_nones = [int_from_name(n) for n in INTERACT_VERBS]
    interact_idns = [i for i in interact_idns_and_nones if i is not None]
    interact_word_from_idn = {int(idn): auth.lex[idn] for idn in interact_idns}
    extra_verb_idns = interact_idns + [
        # idn_iconify,
        # NOTE:  This didn't work out because LUnslumping #165 had an sbj idn of 9.
        #        Which led to a cascade of unconventional problems.
        #        Instead, we do a new find for iconify words below.
    ]


    # auth.full_disclosure = is_hack_dour -- only for porting to Nits via wget
    # monty_hybrid = contribution_dictionary(auth)                    # \ pick
    monty_hybrid = contribution_dictionary(auth, extra_verb_idns)   # / one
    # auth.full_disclosure = False



    # NOTE:  monty_hybrid is a mish-mash of dict()s and objects.
    #        Yet another curse on the seemingly honorable and versatile notion of making
    #        json_encode() treat a qiki.Word as a dictionary, aka a JavaScript associative array.

    p.at("find", queries=auth.lex.query_count)

    monty_json = json_encode(monty_hybrid)
    monty_dict = json.loads(monty_json)
    # NOTE:  monty_dict is dictionaries, all the way down.

    # triple_global = 'define'
    # NOTE:  This would be better, but then there's that whole brain-busting chicken-and-egg-thing.

    triple_global = 'c'
    # nix_global = secure.credentials.Options.home_page_title + '_lex'
    # nix_global = 'lex'
    user_variable_prefix = 'u'

    category_idns = auth.get_category_idns_in_order()
    category_name_from_idn = {int(idn): auth.lex[idn].txt for idn in category_idns}

    stream_lines = []

    def render_string(thing):
        """Render a string or list (of nits)"""
        # NOTE:  The only reason Python might not like json.dumps() for its strings is that it would
        #        have to convert the surrogate pairs that JavaScript, JSON, UTF-16 use to represent
        #        unicode characters on the supplemental planes beyond U+FFFF.
        # SEE:  convert surrogate pairs, https://stackoverflow.com/a/54549164/673991
        if is_code_py:
            # FALSE WARNING:  Python version 2.7 does not have method ascii
            # noinspection PyCompatibility
            return ascii(thing)   # double or single quotes, \U00088888
        else:
            return json_encode(thing)   # double quotes, \uD888\uDC88 surrogate UTF-16 pairs

    def streamy(line):
        stream_lines.append(line)

    def triple(line=''):   # argot=triple
        if is_argot_triple:
            streamy(line)

    def nix(line=''):
        if is_argot_nix:
            streamy(line)

    def wold(idn, whn, name_if_any, vrb_int, **kwargs):   # argot=nix
        # nix(
        #     "    {idn}: N("
        #         "{vrb_int}"
        #         "{comma_name}"
        #         "{comma_kwargs}"
        #         ",N({idn_whn_absolute},{unix_ms})"
        #     "),".format(
        #         idn=int(idn),
        #         vrb_int=vrb_int,
        #         comma_name=''   if name is None else   ', ' + render_string(name),
        #         idn_whn_absolute=IDN_WHN_ABSOLUTE,
        #         unix_ms=int(whn*1000.0),
        #         comma_kwargs=''.join(',' + v for v in kwargs.values()),
        #     )
        # )
        nix(
            "    "
            "{idn}: "
            "N("
                "{unix_ms},"
                "{vrb_int}"
                "{comma_name}"
                "{comma_kwargs}"
            "),".format(
                idn=idn,
                unix_ms=int(whn*1000.0),
                vrb_int=vrb_int,
                comma_name=''   if name_if_any is None else ', ' + render_string(name_if_any),
                comma_kwargs=''.join(', ' + str(v) for v in kwargs.values()),
            )
        )

    jsonl_idn_line_pairs = []

    def jsonl(idn, whn, sbj, vrb, **kwargs):
        if is_argot_jsonl:
            comma_kwargs = ''.join(',' + str(v) for v in kwargs.values())
            # NOTE:  Only using object fields.  Names could theoretically be validated.
            line = '[{idn},{unix_ms},{sbj}, {vrb_int}{comma_kwargs}]'.format(
                idn=idn,
                # unix_seconds=int(round(float(whn))),
                unix_ms=int(whn*1000.0),
                sbj=sbj,
                vrb_int=int(vrb),
                comma_kwargs=comma_kwargs,
            )
            jsonl_idn_line_pairs.append((idn, line))

    triple('{before_assign}{triple_global} = qiki.Lex("{me_idn}");'.format(
        # TODO:  Make the choice of the constructorificationalizer name "qiki.Lex" in one place.  # noqa
        #        Probably closer to the other choice of that name currently in qiki.js.
        before_assign=before_assign,
        triple_global=triple_global,
        me_idn=monty_dict['me_idn'],
    ))
    triple()
    # nix('{before_assign}{nix_global} = qiki.Lex("{me_idn}",{{'.format(
    #     before_assign=before_assign,
    #     nix_global=nix_global,
    #     me_idn=monty_dict['me_idn'],
    # ))
    # nix('{before_assign}{nix_global} = {{'.format(
    #     before_assign=before_assign,
    #     nix_global=nix_global,
    # ))
    natal_whn = int(auth.lex[0].whn)
    # NOTE:  whn of first word in LexMySQL, assume that's as old as it gets.
    # triple(''.format(IDN_WHN_ABSOLUTE, natal_whn, "whn", monty_dict['IDN']['DEFINE']))
    # wold(IDN_WHN_ABSOLUTE, natal_whn, "whn", monty_dict['IDN']['DEFINE'])

    def user_nit(user_lineage):
        u = monty_dict['u'][user_lineage]
        return "N({bytes},{nit})".format(bytes=u['listing_idn'], nit=u['listing_index'])

    def user_jsonl(user_lineage):
        u = monty_dict['u'][user_lineage]
        # return "[{bytes},{nit}]".format(bytes=u['listing_idn'], nit=u['listing_index'])
        # return '"{bytes},{nit}"'.format(bytes=u['listing_idn'], nit=u['listing_index'])
        # return '[{bytes},"{nit}"]'.format(bytes=u['listing_idn'], nit=u['listing_index'])
        return json_encode(u['jsonl'])

    # NOTE:  In the following sequence of pairs,
    #            variable_name - name of each variable in the data stream.
    #            symbol        - key in the MONTY.IDN dictionary.  Or some value for the idn.
    variable_name_idn = (
        ('lex',         monty_dict['IDN']['LEX']),
        ('define',      monty_dict['IDN']['DEFINE']),
        ('noun',        monty_dict['IDN']['NOUN']),
        ('admin',       IDN_ADMIN_VERB),
        ('sequence',    IDN_SEQUENCE),
        ('rearrange',   IDN_REARRANGE),
        ('url',         IDN_URL),
        # ('whn',         IDN_WHN_ABSOLUTE),
        ('name',        monty_dict['IDN']['NAME']),
        ('category',    monty_dict['IDN']['CATEGORY']),
        ('interact',    monty_dict['IDN']['INTERACT']),
        ('text',        monty_dict['IDN']['AGENT']),   # HACK:  AGENT was barely used, it was INTENDED for users but that didn't happen
        # ('qstring',   monty_dict['IDN'][  'QUESTION_OBSOLETE'),   # HACK repurposed
        ('user',        monty_dict['IDN']['LISTING']),   # HACK:  LISTING was only used for users, across all sites.
        ('google_user', monty_dict['IDN']['GOOGLE_LISTING']),
        ('anonymous',   monty_dict['IDN']['ANONYMOUS_LISTING']),
        ('locus',       IDN_LOCUS),   # monty_dict['IDN']['RESOURCE']),   # HACK:  Appropriating this too, for "base class" of contribute and rightmost
        ('contribute',  monty_dict['IDN']['CONTRIBUTE']),
        ('caption',     monty_dict['IDN']['CAPTION']),
        ('edit',        monty_dict['IDN']['EDIT']),
        ('rightmost',   monty_dict['IDN']['FENCE_POST_RIGHT']),
        ('iconify',     monty_dict['IDN']['ICONIFY']),
        ('ip_address',  monty_dict['IDN']['IP_ADDRESS_TAG']),
        ('user_agent',  monty_dict['IDN']['USER_AGENT_TAG']),
    )

    # category = lex.define(noun)
    # my = lex.define(category)
    # user_fred.my(contribution=1400, locus=1500)

    variable_name_from_idn = dict()
    idn_from_name = dict()
    idn_from_name[triple_global] = monty_dict['IDN']['DEFINE']
    for variable_name, idn in variable_name_idn:
        variable_name_from_idn[idn] = variable_name
        idn_from_name[variable_name] = idn
        # NOTE:  These are set in the first loop so the second loop may forward-reference

    for variable_name, idn in variable_name_idn:

        # NOTE:  A 'user' word was defined in LUnslumping (idn 9, whn 2016), but not Unslumping.
        # definer = lex_variable_name
        # definer = 'define'
        definer = triple_global
        define_obj_txt = 'noun'
        etc = ''
        etc_jsonl = tuple()
        if idn in (monty_dict['IDN']['GOOGLE_LISTING'], monty_dict['IDN']['ANONYMOUS_LISTING']):   # HACK:  Oh come on
            definer = 'user'
            define_obj_txt = 'user'
            # etc = ', qstring, lineage'
        elif idn == monty_dict['IDN']['FENCE_POST_RIGHT']:
            definer = 'locus'
            define_obj_txt = 'locus'
        elif idn == monty_dict['IDN']['CONTRIBUTE']:
            definer = 'locus'
            define_obj_txt = 'locus'
            etc = ', user, text'
            etc_jsonl = ('text',)
        elif idn == monty_dict['IDN']['CAPTION']:
            etc = ', user, text, contribute'
            etc_jsonl = ('contribute', 'text',)
        elif idn == IDN_REARRANGE:
            etc = ', contribute, category, locus'
            etc_jsonl = ('contribute', 'category', 'locus',)
        elif idn == monty_dict['IDN']['EDIT']:
            etc = ', user, text, contribute'
            etc_jsonl = ('contribute', 'text',)
        elif idn == IDN_URL:
            definer = 'text'
            define_obj_txt = 'text'
        elif idn == monty_dict['IDN']['ICONIFY']:
            etc = ', user, url'
            etc_jsonl = ('user', 'url',)
        elif idn == monty_dict['IDN']['IP_ADDRESS_TAG']:
            etc = ', user, text'
            etc_jsonl = ('user', 'text',)
        elif idn == monty_dict['IDN']['USER_AGENT_TAG']:
            etc = ', user, text'
            etc_jsonl = ('user', 'text',)
        # elif symbol == 'DEFINE':
        #     etc = ', name'
        # NOTE:  Oops this elegant circular reference forks itself:  the define word both
        #        declares all uses of it will declare a name, and has a name itself.


        triple(
            '{before_assign}{variable_name} = {definer}('
                '{idn}, '
                '{variable_name_string}'
                '{etc}'
            ');'.format(
                before_assign=before_assign,
                variable_name=variable_name,
                variable_name_string=render_string(variable_name),
                idn=idn,
                definer=definer,
                etc=etc,
            )
        )
        # vex = dict((
        #     (triple_global, int(auth.lex.IDN.DEFINE)),
        #     ('user', int(auth.lex.IDN.LISTING)),
        #     ('locus', int(auth.lex.IDN.RESOURCE)),
        # ))
        # # TODO:  vex is almost so close to idn_from_variable_name -- use it instead somehow?

        etc_keys = [e.strip() for e in etc.split(',') if e.strip() != '']
        etc_dict = {k: render_string(idn_from_name[k]) for k in etc_keys}
        wold(
            idn,
            auth.lex[idn].whn or natal_whn,
            variable_name,
            idn_from_name.get(definer, "UNK"),
            **etc_dict
        )
        if len(etc_jsonl) == 0:
            field_specification = dict()
        else:
            field_specification = dict(fields=render_string([idn_from_name[n] for n in etc_jsonl]))
            # EXAMPLE:  dict(fields='[1408,1434,201]')
        jsonl(
            idn,
            auth.lex[idn].whn or natal_whn,
            idn_lex,
            idn_define,
            noun=idn_from_name.get(define_obj_txt, "UNK"),
            name=render_string(variable_name),
            # **{n: idn_from_name[n] for n in etc_jsonl}
            **field_specification
        )


    # TODO:  Some way to unify anonymous and google_user curried words, by defining both as a
    #        "user" curried word?  Need to make up some IDN for the "user" definition then I guess.
    #        Haha maybe commandeer the MONTY.IDN.LISTING definition?
    #        In desktop and unslumping, the only listings are google user and anonymous.

    triple()
    i_user_from_lineage = dict()
    for (i_user, (lineage, user_word)) in enumerate(monty_dict['u'].items()):
        # i_user_from_lineage[user_word['idn_qstring']] = i_user
        i_user_from_lineage[lineage] = i_user
        user_variable_name = user_variable_prefix + str(i_user)
        triple(
            '{before_assign}{user_variable_name} = {user_type}('
                '"{lineage}", '
                '{name_json}'
            ');'.format(
                before_assign=before_assign,
                user_variable_name=user_variable_name,
                user_type=user_word.get('listing_txt', "").replace(' ', '_'),
                lineage=lineage,
                name_json=render_string(user_word.get('name_short', "[no name]")),
                # idn=render_string(idn),
                # listing_index=user_word.get('listing_index', ""),
            )
        )
        qiki_user = auth.lex.word_user_class(
            user_word['listing_index'],
            user_word['listing_idn'],
        )
        namings = auth.lex.find_words(
            sbj=auth.lex.IDN.LEX,
            vrb=auth.lex.IDN.NAME,
            obj=qiki_user
        )
        if len(namings) > 0:
            naming_word = namings[-1]
            triple('name({idn}, {user_variable_name}, {quoted_name});'.format(
                idn=int(naming_word.idn),
                user_variable_name=user_variable_name,
                quoted_name=json_encode(naming_word.txt),
            ))
            wold(
                int(naming_word.idn),
                naming_word.whn,
                None,
                int(naming_word.vrb.idn),
                user=user_nit(lineage),
                given_name=json_encode(naming_word.txt),
            )
            jsonl(
                int(naming_word.idn),
                naming_word.whn,
                idn_lex,
                int(naming_word.vrb.idn),
                user=user_jsonl(lineage),
                given_name=json_encode(naming_word.txt),
            )
            if user_word['is_admin']:
                triple('admin({idn}, {user_variable_name});'.format(
                    idn=IDN_ADMIN_ASSIGNMENT,   # there's only one
                    user_variable_name=user_variable_name,
                ))
                wold(
                    IDN_ADMIN_ASSIGNMENT,   # there's only one
                    naming_word.whn,
                    None,
                    IDN_ADMIN_VERB,
                    user=user_nit(lineage),
                )
                jsonl(
                    IDN_ADMIN_ASSIGNMENT,   # there's only one
                    naming_word.whn,
                    idn_lex,
                    IDN_ADMIN_VERB,
                    user=user_jsonl(lineage),
                )

    triple()
    category_txt_from_idn = dict()
    for cat_word in monty_dict['cat_words']:
        # NOTE:  The definitive order of categories as they appear on the webpage.
        triple(
            '{before_assign}{name} = category('
                '{idn}, '
                '{name_json}, '
                'user, '
                'contribute, '
                'locus'
            ');'.format(
                before_assign=before_assign,
                idn=cat_word['idn'],
                name=cat_word['txt'],
                name_json=render_string(cat_word['txt']),
            )
        )
        wold(
            cat_word['idn'],
            auth.lex[cat_word['idn']].whn,
            cat_word['txt'],
            monty_dict['IDN']['CATEGORY'],
        )
        jsonl(
            cat_word['idn'],
            auth.lex[cat_word['idn']].whn,
            idn_lex,
            idn_define,
            category=monty_dict['IDN']['CATEGORY'],
            name=render_string(cat_word['txt']),
        )

        category_txt_from_idn[cat_word['idn']] = cat_word['txt']

    triple()
    # for interact_name in INTERACT_VERBS:
    for interact_idn, interact_word in interact_word_from_idn.items():
        triple('{before_assign}{name} = interact({idn}, {name_string});'.format(
            before_assign=before_assign,
            idn=interact_idn,
            name=interact_word.txt,
            name_string=render_string(interact_word.txt),
        ))
        wold(
            interact_idn,
            interact_word.whn,
            interact_word.txt,
            monty_dict['IDN']['INTERACT'],
        )
        jsonl(
            interact_idn,
            interact_word.whn,
            idn_lex,
            idn_define,
            interact=monty_dict['IDN']['INTERACT'],
            name=render_string(interact_word.txt),
        )
    p.at("def", queries=auth.lex.query_count)

    iconify_words = auth.lex.find_words(vrb=qiki.Number(idn_iconify))
    iconify_counts = dict(reject=0, reject2=0, malformed=0, non_user=0, dup=0, passed=0)
    iconify_users = set()
    iconify_latest = dict()   # key is user idn, a qiki Number
    for iconify_word in iconify_words:
        if iconify_word.sbj.idn == idn_lex:
            user_being_iconified = iconify_word.obj
            if isinstance(user_being_iconified, auth.lex.word_user_class):
                try:
                    obj_jsonl = user_being_iconified.jsonl()
                except ValueError:
                    # Auth.print(
                    #     "Malformed iconify user",
                    #     int(iconify_word.idn),
                    #     user_being_iconified.idn.qstring()
                    # )
                    # EXAMPLE:  LUnslumping #1799 where obj is 0q82_A7__1D0100
                    #           which has a malformed LISTING suffix with an empty payload.
                    iconify_counts['malformed'] += 1
                else:
                    if user_being_iconified.lineage() in i_user_from_lineage:
                        # TODO:  triple() and wold()
                        if user_being_iconified in iconify_latest and iconify_latest[user_being_iconified] == iconify_word.txt:
                            iconify_counts['dup'] += 1
                            # Auth.print("Duplicate icon", int(iconify_word.idn))
                            # EXAMPLE:  Duplicate icon 298
                        else:
                            iconify_counts['passed'] += 1
                            jsonl(
                                int(iconify_word.idn),
                                iconify_word.whn,
                                int(iconify_word.sbj.idn),
                                int(iconify_word.vrb.idn),
                                user=render_string(obj_jsonl),
                                url=render_string(iconify_word.txt),
                            )
                        iconify_latest[user_being_iconified] = iconify_word.txt
                    else:
                        if user_being_iconified.lineage() in iconify_users:
                            iconify_counts['reject2'] += 1
                        else:
                            iconify_counts['reject'] += 1
                        iconify_users.add(user_being_iconified.lineage())
                        # NOTE:  User never contributed, so we won't remember their icon.
            else:
                # Auth.print("{idn_int}. iconify non-user {obj_qstring}. {obj_txt}".format(
                #     idn_int=int(iconify_word.idn),
                #     obj_qstring=str(user_being_iconified.idn.qstring()),
                #     obj_txt=str(user_being_iconified.txt),
                # ))
                # EXAMPLE:  136. iconify non-user 0q82_86. like
                iconify_counts['non_user'] += 1
    # Auth.print("iconify", repr(iconify_counts), sum(iconify_counts.values()), "total")
    # EXAMPLE:  {'reject': 0, 'reject2': 0, 'malformed': 1, 'non_user': 4, 'dup': 1, 'passed': 9}
    #           15 total

    tag_words = auth.lex.find_words(vrb=(
        monty_dict['IDN']['IP_ADDRESS_TAG'],
        monty_dict['IDN']['USER_AGENT_TAG'],
    ))
    tag_counts = dict(reject=0, reject2=0, malformed=0, non_user=0, dup=0, passed=0)
    tag_users = set()
    tag_latest = dict()   # key is (user idn,verb idn) tuple, where idns are legacy qiki Numbers
    for tag_word in tag_words:
        if isinstance(tag_word.sbj, auth.lex.word_user_class):
            try:
                sbj_jsonl = tag_word.sbj.jsonl()
            except ValueError:
                # Auth.print("Malformed tag user", int(tag_word.idn), tag_word.sbj.idn.qstring())
                # EXAMPLE:  Malformed tag user 1801 0q82_A7__1D0100
                tag_counts['malformed'] += 1
            else:
                if tag_word.sbj.lineage() in i_user_from_lineage:
                    # TODO:  triple() and wold()
                    sbj_vrb = (tag_word.sbj.idn, tag_word.vrb.idn)
                    if sbj_vrb in tag_latest and tag_latest[sbj_vrb] == tag_word.txt:
                        tag_counts['dup'] += 1
                        # Auth.print("Duplicate tag", int(tag_word.vrb.idn), int(tag_word.idn))
                    else:
                        tag_counts['passed'] += 1
                        jsonl(
                            int(tag_word.idn),
                            tag_word.whn,
                            int(monty_dict['IDN']['LEX']),
                            int(tag_word.vrb.idn),
                            user=render_string(sbj_jsonl),
                            text=render_string(tag_word.txt),
                        )
                    tag_latest[sbj_vrb] = tag_word.txt
                else:
                    if tag_word.sbj.lineage() in tag_users:
                        tag_counts['reject2'] += 1
                    else:
                        tag_counts['reject'] += 1
                    tag_users.add(tag_word.sbj.lineage())
                    # NOTE:  User never contributed, so we won't remember their ip or user-agent.
        else:
            tag_counts['non_user'] += 1
    # Auth.print("tag", repr(tag_counts), sum(tag_counts.values()), "total")
    # EXAMPLE:  'reject': 554, 'reject2': 528, 'malformed': 2, 'non_user': 0, 'dup': 48,
    #           'passed': 119} 1251 total

    triple()
    for w in monty_dict['w']:

        def idn_render(idn):
            if idn in variable_name_from_idn:
                return variable_name_from_idn[idn]
            else:
                # return "{lex_variable_name}({idn})".format(
                #     idn=idn,
                #     lex_variable_name=lex_variable_name
                # )
                return render_string(idn)

        vrb_idn = w['vrb']
        txt = w.get('txt', "")
        num = w.get('num', None)
        txt_json = render_string(txt)
        obj_idn = w.get('obj', None)
        obj_render = idn_render(obj_idn)
        try:
            i_user = i_user_from_lineage[w['sbj_lineage']]
        except KeyError:
            i_user = 9999
        author = "{user_variable_prefix}{i_user}".format(
            user_variable_prefix=user_variable_prefix,
            i_user=i_user,
        )

        if vrb_idn == monty_dict['IDN']['CONTRIBUTE']:
            triple('contribute({idn}, {author}, {txt_json});'.format(
                idn=w.get('idn', -1),
                author=author,
                txt_json=txt_json,
            ))
            wold(
                w['idn'],
                w['whn'],
                None,
                w['vrb'],
                user=user_nit(w['sbj_lineage']),
                text=txt_json,
            )
            jsonl(
                w['idn'],
                w['whn'],
                user_jsonl(w['sbj_lineage']),
                w['vrb'],
                text=txt_json,
            )
        elif vrb_idn == monty_dict['IDN']['CAPTION']:
            triple('caption({idn}, {author}, {txt_json}, {obj});'.format(
                idn=w.get('idn', "IDN"),
                author=author,
                txt_json=txt_json,
                obj=obj_render,
            ))
            wold(
                w['idn'],
                w['whn'],
                None,
                w['vrb'],
                user=user_nit(w['sbj_lineage']),
                text=txt_json,
                contribute=w['obj'],
            )
            jsonl(
                w['idn'],
                w['whn'],
                user_jsonl(w['sbj_lineage']),
                w['vrb'],
                contribute=w['obj'],
                text=txt_json,
            )
        elif vrb_idn == monty_dict['IDN']['EDIT']:
            triple('edit({idn}, {author}, {txt_json}, {obj});'.format(
                idn=w.get('idn', -1),
                author=author,
                txt_json=txt_json,
                obj=obj_render,
            ))
            wold(
                w['idn'],
                w['whn'],
                None,
                w['vrb'],
                user=user_nit(w['sbj_lineage']),
                text=txt_json,
                contribute=render_string(w['obj']),
            )
            jsonl(
                w['idn'],
                w['whn'],
                user_jsonl(w['sbj_lineage']),
                w['vrb'],
                contribute=w['obj'],
                text=txt_json,
            )
        elif vrb_idn in category_idns:
            triple('{category_name}({idn}, {author}, {obj}, {num_as_idn});'.format(
                category_name=category_name_from_idn.get(vrb_idn, "unknown"),
                idn=w.get('idn', -1),
                author=author,
                obj=obj_render,
                num_as_idn=idn_render(num),   # rare case where num was an idn
            ))
            wold(
                w['idn'],
                w['whn'],
                None,
                w['vrb'],
                user=user_nit(w['sbj_lineage']),
                contribute=render_string(w['obj']),
                locus=render_string(w['num']),
            )
            # jsonl(
            #     w['idn'],
            #     w['whn'],
            #     user_jsonl(w['sbj_lineage']),
            #     w['vrb'],
            #     contribute=render_string(w['obj']),
            #     locus=render_string(w['num']),
            # )
            jsonl(
                w['idn'],
                w['whn'],
                user_jsonl(w['sbj_lineage']),
                IDN_REARRANGE,
                contribute=render_string(w['obj']),
                category=w['vrb'],
                locus=render_string(w['num']),
            )
        elif vrb_idn in interact_idns:
            interact_kwargs = dict()
            if obj_idn is not None:
                interact_kwargs['contribute'] = render_string(obj_idn)
            if num is None:
                comma_num = ''
            elif is_whole(num):
                comma_num = ", {:d}".format(num)
                interact_kwargs['second'] = str(int(num))
            else:
                comma_num = ", {:0.3f}".format(num)
                interact_kwargs['millisecond'] = str(int(round(num * 1000.0)))
            if len(txt) != 0:
                if vrb_idn == idn_bot:
                    interact_kwargs['sequence'] = '[{idn_sequence},{idn_commas}]'.format(
                        idn_sequence=IDN_SEQUENCE,
                        idn_commas=txt,
                    )
                    # SEE:  sequence_nit() in unslumping.js where the sequence idn is also
                    #       artificially prepended to the interact.bot sequence field.
                else:
                    interact_kwargs['text'] = render_string(txt)
            triple(
                '{interact_name}('
                    '{idn}, '
                    '{author}'
                    '{comma_obj}'
                    '{comma_num}'
                    '{comma_txt}'
                ');'.format(
                    interact_name=interact_word_from_idn.get(vrb_idn, {txt: "unknown"}).txt,
                    idn=w.get('idn', -1),
                    author=author,
                    comma_num=comma_num,
                    comma_obj=''   if obj_idn is None else   ', ' + obj_render,
                    comma_txt=''   if len(txt) == 0   else   ', ' + txt_json,
                )
            )
            wold(
                w['idn'],
                w['whn'],
                None,
                w['vrb'],
                user=user_nit(w['sbj_lineage']),
                **interact_kwargs
            )
            jsonl(
                w['idn'],
                w['whn'],
                user_jsonl(w['sbj_lineage']),
                w['vrb'],
                **interact_kwargs
            )
        elif vrb_idn == idn_iconify:
            if w['sbj'] == idn_lex:
                jsonl(
                    w['idn'],
                    w['whn'],
                    w['sbj'],
                    w['vrb'],
                    url=w['txt'],
                )
            else:
                '''Silently ignore other iconify words.'''
                Auth.print("iconify", repr(w), repr(w['sbj_lineage']), repr(idn_lex))
        else:
            Auth.print("Unexpected verb, idn", vrb_idn)

    triple()
    triple('{triple_global}.{FINISHER_METHOD_NAME}();'.format(
        triple_global=triple_global,
        FINISHER_METHOD_NAME=FINISHER_METHOD_NAME,
    ))
    # nix('}')

    p.at("w", queries=auth.lex.query_count)

    for _, one_word_json in sorted(jsonl_idn_line_pairs):
        streamy(one_word_json)

    p.at("sort", queries=auth.lex.query_count)

    # the_javascript = (
    #     '{before_file}\n'
    #     '{stream_lines}\n'
    #     '{after_file}\n'
    # ).format(
    #     before_file=before_file,
    #     # before_assign=before_assign,
    #     # lex_variable_name=lex_variable_name,
    #     # me_idn=monty_dict['me_idn'],
    #     # define_lines=joiner(define_lines, before_assign, '', '\n'),
    #     # user_lines=joiner(user_lines, before_assign, '', '\n'),
    #     # category_lines=joiner(category_lines, before_assign, '', '\n'),
    #     # interact_lines=joiner(interact_lines, before_assign, '', '\n'),
    #     # lex_lines="\n".join(lex_lines),
    #     stream_lines='\n'.join(stream_lines),
    #     after_file=after_file,
    #     # FINISHER_METHOD_NAME=FINISHER_METHOD_NAME,
    # )

    the_javascript = before_file + ''.join(line + '\n' for line in stream_lines) + after_file

    if is_argot_triple:
        mimetype = MIME_TYPE_TRIPLE
    elif is_argot_nix:
        mimetype = MIME_TYPE_NIX
    elif is_argot_jsonl:
        mimetype = MIME_TYPE_JSONL
    else:
        mimetype = 'text/plain'
    response = flask.Response(the_javascript, mimetype=mimetype)

    p.at("resp", queries=auth.lex.query_count)
    Auth.print("nits: ", p.report())
    # EXAMPLE:  without interacts
    #     meta nits auth .026s 5 queries;   find .296s 68 queries;   def .130s 13 queries;   w .056s;   resp .000s;   total .508s 86 queries
    # EXAMPLE:  with interacts
    #     meta nits auth .025s 5 queries;   find 1.203s 71 queries;   def .750s 13 queries;   w .760s;   resp .000s;   total 2.738s 89 queries
    return response


def joiner(things, prefix, suffix, between):
    return between.join(prefix + thing + suffix for thing in things)
assert "(a),(b)" == joiner(['a', 'b'], '(', ')', ',')
assert "(a)"     == joiner(['a'],      '(', ')', ',')
assert ""        == joiner([],         '(', ')', ',')


def is_whole(x):
    return x % 1 == .000
assert     is_whole(42)
assert not is_whole(42.1)

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
    # if not auth.is_online:
    #     return "lex offline"
    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Instead of rebuffing anonymous users, show them the content appropriate for
        #        anonymous users:  i.e. exclude all anonymous content except their own.

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
    # response = valid_response('words', words)
    response_html = _valid_html_response('words', words)
    t_end = time.time()
    Auth.print(
        "RAW LEX,",
        auth.lex.query_count - qc_start, "queries,",
        len(words), "words,",
        "{:.3f} + {:.3f} + {:.3f} = {:.3f}".format(
            t_find - t_start,   # time to authenticate?   e.g.  6.8 sec
            t_loop - t_find,    # time to count words,    e.g.  1.7 sec
            t_end - t_loop,     # time to render json,    e.g.  9.3 sec
            t_end - t_start,    # time total,             e.g. 17.7 sec
        ),
        "sec,",
        # len(response.get_data(as_text=False)) // 1000, "Kbytes,",
        len(response_html) // 1000, "Kbytes,",
        num_suffixed, "suffixed",
        num_anon, "anon",
        num_google, "google",
    )
    return flask.Response(response_html, mimetype='application/json')
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
    # if not auth.is_online:
    #     return "lex offline"
    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    slam_verb = auth.lex.verb('slam')

    with FlikiHTML('html') as html:
        html.header(title="Slam Test")
        # TODO:  Is anything here dependent on the qoolbar?
        #        head.css_stamped(web_path_qiki_javascript('qoolbar.css'))

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
    # if not auth.is_online:
    #     return "lex offline"
    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link

    with FlikiHTML('html') as html:
        with html.header(title="Lex") as head:
            head.css_stamped(static_code_url('meta_lex.css'))

            head.css('//fonts.googleapis.com/css?family=Source+Sans+Pro&display=swap')
            # THANKS: link better than import, https://stackoverflow.com/a/12380004/673991
            # Thanks:  Source Sans Pro, https://fonts.google.com/specimen/Source+Sans+Pro

        with html.body(class_='target-environment', newlines=True) as body:

            with body.footer() as foot:
                foot.js_stamped(static_code_url('d3.js'))
                foot.js_stamped(static_code_url('util.js'))
                foot.js_stamped(static_code_url('lex.js'))
                foot.js_stamped(static_code_url('meta_lex.js'))

                with foot.script() as script:
                    script.raw_text('\n')
                    monty = dict(
                        NOW=float(time_lex.now_word().num),
                        LEX_URL='/meta/static/data/' + FlikiWord.file_name,
                    )
                    # script.raw_text('var MONTY = {json};\n'.format(json=json_pretty(monty)))
                    # script.raw_text('js_for_meta_lex(window, window.$, MONTY);\n')
                    script.raw_text('js_for_meta_lex(window, window.$, {json});\n'.format(
                        json=json_pretty(monty)
                    ))

        response = html.doctype_plus_html()
    return response


@flask_app.route('/meta/lex/classic', methods=('GET', 'HEAD'))
def meta_lex_classic():

    auth = AuthFliki()
    # if not auth.is_online:
    #     return "lex offline"
    if not auth.flask_user.is_authenticated:
        return auth.login_html()   # anonymous viewing not allowed, just show "login" link
        # TODO:  Omit anonymous content for anonymous users (except their own).
        #        I.e. show anonymous user only their own words, logged-in user words, and lex words.

    t_start = time.time()
    qc_start = auth.lex.query_count
    with FlikiHTML('html') as html:
        with html.header("Lex") as head:
            head.css_stamped(web_path_qiki_javascript('qoolbar.css'))
            # TODO:  qoolbar.css sets the background color.
            #        But that should move to meta_lex_classic.css right?
            #        Maybe not because that's the target-environment class.

            head.css_stamped(static_code_url('meta_lex_classic.css'))


        with html.body(class_='target-environment', newlines=True) as body:
            user_idn_qstring = str(auth.flask_user.idn)   # was auth.qiki_user.idn.qstring()
            with body.div(id='login-prompt', title='your idn is ' + user_idn_qstring) as div_login:
                div_login.raw_text(auth.login_html())

            words = auth.lex.find_words()

            listing_dict = dict()

            def listing_log(sub, **kwargs):
                q = sub.idn.qstring()
                if q not in listing_dict:
                    listing_dict[q] = dict()
                listing_dict[q].update(kwargs)

            t_find_words = time.time()
            qc_find_words = auth.lex.query_count

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
                        # ua = werkzeug.useragents.UserAgent(word.txt)
                        ua = werkzeug.user_agent.UserAgent(word.txt)
                        # FIXME:  pip install ua-parser
                        # noinspection PyUnresolvedReferences
                        listing_log(
                            word.sbj,
                            user_agent=word.txt,
                            browser=ua.browser,
                            platform=ua.platform,
                        )

            t_footer = time.time()
            qc_footer = auth.lex.query_count
            with body.footer() as foot:
                foot.js_stamped(static_code_url('d3.js'))
                # TODO:  Is d3.js here just to draw delta-time triangles?  If so replace it.
                #        Or use it for cool stuff.
                #        Like better drawn words or links between words!
                foot.js_stamped(static_code_url('util.js'))
                foot.js_stamped(static_code_url('meta_lex_classic.js'))
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
                    script.raw_text('js_for_meta_lex_classic(window, window.$, MONTY);\n')
    t_render = time.time()
    response = html.doctype_plus_html()
    t_end = time.time()
    Auth.print(
        "META LEX TIMING,",
        qc_find_words - qc_start,           # query count - find_words()
        qc_footer - qc_find_words,          # query count - word loop
        auth.lex.query_count - qc_footer,   # query count - footer & concat html elements
        "queries,",
        len(words),
        "words,",
        "{:.3f} {:.3f} {:.3f} {:.3f} = {:.3f}".format(
            t_find_words - t_start,       # elapsed time - find_words()
            t_footer - t_find_words,      # elapsed time - word loop
            t_render - t_footer,          # elapsed time - footer
            t_end - t_render,             # elapsed time - concat html elements
            t_end - t_start,              # elapsed time - total
        ),
        "sec"
    )
    return response


def url_from_question(question_text):
    return flask.url_for('answer_qiki', url_suffix=question_text, _external=True)
    # THANKS:  Absolute url, https://stackoverflow.com/q/12162634/673991#comment17401215_12162726


MAX_TXT_LITERAL = 120   # Longer txt is broken up with ... ellipses,
BEFORE_DOTS = 80        # showing this many before ...
AFTER_DOTS = 20         #                          ... and this many after.


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
        return self[t]('differ')[self._now]


@flask_app.route('/meta/all words', methods=('GET', 'HEAD'))   # the older, simpler way
def legacy_even_older_meta_all_words():
    """Primitive dump entire lex."""
    # NOTE:  The following logs itself, but that gets to be annoying:
    #            the_path = flask.request.url
    #            word_for_the_path = lex.define(path, the_path)
    #            me(browse)[word_for_the_path] = 1, referrer(flask.request)
    #        Or is it the viewing code's responsibility to filter out tactical cruft?

    auth = AuthFliki()
    # if not auth.is_online:
    #     return "words offline"
    if not auth.flask_user.is_authenticated:
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
            Auth.print("Unsupported", json.dumps(url), but_why)
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
        # return html.doctype_plus_html()
        # HACK:  In case this helps instagram
        #        (It didn't)
        html_response = html.doctype_plus_html()
        flask_response = flask.Response(html_response)
        # flask_response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
        # SEE:  The other place I tried this hail-mary in unslumping_home()
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

    # if url_suffix == 'favicon.ico':
    #     return static_response_from_qiki_javascript(filename=url_suffix)
    #     # SEE:  favicon.ico in root, https://realfavicongenerator.net/faq#why_icons_in_root

    if not secure.credentials.Options.enable_answer_qiki:
        flask.abort(404)


    auth = AuthFliki()
    # if not auth.is_online:
    #     return "answers offline"

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
        me_idn=auth.flask_user.idn,
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
        separators=JSON_SEPARATORS_NO_SPACES,
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
    # qc_start = 0
    ok_to_print = (
        SHOW_LOG_AJAX_NOEMBED_META or
        flask.request.form.get('action', '_') != 'noembed_meta'
    )
    etc = None

    try:
        auth = AuthFliki(ok_to_print=ok_to_print)

        # if not auth.is_online:
        #     return invalid_response("ajax offline")

        # qc_start = auth.lex.query_count

        lex = auth.lex
        action = auth.form('action')
        # TODO:  class Action(Enumerant), or SomeClass.action = Action() instance or something.
        if action == 'answer':
            question_path = auth.form('question')
            answer_txt = auth.form('answer')
            question_word = lex.define(lex.IDN.PATH, question_path)
            # auth.qiki_user(lex.IDN.ANSWER)[question_word] = 1, answer_txt
            auth.create_word_by_user('answer', dict(question=question_word.idn, text=answer_txt))
            return valid_response('message', "Question {q} answer {a}".format(
                q=question_path,
                a=answer_txt,
            ))
        elif action == 'qoolbar_list':
            verbs = list(auth.qoolbar.get_verb_dicts())

            # print("qoolbar - " + " ".join(v[b'name'] + " " + str(v[b'qool_num']) for v in verbs))   # spelling # noqa
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

        # elif action == 'sentence':
        #     obj_idn = auth.form('obj_idn')
        #     vrb_txt = auth.form('vrb_txt', None)
        #     if vrb_txt is None:
        #         # TODO:  Should vrb_idn have priority over vrb_txt instead?
        #         vrb_idn = auth.form('vrb_idn')
        #         vrb = lex[qiki.Number(vrb_idn)]
        #     else:
        #         vrb = lex.verb(vrb_txt)
        #         # FIXME:  can we allow browser trash to define a verb?
        #
        #     txt = auth.form('txt')
        #     use_already = auth.form('use_already', False)
        #     obj = lex[qiki.Number(obj_idn)]
        #     num_add_str = auth.form('num_add', None)
        #     num_str = auth.form('num', None)
        #     num_add = None if num_add_str is None else qiki.Number(num_add_str)
        #     num = None if num_str is None else qiki.Number(num_str)
        #     new_word_kwargs = dict(
        #         sbj=auth.qiki_user,
        #         vrb=vrb,
        #         obj=obj,
        #         num=num,
        #         num_add=num_add,
        #         txt=txt,
        #         use_already=use_already,
        #     )
        #     if auth.may_create_word(new_word_kwargs):
        #         new_word = lex.create_word(**new_word_kwargs)
        #         # DONE:  Ported to nits, see action == 'create_word'
        #         return valid_response('new_words', [new_word])
        #         # TODO:  Maybe exclude txt form new_word to save bandwidth?
        #     else:
        #         return invalid_response("not authorized")

        elif action == 'new_verb':
            new_verb_name = auth.form('name')
            new_verb = lex.create_word(
                sbj=auth.flask_user.idn,
                vrb=lex.IDN.DEFINE,
                obj=lex.IDN.VERB,
                txt=new_verb_name,
                use_already=True,
            )
            lex.create_word(
                sbj=auth.flask_user.idn,
                vrb=lex.IDN.QOOL,
                obj=new_verb,
                # num=NUM_QOOL_VERB_NEW,
                use_already=True,
            )
            # TODO:  Nits for new qool verb.
            etc = new_verb.idn.qstring()
            return valid_response('idn', new_verb.idn.qstring())


        elif action == 'delete_verb':
            old_verb_idn = qiki.Number(auth.form('idn'))

            lex.create_word(
                sbj=auth.flask_user.idn,
                vrb=lex.IDN.QOOL,
                obj=old_verb_idn,
                # num=NUM_QOOL_VERB_DELETE,
                use_already=True,
            )
            # TODO:  Nits for del qool verb.
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

        # elif action == 'interact':
        #     interact_name = auth.form('name')   # e.g. MONTY.INTERACT.PAUSE == 'pause'
        #     if interact_name in INTERACT_VERBS:
        #         interact_obj = auth.form('obj')     # e.g. idn of a contribution
        #         interact_num = auth.form('num', default=1)     # e.g. 15 sec (video), 92 chars (text)
        #         interact_txt = auth.form('txt', default="")
        #         interact_verb = lex.define(lex.IDN.INTERACT, qiki.Text(interact_name))
        #         interact_word = lex.create_word(
        #             sbj=auth.qiki_user,
        #             vrb=interact_verb,
        #             obj=qiki.Number(interact_obj),
        #             num=qiki.Number(interact_num),
        #             txt=qiki.Text(interact_txt),
        #             use_already=False,
        #         )
        #         # DONE:  Nit ported, see interact_new in js, and in py action == 'create_word'
        #         etc = interact_word.idn.qstring()
        #         return valid_response()
        #     else:
        #         error_message = "Unrecognized interact " + repr(interact_name)
        #         auth.print(error_message)
        #         return invalid_response(error_message)

        elif action == 'create_word':
            vrb_name = auth.form('vrb_name')
            sub_nits_json = auth.form('named_sub_nits')   # nits that follow idn,whn,user,vrb
            sub_nits_dict = json.loads(sub_nits_json)
            try:
                # word = FlikiWord.create_word_by_user(auth, vrb_name, sub_nits_dict)
                word = auth.create_word_by_user(vrb_name, sub_nits_dict)
            except ValueError as e:
                auth.print("CREATE WORD ERROR", type(e).__name__, auth.flask_user.idn, str(e))
                return invalid_response("create_word error")
            else:
                return valid_response('jsonl', word.jsonl())


        else:
            return invalid_response("Unknown action " + action)

    except (KeyError, IndexError, ValueError, TypeError, qiki.word.LexMySQL.QueryError) as e:
        # EXAMPLE:  werkzeug.exceptions.BadRequestKeyError
        # EXAMPLE:  fliki.AuthFliki.FormVariableMissing
        # EXAMPLE:  qiki.word.LexSentence.CreateWordError
        # EXAMPLE:  qiki.word.LexMySQL.QueryError

        Auth.print("AJAX ERROR", type_name(e), str(e))
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
        t_end = time.time()
        if auth is None:   # or not auth.is_online:
            Auth.print("AJAX CRASH, {t:.3f} sec".format(t=t_end - t_start))
        else:
            # qc_end = auth.lex.query_count
            if ok_to_print:
                auth.print(
                    "Ajax {action}{etc}, {t:.3f} sec".format(
                        action=repr(action),
                        etc=" " + etc   if etc is not None else   "",
                        # qc=qc_end - qc_start,
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
            tries_remaining, delay_next = tries, delay
            while tries_remaining > 1:
                try:
                    return function_to_retry(*args, **kwargs)
                except exception_to_check as e:
                    Auth.print("{exception}, Retrying in {delay} seconds...".format(
                        exception=str(e),
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
        Auth.print("json_get gives up", str(e), url)
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


def _valid_html_response(name=None, value=None):
    if name is None or value is None:
        return json_encode(dict([('is_valid', True)]))
    else:
        return json_encode(dict([('is_valid', True), (name, value)]))


def valid_response(name=None, value=None):
    # HACK:  In case this helps instagram
    #        (It didn't)
    html_response = _valid_html_response(name, value)
    flask_response = flask.Response(html_response)
    # flask_response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    # SEE:  The other place I tried this hail-mary in unslumping_home()
    return flask_response


def invalid_response(error_message):
    return json.dumps(dict(
        is_valid=False,
        error_message=error_message,
    ))


def json_encode(x, **kwargs):
    """ JSON encode a dict, including custom objects with a .to_json() method. """
    # TODO:  Support encoding list, etc.  ((WTF does this mean?  This works:  json.dumps([1,2,3])))
    json_almost = json.dumps(
        x,
        cls=WordEncoder,
        separators=JSON_SEPARATORS_NO_SPACES,
        allow_nan=False,
        **kwargs
        # NOTE:  The output may have no newlines.  (Unless indent=4 is in kwargs.)
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
    Auth.print((
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


FlikiWord.open_lex()


if __name__ == '__main__':
    '''When fliki.py is run locally, it spins up its own web server.'''
    # FlikiWord.open_lex()
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
    # NOTE:  A mostly functional local https server.
    #        You still get "Your connection is not private" in Chrome, and have to use the
    #        Advanced option:  Proceed to localhost ... (unsafe)
    # EXAMPLE:  (when internet is down)
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


# TODO:  CSRF Protection
# SEE:  http://flask.pocoo.org/snippets/3/


application = flask_app

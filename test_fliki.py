from __future__ import unicode_literals

# noinspection PyUnresolvedReferences
import re
import six.moves
import unittest

from fliki import *
# TODO:  Don't instantiate IDN by reading from LexMySQL.  It's just tacky.


class TestFliki(unittest.TestCase):

    def test_os_static(self):
        self.assertEqual(os.path.join(SCRIPT_DIRECTORY, 'static/foo.bar'), os_path_static('foo.bar'))

    def test_json_encode_int(self):
        self.assertEqual('{"1":2,"3":4}', json_encode(dict(((1, 2), (3, 4)))))

    def test_json_encode_number_values(self):
        self.assertEqual(
            # '{"1":"0q82_02","3":"0q82_04"}',   <-- used to be
            '{"1":2,"3":4}',
            json_encode(dict((
                (1, qiki.Number(2)),
                (3, qiki.Number(4)),
            )))
        )

    def test_dict_compare(self):
        self.assertEqual(
            dict(((1, 2), (3, 4))),
            dict(((1, 2), (3, 4))),
        )

    def test_dict_compare_number_values(self):
        self.assertEqual(
            dict(((1,             2 ), (3,             4 ))),
            dict(((1, qiki.Number(2)), (3, qiki.Number(4)))),
        )

    def test_dict_compare_number_keys(self):
        self.assertNotEqual(
            dict(((            1 , 2), (            3 , 4))),
            dict(((qiki.Number(1), 2), (qiki.Number(3), 4))),
        )

    def test_dict_compare_number_keys_fixed(self):
        self.assertEqual(
                          dict(((     '0q82_01', 2), (     '0q82_03', 4))),
            dict(fix_dict(dict(((qiki.Number(1), 2), (qiki.Number(3), 4))))),
        )

    def test_dict_compare_number_keys_fixed_nested_dict(self):
        self.assertEqual(
                          dict(deeper=dict(((     '0q82_01', 2), (     '0q82_03', 4)))),
            dict(fix_dict(dict(deeper=dict(((qiki.Number(1), 2), (qiki.Number(3), 4)))))),
        )

    def test_dict_compare_number_keys_fixed_nested_list_dict(self):
        self.assertEqual(
                          dict(deeper=[ dict(((     '0q82_01', 2), (     '0q82_03', 4))) ]),
            dict(fix_dict(dict(deeper=[ dict(((qiki.Number(1), 2), (qiki.Number(3), 4))) ]))),
        )

    def test_dict_compare_number_keys_fixed_nested_tuple_dict(self):
        self.assertEqual(
                          dict(deeper=( dict(((     '0q82_01', 2), (     '0q82_03', 4))), )),
            dict(fix_dict(dict(deeper=( dict(((qiki.Number(1), 2), (qiki.Number(3), 4))), )))),
        )

    def test_json_encode_qstring_keys(self):
        self.assertEqual(
            '{"0q82_01":2,"0q82_03":4}',
            json_encode(dict((
                (qiki.Number(1).qstring(), 2),
                (qiki.Number(3).qstring(), 4),
            )))
        )

    def test_json_encode_number_keys_not_supported(self):
        # NOTE:  Problems with fix_dict(), and its complicated, and slow, and not needed.
        # self.assertEqual(
        #     '{"0q82_01":2,"0q82_03":4}',
        #     json_encode(dict((
        #         (qiki.Number(1), 2),
        #         (qiki.Number(3), 4),
        #     )))
        # )
        with self.assertRaises(TypeError):
            json_encode(dict((
                (qiki.Number(1), 2),
                (qiki.Number(3), 4),
            )))

    # noinspection PyUnresolvedReferences
    def test_github_not_getting_credentials(self):
        safety_url = 'https://github.com/BobStein/fliki/tree/master/static'
        danger_url = 'https://github.com/BobStein/fliki/tree/master/secure'

        if six.PY3:
            self.assertEqual(200, urllib.request.urlopen(safety_url).status)
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(danger_url)

            # SEE:  This code posted, https://stackoverflow.com/a/57145789/673991

        self.assertEqual(200, six.moves.urllib.request.urlopen(safety_url).status)
        with self.assertRaises(six.moves.urllib.error.HTTPError):
            six.moves.urllib.request.urlopen(danger_url)



class WordSimple(qiki.Word):
    is_anonymous = False


class LexSimple(qiki.LexInMemory):

    FAKE_UUID = 'pretend this is a uuid'

    def __init__(self):
        super(LexSimple, self).__init__(word_class=WordSimple)
        self.IDN = WorkingIdns(self)
        # NOTE:  Unlike live WSGI fliki sessions, the IDN lookups here are redone every test run
        self.anna = self.define(u'agent', u'anna')
        self.my_session = self.define(self.IDN.BROWSE, self.FAKE_UUID)

        class WordGoogle(WordSimple):
            is_anonymous = False
            lex = self
            pass

        class WordAnon(WordSimple):
            is_anonymous = True
            lex = self
            pass

        self.word_google_class = WordGoogle
        self.word_anon_class = WordAnon


class FakeAuth(Auth):

    def unique_session_identifier(self):
        pass

    @property
    def session_qstring(self):
        return self.lex.my_session.idn.qstring()

    @session_qstring.setter
    def session_qstring(self, qstring):
        pass

    @property
    def session_uuid(self):
        return self.lex.FAKE_UUID

    @session_uuid.setter
    def session_uuid(self, the_uuid):
        pass

    def session_get(self):
        pass

    def session_set(self, session_string):
        pass

    def authenticated_id(self):
        return self.lex.anna.idn

    @property
    def current_url(self):
        return "url goes here"

    @property
    def current_path(self):
        return "path goes here"

    @property
    def current_host(self):
        return "host goes here"

    @property
    def login_url(self):
        return "login url goes here"

    @property
    def logout_url(self):
        return "logout url goes here"

    @property
    def then_url(self):
        return "then-url goes here"

    def static_url(self, relative_path):
        pass

    def form(self, variable_name):
        pass

    def __init__(self, lex, user):
        self.lex = lex
        self.is_anonymous = True
        self.qiki_user = user
        super(FakeAuth, self).__init__(self.lex, True, False, "ip", "user agent")
        self.my_session = self.lex.define(u'noun', u"Pretend this is a session")


    def idn(self, word_or_idn):
        return self.lex.idn_ify(word_or_idn)


class TestAuthenticatedFeatures(unittest.TestCase):
    pass
    # def setUp(self):
    #
    #     self.lex = LexSimple()
    #
    #     self.anna = self.lex.word_google_class(u'anna')
    #     self.anna.is_anonymous = False
    #
    #     self.bart = self.lex.define(u'agent', u'bart')
    #     self.bart.is_anonymous = False
    #
    #     self.basic_categories = [
    #         self.lex.IDN.CAT_MY,
    #         self.lex.IDN.CAT_THEIR,
    #         self.lex.IDN.CAT_ANON,
    #         self.lex.IDN.CAT_TRASH,
    #         self.lex.IDN.CAT_ABOUT,
    #     ]


class TestCatContOrder(TestAuthenticatedFeatures):
    pass
    # def six_contributions(self):
    #     """ Anna contributes 3 quotes, Bart also 3 quotes.  All in the "my" category. """
    #     cont = self.lex.IDN.CONTRIBUTE
    #     quote = self.lex.IDN.QUOTE
    #
    #     self.golf     = self.anna(cont, txt="golf")[quote]
    #     self.hotel    = self.anna(cont, txt="hotel")[quote]
    #     self.india    = self.anna(cont, txt="india")[quote]
    #
    #     self.lima     = self.bart(cont, txt="lima")[quote]
    #     self.mike     = self.bart(cont, txt="mike")[quote]
    #     self.november = self.bart(cont, txt="november")[quote]

    # def txt_from_order(self, order):
    #
    #     def txt_from_idn(idn):
    #         return self.lex[qiki.Number(idn)].txt
    #
    #     def txt_from_idns(idns):
    #         return [txt_from_idn(idn) for idn in idns]
    #
    #     txt_cat = ",".join(txt_from_idns(order['cat']))
    #     txt_cont = " ".join(
    #         txt_from_idn(cat) + ":" + ",".join(txt_from_idns(cont_list))
    #         for cat, cont_list in order['cont'].items()
    #     )
    #     return txt_cat + " " + txt_cont
    #
    # def reorder(self, cat, cont, cont_before_which):
    #     assert isinstance(cont_before_which, qiki.Number)
    #     self.lex.create_word(
    #         sbj=self.anna,
    #         vrb=cat,
    #         obj=cont,
    #         num=cont_before_which,
    #     )

    # def assert_order(self, auth, expected_order):
    #     expected_order = dict(fix_dict(expected_order))
    #     actual_order = auth.cat_cont_order()
    #     actual_order = dict(fix_dict(actual_order))
    #     self.assertEqual(
    #         expected_order,
    #         actual_order,
    #         "Mismatch:\n{actual} <-- actual\n{expected} <-- expected".format(
    #             expected=self.txt_from_order(expected_order),
    #             actual=self.txt_from_order(actual_order),
    #         )
    #     )
    #
    # def assert_disorder(self, auth, regex=None):
    #     order = auth.cat_cont_order()
    #     self.assertIn('error_messages', order, "Missing error message")
    #     self.assertEqual(1, len(order['error_messages']), repr(order))
    #     if regex is not None:
    #         six.assertRegex(self, order['error_messages'][0], regex)

    # def test_000_empty(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict()))

    # def test_empty_json(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.assertEqual(
    #         '{"cat":[27,28,29,30,31],"cont":{}}',
    #         json_encode(auth.cat_cont_order())
    #     )

    # def test_001_print_all_words(self):
    #     _ = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.print_all_words()
    #
    # def print_all_words(self):
    #     for word in self.lex.find_words():
    #         # noinspection PyStringFormat,SpellCheckingInspection
    #         print("Word {w:itsvo}".format(w=word))

    # def test_002_contributions(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.india.idn, self.hotel.idn, self.golf.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.mike.idn, self.lima.idn]),
    #     ))))
    #
    # def test_category_change_right_fence(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.reorder(self.lex.IDN.CAT_MY, self.mike, self.lex.IDN.FENCE_POST_RIGHT)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.india.idn, self.hotel.idn, self.golf.idn, self.mike.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.lima.idn]),
    #     ))))
    #
    # def test_category_reorder_golf(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.reorder(self.lex.IDN.CAT_MY, self.mike, self.golf.idn)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.india.idn, self.hotel.idn, self.mike.idn, self.golf.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.lima.idn]),
    #     ))))
    #
    # def test_category_reorder_hotel(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.reorder(self.lex.IDN.CAT_MY, self.mike, self.hotel.idn)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.india.idn, self.mike.idn, self.hotel.idn, self.golf.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.lima.idn]),
    #     ))))
    #
    # def test_category_reorder_india(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.reorder(self.lex.IDN.CAT_MY, self.mike, self.india.idn)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.mike.idn, self.india.idn, self.hotel.idn, self.golf.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.lima.idn]),
    #     ))))
    #
    # def test_category_trash(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     self.reorder(self.lex.IDN.CAT_TRASH, self.mike, self.lex.IDN.FENCE_POST_RIGHT)
    #     self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
    #         (int(self.lex.IDN.CAT_MY),    [self.india.idn, self.hotel.idn, self.golf.idn]),
    #         (int(self.lex.IDN.CAT_THEIR), [self.november.idn, self.lima.idn]),
    #         (int(self.lex.IDN.CAT_TRASH), [self.mike.idn]),
    #     ))))
    #
    # def test_disorder_reorder(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     invalid_cont = self.bart
    #     self.reorder(self.lex.IDN.CAT_TRASH, self.mike, invalid_cont.idn)
    #     self.assert_disorder(auth, re.compile(r'reorder.*missing', re.IGNORECASE))
    #
    # def test_disorder_cont(self):
    #     auth = FakeAuth(self.lex, self.anna)
    #     self.six_contributions()
    #     invalid_cont = self.bart
    #     self.reorder(self.lex.IDN.CAT_TRASH, invalid_cont, self.lex.IDN.FENCE_POST_RIGHT)
    #     self.assert_disorder(auth, re.compile(r'unrecorded', re.IGNORECASE))

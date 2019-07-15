from __future__ import unicode_literals

# noinspection PyUnresolvedReferences
import re
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
            '{"1":"0q82_02","3":"0q82_04"}',
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

    def test_json_encode_number_keys(self):
        self.assertEqual(
            '{"0q82_01":2,"0q82_03":4}',
            json_encode(dict((
                (qiki.Number(1), 2),
                (qiki.Number(3), 4),
            )))
        )


class WordSimple(qiki.Word):
    is_anonymous = False


class LexSimple(qiki.LexInMemory):

    def __init__(self):
        super(LexSimple, self).__init__(word_class=WordSimple)
        self.IDN = WorkingIdns(self)
        self.anna = self.define(u'agent', u'anna')


class FakeAuth(object):

    def __init__(self, lex, user):
        self.lex = lex
        # NOTE:  Unlike live WSGI fliki sessions, the IDN lookups are redone every test run
        self.is_anonymous = True
        self.qiki_user = user

    def q(self, n):
        if isinstance(n, six.string_types):
            return n
        else:
            return self.lex.idn_ify(n).qstring()


class TestAuthenticatedFeatures(unittest.TestCase):

    def setUp(self):

        self.lex = LexSimple()

        self.anna = self.lex.define(u'agent', u'anna')
        self.anna.is_anonymous = False

        self.bart = self.lex.define(u'agent', u'bart')
        self.bart.is_anonymous = False

        self.basic_categories = [
            self.lex.IDN.CAT_MY,
            self.lex.IDN.CAT_THEIR,
            self.lex.IDN.CAT_ANON,
            self.lex.IDN.CAT_TRASH,
        ]


class TestCatContOrder(TestAuthenticatedFeatures):

    def six_contributions(self):
        cont = self.lex.IDN.CONTRIBUTE
        quote = self.lex.IDN.QUOTE

        self.golf = self.anna(cont, txt="golf")[quote]
        self.hotel = self.anna(cont, txt="hotel")[quote]
        self.india = self.anna(cont, txt="india")[quote]

        self.lima = self.bart(cont, txt="lima")[quote]
        self.mike = self.bart(cont, txt="mike")[quote]
        self.november = self.bart(cont, txt="november")[quote]

    def txt_from_order(self, order):

        def txt_from_idn(idn):
            return self.lex[qiki.Number(idn)].txt

        def txt_from_idns(idns):
            return [txt_from_idn(idn) for idn in idns]

        txt_cat = ",".join(txt_from_idns(order['cat']))
        txt_cont = " ".join(
            txt_from_idn(cat) + ":" + ",".join(txt_from_idns(cont_list))
            for cat, cont_list in order['cont'].items()
        )
        return txt_cat + " " + txt_cont

    def reorder(self, cont, new_cat, new_position):
        assert isinstance(new_position, qiki.Number)
        self.lex.create_word(
            sbj=self.anna,
            vrb=new_cat,
            obj=cont,
            num=new_position,
        )

    def assert_order(self, auth, expected_order):
        expected_order = dict(fix_dict(expected_order))
        actual_order = cat_cont_order(auth)
        self.assertEqual(
            expected_order,
            actual_order,
            "Mismatch:\n{actual} <-- actual\n{expected} <-- expected".format(
                expected=self.txt_from_order(expected_order),
                actual=self.txt_from_order(actual_order),
            )
        )

    def assert_disorder(self, auth, regex=None):
        order = cat_cont_order(auth)
        self.assertIn('error_messages', order, "Missing error message")
        self.assertEqual(1, len(order['error_messages']), repr(order))
        if regex is not None:
            six.assertRegex(self, order['error_messages'][0], regex)

    def test_empty(self):
        auth = FakeAuth(self.lex, self.anna)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict()))

    def test_empty_json(self):
        auth = FakeAuth(self.lex, self.anna)
        self.assertEqual(
            '{"cat":["0q82_1B","0q82_1C","0q82_1D","0q82_1E"],"cont":{}}',
            json_encode(cat_cont_order(auth))
        )

    def test_contributions(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.india.idn, self.hotel.idn, self.golf.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.mike.idn, self.lima.idn]),
        ))))

    def test_category_change_right_fence(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.reorder(self.mike, self.lex.IDN.CAT_MY, self.lex.IDN.FENCE_POST_RIGHT)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.india.idn, self.hotel.idn, self.golf.idn, self.mike.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.lima.idn]),
        ))))

    def test_category_reorder_golf(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.reorder(self.mike, self.lex.IDN.CAT_MY, self.golf.idn)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.india.idn, self.hotel.idn, self.mike.idn, self.golf.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.lima.idn]),
        ))))

    def test_category_reorder_hotel(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.reorder(self.mike, self.lex.IDN.CAT_MY, self.hotel.idn)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.india.idn, self.mike.idn, self.hotel.idn, self.golf.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.lima.idn]),
        ))))

    def test_category_reorder_india(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.reorder(self.mike, self.lex.IDN.CAT_MY, self.india.idn)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.mike.idn, self.india.idn, self.hotel.idn, self.golf.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.lima.idn]),
        ))))

    def test_category_trash(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        self.reorder(self.mike, self.lex.IDN.CAT_TRASH, self.lex.IDN.FENCE_POST_RIGHT)
        self.assert_order(auth, dict(cat=self.basic_categories, cont=dict((
            (self.lex.IDN.CAT_MY,    [self.india.idn, self.hotel.idn, self.golf.idn]),
            (self.lex.IDN.CAT_THEIR, [self.november.idn, self.lima.idn]),
            (self.lex.IDN.CAT_TRASH, [self.mike.idn]),
        ))))

    def test_disorder_reorder(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        invalid_cont = self.bart
        self.reorder(self.mike, self.lex.IDN.CAT_TRASH, invalid_cont.idn)
        self.assert_disorder(auth, re.compile(r'reorder.*missing', re.IGNORECASE))

    def test_disorder_cont(self):
        auth = FakeAuth(self.lex, self.anna)
        self.six_contributions()
        invalid_cont = self.bart
        self.reorder(invalid_cont, self.lex.IDN.CAT_TRASH, self.lex.IDN.FENCE_POST_RIGHT)
        self.assert_disorder(auth, re.compile(r'unrecorded', re.IGNORECASE))

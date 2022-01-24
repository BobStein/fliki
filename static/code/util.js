// TODO:  Namespace this.
// noinspection JSUnusedGlobalSymbols

/**
 * util.js
 *
 * Requires jQuery as the global $.
 */

/**
 * Assert that two things are identical.  Show both values in the log if not.
 *
 * Unlike a conventional assert or an uncaught exception, this does not halt execution.
 * It only shows up in the JavaScript console, e.g. F12 or Cmd+Alt+I or Ctrl-Shift-I.
 * SEE:  expected, actual parameter order (my answer), https://stackoverflow.com/a/53603565/673991
 *
 * @param expected - often a literal
 * @param actual - often a function call or other expression
 * @param {string=} context - more stuff to be displayed on the console if there's a problem
 * @return {boolean} - support chaining:  assert_foo(a) && assert_bar(a.b)
 */
function assert_equal(expected, actual, ...context) {
    console.assert(expected === actual, "Expected:", expected, "but got:", actual, ...context);
    return expected === actual;
}
assert_equal(true, assert_equal(4, 2 + 2));

/**
 * Type declaration.  Subtypes okay.  Null or undefined are not ok.
 *
 * See type_name() and official_type_name() for terminology.  Capitalize.
 *
 * CAUTION:  Instead of type_should_be(z, Array), consider should_be_array_like(z)
 *
 * CAUTION:  type_should_be(z, Object) will accept arrays and functions.
 *
 * @param thing
 * @param {object} expected_type - e.g. String, Number, Function, MyClass, BaseClass
 *                 Because parameter is passed through the Object constructor, the formal
 *                 capitalized type names must be used.  E.g. these are both true:
 *                     type_should_be(42, Number);
 *                     type_should_be(Number(42), Number);
 *                 Also supports an array of such types, any of which valid.
 *                 TODO:  Allow null or undefined to be among the "types" meaning the
 *                        variable should/could be identical to null or undefined.
 * @return {boolean} - to support chaining:  type_should_be(a, X) && type_should_be(a.b, Y)
 */
// NOTE:  Unfortunately, JSdoc fails to have a type specifier more specific than "object" to
//        represent the canonical JavaScript constructors Number, String, etc.
function type_should_be(thing, expected_type) {
    if (is_a(expected_type, Function)) {
        if (is_specified(thing) && is_a(thing, expected_type)) {
            return true;
        } else {
            console.error(
                "Expecting a", expected_type.name,
                "type of thing, but got a", type_name(thing),
                "of value", thing
            );
            return false;
        }
    } else if (is_array_like(expected_type)) {
        var is_thing_good = false;
        var alternative_type_names = [];
        looper(expected_type, function (_, alternative_type) {
            type_should_be(alternative_type, Function);
            alternative_type_names.push(alternative_type.name);
            if (is_a(thing, alternative_type)) {
                is_thing_good = true;
            }
        });
        if ( ! is_thing_good) {
            console.error(
                "Expecting either a", alternative_type_names.join(" or "),
                "type of thing, but got a", type_name(thing),
                "of value", thing
            );
        }
        return is_thing_good;
    } else {
        console.error(
            "That's not a type, it's a",
            type_name(expected_type),
            "of value",
            expected_type
        );
        return false;
    }
}
assert_equal(true, type_should_be(42, Number));
assert_equal(true, type_should_be("X", String));
assert_equal(true, type_should_be([], Array));   // Consider should_be_array_like()
assert_equal(true, type_should_be(function () {}, Function));
assert_equal(true, type_should_be(new Date(), Date));
assert_equal(true, type_should_be($('<div>'), $));
assert_equal(true, type_should_be(42, [Number, String]));
assert_equal(true, type_should_be('42', [Number, String]));
error_expected(function () {
    assert_equal(false, type_should_be(42, String));
});
error_expected(function () {
    assert_equal(false, type_should_be(null, [Number, String]));
});

// CAUTION:  As with is_a(), it doesn't mean much to pass Object to type_should_be().
//           Although it's not quite that useless; type_should_be() won't accept null or undefined.
assert_equal(true, type_should_be({}, Object));
assert_equal(true, type_should_be([], Object));
assert_equal(true, type_should_be(function () {}, Object));
error_expected(function () {
    assert_equal(false, type_should_be(null, Object));
});
error_expected(function () {
    assert_equal(false, type_should_be(undefined, Object));
});

/**
 * For checking or enforcing type.  Slightly more versatile than instanceof or typeof.
 *
 * Better than instanceof for fundamental types,
 *     because
 *         false === 42 instanceof Number
 *     but
 *         true === is_a(42, Number)
 *         true === is_a(Number(42), Number)
 * Better than typeof for complex types,
 *     because
 *         typeof (new Date()) === 'object'
 *     but
 *         true === is_a(new Date(), Date)
 * Better than typeof for fundamental types too,
 *     because the typo
 *         typeof x === 'spring'
 *     is not caught by an IDE, but the typo
 *         is_a(x, Spring)
 *     could be.
 * About the same as instanceof for complex types,
 *     on the one hand, x instanceof T is less obscure (slight preference for this),
 *     on the other hand, is_a(x, T) is slightly briefer.
 *
 * SEE:  typeof vs instanceof, https://stackoverflow.com/a/6625960/673991
 *
 * CAUTION:  Don't use `Object` for the second parameter.  It doesn't mean much.
 *     true === is_a(function () {}, Object)   // use is_associative_array()
 *     true === is_a(undefined, Object)        // use is_defined()
 *     true === is_a(null, Object)             // use is_specified()
 *     true === is_a([], Object)               // use is_array_like() or is_array()
 *
 * CAUTION:  Don't test for null or undefined, use is_specified() or is_defined().
 *
 * @param thing
 * @param expected_type - String, Number
 * @return {boolean}
 */
function is_a(thing, expected_type) {
    return Object(thing) instanceof expected_type;
}
assert_equal(false, is_a(42, String));
assert_equal(true, is_a(42, Number));
assert_equal(true, is_a("X", String));
assert_equal(true, is_a([], Array));
assert_equal(true, is_a(function () {}, Function));

// CAUTION:  is_a(z, Object) doesn't mean much.
assert_equal(true, is_a(function () {}, Object));
assert_equal(true, is_a(undefined, Object));
assert_equal(true, is_a(null, Object));
assert_equal(true, is_a([], Object));

/**
 * Console error if it doesn't quack like an array.
 *
 * Includes strings, jQuery collections, and objects with length and first and last elements.
 *
 * @param putative_array
 * @param {object=} element_type_should_be - optional type expected for all elements.
 *                                           Use formal constructors, e.g. Number, String.
 *                                           Can be an array of acceptable types.
 * @returns {boolean} - true=it quacks like an array, and element types are as expected.
 */
function should_be_array_like(putative_array, element_type_should_be) {
    if (is_array_like(putative_array)) {
        if (is_specified(element_type_should_be)) {
            var all_elements_correct_type = true;
            looper(putative_array, function (index, element) {
                if ( ! type_should_be(element, element_type_should_be)) {
                    console.error(f("...in array element {i} of {n}", {
                        i: parseInt(index) + 1,
                        n: putative_array.length
                    }));
                    all_elements_correct_type = false;
                }
            });
            return all_elements_correct_type;
        } else {
            return true;
        }
    }
    console.error(
        "Expecting an array-like thing, but got a", type_name(putative_array),
        "of value", putative_array
    );
    return false;
}
assert_equal(true, should_be_array_like(['yes', 'array']));
error_expected(function () {
    assert_equal(false, should_be_array_like(42));
});
assert_equal(true, should_be_array_like([42, 216, 3435], Number));
error_expected(function () {
    assert_equal(false, should_be_array_like([42, 216, "square"], Number));
});

/**
 * The callback is expected to generate a console.error() -- but run to completion anyway.
 *
 * This does NOT detect an exception, and would not give an error if one were thrown.
 * It merely detects whether console.error() were called by the callback.
 *
 * The error the callback generated is NOT displayed on the console.  It is trashed.
 * Rather, an error is displayed on the console if the callback does NOT call console.error().
 *
 * @param callback
 */
// TODO:  Optional regular expression to match the contents of the expected error message.
function error_expected(callback) {
    var number_of_error_calls = 0;

    function fake_error(/* not using the expected error message */) {
        number_of_error_calls++;
    }

    var real_error = console.error;
    console.error = fake_error;

    callback();

    console.error = real_error;
    if (number_of_error_calls === 0) {
        console.error("This function should have called console.error():", callback);
    }
}
error_expected(function () { console.error("Pretend something is wrong."); });
error_expected(function () { error_expected(function () { /* Pretend nothing is wrong. */ }); });


function sanitized_domain_from_url(url) {
    if (url === null) {
        return null;
    }
    var domain_simple = simplified_domain_from_url(url);
    var ALL_GROUPS_OF_NON_ALPHANUMERICS = /[^0-9A-Za-z]+/g;
    var domain_sanitized = domain_simple.replace(ALL_GROUPS_OF_NON_ALPHANUMERICS, '_');
    return domain_sanitized;
}
assert_equal('foo_exam_ple', sanitized_domain_from_url('https://www.Foo.Exam---ple.com/'));
assert_equal('no_domain', sanitized_domain_from_url('https://www.e%ample.com/'));
assert_equal('no_domain', sanitized_domain_from_url('ordinary string'));
assert_equal(null, sanitized_domain_from_url(null));

function simplified_domain_from_url(url) {
    var domain = domain_from_url(url);
    var domain_simpler = domain
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
    ;
    return domain_simpler;
}
assert_equal('example', simplified_domain_from_url('https://www.example.com/foo'));

/**
 * Extract domain name from a valid URL.
 *
 * Examples of invalid urls:
 *     'example.com'           (no http)
 *     'https://example.com'   (no slash)  TODO:  Allow this?
 *                             SEE:  https://webmasters.stackexchange.com/a/33074/17601
 *     'https://exa_ple.com'   (invalid character in domain)
 *     'https://e%ample.com'   (invalid character in domain)
 *
 * @param url {string} - e.g. 'http://example.com/foo/'
 * @return {string} - e.g. 'example.com'
 *                    always lowercase
 *                    MIGHT return 'no.domain' if url is invalid.
 */
function domain_from_url(url) {
    if (is_string(url) && url !== '') {
        var $a = $('<a>').prop('href', url);
        var href_back;
        try {
            href_back = $a.prop('href');
        } catch (e) {
            console.error("couldn't read back href on", url);
            // EXAMPLE (IE11):  couldn't read back href on https://www.e%ample.com/
            // EXAMPLE (IE11):  couldn't read back href on https://e%ample.com/
            // NOTE:  Without this try-catch there's an Invalid Argument deep in jQuery.
        }
        // noinspection JSObjectNullOrUndefined
        if (is_specified(href_back) && href_back.toLowerCase() === url.toLowerCase()) {
            // TODO:  Spawn off an is_valid_url() function?
            var hostname = $a.prop('hostname');
            // THANKS:  domain from url, https://stackoverflow.com/a/4815665/673991
            if (hostname) {
                return hostname.toLowerCase();
            }
        }
    }
    return 'no.domain';
    // TODO:  Make this special case string more generic.
}
// noinspection HttpUrlsUsage
assert_equal('example.com', domain_from_url('http://example.com/'));
assert_equal('exam-ple.com', domain_from_url('https://Exam-ple.com/Foo/?Bar=Baz'));
assert_equal('no.domain', domain_from_url('https://e%ample.com/'));
assert_equal('no.domain', domain_from_url('example.com'));
assert_equal('no.domain', domain_from_url(''), JSON.stringify(domain_from_url('')));

function $_from_class(class_) {
    return $(selector_from_class(class_));
}

function $_from_id(id) {
    return $(selector_from_id(id));
}
function selector_from_id(id) {
    return '#' + $.escapeSelector(id);
}
function selector_from_class(class_) {
    return '.' + $.escapeSelector(class_);
}

/**
 * Get the value of a query-string parameter in the URL that loaded the page (not the .js)
 *
 * EXAMPLE:  If the page were https://example.com/foo.html?bar=baz, then 'baz' === query_get('bar')
 * @param name
 * @param default_value - value in case it was missing from the query string
 * @returns {string|*}
 */
function query_get(name, default_value) {
    default_value = is_defined(default_value) ? default_value : null;
    // CAUTION:  Bad idea:  default_value = default_value || null
    //           That would turn 0 into null.
    // NOTE:  default_value can never be the primitive value `undefined`.
    var query_params = new window.URLSearchParams(window.location.search);
    var value = query_params.get(name);
    if (value === null) {
        return default_value;
    } else {
        return value;
    }
}

function random_element(an_array) {
    return an_array[Math.floor(Math.random() * an_array.length)];
    // THANKS:  https://stackoverflow.com/a/4550514/673991
}
assert_equal(42, random_element([42, 42, 42]));

/**
 * Loop through object or array.  Call back on each key-value pair.
 *
 * A drop-in replacement for jQuery.each().
 *
 * @param object - e.g. {a:1, b:2} or [1,2,3]
 * @param callback - function called on each element of the array / object
 *                   `this` is each value, as it is in $.each())
 *                   key, value are the parameters to the callback function
 *                       key is the name of the property for { objects }
 *                       key is the STRING-FORM index of the array for [ arrays ] --
 *                       CAUTION:  key is always a string!
 *                   return false (not just falsy) to prematurely terminate the looping
 * @return {*} - return the object, a convenience for chaining I guess.
 *               Seems as if $.each does this.
 *
 * CAUTION:  For an array, the callback index is a string.  Use parseInt() to make it an integer.
 *
 * SEE:  jQuery .call():  https://github.com/jquery/jquery/blob/438b1a3e8/src/core.js#L247
 *       where `this` is the same as the 2nd parameter, both for arrays and for objects.
 *
 * SEE:  object property keys are always strings, https://stackoverflow.com/a/3633390/673991
 *
 * SEE:  $.each() bug for objects (my own posting), https://stackoverflow.com/a/49652688/673991
 */
// TODO:  async_interval, async_chunk, async_done optional parameters!
//        Unifying setTimeout() and $.each(), as it were.
//        async={interval: milliseconds, chunk:iterations_per_interval, done:callback}
//                         default 0           default 1                     default nothing
// TODO:  Provide done() and fail() parameters.
//            done() would get called if callback() never returns false
//            fail() would get called if callback() ever returns false
//        Or maybe looper() should return a jQuery promise object that achieves that.
//        Then looper().done() would slightly resemble the for-else clause in Python.
//        But that would (further?) break compatibility with jQuery.each().
function looper(object, callback) {
    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            var return_value = callback.call(
                object,       // <-- 'this' is the container object
                key,          // <-- 1st parameter - key or property name
                object[key]   // <-- 2nd parameter - value
            );
            if (false === return_value) {
                break;
            }
        }
    }
    return object;
}
var looper_test = [];
looper({foo:1, length:0, bar:2}, function (k,v) {
    looper_test.push(k+"="+v);
});
assert_equal("foo=1,length=0,bar=2", looper_test.join(","));

looper_test = [];
looper([1,2,42,8,9], function (i,v) {
    looper_test.push(i+"="+v); return v !== 42;
});
assert_equal("0=1,1=2,2=42", looper_test.join(","));

/**
 * Compare non-integer numbers, avoiding floating point pitfalls.
 *
 * @param value1
 * @param value2
 * @param tolerance
 * @return {boolean|boolean}
 */
function equal_ish(value1, value2, tolerance) {
    return (value1 - tolerance < value2 && value2 < value1 + tolerance);
}
console.assert(  equal_ish(42.0, 42.1, 0.11));
console.assert(! equal_ish(42.0, 42.1, 0.09));

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}
console.assert('string'.startsWith('str'));
// THANKS:  .startsWith() polyfill,
//          https://developer.mozilla.org/Web/JavaScript/Reference/Global_Objects/String/startsWith

/**
 * Remove a prefix.  Or if it wasn't there, return the same string.
 */
function strip_prefix(str, prefix) {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    } else {
        return str;
    }
}
assert_equal('berry', strip_prefix('raspberry', 'rasp'));
assert_equal('inflammable', strip_prefix('inflammable', 'un'));

/**
 * Report the time between a series of events.
 *
 * Example:
 *     var t = Timing();
 *
 *     step_one();
 *     t.moment("one");
 *
 *     step_two();
 *     t.moment("two");
 *
 *     console.log(t.report());   // "1.701: one 1.650, two 0.051"
 *
 * @return {Timing}
 * @constructor
 */
function Timing() {
    if ( ! (this instanceof Timing)) {
        return new Timing();
    }
    // THANKS:  Automatic 'new', https://stackoverflow.com/a/383503/673991

    var that = this;
    that.log = [];
    that.moment(null);
}

/**
 * @return {string}
 */
Timing.prototype.report = function Timing_report(after_total, between_times) {
    if ( ! is_string(after_total)) after_total = ": ";
    if ( ! is_string(between_times)) between_times = ", ";
    var that = this;
    if (that.log.length >= 2) {
        var report_pieces = [];
        for (var i = 1 ; i < that.log.length ; i++) {
            var delta_milliseconds = that.log[i].ms - that.log[i-1].ms;
            var delta_seconds = delta_milliseconds / 1000.0;
            report_pieces.push(that.log[i].what + " " + delta_seconds.toFixed(3));
        }
        var overall_milliseconds = that.log[that.log.length-1].ms - that.log[0].ms;
        var overall_seconds = overall_milliseconds / 1000.0;
        return overall_seconds.toFixed(3) + after_total + report_pieces.join(between_times);
    } else {
        return "(nothing timing)"
    }
};

Timing.prototype.moment = function Timing_moment(what) {
    var that = this;
    that.log.push({what:what, ms:(new Date()).getTime()});
};

/**
 * Polyfill for window.URLSearchParams.get(), so it works in IE11
 *
 * THANKS:  https://stackoverflow.com/a/50756253/673991
 */
(function (window) {
    window.URLSearchParams = window.URLSearchParams || function (searchString) {
        var self = this;
        self.searchString = searchString;
        self.get = function (name) {
            var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
            if (results === null) {
                return null;
            } else {
                return decodeURI(results[1]) || 0;
            }
        };
    }
})(window);

/**
 * Are there any single newlines in this string?  They indicate "poetry" formatting.
 *
 * Poetry formatting means there are hard-returns in the text, meant to end lines at
 * specific places and prevent reflow to the margins.
 * Double newlines don't count.  Those are paragraph boundaries.
 * CRs dont count.  Some browsers may use them.
 * Final line terminators don't count.  Might have seen Chrome append LF for no reason.
 *
 * THANKS:  match 1 or 2 newlines, https://stackoverflow.com/a/18012324/673991
 *          Using String.replace() to loop through each bundle of line terminators.
 *
 * SEE:  String.replace() callback,
 *       https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_a_parameter
 */
function any_lone_newlines(string) {
    const LF_OR_CRLF_BUNCHES = /(\r?\n)+/g;
    var return_value = false;
    var string_trimmed = string.trim();   // Ignore starting or ending LFs.
    string_trimmed.replace(LF_OR_CRLF_BUNCHES, function (terminator) {
         var newlines_only = terminator.replace(/\r/g, '');
         if (newlines_only.length === 1) {   // 2 = paragraph, 1 = lone LF, 0 = impossible
             return_value = true;
         }
    });
    return return_value;
}
assert_equal(false, any_lone_newlines("abc"));
assert_equal(false, any_lone_newlines("abc\n"));
assert_equal( true, any_lone_newlines("abc\ndef"));
assert_equal(false, any_lone_newlines("abc\n\ndef"));
assert_equal(false, any_lone_newlines("abc\n\n\ndef"));
assert_equal(false, any_lone_newlines("abc" + "\r\n" + "\r\n" + "\r\n" + "def"));
assert_equal( true, any_lone_newlines("abc\n\ndef\n\nghi\njkl"));

/**
 * Is a container nonempty?  For string, array, or associative array.  Null or undefined is empty.
 *
 * Not for use on numbers or intrinsic types (Date, Number).
 * Better than treating as boolean, e.g. if (thing), !!thing, Boolean(thing),
 * because in JavaScript (unlike Python), [] and {} are truthy.  By the way "" is falsy.
 *
 * THANKS:  Nonnegative synonym for nonempty, https://english.stackexchange.com/a/102788/18673
 *          For those do not think double-negatives are unconfusing.
 *
 * @param thing - expected string or array or associative array (aka object),
 *                when null or undefined means the same as empty.
 * @return {boolean}
 */
function is_laden(thing) {
    return ! $.isEmptyObject(thing);
}
assert_equal(false, is_laden(undefined));
assert_equal(false, is_laden(null));
assert_equal(false, is_laden(""));   // string
assert_equal( true, is_laden(" "));
assert_equal(false, is_laden([]));   // array
assert_equal( true, is_laden([null]));
assert_equal(false, is_laden({}));   // associative array
assert_equal( true, is_laden({'': ''}));

/**
 * Not undefined, and not null.
 */
function is_specified(z) {
    return is_defined(z) && z !== null;
}
assert_equal(false, is_specified(undefined));
assert_equal(false, is_specified(null));
assert_equal( true, is_specified(0));
assert_equal( true, is_specified(''));

/**
 * Not undefined.
 */
function is_defined(x) {
    return typeof x !== 'undefined';
}
assert_equal(false, is_defined(undefined));
assert_equal( true, is_defined(0));

function is_string(x) {
    return is_a(x, String);
}
assert_equal( true, is_string(''));
assert_equal(false, is_string(0));

/**
 * Does an array, object, or string contain a thing?
 *
 * An array-like object would compare the INDEXES.  A true array would compare the VALUES.
 *
 * @param collection - array, object, or string
 * @param thing
 * @return {boolean}
 */
function has(collection, thing) {
    if (collection === null || typeof collection === 'undefined') {
        // TODO:  Explain why this should not throw an exception.
        return false;
    } else if (is_array(collection)) {
        return $.inArray(thing, collection) !== -1;
    } else if (is_associative_array(collection)) {
        return collection.hasOwnProperty(thing);
    } else if (is_string(collection)) {
        return collection.indexOf(thing) !== -1;
    } else {
        console.error("Don't understand has(", type_name(collection), ", )", collection, thing);
    }
}
assert_equal( true, has([1, 2, 3], 2));
assert_equal(false, has([1, 2, 3], 9));
assert_equal( true, has({one:1, two:2, three:3}, 'three'));
assert_equal(false, has({one:1, two:2, three:3}, 3));
assert_equal( true, has('alphabet', 'a'));
assert_equal(false, has('alphabet', 'z'));
assert_equal(false, has(undefined, 'anything'));
assert_equal(false, has(null, 'anything'));

// TODO:  Use or lose has_method().  E.g. in enter_full_screen()
function has_method(object_instance, method_name_string) {
    return method_name_string in object_instance;
}
assert_equal(true, has_method(window, 'hasOwnProperty'));
assert_equal(false, window.hasOwnProperty('hasOwnProperty'));

/**
 * Is this an honest to Oprah array?
 *
 * Different from is_array_like():
 *     is_array()          includes an allocated but uninitialized array.
 *     is_array() DOES NOT include a string.
 *     is_array() DOES NOT include a jQuery container.
 *     is_array() DOES NOT include an object with a length and numeric properties.
 *
 * @param z
 * @return {boolean}
 */
function is_array(z) {
    return is_a(z, Array);
}
assert_equal( true, is_array([]));
assert_equal( true, is_array([1,2,3]));
assert_equal( true, is_array(Array(1,2,3)));
assert_equal( true, is_array(new Array(3)));

assert_equal(false, is_array({a:1, b:2}));
assert_equal(false, is_array(42));
assert_equal(false, is_array("etc"));
assert_equal(false, is_array(null));
assert_equal(false, is_array(undefined));
assert_equal(false, is_array(true));
assert_equal(false, is_array(function () {}));
assert_equal(false, is_array($('<input> <br>')));
assert_equal(false, is_array({length:2, 0:'x', 1:'y'}));

/**
 * Does this behave like an array?
 *
 * Differences from is_array():
 *     is_array_like()          includes strings.
 *     is_array_like()          includes jQuery collection.
 *     is_array_like()          includes an object with a length and first and last elements.
 *     is_array_like() DOES NOT include an allocated but uninitialized array, e.g. new Array(3)
 *
 * @param putative_array
 * @return {boolean}
 */
function is_array_like(putative_array) {
    if (putative_array.hasOwnProperty('length')) {
        if (is_a(putative_array.length, Number)) {
            var n = putative_array.length;
            if (n === 0) {
                return true;
            } else if (n > 0) {
                if (putative_array.hasOwnProperty(0) && putative_array.hasOwnProperty(n-1)) {
                    return true;
                }
            }
        }
    }
    return false;
}
assert_equal(true, is_array_like(['alpha', 'bravo']));
assert_equal(true, is_array_like({length:2, 0:'alpha', 1:'bravo'}));
assert_equal(true, is_array_like($('<input> <br>')));   // 3 elements
assert_equal(true, is_array_like('yes strings are array-like'));

assert_equal(false, is_array_like(42));
assert_equal(false, is_array_like({length:99, 0:'alpha', 1:'bravo'}));
// NOTE:  Would be array-like, except it's missing a [98] element.
assert_equal(false, is_array_like(new Array(3)));
// noinspection JSLastCommaInArrayLiteral,JSConsecutiveCommasInArrayLiteral
assert_equal(false, is_array_like([, , , ]));
// noinspection JSPrimitiveTypeWrapperUsage
assert_equal(true, is_array_like(new Array()));
assert_equal(true, is_array_like([]));
assert_equal(true, is_array_like([undefined, undefined, undefined]));
// NOTE:  An Array with empty slots fails is_array_like() because it has no first and last
//        elements.  But an empty array squeaks by.
//        An array with undefined stored in its slots also passes.
// SEE:  Why [] is better than new Array(), https://stackoverflow.com/a/8206581/673991

/**
 * Is this a plain object with properties?
 *
 * Includes an object literal.
 * Includes a class instance.
 *
 * Why is_associative_array() is a better name for this function than is_object()?
 * Because 'object' is too generic a term in JavaScript.  Lots of things are objects.
 *     'object' === typeof [1,2,3]
 *     true === [1,2,3] instanceof Object
 *         but we don't think of an array as a "plain object"
 *     'object' === typeof null
 *         but we don't think of null as a "plain object"
 *         by the way:  false === null instanceof Object
 *
 * SEE:  (my post) https://stackoverflow.com/a/61426885/673991
 *
 * @param z - an object of any type
 * @return {boolean}
 */
function is_associative_array(z) {
    return String(z) === '[object Object]';
}
assert_equal( true, is_associative_array({a:1, b:2}));
assert_equal( true, is_associative_array(new function Legacy_Class() {}));
assert_equal( true, is_associative_array(new class ES2015_Class{}));
assert_equal(false, is_associative_array(window));
assert_equal(false, is_associative_array(new Date()));
assert_equal(false, is_associative_array([]));
assert_equal(false, is_associative_array([1,2,3]));
assert_equal(false, is_associative_array(Array(1,2,3)));
assert_equal(false, is_associative_array(42));
assert_equal(false, is_associative_array("etc"));
assert_equal(false, is_associative_array(null));
assert_equal(false, is_associative_array(undefined));
assert_equal(false, is_associative_array(true));
assert_equal(false, is_associative_array(function () {}));

/**
 * Get a formal type name.  Legacy JavaScript class instances are all 'Object'.
 *
 * Extracts it from the Object class toString() method, which always gives
 * a string like "[Object {type name}]"
 *
 * THANKS:  ES3 vintage Object.toString(), https://stackoverflow.com/a/22289869/673991
 *
 * @param z - an object of any type
 * @return {string} - a simple reliable name for the type of the object
 */
function official_type_name(z) {
    var simple_reliable_type_description = Object.prototype.toString.call(z);
    // EXAMPLE:  '[object Object]'
    var matcher = simple_reliable_type_description.match(/^\[object (\w+)]$/);
    if (matcher === null) {
        return simple_reliable_type_description;   // Never found a way to make this happen.
    } else {
        return matcher[1];
    }
}
assert_equal('Boolean',   official_type_name(true));
assert_equal('Number',    official_type_name(3));
assert_equal('String',    official_type_name("three"));
assert_equal('Function',  official_type_name(function () {}));
assert_equal('Null',      official_type_name(null));
assert_equal('Undefined', official_type_name(undefined));
assert_equal('Array',     official_type_name([1,2,3]));
assert_equal('Object',    official_type_name({a:1, b:2}));
assert_equal('Date',      official_type_name(new Date()));
assert_equal('String',    official_type_name(Date()));
assert_equal('Object',    official_type_name(new function Legacy_Class() {}));
assert_equal('Object',    official_type_name(new class ES2015_Class{}));

/**
 * Get a more human-readable type name, especially for JavaScript Legacy class instances.
 *
 * CAUTION:  Minified code loses some constructor names,
 *           https://stackoverflow.com/q/10314338/673991#comment17433297_10314492
 *
 * @param z - an object of any type
 * @return {string}
 */
function type_name(z) {
    var the_official_name = official_type_name(z);
    if (the_official_name === 'Object') {
        try {
            return z.constructor.name;
        } catch (exception) {
            if (exception instanceof TypeError) {
                console.error("Object with no constructor", z);
                return the_official_name;
            } else {
                console.error("Freakish object", z, exception);
                throw exception;   // Never found a way to make this happen
            }
        }
    } else {
        return the_official_name;
    }
}
assert_equal('Boolean',      type_name(true));
assert_equal('Number',       type_name(3));
assert_equal('String',       type_name("three"));
assert_equal('Function',     type_name(function () {}));
assert_equal('Null',         type_name(null));
assert_equal('Undefined',    type_name(undefined));
assert_equal('Array',        type_name([1,2,3]));
assert_equal('Object',       type_name({a:1, b:2}));
assert_equal('Date',         type_name(new Date()));
assert_equal('String',       type_name(Date()));
assert_equal('Object',       type_name({a:1, b:2}));
assert_equal('Legacy_Class', type_name(new function Legacy_Class() {}));
assert_equal('ES2015_Class', type_name(new class ES2015_Class{}));
error_expected(function () {
    assert_equal('Object', type_name({constructor: null}));
})
error_expected(function () {
    assert_equal('Object', type_name(new class Foo{constructor(){this.constructor=null;}}));
})

// function default_to(parameter, default_value) {
//     if (is_defined(parameter)) {
//         return parameter;
//     } else {
//         return default_value;
//     }
// }
// assert_equal('red',  default_to('red',     'blue'));
// assert_equal('blue', default_to(undefined, 'blue'));
// assert_equal(null,   default_to(null,      'blue'));
// NOTE:  Tossing out the default_to() function.  Because this:
//            x = default_to(x, d);
//        is less readable than:
//            x = x || d;
// TODO:  Bring it back!
//        Because this practice eclipses an explicit falsy value with the default value.
//        Eventually you're going to want an explicit falsy value that isn't clobbered:
//            false, 0, "", null, NaN
//        Possible syntax:   (New convention:  '_optional' suffix in the parameter list)
//            function f(x, y_optional) {
//                y = default_to(y_optional, default_value);
//                y = typeof y_optional === 'undefined' ? default_value : y_optional;
//                y = is_defined(y_optional) ? y_optional : default_value;

/**
 * Verify that a missing function parameter is undefined.
 */
function _missing_parameters_are_undefined(missing_parameter) {
    if (is_defined(missing_parameter)) console.error("Expecting undefined, not", missing_parameter);
}
_missing_parameters_are_undefined();
_missing_parameters_are_undefined(undefined);
error_expected(function () {
    _missing_parameters_are_undefined(null);
})

/**
 * Call a process until it's done.  Relinquish control between chunks of process calls.
 *
 * @param {object}   opt - {process, delay_ms, n_chunk, then, do_early}
 * @param {function} opt.process - callback is called until it returns false
 * @param {number}   opt.delay_ms - milliseconds between chunks, 0 for minimal relinquishment.
 * @param {number}   opt.n_chunk - number of times to call process() between each relinquishment.
 * @param {function} opt.then - callback after done
 * @param {boolean=} opt.do_early - true=get started with a chunk right away
 *                                  false=wait delay_ms before starting the first chunk
 *
 * @return {number} - something to pass to clearInterval() to stop iteration prematurely.
 *                    If this value is saved, it must be passed to clearInterval()
 *                    before then() is called.
 *                    If the value is null, no interval was started, and so there's no need to call
 *                    clearInterval().
 *                    Typically whatever variable stores this value, is nulled by then().
 */
function iterate(opt) {
    opt.then ||= function () {};
    opt.do_early ||= false;
    if (typeof opt.n_chunk !== 'number' || opt.n_chunk < 1) {
        opt.n_chunk = 1;
    }

    var i_step = 0;
    var is_done = false;
    var interval = null;

    function chunk() {
        for (var i_chunk = 0 ; i_chunk < opt.n_chunk ; i_chunk++) {
            is_done = opt.process(i_step);
            if (is_done) {
                if (interval !== null) {
                    clearInterval(interval);
                }
                opt.then(i_step);
                return;
            } else {
                i_step++;
                // NOTE:  Assume the opt.process() returning false is a do-nothing step.
                //        So it is not counted in the value passed to opt.then().
            }
        }
    }

    if (opt.do_early) {
        chunk();
    }
    if ( ! is_done) {  // If 1 chunk was enough, won't need to called setInterval().
        interval = setInterval(function array_async_single_chunk() {
            console.debug("interval chunk", i_step);
            chunk();
        }, opt.delay_ms);
    }
    return interval;
}

/**
 * Process the members of an array asynchronously.  looper() for compute-bound tasks.
 *
 * Avoid Chrome warnings e.g. 'setTimeout' handler took 1361ms
 *
 * THANKS:  Code derived from 4th option at https://stackoverflow.com/a/45484448/673991
 *
 * @param array - e.g. $('div')
 * @param process - callback function (parameter is each array element)
 * @param delay_ms - milliseconds between calls, 0 to run "immediately" though OS intervenes
 *                   (higher value means SLOWER)
 * @param n_chunk - (optional) e.g 10 to handle 10 elements per iteration
 *                  (higher value means FASTER, but may hamstring UX)
 * @param then - (optional) called after array is finished, to do what's next
 * @return {object} setInterval object, caller could pass to clearInterval() to abort.
 */
function array_async(array, process, delay_ms, n_chunk, then) {
    should_be_array_like(array);
    if (typeof n_chunk !== 'number' || n_chunk < 1) {
        n_chunk = 1;
    }
    var i = 0;
    var interval = setInterval(function array_async_single_chunk() {
        var i_chunk;
        for (i_chunk = 0 ; i_chunk < n_chunk ; i_chunk++) {
            process(array[i]);
            // FIXME:  Overflows an empty array.
            if (i++ >= array.length - 1) {
                clearInterval(interval);
                if (is_specified(then)) {
                    then();
                }
                return;
            }
        }
    }, delay_ms);
    return interval;
}

/**
 * Enumeration with names, values, and optional descriptions.
 *
 * Example:
 *     Color = Enumerate({
 *         RED: "the color of cabernet sauvignon",
 *         GOLD: "as Zeus' famous shower",
 *         BLACK:  "starless winter night's tale"
 *     });
 *     var wish = Color.BLACK;
 *     console.assert(wish.name === 'BLACK');
 *     console.assert(wish.value === 2);
 *     console.assert(wish.description.indexOf('night') !== -1);
 *     console.assert(Color.number_of_values === 3);
 *
 * @param enumeration - e.g. {NAME1: {description: "one"}, NAME2: "two"}
 * @return {object} - returns the enumeration object of objects,
 *                    each one of which has
 *                        name,
 *                        description, and
 *                        value members.
 *                    e.g. {
 *                        NAME1: {name: 'NAME1', description: "one", value: 0},
 *                        NAME2: {name: 'NAME2', description: "two", value: 1},
 *                        number_of_values: 2
 *                    }
 */
// SEE:  Debate on value order, https://stackoverflow.com/q/5525795/673991
// TODO:  Method to test whether some random object is a member of an Enumeration?
// TODO:  Make this a proper JavaScript class (ES5 that is).
function Enumerate(enumeration) {
    var value_zero_based = 0;
    looper(enumeration, function (name, object) {
        if (object === null || typeof object !== 'object') {
            object = {description: object};
        }
        object.name = name;
        object.value = value_zero_based;
        enumeration[name] = object;   // displaces the member if value was a string (description)
        value_zero_based++;
    });
    enumeration.number_of_values = value_zero_based;
    return enumeration;
}

/**
 * Map a number from one range to another range, linearly.
 *
 * In other words, x1, x, x2 maps to
 *                 y1, y, y2 where y is the return value
 *
 * x does not have to be BETWEEN x1 and x2.  So out-of-range is not an error.
 *
 * @param  {number} x - input value
 * @param  {number} x1 \
 * @param  {number} x2 / range of the input (CAUTION:  x1 == x2 will return NaN)
 * @param  {number} y1 \
 * @param  {number} y2 / range of the output
 * @return {number} - y output value
 */
function linear_transform(
    x,
    x1, x2,
    y1, y2
) {
    if (x1 === x2) return NaN;
    if (y1 === y2) return NaN;

    var y = (x - x1) * (y2 - y1) / (x2 - x1) + y1;
    return y;
}
assert_equal(220, linear_transform(22, 0, 100, 0, 1000));
assert_equal(-1000, linear_transform(890, 880, 870, 0, 1000));

/**
 * Plain jane, crude jude, string formatter.
 *
 * @param message - string with "{name}" symbols in it.
 * @param parameters - name to value mapping.
 * @return {string}
 *
 * "rock vs paper" === f("{a} vs {b}", {a:"rock", b:"paper"})
 *
 * THANKS:  replaceAll() is universal enough, https://stackoverflow.com/a/1144788/673991
 * THANKS:  String() trumps .toString(), https://stackoverflow.com/a/35673907/673991
 */
function f(message, parameters) {
    var formatted_message = message;
    looper(parameters, function (name, value) {
        var symbol = '{' + name + '}';
        formatted_message = formatted_message.replaceAll(symbol, String(value));
    });
    return formatted_message;
}
assert_equal("rock vs paper", f("{a} vs {b}", {a: 'rock', b: 'paper'}));
assert_equal("to do or not to do", f("to {be} or not to {be}", {be: 'do'}));

/**
 * Drop-in replacement for jQuery $element.animate(props, opts), but works around the ASS-OS bug.
 *
 * These are equivalent:
 *     $element.animate(properties, options);
 *     animate_surely($element, properties, options);
 *
 * CAUTION:  Does not support the legacy jQuery .animate() form, with separate parameters for
 *           duration, easing, complete.  Must use the form with the options object.
 * CAUTION:  Returns undefined.
 *
 * @param element
 * @param properties
 * @param options
 */
function animate_surely(element, properties, options) {
    var duration = options.duration || 1000;
    type_should_be(duration, Number);
    var timeout = duration * 2;
    var complete = options.complete || function () {};
    var $element = $(element);
    var animation_timeout = setTimeout(function () {
        animation_timeout = null;
        console.log(
            "AVERTED ASS-OS BUG:  ANIMATION STUCK SCROLLED OFF SCREEN",
            $element.attr('id') || $element.attr('class')
        );
        // NOTE:  Give up on animation, it's taking too long.
        //        First observed in Chrome circa 2020.0518.
        //        Then in Opera and Edge.  But never in Firefox.
        //        Did someone somewhere decide animations scrolled off screen
        //        don't need no lovin?
        //        Hmm, I wonder if this animation asphyxiation only happens on sub-iframes?
        $element.stop();
        $element.css(properties);
        // FALSE WARNING:  Promise returned from complete is ignored
        // noinspection JSIgnoredPromiseFromCall
        complete();
    }, timeout);
    var modified_options = $.extend({}, options, {
        complete: function () {
            if (animation_timeout !== null) {
                clearTimeout(animation_timeout);
                animation_timeout = null;
                // FALSE WARNING:  Promise returned from complete is ignored
                // noinspection JSIgnoredPromiseFromCall
                complete();
                // NOTE:  complete() is called exactly once.  Either by
                //        animation doing its duty and completing.  Or by it
                //        going into la-la-land for some reason and leaving
                //        animation_timeout to do its job.
            }
        }
    });
    $element.animate(properties, modified_options);
}

/**
 * Convert jQuery object to DOM object.  Selector works too:  dom_from_$('.css-class')
 *
 * SEE:  What could possibly justify all this wordy verbosity here?  `[0]` would totally work.
 *       (my answer) https://stackoverflow.com/a/62595720/673991
 *
 * NOTE:  The JSDoc tag `@param {jQuery} $jquery_object` makes noisome warnings in caller code,
 *        e.g. Argument type {get: function(): any} is not assignable to parameter type jQuery
 *
 * @param $jquery_object - or a selector string, e.g. '#id'
 * @return {HTMLElement|undefined}
 */
function dom_from_$($jquery_object) {
    type_should_be($jquery_object, [$, String]);
    console.assert(
        $($jquery_object).length === 1,
        "Expecting exactly one element",
        $jquery_object
    );
    var dom_object = $($jquery_object).get(0);
    return dom_object;
}

/**
 * Convert an array of things to an array of strings.
 *
 * TODO:  max_length, if too long, show e.g. ... (100 more)
 *
 * @param {Array} things
 * @return {Array.<string>}
 */
function stringify_array(things) {
    return things.map(String);
}
assert_equal(
                      "string, 0, 1, 2, 3, null, undefined, false, NaN, 1,2",
    stringify_array(['string', 0, 1, 2, 3, null, undefined, false, 0/0, [1,2]]).join(", ")
);

function first_word(string) {
    return string.trim().split(' ')[0];
}
assert_equal("foo", first_word(" foo bar "));
assert_equal("",    first_word(""));

/**
 * Get the last element of an array.
 *
 * Honorable mention to the array.slice(-1)[0] method and its gratuitous brevity,
 * https://stackoverflow.com/a/12099341/673991
 */
function last_item(array, value_if_empty) {
    var n = array.length;
    if (n === 0) {
        return value_if_empty;
    } else {
        return array[n-1];
    }
}
assert_equal(42, last_item([1,2,3,42]))
assert_equal("default", last_item([], "default"))
assert_equal(undefined, last_item([]))

/**
 * Colorize a line in the JavaScript console.
 *
 * EXAMPLE:
 *     console_log_styled("Robin", 'color: blue; background-color: cyan;');
 *
 * @param message - the whole message in one string, not comma-separated parts
 * @param css - css style properties and values
 */
function console_log_styled(message, css) {
    console.log('%c' + message, css);
    // THANKS:  colors in DevTools, https://stackoverflow.com/a/13017382/673991
}

function is_strict_subclass(class_child, class_parent) {
    return class_child.prototype instanceof class_parent;
    // THANKS:  JavaScript subclass test, https://stackoverflow.com/a/18939541/673991
    //          ES6 too, https://stackoverflow.com/a/30993541/673991
}

function is_subclass_or_same(class_child, class_parent) {
    return is_strict_subclass(class_child, class_parent) || class_child === class_parent
}

function extract_file_name(path_or_url) {
    return path_or_url.split('/').pop().split('\\').pop().split('#')[0].split('?')[0];
}
assert_equal("foo.txt", extract_file_name('https://example.com/dir/foo.txt?q=p#anchor'));
assert_equal("foo.txt", extract_file_name('C:\\program\\barrel\\foo.txt'));


(function (window) {   // Encapsulation of the delta_format() function and its internals.

    var MILLISECOND = 0.001;
    var SECOND = 1;
    var MINUTE = 60*SECOND;
    var HOUR = 60*MINUTE;
    var DAY = 24*HOUR;
    var MONTH = 30*DAY;
    var YEAR = 365*DAY;

    // The following are thresholds.  They are the upper bounds of an (open, closed] interval.
    //    at and below which, we display this ---vvvv    vvvv--- above which, we display this
    var EXACTLY_ZERO    = 0.0000000000000;    //    z -> 0ms ___ <-- at exactly zero, display z
    var UP_TO_MILLI     = 95*MILLISECOND;     // 95ms -> .01s _ `--- between these -- 1ms to 95ms
    var UP_TO_FRACTION  = 0.95*SECOND;        // .95s -> 1s __ `---- between these - .01s to .95s
    var UP_TO_SECOND    = 99.4*SECOND;        //  99s -> 2m _ `----- between these --- 1s to 99s
    var UP_TO_MINUTE    = 99.4*MINUTE;        //  99m -> 2h  `------ between these --- 2m to 99m
    var UP_TO_HOUR      = 48.4*HOUR;          //  48h -> 2d ___                        2h to 48h
    var UP_TO_DAY       = 99.4*DAY;           //  99d -> 3M __ `---- between these --- 2d to 99d
    var UP_TO_MONTH     = 24.4*MONTH;         //  24M -> 2Y _ `----- between these --- 3M to 24M
                                              //             `--------- above this --- 2Y to 999Y...

    // CAUTION:  Because these "constants" are defined here,
    //           delta_format() can be called before it works.
    //           If called above this line (not inside a function)
    //           it will return a bunch of NaNs.
    // SEE:  const unavailable in IE10, etc., https://stackoverflow.com/a/130399/673991

    /**
     * Format a period of time (in seconds) in multiple human-readable formats.
     *
     * EXAMPLE:  delta_format(1) == {
     *     "num": 1,
     *     "amount_short":      "1",
     *     "amount_long":       "1.0",
     *     "units_short":       "s",
     *     "units_long":        "seconds",
     *     "description_short": "1s",
     *     "description_long":  "1.0 seconds"
     * }
     * EXAMPLE:  delta_format(3628800) == {
     *     "num": 3628800,
     *     "amount_short":      "42",
     *     "amount_long":       "42.0",
     *     "units_short":       "d",
     *     "units_long":        "days",
     *     "description_short": "42d",
     *     "description_long":  "42.0 days"
     * }
     *
     * @param sec - number of seconds
     * @return {{}}
     *     num                number of seconds, same as the input
     *     amount_short        0-2 characters (if less than 100 years)
     *     amount_long         0-4 characters
     *     units_short           1 character - CAUTION:  m for minutes, M for months
     *     units_long         1-12 characters
     *     description_short   2-3 characters - e.g. "z", "99Y" (4 characters if 100-999 years)
     *     description_long   1-15 characters - e.g. "zero", "99.2 years"
     */
    // TODO:  Candidate short descriptions for 0-1 second:
    //          0.05 - 0.94    ...  ".1s" - ".9s"
    //        0.0094 - 0.0500             ?          10ms,99ms,.01s,.05s,.09s are too long
    //                                               9-90 milliseconds - NOMINAL problem range
    //                                               10-50 milliseconds - REAL problem range
    //                                               Because .1s is KINDA close to 90 milliseconds,
    //                                               and to 80,70,60ms.  But it's too big for 50ms.
    //                                               can't be "50m"!
    //                                               Xms-Lms Roman Numerals???
    //        0.0005 - 0.0094  ...  "1ms" - "9ms"
    //        9.4e-6 - 500e-6             ?          10-500 microseconds
    //                                               10us,99us,.1ms,.5ms,.9ms   4-char-rule fits!
    //         .5e-6 - 9.4e-6  ...  "1us" - "9us"
    //        9.4e-9 - 500e-9
    //         .5e-9 - 9.4e-9  ...  "1ns" - "9ns"
    //
    //        3.5 characters would work 1ms,9ms,.01s,.05s,.1s
    //          4 characters is needed for 30 microseconds:  .1ms is too big, 9us is too small
    //                       Oh wait!  30u would be fine! So would 30n, 30p, 30f, 30a, 30z, 30y
    //        So the real problem is 30 milliseconds.  That bloody versatile letter m!
    //            .1s is 3.3x too big
    //            9ms is 3.3x too small
    //            30m is ambiguous (looks like 30 minutes)
    //            .03s might be a worthy compromise,
    //                 similarly for .01s to .05s
    //                 and it would slightly improve .06s to .09s
    //            .1s is maybe good enough for 60 milliseconds,
    //                   definitely good enough for 95 milliseconds
    //        So there'd be 3.5 characters 9.5 to 95 milliseconds ONLY, shown as .01s to .09s
    //            Wow, we could REALLY afford squeeze that decimal in close to the zero,
    //            because nowhere else is a digit preceded by a zero.
    //        Immediately outside the range .01s to .09s are
    //                                  9ms      and     .1s
    //        0 to 1 microsecond could be represented as "<1u"
    function delta_format(sec) {
        function div(n, d) {
            return (n/d).toFixed(0);
        }
        function div1(n, d) {
            return (n/d).toFixed(1);
        }
        function div2(n, d) {
            return (n/d).toFixed(2);
        }

        var word = {num: sec};
        if (sec === EXACTLY_ZERO) {
            word.amount_short = "";
            word.amount_long = "";
            word.units_short = "z";
            word.units_long = "zero";
        } else if (sec <=          UP_TO_MILLI) {
            word.amount_short = div(sec, MILLISECOND);
            word.amount_long = div1(sec, MILLISECOND);
            word.units_short = "ms";
            word.units_long = "milliseconds";
        } else if (sec <=          UP_TO_FRACTION) {
            word.amount_short = strip_leading_zeros(div1(sec, SECOND));
            word.amount_long = div2(sec, SECOND);
            word.units_short = "s";
            word.units_long = "seconds";
        } else if (sec <=          UP_TO_SECOND) {
            word.amount_short = div(sec, SECOND);
            word.amount_long = div1(sec, SECOND);
            word.units_short = "s";
            word.units_long = "seconds";
        } else if (sec <=          UP_TO_MINUTE) {
            word.amount_short = div(sec, MINUTE);
            word.amount_long = div1(sec, MINUTE);
            word.units_short = "m";
            word.units_long = "minutes";
        } else if (sec <=          UP_TO_HOUR) {
            word.amount_short = div(sec, HOUR);
            word.amount_long = div1(sec, HOUR);
            word.units_short = "h";
            word.units_long = "hours";
        } else if (sec <=          UP_TO_DAY) {
            word.amount_short = div(sec, DAY);
            word.amount_long = div1(sec, DAY);
            word.units_short = "d";
            word.units_long = "days";
        } else if (sec <=          UP_TO_MONTH) {
            word.amount_short = div(sec, MONTH);
            word.amount_long = div1(sec, MONTH);
            word.units_short = "M";
            word.units_long = "months";
       } else {
            word.amount_short = div(sec, YEAR);
            word.amount_long = div1(sec, YEAR);
            word.units_short = "Y";
            word.units_long = "years";
        }
        word.description_short = word.amount_short + word.units_short;
        word.description_long = word.amount_long + " " + word.units_long;

        return word;
    }
    assert_equal("1s", delta_format(1).description_short);
    assert_equal("42.0 days", delta_format(42*24*3600).description_long);

    window.delta_format = delta_format;
})(window);

function strip_leading_zeros(s) {
    return s.replace(/^0+/, '');
    // THANKS:  aggressive zero-stripping, https://stackoverflow.com/a/6676498/673991
}
assert_equal('.425', strip_leading_zeros('0.425'));
assert_equal('', strip_leading_zeros('0'));

function seconds_since_1970() {
    return (new Date()).getTime() / 1000.0;
}

/**
 * Return elements from array that appear more than once.  I.e. filter out singletons.
 *
 * THANKS:  https://stackoverflow.com/a/57928932/673991
 *
 * @param array - an array of things.  Elements are compared using === not ==.
 * @returns array - duplicates reported once, triplets reported twice, etc.
 */
function find_duplicates(array) {
    return array.filter((element, index) => array.indexOf(element) !== index);
}
assert_equal("2,3,3", find_duplicates([1, 2,2, 3,3,3]).join(","))

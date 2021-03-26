/**
 * util.js
 *
 * Requires jQuery as $.
 */

/**
 * Assert that two things are identical.  Show both values in the log if not.
 *
 * SEE:  expected, actual parameter order (my answer), https://stackoverflow.com/a/53603565/673991
 *
 * @param expected - often a literal
 * @param actual - often an expression
 * @param {string=} context - more stuff to show if there's a problem
 * @return {boolean} - support chaining:  assert_foo(a) && assert_bar(a.b)
 */
function assert_equal(expected, actual, context) {
    context = context || "";
    console.assert(expected === actual, "Expected:", expected, "but got:", actual, context);
    return expected === actual;
}
assert_equal(true, assert_equal(4, 2+2));

/**
 * Type declaration.  Subtypes okay.  Null or undefined are not ok.
 *
 * See type_name() and official_type_name() for terminology.  Capitalize.
 *
 * @param thing
 * @param expected_type - e.g. String, Number, Array, Object, Function, MyClass, BaseClass
 *                        Because parameter is passed through the Object constructor, the formal
 *                        capitalized type names must be used.  E.g. these are both true:
 *                            type_should_be(42, Number);
 *                            type_should_be(Number(42), Number);
 * @return {boolean} - to support chaining:  type_should_be(a, X) && type_should_be(a.b, Y)
 */

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
    } else {
        console.error("That's not even a type, it's a", type_name(expected_type), "of value", expected_type);
        return false;
    }
}
assert_equal(true, type_should_be(42, Number));
assert_equal(true, type_should_be("X", String));
assert_equal(true, type_should_be(function () {}, Function));
assert_equal(true, type_should_be(function () {}, Object));
error_expected(function () {
    assert_equal(false, type_should_be(42, String));
});

/**
 * Slightly more versatile alternative to instanceof or typeof operators.
 *
 * Better than instanceof for fundamental types,
 *     because 42 is not an instanceof Number,
 *     but is_a(42, Number) and is_a(Number(42), Number).
 * Better than typeof for complex types,
 *     because typeof (new Date()) === 'object'
 *     but is_a(new Date(), Date)
 * Better than typeof for fundamental types too,
 *     because the typo typeof x === 'spring' is not caught by an IDE
 *     but the typo is_a(x, Spring) could be.
 * About the same as instanceof for complex types,
 *     x instanceof T is less obscure,
 *     is_a(x, T) is slightly briefer.
 *
 * SEE:  typeof vs instanceof, https://stackoverflow.com/a/6625960/673991
 *
 * @param thing
 * @param expected_type
 * @return {boolean}
 */
function is_a(thing, expected_type) {
    return Object(thing) instanceof expected_type;
}
assert_equal(false, is_a(42, String));
assert_equal(true, is_a(42, Number));
assert_equal(true, is_a("X", String));
assert_equal(true, is_a(function () {}, Function));
assert_equal(true, is_a(function () {}, Object));

function should_be_array_like(putative_array) {
    if (putative_array.hasOwnProperty('length')) {
        if (is_a(putative_array.length, Number)) {
            var n = putative_array.length;
            if (n <= 0) {
                return true;
            } else {
                if (putative_array.hasOwnProperty(0) && putative_array.hasOwnProperty(n-1)) {
                    return true;
                }
            }
        }
    }
    console.error(
        "Expecting an array-like thing, but got a", type_name(putative_array),
        "of value", putative_array
    );
    return false;
}
assert_equal(true, should_be_array_like(['alpha', 'bravo']));
assert_equal(true, should_be_array_like({length:2, 0:'alpha', 1:'bravo'}));
assert_equal(true, should_be_array_like({'length':2, '0':'alpha', '1':'bravo'}));
error_expected(function () {
    assert_equal(false, should_be_array_like({length:99, 0:'alpha', 1:'bravo'}));
    // NOTE:  Array-like except that it's missing a [98] element.
});

/**
 * When the callback is expected to generate a console.error()
 *
 * @param callback
 */
// TODO:  Optional regular expression to match expected error message.
function error_expected(callback) {
    var number_of_error_calls = 0;

    function fake_error() {
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

/**
 * Make an unknown thing moderately presentable (or at least a little informative) as a string.
 *
 * @param z
 * @return {string}
 */
function to_string(z) {
    if (is_specified(z)) {
        return z.toString();
    } else {
        return official_type_name(z).toLowerCase();
    }
}
assert_equal("42", to_string(42));
assert_equal("4,2", to_string([4,2]));
assert_equal("sic", to_string('sic'));
assert_equal("null", to_string(null));
assert_equal("false", to_string(false));
assert_equal("undefined", to_string(undefined));


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
assert_equal('example.com', domain_from_url('http://example.com/'));
assert_equal('exam-ple.com', domain_from_url('https://Exam-ple.com/Foo/?Bar=Baz'));
assert_equal('no.domain', domain_from_url('https://e%ample.com/'));
assert_equal('no.domain', domain_from_url('example.com'));
assert_equal('no.domain', domain_from_url(''), JSON.stringify(domain_from_url('')));

function $_from_class(class_) {
    return $(selector_from_class(class_));
}
// noinspection JSUnusedGlobalSymbols
function $_from_id(id) {
    return $(selector_from_id(id));
}
function selector_from_id(id) {
    return '#' + $.escapeSelector(id);
}
function selector_from_class(class_) {
    return '.' + $.escapeSelector(class_);
}

function query_get(name, default_value) {
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
 *                       key is the index of the array for [ arrays ] -- and it's always a string
 *                   return false (not just falsy) to prematurely terminate the looping
 * @return {*} - return the object, a convenience for chaining I guess.
 *               Seems as if $.each does this.
 *
 * SEE:  jQuery .call():  https://github.com/jquery/jquery/blob/438b1a3e8/src/core.js#L247
 *       where `this` is the same as the 2nd parameter, both for arrays and for objects.
 *
 * SEE:  object property keys are always strings, https://stackoverflow.com/a/3633390/673991
 *
 * SEE:  $.each() bug for objects, https://stackoverflow.com/a/49652688/673991
 */
// TODO:  async_interval, async_chunk, async_done optional parameters!
//        Unifying setTimeout() and $.each(), as it were.
//        async={interval: milliseconds, chunk:iterations_per_interval, done:callback}
//                         default 0           default 1                     default nothing
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
 *     step_one();
 *     t.moment("one");
 *     step_two();
 *     t.moment("two");
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
(function (w) {
    w.URLSearchParams = w.URLSearchParams || function (searchString) {
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
 * Double newlines don't count.  They're paragraph boundaries.
 * CRs dont count.  Some browsers may use them.
 * Final line terminators don't count.  Might have seen Chrome append LF for no reason.
 *
 * THANKS:  match 1 or 2 newlines, https://stackoverflow.com/a/18012324/673991
 *          Using String.replace() to loop through each bundle of line terminators.
 *
 * SEE:  String.replace() callback,
 *       https://developer.mozilla.org/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_function_as_a_parameter
 */
function any_lone_newlines(string) {
    var LF_OR_CRLF_BUNDLES = /(\r?\n)+/g;
    var return_value = false;
    var string_trimmed = string.trim();
    string_trimmed.replace(LF_OR_CRLF_BUNDLES, function (terminator) {
         var newlines_only = terminator.replace(/\r/g, '');
         if (newlines_only.length === 1) {
             return_value = true;
         }
    });
    return return_value;
}
assert_equal(false, any_lone_newlines("abcdef"));
assert_equal(false, any_lone_newlines("abc\n"));
assert_equal( true, any_lone_newlines("abc\ndef"));
assert_equal(false, any_lone_newlines("abc\n\ndef"));
assert_equal(false, any_lone_newlines("abc\n\n\ndef"));
assert_equal(false, any_lone_newlines("abc" + "\r\n" + "\r\n" + "\r\n" + "def"));
assert_equal( true, any_lone_newlines("abc\n\ndef\n\nghi\njkl"));

/**
 * Does a long string start with a short string?  Case sensitive.
 *
 * @param string {string}
 * @param str {string}
 * @return {boolean}
 */
function starts_with(string, str) {
    return string.substr(0, str.length) === str;
}
assert_equal( true, starts_with("string", "str"));
assert_equal(false, starts_with("string", "ing"));

/**
 * Is an expected string nonempty?  That is, not undefined, not null, and not the empty string.
 *
 * THANKS:  Nonnegative synonym for nonempty, https://english.stackexchange.com/a/102788/18673
 *
 * @param txt - usually a string, when null or undefined means the same as empty.
 * @return {boolean}
 */
function is_laden(txt) {
    return is_specified(txt) && txt.toString() !== "";
}
assert_equal(false, is_laden(null));
assert_equal(false, is_laden(""));
assert_equal( true, is_laden(" "));
assert_equal( true, is_laden(0));

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
        console.error("Don't understand has(", type_name(collection), ", )");
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

function is_array(z) {
    return official_type_name(z) === 'Array';
    // return Object.prototype.toString.call(z) === '[object Array]';
    // THANKS:  isArray polyfill, https://stackoverflow.com/a/22289982/673991
}
assert_equal( true, is_array([]));
assert_equal( true, is_array([1,2,3]));
// noinspection JSPrimitiveTypeWrapperUsage
assert_equal( true, is_array(new Array));
assert_equal( true, is_array(Array(1,2,3)));
assert_equal(false, is_array({a:1, b:2}));
assert_equal(false, is_array(42));
assert_equal(false, is_array("etc"));
assert_equal(false, is_array(null));
assert_equal(false, is_array(undefined));
assert_equal(false, is_array(true));
assert_equal(false, is_array(function () {}));

/**
 * Is this a plain object with properties?
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
 * @param z
 * @return {boolean}
 */
function is_associative_array(z) {
    return official_type_name(z) === 'Object';
}
assert_equal( true, is_associative_array({a:1, b:2}));
assert_equal( true, is_associative_array(new function Legacy_Class() {}));
// assert_equal( true, is_associative_array(new class ES2015_Class{}));

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
 * @param z - an object of any type
 * @return {string} - a simple reliable name for the type of the object
 */
function official_type_name(z) {
    var simple_reliable_type_description = Object.prototype.toString.call(z);
    // EXAMPLE:  '[object Object]'
    // THANKS:  ES3 vintage Object.toString(), https://stackoverflow.com/a/22289869/673991
    var matcher = simple_reliable_type_description.match(/object (\w+)/);
    if (matcher === null) {
        return simple_reliable_type_description;   // Okay, but this should never happen.
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
// assert_equal('Object',   official_type_name(new class ES2015_Class{}));

/**
 * Get a more human-readable type name, especially for JavaScript Legacy class instances.
 *
 * @param z
 * @return {string|*}
 */
// CAUTION:  Minified code loses some constructor names,
//           https://stackoverflow.com/q/10314338/673991#comment17433297_10314492
function type_name(z) {
    var the_official_name = official_type_name(z);
    if (the_official_name === 'Object') {
        try {
            // FALSE WARNING:  Unresolved variable name
            // noinspection JSUnresolvedVariable
            return z.constructor.name;
        } catch (exception) {
            if (exception instanceof TypeError) {
                console.error("Object with no constructor", z);
                return the_official_name;
            } else {
                console.error("Freakish object", z, exception);
                throw exception;
            }
        }
    } else {
        return the_official_name;
    }
}
assert_equal('Object',       type_name({a:1, b:2}));
assert_equal('Legacy_Class', type_name(new function Legacy_Class() {}));
// assert_equal('ES2015_Class', type_name(new class ES2015_Class{}));

function default_to(parameter, default_value) {
    if (is_defined(parameter)) {
        return parameter;
    } else {
        return default_value;
    }
}
assert_equal('red',  default_to('red',     'blue'));
assert_equal('blue', default_to(undefined, 'blue'));
assert_equal(null,   default_to(null,      'blue'));
function missing_parameters_are_undefined(missing_parameter) {
    assert_equal(missing_parameter, undefined);
}
missing_parameters_are_undefined();
missing_parameters_are_undefined(undefined);

// noinspection JSUnusedGlobalSymbols
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
 * @return {number} - something to pass to clearInterval() to stop iteration prematurely.
 *                    If this value is saved, it must be passed to clearInterval()
 *                    before then() is called. If the value is null, no interval was started,
 *                    and so there's no need to call clearInterval().
 *                    Typically whatever variable stores this value, is nulled by then().
 */
function iterate(opt) {
    opt.then     = default_to(opt.then,     function () {});
    opt.do_early = default_to(opt.do_early, false);
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
    // type_should_be(array, Array) && type_should_be(array.length, Number);
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
 * Plain jane, crude jude string formatter.
 *
 * @param message - string with "{name}" symbols in it.
 * @param parameters - name to value mapping.
 * @return {string}
 *
 * TODO:  Support multiple instances of a symbol, e.g. "to {be} or not to {be}",
 *        https://stackoverflow.com/a/1144788/673991
 * TODO:  Warn of any unspecified symbols.
 */
function f(message, parameters) {
    var formatted_message = message;
    looper(parameters, function (name, value) {
        var symbol = '{' + name + '}';
        formatted_message = formatted_message.replace(symbol, to_string(value));
    });
    return formatted_message;
}
assert_equal("life + everything = 42", f("life + {a} = {b}", {a:'everything', b:42}));

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
 * SEE:  What could possibly justify all this verbose verbosity here?  `[0]` would totally work.
 *       (my answer) https://stackoverflow.com/a/62595720/673991
 *
 * NOTE:  constraining the parameter type to {jQuery|string} generates noisome warnings, e.g.
 *        Argument type {get: (function(): jQuery | [])} is not assignable to parameter type
 *        jQuery | string
 *
 * @param jquery_object_or_selector
 * @return {HTMLElement|undefined}
 */
function dom_from_$(jquery_object_or_selector) {
    var $jquery_object = $(jquery_object_or_selector);
    console.assert(
        $jquery_object.length === 1,
        "Expecting exactly one element",
        jquery_object_or_selector
    );
    var dom_object = $jquery_object.get(0);
    return dom_object;
}

/**
 * Convert an array of things to an array of strings.
 *
 * @param {Array} things
 * @return {Array.<string>}
 */
function stringify_array(things) {
    return things.map(function (thing) { return to_string(thing); });
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
 * Constrain a floating point resolution so it only requires one qigit (qiki base-256 digit)
 * below the decimal point.  (Yes it should be called the radix point, but hey. English.)
 *
 * This lets imprecise numbers take up fewer bytes.
 *
 * @param {number} n
 * @return {number}
 */
function one_qigit(n) {
    return Math.round(n * 256.0) / 256.0;
}
assert_equal(0.1015625, one_qigit(0.1));
assert_equal(26 / 256, one_qigit(0.1));

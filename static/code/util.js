/* util.js */

// THANKS:  Remove "var" warnings, EcmaScript 6 to 5, https://stackoverflow.com/q/54551923/673991

function sanitized_domain_from_url(url) {
    var domain_simple = simplified_domain_from_url(url);
    var ALL_GROUPS_OF_NON_ALPHANUMERICS = /[^0-9A-Za-z]+/g;
    var domain_sanitized = domain_simple.replace(ALL_GROUPS_OF_NON_ALPHANUMERICS, '_');
    return domain_sanitized;
}
console.assert('foo_exam_ple' === sanitized_domain_from_url('https://www.Foo.Exam---ple.com/'));
console.assert('no_domain' === sanitized_domain_from_url('https://www.e%ample.com/'));

function simplified_domain_from_url(url) {
    var domain = domain_from_url(url);
    var domain_simpler = domain
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
    ;
    return domain_simpler;
}
console.assert('example' === simplified_domain_from_url('https://www.example.com/foo'));

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
console.assert('example.com' === domain_from_url('http://example.com/'));
console.assert('exam-ple.com' === domain_from_url('https://Exam-ple.com/Foo/?Bar=Baz'));
console.assert('no.domain' === domain_from_url('https://e%ample.com/'));
console.assert('no.domain' === domain_from_url('example.com'));
console.assert('no.domain' === domain_from_url(''), JSON.stringify(domain_from_url('')));

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
console.assert(42 === random_element([42, 42, 42]));

/**
 * Loop through object or array.  Call back on each key-value pair.
 *
 * A drop-in replacement for jQuery.each() except:
 *      `this` is the object -- UNLIKE JQUERY.EACH WHERE IT IS EACH VALUE!
 *      SEE jQuery .call():  https://github.com/jquery/jquery/blob/438b1a3e8/src/core.js#L247
 *      Reason for this incompatibility:  the one-line test #3 below
 *                                        that modifies in-place.
 * SEE:  $.each() bug for objects, https://stackoverflow.com/a/49652688/673991
 *
 * @param object - e.g. {a:1, b:2} or [1,2,3]
 * @param callback - function called on each element of the array/object
 *                   `this` is the object (not each value, as it is in jQuery.each())
 *                   key, value are the parameters
 *                       key is the name of the property for { objects }
 *                       key is the index of the array for [ arrays ]
 *                   return false (not just falsy) to prematurely terminate the looping
 * @return {*} - returns the object, a convenience for chaining I guess, maybe $.each is like that.
 */
// TODO:  Undo incompatibility with $.each() -- could be accomplished with closure.
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
looper({foo:1, length:0, bar:2}, function (k,v) { looper_test.push(k+"="+v); });
console.assert("foo=1,length=0,bar=2" === looper_test.join(","));

looper_test = [];
looper([1,2,42,8,9], function (i,v) {looper_test.push(i+"="+v); return v !== 42;});
console.assert("0=1,1=2,2=42" === looper_test.join(","));

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
console.assert('berry' === strip_prefix('raspberry', 'rasp'));
console.assert('inflammable' === strip_prefix('inflammable', 'un'));

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
 * Make sure an element isn't too big.  Shrink width & height so both fit, preserving aspect ratio.
 *
 * @param $element
 * @param max_width
 * @param max_height
 * @param callback_shrinkage - optional callback, with text report on shrinkage, if any happened.
 */

function fit_element($element, max_width, max_height, callback_shrinkage) {
    if ($element.length === 1) {
        var old_width = $element.width();
        var old_height = $element.height();
        $element.css('max-width', max_width);
        $element.css('max-height', max_height);
        var actual_width = $element.width();
        var actual_height = $element.height();
        var did_change_width = actual_width !== old_width;
        var did_change_height = actual_height !== old_height;
        var reports = [];
        if (actual_width > max_width + 1.0 && ! $element.data('bust-width-notified')) {
            $element.data('bust-width-notified', true);
            reports.push("BUST-WIDTH " + (actual_width - max_width).toFixed(0) + "px too wide");
        }
        if (actual_height > max_height + 1.0) {
            reports.push("BUST-HEIGHT " + (actual_height - max_height).toFixed(0) + "px too high");
        }
        if (did_change_width) {
            reports.push("w " + old_width.toFixed(0) + " -> " + actual_width.toFixed(0));
        }
        if (did_change_height) {
            reports.push("h " + old_height.toFixed(0) + " -> " + actual_height.toFixed(0));
        }
        if (reports.length > 0) {
            callback_shrinkage(reports.join(", "));
        }
    }
}

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
console.assert(false === any_lone_newlines("abcdef"));
console.assert(false === any_lone_newlines("abc\n"));
console.assert( true === any_lone_newlines("abc\ndef"));
console.assert(false === any_lone_newlines("abc\n\ndef"));
console.assert(false === any_lone_newlines("abc\n\n\ndef"));
console.assert(false === any_lone_newlines("abc" + "\r\n" + "\r\n" + "\r\n" + "def"));
console.assert( true === any_lone_newlines("abc\n\ndef\n\nghi\njkl"));

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
console.assert( true === starts_with("string", "str"));
console.assert(false === starts_with("string", "ing"));

/**
 * Is a string nonempty?  That is, not undefined, not null, and not the empty string.
 *
 * THANKS:  Nonnegative synonym for nonempty, https://english.stackexchange.com/a/102788/18673
 *
 * @param txt - usually a string, when null or undefined means the same as empty.
 * @return {boolean}
 */
function is_laden(txt) {
    return is_specified(txt) && txt !== "";
}
console.assert(false === is_laden(null));
console.assert(false === is_laden(""));
console.assert( true === is_laden(" "));
console.assert( true === is_laden(0));

/**
 * Not undefined, and not null.
 */
function is_specified(z) {
    return is_defined(z) && z !== null;
}
console.assert(false === is_specified(undefined));
console.assert(false === is_specified(null));
console.assert( true === is_specified(0));
console.assert( true === is_specified(''));

/**
 * Not undefined.
 */
function is_defined(x) {
    return typeof x !== 'undefined';
}
console.assert(false === is_defined(undefined));
console.assert( true === is_defined(0));

function is_string(x) {
    return typeof x === 'string';
}
console.assert( true === is_string(''));
console.assert(false === is_string(0));

/**
 * Does an array, object, or string contain a thing?
 *
 * @param collection - array, object, or string
 * @param thing
 * @return {boolean}
 */
function has(collection, thing) {
    if (collection === null || typeof collection === 'undefined') {
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
console.assert( true === has([1, 2, 3], 2));
console.assert(false === has([1, 2, 3], 9));
console.assert( true === has({one:1, two:2, three:3}, 'three'));
console.assert(false === has({one:1, two:2, three:3}, 3));
console.assert( true === has('alphabet', 'a'));
console.assert(false === has('alphabet', 'z'));
console.assert(false === has(undefined, 'anything'));
console.assert(false === has(null, 'anything'));

function is_array(z) {
    return official_type_name(z) === 'Array';
    // return Object.prototype.toString.call(z) === '[object Array]';
    // THANKS:  isArray polyfill, https://stackoverflow.com/a/22289982/673991
}
console.assert( true === is_array([]));
console.assert( true === is_array([1,2,3]));
// noinspection JSPrimitiveTypeWrapperUsage
console.assert( true === is_array(new Array));
console.assert( true === is_array(Array(1,2,3)));
console.assert(false === is_array({a:1, b:2}));
console.assert(false === is_array(42));
console.assert(false === is_array("etc"));
console.assert(false === is_array(null));
console.assert(false === is_array(undefined));
console.assert(false === is_array(true));
console.assert(false === is_array(function () {}));

function is_associative_array(z) {
    return official_type_name(z) === 'Object';
    // return Object.prototype.toString.call(z) === '[object Object]';
}
console.assert( true === is_associative_array({a:1, b:2}));
console.assert( true === is_associative_array(new function Legacy_Class(){}));
// console.assert( true === is_associative_array(new class ES2015_Class{}));

console.assert(false === is_associative_array(window));
console.assert(false === is_associative_array(new Date()));
console.assert(false === is_associative_array([]));
console.assert(false === is_associative_array([1,2,3]));
console.assert(false === is_associative_array(Array(1,2,3)));
console.assert(false === is_associative_array(42));
console.assert(false === is_associative_array("etc"));
console.assert(false === is_associative_array(null));
console.assert(false === is_associative_array(undefined));
console.assert(false === is_associative_array(true));
console.assert(false === is_associative_array(function () {}));

/**
 * Get a reliable type name from the Object class toString() method, which always gives
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
        return simple_reliable_type_description;   // but this should never happen
    } else {
        return matcher[1];
    }
}
console.assert('Boolean'   === official_type_name(true));
console.assert('Number'    === official_type_name(3));
console.assert('String'    === official_type_name("three"));
console.assert('Function'  === official_type_name(function () {}));
console.assert('Null'      === official_type_name(null));
console.assert('Undefined' === official_type_name(undefined));
console.assert('Array'     === official_type_name([1,2,3]));
console.assert('Object'    === official_type_name({a:1, b:2}));
console.assert('Date'      === official_type_name(new Date()));
console.assert('String'    === official_type_name(Date()));
console.assert('Object'    === official_type_name(new function Legacy_Class(){}));
// console.assert('Object'    === official_type_name(new class ES2015_Class{}));

/**
 * Get an informative type name, especially for JavaScript Legacy classes.
 *
 * @param z
 * @return {string|*}
 */
function type_name(z) {
    var the_official_name = official_type_name(z);
    if (the_official_name === 'Object') {
        return z.constructor.name;
    } else {
        return the_official_name;
    }
}
console.assert('Object'       === type_name({a:1, b:2}));
console.assert('Legacy_Class' === type_name(new function Legacy_Class(){}));
// console.assert('ES2015_Class' === type_name(new class ES2015_Class{}));

function default_to(parameter, default_value) {
    if (is_defined(parameter)) {
        return parameter;
    } else {
        return default_value;
    }
}
console.assert('red'  === default_to('red',     'blue'));
console.assert('blue' === default_to(undefined, 'blue'));
console.assert(null   === default_to(null,      'blue'));
function missing_parameters_are_undefined(missing_parameter) {
    console.assert(missing_parameter === undefined);
}
missing_parameters_are_undefined();
missing_parameters_are_undefined(undefined);

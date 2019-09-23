/* util.js */

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
    if (typeof url === 'string' && url !== '') {
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
    // TODO:  Make this more generic.
}
console.assert('example.com' === domain_from_url('http://example.com/'));
console.assert('exam-ple.com' === domain_from_url('https://Exam-ple.com/Foo/?Bar=Baz'));
console.assert('no.domain' === domain_from_url('https://e%ample.com/'));
console.assert('no.domain' === domain_from_url('example.com'));
console.assert('no.domain' === domain_from_url(''), JSON.stringify(domain_from_url('')));

/**
 * Not undefined, not null, not the empty string.
 */
function is_laden(txt) {
    return is_specified(txt) && txt !== "";
}
console.assert(is_laden(" "));
console.assert( ! is_laden(""));

/**
 * Not undefined, not null.
 */
function is_specified(x) {
    return is_defined(x) && x !== null;
}
console.assert(is_specified('x'));
console.assert( ! is_specified(null));

/**
 * Not undefined.
 */
function is_defined(x) {
    return typeof x !== 'undefined';
}
console.assert(is_defined(42));
console.assert( ! is_defined(undefined));

function has(collection, thing) {
    if (typeof collection === 'undefined') {
        return false;
    } else if (collection instanceof Array) {
        return $.inArray(thing, collection) !== -1;
    } else if (collection instanceof Object) {
        return collection.hasOwnProperty(thing);
    } else if (typeof collection === 'string') {
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

function type_name(z) {
    var the_name = typeof z;
    if (the_name === 'object') {
        the_name = z.constructor.name;
    }
    return the_name;
}
console.assert('number' === type_name(3));
console.assert('Date' === type_name(new Date()));

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

function query_get(name, default_value) {
    var query_params = new window.URLSearchParams(window.location.search);
    var value = query_params.get(name);
    if (value === null) {
        return default_value;
    } else {
        return value;
    }
}

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

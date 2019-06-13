import os
import re
import six

from to_be_released import richard_jones_html


class WebHTML(richard_jones_html.HTML):
    """
    Generic additions to Richard Jones' HTML class.

    Differences with html.HTML class:
    - attribute=None omits the attribute from the element (was a TypeError)
    - class_ may be used instead of klass (but klass still works) (ala PEP8)
    - classes = ['class-1', 'class-2', ...]
      (Pick only one for an element.  priority:  klass, class_, classes)
    - for_ instead of for, e.g. div.label(for=input_id)
    - AttributeError if an attribute name starts with an underscore
      (this was required to support deep copy, etc.)
    - .css(href='foo.css')
    - .js(href='foo.js') ...
    - .jquery(version='3.1.1') ...
    - .escape ...
    - .hard_spaces ...
    - .raw_hard_spaces ...
    - .map_attribute ...
    - .doctype_plus_html ...
    - .close_tag ...
    - .comment('this makes an HTML comment')
    - .comment(["Multiple", "line", "comments"])

    Some of these could be moved to the HTML class itself.
    Keep here stuff specific to the world of web (e.g. css, js, jquery)

    Example using nonstandard data_foo attribute:
        body.div(data_foo='bar')

    Example using standard data-foo attribute:
        body.div(**{'data-foo':'bar'})

        THANKS:  function arguments with dashes, https://stackoverflow.com/a/24121330/673991
    """

    def __init__(self, *args, **kwargs):
        super(WebHTML).__init__(*args, **kwargs)
        self.do_minify = True

    HTML_DOCTYPE = "<!DOCTYPE html>\n"

    def __call__(self, *args, **kwargs_with_nones):
        # TODO:  Use class_ instead of classes with an array?  Allow klass=[class, class] also?
        #        img_in_salesforce() and abbreviation_entry() also have classes parameters.
        #        Changing them to class_ might confuse callers who could then assume singular.
        #        But that would require more logic inside those routines who append their own
        #        classes list to what they THINK is a passed classes list.
        #        make() and entry_field() and state_symbol() too!
        kwargs = self.strip_nones(kwargs_with_nones)
        if 'klass' in kwargs:
            pass
        elif 'class_' in kwargs:
            kwargs['klass'] = kwargs.pop('class_')
        elif 'classes' in kwargs:
            if hasattr(kwargs['classes'], '__iter__'):
                classes = kwargs.pop('classes')
                non_blank_classes = [
                    class_
                    for class_ in classes
                    if class_ is not None
                    and class_.strip() != ''
                ]
                if non_blank_classes:
                    kwargs['klass'] = ' '.join(non_blank_classes)

        if 'for_' in kwargs:
            kwargs['for'] = kwargs.pop('for_')

        return super(WebHTML, self).__call__(*args, **kwargs)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError("Underscore-prefixed attributes are assumed NOT to be inner elements.")
            # Among other things, this allows deepcopy of an HTML instance.
            # Also avoids making inner element _ipython_canary_method_should_not_exist_
            #     when IPython tries to represent an HTML instance,
            #     e.g. by just typing it at the >>> prompt.
            #     Though a lame workaround for that problem is using
            #         >>> _ = div.br()
            #     instead of
            #         >>> div.br()

        return super(WebHTML, self).__getattr__(name)

    def css(self, href, **kwargs):
        """
        Load external CSS.

        :param href - URL of the CSS file
        :return - newly created link element

        Examples:
            head.css('/static/code/css.css')
            head.css('//code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css')
        """
        return self.link(rel='stylesheet', type='text/css', href=href, newlines=True, **kwargs)

    def js(self, src, litmus_function=None, local_file=None, **kwargs):
        """
        Load external JavaScript.

        :param src - HTTP location for JavaScript
                     "{dot_min}" turns into ".min" or "" depending on do_minify.
        :param litmus_function - whose presence indicates successful loading.
                                 This is a string containing a JavaScript expression
                                 (e.g. 'window.$') that will evaluate to a
                                 type 'function' if the external JavaScript is loaded.
                                 In conjunction with local_file, provides CDN backup.
        :param local_file - HTTP location of alternative file.js
                            "{dot_min}" turns into ".min" or "" depending on do_minify.

        Further parameters become attributes to the primary and alternate script tags.

        Examples:
            body.js('/static/code/js.js')
            body.js('//cdn.jsdelivr.net/jquery.cookie/1.4.1/jquery.cookie.js')
            body.js(
                src='//cdn.jsdelivr.net/jquery.cookie/1.4.1/jquery.cookie.js',
                litmus_function='window.$.cookie',
                local_file='/static/code/jquery.cookie.js'
            )
        """
        src_maybe_minified = src.format(dot_min=self.dot_min())

        self.script(src=src_maybe_minified, newlines=True, **kwargs).close_tag()

        if local_file is not None and litmus_function is not None:
            # TODO:  Warn if local file doesn't exist?
            local_file_maybe_minified = local_file.format(dot_min=self.dot_min())
            self.script.raw_text('''
                if (typeof {litmus_function} !== "function") {{
                    console.warn("Remote site down. Reverting to {local_file}");
                    document.write('<script src="{local_file}">\x3C\/script>');
                }}
            \n'''.format(
                local_file=local_file_maybe_minified,
                litmus_function=litmus_function,
            ))

            # // TODO:  The following method does NOT ensure the script is loaded
            # // synchronously, before the next script is loaded.
            # // SEE:  document.write() does, https://stackoverflow.com/a/3292763/673991
            # //
            # //     var script = document.createElement('script');
            # //     script.type = 'text/javascript';
            # //     script.src = '{local_file}';
            # //
            # //     var scriptHook = document.getElementsByTagName('script')[0];
            # //     scriptHook.parentNode.insertBefore(script, scriptHook);
            # //
            # // SEE:  Fallback w/o document.write(), https://stackoverflow.com/a/4825258/673991

            self.script.raw_text('''
                if (typeof {litmus_function} !== "function") {{
                    console.error("Neither remote nor local script defined {litmus_function}");
                }}
            \n'''.format(
                litmus_function=litmus_function,
            ))

    def js_stamped(self, src, **kwargs):
        """Suffix the URL to bust the browser cache."""
        self.js(src=self.url_stamp(src), **kwargs)

    def css_stamped(self, href, **kwargs):
        """Suffix the URL to bust the browser cache."""
        self.css(href=self.url_stamp(href), **kwargs)

    @classmethod
    def url_stamp(cls, url):
        """
        Append a query-parameter to a URL so that changes to the file
        will bust the browser cache.

        This default implementation appends a time-stamp.
        Or if the file can't be found it appends a random stamp.
        So if os_path_from_url() is broken, then the browser will never
        cache the file.

        A subclass may override this method to stamp in some other way,
        e.g. git commit hash.
        """
        os_path = cls.os_path_from_url(url)
        mtime_suffix = cls._mtime_suffix(os_path)
        return url + '?' + mtime_suffix

    @classmethod
    def _mtime_suffix(cls, os_path):
        """
        Create a name=value parameter based on a file's modification time.

        Or if the file can't be found create a random value.
        """
        try:
            mtime_float = os.path.getmtime(os_path)
        except OSError:
            return 'random={:s}'.format(os.urandom(4).encode('hex'))
        else:
            return 'mtime={:.3f}'.format(mtime_float)

    class MissingMethod(NotImplementedError):
        """os_path_from_url() must be implemented to use js_stamped() or css_stamped()."""

    @classmethod
    def os_path_from_url(cls, url):
        """
        Convert a URL to a local absolute file-system path.

        You must override either os_path_from_url() or url_stamp() in the subclass
        if you are going to call js_stamped() or css_stamped().
        """
        raise cls.MissingMethod(cls.MissingMethod.__doc__)

    def jquery(self, version, local_directory=None):
        """
        Load jQuery.

        :param version - e.g. "latest" or "2.2.2"
                         ("latest" is bad for production)
        :param local_directory - where resides the jquery file - do not end in a slash
                                 "{dot_min}" turns into ".min" or "" depending on do_minify.

        SEE:  Why "latest" is bad, https://blog.jquery.com/2014/07/03/dont-use-jquery-latest-js/

        Examples:

             body.jquery()
                1st try:  http://ajax.googleapis.com/ajax/libs/jquery/latest/jquery.js

             body.jquery(version='3.1.1', local_directory='/static/code')
                1st try:  http://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.js
                2nd try:  /static/code/jquery-3.1.1.js
        """
        js_parameters = dict(
            src='//ajax.googleapis.com/ajax/libs/jquery/{version}/jquery{{dot_min}}.js'.format(
                version=version,
            )
        )
        if local_directory is not None:
            js_parameters.update(dict(
                local_file='{local_directory}/jquery-{version}{{dot_min}}.js'.format(
                    local_directory=local_directory,
                    version=version,
                ),
                litmus_function='window.$',
            ))
        self.js(**js_parameters)

    def doctype_plus_html(self):
        """Generate the raw HTML text, e.g. for an HTTP response."""
        return self.HTML_DOCTYPE + six.text_type(self)

    def close_tag(self):
        """
        Make sure this HTML element generates a close-tag, e.g. for <script></script>

        This works, in the bowels of HTML._stringify(),
        because, even though '' is falsy, [''] is truthy.
        And passing '' to text() appends it to an internal _content list.
        """
        # TODO:  Make this automagic for tags that should always be closed, e.g. div, script
        # SEE:  Optional / forbidden to close, http://blog.teamtreehouse.com/to-close-or-not-to-close-tags-in-html5
        # Optional:  html, head, body, p, dt, dd, li, option, thead, th, tbody, tr, td, tfoot, colgroup
        # SEE:  Forbidden to close, https://www.w3.org/TR/html5/syntax.html#void-elements
        # Forbidden:  area, base, br, col, embed, hr, img, input, keygen, link, meta, param, source, track, wbr
        # SEE:  html.XHTML.empty_elements
        # Forbidden:  'base meta link hr br param img area input col colgroup basefont isindex frame'
        # TODO:  OR JUST USE html.XHTML AS THE SUBCLASS!?!?!!!???
        # Still the HTML class should close non-void elements
        # and must close (some? most? all?) non-void, non-optional elements
        self.text('')
        return self
    #
    # def close_tag_xhtml(self):
    #     self(slash
    #     return self

    def hard_spaces(self, content):
        escaped_content = self.escape(content)
        return self.raw_hard_spaces(escaped_content)

    def raw_hard_spaces(self, escaped_content):
        hardened_escaped_content = escaped_content.replace(' ', '&nbsp;')
        return self.raw_text(hardened_escaped_content)

    @classmethod
    def escape(cls, string):
        # TODO:  Prevent this from inserting "<replace>" element!
        #        WebHTML('a')('text', 'text', WebHTML('b'), 'text', 'text')
        #        Need to detect isinstance(content, WebHTML) and pass that content through _stringify()
        string = six.text_type(string)
        string = string.replace('&', '&amp;')   # Obviously must come first.
        string = string.replace('>', '&gt;')
        string = string.replace('<', '&lt;')
        string = string.replace('"', '&quot;')
        # THANKS:  #34 no better than quot, https://stackoverflow.com/a/4015380/673991#comment4304632_4015380
        string = string.replace("'", '&#39;')
        return string

    def dot_min(self):
        return '.min' if self.do_minify else ''

    def comment(self, inside_the_comment):
        """
        Generate an HTML <!--comment-->

        :param inside_the_comment - string - for a one-line comment
                                  - iterator - for a multi-line comment
                                               where each item gets its own line.

        TODO:  Enforce HTML rules:
            inside_the_comment must not begin with '<'
            inside_the_comment must not begin with '->'
            inside_the_comment must not contain '--'
            inside_the_comment must not end with '-'
            SEE:  Comment syntax, https://www.w3.org/TR/html51/syntax.html#sec-comments

        Examples:
            body.comment("Cheese.")
            body.comment(["Gouda is good.", "Blue is better."])
        """
        if (
            not isinstance(inside_the_comment, six.string_types) and
            hasattr(inside_the_comment, '__iter__')
        ):
            # NOTE:  Python 3 strings have an __iter__ method.
            self.comment("\n" + "\n".join(inside_the_comment) + "\n")
        else:
            self.raw_text('<!--')
            self.raw_text(inside_the_comment)
            self.raw_text('-->\n')

    def map_attribute(self, attribute_modifier):
        """
        Call a modifier function on all attributes in an element and its children.

        attribute_modifier - function - pass name and old_value, return new_value
        """
        for attribute_name, attribute_value in self._attrs.items():
            new_attribute_value = attribute_modifier(attribute_name, attribute_value)
            self._attrs[attribute_name] = new_attribute_value
        for sub_content in self._content:
            if isinstance(sub_content, richard_jones_html.HTML):
                sub_content.map_attribute(attribute_modifier)

    def char_name(self, name):
        assert isinstance(name, six.string_types)
        self.raw_text('&' + name + ';')

    def char_code(self, code):
        assert isinstance(code, int)
        self.raw_text('&#x{:X};'.format(int(code)))

    ''' 
    Render begin.
    '''

    INDENT = "    "

    def to_jquery(self):
        """
        Convert a WebHTML object into jQuery code that could generate the same HTML.

        THANKS:  clean jQuery for generating HTML, https://stackoverflow.com/a/12000127/673991

        EXAMPLE (untested):
            >>> div = WebHTML('div')
            >>> div.span(class_='foo').b(u'bar')
            >>> print(str(div))
            <div><span class="foo"><b>bar</b></span></div>
            >>> print(div.to_jquery())
            $('<div>').append(
                $('<span>', {class: 'foo'}).append(
                    $('<b>').append(
                        'bar'
                    )
                ).
            )
        """

        def remove_commas_before_parens(code):
            """  assert 'a(b)' == remove_commas_before_parens('a(b,)')  """
            return re.sub(r',(\s*)\)', r'\1)', code)

        def remove_trailing_comma(code):
            """  assert 'foo' == remove_trailing_comma('foo,')  """
            return code.rstrip(',')

        js_code = "\n".join(list(self.render_jquery(self)))

        js_code = remove_commas_before_parens(js_code)
        js_code = remove_trailing_comma(js_code)
        # TODO:  Ignore comments, or pass them through as comments.
        return js_code

    def render_jquery(self, item):
        """Recursive part of to_jquery()"""
        if isinstance(item, richard_jones_html.HTML):
            tag = "$('<" + item._name + ">'"
            if len(item._attrs) > 0:
                pairs = [n + ": " + self.js_from_html(v) for n, v in item._attrs.items()]
                tag += ", {" + ", ".join(pairs) + "}"
            tag += ")"
            if item._content in [[], [u'']]:
                yield tag + ","
            else:
                yield tag + ".append("
                for sub_content in item._content:
                    for each_line in self.render_jquery(sub_content):
                        yield self.INDENT + each_line
                yield "),"
        elif isinstance(item, six.string_types):
            if item:
                for each_line in item.splitlines(True):
                    yield self.js_from_html(each_line) + ","
        else:
            yield "// unknown " + type(item).__name__

    def to_python(self, top_name=None):
        """
        Convert a WebHTML object into Python code that could generate the same HTML.

        EXAMPLE (untested):
            >>> div = WebHTML('div')
            >>> div.span(class_='foo').b(u'bar')
            >>> print(str(div))
            <div><span class="foo"><b>bar</b></span></div>
            >>> print(div.to_python('some_div_object'))
            with some_div_object.span(class_='foo') as span1:
                with span1.b as b2:
                    b2.text('bar')
        """

        if top_name is None:
            top_name = self._name + '0'
        py_code = "\n".join(list(self.render_python(self, top_name, 0)))
        # TODO:  Ignore comments, or pass them through as comments.
        return py_code

    def render_python(self, item, with_variable, depth):

        def good_name(name):
            return 'class_' if name == 'class' else name

        if isinstance(item, richard_jones_html.HTML):

            tag = "{}.{}".format(with_variable, item._name)
            if len(item._attrs) > 0:
                pairs = [good_name(n) + "=" + self.js_from_html(v) for n, v in item._attrs.items()]
                tag += "(" + ", ".join(pairs) + ")"
            if item._content in [[], [u'']]:
                yield tag
            else:
                sub_variable = item._name + str(depth+1)
                yield 'with ' + tag + ' as ' + sub_variable + ':'
                any_sub_content = False
                for sub_content in item._content:
                    for each_line in self.render_python(sub_content, sub_variable, depth+1):
                        yield self.INDENT + each_line
                        any_sub_content = True
                if not any_sub_content:
                    yield 'pass'
        elif isinstance(item, six.string_types):
            if item:
                for each_line in item.splitlines(True):
                    yield with_variable + '.text(' + self.js_from_html(each_line) + ')'
        else:
            yield "// unknown " + type(item).__name__

    @classmethod
    def js_from_html(cls, html_string):
        js_string = cls.js_string_literal(cls.html_parser_instance.unescape(html_string))
        return js_string

    @classmethod
    def js_string_literal(cls, string):
        u_rendered = repr(string)
        if u_rendered.startswith('u'):
            rendered = u_rendered[1:]
        else:
            rendered = u_rendered
        return rendered

    '''
    Render end.
    '''

    @classmethod
    def strip_nones(cls, dictionary_with_nones):
        """ Remove dictionary entries with a value of None. """
        without_nones = {k: v for k, v in dictionary_with_nones.items() if v is not None}
        return without_nones

    # noinspection PyUnresolvedReferences
    html_parser_instance = six.moves.html_parser.HTMLParser()


assert '&lt;p class=&quot;foo&quot;&gt;' == WebHTML.escape('<p class="foo">')

assert "'abc\\n'" == r"'abc\n'" == WebHTML.js_from_html(u'ab&#x63;\n')
assert "'abc\\n'" == r"'abc\n'" == WebHTML.js_string_literal(u'abc\n')

assert dict(a=1, c=3) == WebHTML.strip_nones(dict(a=1, b=None, c=3, d=None))

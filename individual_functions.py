""" individual_functions.py - generic utilities for fliki.py """

import datetime
import json
import time


__all__ = [
    'seconds_since_1970_utc',
    'milliseconds_since_1970_utc',
    'time_format_yyyy_mmdd_hhmm_ss',
    'Probe',
    'json_encode',
    'json_pretty',
    'repr_safe',
]


JSON_SEPARATORS_NO_SPACES = (',', ':')


def seconds_since_1970_utc():
    return datetime.datetime.timestamp(datetime.datetime.now(datetime.timezone.utc))


def milliseconds_since_1970_utc():
    return int(seconds_since_1970_utc() * 1000.0)


def time_format_yyyy_mmdd_hhmm_ss(unix_epoch):
    """ Format a unix timestamp (seconds since 1970 UTC) into a string. """
    time_tuple_thingie = time.gmtime(unix_epoch)
    return time.strftime('%Y.%m%d.%H%M.%S', time_tuple_thingie)
assert "1999.1231.2359.59" == time_format_yyyy_mmdd_hhmm_ss(946684799.0)
assert "2000.0101.0000.00" == time_format_yyyy_mmdd_hhmm_ss(946684800.0)


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

        :param countables_initial: - a dictionary of name:count pairs,
                                     some measure other than time.
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
                    if countables_early is None:
                        v_delta = v
                    else:
                        v_delta = v - countables_early.get(k, 0)
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


def json_encode(x, **kwargs):
    """ JSON encode a dict, including custom objects with a .to_json() method. """
    # TODO:  Support encoding list, etc.  ((WTF does this mean?  This works:  json.dumps([1,2,3])))
    json_almost = json.dumps(
        x,
        cls=VersatileJsonEncoder,
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


class VersatileJsonEncoder(json.JSONEncoder):
    """Custom converter for json_encode()."""

    def default(self, w):
        if hasattr(w, 'to_json') and callable(w.to_json):
            return w.to_json()
        else:
            return super(VersatileJsonEncoder, self).default(w)
            # NOTE:  Raises a TypeError, unless a multi-derived class
            #        calls a sibling class.  (If that's even how multiple
            #        inheritance works.)
            # NOTE:  This is not the same TypeError as the one that
            #        complains about custom dictionary keys.


def repr_safe(x):
    """ Like repr() but the output is JSON, compact, and the length is limited. """
    try:
        might_be_long = json_encode(x)
    except TypeError:
        try:
            might_be_long = json_encode(str(x))
        except TypeError:
            try:
                might_be_long = json_encode(type(x).__name__)
            except TypeError:
                might_be_long = "(CANNOT RENDER OBJECT)"

    how_long = len(might_be_long)
    max_out = 60
    overhead = 15
    if how_long > max_out:
        show_this_many = max_out - overhead
        omit_this_many = how_long - show_this_many
        return might_be_long[0 : show_this_many] + " ... ({} more)".format(omit_this_many)
    else:
        return might_be_long


def repr_attr(z, attribute_name):
    """Represent the attribute of an object in a safe way, even if it has no such attribute."""
    if hasattr(z, attribute_name):
        return repr_safe(getattr(z, attribute_name))
    else:
        return "Undefined"


class TestReprAttr:
    string = "string"
    none = None
assert  '"string"' == repr_attr(TestReprAttr, 'string')
assert      "null" == repr_attr(TestReprAttr, 'none')
assert "Undefined" == repr_attr(TestReprAttr, 'no_such_member')

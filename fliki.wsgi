import fliki

application = fliki.application

# THANKS:  import fliki.py so it can:  from __future__ import unicode_literals
#     https://stackoverflow.com/q/38149698/673991#comment63730322_38149698
#     "If the script is compiled with flags = 0, the __future__ statements will be useless.
#     Try using import to actually get your module. - o11c"
#     (Still don't know what o11c meant by "flags = 0".)
#     So the apache virtual host config contains:
#         WSGIScriptAlias .../fliki.wsgi
#     not
#         WSGIScriptAlias .../fliki.py

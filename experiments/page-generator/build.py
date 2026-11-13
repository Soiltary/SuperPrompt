# -*- coding: utf-8 -*-
"""Writes the static pages of SuperPrompt into the app folder."""
import os, sys, json, html, random, urllib.parse, re
sys.path.insert(0, os.path.dirname(__file__))
from content_core import T
import content_pages
from content_pages import CATS
from blog import POSTS, PALETTES
import content_v2
from content_v2 import LIB

APP = sys.argv[1]
E = html.escape

# Published Windows package (deploy/release.json). The download button is generated only when it exists,
# and app.js shows it only on the hosted site (never in the local copy or inside the Windows app).
RELEASE = None
_rel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "deploy", "release.json")
if os.path.exists(_rel):
    RELEASE = json.load(open(_rel, encoding="utf-8"))
T["get.web"] = ("Use in Browser", "استخدم في المتصفح")
T["get.win"] = ("Download for Windows", "تحميل لويندوز")
T["get.how1"] = ("Unzip, then open", "فك الضغط ثم افتح")
T["get.how2"] = ("Windows 10 and 11, 64-bit, no install", "ويندوز 10 و11 بنظام 64 بت، بدون تثبيت")
T["get.notes"] = ("Release notes", "تفاصيل الإصدار")
# Links shared with the owner's other sites (Syntra, STV): same destinations and order
GITHUB_URL = "https://github.com/Soiltary/SuperPrompt"
RELEASES_URL = GITHUB_URL + "/releases/latest"
SUPPORT_URL = "https://tip.dokan.sa/solitary"
X_URL = "https://x.com/Soiltary"
T["foot.download"] = ("Download", "تحميل")
T["foot.support"] = ("Support", "دعم")
T["aria.extlinks"] = ("SuperPrompt on the web", "SuperPrompt على الويب")

# ---- prompt library + blog strings into T ----
for c in CATS:
    T["cat.%s.name" % c["slug"]] = c["name"]
    T["cat.%s.desc" % c["slug"]] = c["desc"]
    for i, (title, text) in enumerate(c["items"], 1):
        T["pl.%s.%d.title" % (c["slug"], i)] = title
        T["pl.%s.%d.text" % (c["slug"], i)] = text
    T["title.cat.%s" % c["slug"]] = ("SuperPrompt | " + c["name"][0], "SuperPrompt | " + c["name"][1])

def nodot(s):
    # interface text has no full stop at the very end (the user's style for his sites); keep "..." placeholders
    if isinstance(s, str) and s.endswith(".") and not s.endswith("..."):
        return s[:-1]
    return s

_LATIN_RUN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:\\/\-]*[A-Za-z0-9]|[A-Za-z0-9]")
def iso(key, s, lang):
    # placeholders cannot hold <bdi>; inside Arabic text wrap codes like KB5034441 / 0x80070643 / C:\path
    # in invisible left-to-right isolates (U+2066 ... U+2069) so the sentence cannot reorder or split them
    if lang != "ar" or not key.endswith(".ph") or not isinstance(s, str):
        return s
    return _LATIN_RUN.sub(lambda m: "\u2066" + m.group(0) + "\u2069", s)

def tx(key, lang):
    return iso(key, nodot(T[key][0 if lang == "en" else 1]), lang)

def el(tag, key, lang, cls=None, attrs=""):
    c = ' class="%s"' % cls if cls else ""
    return '<%s%s data-i18n="%s"%s>%s</%s>' % (tag, c, key, (" " + attrs) if attrs else "", E(tx(key, lang)), tag)

# ---- icons ----
def svg(paths, size=16, sw=2, extra=""):
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"%s>%s</svg>') % (size, size, sw, extra, paths)

P = {
 "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
 "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>',
 "close": '<path d="M6 6l12 12M18 6L6 18"/>',
 "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6"/>',
 "chev": '<path d="M6 9l6 6 6-6"/>',
 "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 "copy": '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 "sparkles": '<path d="M11 3l1.9 5 5.1 1.9-5.1 1.9L11 17l-1.9-5.2L4 9.9 9.1 8z"/><path d="M19 14l.8 2.1 2.2.9-2.2.8L19 20l-.8-2.2-2.2-.8 2.2-.9z"/><path d="M5 17v4M3 19h4"/>',
 "langs": '<path d="M4 5h9M8.5 3v2M11 5c-.6 4-3.3 7-7 8.5M6.5 9c1 2 3 3.6 5.5 4.5"/><path d="M13 21l4-9 4 9M14.4 18h5.2"/>',
 "gauge": '<path d="M3.6 18A9.5 9.5 0 1 1 20.4 18"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="14" r="1.2"/>',
 "shield": '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 "shield-s": '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/>',
 "pen": '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14.5 5.5l3 3"/>',
 "wand": '<path d="M15 4V2M15 10V8M11 6h2M17 6h2M13.5 7.5L3 18l2 2 10.5-10.5"/>',
 "clip": '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
 "help": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
 "msg": '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
 "link": '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
 "send": '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
 "home": '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
 "zap": '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
 "book": '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
 "library": '<path d="M5 4v16M9 4v16M13 4v16M16.5 4.5l3.5 15"/>',
 "card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
 "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>',
 "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 2"/>',
 "globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
 "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
 "arrow-l": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
 "cal": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 "tag": '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
 "crown": '<path d="M3 7l5 5 4-7 4 7 5-5-2 11H5z"/><path d="M5 21h14"/>',
 "ccheck": '<circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.8 2.8L16 10"/>',
 "pkg": '<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
 "cap": '<path d="M22 9L12 4 2 9l10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v5"/>',
 "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 "trash": '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
 "open": '<path d="M7 17L17 7M9 7h8v8"/>',
 "down": '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
 "up": '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
 "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
 "note": '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>',
 "wifi-off": '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.7M19 13a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5"/><path d="M12 20h.01"/>',
 "sliders": '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
 "gh": '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
 "xlogo": '<path d="M4 4l16 16M20 4L4 20"/>',
}
def I(name, size=16, sw=2, cls=None):
    extra = ' class="%s"' % cls if cls else ""
    return svg(P[name], size, sw, extra)

# SuperPrompt identity (Nov 2026): violet -> space-blue tile, prompt caret, cyan spark
MARK_SVG = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
            "<defs><linearGradient id='spg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#8B5CF6'/><stop offset='1' stop-color='#2563EB'/></linearGradient></defs>"
            "<rect width='64' height='64' rx='16' fill='url(#spg)'/>"
            "<path d='M18 22l12 10-12 10' fill='none' stroke='#fff' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>"
            "<path d='M34 44h12' stroke='#fff' stroke-width='6' stroke-linecap='round'/>"
            "<path d='M47 10l2.8 6.7L56.5 19.5l-6.7 2.8L47 29l-2.8-6.7L37.5 19.5l6.7-2.8z' fill='#A5F3FC'/></svg>")
FAVICON = "data:image/svg+xml," + urllib.parse.quote(MARK_SVG, safe="/:=' ")
LOGO = MARK_SVG.replace("<svg ", '<svg class="brand-mark" aria-hidden="true" ', 1)

NAV = [("home", "", "nav.home", "home"), ("guide", "guide/", "nav.guide", "zap"), ("blog", "en/blog/", "nav.blog", "book"),
       ("prompts", "prompts/", "nav.prompts", "library"), ("history", "history/", "nav.history", "clock"), ("about", "about/", "nav.about", "info")]
FOOT = [("", "nav.home"), ("guide/", "nav.guide"), ("en/blog/", "nav.blog"), ("prompts/", "nav.prompts"), ("history/", "nav.history"), ("about/", "nav.about")]
ENGINE = ("prompt-lexicon.js", "prompt-engine.js", "generator.js")
MODES = ["auto", "quick", "comprehensive", "diagnose", "project", "review", "research", "improve", "learn", "resume", "files"]
MODE_T = {"auto": ("Auto", "تلقائي"), "quick": ("Quick", "سريع"), "comprehensive": ("Comprehensive", "شامل"), "diagnose": ("Diagnose & fix", "تشخيص وإصلاح"),
          "project": ("Change an existing project", "تطوير مشروع قائم"), "review": ("Check & review", "فحص ومراجعة"), "research": ("Research & compare", "بحث ومقارنة"),
          "improve": ("Improve or correct a prompt", "تحسين برومبت أو تصحيحه"), "learn": ("Explain & learn", "شرح وتعلّم"), "resume": ("Resume from last point", "استكمال من آخر نقطة"),
          "files": ("Move, organise, clean files", "نقل وترتيب وتنظيف ملفات")}
for _m, _v in MODE_T.items():
    T["mode." + _m] = _v

def href(R, p):
    return (R + p) if (R + p) else "./"

def header(R, lang, active):
    links = []
    for key, p, k, ic in NAV:
        cur = ' aria-current="page"' if key == active else ""
        links.append('<a href="%s"%s data-i18n="%s">%s</a>' % (href(R, p), cur, k, E(tx(k, lang))))
    items = []
    for key, p, k, ic in NAV:
        cur = ' aria-current="page"' if key == active else ""
        items.append('<a class="menu-item" href="%s"%s>%s<span data-i18n="%s">%s</span></a>' % (href(R, p), cur, I(ic, 16), k, E(tx(k, lang))))
    return f'''<header class="site-header">
  <div class="header-inner">
    <a class="brand" id="home-link" href="{href(R, '')}" aria-label="SuperPrompt" dir="ltr">{LOGO}<span class="brand-text"><span class="brand-name"><b class="wm-a">Super</b><b class="wm-b">Prompt</b></span></span></a>
    <nav class="main-nav" data-i18n-attr="aria-label:aria.mainnav" aria-label="{E(tx('aria.mainnav', lang))}">{''.join(links)}</nav>
    <div class="header-actions">
      <button type="button" class="icon-btn theme-btn" data-action="theme" data-i18n-attr="aria-label:aria.theme" aria-label="{E(tx('aria.theme', lang))}">{I('moon', 16, 2, 'i-moon')}{I('sun', 16, 2, 'i-sun')}</button>
      <a class="icon-btn history-btn" href="{href(R, 'history/')}" data-i18n-attr="aria-label:aria.history" aria-label="{E(tx('aria.history', lang))}">{I('clock', 16)}</a>
      <button type="button" class="icon-btn menu-btn" aria-expanded="false" aria-haspopup="true" aria-controls="menu-panel" data-i18n-attr="aria-label:aria.menu" aria-label="{E(tx('aria.menu', lang))}">{I('menu', 20, 1.75, 'i-menu')}{I('close', 20, 1.75, 'i-close')}</button>
    </div>
  </div>
  <div class="menu-panel" id="menu-panel">
    <div class="menu-list">{''.join(items)}</div>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item" data-action="lang">{I('globe', 16)}<span data-i18n="lang.switch">{E(tx('lang.switch', lang))}</span></button>
  </div>
</header>'''

def share(lang):
    return f'''<section class="share" aria-labelledby="share-title">
  <h3 id="share-title" data-i18n="share.title">{E(tx('share.title', lang))}</h3>
  <div class="share-row">
    <button type="button" class="share-btn" data-action="share" data-i18n-attr="aria-label:share.msg" aria-label="{E(tx('share.msg', lang))}">{I('msg', 20)}</button>
    <button type="button" class="share-btn" data-action="share" data-i18n-attr="aria-label:share.link" aria-label="{E(tx('share.link', lang))}">{I('link', 18)}</button>
    <button type="button" class="share-btn" data-action="share" data-i18n-attr="aria-label:share.send" aria-label="{E(tx('share.send', lang))}">{I('send', 20)}</button>
  </div>
</section>'''

def footer(R, lang):
    links = []
    for p, k in FOOT:
        icon = I("shield-s", 14) if k == "nav.privacy" else ""
        links.append('<a href="%s">%s<span data-i18n="%s">%s</span></a>' % (href(R, p), icon, k, E(tx(k, lang))))
    ext = lambda url, icon, inner: f'<a href="{url}" target="_blank" rel="noopener noreferrer">{I(icon, 14)}{inner}</a>'
    ext_links = "".join([
        ext(GITHUB_URL, "gh", "<span>GitHub</span>"),
        ext(RELEASES_URL, "down", f'<span data-i18n="foot.download">{E(tx("foot.download", lang))}</span>'),
        ext(SUPPORT_URL, "heart", f'<span data-i18n="foot.support">{E(tx("foot.support", lang))}</span>'),
        ext(X_URL, "xlogo", '<bdi dir="ltr">X @Soiltary</bdi>'),
    ])
    return f'''<footer class="site-footer">
  <div class="footer-inner">
    <nav class="footer-nav" data-i18n-attr="aria-label:aria.footnav" aria-label="{E(tx('aria.footnav', lang))}">{''.join(links)}</nav>
    <nav class="footer-ext" data-i18n-attr="aria-label:aria.extlinks" aria-label="{E(tx('aria.extlinks', lang))}">{ext_links}</nav>
    <p class="footer-small" data-i18n="footer.copy">{E(tx('footer.copy', lang))}</p>
    <p class="footer-small"><span data-i18n="footer.credit">{E(tx('footer.credit', lang))}</span> <b>{I('wifi-off', 12)}<span data-i18n="footer.offline">{E(tx('footer.offline', lang))}</span></b></p>
  </div>
</footer>'''

HEAD_SCRIPT = ("(function(){try{var d=document.documentElement,s=window.localStorage;var t=s.getItem('mpz-theme');"
               "if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}"
               "d.setAttribute('data-theme',t);var l=s.getItem('mpz-ui-lang');"
               "if(l==='ar'||l==='en'){d.setAttribute('lang',l);d.setAttribute('dir',l==='ar'?'rtl':'ltr');}}catch(e){}})();")

def page(path, lang, active, title_key, main_html, scripts=(), desc=None):
    depth = len([p for p in path.split("/") if p])
    R = "../" * depth
    title = tx(title_key, lang)
    d = desc or tx("home.sub", lang)
    sc = "".join('<script src="%s%s" defer></script>' % (R, s) for s in ("i18n.js",) + tuple(scripts) + ("storage.js", "app.js"))
    out = f'''<!DOCTYPE html>
<html lang="{lang}" dir="{'rtl' if lang == 'ar' else 'ltr'}" data-page-lang="{lang}" data-theme="light" data-title-key="{title_key}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(d)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#7C3AED">
<link rel="icon" href="{R}favicon.svg" type="image/svg+xml">
<link rel="icon" href="{R}favicon.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="{R}icon-180.png">
<link rel="stylesheet" href="{R}styles.css">
<link rel="stylesheet" href="{R}styles-v2.css">
<link rel="stylesheet" href="{R}brand.css">
<script>{HEAD_SCRIPT}</script>
{sc}
</head>
<body>
{header(R, lang, active)}
{main_html(R)}
{footer(R, lang)}
<ol class="toaster" id="toaster" aria-live="polite"></ol>
</body>
</html>
'''
    target = os.path.join(APP, path, "index.html")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

def page_head(lang, icon, hkey, pkey, pcls=""):
    return (f'<header class="page-head"><div class="tile">{I(icon, 28)}</div>'
            f'{el("h1", hkey, lang)}{el("p", pkey, lang, pcls or None)}</header>')

# ================= HOME =================
LANG_OPTS = [("ar", "العربية"), ("en", "English"), ("es", "Español"), ("fr", "Français"), ("de", "Deutsch"),
             ("tr", "Türkçe"), ("pt", "Português"), ("ja", "日本語"), ("ko", "한국어"), ("zh", "中文")]

def seg(name, key_prefix, values, lang, default):
    out = '<div class="seg" role="radiogroup" data-name="%s">' % name
    for v in values:
        out += ('<label class="seg-opt"><input type="radio" name="%s" value="%s"%s><span data-i18n="%s.%s">%s</span></label>'
                % (name, v, " checked" if v == default else "", key_prefix, v, E(tx(key_prefix + "." + v, lang))))
    return out + '</div>'

def home_main(R, lang="en"):
    opts = "".join('<li class="option" role="option" id="opt-%s" data-value="%s" lang="%s" aria-selected="%s"><span>%s</span>%s</li>'
                   % (c, c, c, "true" if c == "ar" else "false", n, I("check", 16)) for c, n in LANG_OPTS)
    mode_opts = "".join('<option value="%s" data-i18n="mode.%s"%s>%s</option>' % (m, m, " selected" if m == "auto" else "", E(tx("mode." + m, lang))) for m in MODES)
    why = [("sparkles", "why1"), ("langs", "why2"), ("gauge", "why3"), ("shield", "why4")]
    why_html = "".join(f'<article class="card why-card"><div class="why-icon">{I(ic, 20)}</div>{el("h3", k + ".h", lang)}{el("p", k + ".p", lang)}</article>' for ic, k in why)
    how = [("pen", "how1"), ("sparkles", "how2"), ("clip", "how3")]
    how_html = "".join(f'<article class="card how-card"><div class="how-top"><span class="how-num">{n}</span>{I(ic, 20)}</div>{el("h3", k + ".h", lang)}{el("p", k + ".p", lang)}</article>' for n, (ic, k) in enumerate(how, 1))
    faq_html = ""
    for i in range(1, 8):
        faq_html += (f'<details class="faq-item" id="faq-{i}"><summary class="faq-q">'
                     f'{I("help", 20)}<span class="q-text" data-i18n="faq{i}.q">{E(tx("faq%d.q" % i, lang))}</span> <span class="q-sign">+</span></summary>'
                     f'<div class="faq-a">{el("p", "faq%d.a" % i, lang)}</div></details>')
    # Same markup in every copy; app.js fills it from release.json and shows it only on the hosted site
    # (release.json is published with the website, never embedded in the Windows app or used locally).
    get_bar = (f'<div class="get-bar" id="get-bar" hidden>'
               f'<a class="get-btn get-web" href="#goal" data-action="focus-goal">{I("globe", 18)}<span data-i18n="get.web">{E(tx("get.web", lang))}</span></a>'
               f'<a class="get-btn get-win" id="get-win" href="#" download>{I("down", 18)}<span class="get-txt"><span data-i18n="get.win">{E(tx("get.win", lang))}</span>'
               f'<small dir="ltr" id="get-meta"></small></span></a>'
               f'<p class="get-how" id="get-how">{I("info", 14)}<span><span data-i18n="get.how1">{E(tx("get.how1", lang))}</span> '
               f'<bdi dir="ltr" class="get-exe">SuperPrompt.exe</bdi> · <span data-i18n="get.how2">{E(tx("get.how2", lang))}</span> · '
               f'<a id="get-notes" href="{RELEASES_URL}" target="_blank" rel="noopener noreferrer"><span data-i18n="get.notes">{E(tx("get.notes", lang))}</span> ↗</a></span></p></div>')
    return f'''<main class="home-main ws-main">
  <div class="ws-wrap">
    <header class="ws-head">
      <div class="ws-title">{el("h1", "home.h1", lang)}{el("p", "home.sub", lang)}</div>
      {get_bar}
    </header>
    <div class="ws-grid">
      <section class="ws-panel ws-compose step-card" id="composer" aria-labelledby="lbl-goal">
        <div class="panel-head"><label class="panel-title" id="lbl-goal" for="goal">{I("pen", 18)}<span data-i18n="step.goal">{E(tx("step.goal", lang))}</span></label>
          <a class="panel-link" href="{R}prompts/">{I("library", 16)}<span data-i18n="nav.prompts">{E(tx("nav.prompts", lang))}</span></a></div>
        <textarea id="goal" class="field autogrow ws-goal" dir="auto" spellcheck="true" data-i18n-attr="placeholder:goal.ph" placeholder="{E(tx("goal.ph", lang))}"></textarea>
        <p class="field-error" id="gen-error" role="alert" hidden></p>
        <details class="fold" id="base-fold">
          <summary class="fold-sum">{I("edit", 16)}<span data-i18n="base.toggle">{E(tx("base.toggle", lang))}</span>{I("chev", 16, 2, "fold-chev")}</summary>
          <textarea id="base" class="field autogrow base-field" dir="auto" spellcheck="false" data-i18n-attr="placeholder:base.ph" placeholder="{E(tx("base.ph", lang))}"></textarea>
        </details>
        <div class="ws-controls">
          <label class="ctl"><span class="ctl-label" data-i18n="opt.mode">{E(tx("opt.mode", lang))}</span><select id="opt-mode" class="field small-select">{mode_opts}</select></label>
          <div class="ctl"><span class="ctl-label" id="lbl-lang" data-i18n="step.lang">{E(tx("step.lang", lang))}</span>
            <div class="select">
              <button type="button" id="lang-btn" class="field select-btn" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="lang-list" aria-labelledby="lbl-lang lang-label"><span id="lang-label" lang="ar">العربية</span>{I("chev", 16)}</button>
              <ul id="lang-list" class="listbox" role="listbox" aria-labelledby="lbl-lang" tabindex="-1">{opts}</ul>
            </div></div>
          <div class="ctl ctl-wide"><span class="ctl-label" data-i18n="opt.level">{E(tx("opt.level", lang))}</span>{seg("level", "lvl", ["short", "balanced", "detailed"], lang, "balanced")}</div>
        </div>
        <details class="fold" id="adv-fold">
          <summary class="fold-sum">{I("sliders", 16)}<span data-i18n="adv.toggle">{E(tx("adv.toggle", lang))}</span>{I("chev", 16, 2, "fold-chev")}</summary>
          <div class="adv-grid">
            <div class="adv-row"><span class="adv-label" data-i18n="opt.target">{E(tx("opt.target", lang))}</span>{seg("target", "tgt", ["agent", "chat", "generic"], lang, "agent")}</div>
            <div class="adv-row"><span class="adv-label" data-i18n="opt.format">{E(tx("opt.format", lang))}</span>{seg("format", "fmt", ["sections", "plain", "steps"], lang, "sections")}</div>
            <label class="adv-check"><input type="checkbox" id="opt-alts"><span data-i18n="opt.alts">{E(tx("opt.alts", lang))}</span></label>
          </div>
        </details>
        <div class="ws-generate">
          <button type="button" id="gen-btn" class="gen-btn" disabled>{I("sparkles", 16)}<span data-i18n="gen.btn">{E(tx("gen.btn", lang))}</span><kbd dir="ltr">Ctrl ↵</kbd></button>
          <p class="gen-note"><span data-i18n="gen.note">{E(tx("gen.note", lang))}</span> <a href="{R}history/"><span data-i18n="gen.history">{E(tx("gen.history", lang))}</span><span data-history-count></span></a></p>
        </div>
      </section>
      <section class="ws-panel ws-result" id="result-panel" aria-labelledby="lbl-result">
        <div class="panel-head result-head"><label class="panel-title" id="lbl-result" for="result">{I("sparkles", 18)}<span data-i18n="step.result">{E(tx("step.result", lang))}</span></label>
          <button type="button" id="copy-btn" class="copy-btn" data-action="copy-from" data-target="result" disabled><span class="i-copy">{I("copy", 16)}</span><span class="i-check">{I("check", 16)}</span><span data-copy-label="copy" data-i18n="copy">{E(tx("copy", lang))}</span></button></div>
        <div class="understand" id="understand" hidden></div>
        <div class="qcard" id="qcard" hidden></div>
        <div class="rtabs" id="rtabs" role="tablist" hidden></div>
        <div class="result-box"><div class="result-view" id="result-view" hidden></div><textarea id="result" spellcheck="false" data-i18n-attr="placeholder:result.ph" placeholder="{E(tx("result.ph", lang))}"></textarea></div>
        <div class="result-actions" id="result-actions" hidden>
          <button type="button" class="chip-btn" id="r-edit">{I("edit", 16)}<span data-i18n="r.edit">{E(tx("r.edit", lang))}</span></button>
          <button type="button" class="chip-btn" id="r-save">{I("down", 16)}<span data-i18n="r.save">{E(tx("r.save", lang))}</span></button>
          <button type="button" class="chip-btn" id="r-regen">{I("sparkles", 16)}<span data-i18n="r.regen">{E(tx("r.regen", lang))}</span></button>
        </div>
      </section>
    </div>
  </div>
</main>'''

page("", "en", "home", "title.home", lambda R: home_main(R, "en"), scripts=ENGINE)

# ================= GUIDE =================
def guide_main(R, lang="en"):
    secs = [("g1", 2), ("g2", 2), ("g3", 3), ("g4", 2), ("g5", 2), ("g6", 2)]
    cards = ""
    for k, n in secs:
        ps = "".join(el("p", "%s.p%d" % (k, i), lang) for i in range(1, n + 1))
        cards += f'<section class="card doc-card">{el("h3", k + ".h", lang)}{ps}</section>'
    faq_html = ""
    for i in range(1, 8):
        faq_html += (f'<details class="faq-item" id="faq-{i}"><summary class="faq-q">'
                     f'{I("help", 20)}<span class="q-text" data-i18n="faq{i}.q">{E(tx("faq%d.q" % i, lang))}</span> <span class="q-sign">+</span></summary>'
                     f'<div class="faq-a">{el("p", "faq%d.a" % i, lang)}</div></details>')
    return f'''<main class="page-main">
  <div class="wrap w-768">
    {page_head(lang, "cap", "guide.h1", "guide.sub")}
    <div class="stack">{cards}</div>
    <section class="section guide-faq" aria-labelledby="faq-title">
      <header class="sec-head"><h2 id="faq-title" data-i18n="faq.h2">{E(tx("faq.h2", lang))}</h2>{el("p", "faq.sub", lang)}</header>
      <div class="faq-list">{faq_html}</div>
    </section>
    <div class="cta-row"><a class="btn-dark" href="{R}" data-i18n="guide.cta">{E(tx("guide.cta", lang))}</a></div>
  </div>
</main>'''
page("guide", "en", "guide", "title.guide", lambda R: guide_main(R, "en"))

# ================= BLOG =================
def art_svg(i):
    rnd = random.Random(i * 7919 + 13)
    bg, a1, a2 = PALETTES[i % len(PALETTES)]
    dark = "#1d2130"
    gid = "g%d" % i
    s = [f'<svg viewBox="0 0 384 215" preserveAspectRatio="xMidYMid slice" aria-hidden="true">',
         f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{a2}"/><stop offset="1" stop-color="{a1}"/></linearGradient></defs>',
         f'<rect width="384" height="215" fill="{bg}"/>']
    # soft hills
    s.append(f'<path d="M0 {150 + rnd.randint(-20, 20)} C 90 {110 + rnd.randint(-20, 20)}, 200 {200 + rnd.randint(-15, 10)}, 384 {130 + rnd.randint(-20, 20)} L384 215 L0 215Z" fill="#000" opacity=".05"/>')
    kind = i % 4
    if kind == 0:
        # flow ribbon + cards
        y = rnd.randint(70, 120)
        s.append(f'<path d="M20 {y} C 110 {y - 60}, 170 {y + 70}, 260 {y - 10}" stroke="url(#{gid})" stroke-width="16" fill="none" stroke-linecap="round"/>')
        for k in range(3):
            x = 230 + k * 36; yy = 40 + k * 22
            s.append(f'<rect x="{x}" y="{yy}" width="100" height="84" rx="12" fill="{dark}" opacity="{0.75 + k * 0.1:.2f}"/>')
        for k in range(4):
            s.append(f'<rect x="{316}" y="{98 + k * 14}" width="{rnd.randint(30, 52)}" height="5" rx="2.5" fill="#fff" opacity=".55"/>')
        s.append(f'<rect x="36" y="{y - 26}" width="52" height="52" rx="12" fill="{dark}"/><circle cx="62" cy="{y}" r="7" fill="{a2}"/>')
    elif kind == 1:
        # phone/app tiles
        for k in range(4):
            x = 40 + k * 80; h = rnd.randint(110, 150)
            s.append(f'<rect x="{x}" y="{200 - h}" width="64" height="{h}" rx="12" fill="{dark if k % 2 == 0 else "#fff"}" stroke="{dark}" stroke-opacity=".15"/>')
            s.append(f'<circle cx="{x + 32}" cy="{200 - h + 28}" r="12" fill="url(#{gid})"/>')
            for m in range(3):
                s.append(f'<rect x="{x + 12}" y="{200 - h + 52 + m * 14}" width="{rnd.randint(24, 40)}" height="5" rx="2.5" fill="{"#fff" if k % 2 == 0 else dark}" opacity=".45"/>')
    elif kind == 2:
        # dashboard chart
        s.append(f'<rect x="40" y="30" width="304" height="160" rx="16" fill="#fff" stroke="{dark}" stroke-opacity=".1"/>')
        s.append(f'<rect x="40" y="30" width="304" height="30" rx="16" fill="{dark}"/><rect x="40" y="46" width="304" height="14" fill="{dark}"/>')
        pts = " ".join("%d,%d" % (70 + k * 40, rnd.randint(90, 160)) for k in range(7))
        s.append(f'<polyline points="{pts}" fill="none" stroke="url(#{gid})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
        for k in range(5):
            h = rnd.randint(18, 50)
            s.append(f'<rect x="{80 + k * 50}" y="{178 - h}" width="22" height="{h}" rx="5" fill="{a1}" opacity=".25"/>')
    else:
        # circles + chat bubbles
        s.append(f'<circle cx="{rnd.randint(250, 300)}" cy="100" r="62" fill="{dark}"/>')
        s.append(f'<circle cx="{rnd.randint(250, 300)}" cy="100" r="30" fill="url(#{gid})" opacity=".9"/>')
        for k in range(3):
            x = 34 + k * 26; y = 40 + k * 48
            s.append(f'<rect x="{x}" y="{y}" width="{rnd.randint(110, 150)}" height="34" rx="17" fill="{"#fff" if k != 1 else dark}" stroke="{dark}" stroke-opacity=".12"/>')
            s.append(f'<rect x="{x + 16}" y="{y + 14}" width="{rnd.randint(50, 90)}" height="6" rx="3" fill="{a1 if k != 1 else "#fff"}" opacity=".6"/>')
    s.append(f'<path d="M{rnd.randint(300, 350)} {rnd.randint(22, 40)} l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="{a1}"/>')
    s.append("</svg>")
    raw = "".join(s).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('"', "'")
    return "data:image/svg+xml," + urllib.parse.quote(raw, safe=" ='/:;,.-()")

def art_img(i, cls="post-art"):
    return '<img class="%s" src="%s" width="384" height="215" alt="">' % (cls, art_svg(i))

# ---- tips: Arabic titles/summaries/dates so the Arabic interface never shows English cards ----
from blog_ar import AR_POSTS, AR_TAGS, ar_date, ar_minutes
T["blog.enonly"] = ("", "المقال بالإنجليزي")
T["blog.ennote"] = ("", "نص هذا المقال متوفر بالإنجليزي حاليًا، والعنوان والملخص مترجمين.")
for _p in POSTS:
    _slug, _title, _tag, _date, _mins, _summary = _p[:6]
    _ta, _sa = AR_POSTS[_slug]
    T["post.%s.t" % _slug] = (_title, _ta)
    T["post.%s.s" % _slug] = (_summary, _sa)
    T["post.%s.d" % _slug] = (_date, ar_date(_date))
    T["post.%s.m" % _slug] = ("%d min read" % _mins, ar_minutes(_mins))
    if _tag:
        T["tag.%s" % re.sub(r"[^a-z0-9]+", "-", _tag.lower()).strip("-")] = (_tag, AR_TAGS[_tag])

def tag_key(tag):
    return "tag.%s" % re.sub(r"[^a-z0-9]+", "-", tag.lower()).strip("-")

def post_card(R, i, p):
    slug, title, tag, date, mins, summary = p[:6]
    tag_html = f'<span class="tag">{I("tag", 12)}<span data-i18n="{tag_key(tag)}">{E(tag)}</span></span>' if tag else ""
    return (f'<a class="card post-card" href="{R}en/blog/{slug}/">'
            f'{art_img(i)}{tag_html}<span class="lang-badge" data-i18n="blog.enonly"></span>'
            f'<h3 data-i18n="post.{slug}.t">{E(title)}</h3><p data-i18n="post.{slug}.s">{E(summary)}</p>'
            f'<span class="post-meta"><span>{I("cal", 14)}<span data-i18n="post.{slug}.d">{E(date)}</span></span>'
            f'<span>{I("clock", 14)}<span data-i18n="post.{slug}.m">{mins} min read</span></span></span>'
            f'<span class="read-more"><span data-i18n="blog.read">Read Article</span>{I("arrow", 16, 2, "flip")}</span></a>')

def blog_main(R, lang="en"):
    cards = "".join(post_card(R, i, p) for i, p in enumerate(POSTS))
    return f'''<main class="page-main">
  <div class="wrap w-896">
    {page_head(lang, "book", "blog.h1", "blog.sub")}
    <div class="blog-grid">{cards}</div>
  </div>
</main>'''
page("en/blog", "en", "blog", "title.blog", lambda R: blog_main(R, "en"))

for i, p in enumerate(POSTS):
    slug, title, tag, date, mins, summary, intro, tips, prompt, closing = p
    T["title.post.%s" % slug] = ("SuperPrompt | " + title, "SuperPrompt | " + AR_POSTS[slug][0])
    def post_main(R, i=i, p=p):
        slug, title, tag, date, mins, summary, intro, tips, prompt, closing = p
        tag_html = f'<span class="tag" style="margin:0 auto 12px">{I("tag", 12)}<span data-i18n="{tag_key(tag)}">{E(tag)}</span></span>' if tag else ""
        lis = "".join("<li>%s</li>" % E(t) for t in tips)
        pid = "post-prompt"
        return f'''<main class="page-main">
  <div class="wrap w-768">
    <a class="back-link" href="{R}en/blog/">{I("arrow-l", 16, 2, "flip")}<span data-i18n="blog.back">All articles</span></a>
    <article>
      <header class="page-head">{tag_html}<h1 data-i18n="post.{slug}.t">{E(title)}</h1><p data-i18n="post.{slug}.s">{E(summary)}</p>
        <div class="post-meta article-meta"><span>{I("cal", 14)}<span data-i18n="post.{slug}.d">{E(date)}</span></span><span>{I("clock", 14)}<span data-i18n="post.{slug}.m">{mins} min read</span></span></div>
        <p class="lang-note" data-i18n="blog.ennote"></p></header>
      {art_img(i, "post-art article-art")}
      <div class="stack" lang="en" dir="ltr">
        <section class="card doc-card"><p>{E(intro)}</p><h2>Key points</h2><ul>{lis}</ul></section>
        <section class="card doc-card"><h2>Try this prompt</h2><div class="prompt-block" id="{pid}">{E(prompt)}</div>
          <div class="prompt-actions">
            <button type="button" class="chip-btn" data-action="copy-from" data-target="{pid}"><span class="i-copy">{I("copy", 16)}</span><span class="i-check">{I("check", 16)}</span><span data-copy-label="copy" data-i18n="copy">Copy</span></button>
            <a class="chip-btn primary" href="{R}" data-action="load-goal" data-target="{pid}">{I("sparkles", 16)}<span data-i18n="blog.use">Use this prompt in the generator</span></a>
          </div>
          <p>{E(closing)}</p></section>
      </div>
    </article>
  </div>
</main>'''
    page("en/blog/" + slug, "en", "blog", "title.post.%s" % slug, post_main, desc=summary)

# ================= PROMPT LIBRARY (one example per mode) =================
for _i, (_m, _t, _d, _g, _b) in enumerate(LIB, 1):
    T["lib.%d.title" % _i] = _t
    T["lib.%d.desc" % _i] = _d

def prompts_main(R, lang="ar"):
    cards = ""
    for i, (m, t, d, g, b) in enumerate(LIB, 1):
        base_html = (f'<p class="lib-label" data-i18n="lib.base">{E(tx("lib.base", lang))}</p><div class="prompt-block lib-text" id="lib-b{i}" dir="auto">{E(b)}</div>') if b else ""
        cards += (f'<article class="card lib-card" data-mode="{m}">'
                  f'<span class="mode-chip" data-i18n="mode.{m}">{E(tx("mode." + m, lang))}</span>'
                  f'{el("h2", "lib.%d.title" % i, lang)}{el("p", "lib.%d.desc" % i, lang, "lib-desc")}'
                  f'{base_html}<p class="lib-label" data-i18n="lib.goal">{E(tx("lib.goal", lang))}</p><div class="prompt-block lib-text" id="lib-g{i}" dir="auto">{E(g)}</div>'
                  f'<details class="fold lib-fold" data-goal="lib-g{i}" data-base="{("lib-b%d" % i) if b else ""}" data-mode="{m}"><summary class="fold-sum">{I("open", 16)}<span data-i18n="lib.preview">{E(tx("lib.preview", lang))}</span>{I("chev", 16, 2, "fold-chev")}</summary>'
                  f'<div class="prompt-block lib-out" id="lib-o{i}" dir="auto"></div></details>'
                  f'<div class="prompt-actions">'
                  f'<a class="chip-btn primary" href="{R}" data-action="load-example" data-goal="lib-g{i}" data-base="{("lib-b%d" % i) if b else ""}" data-mode="{m}">{I("sparkles", 16)}<span data-i18n="lib.load">{E(tx("lib.load", lang))}</span></a>'
                  f'<button type="button" class="chip-btn" data-action="copy-example" data-out="lib-o{i}"><span class="i-copy">{I("copy", 16)}</span><span class="i-check">{I("check", 16)}</span><span data-copy-label="lib.copy" data-i18n="lib.copy">{E(tx("lib.copy", lang))}</span></button>'
                  f'</div></article>')
    return f'''<main class="page-main">
  <div class="wrap w-896">
    {page_head(lang, "library", "prompts.h1", "prompts.sub", "relaxed")}
    <div class="lib-grid">{cards}</div>
  </div>
</main>'''
page("prompts", "ar", "prompts", "title.prompts", lambda R: prompts_main(R, "ar"), scripts=ENGINE, desc=tx("prompts.sub", "en"))

# Removed pages (pricing, upgrade, refund-policy, terms, contact, privacy, old prompts/<category>) are no longer generated.

# ================= ABOUT (with the local privacy note) =================
def about_main(R, lang="en"):
    cards = "".join(f'<section class="card doc-card">{el("h3", k + ".h", lang)}{el("p", k + ".p", lang)}</section>' for k in ["about1", "about2", "about3"])
    return f'''<main class="page-main">
  <div class="wrap w-768">
    {page_head(lang, "info", "about.h1", "about.sub")}
    <div class="stack">{cards}</div>
  </div>
</main>'''
page("about", "en", "about", "title.about", lambda R: about_main(R), desc=tx("about.sub", "en"))

def history_main(R, lang="en"):
    tmpl = "".join(f'<template id="icon-{n}">{I(n, 16)}</template>' for n in ("open", "copy", "check", "edit", "trash"))
    return f'''<main class="page-main">
  <div class="wrap w-768">
    {page_head(lang, "clock", "history.h1", "history.sub")}
    <div class="hist-tools">
      <span class="chip-btn" id="hist-count" style="background:transparent"></span>
      <button type="button" class="chip-btn" id="hist-export">{I("down", 16)}<span data-i18n="history.export">{E(tx("history.export", lang))}</span></button>
      <button type="button" class="chip-btn" id="hist-import">{I("up", 16)}<span data-i18n="history.import">{E(tx("history.import", lang))}</span></button>
      <button type="button" class="chip-btn danger" id="hist-clear">{I("trash", 16)}<span data-i18n="history.clear">{E(tx("history.clear", lang))}</span></button>
      <input type="file" id="hist-file" accept="application/json,.json" hidden>
    </div>
    <div class="hist-search"><input type="search" id="hist-search" class="field" data-i18n-attr="placeholder:history.search" placeholder="{E(tx("history.search", lang))}" aria-label="Search"></div>
    <div class="hist-list" id="hist-list" aria-live="polite"></div>
    {tmpl}
  </div>
</main>'''
page("history", "en", "history", "title.history", lambda R: history_main(R), scripts=ENGINE)

# ================= i18n.js =================
# only the keys the generated pages and app.js actually use
_used = set()
for _dp, _dn, _fn in os.walk(APP):
    for _f in _fn:
        if _f.endswith(".html"):
            _s = open(os.path.join(_dp, _f), encoding="utf-8").read()
            _used.update(re.findall(r'data-i18n="([^"]+)"', _s))
            _used.update(re.findall(r'data-title-key="([^"]+)"', _s))
            for _pairs in re.findall(r'data-i18n-attr="([^"]+)"', _s):
                _used.update(p.split(":")[1].strip() for p in _pairs.split(";") if ":" in p)
_appjs = open(os.path.join(APP, "app.js"), encoding="utf-8").read()
for _js in ("app.js", "storage.js", "generator.js"):
    _used.update(re.findall(r'"([A-Za-z0-9_.-]+)"', open(os.path.join(APP, _js), encoding="utf-8").read()))
_used.update(re.findall(r'data-copy-label=\'([^\']+)\'', _appjs))
_used.update(["copy", "copied", "history.less", "history.more", "history.save", "r.view", "r.edit", "r.saved", "r.save", "gen.btn", "gen.busy", "lib.copy"])
en = {k: nodot(v[0]) for k, v in T.items() if k in _used}
ar = {k: iso(k, nodot(v[1]), "ar") for k, v in T.items() if k in _used}
with open(os.path.join(APP, "favicon.svg"), "w", encoding="utf-8", newline="\n") as f:
    f.write(MARK_SVG)
with open(os.path.join(APP, "i18n.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Interface text in English and Arabic (generated from the page content). */\n")
    f.write("window.MPZ_I18N = " + json.dumps({"en": en, "ar": ar}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("ok", len(T), "strings")

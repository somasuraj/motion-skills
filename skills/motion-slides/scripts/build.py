#!/usr/bin/env python3
"""Build a self-contained presentation from a deck script.

    python build.py deck.js -o my-talk.html [--title "My talk"] [--no-embed-fonts]

The deck script calls Deck.config(...), Deck.css(...), Deck.frame(...) and
optionally Deck.layout(...), Deck.path(...), Deck.deco(...) and Deck.link(...).
It is inlined into assets/deck.html, so the output is one HTML file with no
local dependencies:

- Fonts named in Deck.config are downloaded from Google Fonts and embedded as
  data: URIs, so the talk looks the same on any laptop, offline too. Without
  network the page loads them at view time instead.
- asset('photo.jpg') with a local path (relative to the deck script) is
  embedded as a data: URI.
"""
import argparse
import base64
import html
import json
import mimetypes
import pathlib
import re
import sys
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DECK = HERE.parent / "assets" / "deck.html"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SKIP_SUBSETS = {"cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"}
IMAGES = []   # image files embedded by asset(), for the credits check
IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm"}


def font_families(src):
    """(family, weights) pairs from Deck.config({fonts: {...}})."""
    m = re.search(r"fonts\s*:\s*\{", src)
    if not m:
        return []
    i, depth = m.end(), 1
    while i < len(src) and depth:
        depth += {"{": 1, "}": -1}.get(src[i], 0)
        i += 1
    block = src[m.end():i - 1]
    out = []
    for slot in re.finditer(r"(\w+)\s*:\s*(\{[^{}]*\}|'[^']*'|\"[^\"]*\")", block):
        val = slot.group(2)
        if val[0] in "'\"":
            out.append((val[1:-1], [400, 700]))
            continue
        fam = re.search(r"family\s*:\s*['\"]([^'\"]+)['\"]", val)
        ws = re.search(r"weights\s*:\s*\[([^\]]*)\]", val)
        if fam:
            weights = [int(w) for w in re.findall(r"\d+", ws.group(1))] if ws else [400, 700]
            out.append((fam.group(1), weights or [400]))
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def embed_fonts(fams):
    if not fams:
        return ""
    q = "&".join("family=" + urllib.parse.quote(f).replace("%20", "+") + ":wght@" + ";".join(str(w) for w in sorted(set(ws))) for f, ws in fams)
    css = fetch("https://fonts.googleapis.com/css2?" + q + "&display=block").decode("utf-8")
    keep = []
    for b in re.split(r"(?=/\*\s*[\w-]+\s*\*/)", css):
        sub = re.match(r"/\*\s*([\w-]+)\s*\*/", b)
        if sub and sub.group(1) in SKIP_SUBSETS:
            continue
        keep.append(b)
    cache = {}

    def inline(m):
        u = m.group(1)
        if u not in cache:
            cache[u] = "data:font/woff2;base64," + base64.b64encode(fetch(u)).decode("ascii")
        return "url(" + cache[u] + ")"
    return re.sub(r"url\((https://[^)]+)\)", inline, "".join(keep))


def embed_assets(src, base):
    """Inline asset('<local image>') as a data: URI."""
    def one(m):
        q, path = m.group(1), m.group(2)
        if re.match(r"^(https?:|data:|blob:)", path):
            return m.group(0)
        f = (base / path).resolve()
        if not f.exists():
            raise SystemExit(f"asset: {f} not found")
        mime = IMAGE_TYPES.get(f.suffix.lower()) or mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        print(f"embedding {f.name} ({f.stat().st_size / 1048576:.1f} MB)")
        if mime.startswith("image/"):
            IMAGES.append(f.name)
        return "asset(" + q + "data:" + mime + ";base64," + base64.b64encode(f.read_bytes()).decode("ascii") + q + ")"
    return re.sub(r"asset\(\s*(['\"])([^'\"]+)\1\s*\)", one, src)


def embed_credits(src, base):
    """Deck.credits('images/credits.json') -> the JSON itself."""
    def one(m):
        f = (base / m.group(2)).resolve()
        if not f.exists():
            raise SystemExit(f"Deck.credits: {f} not found")
        return "Deck.credits(" + json.dumps(json.loads(f.read_text(encoding="utf-8")), ensure_ascii=False) + ")"
    return re.sub(r"Deck\.credits\(\s*(['\"])([^'\"]+\.json)\1\s*\)", one, src)


def youtube_thumbs(src):
    """Each youtube id in the deck gets its thumbnail embedded, so the slide shows the real frame offline."""
    ids = set(re.findall(r"youtube\s*:\s*['\"]([\w-]{11})['\"]", src)) | set(re.findall(r"youtube\s*:\s*\{[^}]*?id\s*:\s*['\"]([\w-]{11})['\"]", src))
    out = {}
    for vid in sorted(ids):
        for q in ("maxresdefault", "hqdefault"):
            try:
                data = fetch(f"https://i.ytimg.com/vi/{vid}/{q}.jpg")
                if data[:3] == b"\xff\xd8\xff" and len(data) > 2000:
                    out[vid] = "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")
                    break
            except Exception:  # noqa: BLE001
                continue
        else:
            print(f"note: no thumbnail for YouTube video {vid}; its slide shows a plain card", file=sys.stderr)
    return out


THREE_JS = pathlib.Path(__file__).resolve().parent.parent / "assets" / "vendor" / "three.min.js"


def three_tag(src):
    """three.js (MIT), inlined only when the script calls k.three( / kit.three( or its config sets three: true."""
    if not re.search(r"\.three\s*\(|\bthree\s*:\s*true", src):
        return ""
    return "<script>" + THREE_JS.read_text(encoding="utf-8") + "</script>"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", help="deck script (.js)")
    ap.add_argument("-o", "--out", required=True, help="output .html")
    ap.add_argument("--title", help="page title (defaults to Deck.config title)")
    ap.add_argument("--no-embed-fonts", action="store_true", help="load fonts from Google Fonts at view time instead")
    a = ap.parse_args()

    deck = pathlib.Path(a.deck)
    src = deck.read_text(encoding="utf-8")
    title = a.title
    if not title:
        m = re.search(r"title\s*:\s*(['\"])(.*?)\1", src)
        title = m.group(2) if m else "Deck"
    fams = font_families(src)
    thumbs = youtube_thumbs(src)
    src = embed_credits(src, deck.resolve().parent)
    src = embed_assets(src, deck.resolve().parent)
    src += "\nDeck._images = " + json.dumps(IMAGES) + "; Deck._ytThumbs = " + json.dumps(thumbs) + ";\n"
    # A literal </script> inside the deck would end the inline script early.
    src = re.sub(r"</(script)", r"<\\/\1", src, flags=re.I)

    page = DECK.read_text(encoding="utf-8")
    if "/*__DECK__*/" not in page:
        print("deck.html is missing the /*__DECK__*/ marker", file=sys.stderr)
        return 1
    fonts = ""
    if not a.no_embed_fonts:
        try:
            css = embed_fonts(fams)
            if css:
                fonts = '<style id="mo-fonts">' + css + "</style>"
        except Exception as e:  # noqa: BLE001
            print(f"note: fonts not embedded ({e}); the page will load them from Google Fonts", file=sys.stderr)
    three = three_tag(src)
    page = page.replace("<!--__FONTS__-->", fonts + three, 1)
    page = page.replace("/*__DECK__*/", src, 1).replace("__TITLE__", html.escape(title), 1)

    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"built {out} ({kb:.0f} KB{', fonts embedded' if fonts else ''})")
    if kb > 15000:
        print("warning: over 15 MB; a hosted page may refuse it. Shrink the images (1920 px wide JPEGs) "
              "or split the talk into two decks.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

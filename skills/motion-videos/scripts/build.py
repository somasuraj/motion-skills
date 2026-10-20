#!/usr/bin/env python3
"""Build a self-contained film page from a film script.

    python build.py film.js -o my-film.html [--title "My film"] [--no-embed-fonts]

The film script calls Film.config(...), Film.css(...), Film.scene(...) and
optionally Film.chapter(...), Film.tweak(...), Film.palette(...), Film.audio(...),
Film.cues(...) and one or more Film.score(...). It is inlined into
assets/player.html, so the output is one HTML file with no local dependencies:

- Fonts named in Film.config are downloaded from Google Fonts and embedded as
  data: URIs, so the page works offline and its in-page Export renders the real
  faces. Without network the page loads them at view time instead.
- Film.audio('dialogue.mp3') and Film.cues('cues.json') with a local path
  (relative to the film script) are embedded too: the audio as a data: URI,
  the cues as a JSON literal.
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
PLAYER = HERE.parent / "assets" / "player.html"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SKIP_SUBSETS = {"cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese", "math", "symbols"}
AUDIO_TYPES = {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac", ".webm": "audio/webm"}


def font_families(src):
    """(family, weights) pairs from Film.config({fonts: {...}})."""
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


def embed_media(src, base):
    """Inline Film.audio('<local file>') as a data: URI and Film.cues('<local .json>') as a literal."""
    def is_local(p):
        return not re.match(r"^(https?:|data:|blob:)", p)

    def audio(m):
        q, path = m.group(1), m.group(2)
        if not is_local(path):
            return m.group(0)
        f = (base / path).resolve()
        if not f.exists():
            raise SystemExit(f"Film.audio: {f} not found")
        mime = AUDIO_TYPES.get(f.suffix.lower()) or mimetypes.guess_type(f.name)[0] or "audio/mpeg"
        mb = f.stat().st_size / 1048576
        print(f"embedding audio {f.name} ({mb:.1f} MB)")
        return "Film.audio(" + q + "data:" + mime + ";base64," + base64.b64encode(f.read_bytes()).decode("ascii") + q

    def cues(m):
        path = m.group(2)
        if not is_local(path):
            return m.group(0)
        f = (base / path).resolve()
        data = json.loads(f.read_text(encoding="utf-8"))
        return "Film.cues(" + json.dumps(data, ensure_ascii=False)
    src = re.sub(r"Film\.audio\(\s*(['\"])([^'\"]+)\1", audio, src)
    src = re.sub(r"Film\.cues\(\s*(['\"])([^'\"]+\.json)\1", cues, src)
    return src


THREE_JS = pathlib.Path(__file__).resolve().parent.parent / "assets" / "vendor" / "three.min.js"


def three_tag(src):
    """three.js (MIT), inlined only when the script calls k.three( / kit.three( or its config sets three: true."""
    if not re.search(r"\.three\s*\(|\bthree\s*:\s*true", src):
        return ""
    return "<script>" + THREE_JS.read_text(encoding="utf-8") + "</script>"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("film", help="film script (.js)")
    ap.add_argument("-o", "--out", required=True, help="output .html")
    ap.add_argument("--title", help="page title (defaults to Film.config title)")
    ap.add_argument("--no-embed-fonts", action="store_true", help="load fonts from Google Fonts at view time instead")
    a = ap.parse_args()

    film = pathlib.Path(a.film)
    src = film.read_text(encoding="utf-8")
    title = a.title
    if not title:
        m = re.search(r"title\s*:\s*(['\"])(.*?)\1", src)
        title = m.group(2) if m else "Film"
    fams = font_families(src)
    src = embed_media(src, film.resolve().parent)
    # A literal </script> inside the film would end the inline script early.
    src = re.sub(r"</(script)", r"<\\/\1", src, flags=re.I)

    page = PLAYER.read_text(encoding="utf-8")
    if "/*__FILM__*/" not in page:
        print("player.html is missing the /*__FILM__*/ marker", file=sys.stderr)
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
    page = page.replace("/*__FILM__*/", src, 1).replace("__TITLE__", html.escape(title), 1)

    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"built {out} ({kb:.0f} KB{', fonts embedded' if fonts else ''})")
    if kb > 15000:
        print("warning: over 15 MB; a hosted page may refuse it. Shrink the audio (ffmpeg -ac 1 -b:a 48k) "
              "or split the film into chapter files.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

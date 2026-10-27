#!/usr/bin/env python3
"""Fetch a real logo from the internet when the bundled library has none, and cache it for every later build.

    python fetch_logo.py "Hashicorp Vault"                 # search the sources below, cache the best, preview all
    python fetch_logo.py "Acme Pay" --domain acmepay.com   # also try the vendor's own site (its SVG / touch icon)
    python fetch_logo.py "Acme Pay" --url https://acmepay.com/press/logo-mark.svg   # a file you found (press kit)
    python fetch_logo.py "Hashicorp Vault" --pick 3        # keep candidate 3 instead (numbers from the preview)
    python fetch_logo.py --list                            # what is cached

Run `icons.py` first: use this only for brands the bundled library does not have. Sources, in order of preference:
  1. CNCF artwork                  official colour icons of every CNCF project (Argo, Flux, OPA, KEDA, cert-manager…)
  2. gilbarbara/logos, latest      full-colour marks, CC0 (the same set as the bundled logo/ icons, newer)
  3. Devicon                       full-colour developer tool and language logos, MIT
  4. Simple Icons                  single-colour marks in the brand's colour, CC0
  5. GitHub organisation avatar    when the catalogues have nothing; often the brand's own mark (check: anyone can name an org)
  6. Wikimedia Commons             logo files with their licence noted; only when nothing else matched (broad search)
  +  --domain / --url              the vendor's own files, tried first (its header logo, SVG icon, touch icon)

The chosen logo is cleaned (no scripts, event handlers, external references), saved to the cache
(~/.motion-diagrams/icons, or $MOTION_DIAGRAMS_ICONS) with its source and licence, and gets the id web/<slug>
for Diagram.node({icon}). build.py embeds it like any bundled icon, so outputs stay self-contained.
ALWAYS look at the preview it writes before using the id: confirm it is the brand's real, current mark.
Logos remain their owners' trademarks; use them unaltered, only for that brand's product.
"""
import argparse
import base64
import datetime
import hashlib
import io
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

CACHE = pathlib.Path(os.environ.get("MOTION_DIAGRAMS_ICONS") or pathlib.Path.home() / ".motion-diagrams" / "icons")
UA = "motion-diagrams/1.1 (logo fetch for architecture diagrams; https://github.com/somasuraj/motion-skills)"
MAX = 600_000


def get(url, timeout=12, limit=MAX):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/svg+xml,image/png,image/*;q=0.8,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if r.status != 200:
            return None, None
        data = r.read(limit + 1)
        return (None, None) if len(data) > limit else (data, r.headers.get("Content-Type", ""))


def slugs(name, partial=False):
    """The full name as catalogues spell it ("grafana-loki", "grafanaloki"); partial=True: the last word alone
    ("Hashicorp Vault" -> vault). Never the first word: it is usually the parent brand (Grafana, Hashicorp)."""
    w = [x for x in re.split(r"[^a-z0-9]+", name.lower()) if x]
    out = ([w[-1]] if len(w) > 1 else []) if partial else ["-".join(w), "".join(w)]
    return list(dict.fromkeys(s for s in out if s))


# ---------- cleaning ----------
SVG_NS = "http://www.w3.org/2000/svg"
BAD_TAGS = {"script", "foreignObject", "iframe", "object", "embed", "audio", "video", "animate", "set", "animateMotion", "animateTransform"}


def clean_svg(data):
    """Parse, strip anything active or external, ensure a viewBox. Returns (bytes, aspect) or raises ValueError."""
    txt = data.decode("utf-8", "replace")
    if "<!ENTITY" in txt or "<!DOCTYPE" in txt and "[" in txt.split("<!DOCTYPE", 1)[1].split(">", 1)[0]:
        raise ValueError("SVG declares entities")
    txt = re.sub(r"<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--.*?-->", "", txt, flags=re.S)
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    root = ET.fromstring(txt)
    if root.tag.split("}")[-1] != "svg":
        raise ValueError("not an SVG")
    for parent in list(root.iter()):
        for ch in list(parent):
            if ch.tag.split("}")[-1] in BAD_TAGS:
                parent.remove(ch)
    for el in root.iter():
        for k in list(el.attrib):
            v = el.attrib[k]; kl = k.split("}")[-1].lower()
            if kl.startswith("on") or (kl == "href" and not v.startswith(("#", "data:image/"))) or "javascript:" in v.lower():
                del el.attrib[k]
            elif kl == "style" and re.search(r"url\((?!#)|@import|expression", v, re.I):
                del el.attrib[k]
    for st in root.iter(f"{{{SVG_NS}}}style"):
        if st.text and re.search(r"@import|url\((?!#)", st.text):
            st.text = re.sub(r"@import[^;]*;|url\((?!#)[^)]*\)", "", st.text)

    def num(v):
        m = re.match(r"\s*([\d.]+)", v or ""); return float(m.group(1)) if m else None
    vb = root.get("viewBox")
    if vb:
        p = [float(x) for x in re.split(r"[\s,]+", vb.strip())]
        w, h = p[2], p[3]
    else:
        w, h = num(root.get("width")), num(root.get("height"))
        if not w or not h:
            raise ValueError("SVG has no size")
        root.set("viewBox", f"0 0 {w:g} {h:g}")
    if w <= 0 or h <= 0:
        raise ValueError("SVG has no size")
    out = ET.tostring(root, encoding="unicode")
    if not re.search(r"<(path|rect|circle|ellipse|polygon|polyline|line|image|text|use)\b", out):
        raise ValueError("SVG draws nothing")
    return out.encode("utf-8"), w / h


def clean_png(data):
    from PIL import Image  # type: ignore
    im = Image.open(io.BytesIO(data)); im.load()
    if min(im.size) < 64:
        raise ValueError(f"raster too small ({im.size[0]}x{im.size[1]}); look for an SVG")
    im = im.convert("RGBA")
    if max(im.size) > 512:
        im.thumbnail((512, 512))
    b = io.BytesIO(); im.save(b, "PNG", optimize=True)
    return b.getvalue(), im.size[0] / im.size[1]


def candidate(data, ctype, url, source, licence):
    try:
        if data[:8] == b"\x89PNG\r\n\x1a\n" or "png" in (ctype or "") or data[:3] == b"\xff\xd8\xff":
            body, ar = clean_png(data); fmt = "png"
        else:
            body, ar = clean_svg(data); fmt = "svg"
    except Exception as e:  # noqa: BLE001 - any parse failure just drops the candidate
        return None, f"{source}: {url}: {e}"
    return {"source": source, "url": url, "licence": licence, "fmt": fmt, "data": body, "ar": round(ar, 2)}, None


# ---------- sources ----------
CNCF_TREE = "https://api.github.com/repos/cncf/artwork/git/trees/main?recursive=1"


def cncf_icons():
    """{project folder: colour icon path} from github.com/cncf/artwork, listed once a week into the cache."""
    f = CACHE / "cncf-artwork.json"
    if f.exists() and datetime.date.today().toordinal() - datetime.date.fromtimestamp(f.stat().st_mtime).toordinal() < 7:
        return json.loads(f.read_text(encoding="utf-8"))
    data, _ = get(CNCF_TREE, timeout=30, limit=20_000_000)   # the whole repo tree: a few MB of JSON
    paths = {}
    for x in json.loads(data or b"{}").get("tree", []):
        p = x["path"].split("/")
        if len(p) == 5 and p[0] == "projects" and p[2:4] == ["icon", "color"] and p[4].endswith(".svg"):
            paths[p[1]] = x["path"]
    if paths:
        CACHE.mkdir(parents=True, exist_ok=True); f.write_text(json.dumps(paths), encoding="utf-8")
    return paths


def from_cncf(name, partial=False):
    # official colour icons of every CNCF project (Argo, Flux, cert-manager, OPA, KEDA, Velero…)
    try:
        icons = cncf_icons()
    except Exception:  # noqa: BLE001 - offline or rate limited: other sources still run
        return
    want = {re.sub(r"[^a-z0-9]", "", s) for s in slugs(name, partial)}
    for proj, path in icons.items():
        stem = path.rsplit("/", 1)[1][: -len("-icon-color.svg")]
        p, st = re.sub(r"[^a-z0-9]", "", proj), re.sub(r"[^a-z0-9]", "", stem)
        if p in want or st in want or any(len(w) >= 6 and p.startswith(w) for w in want):   # external-secrets(-operator)
            yield f"https://cdn.jsdelivr.net/gh/cncf/artwork@main/{path}", "CNCF artwork", "CNCF project artwork (github.com/cncf/artwork); mark: the project's trademark"
            return


def from_gilbarbara(name, partial=False):
    for s in slugs(name, partial):
        for f in (f"{s}-icon", s):
            yield f"https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/{f}.svg", "gilbarbara/logos", "CC0 1.0 (mark: owner's trademark)"


def from_devicon(name, partial=False):
    for s in slugs(name, partial):
        for v in ("original", "plain"):
            yield f"https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/{s}/{s}-{v}.svg", "Devicon", "MIT (mark: owner's trademark)"


def from_simpleicons(name, partial=False):
    for s in slugs(name, partial):
        yield f"https://cdn.simpleicons.org/{s}", "Simple Icons", "CC0 1.0 (mark: owner's trademark)"


def from_wikimedia(name, log):
    api = "https://commons.wikimedia.org/w/api.php?"
    q = {"action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 6,
         "gsrsearch": f'{name} logo filemime:image/svg+xml', "prop": "imageinfo", "iiprop": "url|extmetadata"}
    try:
        data, _ = get(api + urllib.parse.urlencode(q))
        pages = sorted(json.loads(data or b"{}").get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    except Exception as e:  # noqa: BLE001
        log.append(f"Wikimedia Commons: {e}"); return
    key = [w for w in re.split(r"[^a-z0-9]+", name.lower()) if w]
    for p in pages:
        title = p.get("title", "").lower()
        if not all(w in title for w in key):
            continue
        ii = (p.get("imageinfo") or [{}])[0]
        lic = ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "see file page")
        if ii.get("url"):
            yield ii["url"], "Wikimedia Commons", f"{lic} ({ii.get('descriptionurl', '')})"


def from_github(name):
    # the brand's GitHub organisation avatar is often its official square mark; only kept if it is an organisation
    for s in slugs(name):
        try:
            data, _ = get(f"https://api.github.com/users/{s}")
            u = json.loads(data or b"{}")
        except Exception:  # noqa: BLE001
            continue
        if u.get("type") == "Organization" and u.get("avatar_url"):
            yield u["avatar_url"] + "&s=256", "GitHub organisation avatar", f"the organisation's own avatar (github.com/{s})"
            return


def from_domain(domain, log):
    base = domain if domain.startswith("http") else "https://" + domain
    found = [urllib.parse.urljoin(base, "/favicon.svg"), urllib.parse.urljoin(base, "/apple-touch-icon.png")]
    try:
        html, _ = get(base)
        html = (html or b"").decode("utf-8", "replace")
        # the site's own header logo: <img alt="<brand> logo" src=…>, light-mode version first
        def alt(t):
            m = re.search(r"""\balt=["']([^"']*)""", t, re.I)
            return (m.group(1) if m else "").lower()
        key = re.sub(r"^www\.|\..*$", "", urllib.parse.urlparse(base).netloc.lower())
        imgs = [t for t in re.findall(r"<img\s[^>]*>", html, re.I)
                if key in alt(t) and "logo" in alt(t)]
        for tag in sorted(imgs, key=lambda t: "dark:block" in t or "-dark" in t or "white" in t.lower())[:2]:
            m = re.search(r"""\ssrc=["']([^"']+)""", tag)
            if m:
                found.insert(0, urllib.parse.urljoin(base, m.group(1).replace("&amp;", "&")))
        links = re.findall(r"<link\b[^>]*>", html, re.I)
        def rank(tag):
            t = tag.lower()
            return 0 if ".svg" in t or "image/svg" in t else 1 if "apple-touch-icon" in t else 2 if "mask-icon" in t else 3
        for tag in sorted(links, key=rank):
            if re.search(r'rel=["\'][^"\']*(icon|apple-touch-icon|mask-icon)', tag, re.I):
                m = re.search(r'href=["\']([^"\']+)', tag)
                if m:
                    found.append(urllib.parse.urljoin(base, m.group(1)))
        m = re.search(r'<meta[^>]+property=["\']og:logo["\'][^>]+content=["\']([^"\']+)', html, re.I)
        if m:
            found.insert(0, urllib.parse.urljoin(base, m.group(1)))
    except Exception as e:  # noqa: BLE001
        log.append(f"{base}: {e}")
    for u in dict.fromkeys(found):
        yield u, "vendor site", f"the vendor's own file ({base})"


def search(name, domain=None, url=None, limit=8):
    log, cands, seen = [], [], set()

    def take(gen):
        for u, src, lic in gen:
            if len(cands) >= limit:
                return
            try:
                data, ctype = get(u)
            except Exception as e:  # noqa: BLE001 - 404s and timeouts are normal here
                log.append(f"{src}: {u}: {getattr(e, 'code', e)}"); continue
            if not data:
                continue
            h = hashlib.sha256(data).hexdigest()
            if h in seen:
                continue
            seen.add(h)
            c, err = candidate(data, ctype, u, src, lic)
            if c:
                cands.append(c)
                if src in ("CNCF artwork", "gilbarbara/logos", "Devicon", "Simple Icons"):
                    return            # one per catalogue: its first slug match is the brand's own entry
            elif err:
                log.append(err)
    if url:
        take(iter([(url, "given URL", "as published at the URL; check the owner's brand terms")]))
    if domain:
        take(from_domain(domain, log))
    take(from_cncf(name)); take(from_gilbarbara(name)); take(from_devicon(name)); take(from_simpleicons(name))
    if not any(c["source"] not in ("vendor site", "given URL") for c in cands):   # nothing under the full name: try the
        for gen in (from_cncf, from_gilbarbara, from_devicon, from_simpleicons):  # product word alone ("Vault")
            take(gen(name, partial=True))
    if not any(c["source"] not in ("vendor site", "given URL") for c in cands):   # an organisation by that name may not
        take(from_github(name))                                                   # be the brand: after the catalogues
    if not cands:                 # Commons search is broad ("Port" finds every port authority): last resort only
        take(from_wikimedia(name, log))
    return cands, log


# ---------- cache ----------
def load_index():
    f = CACHE / "index.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def save(name, c, slug):
    CACHE.mkdir(parents=True, exist_ok=True)
    idx = [e for e in load_index() if e["id"] != f"web/{slug}"]
    fn = f"{slug}.{c['fmt']}"
    (CACHE / fn).write_bytes(c["data"])
    e = {"id": f"web/{slug}", "name": name, "vendor": "web", "cat": "Fetched logos", "kind": "logo", "file": fn,
         "source": c["source"], "url": c["url"], "licence": c["licence"], "fetched": datetime.date.today().isoformat()}
    if c["ar"] > 1.5 or c["ar"] < 0.67:
        e["ar"] = c["ar"]
    idx.append(e)
    (CACHE / "index.json").write_text(json.dumps(idx, indent=1), encoding="utf-8")
    return e


def wide(c):
    return c["ar"] > 1.5 or c["ar"] < 0.67


def preview(name, cands, out, pick):
    """A sheet of every candidate on light and dark, numbered, so the right mark can be picked by eye."""
    cells = ""
    for i, c in enumerate(cands, 1):
        uri = f"data:image/{'svg+xml' if c['fmt'] == 'svg' else 'png'};base64," + base64.b64encode(c["data"]).decode()
        used = " (used)" if i == pick else ""
        cells += (f'<div class="c{" u" if used else ""}"><div class="n">{i}{used}</div><div class="t"><img src="{uri}"></div>'
                  f'<div class="t d"><img src="{uri}"></div><div class="s">{c["source"]}<br>{c["fmt"]} · {c["ar"]}:1'
                  f'{" · wordmark" if wide(c) else ""}</div></div>')
    html = ('<html><body style="margin:0;font:13px system-ui;background:#f4f4f5"><div style="padding:14px 18px;font-weight:600">'
            + name + ' — logo candidates</div><div style="display:flex;flex-wrap:wrap;gap:12px;padding:0 18px 18px">'
            + cells + '</div><style>.c{width:250px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px}.u{border:2px solid #2563eb}'
            '.n{font-weight:700}.t{height:90px;display:flex;align-items:center;justify-content:center;margin:6px 0;background:#fff;border:1px solid #eee}'
            '.d{background:#1f2328}.t img{max-height:72px;max-width:220px}.s{color:#555;font-size:11px}</style></body></html>')
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 300})
            pg.set_content(html); pg.wait_for_timeout(300); pg.screenshot(path=str(out), full_page=True); b.close()
        return out
    except Exception as e:  # noqa: BLE001
        h = out.with_suffix(".html"); h.write_text(html, encoding="utf-8")
        print(f"  (no Playwright for a PNG preview: {e}; open {h} instead)")
        return h


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?", help="the brand or product, as people write it")
    ap.add_argument("--domain", help="the vendor's website, to try its own logo files")
    ap.add_argument("--url", help="a logo file you found (press kit, brand page)")
    ap.add_argument("--slug", help="id to save as (web/<slug>); default from the name")
    ap.add_argument("--pick", type=int, help="which candidate to keep (from the preview); default: the first square mark")
    ap.add_argument("--list", action="store_true", help="list cached logos")
    a = ap.parse_args()
    if a.list or not a.name:
        for e in load_index():
            print(f"  {e['id']:<34} {e['name']:<28} {e['source']} · {e['fetched']}")
        print(f"cache: {CACHE}"); return 0
    slug = a.slug or slugs(a.name)[0]
    print(f'searching for "{a.name}"…')
    cands, log = search(a.name, a.domain, a.url)
    if not cands:
        print("no logo found online. Try --domain <vendor site> or --url <logo file>; otherwise use a generic/ glyph and say so.")
        for l in log[-6:]:
            print("  ·", l)
        return 1
    for i, c in enumerate(cands, 1):
        print(f"  {i}. {c['source']:<18} {c['fmt']}  {c['ar']}:1  {c['url']}")
    if a.pick:
        pick = min(max(1, a.pick), len(cands))
    else:                                         # a square mark fits a node; a wordmark only when there is nothing else
        pick = next((i for i, c in enumerate(cands, 1) if not wide(c)), 1)
    e = save(a.name, cands[pick - 1], slug)
    (CACHE / "previews").mkdir(parents=True, exist_ok=True)
    pv = preview(a.name, cands, CACHE / "previews" / f"{slug}.png", pick)
    print(f"saved {e['id']}  (candidate {pick}, {e['source']}; licence: {e['licence']})")
    print(f"preview: {pv}  <- look at it: is candidate {pick} the brand's real, current mark? If not, rerun with --pick N.")
    if e.get("ar"):
        print("note: this is a wide wordmark; it fits a node poorly. Prefer a square mark if a candidate has one.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

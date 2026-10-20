#!/usr/bin/env python3
"""Find and download openly licensed images for a deck, with their credits.

    python fetch_image.py "james webb mirror" --list                # candidates, numbered, with licence and size
    python fetch_image.py "james webb mirror" --preview             # the same, plus a contact sheet to look at (saves nothing)
    python fetch_image.py "james webb mirror" --take 2 --name mirror --out images/
    python fetch_image.py --url <Commons file page or Openverse id> --name mirror --out images/

Sources: Wikimedia Commons and Openverse (Creative Commons search). No key needed (Openverse
allows about 20 searches a minute, 200 a day). Only images whose licence allows reuse are offered:
public domain, CC0, CC BY and CC BY-SA (any version). NonCommercial, NoDerivatives, "all rights
reserved" and anything without a readable licence are refused.

Each download is checked to really be an image (by its bytes, not its name), resized to at most
--width pixels wide (1600 by default) and saved as JPEG (PNG if it has transparency) in --out. Its
title, author, licence, licence link and source page are added to <out>/credits.json, which the deck
reads with Deck.credits('images/credits.json') to credit it on the slide and on a credits slide.
"""
import argparse
import html
import io
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

UA = "motion-slides/2.0 (deck image fetcher; https://claude.ai)"
ALLOW = {"pd", "pdm", "cc0", "by", "by-sa"}


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8"))


def plain(s):
    """HTML (Commons puts links in Artist/Credit) to plain text."""
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def norm_license(short, code=""):
    """Map a licence name to one of: pd, cc0, by, by-sa, or '' (refused)."""
    s = (short or code or "").lower().replace("_", "-").strip()
    if not s:
        return "", ""
    if "public domain" in s or s in ("pd", "pdm") or s.startswith("pd-"):
        return "pd", ""
    if "cc0" in s or "cc-zero" in s:
        return "cc0", ""
    if "-nc" in s or " nc" in s or "noncommercial" in s or "-nd" in s or " nd" in s or "noderiv" in s:
        return "", ""
    m = re.search(r"by[- ]sa[- ]?(\d(\.\d)?)?", s)
    if m:
        return "by-sa", m.group(1) or ""
    m = re.search(r"by[- ]?(\d(\.\d)?)?", s)
    if m and ("cc" in s or s.startswith("by")):
        return "by", m.group(1) or ""
    return "", ""


def license_url(kind, ver):
    if kind == "cc0":
        return "https://creativecommons.org/publicdomain/zero/1.0/"
    if kind in ("by", "by-sa"):
        return f"https://creativecommons.org/licenses/{kind}/{ver or '4.0'}/"
    return ""


def label(kind, ver):
    return {"pd": "Public domain", "cc0": "CC0"}.get(kind) or ("CC " + kind.upper().replace("-", "-") + (" " + ver if ver else ""))


def search_commons(q, n):
    url = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&format=json"
           "&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1920&gsrlimit=" + str(n) +
           "&gsrsearch=" + urllib.parse.quote(q + " filetype:bitmap"))
    out = []
    for p in sorted(get(url).get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0)):
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        v = lambda k: (m.get(k) or {}).get("value", "")
        kind, ver = norm_license(v("LicenseShortName"), v("License"))
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        out.append({"source": "Wikimedia Commons", "title": plain(v("ObjectName")) or p["title"].replace("File:", ""),
                    "author": plain(v("Artist")) or plain(v("Credit")) or "Unknown", "license": kind, "license_version": ver,
                    "license_url": v("LicenseUrl") or license_url(kind, ver), "source_url": ii.get("descriptionurl", ""),
                    "url": ii.get("thumburl") or ii.get("url"), "width": ii.get("width"), "height": ii.get("height"), "id": "commons:" + p["title"]})
    return out


def search_openverse(q, n):
    url = ("https://api.openverse.org/v1/images/?license=cc0,pdm,by,by-sa&page_size=" + str(n) + "&q=" + urllib.parse.quote(q))
    out = []
    for r in get(url).get("results", []):
        kind, ver = norm_license(r.get("license", ""))
        ver = r.get("license_version") or ver
        out.append({"source": "Openverse / " + (r.get("source") or r.get("provider") or ""), "title": r.get("title") or "Untitled",
                    "author": r.get("creator") or "Unknown", "license": kind, "license_version": ver if kind in ("by", "by-sa") else "",
                    "license_url": r.get("license_url") or license_url(kind, ver), "source_url": r.get("foreign_landing_url", ""),
                    "url": r.get("url"), "width": r.get("width"), "height": r.get("height"), "id": "openverse:" + r.get("id", "")})
    return out


def clean_title(t):
    return re.sub(r"\s*\(\d{8,}\)\s*$", "", t or "").strip()


def candidates(q, n, out):
    """n results in total (Commons first, then Openverse); the list is remembered so --take picks from it exactly."""
    cache = out / ".last-search.json"
    if cache.exists():
        try:
            c = json.loads(cache.read_text(encoding="utf-8"))
            if c.get("q") == q and c.get("n") == n:
                return c["results"]
        except Exception:  # noqa: BLE001
            pass
    found = []
    for fn in (search_commons, search_openverse):
        try:
            found += fn(q, n)
        except Exception as e:  # noqa: BLE001
            print(f"note: {fn.__name__.replace('search_', '')} search failed ({e})", file=sys.stderr)
    res = [dict(c, title=clean_title(c["title"])) for c in found if c["license"] in ALLOW and c["url"]][:n]
    out.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"q": q, "n": n, "results": res}, ensure_ascii=False), encoding="utf-8")
    return res


def sniff(data):
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return ""


def download(c, name, out, width):
    from PIL import Image  # type: ignore
    data = get(c["url"], binary=True)
    if not sniff(data):
        sys.exit(f"refused: {c['url']} is not a JPEG, PNG or WebP image")
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    out.mkdir(parents=True, exist_ok=True)
    f = out / (re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-") + (".png" if alpha else ".jpg"))
    if alpha:
        im.save(f, optimize=True)
    else:
        im.convert("RGB").save(f, quality=82, optimize=True, progressive=True)
    credits_path = out / "credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else []
    credits = [x for x in credits if x.get("file") != f.name]
    credits.append({"file": f.name, "title": clean_title(c["title"]), "author": c["author"], "license": label(c["license"], c["license_version"]),
                    "license_url": c["license_url"], "source": c["source"], "source_url": c["source_url"]})
    credits_path.write_text(json.dumps(credits, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"saved {f} ({f.stat().st_size // 1024} KB, {im.width}x{im.height}) · {label(c['license'], c['license_version'])} · {c['author']}")
    print(f"credit added to {credits_path}")


def preview(cs):
    """Small copies of every candidate on one numbered sheet, in a temp folder; nothing is recorded."""
    import tempfile
    from PIL import Image, ImageDraw  # type: ignore
    tw, th, cols = 320, 220, 4
    rows = (len(cs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + 8) + 8), (90, 90, 90))
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(cs):
        x, y = 8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 8)
        try:
            data = get(c["url"], binary=True)
            if sniff(data):
                im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((tw, th)); sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
        except Exception:  # noqa: BLE001
            pass
        d.rectangle([x, y, x + 34, y + 22], fill=(0, 0, 0)); d.text((x + 6, y + 5), str(i + 1), fill=(255, 255, 255))
    f = pathlib.Path(tempfile.mkdtemp(prefix="img-preview-")) / "candidates.png"
    sheet.save(f)
    return f


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("query", nargs="?")
    ap.add_argument("--list", action="store_true", help="show candidates and stop")
    ap.add_argument("--take", type=int, help="download candidate number N from --list")
    ap.add_argument("--name", help="file name for the download (no extension)")
    ap.add_argument("--out", default="images", help="folder for images and credits.json (default: images)")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("-n", type=int, default=10, help="how many candidates in total")
    ap.add_argument("--preview", action="store_true", help="list, and make a contact sheet of the candidates (nothing saved to credits)")
    a = ap.parse_args()
    if not a.query:
        ap.error("give a search query")
    cs = candidates(a.query, a.n, pathlib.Path(a.out))
    if not cs:
        sys.exit("no openly licensed images found; try other words, or draw it instead")
    if a.list or a.preview or not a.take:
        for i, c in enumerate(cs, 1):
            print(f"{i:2d}. {c['title'][:80]}  ·  {label(c['license'], c['license_version'])}  ·  {c['author'][:70]}  ·  {c['width']}x{c['height']}  ·  {c['source']}\n    {c['source_url']}")
        if a.preview:
            print("\ncontact sheet:", preview(cs))
        print("\nDownload one with:  --take N --name short-name   (same query and -n)")
        return 0
    if not 1 <= a.take <= len(cs):
        sys.exit(f"--take must be 1..{len(cs)}")
    download(cs[a.take - 1], a.name or re.sub(r"\W+", "-", a.query), pathlib.Path(a.out), a.width)
    return 0


if __name__ == "__main__":
    sys.exit(main())

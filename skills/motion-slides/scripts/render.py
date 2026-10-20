#!/usr/bin/env python3
"""Check a built deck, or render stills of its steps.

    python render.py deck.html --check
    python render.py deck.html --verify [--out dir]     # everything, before delivering
    python render.py deck.html --stills all | 1,3,5 | 4@0.5 | 6+1.2 [--sheet] [--out dir]

Steps are numbered from 1, as the deck's own counter shows them. "4@0.5" is the
camera half-way into step 4 (use it to catch clipping mid-zoom); "6+1.2" is step 6
with the camera settled and its frame's animation 1.2 s in (from arrival, or from
the click for a beat); "all" is every step, each at rest. Needs Python playwright with a Chromium, and ffmpeg for --sheet.
"""
import argparse
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile


try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace"); sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

GL_NOISE = ("software WebGL", "GL Driver Message", "GPU stall")   # SwiftShader chatter, not deck problems


def launch(pw):
    exe = os.environ.get("CHROMIUM_PATH")
    args = []   # headless Chromium falls back to software WebGL by itself; forcing SwiftShader leaves stale tiles in screenshots
    try:
        return pw.chromium.launch(executable_path=exe, args=args) if exe else pw.chromium.launch(args=args)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"Could not start Chromium ({e}).\nInstall one with:  python -m playwright install chromium")


def open_deck(pw, path, query=""):
    browser = launch(pw)
    errors = []
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") and not any(n in m.text for n in GL_NOISE) else None)
    page.on("pageerror", lambda e: errors.append(f"page error: {e}"))
    page.goto(pathlib.Path(path).resolve().as_uri() + "?render=1" + query)
    try:
        page.wait_for_function("window.__deckReady === true || !!window.__deckError", timeout=30000)
    except Exception:  # noqa: BLE001
        print("The deck never became ready. Errors so far:", *errors, sep="\n  ", file=sys.stderr)
        sys.exit(1)
    err = page.evaluate("window.__deckError || null")
    if err:
        print("The deck failed to build:", err, *errors, sep="\n  ", file=sys.stderr)
        sys.exit(1)
    info = page.evaluate("({title: __deck.title, w: __deck.width, h: __deck.height, steps: __deck.steps})")
    page.set_viewport_size({"width": info["w"], "height": info["h"]})
    return browser, page, info, errors


def shot(page, info):
    page.evaluate("__deck.settled ? __deck.settled() : true")   # embedded videos land on the right frame first
    return page.screenshot(clip={"x": 0, "y": 0, "width": info["w"], "height": info["h"]}, animations="disabled")


def differs(a, b, share=.001):
    """True when two screenshots differ by more than text antialiasing noise (0.1 % of pixels by default)."""
    try:
        from PIL import Image, ImageChops  # type: ignore
        import io
    except ImportError:
        return True
    d = ImageChops.difference(Image.open(io.BytesIO(a)).convert("L"), Image.open(io.BytesIO(b)).convert("L"))
    hist = d.histogram()
    changed = sum(hist[24:])   # pixels that changed visibly, not by a shade
    return changed > share * d.size[0] * d.size[1]


def cmd_check(page, info, errors):
    steps = info["steps"]
    frames = sorted({s["id"] for s in steps if s["id"]})
    hops = page.evaluate("__deck.hops()")
    canvas = page.evaluate("Deck.cfg.style !== 'slides'")
    print(f"{info['title']}: {len(steps)} steps, {len(frames)} frames" + (f", camera hops {min(hops[1:] or [0]):.2f}–{max(hops or [0]):.2f} s" if canvas else ""))
    print("steps:", " · ".join(f"{s['i'] + 1} {s['label']}" for s in steps))
    problems = []
    for s in steps:
        page.evaluate(f"__deck.go({s['i']})")
    bad = page.evaluate("__deck.failed()")
    if bad:
        problems.append("animated frames threw (see console errors): " + ", ".join(bad))
    for s in steps:   # every animated step mid-way, so a scene that only breaks while moving is caught
        page.evaluate(f"__deck.play({s['i']}, 0.6)")
    bad = page.evaluate("__deck.failed()")
    if bad and not any("animated frames threw" in p for p in problems):
        problems.append("animated frames threw mid-animation: " + ", ".join(bad))
    over = page.evaluate("__deck.overflow()")
    if over:
        problems.append("text overflows its frame in: " + ", ".join(over) + " (cut words, split the frame, or make it larger)")
    k = len(steps) // 2
    page.evaluate(f"__deck.go({k})"); a = shot(page, info)
    page.evaluate("__deck.go(0)"); shot(page, info)
    page.evaluate(f"__deck.go({k})"); b = shot(page, info)
    if hashlib.md5(a).digest() != hashlib.md5(b).digest() and differs(a, b):
        problems.append(f"not deterministic: step {k + 1} looked different the second time")
    first = shot(page, info)
    try:
        from PIL import Image  # type: ignore
        import io
        im = Image.open(io.BytesIO(first)).convert("RGB").resize((96, 54))
        if len(im.getcolors(64) or [0] * 64) < 4:
            problems.append("step 1 is (nearly) blank")
    except ImportError:
        pass
    on_path = {s["id"] for s in steps}
    missing = page.evaluate("Deck.frames.map(f => f.id)")
    off = [m for m in missing if m not in on_path]
    if off:
        print("note: frames not on the path (only seen in the overview):", ", ".join(off))
    for e in dict.fromkeys(errors):
        (print if "Failed to load resource" in e else problems.append)(("note: " + e) if "Failed to load resource" in e else e)
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        return 1
    print("OK")
    return 0


def cmd_stills(page, info, spec, out, sheet):
    n = len(info["steps"])
    toks = [x.strip() for x in spec.split(",") if x.strip()]
    if toks == ["all"]:
        toks = [str(i + 1) for i in range(n)]
    out = pathlib.Path(out or tempfile.mkdtemp(prefix="steps-"))
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for tok in toks:
        if "+" in tok:
            i, t = tok.split("+")
            page.evaluate(f"__deck.play({int(i) - 1}, {float(t)})")
            name = f"step_{int(i):03d}_t{float(t):05.2f}.png"
        elif "@" in tok:
            i, p = tok.split("@")
            page.evaluate(f"__deck.at({int(i) - 1}, {float(p)})")
            name = f"step_{int(i):03d}_at_{float(p):.2f}.png"
        else:
            page.evaluate(f"__deck.go({int(tok) - 1})")
            name = f"step_{int(tok):03d}.png"
        f = out / name
        f.write_bytes(shot(page, info))
        files.append(f)
        print(f)
    if sheet and files:
        if not shutil.which("ffmpeg"):
            print("ffmpeg not found; skipping --sheet", file=sys.stderr)
        else:
            cols = min(4, len(files))
            rows = (len(files) + cols - 1) // cols
            lst = out / "list.txt"
            lst.write_text("".join(f"file '{p.name}'\n" for p in files))
            sp = out / "sheet.png"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                            "-vf", f"scale=640:-2,tile={cols}x{rows}:padding=6:color=gray", "-frames:v", "1", str(sp)], check=True)
            lst.unlink()
            print(sp)
    return 0


def tile(files, dest, cols=4, width=480, labels=None):
    """A contact sheet of the given PNGs, each tile captioned (PIL; no ffmpeg needed)."""
    from PIL import Image, ImageDraw  # type: ignore
    ims = [Image.open(f).convert("RGB") for f in files]
    if not ims:
        return None
    w = width; h = round(ims[0].height * w / ims[0].width); pad = 6
    cols = min(cols, len(ims)); rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad) + pad), (128, 128, 128))
    d = ImageDraw.Draw(sheet)
    for n, (f, im) in enumerate(zip(files, ims)):
        x, y = pad + (n % cols) * (w + pad), pad + (n // cols) * (h + pad)
        sheet.paste(im.resize((w, h)), (x, y))
        cap = (labels or {}).get(f)
        if cap:
            tw = d.textlength(cap); d.rectangle([x, y, x + tw + 10, y + 16], fill=(0, 0, 0)); d.text((x + 5, y + 2), cap, fill=(255, 255, 255))
    sheet.save(dest)
    return dest


def cmd_verify(pw, path, out):
    """Everything a deck must pass before it is handed over: the static check, every step at rest and
    mid-animation, nothing off-slide, every part actually moving, and a live run as a presenter would
    do it (default motion and reduced motion), plus the slides panel, Download and Print."""
    import io
    out = pathlib.Path(out or (pathlib.Path(path).resolve().parent / "verify"))
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    problems, notes = [], []
    # ---- 1. render mode: static check, stills, content checks (once per audience level, if the deck has levels)
    def stills_pass(query, o, tag):
        found, nts = [], []
        browser, page, info, errors = open_deck(pw, path, query)
        try:
            print("1. static check")
            if cmd_check(page, info, errors):
                found.append("--check failed (see above)")
            steps = info["steps"]
            parts = page.evaluate("__deck.parts()")
            slides = page.evaluate("__deck.slides()")
            print(f"2. stills: {len(slides)} slides, {len(steps)} steps")
            from PIL import Image  # type: ignore
            per_slide, rests, labels = {}, [], {}
            for s in steps:
                i, pt = s["i"], parts[s["i"]]
                print(f"   step {i + 1}/{len(steps)}  {s['label']}", flush=True)
                if pt.get("anim") and pt["len"] <= 0 and not pt["loop"]:   # live, a part of length 0 jumps straight to its end
                    found.append(f"step {i + 1} ({s['label']}): its animation has no timed part (give the anim a dur or stops), so live it shows its end state at once")
                if pt["has"] and pt["len"] > 0:      # does this part change anything? start vs end
                    page.evaluate(f"__deck.play({i}, 0.02)"); a = shot(page, info)
                    page.evaluate(f"__deck.play({i}, {pt['len'] / 2})"); m = shot(page, info)
                    f = o / f"step{i + 1:03d}_mid.png"; f.write_bytes(m); labels[f] = f"step {i + 1} · mid-animation"
                    page.evaluate(f"__deck.go({i})"); b = shot(page, info)
                    if not differs(a, b, share=.0005):
                        found.append(f"step {i + 1} ({s['label']}): its animation part changes nothing")
                    per_slide.setdefault(s["id"], []).append(f)
                page.evaluate(f"__deck.go({i})"); r = shot(page, info)
                f = o / f"step{i + 1:03d}.png"; f.write_bytes(r); labels[f] = f"step {i + 1} · at rest" + (" (slide done)" if i + 1 == len(steps) or steps[i + 1]["id"] != s["id"] else "")
                per_slide.setdefault(s["id"] or "overview", []).append(f); rests.append(f)
                im = Image.open(io.BytesIO(r)).convert("RGB").resize((96, 54))
                if len(im.getcolors(64) or [0] * 64) < 3:
                    found.append(f"step {i + 1} ({s['label']}) is blank")
                off = page.evaluate("__deck.offslide()")
                if off:
                    found.append(f"step {i + 1} ({s['label']}): " + "; ".join(off[:3]))
            for n, sl in enumerate(slides):
                if sl["id"] in per_slide:
                    tile(per_slide[sl["id"]], o / f"slide{n + 1:02d}.png", cols=4, labels=labels)
            last = {s["id"]: s["i"] for s in steps if s["id"]}      # each slide in its finished state
            tile([o / f"step{last[sl['id']] + 1:03d}.png" for sl in slides], o / "all-slides.png", cols=5, width=384,
                 labels={o / f"step{last[sl['id']] + 1:03d}.png": f"slide {n + 1}: {sl['label']}" for n, sl in enumerate(slides)})
            md = page.evaluate("__deck.media()")
            if md["uncredited"]:
                found.append("images without a credit (add them to credits.json via fetch_image.py, or credit them by hand): " + ", ".join(md["uncredited"]))
            for y in md["youtube"]:
                if not y["link"]:
                    found.append(f"YouTube {y['id']}: no 'Watch on YouTube' link")
                if not y["thumb"]:
                    nts.append(f"YouTube {y['id']}: no thumbnail was embedded (built offline?); the slide shows a plain card")
            for it in md["interactive"]:
                if it["failed"]:
                    found.append(f"interactive slide {it['id']}: its init threw (see console errors)")
                elif not it["controls"]:
                    nts.append(f"interactive slide {it['id']}: no buttons or inputs found inside it")
            pages = 0
            page.evaluate("window.print = () => { window.__pages = document.querySelectorAll('#print .pslide').length; }")
        finally:
            browser.close()
        problems.extend((tag + found_x) if tag else found_x for found_x in found)
        notes.extend((tag + n) if tag else n for n in nts)
        return info, steps, slides, parts
    levels, langs, first, first_lang = [], [], None, None
    _b, _p, _i, _e = open_deck(pw, path)
    try:
        levels = _p.evaluate("(window.Deck && Deck.levelList || []).map(l => ({id: l.id, name: l.name || l.id}))")
        first = _p.evaluate("window.Deck && Deck.level")
        langs = _p.evaluate("(window.Deck && Deck.langList || []).map(l => ({id: l.id, name: l.name || l.id}))")
        first_lang = _p.evaluate("window.Deck && Deck.lang")
    finally:
        _b.close()
    if levels:
        print(f"audience levels: {', '.join(l['name'] for l in levels)} (each is checked)")
    if langs:
        print(f"code languages: {', '.join(l['name'] for l in langs)} (each is checked, in every level)")
    info, steps, slides, parts = stills_pass("", out, "")
    # every other level, and every other language in every level: sheets in level-<id>/, lang-<id>/ or level-<id>-<lang>/
    for lv in (levels or [None]):
        for lg in (langs or [None]):
            if (lv is None or lv["id"] == first) and (lg is None or lg["id"] == first_lang):
                continue
            q = (f"&level={lv['id']}" if lv else "") + (f"&lang={lg['id']}" if lg else "")
            other_lv = lv and lv["id"] != first
            other_lg = lg and lg["id"] != first_lang
            name = "-".join(x for x in (f"level-{lv['id']}" if other_lv else "", (f"{lg['id']}" if other_lv else f"lang-{lg['id']}") if other_lg else "") if x)
            tag = " · ".join(x for x in ((f"level {lv['name']}" if lv else ""), (f"{lg['name']}" if lg else "")) if x) + ": "
            o = out / name; o.mkdir(parents=True, exist_ok=True)
            print(f"   {tag[:-2]}")
            stills_pass(q, o, tag)
    # ---- 2. live: present it like a person, in a real browser, with and without reduced motion
    for reduce in (False, True):
        tag = "reduced motion" if reduce else "default motion"
        print(f"{3 + (tag != 'default motion')}. live run ({tag})")
        try:
            b = pw.chromium.launch(channel="msedge")
        except Exception:  # noqa: BLE001
            try:
                b = pw.chromium.launch(channel="chrome")
            except Exception:  # noqa: BLE001
                b = launch(pw); notes.append("live run used bundled Chromium (no Edge or Chrome found)")
        try:
            pg = b.new_page(viewport={"width": 1440, "height": 810}, reduced_motion="reduce" if reduce else "no-preference", accept_downloads=True)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(pathlib.Path(path).resolve().as_uri())
            pg.wait_for_function("window.__deckReady === true", timeout=30000)
            n = len(steps)
            for k in range(1, n):
                before = pg.screenshot() if reduce else None
                pg.keyboard.press("ArrowRight")
                pt = parts[k]
                if pt["has"] and pt["len"] > 0:
                    if reduce:      # quick: did the click change the screen? then finish the part
                        pg.wait_for_timeout(int(min(1200, pt["len"] * 1000 * .8))); after = pg.screenshot()
                        if not differs(before, after, share=.0002):
                            problems.append(f"{tag}: the click to step {k + 1} changed nothing on screen")
                        pg.keyboard.press("Shift+ArrowRight")
                    else:           # watch the whole part play, then expect the ready light
                        try:
                            pg.wait_for_function("(() => { const c = document.getElementById('ready').className; return /ready|done/.test(c); })()", timeout=int((pt["len"] + 4) * 1000))
                        except Exception:  # noqa: BLE001
                            problems.append(f"{tag}: step {k + 1}: the part never finished (ready light stayed on 'playing')")
                else:
                    pg.wait_for_timeout(650)
                st = pg.evaluate("__deck.state()")
                if st["step"] != k:
                    problems.append(f"{tag}: pressed → to reach step {k + 1}, but the deck is on step {st['step'] + 1}")
                    break
            if not reduce:
                th = pg.locator("#side > .th").count()
                if th != len(slides):
                    problems.append(f"slides panel shows {th} thumbnails for {len(slides)} slides")
                elif th > 1:
                    pg.keyboard.press("Home"); pg.wait_for_timeout(500); pg.locator("#side > .th").nth(th - 1).click(); pg.wait_for_timeout(1200)
                    if pg.evaluate("__deck.state()")["step"] != slides[-1]["i"]:
                        problems.append("clicking the last thumbnail did not jump to the last slide")
                try:
                    with pg.expect_download(timeout=15000) as dl:
                        pg.click("#dl")
                    f = pathlib.Path(tempfile.mkdtemp(prefix="deck-dl-")) / dl.value.suggested_filename
                    dl.value.save_as(f)
                    q = b.new_page(viewport={"width": 1280, "height": 720})
                    q.goto(f.resolve().as_uri())
                    q.wait_for_function("window.__deckReady === true", timeout=30000)
                    if len(q.evaluate("__deck.steps")) != n:
                        problems.append("the downloaded file does not present the same deck")
                except Exception as e:  # noqa: BLE001
                    problems.append(f"Download did not work ({type(e).__name__}: {str(e).splitlines()[0][:120]}). "
                                    "Check page errors above; a deck name that hides a browser global (URL, Blob…) can cause it.")
                try:
                    pg.evaluate("window.print = () => { window.__pages = document.querySelectorAll('#print .pslide').length; }")
                    pg.click("#pr")
                    pages = pg.evaluate("window.__pages || 0")
                    if pages != len(slides):
                        problems.append(f"print laid out {pages} pages for {len(slides)} slides")
                except Exception as e:  # noqa: BLE001
                    problems.append(f"Print did not work ({type(e).__name__}: {str(e).splitlines()[0][:120]})")
            for e in dict.fromkeys(errs):
                problems.append(f"{tag}: page error: {e}")
        finally:
            b.close()
    # ---- 3. themes: each theme of the picker loads without errors, keeps text readable, and gets a sheet
    themes = []
    browser, page, _, terr = open_deck(pw, path)
    try:
        themes = page.evaluate("(window.Deck && Deck.themeList || []).map(t => ({name: t.name || '', vars: t.vars || {}}))")
    finally:
        browser.close()
    if len(themes) > 1:
        print(f"5. themes ({len(themes)})")
        def lum(h):
            h = h.strip().lstrip("#")
            if len(h) != 6:
                return None
            c = [int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)]
            c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
            return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
        def ratio(a, b):
            la, lb = lum(a), lum(b)
            return None if la is None or lb is None else (max(la, lb) + .05) / (min(la, lb) + .05)
        last = {s["id"]: s["i"] for s in steps if s["id"]}
        for ti, th in enumerate(themes):
            v = th["vars"]
            for fg, bg, need in (("--ink", "--ground", 4.5), ("--ink", "--card", 4.5), ("--dim", "--ground", 3), ("--accent", "--ground", 3), ("--red", "--ground", 3)):
                r = ratio(v.get(fg, ""), v.get(bg, ""))
                if r is not None and r < need:
                    problems.append(f"theme {ti + 1} ({th['name']}): {fg} on {bg} contrast {r:.1f}:1, needs {need}:1")
            b = launch(pw); errs = []
            try:
                pg = b.new_page(viewport={"width": info["w"], "height": info["h"]})
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.goto(pathlib.Path(path).resolve().as_uri() + f"?render=1&theme={ti}")
                pg.wait_for_function("window.__deckReady === true || !!window.__deckError", timeout=30000)
                files = []
                for n, sl in enumerate(slides):
                    pg.evaluate(f"__deck.go({last[sl['id']]})")
                    f = out / f"theme{ti + 1}_slide{n + 1:02d}.png"; f.write_bytes(shot(pg, info)); files.append(f)
                tile(files, out / f"theme{ti + 1}.png", cols=5, width=384, labels={f: f"theme {ti + 1} ({th['name']}) · slide {n + 1}" for n, f in enumerate(files)})
                for f in files:
                    f.unlink()
            except Exception as e:  # noqa: BLE001
                problems.append(f"theme {ti + 1} ({th['name']}) did not render ({type(e).__name__}: {str(e).splitlines()[0][:120]})")
            finally:
                b.close()
            for e in dict.fromkeys(errs):
                problems.append(f"theme {ti + 1} ({th['name']}): page error: {e}")
    # ---- report
    lines = [f"{info['title']}: {len(slides)} slides, {len(steps)} steps", f"stills and per-slide sheets: {out}"]
    if len(themes) > 1:
        lines.append(f"themes: {len(themes)} (a sheet each: theme1.png … theme{len(themes)}.png)")
    if levels:
        lines.append(f"levels: {', '.join(l['name'] for l in levels)} (other levels' sheets in level-<id>/; the live run uses {first})")
    if langs:
        lines.append(f"languages: {', '.join(l['name'] for l in langs)} (sheets in lang-<id>/ and level-<id>-<lang>/; the live run uses {first_lang})")
    lines += ["note: " + x for x in notes]
    lines += (["PROBLEMS:"] + ["  - " + x for x in problems]) if problems else ["VERIFIED: every step renders, animates, stays on the slide and presents live (default and reduced motion); panel, Download and Print work" + (", and every theme renders with readable contrast" if len(themes) > 1 else "") + ((", in every audience level" + (" and code language" if langs else "") + ".") if levels else (", in every code language." if langs else "."))]
    (out / "report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"Now look at {out / 'all-slides.png'} and each slideNN.png before delivering.")
    return 1 if problems else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", help="built deck .html")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--verify", action="store_true", help="the full pre-delivery verification (see cmd_verify)")
    ap.add_argument("--stills")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--out")
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    if a.verify:
        with sync_playwright() as pw:
            return cmd_verify(pw, a.deck, a.out)
    with sync_playwright() as pw:
        browser, page, info, errors = open_deck(pw, a.deck)
        try:
            if a.check:
                return cmd_check(page, info, errors)
            if a.stills:
                return cmd_stills(page, info, a.stills, a.out, a.sheet)
            ap.print_help()
            return 2
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())

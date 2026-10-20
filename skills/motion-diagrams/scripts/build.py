#!/usr/bin/env python3
"""Build a diagram: one script in, every output out, checked.

    python build.py diagram.js [-o out/] [--name shop] [--formats svg,png,drawio,excalidraw,embed]
                    [--themes light,dark] [--scale 2] [--strict]

Writes, next to each other (default: a folder named after the script, beside it):
    <name>.svg / <name>-dark.svg      vector, fonts embedded, icons embedded
    <name>.png / <name>-dark.png      raster at --scale (2 = retina)
    <name>.drawio                     editable in diagrams.net / draw.io / the VS Code extension
    <name>.excalidraw                 editable in excalidraw.com (clean style)
    <name>.embed.js                   (with embed) the diagram for motion-slides / motion-videos

Then prints the check report (overlaps, overflowing or colliding text, edges through nodes or text,
contrast in both themes, anything off the canvas) and VERIFIED when it is clean. Exit code 1 when
there are errors (or warnings, with --strict).

Needs Python Playwright with Chromium:  pip install playwright && python -m playwright install chromium
"""
import argparse
import base64
import difflib
import json
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
ICONS = ASSETS / "icons"
ENGINE = ASSETS / "engine.html"
FONTS = {("Inter", 400): "inter-400", ("Inter", 500): "inter-500", ("Inter", 600): "inter-600",
         ("Inter", 700): "inter-700", ("JetBrains Mono", 400): "jetbrains-mono-400"}


class IconLib:
    def __init__(self):
        self.entries = {e["id"]: e for e in json.loads((ICONS / "index.json").read_text(encoding="utf-8"))}
        self.by_name = {}
        for e in self.entries.values():
            self.by_name.setdefault(e["name"].lower(), e["id"])

    @staticmethod
    def uri(path):
        return "data:image/svg+xml;base64," + base64.b64encode((ICONS / path).read_bytes()).decode("ascii")

    def resolve(self, iid):
        e = self.entries.get(iid)
        if not e:
            pool = list(self.entries)
            close = difflib.get_close_matches(iid, pool, n=5, cutoff=0.55)
            tail = iid.split("/")[-1]
            close += [i for i in pool if i.endswith("/" + tail) and i not in close][:5]
            hint = ("; did you mean: " + ", ".join(close[:6])) if close else ""
            return {"error": f'unknown icon "{iid}"{hint}. Search: python scripts/icons.py "<words>"'}
        r = {"kind": e["kind"], "light": self.uri(e["file"])}
        if e.get("dark"):
            r["dark"] = self.uri(e["dark"])
        return r


def font_css(svg_texts):
    used = set()
    for s in svg_texts:
        for m in re.finditer(r'font-family="([^"]+)" font-size="[\d.]+" font-weight="(\d+)"', s):
            fam = "JetBrains Mono" if "JetBrains" in m.group(1) else "Inter"
            used.add((fam, int(m.group(2))))
    css = ""
    for fam, w in sorted(used):
        f = FONTS.get((fam, w)) or FONTS.get((fam, 400))
        data = base64.b64encode((ASSETS / "fonts" / (f + ".woff2")).read_bytes()).decode("ascii")
        css += f"@font-face{{font-family:'{fam}';font-weight:{w};src:url(data:font/woff2;base64,{data}) format('woff2')}}"
    return css


def with_fonts(svg, css):
    return svg.replace("</title>", "</title><style>" + css + "</style>", 1) if css else svg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script", help="diagram script (.js)")
    ap.add_argument("-o", "--out", help="output folder (default: <script folder>/<name>/)")
    ap.add_argument("--name", help="file name stem (default: the script's)")
    ap.add_argument("--formats", default="svg,png,drawio,excalidraw", help="comma list: svg,png,drawio,excalidraw,embed")
    ap.add_argument("--themes", default="light,dark")
    ap.add_argument("--scale", type=float, default=2.0, help="PNG pixel ratio (default 2)")
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help="override a Diagram.config setting for this build, e.g. --set aspect=none --set direction=down "
                         "(build a document and a slide version from one script, each with its own --name)")
    ap.add_argument("--fix", action="store_true",
                    help="try layout variants (spacing, placement) the script doesn't set and keep the one with the fewest issues")
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass

    script = pathlib.Path(a.script).resolve()
    name = a.name or script.stem
    out = pathlib.Path(a.out).resolve() if a.out else script.parent / name
    out.mkdir(parents=True, exist_ok=True)
    formats = {f.strip() for f in a.formats.split(",") if f.strip()}
    themes = [t.strip() for t in a.themes.split(",") if t.strip()]
    src = script.read_text(encoding="utf-8")
    lib = IconLib()

    from playwright.sync_api import sync_playwright, Error as PWError
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.expose_function("mdIcon", lib.resolve)
        page.goto(ENGINE.as_uri())
        page.wait_for_function("() => !!(window.MD && window.ELK)")
        page.evaluate("Promise.all(['400','500','600','700'].map(w => document.fonts.load(w + ' 14px Inter')).concat(document.fonts.load('400 14px \"JetBrains Mono\"')))")
        try:
            cfg = page.evaluate("src => MD.load(src)", src)
            forced = parse_sets(a.set)
            cfg.update(forced)
            override, tried = {}, []
            if a.fix:
                override, tried = auto_fix(page, src, cfg, forced)
            override = dict(override, **forced)
            page.evaluate("src => MD.load(src)", src)
            res = page.evaluate("o => MD.build(o)", {"themes": themes, "drawio": "drawio" in formats, "override": override,
                                                       "excalidraw": "excalidraw" in formats, "embed": "embed" in formats})
        except PWError as e:
            msg = str(e).split("\n")[0].replace("Error: ", "", 1)
            print(f"error in {script.name}: {msg}", file=sys.stderr)
            return 1

        css = font_css(res["svg"].values())
        written = []
        for t in themes:
            stem = name if t == "light" else f"{name}-{t}"
            svg = with_fonts(res["svg"][t], css)
            if "svg" in formats:
                (out / f"{stem}.svg").write_text(svg, encoding="utf-8")
                written.append(f"{stem}.svg")
            if "png" in formats:
                ctx = browser.new_context(device_scale_factor=a.scale, viewport={"width": res["w"], "height": res["h"]})
                pg = ctx.new_page()
                pg.set_content(f'<html><body style="margin:0">{svg}</body></html>')
                pg.evaluate("document.fonts.ready")
                pg.wait_for_timeout(150)
                written.append(save_png(pg, out / f"{stem}.png"))
                ctx.close()
        if "drawio" in formats:
            (out / f"{name}.drawio").write_text(res["drawio"], encoding="utf-8")
            written.append(f"{name}.drawio")
        if "excalidraw" in formats:
            (out / f"{name}.excalidraw").write_text(res["excalidraw"], encoding="utf-8")
            written.append(f"{name}.excalidraw")
        if "embed" in formats:
            runtime = (ASSETS / "embed-runtime.js").read_text(encoding="utf-8")
            data = dict(res["embed"], fonts=css)
            js = (f"/* motion-diagrams embed: {res['title']}. Paste into a deck or film script, then see\n"
                  f"   motion-diagrams/references/embed.md: MotionDiagrams.mount(el, '{name}') */\n"
                  f"{runtime}\nMotionDiagrams.add({json.dumps(name)}, {json.dumps(data, separators=(',', ':'))});\n")
            (out / f"{name}.embed.js").write_text(js, encoding="utf-8")
            written.append(f"{name}.embed.js")

        # ---- review round: numbered issues, a fix for each, and a picture with matching markers
        rep = res["report"]
        review_png, review_txt = out / f"{name}.review.png", out / f"{name}.review.txt"
        if rep["issues"]:
            rsvg = page.evaluate("([s, r]) => MD.reviewSVG(s, r)", [with_fonts(res["svg"]["light"] if "light" in res["svg"] else next(iter(res["svg"].values())), css), rep])
            ctx = browser.new_context(device_scale_factor=1.5, viewport={"width": res["w"], "height": res["h"]})
            pg = ctx.new_page()
            pg.set_content(f'<html><body style="margin:0">{rsvg}</body></html>')
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(150)
            pg.locator("svg").first.screenshot(path=str(review_png))
            ctx.close()
            lines = [f"Review of {script.name}: {len(rep['errors'])} errors, {len(rep['warnings'])} warnings, "
                     f"{rep['metrics']['crossings']} crossings, {rep['metrics']['detours']} detours", ""]
            for i in rep["issues"]:
                lines += [f"{i['n']:>2}. {'ERROR' if i['level'] == 'error' else 'warn '} [{i['kind']}] {i['msg']}  (at {i['x']},{i['y']})",
                          f"    fix: {i['fix']}"]
            review_txt.write_text("\n".join(lines) + "\n", encoding="utf-8")
        else:
            for f in (review_png, review_txt):
                f.unlink(missing_ok=True)
        browser.close()

    print(f"built {res['kind']} \"{res['title']}\" ({res['w']}x{res['h']}) -> {out}")
    print("  " + "  ".join(written))
    if a.fix:
        for v, s, n_issues in tried:
            print(f"  fix: tried {fmt_override(v):<44} score {s:>5}  ({n_issues} issues)")
        chosen = {k: v for k, v in override.items() if k not in forced}
        print(f"  fix: kept {fmt_override(chosen)}" + (f"  -> add to Diagram.config to keep it: {fmt_override(chosen)}" if chosen else ""))
    for i in rep["issues"]:
        tag = "ERROR  " if i["level"] == "error" else "warning"
        print(f"  {i['n']:>2}. {tag} {i['msg']}")
        print(f"      fix: {i['fix']}")
    if rep["issues"]:
        print(f"  review: {review_png.name} marks each numbered issue; {review_txt.name} lists them")
    if not rep["errors"] and not rep["warnings"]:
        print("VERIFIED")
    elif not rep["errors"]:
        print("VERIFIED with warnings: open the review image, fix what a reader would notice, rebuild")
    fail = bool(rep["errors"]) or (a.strict and rep["warnings"])
    return 1 if fail else 0


GRAPH_KINDS = {"architecture", "flowchart", "state", "c4", "org"}


def save_png(pg, target):
    """Render to a temp file and swap it in; a target held open by an image viewer is left alone and the new
    picture is saved beside it (so a build never fails because the old PNG is open)."""
    tmp = target.with_name(target.stem + ".tmp.png")
    pg.locator("svg").first.screenshot(path=str(tmp))
    try:
        os.replace(tmp, target)
        return target.name
    except OSError:
        alt = target.with_name(target.stem + " (new).png")
        try:
            os.replace(tmp, alt)
        except OSError:
            alt = tmp
        print(f"  note: {target.name} is open in another program (an image viewer?); saved {alt.name} instead. "
              f"Close it and rebuild to update {target.name}.")
        return alt.name


def fmt_override(o):
    return "{" + ", ".join(f"{k}: '{v}'" for k, v in o.items()) + "}" if o else "(the script's own settings)"


def parse_sets(items):
    """--set KEY=VALUE pairs -> config overrides (none/null/off -> unset, true/false, numbers)."""
    out = {}
    for it in items:
        if "=" not in it:
            raise SystemExit(f"--set needs KEY=VALUE, got {it!r}")
        k, v = (x.strip() for x in it.split("=", 1))
        if v.lower() in ("none", "null", "off"):
            out[k] = None
        elif v.lower() in ("true", "false"):
            out[k] = v.lower() == "true"
        else:
            try:
                out[k] = float(v)
            except ValueError:
                out[k] = v
    return out


def auto_fix(page, src, cfg, forced=None):
    """Build layout variants the script leaves open; return the best override and every try."""
    forced = forced or {}
    if cfg.get("kind") not in GRAPH_KINDS or cfg.get("layout") == "grid":
        return {}, []
    import re as _re
    free = lambda key: key not in forced and not _re.search(r"\b" + key + r"\s*:", src.split("Diagram.config", 1)[-1].split(")", 1)[0])
    options = [{}]
    if free("placement"):
        options += [{"placement": "balanced"}, {"placement": "straight"}]
    if free("spacing"):
        options += [dict(o, spacing="roomy") for o in list(options)]
    tried = []
    for o in options:
        page.evaluate("src => MD.load(src)", src)
        r = page.evaluate("o => MD.build(o).then(x => ({ score: MD.score(x.report), n: x.report.issues.length }))",
                          {"themes": ["light"], "override": dict(o, **forced)})
        tried.append((o, r["score"], r["n"]))
    best = min(tried, key=lambda t: (t[1], len(t[0])))
    return best[0], tried


if __name__ == "__main__":
    sys.exit(main())

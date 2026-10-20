#!/usr/bin/env python3
"""Open the editable files in their real apps and screenshot them (needs network).

    python check_editable.py out/shop/            # every .drawio and .excalidraw in the folder
    python check_editable.py shop.drawio shop.excalidraw

  .drawio      loaded into the official diagrams.net viewer (viewer.diagrams.net)
  .excalidraw  rendered with Excalidraw's own library (exportToSvg from @excalidraw/excalidraw)

Writes <file>.check.png next to each file and prints OK or the error. Use it after changing the
engine's exporters, or when a user reports that an editable file looks wrong.
"""
import base64
import json
import pathlib
import sys
import urllib.parse
import zlib

EXCALIDRAW_PAGE = """<!doctype html><html><head><meta charset="utf-8">
<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js"></script>
</head><body style="margin:0;background:#fff"><div id="out"></div></body></html>"""


def drawio_url(xml: str) -> str:
    raw = urllib.parse.quote(xml, safe="~()*!.'")
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    data = base64.b64encode(c.compress(raw.encode("utf-8")) + c.flush()).decode("ascii")
    return "https://viewer.diagrams.net/?lightbox=1&nav=1&highlight=0000ff#R" + urllib.parse.quote(data, safe="")


def main():
    args = [pathlib.Path(a) for a in sys.argv[1:]]
    files = []
    for a in args:
        files += sorted(a.glob("*.drawio")) + sorted(a.glob("*.excalidraw")) if a.is_dir() else [a]
    if not files:
        print(__doc__)
        return 1
    from playwright.sync_api import sync_playwright
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for f in files:
            pg = b.new_page(viewport={"width": 1600, "height": 1000})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            out = f.with_suffix(f.suffix + ".check.png")
            try:
                if f.suffix == ".drawio":
                    pg.goto(drawio_url(f.read_text(encoding="utf-8")), timeout=60000)
                    pg.wait_for_function("() => document.querySelectorAll('svg image, svg text, svg foreignObject').length > 3", timeout=60000)
                    pg.wait_for_timeout(2500)
                    cells = pg.evaluate("() => document.querySelectorAll('svg g > g').length")
                    pg.screenshot(path=str(out))
                    ok = cells > 3
                    print(f"{'OK ' if ok else 'BAD'} {f.name}: diagrams.net drew {cells} shapes -> {out.name}")
                else:
                    doc = json.loads(f.read_text(encoding="utf-8"))
                    pg.set_content(EXCALIDRAW_PAGE)
                    pg.wait_for_function("() => !!window.ExcalidrawLib", timeout=60000)
                    n = pg.evaluate("""async d => {
                        const svg = await ExcalidrawLib.exportToSvg({ elements: d.elements, appState: Object.assign({ exportBackground: true }, d.appState), files: d.files });
                        document.getElementById('out').appendChild(svg);
                        return svg.querySelectorAll('*').length; }""", doc)
                    pg.wait_for_timeout(800)
                    pg.locator("#out svg").screenshot(path=str(out))
                    ok = n > 10 and not errs
                    print(f"{'OK ' if ok else 'BAD'} {f.name}: Excalidraw rendered {len(doc['elements'])} elements ({n} SVG nodes) -> {out.name}")
                bad += not ok
            except Exception as e:  # noqa: BLE001
                bad += 1
                print(f"BAD {f.name}: {str(e).splitlines()[0]}")
            if errs:
                print("    page errors: " + "; ".join(errs[:3]))
            pg.close()
        b.close()
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Presenter kit: double-click launchers that serve a built page on this computer and open it in its own
app window (Edge or Chrome), for Windows, macOS and Linux, plus a zip to share them in.

    python kit.py talk.html [--verb present|play] [--no-zip]

Writes next to the page:
    Present (Windows).cmd · Present (Mac).command · Present (Linux).sh · How to present.txt · _present/
    <name> - kit.zip   (the page and all of the above; the zip keeps the macOS/Linux launchers executable)

Served from http://127.0.0.1, the page also plays YouTube embeds, which refuse to play from a file.
Shared by the motion-slides ("present") and motion-videos ("play") skills.
"""
import argparse
import html
import pathlib
import re
import shutil
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
TPL = HERE.parent / "assets" / "launchers"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page", help="the built .html file")
    ap.add_argument("--verb", choices=["present", "play"], default="play", help="play (films, default) or present (decks)")
    ap.add_argument("--no-zip", action="store_true", help="don't write the shareable zip")
    a = ap.parse_args()
    page = pathlib.Path(a.page).resolve()
    if not page.exists():
        sys.exit(f"No such file: {page}")
    folder, verb = page.parent, a.verb
    Verb = verb.capitalize()
    m = re.search(r"<title>(.*?)</title>", page.read_text(encoding="utf-8", errors="ignore"), re.S)
    title = html.unescape(m.group(1).strip()) if m else page.stem
    names = {"win": f"{Verb} (Windows).cmd", "mac": f"{Verb} (Mac).command", "linux": f"{Verb} (Linux).sh", "readme": f"How to {verb}.txt"}

    def fill(s):
        return (s.replace("__PAGE__", page.name).replace("__TITLE__", title).replace("__VERB__", verb)
                 .replace("__LAUNCH_WIN__", names["win"]).replace("__LAUNCH_MAC__", names["mac"]).replace("__LAUNCH_LINUX__", names["linux"]))

    written = []
    def put(rel, text, crlf=False, exe=False):
        p = folder / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        text = text.replace("\r\n", "\n")
        p.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))
        if exe:
            try:
                p.chmod(0o755)
            except OSError:
                pass
        written.append((rel, exe))

    put(names["win"], fill((TPL / "present.cmd").read_text(encoding="utf-8")), crlf=True)
    put(names["mac"], fill((TPL / "present.command").read_text(encoding="utf-8")), exe=True)
    put(names["linux"], fill((TPL / "present.sh").read_text(encoding="utf-8")), exe=True)
    put(names["readme"], fill((TPL / "README.txt").read_text(encoding="utf-8")), crlf=True)
    put("_present/serve.ps1", (TPL / "serve.ps1").read_text(encoding="utf-8"), crlf=True)
    put("_present/serve.py", (TPL / "serve.py").read_text(encoding="utf-8"), exe=True)

    print(f"presenter kit for {page.name}:")
    for rel, _ in written:
        print(f"  {folder / rel}")
    if not a.no_zip:
        z = folder / f"{page.stem} - kit.zip"
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for rel, exe in [(page.name, False)] + written:
                info = zipfile.ZipInfo.from_file(folder / rel, rel)
                info.external_attr = ((0o100755 if exe else 0o100644) << 16)   # unix mode: keeps the launchers executable
                info.compress_type = zipfile.ZIP_DEFLATED
                zf.writestr(info, (folder / rel).read_bytes())
        print(f"  {z}  (share this: unzip, then double-click the launcher)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

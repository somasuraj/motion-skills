#!/usr/bin/env python3
"""Presenter kit: double-click launchers that serve a built page on this computer and open it in its own
app window (Edge or Chrome), for Windows, macOS and Linux, plus a zip to share them in.

    python kit.py talk.html [--verb present|play] [--no-zip]

Writes next to the page:
    Present (Windows).cmd · Present (Mac).command · Present (Linux).sh · How to present.txt · _present/
    <name> - kit.zip   (the page and all of the above; the zip keeps the macOS/Linux launchers executable)

Served from http://127.0.0.1, the page also plays YouTube embeds, which refuse to play from a file.
Decks that opt in with Deck.config({terminal: true}) also get the terminal drawer: a real shell (PowerShell on Windows, the login shell on macOS/Linux)
that the deck shows with ` and that only that deck window can reach.
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
XT = HERE.parent / "assets" / "vendor" / "xterm"
MONACO = HERE.parent / "assets" / "vendor" / "monaco"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page", help="the built .html file")
    ap.add_argument("--verb", choices=["present", "play"], default="present", help="present (decks, default) or play (films)")
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
    src = page.read_text(encoding="utf-8", errors="ignore") if verb == "present" else ""
    term = re.search(r"terminal\s*:\s*true", src)
    web = re.search(r"browser\s*:\s*(true|\{)", src)
    wb = re.search(r"workbench\s*:\s*true", src)
    remote = re.search(r"remote\s*:\s*(true|\{)", src)   # remote: true, or remote: { forward: '8081 8082' } (the demo ports to bring back by default)
    fwd = re.search(r"remote\s*:\s*\{[^}]*forward\s*:\s*['\"]([0-9 ,]+)['\"]", src)
    if term or web or wb:   # the launchers' helpers: the terminal's console bridge and the browser's window placement (Windows)
        put("_present/term.cs", (TPL / "term.cs").read_text(encoding="utf-8"), crlf=True)
    if term:   # the deck opted in (Deck.config({terminal: true})): its terminal drawer: xterm.js (MIT) and the Windows console bridge, served only by these launchers
        for f in ("xterm.js", "addon-fit.js", "xterm.css", "LICENSE.txt"):
            put("_present/term/" + f, (XT / f).read_text(encoding="utf-8"))

    if wb:   # the workbench: Monaco (MIT, the editor inside VS Code) and the demo folder's setting
        for f in sorted(MONACO.rglob("*")):
            if f.is_file():
                rel = "_present/monaco/" + f.relative_to(MONACO).as_posix()
                dst = folder / rel; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(f.read_bytes()); written.append((rel, False))
        ws = folder / "_present" / "workspace.txt"
        if not ws.exists():   # never overwrite the presenter's own setting
            put("_present/workspace.txt", "# The workbench's demo folder: put its full path on the first line below (for example D:\\demos\\orders-api\n"
                "# or ~/demos/orders-api). Leave it empty for a 'workspace' folder next to the deck. Only this folder can be edited.\n\n")
        elif ("_present/workspace.txt", False) not in written:
            written.append(("_present/workspace.txt", False))
    if remote:   # optional: present from a remote Linux machine (everything runs there, the deck is shown here)
        names["remote"] = f"{Verb} (Remote Linux).cmd"
        put(names["remote"], fill((TPL / "present-remote.cmd").read_text(encoding="utf-8")), crlf=True)
        rp = (TPL / "remote.ps1").read_text(encoding="utf-8")
        if fwd:   # the deck's own demo ports as the default the launcher offers
            rp = rp.replace("forward = '8000 8080 9000'", "forward = '" + " ".join(fwd.group(1).replace(",", " ").split()) + "'")
        put("_present/remote.ps1", rp, crlf=True)
    dp = folder / "demo-projects"
    if dp.is_dir():   # the deck's demo projects (one per language, in stages): shipped with the kit, laid into the demo folder by the deck
        for f in sorted(dp.rglob("*")):
            if f.is_file() and ".git" not in f.parts and "node_modules" not in f.parts and "target" not in f.parts and "__pycache__" not in f.parts:
                written.append((f.relative_to(folder).as_posix(), False))
    print(f"presenter kit for {page.name}:")
    for rel, _ in written:
        if "/monaco/" not in rel and not rel.startswith("demo-projects/"):
            print(f"  {folder / rel}")
    if wb:
        print(f"  {folder / '_present' / 'monaco'}  (the workbench's editor)")
    if dp.is_dir():
        print(f"  {dp}  (the demo projects)")
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

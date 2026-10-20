#!/usr/bin/env python3
"""Serve one page from this folder on 127.0.0.1 and open it in its own app window (Edge, Chrome,
Chromium or Brave, with a temporary profile). When that window closes, the server stops.

    python3 serve.py PAGE.html [--port N] [--no-browser]

Written by the motion skills' presenter kit. Uses only the Python standard library.
"""
import http.server
import os
import pathlib
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent.parent

CANDIDATES = {
    "darwin": ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
               "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
    "linux": ["microsoft-edge", "microsoft-edge-stable", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser"],
    "win32": [r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe", r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
              r"%ProgramFiles%\Google\Chrome\Application\chrome.exe", r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
              r"%LocalAppData%\Google\Chrome\Application\chrome.exe"],
}


def find_browser():
    for c in CANDIDATES.get(sys.platform, CANDIDATES["linux"]):
        c = os.path.expandvars(c)
        if os.path.isabs(c):
            if os.path.exists(c):
                return c
        elif shutil.which(c):
            return shutil.which(c)
    return None


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    args = sys.argv[1:]
    page = next((a for a in args if not a.startswith("--")), "index.html")
    port = int(args[args.index("--port") + 1]) if "--port" in args else 0
    if not (ROOT / page).exists():
        sys.exit(f"Could not find {page} next to this launcher.")
    socketserver.TCPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    url = f"http://127.0.0.1:{srv.server_address[1]}/{page}"
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"Serving {page} at {url}")
    if "--no-browser" in args:
        print("Press Ctrl+C to stop."); _wait(srv); return
    exe = find_browser()
    if not exe:
        print("No Edge or Chrome found: opening your default browser instead.\nKeep this window open while presenting; press Ctrl+C (or close it) when done.")
        webbrowser.open(url); _wait(srv); return
    prof = tempfile.mkdtemp(prefix="present-")
    try:
        p = subprocess.Popen([exe, f"--app={url}", f"--user-data-dir={prof}", "--no-first-run", "--no-default-browser-check", "--window-size=1600,940"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("Opened in its own window. Close that window to stop.")
        p.wait()
    except KeyboardInterrupt:
        pass
    finally:
        srv.shutdown()
        shutil.rmtree(prof, ignore_errors=True)


def _wait(srv):
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()

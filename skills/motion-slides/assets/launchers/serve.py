#!/usr/bin/env python3
"""Serve one page from this folder on 127.0.0.1 and open it in its own app window (Edge, Chrome,
Chromium or Brave, with a temporary profile). When that window closes, the server stops.

    python3 serve.py PAGE.html [--port N] [--no-browser] [--term-dir FOLDER] [--shell PROGRAM]

A deck's terminal drawer gets a real shell here (macOS and Linux) when _present/term/ exists: a pseudo-terminal
on a WebSocket that only this deck window can open (127.0.0.1 only, a one-time key in the address, an Origin check).
Written by the motion skills' presenter kit. Uses only the Python standard library.
"""
import base64
import hashlib
import http.server
import os
import pathlib
import secrets
import shutil
import socketserver
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import urllib.request
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

# the terminal drawer (decks only: the kit puts xterm in _present/term); a real pty needs macOS or Linux
REMOTE = "--remote" in sys.argv   # started by Present (Remote Linux): the deck is shown on another computer
TERM = {"on": (ROOT / "_present" / "term" / "xterm.js").exists() and os.name == "posix", "key": secrets.token_hex(16),
        "origin": "", "dir": os.path.expanduser("~"), "shell": os.environ.get("SHELL") or "/bin/bash", "pids": set()}
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
# the deck's browser (decks that use it: the kit then writes term.cs): pages open in the presenter's default browser
WEB = (ROOT / "_present" / "term.cs").exists()
# the workbench (decks that use it: the kit puts Monaco in _present/monaco): files of one demo folder, edited in the deck.
# The folder: --workspace, else the first line of _present/workspace.txt, else a "workspace" folder next to the deck.
WB = {"on": WEB and (ROOT / "_present" / "monaco" / "vs" / "loader.js").exists(), "root": None}
WB_SKIP = {".git", "node_modules", "bin", "obj", "target", ".venv", "venv", "__pycache__", ".idea", ".vs", ".pytest_cache", ".gradle"}


def wb_inside(rel):
    """A path inside the demo folder, or None (nothing outside it can be read or written)."""
    if rel is None:
        return None
    root = WB["root"]
    full = (root / rel.replace("\\", "/").lstrip("/")).resolve()
    return full if full == root or root in full.parents else None


DEMO_ID = __import__("re").compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
DEMO_CHECKS = {"git": ["git", "--version"], "gh": ["gh", "auth", "status"], "glab": ["glab", "auth", "status"], "ansible": ["ansible", "--version"], "terraform": ["terraform", "version"], "aws": ["aws", "--version"], "az": ["az", "version", "--output", "tsv"], "gcloud": ["gcloud", "--version"], "docker": ["docker", "info", "--format", "Docker {{.ServerVersion}} is running"],
               "kubectl": ["kubectl", "config", "current-context"], "python": ["python3", "--version"], "node": ["node", "--version"],
               "java": ["mvn", "-v"], "dotnet": ["dotnet", "--version"]}


def demo_handle(h, op, q, post):
    """Demo setup (_present/demo.json, local only), pre-flight checks of known tools, and laying a demo project stage into the demo folder."""
    import json, re

    def send(code, body):
        b = body if isinstance(body, bytes) else json.dumps(body).encode()
        h.send_response(code); h.send_header("Content-Type", "application/json; charset=utf-8"); h.send_header("Content-Length", str(len(b))); h.end_headers(); h.wfile.write(b)
    cfg = ROOT / "_present" / "demo.json"
    if op == "config":
        if post:
            n = int(h.headers.get("Content-Length") or 0)
            if n > 65536:
                return send(413, {"error": "Too large."})
            cfg.write_bytes(h.rfile.read(n)); return send(200, {"ok": True})
        return send(200, cfg.read_bytes()) if cfg.exists() else send(404, {})
    if op == "check":
        what, arg = q.get("what", [""])[0], q.get("arg", [""])[0]
        if what == "repo":
            if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", arg):
                return send(200, {"ok": False, "text": "Use owner/name, for example my-org/orders-api."})
            cmd = ["gh", "repo", "view", arg, "--json", "url", "--jq", ".url"]
        elif what == "gitlab":
            m = re.match(r"^https?://([A-Za-z0-9.-]+(?::[0-9]+)?)/([A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+?)(?:\.git)?/?$", arg)
            if not m:
                return send(200, {"ok": False, "text": "Use the project's address, for example https://gitlab.com/my-group/orders-api."})
            cmd = ["glab", "repo", "view", "https://" + m.group(1) + "/" + m.group(2)]
        elif what == "sonar":
            if not re.match(r"^https?://[A-Za-z0-9.:_-]+(/[A-Za-z0-9._/-]*)?$", arg):
                return send(200, {"ok": False, "text": "Use an address like http://localhost:9000."})
            try:
                body = urllib.request.urlopen(arg.rstrip("/") + "/api/system/status", timeout=6).read().decode()
                return send(200, {"ok": '"UP"' in body, "text": "SonarQube is up." if '"UP"' in body else "SonarQube answered: " + body[:300]})
            except Exception as e:  # noqa: BLE001
                return send(200, {"ok": False, "text": f"Not reachable: {e}"})
        elif what in DEMO_CHECKS:
            cmd = DEMO_CHECKS[what]
        else:
            return send(400, {"error": "Unknown check."})
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=15)
            out = (r.stdout + r.stderr).decode(errors="replace").strip()
            return send(200, {"ok": r.returncode == 0, "text": out[:600]})
        except FileNotFoundError:
            return send(200, {"ok": False, "text": f"{cmd[0]} is not installed (or not on PATH)."})
        except subprocess.TimeoutExpired:
            return send(200, {"ok": False, "text": "No answer within 15 s."})
    lang = q.get("lang", [""])[0]
    if not DEMO_ID.match(lang):
        return send(400, {"error": "Unknown language."})
    proj = ROOT / "demo-projects" / lang
    if op == "stages":
        sj = proj / "stages.json"
        return send(200, sj.read_bytes()) if sj.exists() else send(404, [])
    if op == "apply" and post:
        stage = q.get("stage", [""])[0]
        if not DEMO_ID.match(stage) or not WB["root"]:
            return send(400, {"error": "Unknown stage."})
        dirs = sorted(d for d in (proj / "stages").glob("*") if d.is_dir()) if (proj / "stages").exists() else []
        names = [d.name.split("-", 1)[1] if "-" in d.name else d.name for d in dirs]
        if stage not in names:
            return send(404, {"error": f"No stage {stage}."})
        n = 0
        for d in dirs[:names.index(stage) + 1]:   # every stage up to it, in order (each holds only the files that change)
            for f in d.rglob("*"):
                if f.is_file():
                    dst = wb_inside(str(f.relative_to(d)))
                    if dst:
                        dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(f.read_bytes()); n += 1
        return send(200, {"ok": True, "files": n})
    return send(404, {"error": "Unknown request."})


def wb_handle(h, op, q, post):
    root = WB["root"]

    def send(code, body=b"", ctype="text/plain; charset=utf-8", extra=None):
        h.send_response(code)
        for k, v in (extra or {}).items():
            h.send_header(k, v)
        if body:
            h.send_header("Content-Type", ctype); h.send_header("Content-Length", str(len(body)))
        h.end_headers()
        if body:
            h.wfile.write(body)
    if op == "list":
        out, n = [], 0
        for d, dirs, files in os.walk(root):
            dirs[:] = sorted(x for x in dirs if x not in WB_SKIP)
            for x in dirs:
                out.append({"p": str((pathlib.Path(d) / x).relative_to(root)).replace(os.sep, "/"), "d": 1}); n += 1
            for x in files:
                f = pathlib.Path(d) / x
                try:
                    st = f.stat()
                except OSError:
                    continue
                out.append({"p": str(f.relative_to(root)).replace(os.sep, "/"), "d": 0, "m": int(st.st_mtime * 1e7), "s": st.st_size}); n += 1
            if n >= 3000:
                break
        import json
        return send(200, json.dumps({"root": str(root), "entries": out, "more": n >= 3000}).encode(), "application/json; charset=utf-8")
    if op == "git":
        try:
            r = subprocess.run(["git", "status", "--porcelain=v1", "-uall"], cwd=root, capture_output=True, timeout=3)
            return send(200, r.stdout if r.returncode == 0 else b"")
        except (OSError, subprocess.TimeoutExpired):
            return send(200, b"")
    if op == "code" and post:
        if REMOTE:
            return send(501, b"The demo folder is on the remote machine: open it with VS Code Remote-SSH.")
        try:
            subprocess.Popen(["code", str(root)]); return send(204)
        except OSError as e:
            return send(500, f"VS Code could not start: {e}".encode())
    path = wb_inside(q.get("path", [None])[0])
    if op == "read":
        if not path or not path.is_file():
            return send(404, b"No such file.")
        if path.stat().st_size > 2 * 1024 * 1024:
            return send(413, b"This file is larger than 2 MB.")
        data = path.read_bytes()
        if b"\0" in data[:8000]:
            return send(415, b"This looks like a binary file.")
        return send(200, data, extra={"X-Mtime": str(int(path.stat().st_mtime * 1e7))})
    if not post:
        return send(405, b"Use POST.")
    if op == "write":
        if not path or path.is_dir():
            return send(400, b"Not a file inside the demo folder.")
        n = int(h.headers.get("Content-Length") or 0)
        path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(h.rfile.read(n))
        return send(204, extra={"X-Mtime": str(int(path.stat().st_mtime * 1e7))})
    if op == "mkdir":
        if not path:
            return send(400, b"Not inside the demo folder.")
        path.mkdir(parents=True, exist_ok=True); return send(204)
    if op == "rename":
        to = wb_inside(q.get("to", [None])[0])
        if not path or not to or path == root:
            return send(400, b"Not inside the demo folder.")
        if to.exists():
            return send(409, b"Something with that name already exists.")
        to.parent.mkdir(parents=True, exist_ok=True); path.rename(to); return send(204)
    if op == "delete":
        if not path or path == root:
            return send(400, b"Not inside the demo folder.")
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()
        else:
            return send(404, b"No such file.")
        return send(204)
    return send(404, b"Unknown request.")


def find_browser():
    for c in CANDIDATES.get(sys.platform, CANDIDATES["linux"]):
        c = os.path.expandvars(c)
        if os.path.isabs(c):
            if os.path.exists(c):
                return c
        elif shutil.which(c):
            return shutil.which(c)
    return None


def ws_send(sock, lock, op, data=b""):
    n = len(data)
    if n < 126:
        head = bytes([0x80 | op, n])
    elif n < 65536:
        head = bytes([0x80 | op, 126]) + struct.pack(">H", n)
    else:
        head = bytes([0x80 | op, 127]) + struct.pack(">Q", n)
    with lock:
        sock.sendall(head + data)


def ws_recv(rf):
    """One frame from the page: (opcode, fin, payload), or None when the connection ends."""
    h = rf.read(2)
    if len(h) < 2:
        return None
    n = h[1] & 127
    if n == 126:
        n = struct.unpack(">H", rf.read(2))[0]
    elif n == 127:
        n = struct.unpack(">Q", rf.read(8))[0]
    mask = rf.read(4) if h[1] & 128 else b""
    data = rf.read(n)
    if len(data) < n:
        return None
    if mask and n:
        m = (mask * (n // 4 + 1))[:n]
        data = (int.from_bytes(data, "big") ^ int.from_bytes(m, "big")).to_bytes(n, "big")
    return h[0] & 15, bool(h[0] & 128), data


def run_terminal(handler, cols, rows):
    """A login shell on a pty, wired to this WebSocket until either side ends.
    The page sends "0<keys>" (input) and "1<cols>,<rows>" (resize); output goes back as binary frames."""
    import fcntl
    import pty
    import signal
    import termios
    try:
        pid, fd = pty.fork()
    except OSError as e:   # tell the page why (a text frame is shown as an error)
        lk = threading.Lock()
        ws_send(handler.connection, lk, 1, f"The shell could not start: {e}".encode())
        ws_send(handler.connection, lk, 8, struct.pack(">H", 1011))
        return
    if pid == 0:   # the shell
        try:
            os.chdir(TERM["dir"])
        except OSError:
            os.chdir(os.path.expanduser("~"))
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLORTERM"] = "truecolor"
        try:
            os.execvp(TERM["shell"], [TERM["shell"], "-l"])
        except OSError as e:
            os.write(1, ("\x1b[31mCould not start " + TERM["shell"] + ": " + str(e) + "\x1b[0m\r\n").encode())
            os._exit(127)
    TERM["pids"].add(pid)

    def resize(c, r):
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))
    resize(cols, rows)
    sock, lock = handler.connection, threading.Lock()

    def pump():   # shell output -> page; when the shell ends, close the socket
        try:
            while True:
                out = os.read(fd, 65536)
                if not out:
                    break
                ws_send(sock, lock, 2, out)
        except OSError:
            pass
        try:
            ws_send(sock, lock, 8, struct.pack(">H", 1000))
        except OSError:
            pass
    threading.Thread(target=pump, daemon=True).start()
    buf = b""
    try:
        while True:   # page -> shell
            fr = ws_recv(handler.rfile)
            if fr is None:
                break
            op, fin, data = fr
            if op == 8:
                break
            if op == 9:
                ws_send(sock, lock, 10, data)
                continue
            if op not in (0, 1, 2):
                continue
            buf += data
            if not fin:
                continue
            msg, buf = buf.decode("utf-8", "replace"), b""
            if msg[:1] == "0":
                os.write(fd, msg[1:].encode("utf-8"))
            elif msg[:1] == "1":
                try:
                    c, r = (int(x) for x in msg[1:].split(","))
                    resize(max(c, 2), max(r, 2))
                except (ValueError, OSError):
                    pass
    except OSError:
        pass
    finally:
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass
        try:
            os.waitpid(pid, 0)
        except OSError:
            pass
        TERM["pids"].discard(pid)
        try:
            os.close(fd)
        except OSError:
            pass


def close_terminals():
    import signal
    for pid in list(TERM["pids"]):
        try:
            os.kill(pid, signal.SIGHUP)
        except OSError:
            pass


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def wb_route(self, post):
        u = urllib.parse.urlsplit(self.path)
        if u.path.startswith("/__demo/"):   # demo setup, checks and stages: this deck window only
            q = urllib.parse.parse_qs(u.query)
            same = (self.headers.get("Origin") == TERM["origin"]) if post else self.headers.get("Sec-Fetch-Site") in (None, "same-origin")
            if not (WEB and q.get("tk", [""])[0] == TERM["key"] and same):
                self.send_error(403); return True
            try:
                demo_handle(self, u.path[8:], q, post)
            except OSError as e:
                self.send_error(500, str(e))
            return True
        if not u.path.startswith("/__fs/"):
            return False
        q = urllib.parse.parse_qs(u.query)
        same = (self.headers.get("Origin") == TERM["origin"]) if post else self.headers.get("Sec-Fetch-Site") in (None, "same-origin")
        if not (WB["on"] and WB["root"] and q.get("tk", [""])[0] == TERM["key"] and same):
            self.send_error(403); return True
        try:
            wb_handle(self, u.path[6:], q, post)
        except OSError as e:
            self.send_error(500, str(e))
        return True

    def do_POST(self):
        if not self.wb_route(True):
            self.send_error(404)

    def do_GET(self):
        if self.wb_route(False):
            return
        u = urllib.parse.urlsplit(self.path)
        if u.path in ("/__open", "/__deckfull"):   # the deck's browser: this deck window only
            q = urllib.parse.parse_qs(u.query)
            site = self.headers.get("Sec-Fetch-Site")
            if not (WEB and q.get("tk", [""])[0] == TERM["key"] and (not site or site == "same-origin")):
                self.send_error(403); return
            target = q.get("url", [""])[0]
            if u.path == "/__open":
                if not target.startswith(("http://", "https://")):
                    self.send_error(400); return
                if REMOTE:   # the presenter's screen is the other computer: the deck opens the page there itself
                    self.send_error(501, "remote"); return
                webbrowser.open_new(target)   # the window placement is Windows-only; here it opens where the browser likes
            self.send_response(204); self.end_headers(); return
        if u.path != "/__term":
            return super().do_GET()
        q = urllib.parse.parse_qs(u.query)   # the terminal drawer's socket: this deck window only
        if not (TERM["on"] and q.get("tk", [""])[0] == TERM["key"] and self.headers.get("Origin") == TERM["origin"]
                and self.headers.get("Upgrade", "").lower() == "websocket" and self.headers.get("Sec-WebSocket-Key")):
            self.send_error(403)
            return
        accept = base64.b64encode(hashlib.sha1((self.headers["Sec-WebSocket-Key"] + WS_GUID).encode()).digest()).decode()
        self.send_response_only(101)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        http.server.BaseHTTPRequestHandler.end_headers(self)
        self.wfile.flush()

        def num(k, d):
            v = q.get(k, [""])[0]
            return int(v) if v.isdigit() else d
        run_terminal(self, max(num("cols", 80), 20), max(num("rows", 24), 5))
        self.close_connection = True


def main():
    args = sys.argv[1:]
    page = next((a for a in args if not a.startswith("--") and (args.index(a) == 0 or args[args.index(a) - 1] not in ("--port", "--term-dir", "--shell"))), "index.html")
    port = int(args[args.index("--port") + 1]) if "--port" in args else 0
    if "--term-dir" in args and os.path.isdir(args[args.index("--term-dir") + 1]):
        TERM["dir"] = args[args.index("--term-dir") + 1]
    if "--shell" in args:
        TERM["shell"] = args[args.index("--shell") + 1]
    if WB["on"]:
        ws = args[args.index("--workspace") + 1] if "--workspace" in args else ""
        wf = ROOT / "_present" / "workspace.txt"
        if not ws and wf.exists():
            ws = next((x.strip() for x in wf.read_text(encoding="utf-8", errors="ignore").splitlines() if x.strip() and not x.startswith("#")), "")
        ws = pathlib.Path(os.path.expandvars(os.path.expanduser(ws))) if ws else ROOT / "workspace"
        if not ws.is_absolute():
            ws = ROOT / ws
        try:
            ws.mkdir(parents=True, exist_ok=True); WB["root"] = ws.resolve()
            if "--term-dir" not in args:
                TERM["dir"] = str(WB["root"])   # the terminal starts in the demo folder
            print(f"Workbench folder: {WB['root']}")
        except OSError as e:
            print(f"Workbench unavailable: {e}")
    if not (ROOT / page).exists():
        sys.exit(f"Could not find {page} next to this launcher.")
    socketserver.TCPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    TERM["origin"] = f"http://127.0.0.1:{srv.server_address[1]}"
    url = f"{TERM['origin']}/{page}" + (f"?tk={TERM['key']}" if TERM["on"] or WEB else "")
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"Serving {page} at {url}", flush=True)
    if "--no-browser" in args:
        print("Press Ctrl+C to stop.", flush=True); _wait(srv); return
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
        close_terminals()
        srv.shutdown()
        shutil.rmtree(prof, ignore_errors=True)


def _wait(srv):
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        close_terminals()
        srv.shutdown()


if __name__ == "__main__":
    main()

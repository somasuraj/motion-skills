#!/usr/bin/env python3
"""Check a built film, render stills, or export an MP4 (with its score).

    python render.py film.html --check
    python render.py film.html --stills 0,2.5,bounce,orbit+1.2,50%,end [--sheet] [--out dir]
    python render.py film.html --mp4 film.mp4 [--fps 30] [--scale 1] [--no-audio] [--workers 6]

Times: seconds (2.5), a percentage of the film (50%), "end", a scene id (its
middle) or a scene id plus or minus seconds (orbit+1.2, close-0.5).
Needs: Python playwright with a Chromium, and ffmpeg for --mp4 and --sheet.
--workers N renders the MP4 in N browsers at once, each taking a slice of the
frames, and joins the slices without re-encoding: use it for long films. Each
worker needs roughly 300-500 MB of memory.
"""
import argparse
import base64
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time


try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace"); sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

GL_NOISE = ("software WebGL", "GL Driver Message", "GPU stall")   # SwiftShader chatter, not deck problems


def launch(pw):
    exe = os.environ.get("CHROMIUM_PATH")
    args = ["--autoplay-policy=no-user-gesture-required", "--disable-gpu-vsync"]
    try:
        return pw.chromium.launch(executable_path=exe, args=args) if exe else pw.chromium.launch(args=args)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"Could not start Chromium ({e}).\nInstall one with:  python -m playwright install chromium\n"
                 f"or point CHROMIUM_PATH at a Chrome/Chromium binary.")


def open_film(pw, path, scale=1.0):
    browser = launch(pw)
    errors = []
    url = pathlib.Path(path).resolve().as_uri() + "?render=1"
    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=scale)
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") and not any(n in m.text for n in GL_NOISE) else None)
    page.on("pageerror", lambda e: errors.append(f"page error: {e}"))
    page.goto(url)
    try:
        page.wait_for_function("window.__filmReady === true", timeout=20000)
    except Exception:  # noqa: BLE001
        print("The film never became ready. Errors so far:", *errors, sep="\n  ", file=sys.stderr)
        sys.exit(1)
    info = page.evaluate("({d: __film.duration, fps: __film.fps, w: __film.width, h: __film.height, scenes: __film.scenes, title: __film.title})")
    page.set_viewport_size({"width": info["w"], "height": info["h"]})
    page.evaluate("__film.seek(0)")
    return browser, page, info, errors


def parse_times(spec, info):
    d, scenes = info["d"], {s["id"]: s for s in info["scenes"]}
    out = []
    for tok in [x.strip() for x in spec.split(",") if x.strip()]:
        if tok == "end":
            out.append(d)
        elif tok.endswith("%"):
            out.append(d * float(tok[:-1]) / 100)
        else:
            try:
                out.append(float(tok.rstrip("s")))
                continue
            except ValueError:
                pass
            for sign in ("+", "-"):
                if sign in tok[1:]:
                    sid, off = tok.split(sign, 1)
                    s = scenes[sid]
                    out.append(s["start"] + (float(off) if sign == "+" else -float(off)))
                    break
            else:
                s = scenes[tok]
                out.append(s["start"] + s["dur"] / 2)
    return [max(0.0, min(d, t)) for t in out]


def shot(page, t, w, h):
    page.evaluate(f"__film.seek({t})")
    return page.screenshot(clip={"x": 0, "y": 0, "width": w, "height": h}, animations="disabled")


def cmd_check(page, info, errors):
    w, h, d = info["w"], info["h"], info["d"]
    print(f"{info['title']}: {d:.2f}s, {w}x{h} @ {info['fps']}fps, {len(info['scenes'])} scenes")
    problems = []
    for s in info["scenes"]:
        for t in (s["start"] + 0.001, s["start"] + s["dur"] / 2, s["start"] + s["dur"] - 0.02):
            failed = page.evaluate(f"__film.seek({t})")
            if s["id"] in failed:
                problems.append(f"scene '{s['id']}' threw (see console errors)")
                break
    t0 = time.time()
    a = hashlib.md5(shot(page, d * 0.37, w, h)).hexdigest()
    shot(page, d * 0.9, w, h)
    shot(page, 0.0, w, h)
    b = hashlib.md5(shot(page, d * 0.37, w, h)).hexdigest()
    ms = (time.time() - t0) / 4 * 1000
    if a != b:
        problems.append(f"not deterministic: t={d*0.37:.2f}s looked different after seeking away and back "
                        "(something depends on real time, Math.random or render order)")
    first = shot(page, 0.0, w, h)
    try:
        from PIL import Image  # type: ignore
        import io
        im = Image.open(io.BytesIO(first)).convert("RGB").resize((96, 54))
        if (im.getcolors(64) or [0] * 64).__len__() < 4:
            problems.append("frame 0 is (nearly) blank: it is the thumbnail and the MP4's first frame")
    except ImportError:
        pass
    has_score = page.evaluate("!!document.getElementById('mute') && document.getElementById('mute').style.display !== 'none'")
    print(f"score: {'yes' if has_score else 'none'} · capture ~{ms:.0f} ms/frame "
          f"(MP4 at {info['fps']}fps ≈ {d * info['fps'] * ms / 1000 / 60:.1f} min)")
    notes = []
    for e in dict.fromkeys(errors):
        # A font that cannot load (offline sandbox, blocked network) falls back to system faces: note it, don't fail.
        (notes if "Failed to load resource" in e else problems).append(e)
    for n_ in notes:
        print("note:", n_, "(fonts fall back to system faces where Google Fonts can't load)")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        return 1
    print("OK")
    return 0


def cmd_stills(page, info, spec, out, sheet):
    times = parse_times(spec, info)
    out = pathlib.Path(out or tempfile.mkdtemp(prefix="stills-"))
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for t in times:
        f = out / f"t_{t:07.3f}.png"
        f.write_bytes(shot(page, t, info["w"], info["h"]))
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


def encode_frames(page, info, fps, first, last, dest, label=""):
    """Pipe frames first..last (inclusive) into an x264 file."""
    w, h, d = info["w"], info["h"], info["d"]
    proc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
                             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
                             "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(dest)], stdin=subprocess.PIPE)
    t0 = time.time()
    for i in range(first, last + 1):
        proc.stdin.write(shot(page, min(d, i / fps), w, h))
        k = i - first
        if k % max(1, fps * 2) == 0:
            el = time.time() - t0
            print(f"\r  {label}frame {k}/{last - first}  ({el:.0f}s)", end="", flush=True)
    proc.stdin.close()
    proc.wait()
    print()


def cmd_mp4(page, info, out, fps, audio, workers=1, film=None, scale=1.0):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed for --mp4")
    d = info["d"]
    fps = fps or info["fps"]
    n = int(round(d * fps))
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="film-"))
    wav = None
    if audio:
        b64 = page.evaluate("__film.audioWav()")
        if b64:
            wav = tmp / "score.wav"
            wav.write_bytes(base64.b64decode(b64))
    silent = tmp / "video.mp4"
    workers = max(1, min(workers, (n + 1) // 30 or 1))
    if workers == 1:
        encode_frames(page, info, fps, 0, n, silent)
    else:
        # Slice the frames, render each slice in its own process (own browser), then join without re-encoding.
        cuts = [round(k * (n + 1) / workers) for k in range(workers + 1)]
        procs, parts = [], []
        print(f"  {n + 1} frames in {workers} workers")
        for k in range(workers):
            part = tmp / f"part{k:03d}.mp4"
            parts.append(part)
            procs.append(subprocess.Popen([sys.executable, __file__, str(film), "--part", str(cuts[k]), str(cuts[k + 1] - 1), str(part),
                                           "--fps", str(fps), "--scale", str(scale)], stdout=subprocess.DEVNULL))
        bad = [k for k, p in enumerate(procs) if p.wait() != 0]
        if bad:
            sys.exit(f"workers {bad} failed")
        lst = tmp / "parts.txt"
        lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)
    if wav:
        # Pad the sound and cut to the video's exact length: -shortest with a copied video drops frames.
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(silent), "-i", str(wav), "-c:v", "copy",
                        "-af", "apad", "-c:a", "aac", "-b:a", "192k", "-t", f"{(n + 1) / fps:.6f}", out], check=True)
    else:
        shutil.copy(silent, out)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"wrote {out}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("film", help="built film .html")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--stills")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--mp4")
    ap.add_argument("--fps", type=int)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--workers", type=int, default=1, help="render the MP4 in N browsers at once")
    ap.add_argument("--part", nargs=3, metavar=("FIRST", "LAST", "OUT"), help=argparse.SUPPRESS)
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser, page, info, errors = open_film(pw, a.film, a.scale)
        try:
            if a.check:
                return cmd_check(page, info, errors)
            if a.stills:
                return cmd_stills(page, info, a.stills, a.out, a.sheet)
            if a.part:
                encode_frames(page, info, a.fps or info["fps"], int(a.part[0]), int(a.part[1]), a.part[2], label=f"[{a.part[0]}] ")
                return 0
            if a.mp4:
                return cmd_mp4(page, info, a.mp4, a.fps, not a.no_audio, a.workers, a.film, a.scale)
            ap.print_help()
            return 2
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(main())

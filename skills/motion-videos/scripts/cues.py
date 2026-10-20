#!/usr/bin/env python3
"""Turn an audio file (dialogue, narration, a song) into a cue sheet a film can be timed to.

    python cues.py dialogue.mp3 -o cues.json                       # speech segments (by pauses)
    python cues.py dialogue.mp3 -o cues.json --script lines.txt    # ...with your script's lines, in order
    python cues.py dialogue.mp3 -o cues.json --whisper             # real transcription (free, local: pip install faster-whisper)
    python cues.py song.mp3 -o cues.json --beats                   # tempo and beat times for cutting on the beat

Output: {"duration": s, "cues": [{"start", "end", "text", "speaker"?}], "beats": [s...], "bpm": n}
Use it in a film with Film.audio('dialogue.mp3') and Film.cues('cues.json') (build.py embeds both),
and time scenes from the cue starts (see references/kit-api.md, "Recorded audio").
Lines in --script may start with "NAME:" to set a speaker. Needs ffmpeg and numpy.
"""
import argparse
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

import numpy as np

SR = 16000


def decode(path):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def speech_segments(x, min_pause=0.35, min_len=0.25):
    hop = int(SR * 0.02)
    n = len(x) // hop
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms)
    floor, peak = np.percentile(db, 10), np.percentile(db, 95)
    thr = floor + 0.35 * (peak - floor)
    on = db > thr
    segs, start, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.02 >= min_pause:
                segs.append((start, i - quiet + 1))
                start, quiet = None, 0
    if start is not None:
        segs.append((start, n))
    out = [(round(a * 0.02, 2), round(b * 0.02, 2)) for a, b in segs if (b - a) * 0.02 >= min_len]
    return out


def fit_script(segs, lines):
    """Spread script lines over speech segments in order, by how long each line is."""
    if not segs or not lines:
        return []
    talk = sum(b - a for a, b in segs)
    weights = [max(1, len(re.sub(r"^[^:]{1,24}:\s*", "", l))) for l in lines]
    total = sum(weights)
    if len(segs) >= len(lines):
        # Enough pauses: give each line whole segments, cutting at the pause nearest its share of the talk.
        ends, acc_w, acc_t, cut = [], 0, [], 0
        for a, b in segs:
            cut += b - a
            acc_t.append(cut)
        prev = -1
        for k, w in enumerate(weights[:-1]):
            acc_w += w
            target = talk * acc_w / total
            lo, hi = prev + 1, len(segs) - (len(lines) - k)   # leave a segment for every later line
            j = min(range(lo, hi + 1), key=lambda i: abs(acc_t[i] - target))
            ends.append(j)
            prev = j
        ends.append(len(segs) - 1)
        cues, first = [], 0
        for line, last in zip(lines, ends):
            m = re.match(r"^([^:]{1,24}):\s*(.*)$", line)
            cue = {"start": segs[first][0], "end": segs[last][1], "text": m.group(2) if m else line}
            if m:
                cue["speaker"] = m.group(1).strip()
            cues.append(cue)
            first = last + 1
        return cues
    # walk along the speech time and cut it where each line's share ends
    cues, si, pos = [], 0, segs[0][0]
    for line, w in zip(lines, weights):
        need = talk * w / total
        start = None
        while need > 1e-6 and si < len(segs):
            a, b = segs[si]
            pos = max(pos, a)
            if start is None:
                start = pos
            take = min(need, b - pos)
            pos += take
            need -= take
            if pos >= b - 1e-6:
                si += 1
        m = re.match(r"^([^:]{1,24}):\s*(.*)$", line)
        cue = {"start": round(start if start is not None else pos, 2), "end": round(pos, 2), "text": m.group(2) if m else line}
        if m:
            cue["speaker"] = m.group(1).strip()
        cues.append(cue)
    return cues


def whisper_cues(x, size, language):
    # Models (and Hugging Face's cache) live beside the Python that runs this, unless MOTION_MODELS says otherwise.
    root = os.environ.get("MOTION_MODELS") or str(pathlib.Path(sys.prefix) / "models")
    os.environ.setdefault("HF_HOME", str(pathlib.Path(root) / "hf"))
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        # Hand over to the Python that has it: MOTION_PYTHON, or the path in .whisper-python next to this script.
        alt = os.environ.get("MOTION_PYTHON")
        f = pathlib.Path(__file__).with_name(".whisper-python")
        if not alt and f.exists():
            alt = f.read_text(encoding="utf-8").strip()
        if alt and pathlib.Path(alt).exists() and pathlib.Path(alt).resolve() != pathlib.Path(sys.executable).resolve():
            sys.exit(subprocess.run([alt, str(pathlib.Path(__file__).resolve()), *sys.argv[1:]]).returncode)
        sys.exit("--whisper needs faster-whisper: pip install faster-whisper, or put the path of a Python that has it "
                 "in MOTION_PYTHON or in scripts/.whisper-python")
    model = WhisperModel(size, device="auto", compute_type="int8", download_root=root)
    segments, _ = model.transcribe(x, vad_filter=True, language=language)   # 16 kHz mono from ffmpeg
    cues = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments]
    dur = len(x) / SR
    for i, c in enumerate(cues):   # Whisper can run a segment past a pause or the end of the file
        nxt = cues[i + 1]["start"] if i + 1 < len(cues) else dur
        c["end"] = round(min(c["end"], nxt, dur), 2)
    return cues


def beats(x):
    hop, win = 128, 512                                   # 8 ms grid
    n = 1 + (len(x) - win) // hop
    frames = np.lib.stride_tricks.as_strided(x, (n, win), (x.strides[0] * hop, x.strides[0]))
    spec = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(1)
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = SR / hop
    t_of = lambda k: (k + 1) * hop / SR + win / (4 * SR)  # flux k is the change into frame k+1
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)      # 70..180 BPM
    k = lo + int(np.argmax(ac[lo:hi]))
    a, b, c = ac[k - 1], ac[k], ac[k + 1]                 # parabolic peak: sub-frame period
    period = k + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    # refine the period over the whole track: fit a line through the strongest onsets near each grid beat
    grid = np.arange(0, len(flux), period)
    phase = max(range(int(period)), key=lambda p: flux[np.clip((p + grid).astype(int), 0, len(flux) - 1)].sum())
    w = max(1, int(period / 6))
    hits = []
    for g in phase + grid:
        g = int(round(g))
        if g >= len(flux):
            break
        a0, b0 = max(0, g - w), min(len(flux), g + w + 1)
        j = a0 + int(np.argmax(flux[a0:b0]))
        hits.append(j)
    idx = np.arange(len(hits))
    if len(hits) > 3:
        period, off = np.polyfit(idx, np.array(hits, float), 1)
    else:
        off = phase
    bpm = 60 * fps / period
    times = [round(t_of(off + i * period), 3) for i in idx if t_of(off + i * period) >= 0]
    return round(bpm, 1), times


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--script", help="text file, one spoken line per line (\"NAME: line\" sets a speaker)")
    ap.add_argument("--whisper", action="store_true", help="transcribe with faster-whisper instead of pauses")
    ap.add_argument("--model", default="small", help="Whisper model: tiny, base, small (default), medium, large-v3")
    ap.add_argument("--language", help="spoken language code, e.g. en, hi (default: detect)")
    ap.add_argument("--beats", action="store_true", help="also detect tempo and beat times")
    ap.add_argument("--min-pause", type=float, default=0.35, help="silence that splits two cues, seconds")
    a = ap.parse_args()

    x = decode(a.audio)
    res = {"duration": round(len(x) / SR, 2), "cues": []}
    if a.whisper:
        res["cues"] = whisper_cues(x, a.model, a.language)
    else:
        segs = speech_segments(x, a.min_pause)
        if a.script:
            lines = [l.strip() for l in pathlib.Path(a.script).read_text(encoding="utf-8").splitlines() if l.strip()]
            res["cues"] = fit_script(segs, lines)
        elif not a.beats:
            res["cues"] = [{"start": s, "end": e, "text": ""} for s, e in segs]
    if a.beats:
        res["bpm"], res["beats"] = beats(x)
    pathlib.Path(a.out).write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{a.out}: {res['duration']} s, {len(res['cues'])} cues" + (f", {res['bpm']} BPM, {len(res['beats'])} beats" if a.beats else ""))


if __name__ == "__main__":
    main()

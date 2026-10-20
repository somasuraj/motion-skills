#!/usr/bin/env python3
"""Build every diagram script in a folder in one browser session's worth of runs (used to test the skill).

    python build_all.py examples/ -o out/ [--formats svg,png,drawio,excalidraw]
"""
import argparse
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--formats", default="svg,png,drawio,excalidraw")
    a = ap.parse_args()
    bad = 0
    for f in sorted(pathlib.Path(a.folder).glob("*.js")):
        r = subprocess.run([sys.executable, str(HERE / "build.py"), str(f), "-o", str(pathlib.Path(a.out) / f.stem),
                            "--formats", a.formats], capture_output=True, text=True)
        print(f"== {f.name}\n{r.stdout}{r.stderr}", end="")
        bad += r.returncode != 0
    print(f"\n{bad} failed" if bad else "\nall built")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

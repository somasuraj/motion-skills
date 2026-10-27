#!/usr/bin/env python3
"""Find icon ids in the bundled library (8,000+ official icons, no network).

    python icons.py "load balancer"              # best matches across every vendor
    python icons.py "queue" --vendor aws         # aws | azure | gcp | k8s | logo | si | generic
    python icons.py github sonarqube "key vault"  # several searches at once (one per argument)
    python icons.py --check aws/lambda logo/github-icon   # confirm ids exist
    python icons.py --list --vendor gcp          # everything from one vendor

Which prefix to use:
  aws/<service>          AWS service icon (the coloured square). aws/res/<…> resource icons, aws/group/<…> group badges
  azure/<service>        Azure service icon
  gcp/<service>          Google Cloud icon
  k8s/<kind>             Kubernetes resource (pod, svc, ing, deploy, sts, cm, secret, pvc, ns, node, …)
  logo/<brand>           full-colour brand logo; prefer the "-icon" variant (logo/github-icon) for a square mark
  si/<brand>             single-colour brand mark in the brand's colour (when no logo/ fits a square)
  generic/<thing>        neutral glyph for things without a brand (user, server, database, laptop, …)
  web/<brand>            a real logo fetched from the internet with fetch_logo.py (cached on this machine)

No logo/ or si/ match for a product, tool or company? Don't settle for a generic glyph:
    python fetch_logo.py "<brand>" [--domain vendor.com]
"""
import argparse
import json
import os
import pathlib
import re
import sys

INDEX = pathlib.Path(__file__).resolve().parent.parent / "assets" / "icons" / "index.json"
# logos fetched from the internet by fetch_logo.py (web/<slug>)
WEB_INDEX = pathlib.Path(os.environ.get("MOTION_DIAGRAMS_ICONS") or pathlib.Path.home() / ".motion-diagrams" / "icons") / "index.json"
VENDOR_RANK = {"aws": 0, "azure": 0, "gcp": 0, "k8s": 0, "logo": 1, "web": 1, "si": 2, "generic": 3}


def words(s):
    return [w for w in re.split(r"[^a-z0-9]+", s.lower()) if w]


def score(e, q):
    qw = words(q)
    idw = words(e["id"].split("/", 1)[1])
    nw = words(e["name"])
    hay = set(idw + nw)
    if not qw:
        return 0
    s = 0
    for w in qw:
        if w in hay:
            s += 10
        elif any(h.startswith(w) for h in hay):
            s += 6
        elif any(w in h for h in hay):
            s += 3
        else:
            return 0
    tail = e["id"].split("/")[-1]
    if tail == "-".join(qw):
        s += 15
    if tail.endswith("-icon") and tail[:-5] == "-".join(qw):
        s += 14
    s -= len(hay) * 0.4                      # shorter names are usually the main service
    s -= VENDOR_RANK.get(e["vendor"], 3) * 2
    if "/res/" in e["id"] or "/group/" in e["id"]:
        s -= 3
    if e.get("ar"):
        s -= 12                              # wordmarks don't fit a square tile
    return s


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("query", nargs="*")
    ap.add_argument("--vendor")
    ap.add_argument("-n", type=int, default=8)
    ap.add_argument("--check", action="store_true", help="treat the arguments as ids and confirm each exists")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    entries = json.loads(INDEX.read_text(encoding="utf-8"))
    if WEB_INDEX.exists():
        entries += json.loads(WEB_INDEX.read_text(encoding="utf-8"))
    if a.vendor:
        entries = [e for e in entries if e["vendor"] == a.vendor]
    ids = {e["id"]: e for e in entries}
    if a.check:
        bad = 0
        for q in a.query:
            if q in ids:
                print(f"ok       {q}  ({ids[q]['name']})")
            else:
                bad += 1
                alt = sorted(entries, key=lambda e: -score(e, q.split("/")[-1]))[:4]
                print(f"MISSING  {q}  -> try: " + ", ".join(e["id"] for e in alt if score(e, q.split('/')[-1]) > 0))
        return 1 if bad else 0
    if a.list:
        for e in entries:
            print(f"{e['id']:<60} {e['name']}")
        return 0
    if not a.query:
        ap.print_help()
        return 0
    queries = a.query  # one search per argument: quote multi-word searches ("load balancer")
    for q in queries:
        hits = sorted(((score(e, q), e) for e in entries), key=lambda t: -t[0])
        hits = [e for s, e in hits if s > 0][: a.n]
        print(f'"{q}":' if len(queries) > 1 else f'"{q}" ({len(hits)} shown)')
        for e in hits:
            note = "  (wordmark: wide, avoid in a node)" if e.get("ar", 1) > 1.6 else ""
            print(f"  {e['id']:<58} {e['name']}  [{e['kind']}]{note}")
        if not hits:
            print("  (nothing; try fewer or different words, or --vendor generic)")
        if not any(e["vendor"] != "generic" for e in hits):
            print(f'  -> no official icon or logo here. If "{q}" is a product, tool or company, fetch its real logo:\n'
                  f'     python scripts/fetch_logo.py "{q}"   (add --domain <vendor site> for less known brands)')
    return 0


if __name__ == "__main__":
    sys.exit(main())

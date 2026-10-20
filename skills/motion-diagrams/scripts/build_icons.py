#!/usr/bin/env python3
"""Rebuild the bundled icon library (assets/icons/) from the official packs.

    python build_icons.py --fetch            # download every source, then rebuild
    python build_icons.py --src <folder>     # rebuild from sources already downloaded there

Normally you never run this: the icons ship with the skill. Run it when a vendor publishes a
new pack (AWS releases quarterly) and you want the new services.

Sources (all official or the vendors' own marks; see assets/icons/LICENSES.md):
  aws       AWS Architecture Icons (service 64 px, resource 48 px, group 32 px, with Dark variants)
  azure     Microsoft Azure architecture icons
  gcp       Google Cloud icons
  k8s       Kubernetes community icons (kubernetes/community/icons)
  logo      gilbarbara/logos: full-colour tool and brand logos (CC0)
  si        Simple Icons: single-colour brand marks in the brand's own colour (CC0)
  generic   Lucide: neutral glyphs for things that have no brand (ISC)
"""
import argparse
import io
import json
import pathlib
import re
import shutil
import sys
import tarfile
import urllib.request
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "icons"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MAX_BYTES = 100_000  # a handful of logos embed large rasters; skip them

K8S_NAMES = {
    "c-role": "ClusterRole", "cm": "ConfigMap", "crb": "ClusterRoleBinding", "crd": "CustomResourceDefinition",
    "cronjob": "CronJob", "deploy": "Deployment", "ds": "DaemonSet", "ep": "Endpoints", "group": "Group",
    "hpa": "HorizontalPodAutoscaler", "ing": "Ingress", "job": "Job", "limits": "LimitRange", "netpol": "NetworkPolicy",
    "ns": "Namespace", "pod": "Pod", "psp": "PodSecurityPolicy", "pv": "PersistentVolume", "pvc": "PersistentVolumeClaim",
    "quota": "ResourceQuota", "rb": "RoleBinding", "role": "Role", "rs": "ReplicaSet", "sa": "ServiceAccount",
    "sc": "StorageClass", "secret": "Secret", "sts": "StatefulSet", "svc": "Service", "user": "User", "vol": "Volume",
    "control-plane": "Control plane", "etcd": "etcd", "node": "Node", "api": "API server",
    "c-c-m": "Cloud controller manager", "c-m": "Controller manager", "k-proxy": "kube-proxy",
    "kubelet": "kubelet", "sched": "Scheduler",
}
K8S_GROUPS = {"resources/unlabeled": [k for k in K8S_NAMES if k not in ("control-plane", "etcd", "node", "api", "c-c-m", "c-m", "k-proxy", "kubelet", "sched")],
              "infrastructure_components/unlabeled": ["control-plane", "etcd", "node"],
              "control_plane_components/labeled": ["api", "c-c-m", "c-m", "k-proxy", "kubelet", "sched"]}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def fetch(src):
    src.mkdir(parents=True, exist_ok=True)
    page = get("https://aws.amazon.com/architecture/icons/").decode("utf-8", "replace")
    m = re.search(r"https://[^\"' ]*Icon-package[^\"' ]*\.zip", page) or re.search(r"https://[^\"' ]*Asset-Package[^\"' ]*\.zip", page)
    if not m:
        raise SystemExit("could not find the AWS icon package link on aws.amazon.com/architecture/icons/")
    jobs = {
        "aws.zip": m.group(0),
        "azure.zip": "https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V21.zip",
        "gcp.zip": "https://cloud.google.com/static/icons/files/google-cloud-icons.zip",
        "logos.tgz": "https://codeload.github.com/gilbarbara/logos/tar.gz/refs/heads/main",
        "simple.tgz": "https://registry.npmjs.org/simple-icons/-/simple-icons-13.21.0.tgz",
        "lucide.tgz": "https://registry.npmjs.org/lucide-static/-/lucide-static-0.468.0.tgz",
    }
    for name, url in jobs.items():
        print("downloading", name, "...", flush=True)
        (src / name).write_bytes(get(url))
    k8s = src / "k8s"
    k8s.mkdir(exist_ok=True)
    for folder, names in K8S_GROUPS.items():
        for n in names:
            (k8s / f"{n}.svg").write_bytes(get(f"https://cdn.jsdelivr.net/gh/kubernetes/community@master/icons/svg/{folder}/{n}.svg"))


def minify(svg: bytes) -> bytes:
    s = svg.decode("utf-8", "replace")
    s = re.sub(r"<\?xml.*?\?>", "", s, flags=re.S)
    s = re.sub(r"<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<metadata.*?</metadata>", "", s, flags=re.S)
    s = re.sub(r">\s+<", "><", s).strip()
    return s.encode("utf-8")


def aspect(svg: bytes):
    head = svg[:2000].decode("utf-8", "replace")
    m = re.search(r'viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', head)
    if m and float(m.group(2)):
        return float(m.group(1)) / float(m.group(2))
    w = re.search(r'\swidth="([\d.]+)', head)
    h = re.search(r'\sheight="([\d.]+)', head)
    if w and h and float(h.group(1)):
        return float(w.group(1)) / float(h.group(1))
    return None


def slug(s):
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-+", "-", s)


def nice(s):
    return re.sub(r"\s+", " ", s.replace("-", " ").replace("_", " ")).strip()


class Lib:
    def __init__(self):
        self.entries = {}

    def add(self, iid, name, vendor, cat, kind, data, dark=None):
        if iid in self.entries or len(data) > MAX_BYTES:
            return
        rel = iid.replace("/", "__") + ".svg"
        (OUT / vendor).mkdir(parents=True, exist_ok=True)
        (OUT / vendor / rel).write_bytes(minify(data))
        e = {"id": iid, "name": name, "vendor": vendor, "cat": cat, "kind": kind, "file": f"{vendor}/{rel}"}
        ar = aspect(data)
        if ar and (ar > 1.6 or ar < 0.62):
            e["ar"] = round(ar, 2)  # a wordmark or tall mark: poor in a square tile
        if dark is not None:
            drel = iid.replace("/", "__") + "__dark.svg"
            (OUT / vendor / drel).write_bytes(minify(dark))
            e["dark"] = f"{vendor}/{drel}"
        self.entries[iid] = e


def build_aws(lib, z):
    names = [n for n in z.namelist() if n.endswith(".svg") and "__MACOSX" not in n]
    by_base = {}
    for n in names:
        by_base[n.split("/")[-1]] = n
    for n in names:
        f = n.split("/")[-1]
        if "/64/" in n and f.startswith("Arch_"):
            base = f[5:-7]  # strip Arch_ and _64.svg
            short = re.sub(r"^(Amazon|AWS)-", "", base)
            cat = n.split("/")[1].replace("Arch_", "")
            lib.add("aws/" + slug(short), nice(base), "aws", nice(cat), "tile", z.read(n))
        elif f.startswith("Res_") and f.endswith("_48.svg"):
            base = f[4:-7]
            short = re.sub(r"^(Amazon|AWS)-", "", base)
            dark = by_base.get(f.replace("_48.svg", "_48_Dark.svg"))
            cat = n.split("/")[1].replace("Res_", "")
            lib.add("aws/res/" + slug(short), nice(base), "aws", nice(cat) + " (resource)", "plain", z.read(n),
                    z.read(dark) if dark else None)
        elif "Group-Icons" in n and f.endswith("_32.svg"):
            base = f[:-7]
            dark = by_base.get(f.replace("_32.svg", "_32_Dark.svg"))
            lib.add("aws/group/" + slug(base), nice(base) + " (group)", "aws", "Groups", "plain", z.read(n),
                    z.read(dark) if dark else None)


def build_azure(lib, z):
    for n in sorted(z.namelist()):
        if not n.endswith(".svg"):
            continue
        parts = n.split("/")
        f = parts[-1][:-4]
        base = re.sub(r"^\d+-icon-service-", "", f)
        cat = parts[-2] if len(parts) > 2 else "Azure"
        lib.add("azure/" + slug(base), nice(base), "azure", cat.title(), "plain", z.read(n))


def build_gcp(lib, z):
    for n in sorted(z.namelist()):
        if n.endswith(".svg"):
            base = n.split("/")[-1][:-4]
            lib.add("gcp/" + slug(base), nice(base).title(), "gcp", "Google Cloud", "plain", z.read(n))


def build_k8s(lib, folder):
    for f in sorted(folder.glob("*.svg")):
        lib.add("k8s/" + f.stem, K8S_NAMES.get(f.stem, f.stem), "k8s", "Kubernetes", "plain", f.read_bytes())


def build_logos(lib, tgz):
    with tarfile.open(tgz) as t:
        for m in t.getmembers():
            if m.isfile() and "/logos/" in m.name and m.name.endswith(".svg"):
                stem = m.name.split("/")[-1][:-4]
                lib.add("logo/" + slug(stem), nice(stem).title(), "logo", "Brand logos", "logo", t.extractfile(m).read())


def build_simple(lib, tgz):
    with tarfile.open(tgz) as t:
        data = json.loads(t.extractfile("package/_data/simple-icons.json").read())
        data = data if isinstance(data, list) else data["icons"]
        colour = {d["title"]: d["hex"] for d in data}
        for m in t.getmembers():
            if m.isfile() and m.name.startswith("package/icons/") and m.name.endswith(".svg"):
                svg = t.extractfile(m).read().decode("utf-8")
                title = re.search(r"<title>(.*?)</title>", svg)
                title = title.group(1) if title else m.name.split("/")[-1][:-4]
                hexc = colour.get(title.replace("&amp;", "&"), "000000")
                svg = svg.replace("<path ", f'<path fill="#{hexc}" ', 1)
                lib.add("si/" + m.name.split("/")[-1][:-4], title.replace("&amp;", "&"), "si", "Brand marks", "mono", svg.encode())


def build_lucide(lib, tgz):
    with tarfile.open(tgz) as t:
        for m in t.getmembers():
            if m.isfile() and m.name.startswith("package/icons/") and m.name.endswith(".svg"):
                stem = m.name.split("/")[-1][:-4]
                lib.add("generic/" + stem, nice(stem).title(), "generic", "Generic", "glyph", t.extractfile(m).read())


LICENSES = """# Bundled icons: sources and terms

All icons are bundled so builds never download anything and every diagram uses the same artwork.
Use them unaltered (no recolouring, cropping or redrawing of a vendor's icon).

| Prefix | Source | Terms |
|---|---|---|
| `aws/`, `aws/res/`, `aws/group/` | AWS Architecture Icons, aws.amazon.com/architecture/icons | AWS permits customers and partners to use these icons to create architecture diagrams. |
| `azure/` | Microsoft Azure architecture icons, learn.microsoft.com/azure/architecture/icons | Microsoft permits use in architecture diagrams, training materials and documentation; do not crop, flip or rotate. |
| `gcp/` | Google Cloud icons, cloud.google.com/icons | Google permits use to depict Google Cloud in architecture diagrams. |
| `k8s/` | Kubernetes community icons, github.com/kubernetes/community/tree/master/icons | Apache-2.0 / CC-BY-4.0 (Kubernetes project). |
| `logo/` | gilbarbara/logos (SVG Porn), github.com/gilbarbara/logos | CC0 1.0. The marks themselves remain the trademarks of their owners. |
| `si/` | Simple Icons, simpleicons.org | CC0 1.0, drawn in each brand's official colour; marks remain trademarks of their owners. |
| `generic/` | Lucide, lucide.dev | ISC licence. |

Trademark note: brand logos identify the product they belong to. Use a brand's logo only for that
product, never as decoration or to imply endorsement.
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", help="folder holding aws.zip azure.zip gcp.zip logos.tgz simple.tgz lucide.tgz k8s/")
    ap.add_argument("--fetch", action="store_true", help="download the sources into --src (default: a temp folder)")
    a = ap.parse_args()
    src = pathlib.Path(a.src) if a.src else HERE.parent / "_icon-src"
    if a.fetch:
        fetch(src)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    lib = Lib()
    build_aws(lib, zipfile.ZipFile(src / "aws.zip"))
    build_azure(lib, zipfile.ZipFile(src / "azure.zip"))
    build_gcp(lib, zipfile.ZipFile(src / "gcp.zip"))
    build_k8s(lib, src / "k8s")
    build_logos(lib, src / "logos.tgz")
    build_simple(lib, src / "simple.tgz")
    build_lucide(lib, src / "lucide.tgz")
    entries = sorted(lib.entries.values(), key=lambda e: e["id"])
    (OUT / "index.json").write_text(json.dumps(entries, separators=(",", ":")), encoding="utf-8")
    (OUT / "LICENSES.md").write_text(LICENSES, encoding="utf-8")
    counts = {}
    for e in entries:
        counts[e["vendor"]] = counts.get(e["vendor"], 0) + 1
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print("icons:", ", ".join(f"{k} {v}" for k, v in counts.items()), f"= {len(entries)} ({size / 1048576:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

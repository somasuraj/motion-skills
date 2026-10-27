---
name: motion-diagrams
description: Make clear, professional static diagrams with official icons, laid out automatically, as SVG and PNG in light and dark themes plus editable draw.io (.drawio) and Excalidraw (.excalidraw) files. Covers cloud architecture (AWS, Azure, Google Cloud, Kubernetes, vendor-neutral), DevOps toolchains with real tool logos (GitHub, SonarQube, Terraform, Docker, Jenkins…), flowcharts, swimlanes, sequence diagrams, state machines, ER data models, C4 diagrams, mind maps, roadmaps/timelines and org charts. Builds from a plain description, from infrastructure code (CloudFormation, CDK, Terraform, docker-compose, Kubernetes manifests), from Mermaid or PlantUML, or from a photo or sketch of a diagram. Use this skill whenever the user asks for a diagram, architecture diagram, flowchart, sequence diagram, ERD, data model, C4, mind map, roadmap, org chart, "draw.io", "excalidraw", "diagram my Terraform/CDK", or wants to redraw an existing diagram cleanly. Also use it to revise a diagram made with this skill. A diagram can also be embedded, built up step by step, in motion-slides decks and motion-videos films. Not for animated diagrams on their own (use motion-slides or motion-videos, which can embed these).
---

# Motion diagrams

Make a diagram as one short JavaScript script; `scripts/build.py` lays it out (ELK for graphs, purpose-
built layouts for sequence, ER, swimlane, mind map and timeline), draws it with the **icons bundled in the
skill** (8,506, no downloads: the AWS, Azure, Google Cloud and Kubernetes official packs and 5,360 brand marks,
plus Lucide glyphs for things that have no brand), fetches the real logo from the internet for any brand the library
lacks (`fetch_logo.py`, cached after the first time), checks it, and writes every output from one geometry:

| File | For |
|---|---|
| `name.svg`, `name-dark.svg` | docs, wikis, READMEs, Confluence (fonts and icons embedded, crisp at any size) |
| `name.png`, `name-dark.png` | chat, email, slides (2× pixel ratio by default) |
| `name.drawio` | editing in diagrams.net / draw.io / the VS Code extension / Confluence draw.io |
| `name.excalidraw` | editing in excalidraw.com (clean style) |
| `name.embed.js` | (on request) reuse in a motion-slides deck or motion-videos film, built up step by step |

## Files

- `scripts/build.py diagram.js [-o out/] [--formats svg,png,drawio,excalidraw,embed] [--fix]` — build and run the review
  round (numbered issues with fixes, `name.review.png`); `--fix` also tries layout variants and keeps the best;
  `--set key=value` overrides a config setting for one build (a document and a slide version from one script:
  `--name shop-doc --set aspect=none --set compact=true` beside `--name shop-slides --set aspect=slides`).
- `scripts/icons.py "words" [--vendor aws|azure|gcp|k8s|logo|si|web|generic] [--check id …]` — find icon ids. **Never guess an id.**
- `scripts/fetch_logo.py "Brand" [--domain site.com] [--url file] [--pick N]` — a brand the library lacks: finds its real
  logo online, cleans and caches it (`~/.motion-diagrams/icons`, id `web/<brand>`), writes a preview to check by eye.
  Network needed once per brand; builds after that stay offline. `--list` shows what is cached.
- `scripts/scan_infra.py <files or folder>` — resources, connections and suggested icons from CloudFormation/SAM/CDK
  output, Terraform, docker-compose and Kubernetes manifests.
- `scripts/check_editable.py <out folder>` — open the .drawio in diagrams.net and the .excalidraw in Excalidraw and
  screenshot them (network needed; use after changing exporters or when a user says a file looks wrong).
- `scripts/build_all.py <folder> -o out/` — build every script in a folder (regression check).
- `scripts/build_icons.py --fetch` — refresh the icon library from the vendors' newest packs (rarely needed).
- `references/api.md` — the diagram format: every kind, node, shape, group preset, edge option. **Read before writing a diagram.**
- `references/craft.md` — what makes a diagram clear, per kind, and the pre-delivery checklist. **Read before writing a diagram.**
- `references/inputs.md` — turning Terraform/CDK/CloudFormation, Mermaid, PlantUML, or a photo into a script.
- `references/embed.md` — using a diagram inside motion-slides or motion-videos.
- `examples/*.js` — one complete script per kind (AWS, Azure, GCP, Kubernetes, DevOps logos, C4, sequence, flowchart,
  swimlane, state, ER, mind map, roadmap, org chart). Copy how they are built, never their content.
- `assets/engine.html`, `assets/engine/*.js` — the engine (don't edit per diagram). `assets/icons/` — the icon library
  and `LICENSES.md`. `assets/embed-runtime.js` — the runtime inlined into `.embed.js` files.

## Workflow

### 1. Get the subject and the material

What should the diagram explain, and to whom? Their own material makes the best diagrams: infrastructure code,
a Mermaid or PlantUML block, a whiteboard photo, an existing diagram to redraw, a list of services. If there is no
subject at all, ask for it in one line and stop. With code or files, read them first (`scan_infra.py` for infra).

### 2. Ask only what is open, once

Ask in one round with the chat's question tool if there is one (`AskUserQuestion`, `ask_user_input_v0`), otherwise in
one short message; recommendation first, marked "(Recommended)". Skip what the request or material answers; skip
everything if the user says "just make it" or nobody is there to answer, then say in one line what you picked.

- **Kind**, only if ambiguous ("show how login works" could be a sequence or a flowchart): name the 2–3 that fit and
  what each shows.
- **Detail**: "Overview: the main parts and how a request flows, about 8–15 boxes (Recommended)" or "Detailed: every
  component, network boundaries and data stores, 15–30 boxes". For infra code this decides what you leave out.
- **Icons**, only for architecture with no stated platform: AWS / Azure / Google Cloud / vendor-neutral.
- **Where it goes**, only if unclear, because it sets the shape: "A document (Word/docx, wiki, Confluence) (Recommended
  when unsure)": natural shape, fits a page column; "Slides": framed to 16:9; "Both": build the document shape, and a
  second build with `aspect: 'slides'` under another `--name`.

Settle without asking: both themes (light and dark) and all four file types are always produced; direction
(left-to-right for flows, top-down for hierarchies); the user's names, labels and wording are used as given; a title
block (title plus a one-line `subtitle`) and, when lines carry different meanings, a legend. The shape follows the
destination: for slides `aspect: 'slides'` (16:9); for a document (docx, wiki, Confluence, README) no `aspect` and
`compact: true`, so the drawing keeps its natural shape and orientation with tighter spacing. A document is not a reason
to make a diagram vertical: keep the direction the content wants, and use `portrait: true` (grid) or `direction: 'down'`
only when a tall picture is asked for. If a detailed diagram is very wide for a portrait page, say so and suggest a
landscape page section in Word. For Word, insert the PNG (2× pixel ratio, sharp in print) or the SVG (Word 365 keeps
it vector). Cloud architectures with subnets across Availability Zones use the
AWS reference **grid layout** (`layout: 'grid'`: tiers as columns, AZs as rows, CIDRs on the subnet cells); CI/CD and
runbooks use **steps cards** with `step` on the edges that leave them (each line starts at its step's row).

### 3. Plan the diagram (in your head)

Read `references/craft.md` and `references/api.md` now. Decide the one question the diagram answers, then the
nodes (≤ 20 for an overview; split into two diagrams rather than cram), the boundaries that matter (account, region,
VPC, subnet, cluster, team), and the edges that tell the story, each labelled with what flows when it isn't obvious
("HTTPS", "orders", "SQL"). Left to right reads as a flow; group things that are deployed or owned together.

### 4. Find the icons

**Real logos wherever a node is a brand.** Every node that is a product, service, tool, framework, language, SaaS or
company gets its **official** icon or logo; a generic glyph only for things that have no brand (a user, a laptop, a
generic server, "the internet"). Read the node list once and mark which are brands before searching.

1. Search the bundled library first: `python scripts/icons.py "api gateway" "key vault" github sonarqube`. Use the
   vendor's own pack for that vendor's services (`aws/…`, `azure/…`, `gcp/…`, `k8s/…`), the tool's logo for tools
   (`logo/<brand>-icon` square mark, else `si/<brand>`).
2. **Not in the library? Fetch it from the internet**, don't fall back to a glyph:
   `python scripts/fetch_logo.py "Zitadel" --domain zitadel.com` (`--domain` whenever you know the vendor's site; it
   tries the site's own logo first, then the curated logo sets, the brand's GitHub organisation, Wikimedia Commons).
   It cleans the file, caches it on this machine and prints the id (`web/zitadel`) and a **preview sheet of every
   candidate**. Open the preview and confirm the chosen one is the brand's real, current mark (a name like "Port" or
   "Backstage" also matches unrelated things); if not, rerun with `--pick N`, or pass `--url` to the logo file from the
   vendor's press or brand page. A square mark fits a node; a wide wordmark only when there is nothing else.
3. Only if nothing official can be found (offline, or no logo anywhere) use a `generic/…` glyph and say so in one line.

Never use one vendor's icon for another's product, never recolour or crop a logo, and confirm ids with `--check` if
unsure. When you deliver, name the logos that came from the internet and where from (`fetch_logo.py --list`).

### 5. Write the script

Work in the user's project folder (`docs/diagrams/<name>.js`) or a scratch folder if there is none: `Diagram.config`
(title, kind, direction), groups, nodes, edges (or participants and messages, tables and relations, tracks and bars,
the mind-map tree). Order nodes in the order the story is told; the layout keeps that order where it can.

### 6. Build, then the review round (repeat until clean)

```bash
python scripts/build.py docs/diagrams/shop.js --fix    # -> docs/diagrams/shop/ shop.svg shop-dark.svg shop.png …
```

Every build ends with a **review round**. The checker lists numbered issues, each with where it is and the fix to
apply, and writes `name.review.png` (the diagram with a numbered marker on every issue) and `name.review.txt`:

- **errors** (the build fails): overlapping nodes or labels, text overflowing its shape, text over text, anything off the
  canvas, contrast under 3:1 in either theme;
- **warnings** (a reader would notice): lines crossing, a line through a node or a label, two lines on top of each
  other, a long detour, too many bends, contrast under 4.5:1.

`--fix` first builds the layout variants the script leaves open (placement, spacing), keeps the one with the fewest
issues and says which setting to add to `Diagram.config` so the script keeps it.

**The loop, at most three rounds:**
1. Read the report and **open `name.review.png`** (and `name.png`, `name-dark.png`).
2. For each issue, apply its fix in the script: reorder declarations, merge parallel links into one edge to a group or
   cell, `arrow: 'start'` for a link against the flow, a shorter label, `stack`/`band` in a grid, `spacing: 'roomy'`.
   Then fix what the checker can't judge: a group that reads wrong, too much in one picture, the wrong story.
3. Rebuild. Stop when it prints **VERIFIED** with no issues and the picture reads well.

If a warning truly can't be removed (a crossing the content requires), say which one and why when you deliver.
Never hand over a build with errors. Needs Python Playwright with Chromium (`pip install playwright && python -m
playwright install chromium`).

### 7. Deliver

Save the outputs next to the script in the user's project, open the PNG (or SVG) for them (`start "" file` on Windows,
`open` on macOS, `xdg-open` on Linux) and give the folder path. Say in one line which file is for what (SVG for docs,
PNG for chat and slides, .drawio / .excalidraw to edit by hand). Publish a hosted page only if the user asks for a link
and the environment has an Artifact tool; the files stay the deliverable. Mention anything you assumed or invented that
their material would replace (a guessed region, a placeholder name). No node-by-node summary.

### 8. In a deck or a film

When the diagram is for a motion-slides deck or a motion-videos film (or the user asks to animate one), build it with
`--formats svg,png,drawio,excalidraw,embed` and follow `references/embed.md`: paste the `.embed.js` into the deck or film
script, mount it in a slide's `anim`/clip or a film scene, and reveal it step by step from `t`. The static files still
come out for docs and handouts.

### 9. Revising

Edit the script and rebuild with the same name so links and embeds stay stable. Change only what was asked. A user editing
the .drawio or .excalidraw by hand owns that file from then on: say that rebuilding from the script would overwrite their
edits, and build to a new name if both are wanted.

## Rules that always hold

- Real, official icons and logos for every branded thing, unaltered: from the bundled library, else fetched with
  `fetch_logo.py` and checked by eye. A brand's logo only for that brand's product, never as decoration. Generic glyphs
  only for things without a brand, or when no official logo exists (and say so).
- Every diagram answers one question; anything that doesn't help answer it is left out.
- Labels are the user's words; names and numbers are theirs or clearly fictional; nothing presented as real that isn't
  (label a proposed design "proposed").
- Both themes must pass the check; never hand over a diagram whose report shows errors.
- Fit for a workplace audience.

## Minimal diagram

```js
Diagram.config({ title: 'Upload pipeline', kind: 'architecture' });
Diagram.node('user', { label: 'User', icon: 'generic/user' });
Diagram.group('aws', { preset: 'aws.cloud' });
Diagram.node('s3', { label: 'Amazon S3', sub: 'uploads', icon: 'aws/simple-storage-service', in: 'aws' });
Diagram.node('fn', { label: 'AWS Lambda', sub: 'make thumbnails', icon: 'aws/lambda', in: 'aws' });
Diagram.node('db', { label: 'DynamoDB', sub: 'image index', icon: 'aws/dynamodb', in: 'aws' });
Diagram.edge('user', 's3', 'PUT object');
Diagram.edge('s3', 'fn', 'event');
Diagram.edge('fn', 'db');
```

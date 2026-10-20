---
name: motion-slides
description: Make animated explainer presentations, with real 3D (three.js, bundled, offline) where depth is the point, as one self-contained HTML file. Each concept slide is a short animation the presenter clicks through step by step (pause points, a ready light, pause and replay); PowerPoint-style slides with a thumbnail panel by default, or a Prezi-style zooming canvas; speaker notes, timer, five switchable colour themes designed from the topic (light, dark, high contrast), images with credits, YouTube and interactive slides. Use this skill when the user asks for an animated, 3D, three.js, Prezi-like or zooming presentation, or animated slides that show an idea in motion, and whenever they want a deck to present from a browser rather than an editable PowerPoint file. Also use it to revise a deck made with this skill. Not for video files (use motion-videos) or editable .pptx.
---

# Motion slides

Make a talk as one HTML file. By default it presents like **PowerPoint**: full-screen 16:9 slides in
order, a left panel of slide thumbnails (click one to jump), and a gentle slide-in between slides.
For talks where the map itself is the story, `Deck.config({style: 'canvas'})` puts every topic on
one canvas with an overview, nesting and a camera that glides or zooms (Prezi-like). You write one JavaScript deck script; `scripts/build.py` inlines it into
`assets/deck.html` and gives one HTML file (fonts embedded) that presents in any browser, offline.

**The default deck is an animated explainer.** Every slide that explains something is an animation
that *shows* it (a file being overwritten, a commit landing on a timeline, a request travelling to a
server), written as one continuous timeline with **stops**: on arrival it plays to the first stop and
waits, and each click plays to the next, so the presenter explains one idea per click. Only the title,
section and closing slides are static. A small **ready light** in the corner tells the presenter
whether a part is still playing (a ring fills), ready for the next click (green) or done (grey), with a
dot per click on the slide.

Slides can be animated: a frame can hold a **clip** (a short film drawn live, scene by scene, that
plays once, loops like a GIF, or advances a scene per click), a scene that builds in **beats** on
clicks, or an embedded **video**. All of it is drawn by this skill's own runtime; nothing else is
needed. The camera is calm by default (short glides), with Prezi-style `zoom` and `fade` as options.

The presenter gets: → / Space / clicker to advance, ← back, **O** for the overview (click any
frame there to jump to it), **F** full screen, **N** a notes drawer with the next step and a timer,
**T** the slides panel (shown in a window, hidden in full screen until pressed), **Shift+→** finish
the playing part at once, **←** back one stop (shown instantly), **K** pause / **R** replay the part,
**I** the ready light, **S** video sound, **C** the theme picker (five themes), **L** the audience level (training decks), **`** the terminal drawer in decks that have one (a real shell in tabs for live demos,
when started from the presenter kit; **Ctrl+`** hides it), **B** the browser in decks that have one (local apps open in a panel under
the slide; websites open in the presenter's own browser, beside the deck), **E** the workbench in decks that have one (the demo folder's files, a VS Code-like editor and the terminal,
under the slide), **H** hide or show the current slide (also the eye on each
thumbnail: hidden slides are skipped while presenting), an auto-hiding control bar, swipe on touch screens, and
the step in the URL (`#7`).

To share a talk, the bar has **Download** (saves the deck as one `.html` file that presents offline
in Chrome or Edge, from a laptop or a USB stick: open it, press F) and **Print / PDF** (one slide per
page, at each slide's final state, for handouts).

## Files

- `assets/deck.html` — the runtime (canvas, camera, layouts, steps, presenter UI). Don't edit it per deck.
- `scripts/build.py deck.js -o talk.html` — one self-contained file; embeds Google Fonts and `asset()` images.
- `scripts/render.py talk.html --verify` — the full pre-delivery check (see step 5); also `--check`,
  `--stills all | 1,4,4@0.5,6+1.2 [--sheet]`.
- `references/deck-api.md` — the deck format, frames, layouts, path, nesting; §12 is 3D (`k.three`), §13 themes, §14 audience levels, §15 the terminal drawer (`data-send`), §16 the browser (`data-open`), §17 hidden slides, §18 the workbench (`edit: true`), §19 code languages (`Deck.langs`). **Read before writing a deck.**
- `assets/vendor/three.min.js` — three.js r170 (MIT), inlined by `build.py` only when a slide uses `k.three`.
- `assets/vendor/xterm/` — xterm.js 5.5 and its fit addon (MIT), copied by `kit.py` into `_present/term/` for the
  terminal drawer; never inlined in the deck.
- `assets/vendor/monaco/` — the Monaco editor 0.52 (MIT, the editor inside VS Code), copied by `kit.py` into
  `_present/monaco/` for the workbench; never inlined in the deck.
- `examples/mirror-3d.js` — a 3D slide with stops: segments assemble, turn, fold and turn gold.
- `references/craft.md` — how to make a zooming talk easy to follow. **Read before writing a deck.**
- `scripts/fetch_image.py "query" --list | --take N --name x --out images/` — openly licensed photos
  with their credits (deck-api.md section 11).
- `examples/media-slides.js` — a real photo with its credit, a YouTube slide, a quiz and a slider.
- `examples/animated-slides.js` — the default kind of deck: concept slides that are animations with stops, one idea per click.
  Copy how scenes are built, never their words or drawings.
- `examples/bean-to-cup.js` — a ring of five stops around a hub, one stop with nested detail, reveals and
  notes. Copy how it is built, never its words, palette or topic.
- `scripts/kit.py page.html` — the presenter kit: double-click launchers (Windows, macOS, Linux) that serve the page on
  127.0.0.1 and open it in its own app window, with the terminal drawer's shell; templates in `assets/launchers/`
  (`term.cs` is the Windows console bridge that `serve.ps1` compiles).

## Workflow

### 1. Get the subject and the material

What is the talk, who is it for, and how long will it run? Their own outline, figures, logos and
photos make the best decks. If there is no subject at all, ask for it in one line and stop.

### 2. First question: what is the presentation for?

Ask this before anything else (skip it if the request already says), with these three options; the
question tool adds "Other" by itself:

- **Training / workshop**: teaching a group. Follow "Training decks" below (audience levels, duration
  per level, labs, sample language, a per-level breakdown approved before building) and "Training
  sessions" in `references/craft.md`. This is how the GitHub Actions and SonarQube trainings were
  built: hook, objectives, explain → show → quick questions → scenarios → demo → knowledge check →
  recap and Q&A, trainer-technique notes, nothing on screen addressed to the presenter.
- **Knowledge sharing / brown-bag**: one topic in depth for colleagues. No levels, no objectives slide
  or knowledge check: a hook, the content as one story, a live demo slide where it fits, takeaways,
  then Q&A. Ask duration and the look questions, and, if there is a command-line demo, whether to add
  the live terminal (see Training decks).
- **Self-paced reading / self-learning**: read alone, with no presenter. Ask the depth (one level:
  beginner, intermediate or expert), the length and the look. Each slide carries its explanation on
  screen (a short paragraph beside or under the drawing, what a presenter would have said), each
  section ends with a short summary, there is a knowledge check at the end, animations play by
  themselves (looping where it helps), and the slides panel works as a table of contents. Make sure it
  prints well.

"Other" (a pitch, a status update…): ask what it is for and who will watch, then use the questions
below.

### 2b. Ask before building: Animation, 3D, Colors, Length

Don't guess what kind of deck the user wants. Ask once, in one round, with the chat's question tool
if there is one (it takes up to four questions; otherwise one short message with numbered options).
Put your recommendation first in each, marked "(Recommended)", and say in a few words what each
option means for the deck. Skip any question the request or their material already answers; skip
all of them only if the user says "just make it" or nobody is there to answer, and then say in one
line what you picked. Never ask again after the answer; decide whatever is left open.

- **Animation: how much should move?**
  - Every concept slide animated, one idea per click (Recommended for teaching and explainers)
  - Key slides only: a few animated diagrams, the rest clean bullet slides (quicker to present)
  - Static slides: text and pictures with points revealed per click, no animations
- **3D: should anything be in 3D?**
  - Only where depth helps: one or two slides (a structure, layers, a grid, an orbit) (Recommended)
  - No 3D: flat drawings only (smallest file, about 690 KB less)
  - 3D as a feature: several slides built around 3D objects
- **Colors: the default theme.** Every deck ships with **five themes** the viewer can switch
  between live (the theme button on the bar, or **C**; see "Themes" below), so this question only
  picks which one opens first. Offer the five you designed for this topic, the recommended one first,
  each named in a few words with its four main colours ("Developer console: near-black, signal blue,
  green for passing checks"). Their brand, if they have one, is one of the five.
- **Length**: minutes or slides (5 / 10 / 20 minutes ≈ 4–6 / 8–12 / 15–20 slides). If they gave an
  outline or slide-by-slide content, its slides are the length: skip this and follow it.

If the talk is a training or workshop, follow "Training decks" below first (its questions and an
approved breakdown come before anything is built), and "Training sessions" in `references/craft.md`
(hook, objectives, questions for the room, scenarios, knowledge check, recap).

Also settle, without asking unless it is unclear: **format** is slides (PowerPoint-style); offer the
canvas map only when they mention Prezi, zooming or a map. **Their content** (an outline, slide text,
speaker notes) is used as given: their slide order, their bullets as headlines and captions, their
notes as presenter notes; never rewrite it into your own outline. **Presenters**: one unless they
say otherwise; don't put names or "member" labels on slides they didn't ask for (a "Presented by"
placeholder is fine).

## Themes: five per deck, from the topic

Every deck has `Deck.themes([...])` with **five** themes, all designed from the topic and content
(not a stock list), and the deck's colours written as CSS variables so the picker recolours
everything live (deck-api.md §13). The five, as a rule:

1. **The deck's own look**, from the subject's world (below): usually the dark one.
2. **A light version** of it, for bright rooms and printing (the subject's own light UI if it has one:
   GitHub light, SonarQube light).
3. **A brand or subject variant**: the product's brand colours, or another face of the subject's world
   (a navy blueprint for pipelines, Sonar's purple).
4. **A warm "paper" light theme**, easy on the eyes for long sessions.
5. **High contrast (projector)**: black ground, white ink, bright saturated status colours.

Each theme sets every role the deck uses (ground, card, card2, edge, ink, dim, main, sky, accent,
red, amber, …, the dot grid, tinted fills, overlays, code colours, logo colours and 3D colours). On
a light theme, status colours get darker (green #1A7F37, not #3FB950) so they stay readable on
white; a real logo switches to its official colour version. `--verify` checks every theme renders
without errors with readable contrast, and writes `theme1.png … theme5.png`: look at each.

## Theme from the topic

Before asking the user anything, design the look from the subject itself, and offer that as the
first (recommended) option. Work it out in this order:

1. **The subject's own world.** Where does this topic live, and what does it look like there? Space:
   a deep night sky. Networking: a dark console, cool signal blues. Coffee: roasted browns and cream.
   History: paper, ink, a period typeface. Finance: crisp paper, green and red used only for gains and
   losses. Healthcare: calm whites and teals. Children's topics: bright, rounded, playful.
2. **Palette, in roles:** ground (background), main (shapes), ink (text, at least 4.5:1 on the ground)
   and accent (one job: highlights, the thing to look at). Take the colours from that world (the gold
   of Webb's mirror, the green of a commit dot), not from habit; mix tints from them rather than
   inventing new hexes.
3. **Background treatment:** the ground plus at most one quiet texture that belongs to the topic (a
   starfield for space, a dot grid for code, paper grain for history), never decoration for its own
   sake.
4. **Type:** a display face that would be at home in that world (technical, editorial, friendly,
   historic) over a plain text face; a mono face only where code or data appears.
5. **Motifs:** two or three recurring drawings the whole piece reuses (a laptop and a server; a
   telescope and a galaxy), drawn in one consistent style.

The user's brand or their own material (logo colours, a style guide, screenshots) overrides all of
this: use it as given. Otherwise, the other palette options you offer are honest alternatives (one
light if yours is dark), still suited to the topic. Say in one line why the look fits the subject.

### Training decks: levels, a breakdown, then approval

When the deck is a training, ask this round before the look questions (skip what the request
already answers; the question tool takes four at a time, so it may be two short rounds):

- **Audience level** (multi-select): Beginner, Intermediate, Expert; one, two or all three.
- **Duration per selected level**: e.g. Beginner 3 h, Intermediate 2.5 h, Expert 2 h (offer 1 h /
  2 h / 3 h / half day for each).
  Durations shape the plan (how much content per level); they are **never shown** in the deck: no
  minutes on the agenda, section or break slides, no durations in the level picker. The presenter
  manages the time.
- **Hands-on labs**, only if the topic is practical: participants do the labs on their laptops, the
  trainer demos them live, or none.
- **Sample language**, only if the topic involves code: offer the 2–4 that fit the topic.
- **Live terminal in the deck?** Only if there are live demos at the command line (labs demoed by the
  trainer, a demo slide): "Yes: a terminal drawer under the slides (` opens it), and commands on slides
  type into it on a click" or "No: demos happen outside the deck". Recommend Yes when the trainer demos
  live. Yes → `Deck.config({ terminal: true })` and `data-send` on the demo commands (deck-api.md §15);
  it needs the presenter kit, so the kit question at delivery is then answered.
- **Browser beside the deck?** Only if a demo happens in a web page (a dashboard, the Actions tab, an app on
  localhost): "Yes: links on slides open in your own browser beside the deck (B for any address)" or "No".
  Yes → `Deck.config({ browser: true })` (or `{ browser: { home: 'https://…' } }`) and `data-open` on the
  steps done in a browser (deck-api.md §16). Ask it in the same round as the terminal.
- **Workbench in the deck?** Only if demos change files (a workflow, a Dockerfile, a manifest, app code): "Yes: the
  demo folder's files, a VS Code-like editor and the terminal under the slide; code on slides gets Edit ↗" or "No".
  Yes → `Deck.config({ workbench: true })` and `edit: true` on the code panels a presenter changes live (deck-api.md
  §18). Ask it with the terminal and browser questions; never build it without a yes.
- **Demo projects?** With live demos, recommend one demo project per language that matches the slides (deck-api.md
  §20): stages per demo step, Reset to this slide, a demo setup that asks for the repo or server once and runs a
  pre-flight check. Yes → write and actually build the projects while building the deck.
- **Present from a remote Linux machine?** Only for hands-on decks whose demos need Linux (Docker, Kubernetes): an
  extra launcher runs everything there over SSH and shows the deck here (deck-api.md §21). Yes → `remote: true`.
- **Several sample languages?** If the audience uses different stacks, offer a Language picker (deck-api.md §19)
  instead of one language: every code sample then exists in each.
- **Anything to add or remove?** (free text; ask again after the breakdown).

Then show a **breakdown in chat, per level**: modules with times, and for each slide its number,
title and what it shows, marking each slide **shared** (all levels) or **level-only**, and noting
where a shared slide's wording differs by level. Give each level its own objectives, agenda, labs,
scenarios and knowledge check, and its own total time and slide count. **Build nothing until the
user approves**; revise the breakdown as often as they ask.

All selected levels go into **one deck** (`Deck.levels`, deck-api.md §14): a level button on the bar
(or **L**) switches the whole deck (slides, numbers, thumbnails, notes, print) and keeps the
presenter's place. Shared slides use per-level wording (`{beginner: …, expert: …}`) wherever the
level changes what should be said; level-only slides take `levels: [...]`. With one level, it is an
ordinary deck.

### 3. Plan the slides (in your head)

Read `references/craft.md` and `references/deck-api.md` (for slides, its "Laying out an animated
slide" section) now. One concept per slide; for each, write its beats: arrival plus one sentence per
click (3–5 clicks), each ending on a picture worth talking over. A title slide first, a short recap
last. For the canvas format instead, group the talk into 3–7 stops and nest only for a real "zoom in
for detail" moment. If the user asks for an outline first, give it in chat and wait.

### 4. Write the deck script

Work in a folder of its own (`talk-name/deck.js`). In order:

1. `Deck.config` — title, background (= ground), fonts (a `display` face over a `sans`, chosen for
   the subject; a `mono` for kickers if wanted), and `notes` for the overview.
2. `Deck.css` — the palette on `#stage` (`--ground --main --ink --accent`), type sizes, and classes
   for any custom `html` in frames. Frames are drawn at 1600 px wide, whatever their size on the map.
3. One `Deck.frame` per idea: `kick`, `title`, `sub`, `points` (revealed one per click), `html` for
   anything else (a figure, a quote, an `<img src="${asset('chart.png')}">`), `notes` for the presenter,
   `shape` (rect, circle, bracket, none), `parent` for nesting.
   Use a real photo (fetched with `fetch_image.py`, credited) where reality matters or the user
   asks; a YouTube slide (`youtube:`) for a video the talk should show; an `interactive` slide for a
   quiz or a "try it" moment. All in deck-api.md section 11.
   **Concept slides are animations by default**: give the frame a `clip` (scenes) with `stops`
   (deck-api.md section 10). Plan the explanation first as a list of beats, one sentence each ("one
   file", "you start saving copies", "they pile up", "which one is the latest?"); make each beat a
   stretch of the timeline 1–4 s long that ends on a picture worth talking over; put a stop at the end
   of each. 3–6 stops a slide. Write `notes` that number the clicks ("1: … 2: …") so the presenter
   knows what each click shows.
4. Slides: frames appear in the order written; nothing to place. Canvas: `Deck.layout(...)` places the
   top-level frames, and `Deck.path([...])` changes the route only if the default is wrong.

### 5. Build, verify, look — every slide finished before delivery

```bash
python scripts/build.py deck.js -o talk.html
python scripts/render.py talk.html --verify          # writes talk-folder/verify/: report, every step, a sheet per slide
```

`--verify` is the gate. It runs the static check, renders every step at rest and mid-animation, and
fails on: a scene that throws, text that overflows a frame or runs off the slide, a blank step, an
animation part that changes nothing, a step that draws differently twice. Then it presents the deck
live in a real browser (Edge or Chrome) twice, with default and with reduced motion: clicks through
every step, waits for each part to finish (the ready light), checks every step is reached with no
page errors, and tests the slides panel, Download (the saved file must open and present) and Print.

Then **look** at `verify/all-slides.png` and every `verify/slideNN.png` (each slide's clicks, at rest
and mid-animation). For each slide ask: does every click show a finished, readable picture? Does the
headline fit on one or two lines without colliding with the drawing? Is anything cut off, overlapping
or tiny? Does the animation explain the idea, one thing per click? Is the last click a picture worth
ending on? Fix what you see, rebuild, and run `--verify` again. **Deliver only when it prints
VERIFIED and every sheet passes your look.** Say in one line what you verified. Needs Python
Playwright (`pip install playwright && python -m playwright install chromium`) and Pillow; not
ffmpeg. `--check` and stills use Playwright's Chromium; the live run uses Edge or Chrome if installed
(else that Chromium). It takes a few minutes and prints progress. The sheets are captioned (step, at rest or
mid-animation); `all-slides.png` shows each slide finished. Open full-size `verify/stepNNN.png` files
when judging whether small text is readable.

### 6. Deliver

- The talk is the built `talk.html`: one self-contained file that works offline in any browser.
  Save it in the user's project folder (next to `deck.js`), open it in their default browser
  (`start "" talk.html` on Windows, `open talk.html` on macOS, `xdg-open talk.html` on Linux) and
  give its full path. This works in every coding agent; no hosting is needed.
- **Presenter kit: ask once** (with the question tool if there is one) whether they want double-click
  launchers; skip the question if they already said. Yes → `python scripts/kit.py talk.html`. It writes
  `Present (Windows).cmd`, `Present (Mac).command`, `Present (Linux).sh`, `How to present.txt` and a
  `_present/` folder next to the deck, plus `talk - kit.zip` to share. Double-clicking serves the deck
  on 127.0.0.1 and opens it in its own app window (Edge or Chrome, no tabs); closing the window stops
  the server. Windows needs nothing extra (PowerShell); macOS and Linux use Python 3. Served this way,
  YouTube slides play too (they refuse from a file), and, in a deck with `terminal: true`, the **terminal
  drawer** works: **`** opens a real shell under the slide (PowerShell on Windows, the login shell on
  macOS/Linux) for live demos and ssh, with tabs (+, Ctrl+Shift+T), **Ctrl+`** hides it, and clicking a
  command on a slide (`data-send`) types it there without pressing Enter. Mention that macOS asks for right-click → Open the first time, and that the plain HTML file still
  works on its own (everything but the terminal).
- Publish it as a hosted page (an Artifact tool or similar) only if the user asks for a link and
  the environment has such a tool; the file stays the main deliverable.
- Close briefly: the file path, the keys (→ next, ← back, T slides panel, F full screen, N notes),
  how to share it (Download for an offline file, Print / PDF for handouts, or simply send the HTML file), and an
  invitation to say what to change. (If you do publish it as an Artifact, declare
  `capabilities: {downloads: true}` so Download can save the file.) One sentence for anything you invented that their
  material would replace (placeholder figures, stand-in images). No frame-by-frame summary.

### 7. Revising

Edit `deck.js`, rebuild, keep the file name so the open tab and any shared copies stay stable. Change only what was asked. A
reviewer saying "step 7" means the deck's own counter; `--stills 7` shows it, and the step list in
`--check`'s output maps steps to frames.

## Diagrams (motion-diagrams)

When a slide needs a real diagram (cloud architecture with official AWS/Azure/GCP/Kubernetes icons, a DevOps
toolchain with tool logos, a sequence, flowchart, ER model, C4, org chart…), don't hand-draw it: make it with the
**motion-diagrams** skill and build it with `--formats svg,png,drawio,excalidraw,embed`. Paste the resulting
`<name>.embed.js` at the top of `deck.js`, mount it in the slide's `anim` with
`MotionDiagrams.mount(el, '<name>', {theme: 'auto', transparent: true})`, call `d.sync()` and
`d.play(t, plan)` in `render` to build it up one stop at a time (edges draw on, `d.packet()` sends a request
along a path, `d.focus()` dims the rest). It follows the deck's theme picker. Full recipe:
`motion-diagrams/references/embed.md`.

## Rules that always hold

- One idea per frame; ≤ 6 words a point; ≤ 5 points a frame. A frame that overflows is split, not shrunk.
- The camera serves the story: zoom in for detail, out for context, never a spin for its own sake.
- Content never depends on the camera's speed: everything readable once the move ends.
- Original work only: no known characters, logos or another company's material unless the user's own,
  or the user asks for the real logo of the product the talk is about: then take it from the vendor's
  official source (its site, repository or design-system package), unaltered, and say where it came from.
- Fit for a workplace audience; nothing presented as true that isn't (label mock figures as examples).

## Minimal deck

```js
Deck.config({ title: 'Launch plan', background: '#10151F', fonts: { display: { family: 'Sora', weights: [700] }, sans: { family: 'Inter', weights: [400, 600] } } });
Deck.css(`#stage { --ground:#10151F; --main:#3D7BFF; --ink:#F3F5F9; --accent:#FFB547 }`);
Deck.frame('title', { shape: 'circle', w: 1800, title: 'Launch plan', sub: 'Three steps to October.' });
Deck.frame('build', { kick: '01', title: 'Build', points: ['Finish the beta', 'Fix the top ten bugs'] });
Deck.frame('test', { kick: '02', title: 'Test', points: ['Fifty pilot users', 'Weekly feedback'] });
Deck.frame('ship', { kick: '03', title: 'Ship', points: ['Press on the 14th', 'Support rota ready'] });
Deck.layout('ring', ['title', 'build', 'test', 'ship'], { center: 'title' });
```

A delivered deck also writes its colours as variables and adds `Deck.themes([...])` with five themes
(deck-api.md §13); the minimal deck above leaves that out for brevity.

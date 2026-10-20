---
name: motion-videos
description: Make animated films in code — animations, motion graphics, animated explainers, kinetic type, logo reveals, product promos, demo videos, and longer pieces timed to a recorded voice-over, dialogue or song — as a self-contained HTML player (timeline, loop, tweaks, palettes, soundtrack picker, subtitles) with a generated music score, exportable to MP4 or GIF from the page itself. Use this skill whenever the user asks for an animation, a motion piece, an animated video, an intro or outro, an explainer video, a promo, a "video" of an idea, or wants to see something "in motion" or "animated", even if they don't say "film" or name a format. Includes real 3D (three.js, bundled, offline) for scenes where depth is the point; also use it when the user asks for 3D, three.js, or objects moving in space. Also use it to revise a film made with this skill.
---

# Motion videos

Make a film (usually 10–30 s; up to hours when asked) in which everything on screen is a pure function of time
`t`. You write one JavaScript film script; `scripts/build.py` inlines it into a player
(`assets/player.html`) that gives the viewer play/pause, loop, a timeline of numbered scene chips,
frame stepping, a synthesized score, a Tweaks/Style panel and an Export dialog (MP4 or GIF, made in
the browser). `scripts/render.py` checks the film, renders stills, and exports an MP4 with audio.

Because every frame is computed from `t`, the film scrubs, steps and exports identically every
time. Protect that property above everything else.

## Files

- `assets/player.html` — the runtime (stage, kit helpers, synth, timeline UI). Don't edit it per film.
- `scripts/build.py film.js -o film.html` — build one self-contained HTML file.
- `scripts/render.py film.html --check | --stills … [--sheet] | --mp4 out.mp4 [--fps 30] [--workers N]`.
- `scripts/cues.py audio.mp3 -o cues.json [--script lines.txt | --whisper] [--beats]` — time a film to
  recorded dialogue, narration or a song (kit-api.md section 7).
- `references/kit-api.md` — the film format and every helper; §10 is 3D (`kit.three`). **Read before writing a film.**
- `assets/vendor/three.min.js` — three.js r170 (MIT), inlined by `build.py` only when a scene uses `kit.three`.
- `references/craft.md` — motion craft rules and the pre-delivery checklist. **Read before writing a film.**
- `references/sound.md` — the score API and method. Read before writing the score.
- `examples/one-line.js` — a complete 30 s, six-scene film with a score. Copy how it is built,
  never its scenes, words, palette or times.
- `scripts/kit.py page.html` — the player kit: double-click launchers (Windows, macOS, Linux) that serve the page on
  127.0.0.1 and open it in its own app window; templates in `assets/launchers/`.

## Workflow

### 1. Get the subject and the user's material

What is the film about, and who will watch it? Their own material makes the best films: a logo,
screenshots, brand colours, font names, copy. If there's no subject at all, ask for it in one line
and stop.

### 2. Ask four questions, once: Style, Colors, Length, 3D

The look is the user's to choose. Ask once, together, using the chat's question tool if one is
available (e.g. `ask_user_input_v0` or `AskUserQuestion`); otherwise ask in one short message.
Skip any question the request already answers, and skip all of them if the user says "just make
it", "surprise me", or nobody is there to answer — then decide and say what you picked in a line.
Never ask again after the answer; whatever is left open, decide.

- **Style: 3–4 looks invented for THIS film**, each a 1–3 word name plus one line (≤ 12 words)
  anyone can picture: what's on screen, what it's made of, how it moves. Make them distinct
  directions (a material, a way of moving, a way of drawing, a point of view), not variations,
  and never a stock list like "Modern / Playful / Bold". The first is the one you'd pick. No
  colour words (Colors covers that). If the film shows their product, every look frames it
  rather than restyling it.
- **Colors: their colours first** if they have any (brand, logo, screenshots); otherwise a palette
  designed from the topic (see "Theme from the topic" below) as the first, recommended option; then
  palettes of your own (1–2), each four hex colours in role order: ground (background), main (shapes), ink (text,
  ≥ 4.5:1 on ground), accent (used sparingly). Offer at least one dark and one light ground, and
  make each palette distinguishable at a glance (different families for main colours).
- **Length**: three options ≤ 30 s (e.g. 15 / 20 / 30 s) plus "other". Longer when asked (up to
  three hours; kit-api.md section 8). If the user brings recorded audio, its length is the length:
  skip this question and run `scripts/cues.py` on it first.
- **3D**: "Only where depth helps (Recommended)" (an object turning, layers, an orbit, a product from
  several sides), "No 3D" (flat motion graphics; smaller file, faster export), or "3D throughout".
  Skip it when the subject is plainly flat (type, UI, charts) and say so in a line.

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

### 3. Plan the scenes (in your head, not as a document)

Read `references/craft.md` and `references/kit-api.md` now. Split the length into scenes: 3–4 for
20 s, 5–6 for 30 s, each one subject and one action, ≥ 1 s: an opening that reads at frame 0 →
the subject arrives → the thing happens → closer moments → an end card held ≥ 3 s. One continuous
action (one camera move, one cursor's errand) is one scene. Give each an `id`, a listener-friendly
`name` and a `dur`; durations sum to the chosen length. If the user asks for a storyboard first,
give it in chat and wait.

### 4. Write the film script

Work in a scratch folder (e.g. `/home/claude/<film-name>/film.js`). In order:

1. `Film.config` — title, size (1920×1080; vertical 1080×1920 for Reels/TikTok/Shorts), fps 60,
   background = the ground colour, fonts (a `display` face over a text face, chosen for the
   subject — think of where this film's lettering would be at home — not your habitual default).
2. `Film.css` — palette as CSS variables on `.mo-scene`, the ground, the type classes (`.words`,
   `.line`, `.sub`), and shared shape classes. Scenes use these classes rather than repeating
   inline styles, so a film-wide change is one edit.
3. One `Film.scene` per scene, fully finished: real shapes with fills, motion from the first frame
   to the last, lifelike easing, type entrances. Roughly 1.5–3.5 KB of code each.
4. `Film.score` last (read `references/sound.md`), unless the user asked for silence or the film
   runs on their own song. With recorded audio, `Film.audio` + `Film.cues` come first and scene
   durations come from the cues.
5. Two to five `Film.tweak`s for what the viewer is most likely to want to change (headline words,
   a name, the accent), and `Film.palette` with the film's palette first plus two or three others
   from step 2's options. Scenes read tweaks with `k.tweak(id)`; palette colours stay in CSS
   variables.

Shared drawing used by several scenes (a pen tip, a logo) goes in a helper function at the top of
the script.

### 5. Build, check, look

```bash
python scripts/build.py film.js -o film.html
python scripts/render.py film.html --check
python scripts/render.py film.html --stills 0,<scene ids…>,end --sheet --out stills/
```

Then **view `stills/sheet.png`** (and single stills where something looks off) and fix what you see:
text overflowing or overlapping, an empty frame 0, a scene that's static, a palette that doesn't
read. Repeat until the checklist at the end of `craft.md` passes. `render.py` needs Python
Playwright with Chromium (`pip install playwright && python -m playwright install chromium`) and
ffmpeg; if they can't be installed, deliver the HTML and ask the user to scrub through it.

`build.py` embeds the Google Fonts it names (needs network once); offline it prints a note and the page
loads them at view time, so stills may show fallback faces, which is expected.

### 6. Deliver

- The film is the built `film.html` (one file, no local dependencies). Save it in the user's
  project folder (next to `film.js`), open it in their default browser (`start "" film.html` on
  Windows, `open film.html` on macOS, `xdg-open film.html` on Linux) and give its full path. This
  works in every coding agent; no hosting is needed.
- **Player kit: ask once** (with the question tool if there is one) whether they want double-click
  launchers; skip the question if they already said. Yes → `python scripts/kit.py film.html`. It writes
  `Play (Windows).cmd`, `Play (Mac).command`, `Play (Linux).sh`, `How to play.txt` and a `_present/`
  folder next to the film, plus `film - kit.zip` to share. Double-clicking serves the film on 127.0.0.1
  and opens the player in its own app window (Edge or Chrome, no tabs), good for showing it to a client
  or on an event screen; closing the window stops the server. Windows needs nothing extra (PowerShell);
  macOS and Linux use Python 3. Mention that macOS asks for right-click → Open the first time, and that
  the plain HTML file still works on its own.
- Publish it as a hosted page (an Artifact tool or similar) only if the user asks for a link and
  the environment has such a tool; then declare `capabilities: {downloads: true}` so Export can
  save its file. The local file stays the main deliverable.
- The page exports MP4 or GIF itself (the download button). Render an MP4 here only when the user
  asks you for the file: `render.py film.html --mp4 film.mp4` (≈ 0.1–0.2 s per frame, 0.3–0.5 s with 3D; `--fps 30`
  halves the time; `--workers 4–8` for anything over a few minutes). Say roughly how long it takes.
- Keep the closing message short: the file path, that the player starts muted and the sound
  button turns music on, that Export and Tweaks are in the bar, and an invitation to say what to
  change (or use a chip's "Ask Claude for a change"). Add one sentence only for what
  you couldn't do as asked or what you invented that their material would replace (a stand-in logo,
  placeholder screenshots). No scene-by-scene summary.

### 7. Revising

Edit `film.js` and rebuild; keep the same file names so the open tab stays stable. Change only what was
asked. A request pasted from the player ("Motion film “…”, scene 6 “…” (scene id …), 0:41–0:47,
at 0:43: …") names the scene id and the moment; one listing "make these the new defaults" means
set those tweak defaults, move the chosen palette first, or reorder the scores. Reviewers often point at a moment ("at 0:12 the circle…"): map the time to the scene
(`--stills 12` shows it) before changing anything. Retiming a scene means checking the score's
times too.

## Diagrams (motion-diagrams)

When a scene needs a real diagram (cloud architecture with official AWS/Azure/GCP/Kubernetes icons, a DevOps
toolchain with tool logos, a sequence, flowchart, ER model, C4…), make it with the **motion-diagrams** skill and
build it with `--formats svg,png,drawio,excalidraw,embed`. Paste `<name>.embed.js` at the top of `film.js`,
mount it in the scene's `init` with `MotionDiagrams.mount(el, '<name>', {theme: 'dark', transparent: true})`,
and in `render(t)` call `d.play(t, plan)` (start the first step before 0 so frame 0 reads), `d.packet()` and
`d.focus()`; all pure functions of `t`, so scrubbing and export stay exact. Full recipe:
`motion-diagrams/references/embed.md`.

## Rules that always hold

- Everything visible is a function of `t`: no CSS animations or transitions, no timers, no
  `Date.now()`, no unseeded randomness. `render` is synchronous.
- Nothing flashes or hard-cuts more than three times a second.
- Original work only: no known characters, logos, film/game scenes or existing melodies; no other
  company's proprietary UI unless the user works there. Offer an original alternative and say so.
  Exception: when the user asks for the real logo of the product the film is about, use the vendor's
  official file (site, repository or design-system package), unaltered, and say where it came from.
- Fit for a workplace audience; nothing presented as true that isn't (label mocks as concepts).
- Names and numbers on screen are the user's or clearly fictional.

## Minimal film

```js
const { seg, eo, eob, lerp, TextFx } = kit;
Film.config({ title: 'Hello', background: '#14213D', fonts: { display: { family: 'Bricolage Grotesque', weights: [800] } } });
Film.css(`
.mo-scene { --ground:#14213D; --main:#FCA311; --ink:#F4F1EA; color:var(--ink); font-family:var(--sans, system-ui, sans-serif) }
.words { position:absolute; display:flex; flex-direction:column; gap:24px } .words > * { margin:0 }
.line { font-family:var(--display, sans-serif); font-size:180px; font-weight:800; line-height:1 }
`);
Film.scene('hello', {
  name: 'Hello', dur: 4,
  init(k) {
    k.stage.append(k.h('<div><svg viewBox="0 0 1920 1080" style="position:absolute;inset:0">' +
      '<circle class="hello-dot" cx="1460" cy="540" r="160" fill="var(--main)"/></svg>' +
      '<div class="words" style="left:200px;top:420px"><h1 class="line hello-head">Hello there.</h1></div></div>'));
    this.dot = k.stage.querySelector('.hello-dot'); this.head = k.stage.querySelector('.hello-head');
  },
  render(t) {
    TextFx.fadeFromRight(this.head, t, -0.5);
    const s = eob(seg(t, 0.4, 1.0), 1.8) * (1 + 0.015 * Math.sin(t * 2));
    this.dot.setAttribute('transform', 'translate(1460 540) scale(' + s.toFixed(4) + ') translate(-1460 -540)');
  },
});
```

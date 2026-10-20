# Deck format and API

Contents: 1. The deck script · 2. Frames · 3. Layouts · 4. Nesting · 5. The path and steps ·
6. Decorations and links · 7. Images · 8. The camera · 9. What breaks a deck ·
10. Animated slides: clips, beats and video · 11. Real images, YouTube and interactive slides · 12. 3D · 13. Themes · 14. Audience levels

## 1. The deck script

One `.js` file, inlined into `assets/deck.html` by `scripts/build.py`. It runs once, top to
bottom, describing the canvas; the runtime then lays it out and presents it.

```js
Deck.config({
  title: 'Bean to cup',               // page title and the counter's deck name
  background: '#1B1410',              // the ground, also behind the letterbox
  fonts: { display: { family: 'Fraunces', weights: [600, 700] }, sans: { family: 'Inter', weights: [400, 600] }, mono: 'JetBrains Mono' },
  notes: 'Presenter notes for the overview steps.',
  overview: true,                     // include the map in the route (default true)
  style: 'slides',                    // slides (default): PowerPoint-like, 16:9 slides in order with a thumbnail panel · canvas: a Prezi-like map
  panel: true,                        // the left slides panel (slides style; T toggles it)
  camera: 'calm',                     // calm (default): short glides, no detours · zoom: Prezi-style dives · fade: no movement
  returnToOverview: 'sections',       // back to the map after a stop with children (default) · true: after every stop · false: never
  reveal: true,                       // points appear one per click (default true; per frame: reveal)
  grid: true,                         // the faint dot grid behind the canvas, with a little parallax
  linkWidth: 12,                      // connector thickness in canvas units
});
Deck.css(`#stage { --ground:#1B1410; --main:#C8874A; --ink:#F6EEE4; --accent:#E8B04B } …`);
Deck.frame('id', { … });   Deck.layout('ring', [ids], { … });   Deck.path([…]);
```

The stage is 1920×1080 and is scaled to the window, so the deck looks the same on every screen.
Fonts named in `config` are embedded by `build.py`; CSS writes `var(--display)`, `var(--sans)`,
`var(--mono)`, `var(--serif)`.

**Theme variables** on `#stage`: `--ground --main --ink --accent` (set these), and derived
`--panel` (frame fill), `--line` (borders, connectors) and `--dim` (secondary text), mixed from them.

## 2. Frames

```js
Deck.frame('roast', {
  name: 'Roasting',                   // the slide's name in the panel, step list and notes (defaults to title)
  kick: '04 · Roast',                 // small label above the title (mono, accent)
  title: 'Heat makes the flavour',    // HTML allowed
  sub: 'Three common roasts.',        // a line under the title
  points: ['…', '…'],                 // bullets, revealed one per click unless reveal: false
  html: '<div class="stat">…</div>',  // anything else, after the points
  notes: 'What to say here.',         // presenter notes (N)
  shape: 'rect',                      // rect | circle | bracket | none
  w: 1600, h: 900,                    // size on the canvas (circles default to w × w)
  x: 0, y: 0, rotate: 0,              // centre and tilt; leave out to let a layout place it
  parent: 'stop-id',                  // nest inside another frame (section 4)
  reveal: true,                       // per-frame override of config.reveal
  cls: 'hub',                         // extra classes for Deck.css
});
```

- ids: lower-case letters, digits and `-`, starting with a letter.
- **A frame's content is always laid out on a 1600-px-wide page** (height 1600 × h / w), then scaled
  to the frame's size on the canvas. Write type sizes for that page: the defaults are a 104 px
  title, 44 px sub, 50 px points, 34 px kick — about 64 / 28 / 32 / 21 px on a 1080p screen once the
  camera fits the frame.
- Classes you can style: `.dk-frame`, `.dk-rect / .dk-circle / .dk-bracket / .dk-none`, `.dk-kid`
  (nested), `.dk-has-kids`, `.dk-in` (the content box, a flex column), `.dk-kick`, `.dk-title`,
  `.dk-sub`, `.dk-pts`.
- Content must fit: `render.py --check` reports any frame whose content overflows.

## Slides or canvas

`style: 'slides'` (the default) is for most talks. Every frame becomes a full-screen 16:9 slide in the
order written (children right after their parent, as their own slides); circles become plain slides;
layouts, links, decos placed under frames, nesting and the map are ignored. The left panel shows a
thumbnail of every slide (at its final state); the presenter clicks one to jump. The counter counts
slides. Download saves the deck as one HTML file; Print / PDF prints one slide per page.

### Laying out an animated slide (slides style)

A clip or anim draws on a page 1600 wide and 900 tall (`k.W`, `k.H`), which fills the screen: on a
1080p display it is drawn at **×1.13**, so a 68 px headline shows about 77 px tall. Use these bands
and you will avoid almost every collision:

| band | y on the 1600×900 page | what goes there |
|---|---|---|
| headline | 60–190 | one line, 60–76 px display font, ≤ 7 words; a second line only if unavoidable |
| picture | 220–760 | the drawing; keep 110 px clear on the left and right |
| caption | 770–840 | one sentence, 34–40 px, centred; it may change per click (`kit.say`) |
| keep clear | below 840, and the bottom-left 260×110 | the control bar appears bottom-centre and the ready light bottom-left |

- Smallest text: 26 px on the page (about 29 px on screen), including SVG labels. Labels under icons
  28–32 px.
- Draw with SVG in a `viewBox="0 0 1600 900"` filling the page, and position HTML boxes absolutely in
  the same coordinates. Absolutely positioned content (in `html`, a clip or an anim) is placed from the
  frame's edges, not from the padded text box, so `left:0;top:0` is the slide's corner. Give each moving thing a fixed resting place that collides with nothing at
  any stop; check each stop's still.
- SVG colour: a CSS rule like `.label { fill: … }` beats a `fill="…"` attribute. Write
  `.label:not([fill])` (or use `style="fill:…"`) when some labels carry their own colour.
- Text set with `textContent` must not be pre-escaped (`&amp;` would show literally); text put in
  `innerHTML` must be escaped (`kit.esc`).
- The deck script runs in its own block, so its names never hide the browser's; still prefer clear
  names (`ADDR`, not `URL`).

`style: 'canvas'` is the map: everything in sections 3–8 applies (layouts, nesting, overview,
camera styles). Choose it only when the shape of the map carries meaning.

## 3. Layouts (canvas style)

`Deck.layout(kind, ids, options)` places the listed frames (all top-level frames if `ids` is
empty). Frames given an explicit `x` stay put unless `force: true`. Several layouts may be combined,
e.g. a ring with a timeline frame placed by hand beside it.

| kind | places | options |
|---|---|---|
| `ring` | a hub in the middle, the rest on an ellipse round it, spokes drawn | `center` (id), `radius`, `squash` (0.78), `start` (−90°, top), `tilt` (alternating degrees), `centerScale`, `connect` |
| `path` | a winding road left to right, curves drawn between stops | `gap`, `amp` (wave height, 0.55), `tilt`, `connect` |
| `timeline` | stops above and below an accent axis with a dot each | `gap`, `connect` |
| `tree` | the first id at the top, the rest in a row below, elbow connectors | `gap`, `dy`, `connect` |
| `grid` | rows and columns | `cols`, `gap`, `gapY` |

## 4. Nesting

`parent: 'id'` puts a frame inside another. Unless given `x`, children are placed in a row in the
lower part of the parent (the parent's own title and sub sit above them), drawn with a tint
(`.dk-kid`). The route visits the parent, then each child, so the camera zooms in for the detail and
back out. Keep nesting to two levels below a stop (three at most): each level is a further 4–8×
zoom, and text on very deep frames turns blurry while the camera moves.

## 5. The path and steps

The default route: the first frame (the title), the map, then each top-level stop with its children,
back to the map between stops (`returnToOverview`), and the map again at the end. Override it with
the ids in order, `'overview'` wherever the map should appear:

```js
Deck.path(['title', 'overview', 'build', 'test', 'overview', 'ship']);
```

Each frame on the path is one step, plus one step per point when it reveals points. The counter
shows steps (`7 / 24`) on a canvas and slides (`5 / 14`) in slides style. Links follow the counter:
`#5` is slide 5 (slides) or step 5 (canvas), and `#5.2` is click 2 on slide 5. `render.py` numbers
steps, as its step list shows. Points stay shown once
revealed, so the map fills in as the talk goes. Frames not on the path are still on the map.

## 6. Decorations and links

```js
Deck.deco('<div style="position:absolute;inset:0;border-radius:50%;background:var(--accent)"></div>', { x: 0, y: 1200, w: 300, h: 300, under: true });
Deck.link('build', 'test', { curve: true, dash: '30 24', width: 10 });   // also: elbow: true
```

A deco is any HTML on a 1600-px page placed like a frame (`under: true` puts it below frames). Decos
count toward the overview's bounds. Links join frame centres and are drawn under the frames.

## 7. Images

`asset('photo.jpg')` with a path relative to the deck script is embedded by `build.py` as a `data:`
URI: `html: '<img src="' + asset('photo.jpg') + '" style="width:100%;border-radius:24px">'`. Use
1920-px-wide JPEGs or PNGs; a page over ~15 MB may be refused when hosted.

## 8. The camera

A frame's view fits it to the screen with 6 % margin, turned so the frame is level. A hop between two
views interpolates the centre, the zoom (in log space) and the turn (the short way round). Three
styles (`Deck.config({camera})`):

- `calm` (default): neighbouring frames glide (0.5–0.9 s) with no pull-back; a jump of more than about
  1.5 screen widths fades instead, so nobody chases the camera across the map. The map appears at the
  start, between sections (stops with children), at the end, and on **O**. Best for most talks: the
  content moves, the camera doesn't.
- `zoom`: the Prezi feel. Long hops dip out to show both ends, then dive in (0.55–1.7 s), and the
  route returns to the map between stops. Use when the map itself is the story.
- `fade`: no camera movement; a quick fade between frames.

New points fade in after the camera settles. Clicking a frame in the overview jumps to it.

## 9. What breaks a deck

- A frame that overflows: split it, or shorten it. Never shrink type below the defaults to cram.
- Unbalanced quotes or tags inside `html` strings (single-quoted JS strings, double-quoted attributes).
- Remote images or scripts: everything must be in the file. Use `asset()`.
- Deep nesting (see section 4), or huge frames next to tiny ones on the same level: the overview
  turns into specks.
- A `Deck.path` naming a frame that doesn't exist (the deck shows an error card; `--check` reports it).

## 10. Animated slides: clips, beats and video

A slide can carry its own animation, drawn live in the deck (no video file, no other skill): the
same technique as a motion film, where everything on screen is a function of time `t`. The motion
kit is built into the runtime as `kit` (`seg`, `lerp`, eases `eo eio eob`, `draw(path, p)`,
`TextFx.fadeFromRight/riseIn`, `typist`, `rng`, `h()`…). Rules as for films: `render` sets
everything from `t` alone, no CSS animations or timers, no `Math.random()`.

**Stops** (the default way to animate a concept slide): write the slide's animation as one
continuous timeline, then list the seconds where it should pause for a click.

```js
Deck.frame('mess', { name: 'Life before version control',
  notes: 'Four clicks. 1: one file. 2: copies start. 3: they pile up. 4: which one is the latest?',
  clip: { stops: [3.2, 4.55, 7.4], scenes: [ /* scenes as below, played as one timeline */ ] } });
// or one scene: anim: { dur: 9, stops: [2, 5], init(k) { … }, render(t, k) { … } }
```

One continuous scene is often the simplest form (no scene boundaries to manage):

```js
Deck.frame('dns', { name: 'DNS lookup',
  notes: 'Arrival: the name. Click 1: ask the resolver. Click 2: the answer comes back. Click 3: saved for next time.',
  anim: { dur: 10, stops: [2.5, 5.5, 8],
    init(k) { k.stage.innerHTML = '<div class="pg"><h2 class="hl"></h2><svg viewBox="0 0 1600 900">…</svg><p class="cap"></p></div>';
      this.hl = k.stage.querySelector('.hl'); this.cap = k.stage.querySelector('.cap'); /* … */ },
    render(t, k) {
      kit.say(this.hl, [[0, 'Computers find each other by number.'], [5.5, 'The answer comes back.']], t);
      kit.say(this.cap, [[.4, 'DNS is the phone book.'], [2.6, 'Ask the resolver.'], [8.1, 'Saved for next time.']], t);
      /* everything else a function of t */ } } });
```

- **Arrival plus clicks.** On arrival the timeline plays from 0 to the first stop and holds (no click
  needed); each click then plays to the next stop, and the last click plays to the end. So a slide
  with 3 stops has 3 clicks after arrival (4 pictures). `wait: true` holds at 0 until the first click.
  Number notes the same way: "Arrival: … Click 1: … Click 2: …".
- **Ambient motion** (things that are continuous in reality: sunlight streaming, heat radiating, a
  wave travelling, data flowing, an orbit, a pulse): add `ambient: true` to the `anim` or `clip`, and
  drive that motion from `k.clock`, the seconds since the slide appeared, which keeps running through
  stops and clicks until the slide is left (K pauses it). Keep the explanation itself on `t`.
  ```js
  anim: { dur: 8, stops: [2, 5], ambient: true, init(k) { … },
    render(t, k) {
      ray.style.strokeDashoffset = String(-k.clock * 60);          // flows forever while the slide is up
      glow.setAttribute('r', String(60 + 4 * Math.sin(k.clock * 2)));
      label.style.opacity = String(kit.seg(t, 2, 2.5));              // the explanation still waits for clicks
    } }
  ```
  Loop only what is continuous in the thing being shown, gently (a slow drift, not a flicker); text
  and the step's own changes never loop. In stills and `--verify`, `k.clock` equals `t`, so they stay
  repeatable.
- `kit.draw(path, p)` draws a line on by animating its dash pattern, so it replaces a path's own
  `stroke-dasharray`: to draw on a dashed line, reveal it with a clip or mask (or fade it) instead.
- `kit.say(el, [[t0, 'text'], …], t)` shows the text whose time has come (the new text fades in over
  0.3 s; the old one stays fully visible until its cue, so a cue exactly on a stop is safe). Use it for a
  headline or caption that changes per click (TextFx caches word spans, so it can't redo changed text).
- ← goes back one stop and shows it at once; Shift+→ finishes the playing part; K pauses, R replays
  the part. The ready light shows a dot for arrival and one per click.
- `render(t)` sees the whole timeline (`k.part` is the current part), so write it as one film:
  everything a pure function of `t`. A stop that falls on a scene boundary rests on the finished
  scene, not the next one's first frame.
- Put stops where a picture is complete and worth talking over; check each with
  `render.py --stills N` (a step at rest is the end of its part).

**A clip** is a short film on a slide, made of scenes:

```js
Deck.frame('mess', { name: 'Life before version control', notes: '…',
  clip: { play: 'once', scenes: [            // once (default) · loop (like a GIF) · click (one scene per click)
    { name: 'One file', dur: 3.2,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">You start a project.</h2><svg viewBox="0 0 1600 900">…</svg></div>'; this.d = k.stage.querySelector('.doc'); },
      render(t, k) { /* t: seconds into this scene */ } },
    { name: 'Copies', dur: 4.2, init(k) { … }, render(t, k) { … } },
  ] } });
```

- Each scene draws into its own `k.stage`, a 1600-px-wide page (`k.W`, `k.H`) filling the frame.
- `play: 'once'` plays through when the camera lands and holds its last frame; `'loop'` repeats
  like a GIF; `'click'` shows scene 1 on arrival and plays one more scene per click.
- In the overview and on frames not in view, a clip shows its poster: the last frame (`poster`
  seconds to choose another).

**Beats** (`anim`) are for one scene that builds on clicks: `anim: { beats: 2, init(k), render(t, k) }`.
`k.beat` is the current beat (0 on arrival), `t` the seconds since it began, and `k.b(n, a, b)` the
progress 0..1 of beat `n`'s animation between `a` and `b` seconds (1 once that beat is past).

**Video**: `video: asset('clip.mp4')` (or `{src, loop, fit, start, speed, poster}`) plays a real
video, muted and looping, when the camera lands; **S** toggles its sound. `build.py` embeds it, so
keep clips small (720p, a few MB).

**Presenter controls** on any animated slide: **K** pauses and resumes, **R** replays the part,
**Shift+→** finishes it, **I** toggles the ready light (bottom-left: a filling ring while playing,
green when the next click continues, grey when the slide is done, a dot per click). Notes (**N**) also
say "Playing… 2.1 s left" or "Ready".

**Checking**: `render.py --verify` (SKILL.md step 5). `--stills 5+2.4` shows step 5 with its
animation 2.4 s in. Verify catches crashes, text off the slide or cut off by its box, escaped HTML
showing, blank steps, parts that change nothing and live-presenting failures; it cannot judge whether
a picture is clear, crowded or explains the idea. That is what your look at the sheets is for.

**Craft**: one idea per scene, headline first, then the picture moves; 3–5 s per scene; hold the
final picture long enough to talk over; prefer `once` or `click` for teaching (the presenter sets
the pace) and `loop` only for ambient illustrations.

### Typing commands (terminals, code typed live)

Anything the audience should see being *written* (a command in a terminal, a line of code, a search query) types
itself out: mark the element `data-type` and its output `data-after`.

```js
'<div class="term"><div data-type><span class="pr">$ </span>docker run -d -p 8080:80 nginx</div>' +
'<div data-after>3f9c2a71d0b8…</div></div>'
```

- In an animated slide (with stops) the runtime does the rest: each `data-type` element types out (about 30
  characters a second, 0.3–1.5 s, with a caret) from the moment it first becomes visible, the next command in
  the same panel waits for the one before, and a `data-after` line appears once the command above it has finished.
  Typing always ends before the next stop, so a slide never rests on a half-typed command. Colours and markup
  inside the line are kept; a child with class `pr` (the prompt) shows when its line's turn comes.
- Reveal the panel or the lines as usual (fade, rise, `showLines`): the typing follows what your render shows.
- By hand: `kit.type(el, p)` (p 0..1) inside render.
- Use it for every terminal or command panel; static code samples (a whole Dockerfile) can still build line by line.

## 11. Real images, YouTube and interactive slides

### Real images (with their licence)

Use a real photo when reality matters (a place, a real object or machine, a historical moment, a
person the talk is about, the user's product) or when the user asks; draw concepts. Get images only
from `scripts/fetch_image.py`, or from the user:

```bash
python scripts/fetch_image.py "james webb mirror" --list                 # numbered candidates: title, licence, author, size, source
python scripts/fetch_image.py "james webb mirror" --take 3 --name mirror --out images/
```

It searches Wikimedia Commons and Openverse (no key; Openverse allows ~20 searches a minute, 200 a
day), offers only public domain, CC0, CC BY and CC BY-SA, checks the download is really an image,
resizes it (1600 px wide by default) and records title, author, licence and source in
`images/credits.json`. Never use an image found any other way, and never logos, brand marks or photos
of private people.

```js
Deck.credits('images/credits.json');        // build.py inlines it; adds an "Image credits" slide at the end
Deck.frame('mirror', { name: 'The mirror', credit: 'mirror.jpg',     // a credit line on the slide
  shape: 'none', html: '<img src="' + asset('images/mirror.jpg') + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' });
```

CC BY and CC BY-SA require the credit: give every image slide `credit:` and keep `Deck.credits`. The
credits slide (`data-id="credits"`) lists them in two columns past three images; restyle it with
`.dk-frame[data-id=credits]` if needed. A maker's insignia that is part of the real object in an official
photo (NASA's on a spacecraft) is fine; never put a logo or brand mark in as a subject or decoration,
except the real logo of the product a talk is about when the user asks for it: then embed the vendor's
official SVG as markup (not through `fetch_image.py`), unaltered.
`--preview` shows a numbered sheet of the candidates before you pick one.
`--verify` fails on any embedded image missing from the credits. Images make the file heavier
(~150–600 KB each); a published page is limited to about 15 MB.

### YouTube

```js
Deck.frame('mirror-video', { name: 'Unfolding the mirror', youtube: { id: 'VIDEO_ID', title: 'How the mirror unfolds (NASA)', start: 12, end: 70 } });
```

- `build.py` embeds the video's real thumbnail, so the slide always shows a proper card: thumbnail,
  play button, title and "Watch on YouTube ↗" (opens the video in a new tab).
- When the slide is shown and the deck is served from a website (an intranet, GitHub Pages, any web
  server), the YouTube player loads over the card; leaving the slide removes it (the video stops).
- Opened as a downloaded file (`file://`), YouTube refuses to play (its "Error 153"), so the card stays
  and says so: click it to watch on YouTube. The presenter kit (`scripts/kit.py`) serves the deck on
  127.0.0.1 from a double-click, and there the video plays in the slide. The claude.ai link has not been verified to play embeds;
  the card's link always works.
- Once the presenter clicks inside the player, the keyboard belongs to YouTube; click outside the
  video (or use the bar) to get →/← back.
- Use only videos the talk may show (the user's own, or official channels); YouTube's own embed
  terms apply.

### Interactive slides

A slide can hold live controls: a quiz, a slider that changes a drawing, a clickable diagram. Their
state is the viewer's, not a function of `t`.

```js
Deck.frame('quiz', { name: 'Quiz', title: 'Why is the mirror gold?', interactive: {
  init(k) { /* build controls into k.stage (a 1600-wide page), wire their events */ } } });
```

- Clicks inside the controls never advance the slide; with a control focused, its own keys work
  (arrows move a slider, Space/Enter press a button) and **Esc** gives the keyboard back to the deck.
- A frame can have `anim` and `interactive` together (the controls sit above the animation).
- Thumbnails and Print show the controls as they are, inert. The state resets on reload.
- `--verify` checks the slide builds without errors and has controls; it can't judge whether the
  interaction teaches anything, so try it yourself in the browser (or describe it in notes).
- Look at `examples/media-slides.js` for a photo slide, a YouTube slide, a quiz and a slider.

## 12. 3D with three.js (`k.three`)

This skill bundles three.js r170 (MIT, `assets/vendor/three.min.js`). `build.py` inlines it (about
690 KB) only when the script calls `k.three` / `kit.three`, so flat decks cost nothing extra.
The page stays one offline file.

```js
init(k) {
  const v = k.three(k.stage, { fov: 35, dist: 10 });   // { THREE, scene, camera, render, canvas }
  const T = v.THREE; this.v = v;
  this.cube = new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshStandardMaterial({ color: 0x5aa9ff }));
  v.scene.add(this.cube);
},
render(t, k) {
  this.cube.rotation.y = kit.eio(kit.seg(t, 0, 3)) * Math.PI;   // a pure function of t
  this.v.render();                                              // always last
}
```

- In decks call it as `k.three(...)` (the slide's `k`), so the canvas matches the slide's size.
- `k.three(host, opts)` adds a canvas to `host` covering the slide (`w`, `h`, `x`, `y` in slide
  pixels to place it elsewhere) and returns `THREE`, a `scene`, a `camera` (perspective, `fov`
  default 35, at `z = dist`, default 10, looking at the origin), `render()` and the `canvas`. The
  background is transparent: the slide background shows through, and HTML text placed after the canvas sits
  on top. Default lights (a hemisphere and one key light) unless `lights: false`. `scale` (default
  1.5) sets the canvas's pixel density; raise to 2 for fine detail.
- Call `render()` at the end of every `render(t)`; the picture changes only then. Build all
  geometry and materials in `init`; in `render` only set positions, rotations, colours, opacity.
- **Everything is a function of t**: no `THREE.Clock`, no `requestAnimationFrame`, no
  `setAnimationLoop`, no `Math.random()` (use `kit.rng(seed)`). An `AnimationMixer` only via
  `mixer.setTime(t)`; shader time uniforms from `t` or `k.clock` (ambient).
- One WebGL renderer is shared by every 3D view on the page (browsers allow about 16 WebGL
  contexts), so any number of 3D decks is fine. Its pictures are copied into each view's canvas,
  so the thumbnails, Print / PDF and stills show the 3D as well.
- Keep models code-built (boxes, cylinders, spheres, tubes, extrusions, lathes). No external model
  files (glTF) or textures from the web; a texture can be drawn on a 2D canvas and wrapped with
  `CanvasTexture`.
- If WebGL is unavailable the view shows a line saying so and logs an error, which fails `--check`.
- `v.project([x, y, z])` (or a `Vector3`) gives `[x, y]` in slide pixels for the camera as it is
  now: use it to pin an HTML label to a 3D object after moving the camera in `render`.
- Palette colours: set them in `render` from `k.cssVar('--accent')` (`mat.color.set(k.cssVar('--main'))`),
  so the 3D follows the palette. Cache the string and only call `set` when it changes.
- Lights: the defaults suit a single object. When the scene has its own light source (a Sun, a lamp)
  pass `lights: false` and add your own (`PointLight` at the Sun, a dim `AmbientLight`); make the
  source itself glow with `MeshBasicMaterial`.
- The 3D canvas stacks in page order, like any element: add backgrounds (a starfield, a ground)
  **before** calling `k.three`, and captions and labels **after** it. A caption that must be
  created first gets `position:relative; z-index:1` (or higher) so the 3D never covers it.
- Options: `fov` (35), `dist` (10, camera on the z axis), `target: [x, y, z]` (where the camera
  looks; the default is the origin), `w`/`h`/`x`/`y` (canvas box), `scale` (1.5), `lights`.
  Scale: at the target's depth one unit is about `h / (2 * dist * tan(fov / 2))` pixels (900 / (2 x 10
  x 0.315) ≈ 143 px for a 900-high slide with the defaults). Plan the object's size in units from that
  and leave the caption's band clear (aim it with `target`, not by moving the model).
- `lights`: default is a hemisphere light (1.4) plus a key `DirectionalLight` (2.4) from upper right
  front. `lights: 'sun'` puts a `PointLight` with no falloff at the origin plus a dim ambient light, for
  a Sun at the centre of an orbit (three.js point lights fade with distance by default; set
  `decay: 0` on any you add yourself). `lights: false` for your own. Make a light source glow with
  `MeshBasicMaterial`.
- A texture drawn on a 2D canvas: `const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;`
  (without the colour space it looks washed out). Use `kit.rng(seed)` for any noise in it.
- three.js is inlined when the script calls `k.three(` or `kit.three(`; set `three: true` in the
  config to force it.
- 3D renders in software in `render.py` (about 0.3–0.5 s a frame): `--verify` takes a little longer with several 3D slides.

When to use 3D: when depth is the point (a structure seen from several sides, something that folds,
orbits, stacks or nests in space, a molecule, a machine). Use flat SVG for diagrams, flows and
charts. Turn the camera slowly and only on a stop or with `ambient`; the explanation stays in the
caption. Example: `examples/mirror-3d.js`.

## 13. Themes (`Deck.themes`)

Every deck offers five themes, switched live from the bar's theme button (or **C**; ↑/↓ and Enter
in the picker, Esc closes). The choice is remembered per deck in the viewer's browser, and
`?theme=N` in the URL opens theme N (0 = the deck's own).

```js
const C = { ground: 'var(--ground)', card: 'var(--card)', ink: 'var(--ink)', main: 'var(--main)', accent: 'var(--accent)', red: 'var(--red)' /* … */ };
Deck.config({ title: 'Launch plan', background: '#10151F' });           // a real colour: the first paint and print
Deck.css(`#stage { --ground:#10151F; --card:#171E2B; --ink:#F3F5F9; --main:#3D7BFF; --accent:#3CCB7F; --red:#F0626A; --grid:#1A2233 }
.dk-rect { background:var(--ground) radial-gradient(circle, var(--grid) 1.6px, transparent 1.8px) 0 0 / 40px 40px }`);
Deck.themes([
  { name: 'Night launch (dark)', vars: { '--ground': '#10151F', '--card': '#171E2B', '--ink': '#F3F5F9', '--main': '#3D7BFF', '--accent': '#3CCB7F', '--red': '#F0626A', '--grid': '#1A2233' } },
  { name: 'Daylight', vars: { '--ground': '#FFFFFF', '--card': '#F4F6FB', '--ink': '#1A1F36', '--main': '#1F5FD6', '--accent': '#0B8045', '--red': '#C62F3B', '--grid': '#E3E8F2' } },
  // … three more: a brand or subject variant, a warm paper light theme, high contrast
]);
```

- **Every colour is a variable.** In CSS use `var(--x)`; in drawings built in JS use the `C` values
  (`fill="' + C.main + '"'` becomes `fill="var(--main)"`, which SVG accepts). No hex colours in slides,
  except colours that mean the same in every theme (rating letters A–E, a glow).
- **Tints and overlays are variables too**: `--okbg` (a green-tinted fill), `--warnbg`, `--overlay`
  (a full-slide panel over a drawing), code colours (`--syn-k`, `--syn-s` …), logo colours.
  Translucent highlights such as `rgba(47,129,247,.16)` work on light and dark grounds alike.
- **3D materials need real colours**: `const hex = v => v.startsWith('var(') ? kit.cssVar(v.slice(4, -1)) : v;`
  create materials with `hex(C.main)`, keep `[material, C.main]` pairs, and in `render` re-set them
  when `kit.cssVar('--ground')` changes (that is the theme changing).
- Each theme sets **all** the variables the deck uses (missing ones fall back to the deck's own CSS).
  `background` is optional (defaults to `--ground`); `swatch` (four colours) overrides the picker's dots.
- With fewer than two themes the button is hidden.

## 14. Audience levels (`Deck.levels`)

A training deck can hold several audience levels in one file. The bar shows a level button (key
**L**) that lists them (an optional `duration` would show beside each, but training decks leave time to
the presenter and show none); choosing one reloads the deck in that level and lands on
the same slide (or the nearest one before it). The choice is remembered per deck, and `?level=expert`
in the URL opens a level directly.

```js
Deck.config({ title: 'Docker', background: '#0B1220' });
Deck.levels([{ id: 'beginner', name: 'Beginner' },          // after Deck.config, before the frames
             { id: 'intermediate', name: 'Intermediate' },
             { id: 'expert', name: 'Expert' }]);           // the first is the default (or Deck.config({level}))

// a shared slide with wording per level: any frame field can be {level: value, default: value}
Deck.frame('layers', { title: 'Image layers',
  sub: { beginner: 'Like a stack of transparent sheets', expert: 'Content-addressed, read-only, shared' },
  points: ['Each instruction adds a layer', { intermediate: 'Order lines for the cache', expert: 'Cache mounts (BuildKit)' },
           { expert: 'Squash vs multi-stage' }],          // a point missing for a level is left out
  notes: { default: 'One idea per click …', expert: 'Go fast through the basics …' } });

// a slide for some levels only
Deck.frame('analogy', { levels: ['beginner'], title: 'The shipping container' });
Deck.frame('buildkit', { levels: ['intermediate', 'expert'], title: 'BuildKit', anim: { … } });
```

- **Inside animations**, `kit.lv({beginner: …, expert: …})` (or `Deck.lv`) gives the current level's
  value, and `kit.level` / `Deck.level` is its id: use them for headlines, captions, numbers and
  which beats to show. A whole `anim` (or `stops`) can also be a per-level object.
- A per-level value is an object whose keys are only level ids and `default`; anything else is used as
  it is. Missing level and no `default` → empty (a point or field is left out).
- Frames of other levels are left out entirely, so ids may repeat across levels only if their
  `levels` don't overlap. Children (`parent`) must share their parent's levels.
- Agenda, objectives and the knowledge check are usually shared slides with per-level wording.
- `--verify` checks every level (stills and content checks), writing other levels' sheets to
  `verify/level-<id>/`; the live run and the theme sheets use the default level.

## 15. The terminal drawer (live demos)

A deck opts in with `Deck.config({ terminal: true })` (ask the user first: SKILL.md, Training decks); without
it there is no drawer, no button and no ` key. Then **`** opens a terminal drawer under the slide (the slide
shrinks to sit above it), and **Ctrl+`** (or its Hide button) hides it. It is a real terminal (xterm.js) on a real shell: PowerShell on
Windows (a ConPTY console), the user's login shell on macOS and Linux, started in the home folder. So `ssh`,
`vim`, `top`, `kubectl`, colours, Tab completion and resizing all behave as in any terminal. While it has the
keyboard, every key goes to the shell (the slide keys are off); hiding it gives them back.

- **It needs the presenter kit** (`scripts/kit.py`): the launchers serve the deck on 127.0.0.1 and run the
  shell. Opened as a plain file (or in `--verify`), the drawer only explains that; nothing else changes.
- **Safety:** the shell is reachable only from that deck window: 127.0.0.1 only, a one-time key in the page
  address (`?tk=…`, new on every launch), and an Origin check. Closing the window ends the shell. Passwords
  are never stored in a deck; prefer ssh keys for demos.
- **Click-to-type:** give any element on a slide `data-send="command"` and, with the kit, clicking it opens the
  drawer and types the command at the prompt **without pressing Enter** (the presenter does). Use it on
  demo steps and on the command lines of drawn terminals, e.g.
  `'<div class="demo-step" data-send="' + cmd.replace(/"/g, '&quot;') + '">…</div>'`. Escape `&`, `<`, `>` and `"`.
  Only put real shell commands there; a step done in a browser or an editor gets none.
  Commands run in the presenter's shell (PowerShell on Windows), so keep them valid there: `;` separates
  commands in both PowerShell and sh.
- **From a script:** `kit.term.send(text)`, `kit.term.show()`, `kit.term.hide()`, `kit.term.available`
  (true only when served by the kit).
- **Tabs:** + (or Ctrl+Shift+T) opens another shell, × (or Ctrl+Shift+W) closes one, Ctrl+PageUp/PageDown
  switch. `data-send` types into the current tab.
- The bar's icon buttons: smaller / larger text (remembered), full / half height, restart this shell, hide.
  When a shell exits, Enter starts a new one. If the launcher has stopped (its console window was closed),
  the drawer says so instead of pretending the shell ended.
- Launcher options (edit the launcher line): `serve.ps1 -TermDir D:\demo -Shell "pwsh -NoLogo"`, or
  `serve.py --term-dir ~/demo --shell /bin/zsh`.

## 16. The browser (pages beside the deck)

A deck opts in with `Deck.config({ browser: true })`, or `{ browser: { home: 'https://…' } }` to prefill the address
(ask the user first, with the terminal question). It adds a globe button and **B**: an address box that opens any
page; `https://` is added when missing, and `http://` for `localhost:…`.

- **Local apps open inside the deck.** An address on this computer or the local network (`localhost`, `127.0.0.1`,
  `*.localhost`, `*.local`, e.g. a demo app on `localhost:8080` or an Ingress at `visits.local`) opens in a **browser panel**
  under the slide, like the terminal drawer: back, reload (the address in the bar), an address bar, full height, hide,
  and "Open beside ↗" to move the page into the presenter's own browser. **B** hides it. One drawer at a time: opening
  the terminal hides the panel and the other way round. This works with or without the kit.
- **Websites open beside the deck.** Real sites (GitHub, cloud portals) refuse to be shown inside another page, so
  with the presenter kit a page opens in a new window of the presenter's **own** browser (their default Edge
  or Chrome, with their sign-ins, tabs and address bar), not inside the deck: real sites refuse to be framed.
  On Windows the launcher then puts the deck window on the left 60% of its screen and the browser on the right
  40%; **B** again (or "Deck full screen") gives the deck the whole screen back. On macOS and Linux the page
  opens in the default browser where it likes (no placement). Full screen (F) is left first: a full-screen
  deck can't share the screen.
- **Opened as a plain file** a page opens in a new tab of the same browser.
- **On a slide:** `data-open="https://…"` on any element makes a click open it. Use it on demo steps done in a
  browser and on reference links. Inside a `data-send` element, a `data-open` child opens the page only.
- **From a script:** `kit.web.open(url)`, `kit.web.full()`, `kit.web.available`, `kit.web.beside` (true with the kit).
- Safety: the launcher opens only `http(s)` addresses, and only for this deck window (the one-time key and a
  same-origin check), so no other page can make it open things.

## 17. Hidden slides

Like PowerPoint's Hide Slide. In the slides panel, hover a thumbnail and click its eye (or press **H** on the
slide): the slide stays in the panel, dimmed and marked "Hidden", and is skipped by →, ←, Home, End and the
counter while presenting. Clicking its thumbnail still opens it (the counter then says "Hidden"). Print / PDF
leaves hidden slides out. At least one slide stays visible.

- A deck can start with a slide hidden: `Deck.frame('extra', { hidden: true, … })` (a backup slide, an optional deep dive).
- The presenter's choices are remembered in that browser; **Download** writes them into the saved copy, so a
  shared file opens with the same slides hidden. `--verify` ignores the hidden state and checks every slide.

## 18. The workbench (files, editor, terminal)

A deck opts in with `Deck.config({ workbench: true })` (ask the user first: SKILL.md). It adds a bar button and **E**:
a VS Code-like workbench under the slide (the slide shrinks above it): the **explorer** of one demo folder (new file,
new folder; rename and delete on the selected or hovered row, or F2 / Delete as in VS Code; git status letters U/M/A/D when the folder is a git repository), the **editor**
(Monaco, the editor inside VS Code: tabs, syntax colours by file type, find, multi-cursor, **Ctrl+S** saves) and the
**terminal** below it (the deck's terminal, with tabs, starting in the demo folder). A file changed on disk by the
terminal or a build reloads in the editor unless it has unsaved edits. "Open in VS Code" opens the presenter's own
VS Code on the folder. **E** or the arrow hides it. It needs the presenter kit (opened as a plain file it explains so).

- **The demo folder:** `_present/workspace.txt` (written once by `kit.py`, never overwritten): its first line is the
  folder's path; empty means a `workspace` folder next to the deck. Launcher option: `serve.ps1 -Workspace D:\demos\x`,
  `serve.py --workspace ~/demos/x`.
- **Edit from a slide:** `CODE(cls, x, y, w, lines, file, { edit: true })` (or `edit: 'path/in/folder'`) adds an
  **Edit ↗** button to the code panel's header (shown only in decks with the workbench). Clicking it writes those lines
  to that file in the demo folder if it is not there yet, then opens it. Use it on files the presenter changes live
  (a whole workflow, a Dockerfile, a manifest), not on fragments: the lines become a real file.
- **From a script:** `kit.workbench.open(path?)`, `kit.workbench.edit(path, text)`, `kit.workbench.hide()`, `.available`.
- Safety: only this deck window (the one-time key; same-origin reads, Origin-checked writes), and only inside the demo
  folder: every path is resolved and refused if it leaves it. Text files up to 2 MB; binary files are not opened.
- One drawer at a time: the browser panel and the terminal drawer close when the workbench opens (the terminal moves
  into the workbench and back).

**Panel theme (◐):** the terminal drawer, the browser panel and the workbench each have a ◐ button that switches their own colours
between Dark (default), Light and High contrast — the editor (Monaco: vs-dark / vs / hc-black) and every terminal tab follow, and
the choice is remembered on that computer (localStorage `deck.chrome`). It never changes the slides' theme (C). The explorer, editor
and terminal are separated by 2 px dividers in every panel theme.

## 19. Code languages (`Deck.langs`)

For an audience with several stacks: `Deck.langs([{id: 'python', name: 'Python'}, {id: 'node', name: 'Node.js'}, …])`
after `Deck.levels`. A **Language** button on the bar (or **G**) switches every code sample; the choice is remembered and
the deck keeps its place. Per-language values work like per-level ones: `{python: …, node: …, default: …}`, nested
either way with levels (`{beginner: {python: …}}`), anywhere a frame field or `kit.lv()` takes a value; frames for some
languages only: `langs: ['java']`. Keep one table of each language's commands and tools in the deck (a `STACK` object and
`S(key)`), so slides never retype them. `--verify` renders every language in every level (sheets in `lang-<id>/` and
`level-<id>-<lang>/`); long Java and C# lines are the usual overflow.


**Renaming the picker:** `Deck.config({ langLabel: 'Cloud' })` when the picker chooses something other than a code language (for
example AWS / Azure / GCP): the bar button's tooltip, the menu heading and the demo setup's question use that word.

## 20. Demo projects and the demo setup

A training deck with live demos ships **one demo project per language** that matches its slides exactly, so every command
the slides type and every Edit ↗ file works on it as-is.

- **Where:** `demo-projects/<lang>/` next to the deck (`<lang>` = a `Deck.langs` id, or `default`), with
  `stages.json` (`[{ "id": "start", "title": "The app, no CI yet" }, …]`, in order) and `stages/NN-<id>/` folders. Stage 00
  holds the whole starting project; each later stage holds only the files that change. `kit.py` ships them.
- **Stages follow the demos:** a frame names the stage it expects with `stage: '<id>'` (usually its demo slide, and the
  slide that introduces a file version). The workbench's **Reset to this slide** lays every stage up to that one into the
  demo folder (asks first; files outside the project stay). An empty demo folder offers **Start from the <language> demo
  project** (stage 00).
- **Edit ↗ never overwrites silently:** the same content as the slide just opens the file; different content opens a
  side-by-side comparison (the folder's file left, the slide right) with **Keep mine** and **Use the slide's version**.
- **Build the projects for real:** run each language's build and tests while building the deck (and the scan, the image
  build, the apply where the tools exist); check that every `edit: true` panel equals its file at the slide's stage, and
  that every demo command refers to files that exist then. Say in one line which ones could not be run on this machine.

**The demo setup:** `Deck.config({ demo: { ask: ['repo' | 'gitlab' | 'sonar' | 'kube' …], checks: ['git', 'gh', 'glab', 'docker', 'kubectl', 'sonar'] } })`.
`repo` is a GitHub owner/name (checked with `gh`); `gitlab` is a GitLab project's address, gitlab.com or self-managed (checked with
`glab auth status` and `glab repo view <address>`; saved as `gitlab`, `gitlabHost`, `gitlabPath`).
The first time the deck is started from its launcher it asks for those values and the language, and runs a pre-flight
check of the tools (each with a green or red light and how to fix it): the language's own tool is always checked, and
everything it asks for. The ⚙ in the workbench opens it again. Answers are saved locally in `_present/demo.json` (never
in the deck, never passwords or tokens) and read before the slides are built, so slides use them:
`Deck.d('repo', 'your-org/orders-api')` (also `owner`, `repoName`, `gitlab`, `gitlabHost`, `gitlabPath`, `sonar`, `kube`, `lang`). Opened as a plain file or
in `--verify`, every value is its fallback.

## 21. Presenting from a remote Linux machine (optional)

`Deck.config({ remote: true })` (ask first) makes `kit.py` add **Present (Remote Linux).cmd**: the presenter shows the deck
on their Windows laptop while everything that runs (terminal tabs, the workbench's demo folder, demo projects, pre-flight
checks, demo apps) runs on a Linux machine. Double-clicking it:
1. asks once for `user@host` (or `user@host:port`), the deck's folder there (default `~/decks/<deck>`) and the demo ports
   to bring back (default 8000 8080 9000; a deck sets its own with `remote: { forward: '8081 8082' }`), and saves them in `_present/remote.txt`;
2. checks SSH and Python 3 there, then copies the deck, `_present/` and `demo-projects/` over SSH (`tar | ssh`; that
   machine's own `demo.json` and `workspace.txt` are kept);
3. starts `serve.py --remote` there on the same port number as a tunnel from this computer (`ssh -L`, plus one for each
   demo port), and opens the deck in its own window here. Closing the window ends the connection and the server.

Sign-in is SSH's own (a key, or a password typed into the launcher's console); nothing is stored by the deck. Needs the
OpenSSH client (built into Windows 10/11) and Python 3 on the Linux machine. In remote mode, "open beside" pages open in a
new tab of the deck window, and Open in VS Code points to VS Code Remote-SSH.

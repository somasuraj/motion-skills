# Film format and kit API

Contents: 1. The film script · 2. Scenes · 3. The kit · 4. Fonts · 5. What breaks a film ·
6. Tweaks and palettes · 7. Recorded audio and cues · 8. Long films and chapters · 9. The player and export

## 1. The film script

One `.js` file, inlined into `assets/player.html` by `scripts/build.py`. It runs once,
top to bottom, before anything renders. Four core calls (more in sections 6–8):

```js
const { seg, eo, eio, eob, lerp, TextFx, draw, sample, along } = kit;   // destructure what you use

Film.config({
  title: 'Harbor open day',          // shown as the page title; never "Video"
  width: 1920, height: 1080,         // vertical: 1080 x 1920; square: 1080 x 1080
  fps: 60,                           // 24 | 30 | 60 | 120 (frame stepping and the default export rate)
  captions: false,                   // show Film.cues as subtitles by default (section 7)
  background: '#10201D',             // stage ground behind every scene
  fonts: { display: { family: 'Syne', weights: [700, 800] }, sans: { family: 'Manrope', weights: [400, 700] } },
});

Film.css(`...`);                     // shared styles: palette variables, type classes, shapes
Film.scene('yard', { name: 'The yard', dur: 3, init(k) { ... }, render(t, k) { ... } });
Film.score(function (S, T) { ... }); // optional: see references/sound.md
```

Scene order is the order of `Film.scene` calls; the film's length is the sum of
`dur` (3 hours maximum; see section 8 before going past a few minutes).

## 2. Scenes

Scene ids `end` and numbers are taken by `render.py --stills` (`end` = the film's last frame); name
an end card `outro` or `card`.

```js
Film.scene('pour', {
  name: 'The pour',                  // timeline label, for a listener ("The pour", not "Scene 2")
  dur: 4.5,                          // seconds, > 0
  init(k) {                          // build once (may be async). k.stage is this scene's box.
    k.stage.append(k.h('<div class="ground">...</div>'));
    this.ladle = k.stage.querySelector('.pour-ladle').style;
  },
  render(t, k) {                     // SYNCHRONOUS and pure: t = seconds since the scene began
    this.ladle.transform = 'rotate(' + lerp(4, -24, eio(seg(t, 0.3, 1.2))) + 'deg)';
  },
});
```

- `id`: lower-case letters, digits, `-`, starting with a letter, up to 32 chars. Prefix the
  scene's own class names with it (`pour-ladle`) so scenes never collide.
- `this` carries what `init` built into `render`. Extra methods on the scene object are fine
  (`this.line(t)`). Names starting with `$` are the player's (`$box`, `$kit`, `$start`, …): don't
  use them on `this`; any other name is yours.
- Only the active scene's box is shown; scenes cut from one to the next. Make each scene stand
  alone and hold its first and last picture for `t < 0` or `t > dur` (`seg` already clamps).
- `render` may be called for any `t`, in any order (scrubbing, export). Set every property that
  varies from `t` alone. No CSS transitions or animations, no timers, no `Date.now()`,
  no `Math.random()` (use `kit.rng(seed)` in `init`), no reading layout to decide.
- Each scene's `k` is its own copy of the kit plus `k.stage`, `k.dur`, `k.start`, `k.scene`.
- A scene that throws shows a red error card in its place; `render.py --check` reports it.

## 3. The kit (`kit`, also passed as `k`)

**Time and easing** (all pure, all clamp):
`seg(t, a, b)` → 0..1 across [a, b] · `lerp(a, b, p)` · `clamp(x, a, b)` · `clamp01` ·
`smoothstep(a, b, x)` · `step(t, a)` · `pulse(t, a, b)` ·
eases: `eo` (cubic out), `ei` (in), `eio` (in-out), `eoq` (quad out), `eox` (expo out, whips),
`eob(x, overshoot = 1.4)` (back out; 1.6–1.9 for shapes landing), `spring(x)` (decaying wobble).
`breathe(t, amt = .012, period = 3.2)` → a scale near 1 for held shapes.
`rng(seed)` → `() => 0..1`, deterministic · `vnoise(seed)` → `x => -1..1` smooth noise.

**DOM**:
`k.h('<div>…</div>')` → the FIRST element of the string (wrap siblings in one root).
`k.svg('<g>…</g>')` → an SVG-namespaced element (use for fragments added to an existing `<svg>`;
a whole `<svg>…</svg>` string passed to `k.h` is fine as is).
`k.el(tag, {class, style, text, html, attrs}, [children])` · `k.esc(s)`.

**Lines and paths** (the core of drawn motion):
`draw(node, p)` draws any SVG path/line/ellipse/polyline on from 0 to `p`.
`sample(node, n = 200)` → `[[x, y], …]` points along it (call in `init`).
`along(points, p)` → `[x, y]` at fraction `p` (a pen tip, a travelling object).

**Type** — the element keeps ONE string; words are split at run time:
`TextFx.fadeFromRight(el, t, t0, {stagger = .11, dur = .5, dx = 26})` → returns end time.
`TextFx.riseIn(el, t, t0, {stagger = .09, dur = .55, dy = 34})`.
`TextFx.fadeOutLeft(el, t, t0, {stagger = .06, dur = .3, dx = 22})` (exits: quicker, the other way).
`TextFx.countUp(el, t, t0, t1, from, to, fmt?)` (start near half the value, not at 0).
`typist(text, t0, cps = 22, seed)` → `{times, end, count(t), at(t)}`: `el.textContent = ty.at(t)`;
pass `times` to the score as keystroke ticks.

**Camera** — `const cam = k.camera(layerEl, keys, k.W, k.H)` in `init`, `cam.apply(t)` first thing
in `render`. Keys: `{t, x, y, z, hold?, from?, cut?, ease?, drift?: [dx/s, dy/s, dlogz/s]}`;
(x, y) is the scene point placed at the stage centre; zoom interpolates in log space. Build the
layer larger than the stage so a 2–3× push has somewhere to go.

**Shapes**: `cutPaper(seed, n = 7, irr = .28)` → a unit polygon · `polyStr(pts, cx, cy, sx, sy, rot)`
→ an SVG `points` string.

`k.W`, `k.H`: stage size. `k.fonts.sans | serif | mono | display`: CSS font stacks (they contain
double quotes, so inside markup write `var(--sans, system-ui, sans-serif)` instead).

## 4. Fonts

`Film.config({fonts})` takes up to four slots: `display` (headlines), `sans`, `serif`, `mono`.
Each is a Google Fonts family name (string) or `{family, weights: [400, 700], fallback}`.
The player loads them, waits up to ~2.5 s, and sets `--display`, `--sans`, … on the stage, so CSS
writes `font-family: var(--display, var(--sans, system-ui, sans-serif))`. Offline, or a family that
doesn't exist, falls back to the stack, so leave lines room to fit a wider fallback. Pick faces for
the film's subject, not by habit; name only families you are sure exist on Google Fonts.

## 5. What breaks a film

- Markup inside JS strings: single-quoted strings, double-quoted attributes, no quotes inside a
  `style="…"`. A nested quote breaks the string.
- A `render` that depends on anything but `t` (the check reports "not deterministic").
- Remote images or scripts: the film must be self-contained. Embed images as `data:` URIs or
  draw them as SVG.
- Frame 0 blank: `render(0)` is the thumbnail and the MP4's first frame. Start the title's
  entrance before 0 (`TextFx.fadeFromRight(el, t, -0.6)`) so it already reads at 0.
- Anything that flashes or hard-cuts more than three times a second.

## 6. Tweaks and palettes

Tweaks let the viewer change a film without a rebuild, in the player's **Tweaks** panel. Declare
what is worth changing (headline wording, a name, an accent, the pace) — two to six knobs, not
every value:

```js
Film.tweak('headline', { label: 'Headline', type: 'text', default: 'Talk. Utter types.' });
Film.tweak('accent', { label: 'Accent', type: 'color', default: '#3DDC97', cssVar: '--accent' });
Film.tweak('pace', { label: 'Pace', type: 'number', min: 0.6, max: 1.6, step: 0.1, default: 1, unit: '×' });
Film.tweak('who', { label: 'Speaker', type: 'select', options: ['Maya', 'Sam'], default: 'Maya' });
Film.tweak('grid', { label: 'Dot grid', type: 'toggle', default: true });
// types: text, longtext, color, number, select, toggle. Optional: hint (one line under the field).
```

Read them with `k.tweak('headline')` (or `kit.tweaks.headline`) in `init` or `render`. A change
re-runs every scene's `init`, then renders the current frame, so building markup from a tweak in
`init` is fine. A tweak with `cssVar` is also set on every scene box, so CSS that uses the variable
follows it with no code. Changed values travel in the URL (`#tw=…`), so a shared link carries
them; "Copy as request" in the panel turns them into a message asking Claude to bake them in.
`render.py` always uses the defaults.

Palettes add swatches to the **Style** tab. The first entry is the film's own ("Yours"); each
entry sets CSS variables on every scene box, so palette colours must live in variables (as
`Film.css` already asks), not in hexes written into markup:

```js
Film.palette([
  { name: 'Mint night', vars: { '--ground': '#0F1013', '--main': '#15161A', '--ink': '#F2F4F7', '--accent': '#3DDC97' } },
  { name: 'Paper', vars: { '--ground': '#F6F1E7', '--main': '#E4DCCB', '--ink': '#1D1C1A', '--accent': '#D9480F' } },
]);
```
The stage ground follows `--ground` (or a palette's `background`). The first four values draw
the swatch.

## 7. Recorded audio and cues

`Film.audio(src, {name, gain, duck, offset})` adds a recorded track — dialogue, narration, a song,
music or effects — that always plays in sync with the timeline, in the player and in every
export. `src` is a file next to the film script (`build.py` embeds it as a `data:` URI) or a URL.
`gain` is in dB (default 0); `offset` starts the track that many seconds into the film; `duck`
(dB, default −9) is how far a `Film.score` steps back under it. Several tracks may be added. If
the track is the music, leave `Film.score` out.

`Film.cues(list | 'cues.json')` gives the film the words and their times:
`[{start, end, text, speaker?}]`, or the whole object `scripts/cues.py` writes (it also carries
`beats` and `bpm`). With cues, the score ducks only while someone speaks, the player offers
**Subtitles** (on by default with `Film.config({captions: true})`), and scenes can read
`k.cues`, `k.cueAt(t)`, `k.beats` and `k.bpm`.

Make the cue sheet first, then time the film to it:

```bash
python scripts/cues.py dialogue.mp3 -o cues.json --script lines.txt   # your lines, timed to the pauses
python scripts/cues.py dialogue.mp3 -o cues.json --whisper            # transcribe (free, local; pip install faster-whisper)
python scripts/cues.py song.mp3 -o cues.json --beats                  # tempo and beat times
```

`--whisper` needs faster-whisper (free, runs locally; the first run downloads a model into
`models/` beside the Python that runs it). If it lives in a separate environment, set `MOTION_PYTHON`
to that Python, or put its path in `scripts/.whisper-python`, and `cues.py` hands over to it.

Read `cues.json` and derive scene durations from it: a scene per line (or per few lines) starting
a beat before the line and lasting until the next scene's start, so `sum(dur)` equals the audio's
`duration`. Cut on `beats` for music. Keep the times in the script (for example
`const CUE = [0.0, 3.44, 8.48]`) so scenes stay readable. Look at the stills at cue starts to check
picture and words agree. A page over ~15 MB may be refused when hosted: shrink speech with
`ffmpeg -i in.wav -ac 1 -b:a 48k out.mp3`, or split a long film into chapter files.

## 8. Long films and chapters

A film may run up to three hours. Past a few minutes:

- Group scenes with `Film.chapter('Act one')` before them. With more than 24 scenes (or
  `Film.config({timeline: 'chapters'})`) the timeline shows one chip per chapter, and the chip
  menu loops, exports and asks about the chapter.
- Reuse scene builders: a function that takes data and calls `Film.scene` keeps hundreds of scenes
  maintainable. Long stretches of one look are one scene with a long `dur`, not many.
- Write long films as one script per chapter if the file grows past a few thousand lines, and
  build each as its own page, or concatenate them before `build.py`.
- Plan the render time honestly. A browser captures about 8 frames a second (~0.12 s a frame), so
  one hour at 30 fps (108,000 frames) is about 3.5 hours of rendering in one browser; at 24 fps,
  under 3. `render.py --mp4 film.mp4 --fps 30 --workers N` splits the frames across N browsers and
  joins them losslessly, but it only helps as far as free CPU cores allow: measured on a 6-core
  laptop, 4 workers were ~1.3× faster on a 2-minute film, and more workers than cores were slower.
  Each worker also spends ~8 s starting, so short films don't gain. Render long films overnight,
  or a chapter at a time.
- The in-page Export holds the whole video in memory and keeps the tab busy: fine up to ~20
  minutes; past that, export one chapter at a time from its chip menu, or use `render.py`.
- A hosted page is capped near 15 MB, and embedded audio is most of it: ~10 MB is about
  25–30 minutes of speech at 48 kbps mono. Hour-long films with a recorded track are therefore
  one page per chapter (each with its own slice of the audio, cut with
  `ffmpeg -ss <start> -to <end> -i full.mp3 -c copy part.mp3`), exported and joined with ffmpeg.

## 9. The player and export

Every built page has: play/pause, restart, loop (whole film, or one scene/chapter from its chip
menu), a volume slider and mute, full screen, keyboard keys (Space, ←/→ a frame, Shift+←/→ a
second, Home, L, M, F), chips with a ⋯ menu (jump, loop, export this part, **Ask Claude for a
change** — copies a precise request naming the scene, its times and the moment), the Tweaks/Style
panel, and **Export**: MP4 (H.264 + AAC, 720p/1080p, 15–120 fps, three qualities, optional 2×
supersampling) or GIF (480p/720p, 10–15 fps), for the whole film or one part, encoded in the
viewer's browser (Chrome or Edge). The Tweaks panel also lets the viewer switch between named
`Film.score` variants, None, or their own audio file (session only).

Export captures each frame by drawing the scene's DOM into a canvas, so keep scenes to HTML, SVG,
CSS and `data:` images (the rules above already require that); fonts must be embedded, which
`build.py` does. When the page is published as an Artifact, declare `capabilities: {downloads: true}`
so the finished file can be saved; opened as a local file, it downloads directly.

## 10. 3D with three.js (`k.three`)

This skill bundles three.js r170 (MIT, `assets/vendor/three.min.js`). `build.py` inlines it (about
690 KB) only when the script calls `k.three` / `kit.three`, so flat films cost nothing extra.
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

- `k.three(host, opts)` adds a canvas to `host` covering the stage (`w`, `h`, `x`, `y` in stage
  pixels to place it elsewhere) and returns `THREE`, a `scene`, a `camera` (perspective, `fov`
  default 35, at `z = dist`, default 10, looking at the origin), `render()` and the `canvas`. The
  background is transparent: the scene background shows through, and HTML text placed after the canvas sits
  on top. Default lights (a hemisphere and one key light) unless `lights: false`. `scale` (default
  1.5) sets the canvas's pixel density; raise to 2 for fine detail.
- Call `render()` at the end of every `render(t)`; the picture changes only then. Build all
  geometry and materials in `init`; in `render` only set positions, rotations, colours, opacity.
- **Everything is a function of t**: no `THREE.Clock`, no `requestAnimationFrame`, no
  `setAnimationLoop`, no `Math.random()` (use `kit.rng(seed)`). An `AnimationMixer` only via
  `mixer.setTime(t)`; shader time uniforms from `t`.
- One WebGL renderer is shared by every 3D view on the page (browsers allow about 16 WebGL
  contexts), so any number of 3D films is fine. Its pictures are copied into each view's canvas,
  so stills, the MP4/GIF export and `render.py --mp4` show the 3D as well.
- Keep models code-built (boxes, cylinders, spheres, tubes, extrusions, lathes). No external model
  files (glTF) or textures from the web; a texture can be drawn on a 2D canvas and wrapped with
  `CanvasTexture`.
- If WebGL is unavailable the view shows a line saying so and logs an error, which fails `--check`.
- `v.project([x, y, z])` (or a `Vector3`) gives `[x, y]` in stage pixels for the camera as it is
  now: use it to pin an HTML label to a 3D object after moving the camera in `render`.
- Palette colours: set them in `render` from `k.cssVar('--accent')` (`mat.color.set(k.cssVar('--main'))`),
  so the 3D follows the palette and Style tweaks. Cache the string and only call `set` when it changes.
- Lights: the defaults suit a single object. When the scene has its own light source (a Sun, a lamp)
  pass `lights: false` and add your own (`PointLight` at the Sun, a dim `AmbientLight`); make the
  source itself glow with `MeshBasicMaterial`.
- The 3D canvas stacks in page order, like any element: add backgrounds (a starfield, a ground)
  **before** calling `k.three`, and captions and labels **after** it. A caption that must be
  created first gets `position:relative; z-index:1` (or higher) so the 3D never covers it.
- Options: `fov` (35), `dist` (10, camera on the z axis), `target: [x, y, z]` (where the camera
  looks; the default is the origin), `w`/`h`/`x`/`y` (canvas box), `scale` (1.5), `lights`.
  Scale: at the target's depth one unit is about `h / (2 * dist * tan(fov / 2))` pixels (1080 / (2 x 10
  x 0.315) ≈ 172 px on the 1080-high stage with the defaults). Plan the object's size in units from that
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
- 3D renders in software in `render.py` (about 0.3–0.5 s a frame): export 3D films with `--fps 30` and `--workers 4`, and expect about 3–4 minutes for 25 s.

When to use 3D: when depth is the point (an object turning in space, a camera moving through a
place, layers separating, an orbit, a product shown from several sides). Flat type and diagrams
stay HTML/SVG on top of the canvas. Move the camera with eased curves, and do no more than one
camera move per scene.

## Typing commands and code

`kit.type(el, p)` shows an element's text up to progress `p` (0..1), keeping its colours and markup, with a
caret while it types; children with class `pr` (a `$ ` prompt) show at once. `kit.typeDur(el)` suggests a
duration (about 30 characters a second, 0.3–1.5 s). Use it whenever a command, a line of code or a search query
is "written" on screen, then show its output after: `kit.type(cmdEl, seg(t, 2, 2 + kit.typeDur(cmdEl)))`.


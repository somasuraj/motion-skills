# Diagrams inside motion-slides and motion-videos

A diagram built with `--formats …,embed` produces `name.embed.js`: the diagram's SVG in both themes (icons
embedded, every node/edge/group tagged with its part id), its fonts, and the `MotionDiagrams` runtime. Paste the
whole file at the top of a deck script (`deck.js`) or film script (`film.js`); both runtimes inline the script, so
the deck or film stays one offline file. Several diagrams can be pasted; the runtime defines itself once.

```bash
python scripts/build.py docs/diagrams/shop.js --formats svg,png,drawio,excalidraw,embed
# paste docs/diagrams/shop/shop.embed.js into the deck or film script
```

## The runtime (all animation is a pure function of t)

```js
const d = MotionDiagrams.mount(el, 'shop', { theme: 'auto' });   // in init: fills el (position:relative box)
d.sync();                    // in render: switches light/dark if the deck's theme changed (cheap)
d.play(t, plan);             // in render: build the diagram up (below)
d.packet('edge:cdn>alb', p); // a dot travelling along an edge, p 0…1 (outside hides it)
d.focus(['node:db', 'edge:api1>db'], amount);   // dim everything else, amount 0…1 (call after play)
d.show('node:db', p);        // one part, reveal progress 0…1 (play calls this for every part)
d.box('node:db');            // {x, y, w, h} in diagram units, e.g. for a camera move or a callout
```

- `theme`: `'auto'` (default; picks light or dark from the background behind `el`), `'light'`, `'dark'`.
  `transparent: true` drops the diagram's own background so the slide's ground shows through. `fit: 'cover'` fills
  the box instead of fitting it.
- **Plans**: `[{ at: seconds, show: 'node:alb' | ['node:a', 'edge:a>b'] | 'group:*' | 'all', dur: 0.6, stagger: 0.12 }]`.
  Parts named in a plan are hidden until their step and then fade and rise in (edges draw on along their path, the
  arrowhead lands last); parts never named are always visible. `'node:*'`, `'edge:*'`, `'group:*'` match every part
  of that kind. Part ids are listed in `references/api.md` §13 and in `MotionDiagrams.get('shop').parts`.
- Everything is set from `t` on every call: scrubbing, stepping, export and `--verify` stay deterministic.

## In a motion-slides deck (a slide with stops)

```js
// (paste shop.embed.js above this line)
Deck.frame('arch', { name: 'How a request flows',
  notes: 'Arrival: the network. Click 1: the user reaches CloudFront. Click 2: into the VPC. Click 3: the data tier.',
  anim: { dur: 9, stops: [1.6, 4.2, 6.6],
    init(k) {
      k.stage.innerHTML = '<div class="pg"><h2 class="hl"></h2><div class="dg" style="position:absolute;left:60px;right:60px;top:150px;bottom:40px"></div></div>';
      this.hl = k.stage.querySelector('.hl');
      this.d = MotionDiagrams.mount(k.stage.querySelector('.dg'), 'shop', { theme: 'auto', transparent: true });
    },
    render(t, k) {
      kit.say(this.hl, [[0, 'Everything runs in one region.'], [1.6, 'Users arrive through the edge.'], [4.2, 'Then into the VPC.'], [6.6, 'Data stays private.']], t);
      this.d.sync();
      this.d.play(t, [
        { at: 0, show: 'group:*', stagger: 0.12 },
        { at: 1.7, show: ['node:users', 'edge:users>dns', 'node:dns', 'edge:dns>cdn', 'node:cdn'], stagger: 0.25 },
        { at: 4.3, show: ['edge:cdn>alb', 'node:alb', 'edge:alb>api1', 'node:api1', 'edge:alb>api2', 'node:api2'], stagger: 0.2 },
        { at: 6.7, show: ['edge:*', 'node:*'], stagger: 0.06 },
      ]);
      this.d.packet('edge:cdn>alb', (t - 5.2) / 1.0);
    } } });
```

The deck's theme picker keeps working: `sync()` re-renders the diagram in light or dark when the slide's ground
changes. For a static diagram slide, `play(t, [])` (or no plan) shows it whole.

## In a motion-videos film (a scene)

```js
// (paste shop.embed.js above this line)
Film.scene('arch', { name: 'The architecture', dur: 8,
  init(k) {
    k.stage.append(k.h('<div class="arch-box" style="position:absolute;left:120px;right:120px;top:140px;bottom:80px"></div>'));
    this.d = MotionDiagrams.mount(k.stage.querySelector('.arch-box'), 'shop', { theme: 'dark', transparent: true });
  },
  render(t) {
    // start before 0 so frame 0 (the thumbnail and the MP4's first frame) already shows the boundaries
    this.d.play(t, [{ at: -0.6, show: 'group:*' }, { at: 0.3, show: ['node:*', 'edge:*'], stagger: 0.08 }]);
    this.d.packet('edge:cdn>alb', (t - 4) / 1.2);
    if (t > 6) this.d.focus(['node:db', 'edge:api1>db', 'edge:api2>db'], (t - 6) / 0.6);
  } });
```

Frame 0 must already read (motion-videos' check fails a blank first frame), so give the first step a negative `at`.
Choose `theme` to match the film's ground (`'dark'` on a dark film), or `'auto'`. Nothing in the runtime uses timers,
CSS transitions or randomness, so frames export identically.

## Craft

- One idea per stop or beat: reveal the boundary first, then the path a request takes, then the rest.
- Reveal in reading order (left to right), edges just before the node they lead to.
- A packet travelling along the path is the clearest way to show "a request goes here"; use it once or twice.
- Keep the static `name.png` for handouts and docs; it is the same diagram.

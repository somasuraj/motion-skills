# Motion craft

What makes a short code-driven film feel designed rather than generated. Read before writing
scenes; reread the checklist at the end before delivering.

## Composition and attention

- **One subject per shot.** The thing that moves is the thing to look at; nothing else changes
  while it does. Stagger related entrances by 200–400 ms instead of bringing them in together.
- **Give the eye time.** After a cut or a big move, allow 0.6–1 s before anything important
  happens there. Put the next subject where the eye already is, or lead it there with motion.
- **Transform rather than cut between ideas.** A line becomes a ball, a circle shrinks into the
  end card's dot, a card grows into the next screen. Hard cuts are for rhythm within an idea.
  No stock wipes.
- **Nothing ever freezes.** A held frame reads as a bug. Held shapes breathe (1–2 % scale on a
  ~3 s sine), held titles creep a couple of pixels a second, the camera drifts slowly.

## Lifelike motion

Use the animator's principles lightly, on shapes, marks and type (never on recreated product UI,
which only eases):

- anticipation: a small dip or pull-back (3–5 %, ~120–150 ms) before a big move;
- overshoot and settle on arrival: `eob(p, 1.6–1.9)` or `spring`;
- squash and stretch on impact (at most ~15–18 %, keeping volume: widen as it flattens);
  stretch along the direction of fast travel;
- follow-through: echoes or trails that lag the leader by 0.1–0.3 s;
- arcs, not straight lines; ease out on arrival, ease in on exit, ease in-out for repositioning.
- Fake motion blur deterministically: 2–3 trailing copies at earlier `t` with falling opacity,
  or a scale along the travel direction proportional to speed.

## Type

- Words enter from ONE direction, word by word (≈110 ms stagger, 24–34 px drift over ~0.5 s,
  ease out). Exits are quicker and go the other way. Don't vary direction line to line.
- Display type is big: 150–300 px on a 1920-wide stage (90–170 px on 1080-wide vertical).
  Sentence case, few words. Emphasis is motion or a drawn underline, not bold or exclamation marks.
- Give type a job: a number counts up, the product name lands and stays, a title travels and
  becomes the next subject.
- Lines that belong together share one flex column (`.words`) so a wrapping line pushes the next down.

## Pacing

- Open calm: the title (~2.5 s), then the subject with at most one measured push.
  Fast camera in the first five seconds is the most common complaint.
- Then rhythm, not speed: hard cuts on a fixed beat for "look at all this", eased 0.5–0.9 s
  pushes for reading.
- Zoom in more than feels right; people watch on phones. Body text should be ≥ ~26 px on screen.
- **Frame 0 is the thumbnail**: it must show what the film is (the title's first words, the
  subject), never a blank ground.
- **End card**: the name large, one short line, the accent used once (an underline, a dot),
  landing on the score's big hit and held ≥ 3 s. The last subject shrinks first, then lands as
  the card appears.
- Length: 15–30 s unless asked; longer films (minutes to hours) follow kit-api.md section 8.
  4–6 scenes for 30 s, 3–4 for 20 s, each one subject and one action:
  open → subject arrives → the thing happens → closer moments → end card.

## Look

- Flat colour from the chosen palette; one accent doing one job. At most one texture layer
  (a dot grid, paper grain). No glows, lens flares or gradients unless the brand
  already uses them. Real 3D (`kit.three`) is welcome where depth is the idea (see "3D" below).
- New shades are mixed from the palette (`color-mix(in srgb, var(--main) 30%, var(--ground))`),
  not invented hexes.
- Text on the ground meets 4.5:1 contrast.
- **Know what not to attempt**: frame-by-frame character animation and photoreal scenes are slow
  to make and rarely good here. Steer to what code does well: shapes, lines, type, camera,
  recreated UI, marks, data, and simple lit 3D objects built from primitives.

## Content limits

- Fit to show a room of coworkers: no imagery or styling that echoes propaganda, extremist or
  hateful symbols, or that is offensive. Avoid an all black/red/white palette unless the user
  supplied those colours.
- No known characters, mascots, logos, film or game scenes, and no other company's proprietary UI
  unless the user works there; make an original design and say so.
- Nothing presented as fact that isn't true (an approval, a result, a quote): label it as a
  concept/mock inside the film or leave it out.
- Names and data on screen are the user's or clearly fictional.

## 3D (three.js)

- 3D earns its cost when depth is the idea: what something looks like from the side, how parts
  fold, stack, orbit or nest. If a flat drawing says it as well, draw it flat.
- One clear object, lit simply (the default lights), on the ground; colours from the palette
  (`new THREE.Color('#F2B63C')`). Metals look dark without an environment map: keep `metalness`
  ≤ 0.6 and add a warm fill light.
- Leave room for the caption: put the object below or beside the text, never under it.
- Camera moves are slow and eased, one at a time; nothing spins for its own sake.

## Checklist before delivering

1. `render.py --check` passes (no throwing scenes, deterministic, frame 0 not blank).
2. A contact sheet (`--stills 0,<each scene id>,end --sheet`) shows every scene composed, text
   inside the frame and not overlapping, the palette applied.
3. Nothing flashes more than three times a second; no scene is under a second.
4. The end card holds ≥ 3 s and the score's hit lands on it.

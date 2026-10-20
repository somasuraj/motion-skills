# Craft: a talk people can follow

## Animated slides (the default)

- One concept per slide, explained in 3–5 clicks; every click adds exactly one thing (an arrow, a
  label, a moving packet) and ends on a picture you can talk over for 20–40 s.
- The headline says the idea of the current click, in words a beginner uses; the caption adds one
  short sentence. Never more than two lines of text moving at once.
- Keep a consistent set of drawings across the deck (one laptop, one server, one person), placed in
  the same spots slide to slide, so the audience stops decoding and starts following.
- Motion explains: things travel along the path they really take, appear where they come from, and
  fade when they stop mattering. 0.4–1.2 s per movement; nothing decorative.
- Show results, then names: draw the request travelling, then call it "HTTP".
- What is continuous in reality keeps moving while you talk (`ambient: true` + `k.clock`): sunlight
  streaming, a signal flowing, a wave rolling, an orbit turning. A stop then freezes only the
  explanation, never the world. Keep loops slow and quiet so they don't compete with the speaker.
- Recap slide: the whole journey as one picture, all steps visible.

## The canvas format


A zooming deck wins over slides when the audience always knows **where they are** and **why the
camera moved**. Read before planning; reread the checklist before delivering.

## The map

- **The map is the outline.** Its shape should say something about the talk: a ring for parts of
  one whole, a path for a journey or process, a timeline for history or a roadmap, a tree for a
  breakdown. Pick it from the content, not for looks.
- **3–7 top-level stops.** More than seven and the overview stops reading; group them into sections
  and nest.
- **Open on the title, pull back to the map, then go.** The first pull-back is the moment the
  audience sees the whole talk; give it a beat (say what the stops are) before the first dive.
- **Return to the map between sections.** It resets attention and shows progress. Skip it only for
  stops that sit next to each other on the map and follow each other in the story.
- **Nest for detail, not for everything.** A stop gets children only when "here is the big idea;
  now look closer" is the point. Two levels under a stop at most.

## Frames

- **One idea per frame.** Title says the idea in ≤ 7 words; ≤ 5 points of ≤ 6 words. If it needs
  more, it is two frames (or a stop with children).
- **Text as presented ≥ 28 px.** The defaults give ~64 px titles and ~32 px points on a 1080p screen.
  Don't shrink to fit; split.
- **Shapes carry meaning.** Circles for stops on a ring, rects for content-heavy frames, brackets
  for a group, none for a big statement or an image. Keep one shape per level so the map reads.
- **Same level, same size.** Siblings share a size so the overview looks ordered; a hub may be
  larger.

## Motion

- **Every move has a reason.** In = detail, out = context, sideways = next step. No spins: tilt a
  frame only when the tilt means something (a rising line, a "turn").
- **Let the camera settle before content changes.** Points fade in after the hop ends; never reveal
  and move at once.
- **Long hops dip out automatically.** Don't fight it by placing related stops far apart: put the
  stops that follow each other next to each other on the map.
- **Watch the zoom ratio.** A child 6–8× smaller than its parent is a satisfying dive; 20× is a
  blur. Keep sizes so each hop is within ~1–12×.

## Look

- Flat colour from the palette; the accent for one job (kickers, bullets, the timeline axis).
- Ink on ground and ink on panel ≥ 4.5:1 contrast. Check a light palette's panel tint too.
- The dot grid and connectors stay faint: they orient, they don't decorate.
- Images full-bleed in a `shape: 'none'` frame, or rounded inside a rect; never stretched.

## Speaker support

- Write `notes` for every stop: what to say, in two or three sentences. The presenter sees them
  with **N**, with the next step and a timer.
- 1–2 minutes per stop is a good pace; a 10-minute talk is about 6–8 stops.

## Training sessions

When the talk teaches (a training, a workshop, a trainer evaluation), shape it as a lesson:
**Hook → Objectives → Explain → Show → Ask → Demonstrate → Check → Recap.**

- **Hook:** the title slide asks a question the topic answers ("How do we know our code is actually
  good?"), not a definition.
- **Objectives:** "In this session, you will learn:" and 4–6 topics. Avoid "you will be able to
  explain…": it reads as a demand on the learner.
- **Ask:** 3–6 questions for the room on slides they fit, as the slide's last click. Word everything
  on screen for the audience ("QUICK QUESTION", "What would your team do, and why?"); never put
  presenter instructions on a slide ("Ask the room", "Discuss for a minute"). Expected answers go in
  the notes.
- **Scenarios:** one or two real situations ("tests pass locally, fail in CI"; "a token was pushed"),
  each a question first, then the answer one step per click.
- **Check:** a knowledge check near the end: each question, then its answer a click later, then a
  scenario question.
- **Recap:** the journey as a loop or a line, one closing sentence, then "Questions?".
- **Notes:** end each slide's notes with its trainer technique ("Trainer technique: analogy for
  difficult concepts"), when the user's plan names them.
- 30–45 minutes is normal for a short training; cover what matters rather than cutting to a time.
- **Levels:** Beginner gets analogies, slower builds and more checks; Intermediate gets real-world
  workflow and trade-offs; Expert gets internals, edge cases and production practice, and moves
  quickly through the basics (one shared slide with expert wording, not five beginner slides).

Lessons from trainers' reviews (apply to every training deck):
- **The agenda lists the modules, the breaks and the wrap-up only**: no "Opening" row (the presenter is already opening).
- **Never assume an editor is installed**: no `code …`, `notepad …` or `nano …` in demo steps. Files are created and edited with
  Edit ↗ (or the workbench), and the step shows a command that proves it (`git status --short` → `?? …`/` M …`). A demo that needs
  a later version of a file names its stage, so "Reset to this slide" puts it in place.
- **No shorthand hints**: "(with the dot, plural)" or "Quotes when unsure" leave the room guessing. Say the rule and give the
  real example: "a dot before github, an s on workflows"; "Quote numbers like \"3.10\": unquoted, 3.10 becomes 3.1".
- **Use the product's own names**: GitHub calls `actions/checkout@v4` owner / repository @ ref (a tag, branch or SHA), not
  "name" and "version". Labels under a token sit exactly under their part (underline each part).
- **Every deck with live demos declares `demo:`** in Deck.config (even `{ ask: [], checks: [...] }`), so the first start from the
  launcher asks the language (when the deck has several) and runs the pre-flight check. Every demo stage is named by a slide
  (`stage:`) — otherwise "Reset to this slide" can only lay the starting project.
- **A demo step that creates or changes a file carries it** (`edit: [path, lines]` → an Edit ↗ chip on the step, from the same
  constant the slide's panel uses); clicking the step itself only types its command.
- **Placeholders the room may copy**: write `src/` and `tests/` as folders, not "src · tests · …".

## Layout of cards and panels

- Commands and anything "written" live type themselves out (`data-type`, deck-api.md §10): the
  audience gets the feel of typing them. Output appears after the command, never before.

- Stack cards with a flex column and a `gap` (`display:flex; flex-direction:column; gap:20px`),
  not fixed `top` values: text that wraps one more line then pushes the next card down instead of
  under it. Give cards `min-height`, never a fixed `height`.
- HTML panels sit above the slide's SVG: an icon drawn in the SVG under a card is hidden. Put the
  icon inside the card's HTML.
- Leave clear space between a drawing's labels and any arrow: route return arrows below the labels.
- Keep the text block of a title slide anchored near the top when something sits at the bottom
  (a status strip, a timeline); centring pushes it into that.

## 3D (three.js)

- 3D earns its cost when depth is the idea: what something looks like from the side, how parts
  fold, stack, orbit or nest. If a flat drawing says it as well, draw it flat.
- One clear object, lit simply (the default lights), on the slide background; colours from the palette
  (`new THREE.Color('#F2B63C')`). Metals look dark without an environment map: keep `metalness`
  ≤ 0.6 and add a warm fill light.
- Leave room for the caption: put the object below or beside the text, never under it.
- Camera moves are slow and eased, one at a time; nothing spins for its own sake.

## Checklist before delivering

1. `render.py --check` passes (no overflow, deterministic, the deck builds).
2. The contact sheet shows: the overview legible at a glance, each stop filling the screen without
   crowding, nested frames legible when zoomed, one mid-hop still (`N@0.5`) that looks intentional.
3. Every stop has notes; the route opens on the title and ends on the map (or a closing frame).
4. Nothing on the map is cut off in the overview; nothing important sits under the control bar's
   spot at the bottom centre when a frame is fitted.

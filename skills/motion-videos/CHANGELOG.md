# Motion skill: changes

## 2.0 (2026-10-15)

Player (every built film):
- Control bar: play/pause, restart, loop (film or one scene/chapter), volume, mute, full screen, Export.
- Numbered scene chips with a ⋯ menu: jump, loop, export this part, "Ask Claude for a change"
  (copies a request naming the scene id and the exact moment).
- Tweaks / Style panel: film-declared knobs (`Film.tweak`), palettes (`Film.palette`), soundtrack picker
  (named `Film.score` variants, None, or the viewer's own audio file), subtitles. Settings travel in the URL.
- In-page Export: MP4 (H.264 + AAC, 720p/1080p, 15–120 fps, three qualities, optional 2× supersampling)
  or GIF, for the whole film or one part, encoded in the browser (Chrome/Edge). Published as an Artifact,
  declare `capabilities: {downloads: true}`.

Film API:
- `Film.tweak`, `Film.palette`, `Film.score(fn, {name})` variants, `Film.chapter`.
- `Film.audio(src)` for recorded dialogue, narration or songs, in sync everywhere; a score ducks under speech.
- `Film.cues(list | 'cues.json')`: subtitles, `k.cues`, `k.cueAt(t)`, `k.beats`, `k.bpm`.
- Films up to three hours (was 300 s). `fps` may be 120.
- Scene objects: names starting with `$` are the player's; anything else on `this` is yours.

Scripts:
- `build.py` embeds Google Fonts (offline pages, faithful exports) and local `Film.audio` / `Film.cues` files.
- `render.py --workers N` renders in parallel browsers and joins losslessly.
- New `cues.py`: time a film to audio by pauses, by your script's lines, by Whisper transcription, or by beats.

Fixes:
- A scene that set `this.box` or `this.start` overwrote player state and crashed the film.
- `render.py --mp4` dropped the last frames when adding the soundtrack (`-shortest`); it now pads and cuts exactly.

# Sound: a score written as data

`Film.score(function (S, T) { … })` records music and sound effects against the film's own
timeline. `T` holds each scene's start in seconds by id, plus `T.END`. The player synthesizes
the score live (WebAudio, no samples), in sync with playback and scrubbing, and
`render.py --mp4` renders the identical events offline into the MP4's audio track.
The player starts muted (browsers require it); the viewer turns sound on.

## The method

- **Tempo from the cut.** Pick a BPM whose bars land on scene changes, and phase the grid
  with `t0` so a downbeat hits the biggest moment. 96 BPM = 0.625 s a beat = 5 s per two bars.
- **Music on the grid, effects on the frame.** Notes take `{beat, beats}`; effects take the
  exact second of the event they belong to (a ball landing, a dot popping in, a keystroke).
- **An arc.** Quiet open (a pad, one mallet note) → a light pulse as things start moving →
  the groove when the action starts → a short run or swell INTO the end card's hit → let the
  last chord ring and fade over the final second or so.
- **Instruments that suit a short film**: marimba, plucked notes, electric piano, a round bass,
  a light kit (kick, side stick, closed hat), a soft pad. Warm, major or modal, mid-tempo.
- **Original music only.** Never write an existing song's, theme's or jingle's melody; write an
  original one in the mood asked for, and say so.
- Keep it small: a 30 s score is a couple of hundred events.

## API

```js
Film.score(function (S, T) {
  const B = 60 / 96;
  S.tempo(96, { t0: T.pour - 8 * B });                         // beat 8 lands on the "pour" scene
  S.program('pad', 'pad', { rev: 0.6 });                       // name a track: patch + options
  S.program('keys', 'ep'); S.program('bass', 'bass'); S.program('mallet', 'marimba', { pan: -0.2 });
  S.note('pad', 'D3', { beat: 0, beats: 8, vel: 30 });         // grid time ...
  S.note('mallet', 'A5', { t: 0, dur: 1.5, vel: 46 });         // ... or seconds
  S.chord('keys', ['D3', 'A3', 'C#4', 'F#4'], { beat: 8, beats: 4, vel: 52 });
  S.pattern('mallet', 'x.x.X.xx', { from: 8, repeat: 4, pitch: ['D5', 'A4'], vel: 60 });   // step .5 beat
  S.drums({ kick: 'x...x...', sidestick: '..x...x.', hat: 'oxoxoxox' }, { from: 16, repeat: 6 });
  S.fx('boing', T.pour + 1.3);                                 // effects at exact seconds
  S.fx('revswell', T.end + 0.4, { dur: 1.2 });                 // swells INTO its time
  S.run('mallet', ['D5', 'E5', 'F#5', 'A5', 'D6'], { t: T.end, step: 0.1, cresc: 8 });
  S.ticks(myTypist.times, { vel: 30 });                         // one tick per keystroke
  S.master({ gain: -6, fadeOut: 1.2 });
});
```

- Pitches: `'C4'`, `'F#3'`, `'Bb2'` or MIDI numbers. Velocity 0–127.
- Pattern strings: `x` hit, `X` accent, `o` ghost, `.` rest; each character is `step` beats
  (default 0.5). `repeat` copies the string; compute it so it stops where you mean.
- `S.beat(n)` → seconds; `S.toBeat(t)` → beats; `S.seed(n)` varies the built-in humanizing.
- Track options: `gain` (dB), `pan` (−1..1), `rev` (0..1 reverb send).
- Pitched patches: `marimba`, `kalimba`, `vibes`, `glock`, `pluck`, `ep`, `keys`, `pad`, `bass`.
- Drums: `kick`, `snare`, `clap`, `sidestick`, `hat`, `openhat`, `shaker`, `tamb`, `woodblock`,
  `cowbell`, `tom`, `crash`, `ride`.
- Effects (`S.fx(name, t, {vel, dur, pitch})`, pitch in semitones): `tick`, `click`,
  `doubleclick`, `pop`, `ding`, `chime`, `sparkle`, `whoosh`, `revswell`, `roll` (accelerating
  ticks over `dur`, landing on a ding), `boing`, `thud`.
- Unknown names warn in the console and stay silent. Events before 0 or after the end are dropped.
- No score at all: omit `Film.score`; the sound button disappears.
- **Alternatives:** call `Film.score(fn, {name: 'Calm'})` more than once; the first is the default
  and the viewer picks another (or None, or their own file) in the Tweaks panel. Offer one or two
  variants with a clearly different mood (a calmer pad-and-mallet take, a driving one), built on
  the same scene times so the hits still land.
- **Recorded audio** (dialogue, narration, a song) is `Film.audio`, not a score: see kit-api.md
  section 7. A score under dialogue ducks automatically; under a song, leave the score out.

## Checking it

Export an MP4 and measure loudness every two seconds:

```bash
python scripts/render.py film.html --mp4 /tmp/check.mp4 --fps 12
ffmpeg -v error -i /tmp/check.mp4 -vn -ac 1 -ar 8000 -f s16le - | python3 -c "
import sys, numpy as np; a = np.frombuffer(sys.stdin.buffer.read(), np.int16) / 32768
for s in range(0, len(a) // 8000, 2): x = a[s*8000:(s+2)*8000]; print(s, round(20*np.log10(np.sqrt((x**2).mean()) + 1e-9), 1))"
```

Roughly: −40 dB is a quiet pad, −25 a groove, −20 a hit. The end hit should be clearly louder
than the opening.

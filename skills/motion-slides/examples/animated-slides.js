// "Version control, in motion": the default kind of deck. Concept slides are animations with stops (one idea per click).
// Format: slides (default) · Colors: Paper notebook · Fonts: Literata over IBM Plex Sans, IBM Plex Mono.
const { seg, eo, ei, eio, eob, lerp, clamp01, TextFx, typist, breathe } = kit;
const draw = (el, p) => { kit.draw(el, p); el.style.opacity = p > .002 ? '1' : '0'; };

Deck.config({
  title: 'Version control, in motion', background: '#F7F4EC',
  fonts: { display: { family: 'Literata', weights: [600, 700] }, sans: { family: 'IBM Plex Sans', weights: [400, 600] }, mono: { family: 'IBM Plex Mono', weights: [500, 600] } },
  notes: 'Three ideas, each an animation you click through: one idea per click.',
});
Deck.css(`
#stage { --ground:#F7F4EC; --main:#2F5D8C; --ink:#1D232B; --accent:#E3642B; --kick:#B5481C; --card:#FFFFFF; --soft:#DCE4EE }
.dk-rect { background:#FBF9F4; box-shadow:inset 0 0 0 4px var(--line), 0 18px 40px rgba(29,35,43,.06) }
.hub .dk-title { font-size:140px } .hub .dk-sub { font-size:50px }
.cl { position:absolute; inset:0 }
.cl svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible }
.cl .h { position:absolute; left:110px; top:90px; right:110px; margin:0; font-family:var(--display, serif); font-size:78px; font-weight:700; line-height:1.05; letter-spacing:-0.02em; color:var(--ink) }
.cl .s { position:absolute; left:110px; top:190px; margin:0; font-size:38px; color:var(--dim) }
.cl .say { position:absolute; left:0; right:0; bottom:80px; margin:0; text-align:center; font-size:42px; font-weight:600; color:var(--kick) }
.fname { font-family:var(--mono, monospace); font-size:22px; fill:var(--dim) }
.mono { font-family:var(--mono, monospace) }
.term { position:absolute; left:160px; top:230px; width:1280px; height:520px; box-sizing:border-box; padding:70px 50px 40px; border-radius:26px; background:var(--ink); color:#EDEBE4; font-family:var(--mono, monospace); font-size:36px; line-height:1.55; white-space:pre; box-shadow:0 24px 50px rgba(29,35,43,.18) }
.term::before { content:"● ● ●"; position:absolute; left:28px; top:18px; font-size:22px; letter-spacing:6px; color:#5B636E }
.term .p { color:#7FB0E8 } .term .o { color:#9AA3AE } .term .c { color:#FF9B6B }
.note { position:absolute; left:420px; top:300px; width:760px; box-sizing:border-box; padding:34px 40px; border-radius:26px; background:var(--card); box-shadow:inset 0 0 0 4px var(--line), 0 18px 34px rgba(29,35,43,.08); font-size:38px; line-height:1.9 }
.note b { display:inline-block; width:150px; font-family:var(--mono, monospace); font-size:26px; letter-spacing:.1em; color:var(--kick) }
.note .why { font-family:var(--mono, monospace); color:var(--main) }
`);

// ---------- drawing helpers ----------
// a document icon at (x, y), scale s; red marks a conflicting copy
const DOC = (cls, x, y, s, red, name) => '<g class="' + cls + '" data-x="' + x + '" data-y="' + y + '" data-s="' + s + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
  '<path d="M-40 -52 H22 L40 -34 V52 H-40 Z" fill="' + (red ? '#F6C9C0' : '#DCE4EE') + '" stroke="#1D232B" stroke-width="4" stroke-linejoin="round"/><path d="M22 -52 V-34 H40" fill="none" stroke="#1D232B" stroke-width="4" stroke-linejoin="round"/>' +
  [-22, -8, 6, 20].map((yy, i) => '<path d="M-24 ' + yy + ' H' + (i === 3 ? 6 : 24) + '" stroke="' + (red ? '#C9604A' : '#8796AA') + '" stroke-width="5" stroke-linecap="round"/>').join('') +
  (name ? '<text class="fname" y="88" text-anchor="middle">' + name + '</text>' : '') + '</g>';
const popAt = (g, p, rot = 0) => { const s = eob(clamp01(p), 1.8) * +g.dataset.s; g.setAttribute('transform', 'translate(' + g.dataset.x + ' ' + g.dataset.y + ') rotate(' + rot.toFixed(1) + ') scale(' + Math.max(.001, s).toFixed(3) + ')'); g.style.opacity = p > 0 ? '1' : '0'; };
const headIn = (k, t) => { TextFx.fadeFromRight(k.stage.querySelector('.h'), t, -.2); const s = k.stage.querySelector('.s'); if (s) { s.style.opacity = String(eo(seg(t, .4, .9))); } };
const sayIn = (el, t, a) => { const p = eo(seg(t, a, a + .5)); el.style.opacity = String(p); el.style.transform = 'translateY(' + lerp(16, 0, p).toFixed(1) + 'px)'; };

// ---------- the title ----------
Deck.frame('title', { cls: 'hub', kick: 'Module 1 · Foundations', title: 'Version control, in motion', sub: 'Three ideas, each with its own animation.',
  notes: 'Three slides. On each, the animation plays to a stop and waits; click for the next idea.' });

// ---------- clip 1: the mess ----------
const COPIES = [['report.doc', 0], ['report_v2.doc', 0], ['report_final.doc', 0], ['report_final_REAL.doc', 0], ['report_final_v3.doc', 0], ['report_USE_THIS.doc', 0], ['report_final(2).doc', 1]];
Deck.frame('mess', { name: 'Life before version control',
  notes: 'Arrival: one file. Click 1: you start saving copies. Click 2: the copies pile up. Click 3: which one is the latest? Ask the room if they have seen names like these.',
  clip: { stops: [3.2, 4.55, 7.4], scenes: [
    { name: 'One file', dur: 3.2,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">You start a project.</h2><p class="s">One file. Life is simple.</p><svg viewBox="0 0 1600 900">' + DOC('d1', 800, 520, 2.2, 0, 'report.doc') + '</svg></div>'; this.d = k.stage.querySelector('.d1'); },
      render(t, k) { headIn(k, t); popAt(this.d, seg(t, .3, .8), 0); this.d.setAttribute('transform', this.d.getAttribute('transform') + ' translate(0 ' + (6 * Math.sin(t * 2)).toFixed(1) + ')'); } },
    { name: 'Copies', dur: 4.2,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">So you save copies. Just in case.</h2><svg viewBox="0 0 1600 900">' +
          COPIES.map(([n, red], i) => DOC('cp', 260 + (i % 4) * 360 + (i >= 4 ? 180 : 0), 380 + Math.floor(i / 4) * 260, 1.15, red, n)).join('') + '</svg></div>';
        this.c = [...k.stage.querySelectorAll('.cp')]; },
      render(t, k) { headIn(k, t); this.c.forEach((d, i) => popAt(d, seg(t, .3 + i * .32, .65 + i * .32), (i % 2 ? 4 : -4) * (i ? 1 : 0))); } },
    { name: 'Which one?', dur: 3.6,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">Which one is the latest?</h2><svg viewBox="0 0 1600 900">' +
          COPIES.map(([n, red], i) => DOC('cp', 260 + (i % 4) * 360 + (i >= 4 ? 180 : 0), 380 + Math.floor(i / 4) * 260, 1.15, red, n)).join('') +
          [2, 3, 5, 6].map(i => '<text class="q" data-i="' + i + '" x="' + (260 + (i % 4) * 360 + (i >= 4 ? 180 : 0)) + '" y="' + (380 + Math.floor(i / 4) * 260 - 92) + '" text-anchor="middle" style="font-family:var(--display, serif);font-size:72px;font-weight:700" fill="#E3642B">?</text>').join('') + '</svg><p class="say">And what changed between them?</p></div>';
        this.c = [...k.stage.querySelectorAll('.cp')]; this.q = [...k.stage.querySelectorAll('.q')]; this.say = k.stage.querySelector('.say'); },
      render(t, k) { headIn(k, t); this.c.forEach((d, i) => popAt(d, 1, (i % 2 ? 4 : -4) * (i ? 1 : 0)));
        this.q.forEach((q, j) => { const p = eob(seg(t, .4 + j * .2, .7 + j * .2), 1.9); q.style.opacity = String(clamp01(p)); q.setAttribute('transform', 'translate(0 ' + (-8 * Math.abs(Math.sin(t * 3 + j))).toFixed(1) + ')'); });
        sayIn(this.say, t, 1.6); } },
  ] },
});

// ---------- clip 2: snapshots and history ----------
const DAYS = [['Mon', 'First draft'], ['Tue', 'New intro'], ['Wed', 'Add chart'], ['Thu', 'Fix typos']];
Deck.frame('history', { name: 'What version control does',
  notes: 'Arrival: a timeline and the first snapshot. Click 1: a snapshot each day. Click 2: every snapshot carries a note (who, when, why). Click 3: go back to Tuesday.',
  clip: { stops: [1.25, 4.0, 7.6], scenes: [
    { name: 'Snapshots', dur: 4,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">Save a snapshot whenever you want.</h2><svg viewBox="0 0 1600 900"><path class="tl" d="M220 600 H1380" stroke="#2F5D8C" stroke-width="8" stroke-linecap="round" fill="none"/>' +
          DAYS.map(([d, w], i) => '<g class="sn" data-x="' + (340 + i * 300) + '" data-y="600" data-s="1"><circle r="26" fill="#2F5D8C"/><circle r="12" fill="#F7F4EC"/><text y="70" text-anchor="middle" style="font-size:30px;font-weight:600" fill="#1D232B">' + d + '</text><text class="fname" y="108" text-anchor="middle" style="font-size:26px">' + w + '</text></g>').join('') +
          DOC('doc', 800, 360, 1.5, 0, 'report.doc') + '</svg></div>';
        this.tl = k.stage.querySelector('.tl'); this.s = [...k.stage.querySelectorAll('.sn')]; this.doc = k.stage.querySelector('.doc'); },
      render(t, k) { headIn(k, t); popAt(this.doc, seg(t, .1, .5)); draw(this.tl, eio(seg(t, .3, 1.3))); this.s.forEach((g, i) => popAt(g, seg(t, .9 + i * .55, 1.2 + i * .55))); } },
    { name: 'A note', dur: 3.6,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">Each snapshot carries a note.</h2><div class="note"><div><b>WHO</b>Asha</div><div><b>WHEN</b>Tuesday, 4:02 pm</div><div><b>WHY</b><span class="why"></span></div></div></div>';
        this.note = k.stage.querySelector('.note').style; this.why = k.stage.querySelector('.why'); this.ty = typist('Add a new intro', .9, 18, 3); },
      render(t, k) { headIn(k, t); const p = eob(seg(t, .1, .55), 1.5); this.note.opacity = String(clamp01(p * 2)); this.note.transform = 'scale(' + lerp(.9, 1, p).toFixed(3) + ')';
        const s = this.ty.at(t); if (this.why.textContent !== s) this.why.textContent = s; } },
    { name: 'Go back', dur: 3.8,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">Made a mistake? Go back.</h2><svg viewBox="0 0 1600 900"><path d="M220 600 H1380" stroke="#2F5D8C" stroke-width="8" stroke-linecap="round" fill="none"/>' +
          DAYS.map(([d], i) => '<g transform="translate(' + (340 + i * 300) + ' 600)"><circle r="26" fill="#2F5D8C"/><circle r="12" fill="#F7F4EC"/><text y="70" text-anchor="middle" style="font-size:30px;font-weight:600" fill="#1D232B">' + d + '</text></g>').join('') +
          '<circle class="ph" r="40" fill="none" stroke="#E3642B" stroke-width="7"/>' + DOC('doc', 800, 360, 1.5, 0, '') + '<text class="fname dl" x="800" y="470" text-anchor="middle" style="font-size:28px"></text></svg><p class="say">Restored, exactly as it was.</p></div>';
        this.ph = k.stage.querySelector('.ph'); this.doc = k.stage.querySelector('.doc'); this.dl = k.stage.querySelector('.dl'); this.say = k.stage.querySelector('.say'); },
      render(t, k) { headIn(k, t); popAt(this.doc, 1); const x = lerp(1240, 640, eio(seg(t, .5, 1.6))); this.ph.setAttribute('cx', x.toFixed(1)); this.ph.setAttribute('cy', '600');
        const back = t > 1.6; this.dl.textContent = back ? 'report.doc, as of Tuesday' : 'report.doc, as of Thursday'; this.dl.setAttribute('fill', back ? '#2F5D8C' : '#7A8592');
        this.doc.style.filter = back ? 'drop-shadow(0 0 ' + (18 * (1 - seg(t, 1.6, 2.6))).toFixed(1) + 'px #2F5D8C)' : 'none'; sayIn(this.say, t, 1.9); } },
  ] },
});

// ---------- clip 3: Git in a terminal ----------
const TERM = [['p', '$ git init'], ['o', 'Initialized empty Git repository'], ['p', '$ git add report.doc'], ['p', '$ git commit -m "Add new intro"'], ['o', '[main a3f9c21] Add new intro']];
Deck.frame('git', { name: 'What Git is',
  notes: 'Arrival: git init starts tracking. Click 1: git add picks what to save. Click 2: git commit saves the snapshot. Click 3: that snapshot is a commit, with its own ID.',
  clip: { stops: [1.6, 2.9, 6.0], scenes: [
    { name: 'Commands', dur: 6,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">Talk to Git with commands.</h2><div class="term"></div></div>'; this.term = k.stage.querySelector('.term');
        let t0 = .5; this.lines = TERM.map(([c, s]) => { const at0 = t0, ty = c === 'p' ? typist(s, at0, 22, s.length) : { at: t => t >= at0 ? s : '', end: at0 }; const L = { c, ty, t0: at0 }; t0 = (c === 'p' ? ty.end : t0) + (c === 'p' ? .35 : .5); return L; }); },
      render(t, k) { headIn(k, t);
        const html = this.lines.filter(L => t >= L.t0).map(L => '<span class="' + L.c + '">' + kit.esc(L.ty.at(t)).replace('a3f9c21', '<span class="c">a3f9c21</span>') + '</span>').join('\n');
        const cur = Math.floor(t * 2) % 2 ? '' : '▍'; const out = html + cur; if (this.term.innerHTML !== out) this.term.innerHTML = out; } },
    { name: 'A commit', dur: 4.4,
      init(k) { k.stage.innerHTML = '<div class="cl"><h2 class="h">That snapshot is a commit.</h2><svg viewBox="0 0 1600 900"><path class="tl" d="M200 660 H1400" stroke="#2F5D8C" stroke-width="8" stroke-linecap="round" fill="none"/>' +
          [380, 620, 860].map(x => '<g transform="translate(' + x + ' 660)"><circle r="24" fill="#2F5D8C"/></g>').join('') + '<g class="nc" data-x="1100" data-y="660" data-s="1"><circle r="34" fill="#E3642B"/></g>' +
          '<path class="lk" d="M1100 620 V520" stroke="#E3642B" stroke-width="5" stroke-dasharray="6 8" fill="none"/></svg>' +
          '<div class="note card2" style="left:780px;top:250px;width:640px;line-height:1.6;font-family:var(--mono, monospace);font-size:32px">commit <span style="color:#E3642B">a3f9c21</span><br>Author: Asha<br>Date: Tue, 4:02 pm<br><span class="why">Add new intro</span></div><p class="say">Every commit gets its own unique ID.</p></div>';
        this.nc = k.stage.querySelector('.nc'); this.lk = k.stage.querySelector('.lk'); this.card = k.stage.querySelector('.card2').style; this.say = k.stage.querySelector('.say'); },
      render(t, k) { headIn(k, t); popAt(this.nc, seg(t, .3, .6)); draw(this.lk, eio(seg(t, .6, 1.0)));
        const p = eob(seg(t, .9, 1.4), 1.5); this.card.opacity = String(clamp01(p * 2)); this.card.transform = 'translateY(' + lerp(20, 0, p).toFixed(1) + 'px)'; sayIn(this.say, t, 1.8); } },
  ] },
});


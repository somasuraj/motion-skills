// "One line" — a 30 s showcase: a single line draws every scene.
// Style: One line · Colors: Night signal · Fonts: Syne (display) over Manrope.
const { seg, eo, ei, eio, eob, lerp, clamp01, TextFx, draw, sample, along, breathe } = kit;

Film.config({
  title: 'One line', width: 1920, height: 1080, fps: 60, background: '#0E1020',
  fonts: { display: { family: 'Syne', weights: [700, 800] }, sans: { family: 'Manrope', weights: [400, 700] } },
});

// What a viewer may change in the player (Tweaks / Style). Scenes read tweaks with k.tweak(id).
Film.tweak('headline', { label: 'Opening line', type: 'text', default: 'It starts with one line.' });
Film.palette([
  { name: 'Night signal', vars: { '--ground': '#0E1020', '--main': '#7C5CFF', '--ink': '#EDEBFF', '--accent': '#3DDC97' } },
  { name: 'Paper', vars: { '--ground': '#F4EFE6', '--main': '#2B59C3', '--ink': '#1B1A17', '--accent': '#E4572E' } },
  { name: 'Ember', vars: { '--ground': '#1A1210', '--main': '#F2A541', '--ink': '#FFF4E6', '--accent': '#5BC0EB' } },
]);

Film.css(`
.mo-scene { --ground:#0E1020; --main:#7C5CFF; --ink:#EDEBFF; --accent:#3DDC97; color:var(--ink); font-family:var(--sans, system-ui, sans-serif) }
.ground { position:absolute; inset:0; background-color:var(--ground); background-image:radial-gradient(circle, color-mix(in srgb, var(--ink) 9%, transparent) 2px, transparent 2.5px); background-size:48px 48px; background-position:24px 12px }
.words { position:absolute; margin:0; display:flex; flex-direction:column; gap:24px } .words > * { margin:0 }
.line { font-family:var(--display, var(--sans, sans-serif)); font-size:120px; line-height:1; font-weight:800; letter-spacing:-0.02em }
.big { font-size:200px; line-height:.95 }
.sub { font-size:36px; line-height:1.3; color:color-mix(in srgb, var(--ink) 68%, var(--ground)) }
.kicker { font-size:30px; font-weight:700; letter-spacing:.14em; color:var(--accent) }
.art { position:absolute; inset:0; width:100%; height:100%; overflow:visible }
.ln { fill:none; stroke:var(--main); stroke-width:12; stroke-linecap:round; stroke-linejoin:round }
.ln-thin { fill:none; stroke:var(--main); stroke-width:6; stroke-linecap:round; stroke-linejoin:round }
.ln-ghost { fill:none; stroke:color-mix(in srgb, var(--main) 30%, var(--ground)); stroke-width:4; stroke-linecap:round; stroke-dasharray:2 18 }
.ln-accent { fill:none; stroke:var(--accent); stroke-width:12; stroke-linecap:round }
.fill-main { fill:var(--main) } .fill-accent { fill:var(--accent) } .fill-ink { fill:var(--ink) }
.tip { fill:var(--ink) } .tip-ring { fill:none; stroke:var(--accent); stroke-width:4 }
.shadow { fill:color-mix(in srgb, var(--main) 22%, var(--ground)) }
`);

// The pen tip every scene shares: a dot with a ring that ripples outward.
const PEN = '<g class="pen"><circle class="tip-ring" r="22"/><circle class="tip" r="10"/></g>';
function placePen(g, x, y, t, on = 1) {
  g.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')');
  const ph = (t % 1.2) / 1.2;
  g.firstChild.setAttribute('r', String(14 + 22 * ph));
  g.firstChild.style.opacity = String((1 - ph) * on);
  g.lastChild.style.opacity = String(on);
}
const enterSub = (st, t, a) => { st.opacity = eo(seg(t, a, a + .5)); st.transform = 'translateX(' + lerp(26, 0, eo(seg(t, a, a + .5))) + 'px)'; };

Film.scene('spark', {
  name: 'The spark', dur: 4,
  init(k) {
    k.stage.append(k.h('<div class="ground"><svg class="art" viewBox="0 0 1920 1080">' +
      '<path class="ln-ghost spark-ghost" d="M220 720 C620 720 700 560 1000 640 S1500 780 1990 660"/>' +
      '<path class="ln spark-path" d="M220 720 C620 720 700 560 1000 640 S1500 780 1990 660"/>' + PEN + '</svg>' +
      '<div class="words spark-words" style="left:220px;top:250px;width:1500px">' +
      '<p class="kicker spark-kick">MOTION, WRITTEN AS CODE</p><h1 class="line spark-head">' + k.esc(k.tweak('headline')) + '</h1></div></div>'));
    const q = s => k.stage.querySelector(s);
    this.path = q('.spark-path'); this.ghost = q('.spark-ghost'); this.pen = q('.pen');
    this.kick = q('.spark-kick').style; this.words = q('.spark-words').style; this.head = q('.spark-head');
    this.pts = sample(this.path, 240);
  },
  render(t) {
    TextFx.fadeFromRight(this.head, t, -0.6);          // starts early so frame 0 already reads
    this.kick.opacity = eo(seg(t, -0.6, -0.1));
    this.words.transform = 'translateX(' + (-2 * t).toFixed(2) + 'px)';
    const p = eio(seg(t, 0.7, 3.8));
    draw(this.path, p);
    this.ghost.style.opacity = String(0.9 * (1 - p));
    const anticip = t < 0.7 ? -14 * Math.sin(Math.PI * seg(t, 0.35, 0.7)) : 0;
    const [x, y] = along(this.pts, p);
    placePen(this.pen, x + anticip, y, t);
    this.pen.lastChild.setAttribute('r', String(10 * eob(seg(t, -0.4, 0.3), 1.8)));
  },
});

const BN = { G: 800, R: 60, hits: [1.3, 2.1, 2.7, 3.15, 3.45], hs: [380, 210, 110, 45] };
function bnPos(t) {
  const x = lerp(220, 1580, eo(seg(t, 0.6, 4.4)));
  let y = BN.G;
  if (t < 0.6) y = BN.G - 560;
  else if (t < BN.hits[0]) { const s = (t - 0.6) / 0.7; y = BN.G - 560 * (1 - s * s); }
  else for (let i = 0; i < 4; i++) { const a = BN.hits[i], b = BN.hits[i + 1]; if (t >= a && t < b) { const s = (t - a) / (b - a); y = BN.G - BN.hs[i] * 4 * s * (1 - s); } }
  return [x, y];
}
Film.scene('bounce', {
  name: 'Weight', dur: 5,
  init(k) {
    k.stage.append(k.h('<div class="ground"><svg class="art" viewBox="0 0 1920 1080">' +
      '<path class="ln-ghost bounce-floor" d="M120 862 H1800"/><ellipse class="shadow bounce-shadow" cx="0" cy="866" rx="70" ry="12"/>' +
      '<polyline class="ln-thin bounce-trail" points=""/>' +
      '<g class="bounce-ball"><g class="bounce-body"><circle class="fill-main" r="60"/><path class="ln-accent" style="stroke-width:10" d="M-34 -20 A40 40 0 0 1 20 -36"/></g></g></svg>' +
      '<div class="words" style="right:180px;top:170px;width:820px;align-items:flex-end;text-align:right">' +
      '<h2 class="line big bounce-head">Weight.</h2><p class="sub bounce-sub">Squash, stretch and settle.</p></div></div>'));
    const q = s => k.stage.querySelector(s);
    Object.assign(this, { trail: q('.bounce-trail'), ball: q('.bounce-ball'), body: q('.bounce-body'), shadow: q('.bounce-shadow'), floor: q('.bounce-floor'), head: q('.bounce-head'), sub: q('.bounce-sub').style });
  },
  render(t) {
    TextFx.fadeFromRight(this.head, t, 0.3); enterSub(this.sub, t, 1.0);
    draw(this.floor, eio(seg(t, 0, 1.1)));
    const [x, y] = bnPos(t), pts = [], t0 = 0.6, t1 = Math.max(t0, Math.min(t, 4.4));
    for (let i = 0; i <= 90; i++) { const [px, py] = bnPos(t0 + (t1 - t0) * i / 90); pts.push(px.toFixed(1) + ',' + py.toFixed(1)); }
    this.trail.setAttribute('points', t > t0 ? pts.join(' ') : ''); this.trail.style.opacity = '0.55';
    let sq = 0;                                         // squash on impact, decaying with each bounce
    BN.hits.forEach((h, i) => { const d = Math.abs(t - h); if (d < 0.08) sq = Math.max(sq, (1 - d / 0.08) * (i ? 0.7 * (1 - i / 6) : 1)); });
    const vy = (bnPos(t + 0.016)[1] - y) / 0.016, st = sq > 0 ? 0 : Math.min(0.12, Math.abs(vy) / 9000);   // stretch with speed
    const sx = (1 + 0.18 * sq) / (1 + st), sy = (1 - 0.18 * sq) * (1 + st), grow = eob(seg(t, 0, 0.5), 1.8);
    this.ball.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (y + BN.R * (1 - sy)).toFixed(1) + ')');
    this.body.setAttribute('transform', 'scale(' + (sx * grow).toFixed(3) + ' ' + (sy * grow).toFixed(3) + ') rotate(' + ((x - 220) / BN.R * 57.3).toFixed(1) + ')');
    const hgt = clamp01((BN.G - y) / 560);
    this.shadow.setAttribute('cx', x.toFixed(1)); this.shadow.setAttribute('rx', String(70 * (1 - 0.6 * hgt)));
    this.shadow.style.opacity = String((1 - 0.7 * hgt) * eo(seg(t, 0.3, 0.9)));
  },
});

const OB = { cx: 1240, cy: 560, a: [210, 340, 470], b: [78, 128, 178], per: [1.25, 2.5, 3.75], t0: [0.7, 1.0, 1.3] };
Film.scene('orbit', {
  name: 'Rhythm', dur: 5,
  init(k) {
    let s = '<div class="ground"><svg class="art" viewBox="0 0 1920 1080"><path class="ln orbit-lead" d="M-20 860 C400 860 700 760 900 640 S1150 560 1240 560"/><g class="orbit-sys">';
    for (let i = 0; i < 3; i++) s += '<ellipse class="ln-thin orbit-ring" rx="' + OB.a[i] + '" ry="' + OB.b[i] + '"/>';
    s += '</g><circle class="fill-main orbit-core" r="46"/>';
    for (let i = 0; i < 3; i++) s += '<circle class="' + (i === 1 ? 'fill-accent' : 'fill-ink') + ' orbit-moon" r="' + [18, 24, 16][i] + '"/>';
    s += '</svg><div class="words" style="left:180px;top:200px;width:700px"><h2 class="line big orbit-head">Rhythm.</h2><p class="sub orbit-sub">Timing is everything.</p></div></div>';
    k.stage.append(k.h(s));
    const q = s => k.stage.querySelector(s);
    Object.assign(this, { lead: q('.orbit-lead'), sys: q('.orbit-sys'), core: q('.orbit-core'), rings: [...k.stage.querySelectorAll('.orbit-ring')], moons: [...k.stage.querySelectorAll('.orbit-moon')], head: q('.orbit-head'), sub: q('.orbit-sub').style });
  },
  render(t) {
    TextFx.fadeFromRight(this.head, t, 0.25); enterSub(this.sub, t, 0.9);
    draw(this.lead, eio(seg(t, -0.1, 0.8))); this.lead.style.opacity = String(1 - eo(seg(t, 1.4, 2.2)));
    const spin = -18 + 2.2 * t, sc = breathe(t, 0.02), rad = spin * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
    this.sys.setAttribute('transform', 'translate(' + OB.cx + ' ' + OB.cy + ') rotate(' + spin.toFixed(2) + ') scale(' + sc.toFixed(4) + ')');
    let beat = 0;
    for (let i = 0; i < 3; i++) {
      draw(this.rings[i], eio(seg(t, OB.t0[i], OB.t0[i] + 1)));
      const th = 2 * Math.PI * (t - OB.t0[i]) / OB.per[i] - Math.PI / 2, ex = OB.a[i] * Math.cos(th) * sc, ey = OB.b[i] * Math.sin(th) * sc;
      const g = eob(seg(t, OB.t0[i] + 0.8, OB.t0[i] + 1.2), 1.8) * (0.82 + 0.18 * Math.sin(th));
      this.moons[i].setAttribute('transform', 'translate(' + (OB.cx + ex * c - ey * sn).toFixed(1) + ' ' + (OB.cy + ex * sn + ey * c).toFixed(1) + ') scale(' + g.toFixed(3) + ')');
      if (i === 0 && t > OB.t0[0] + 1.2) beat = Math.exp(-((t - OB.t0[0]) % OB.per[0]) / OB.per[0] * 9);
    }
    this.core.setAttribute('transform', 'translate(' + OB.cx + ' ' + OB.cy + ') scale(' + (eob(seg(t, 0.55, 0.95), 1.9) * (1 + 0.1 * beat)).toFixed(3) + ')');
  },
});

function wvY(x, t, lag, amp) {
  const env = eio(seg(t, 0.2, 1.6)) * (1 - 0.55 * eio(seg(t, 3.8, 5))), fall = Math.sin(Math.PI * clamp01(x / 1920));
  return 640 + amp * env * (0.35 + 0.65 * fall) * Math.sin(x * 0.0085 - (t - lag) * 4.2);
}
Film.scene('wave', {
  name: 'Flow', dur: 5,
  init(k) {
    k.stage.append(k.h('<div class="ground"><svg class="art" viewBox="0 0 1920 1080">' +
      '<polyline class="ln-thin wave-echo" style="opacity:.22" transform="translate(0 92)" points=""/><polyline class="ln-thin wave-echo" style="opacity:.45" transform="translate(0 46)" points=""/>' +
      '<polyline class="ln wave-main" points=""/>' + PEN + '</svg>' +
      '<div class="words" style="left:180px;top:150px;width:1500px"><h2 class="line big wave-head">Flow.</h2><p class="sub wave-sub">Every frame is a function of time.</p></div></div>'));
    const q = s => k.stage.querySelector(s);
    Object.assign(this, { main: q('.wave-main'), echo: [...k.stage.querySelectorAll('.wave-echo')], pen: q('.pen'), head: q('.wave-head'), sub: q('.wave-sub').style });
  },
  line(t, lag, amp) { const p = []; for (let i = 0; i <= 140; i++) { const x = -40 + 2000 * i / 140; p.push(x.toFixed(1) + ',' + wvY(x, t, lag, amp).toFixed(1)); } return p.join(' '); },
  render(t) {
    TextFx.fadeFromRight(this.head, t, 0.2); enterSub(this.sub, t, 0.9);
    this.main.setAttribute('points', this.line(t, 0, 150));
    this.echo[1].setAttribute('points', this.line(t, 0.12, 120));
    this.echo[0].setAttribute('points', this.line(t, 0.26, 92));
    const px = lerp(160, 1760, eio(seg(t, 0.4, 4.6)));
    placePen(this.pen, px, wvY(px, t, 0, 150), t, eo(seg(t, 0.2, 0.6)));
  },
});

const CB = { cx: 1300, cy: 540, s: 230, d: 1400, v: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]], seq: [0,1,2,3,0,4,5,1,5,6,2,6,7,3,7,4] };
function cbProj(t) {
  const ry = 0.55 + 0.32 * t + 1.1 * eio(seg(t, 2.7, 4.8)), rx = -0.42 + 0.08 * Math.sin(t * 1.3);
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), br = breathe(t, 0.015);
  return CB.v.map(([x, y, z]) => { const X = x * cy + z * sy; let Z = -x * sy + z * cy; const Y = y * cx - Z * sx; Z = y * sx + Z * cx; const kk = CB.d / (CB.d + Z * CB.s) * br; return [CB.cx + X * CB.s * kk, CB.cy + Y * CB.s * kk]; });
}
Film.scene('cube', {
  name: 'Depth', dur: 5,
  init(k) {
    k.stage.append(k.h('<div class="ground"><svg class="art" viewBox="0 0 1920 1080">' +
      '<ellipse class="shadow cube-shadow" cx="1300" cy="930" rx="300" ry="34"/><polygon class="fill-main cube-face" points="" style="opacity:0"/>' +
      '<polyline class="ln cube-path" points=""/>' + PEN + '</svg>' +
      '<div class="words" style="left:180px;top:200px;width:700px"><h2 class="line big cube-head">Depth.</h2><p class="sub cube-sub">Lines that turn in space.</p></div></div>'));
    const q = s => k.stage.querySelector(s);
    Object.assign(this, { path: q('.cube-path'), pen: q('.pen'), face: q('.cube-face'), shadow: q('.cube-shadow'), head: q('.cube-head'), sub: q('.cube-sub').style });
  },
  render(t) {
    TextFx.fadeFromRight(this.head, t, 0.2); enterSub(this.sub, t, 0.9);
    const P = cbProj(t), n = CB.seq.length - 1, f = eio(seg(t, 0.1, 2.9)) * n, whole = Math.floor(f), frac = f - whole, pts = [];
    for (let i = 0; i <= Math.min(whole, n); i++) pts.push(P[CB.seq[i]]);
    if (whole < n) { const a = P[CB.seq[whole]], b = P[CB.seq[whole + 1]]; pts.push([lerp(a[0], b[0], frac), lerp(a[1], b[1], frac)]); }
    this.path.setAttribute('points', pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    const tip = pts[pts.length - 1];
    placePen(this.pen, tip[0], tip[1], t, 1 - eo(seg(t, 2.9, 3.3)));
    this.face.setAttribute('points', [4, 5, 6, 7].map(i => P[i][0].toFixed(1) + ',' + P[i][1].toFixed(1)).join(' '));
    this.face.style.opacity = String(0.28 * eo(seg(t, 3.0, 3.6)));
    this.shadow.style.opacity = String(eo(seg(t, 0.4, 1.4)));
    this.path.style.strokeWidth = String(12 + 4 * Math.sin(Math.PI * Math.min(1, eob(seg(t, 2.9, 3.4), 1.7))));
  },
});

Film.scene('close', {
  name: 'One line', dur: 6,
  init(k) {
    k.stage.append(k.h('<div class="ground"><svg class="art" viewBox="0 0 1920 1080">' +
      '<path class="ln close-lead" d="M-20 700 C320 700 520 400 740 400"/>' +
      '<g class="close-g"><path class="ln close-ring" d="M740 400 A220 220 0 1 1 1180 400 A220 220 0 1 1 740 400"/></g>' +
      '<circle class="fill-accent close-dot" cx="960" cy="400" r="34"/>' + PEN +
      '<path class="ln-accent close-under" d="M760 742 C860 730 1060 730 1160 742"/></svg>' +
      '<div class="words close-words" style="left:0;top:520px;width:1920px;align-items:center;text-align:center">' +
      '<h2 class="line big close-head">One line.</h2><p class="sub close-sub" style="margin-top:44px">Endless motion, animated in code by Claude.</p></div></div>'));
    const q = s => k.stage.querySelector(s);
    Object.assign(this, { lead: q('.close-lead'), ring: q('.close-ring'), g: q('.close-g'), dot: q('.close-dot'), pen: q('.pen'), under: q('.close-under'), head: q('.close-head'), sub: q('.close-sub').style, words: q('.close-words').style });
    this.lpts = sample(this.lead, 120); this.rpts = sample(this.ring, 240);
  },
  render(t) {
    const pl = eio(seg(t, -0.1, 0.55)), pr = eio(seg(t, 0.5, 1.6));
    draw(this.lead, pl); draw(this.ring, pr);
    this.lead.style.opacity = String(1 - eo(seg(t, 1.2, 1.6)));
    const pos = t < 0.55 ? along(this.lpts, pl) : along(this.rpts, pr);
    placePen(this.pen, pos[0], pos[1], t, 1 - eo(seg(t, 1.6, 1.8)));
    const sc = (1 + Math.sin(Math.PI * seg(t, 1.6, 1.75)) * 0.05) * lerp(1, 34 / 220, ei(seg(t, 1.75, 2.2)));   // anticipation, then shrink
    this.g.setAttribute('transform', 'translate(960 400) scale(' + sc.toFixed(4) + ') translate(-960 -400)');
    this.g.style.opacity = String(1 - eo(seg(t, 2.1, 2.25)));
    const d = eob(seg(t, 2.15, 2.6), 1.9) * breathe(t, 0.03);
    this.dot.setAttribute('transform', 'translate(960 400) scale(' + d.toFixed(4) + ') translate(-960 -400)');
    TextFx.fadeFromRight(this.head, t, 2.3);
    this.sub.opacity = eo(seg(t, 2.9, 3.4)); this.sub.transform = 'translateY(' + lerp(18, 0, eo(seg(t, 2.9, 3.4))) + 'px)';
    draw(this.under, eo(seg(t, 3.0, 3.45)));
    this.words.transform = 'scale(' + (1 + 0.004 * Math.max(0, t - 2.3)).toFixed(4) + ')';
  },
});

Film.score(function (S, T) {
  const B = 60 / 96;
  S.tempo(96, { t0: T.bounce - 8 * B });              // bar lines land on each scene change
  S.program('pad', 'pad', { rev: 0.7 }); S.program('mallet', 'marimba', { pan: -0.2 });
  S.program('keys', 'ep', { rev: 0.3 }); S.program('bass', 'bass'); S.program('pluck', 'pluck', { pan: 0.25, rev: 0.4 });
  S.fx('sparkle', 0, { vel: 50 }); S.note('mallet', 'A5', { t: 0, dur: 1.5, vel: 46 });
  S.chord('pad', ['D3', 'A3'], { beat: 2, beats: 6, vel: 32 });
  S.fx('whoosh', T.spark + 0.7, { dur: 3.0, vel: 30 });
  S.chord('pad', ['B2', 'F#3', 'D4'], { beat: 8, beats: 8, vel: 34 });
  S.pattern('mallet', 'x.x.x.x.', { from: 8, repeat: 2, pitch: ['D5', 'F#5', 'A5', 'F#5'], vel: 44 });
  S.fx('boing', T.bounce + 1.3, { vel: 70 });
  [2.1, 2.7, 3.15, 3.45].forEach((h, i) => S.fx('pop', T.bounce + h, { vel: 58 - i * 10 }));
  const ch = [['D3', 'A3', 'C#4', 'F#4'], ['B2', 'F#3', 'A3', 'D4'], ['G2', 'D3', 'F#3', 'B3'], ['A2', 'E3', 'A3', 'C#4']], bs = ['D2', 'B1', 'G1', 'A1'];
  for (let i = 0; i < 6; i++) { const b = 16 + i * 4, k = i % 4; S.chord('keys', ch[k], { beat: b, beats: 3.5, vel: 50 }); S.note('bass', bs[k], { beat: b, beats: 1.5, vel: 76 }); S.note('bass', bs[k], { beat: b + 2.5, beats: 1, vel: 60 }); }
  S.drums({ kick: 'x...x...', sidestick: '..x...x.', hat: 'oxoxoxox' }, { from: 16, repeat: 6 });
  [1.5, 1.8, 2.1].forEach((d, i) => S.fx('pop', T.orbit + d, { vel: 50 + 4 * i, pitch: 2 * i }));
  S.pattern('pluck', 'x.xx.x.x', { from: 24, repeat: 4, pitch: ['F#5', 'A5', 'B5', 'D6', 'B5', 'A5'], vel: 50 });
  S.fx('whoosh', T.wave + 0.2, { dur: 1.4, vel: 34 });
  S.fx('sparkle', T.cube + 2.9, { vel: 60 });
  S.chord('pad', ['G2', 'D3', 'B3'], { beat: 40, beats: 4, vel: 36 });
  const HIT = T.close + 2.15;                          // the dot lands: the film's biggest hit
  S.run('mallet', ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'], { t: HIT - 0.6, step: 0.1, vel: 46, cresc: 8 });
  S.fx('revswell', HIT, { dur: 1.2 }); S.fx('pop', HIT, { vel: 72 });
  S.chord('keys', ['D3', 'A3', 'C#4', 'F#4', 'A4'], { t: HIT, dur: 3.6, vel: 66 });
  S.note('bass', 'D2', { t: HIT, dur: 3.2, vel: 82 }); S.drum('kick', { t: HIT, vel: 96 }); S.drum('crash', { t: HIT, vel: 50 });
  S.chord('pad', ['D3', 'A3', 'F#4'], { t: HIT, dur: 3.8, vel: 40 });
  S.fx('chime', T.close + 3.0, { vel: 40 });
  S.master({ gain: -6, fadeOut: 1.4 });
});

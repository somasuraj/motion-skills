/* motion-diagrams engine: core.
 * A diagram script calls Diagram.*; layouts.js turns the model into a scene (a flat list of drawing
 * items with theme tokens instead of colours); this file writes the scene as SVG per theme, checks it,
 * and packages the embed data for motion-slides / motion-videos. exports.js writes .drawio/.excalidraw.
 */
'use strict';
(function () {
  const MD = (window.MD = window.MD || {});

  // ---------------------------------------------------------------- model + API
  const fresh = () => ({
    config: { title: 'Diagram', kind: 'architecture', spacing: 'normal', iconSize: 56 },
    groups: [], nodes: [], edges: [], lanes: [], zones: [], tiers: [],
    participants: [], seq: [],
    tables: [], relations: [],
    tracks: [], bars: [], milestones: [], markers: [],
    mind: null,
  });
  let model = fresh();
  const has = (arr, id) => arr.some(x => x.id === id);
  const opt = o => (typeof o === 'string' ? { label: o } : o || {});

  const Diagram = {
    config(o) { Object.assign(model.config, o || {}); },
    group(id, o) { model.groups.push({ id, ...opt(o), seq: model.seq.length + model.groups.length + model.nodes.length }); },
    node(id, o) { model.nodes.push({ id, ...opt(o), seq: model.seq.length + model.groups.length + model.nodes.length }); },
    edge(from, to, o) { model.edges.push({ from, to, ...opt(o) }); },
    lane(id, o) { model.lanes.push({ id, ...opt(o) }); },
    // grid layout (AWS reference style): zones are rows (AZs), tiers are columns (subnet tiers)
    zone(id, o) { model.zones.push({ id, ...opt(o) }); },
    tier(id, o) { model.tiers.push({ id, ...opt(o) }); },
    // sequence
    participant(id, o) { model.participants.push({ id, ...opt(o) }); },
    message(from, to, label, o) { model.seq.push({ t: 'msg', from, to, label: label || '', ...(o || {}) }); },
    reply(from, to, label, o) { model.seq.push({ t: 'msg', from, to, label: label || '', reply: true, ...(o || {}) }); },
    note(over, text, o) { model.seq.push({ t: 'note', over: [].concat(over), text, ...(o || {}) }); },
    block(kind, label, fn) {
      model.seq.push({ t: 'open', kind, label: label || '' });
      fn && fn();
      model.seq.push({ t: 'close' });
    },
    else(label) { model.seq.push({ t: 'else', label: label || '' }); },
    // ER
    table(id, o) { model.tables.push({ id, ...opt(o) }); },
    relation(from, to, o) { model.relations.push({ from, to, ...(typeof o === 'string' ? { card: o } : o || {}) }); },
    // timeline
    track(id, o) { model.tracks.push({ id, ...opt(o) }); },
    bar(track, label, from, to, o) { model.bars.push({ track, label, from, to, ...(o || {}) }); },
    milestone(track, label, at, o) { model.milestones.push({ track, label, at, ...(o || {}) }); },
    marker(label, at, o) { model.markers.push({ label, at, ...(o || {}) }); },
    // mind map
    mindmap(tree) { model.mind = tree; },
  };
  MD.Diagram = Diagram;
  MD.model = () => model;
  MD.reset = () => { model = fresh(); };

  // ---------------------------------------------------------------- themes
  // Token values per theme. Categorical colours (cat0..7) feed mind maps, timelines, org charts.
  const THEMES = {
    light: {
      bg: '#FFFFFF', ink: '#16191F', dim: '#5B6675', edge: '#7D8998', line: '#D5DBE3', panel: '#F6F8FA',
      accent: '#0972D3', good: '#1A7F37', bad: '#C2362B', warn: '#96600F', data: '#3B48CC',
      note: '#FFF6D6', noteLine: '#D9B94A', tile: '#FFFFFF', tileLine: '#D5DBE3', onSolid: '#FFFFFF',
      cat: ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#DB2777', '#65A30D'],
      fillMix: 0.11, dark: false,
    },
    dark: {
      bg: '#0E1217', ink: '#E7EBF0', dim: '#9AA5B1', edge: '#7F8B99', line: '#2C343E', panel: '#151B22',
      accent: '#4DA3FF', good: '#4CC26D', bad: '#FF6B5E', warn: '#E6A23C', data: '#8D97FF',
      note: '#2A2614', noteLine: '#8A7630', tile: '#FFFFFF', tileLine: '#3A4450', onSolid: '#FFFFFF',
      cat: ['#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F87171', '#22D3EE', '#F472B6', '#A3E635'],
      fillMix: 0.17, dark: true,
    },
  };
  MD.THEMES = THEMES;

  const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * p + B[i] * (1 - p))); };
  const lum = h => { const c = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  MD.color = { mix, contrast, lum };

  // A colour value in the scene: '#RRGGBB' (same in every theme), {light, dark}, or a token:
  //   'ink' 'dim' 'accent' … · 'cat3' · 'accent.fill' / 'cat3.fill' / '#8C4FFF.fill' (tint on the ground) · 'none'
  function resolve(v, th) {
    if (v == null || v === 'none') return 'none';
    if (typeof v === 'object') return resolve(th.dark ? v.dark : v.light, th);
    if (v.endsWith('.fill')) return mix(resolve(v.slice(0, -5), th), th.bg, th.fillMix);
    if (v.endsWith('.soft')) return mix(resolve(v.slice(0, -5), th), th.bg, th.dark ? 0.32 : 0.22);
    if (v[0] === '#') return v.toUpperCase();
    const m = /^cat(\d+)$/.exec(v);
    if (m) return th.cat[+m[1] % th.cat.length];
    if (th[v] != null) return th[v];
    throw new Error('unknown colour token "' + v + '"');
  }
  MD.resolve = resolve;

  // Tones a node, edge or bar can take. Accepts a token, 'catN' or a hex colour.
  MD.tone = t => {
    t = t || 'neutral';
    if (t === 'neutral') return { stroke: 'ink', fill: 'panel', text: 'ink' };
    if (t === 'muted') return { stroke: 'line', fill: 'panel', text: 'dim' };
    return { stroke: t, fill: t + '.fill', text: 'ink' };
  };

  // ---------------------------------------------------------------- text
  const FONT = { sans: 'Inter', mono: 'JetBrains Mono' };
  MD.FONT_STACK = { sans: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif", mono: "'JetBrains Mono', Consolas, 'Courier New', monospace" };
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (s, size, weight = 400, mono = false) => {
    ctx.font = `${weight} ${size}px "${mono ? FONT.mono : FONT.sans}"`;
    return ctx.measureText(s).width;
  };
  // Wrap to maxW (words; a single long word is kept whole). Returns {lines, w, h, size, weight, lh}.
  function block(text, size = 14, weight = 400, maxW = 1e9, o = {}) {
    const lh = Math.round(size * (o.lh || 1.32));
    const lines = [];
    String(text == null ? '' : text).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      let cur = words[0];
      for (const w of words.slice(1)) {
        if (width(cur + ' ' + w, size, weight, o.mono) <= maxW) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
      }
      lines.push(cur);
    });
    const w = Math.ceil(Math.max(0, ...lines.map(l => width(l, size, weight, o.mono))));
    return { lines, w, h: lines.length * lh, size, weight, lh, mono: !!o.mono };
  }
  MD.text = { width, block };

  // ---------------------------------------------------------------- icons
  // build.py exposes window.mdIcon(id) -> {light, dark, kind} (data URIs) or {error}.
  // kinds: tile (AWS service: brings its own tile) · plain (draw as is) · logo / mono (brand: white tile)
  //        glyph (Lucide: white glyph on a tone-coloured tile)
  const iconCache = {};
  MD.loadIcon = async id => {
    if (iconCache[id]) return iconCache[id];
    const r = window.mdIcon ? await window.mdIcon(id) : { error: 'no icon loader' };
    if (r.error) throw new Error(r.error);
    return (iconCache[id] = r);
  };
  const b64 = s => btoa(unescape(encodeURIComponent(s)));
  const svgUri = s => 'data:image/svg+xml;base64,' + b64(s);
  // The final image for one icon in one theme (tiles composed into one SVG so every writer agrees).
  MD.iconHref = (id, th, toneColor) => {
    const r = iconCache[id];
    if (!r) throw new Error('icon not loaded: ' + id);
    const src = (th.dark && r.dark) || r.light;
    if (r.kind === 'logo' || r.kind === 'mono') {
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64">` +
        `<rect x="1" y="1" width="62" height="62" rx="13" fill="${th.tile}" stroke="${th.tileLine}" stroke-width="1.5"/>` +
        `<image href="${src}" xlink:href="${src}" x="11" y="11" width="42" height="42" preserveAspectRatio="xMidYMid meet"/></svg>`);
    }
    if (r.kind === 'glyph') {
      const raw = decodeURIComponent(escape(atob(src.split(',')[1]))).replace(/currentColor/g, '#FFFFFF');
      const inner = svgUri(raw);
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64">` +
        `<rect width="64" height="64" rx="13" fill="${toneColor || '#5B6675'}"/>` +
        `<image href="${inner}" xlink:href="${inner}" x="16" y="16" width="32" height="32"/></svg>`);
    }
    return src;
  };
  MD.iconKind = id => (iconCache[id] || {}).kind;

  // ---------------------------------------------------------------- SVG writer
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  MD.esc = esc;
  const f1 = n => Math.round(n * 10) / 10;

  // Rounded orthogonal polyline (radius r at each bend).
  function polyPath(pts, r = 8) {
    if (pts.length < 2) return '';
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i], [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1];
      const l1 = Math.hypot(px - ax, py - ay), l2 = Math.hypot(bx - px, by - py);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      if (rr < 0.5) { d += ` L${f1(px)} ${f1(py)}`; continue; }
      const ux = (px - ax) / l1, uy = (py - ay) / l1, vx = (bx - px) / l2, vy = (by - py) / l2;
      d += ` L${f1(px - ux * rr)} ${f1(py - uy * rr)} Q${f1(px)} ${f1(py)} ${f1(px + vx * rr)} ${f1(py + vy * rr)}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${f1(l[0])} ${f1(l[1])}`;
  }
  MD.polyPath = polyPath;

  // Arrowhead polygon at the end of pts (tip on the last point).
  function arrowHead(pts, size = 9) {
    const [x, y] = pts[pts.length - 1];
    let k = pts.length - 2, [px, py] = pts[k];
    while (k > 0 && Math.hypot(x - px, y - py) < 1) [px, py] = pts[--k];
    const L = Math.hypot(x - px, y - py) || 1, ux = (x - px) / L, uy = (y - py) / L;
    const bx = x - ux * size, by = y - uy * size, w = size * 0.42;
    return [[x, y], [bx - uy * w, by + ux * w], [bx + uy * w, by - ux * w]];
  }
  MD.arrowHead = arrowHead;
  // Pull the line's end back so it doesn't show through the arrowhead's tip.
  const trimEnd = (pts, d) => {
    const p = pts.map(q => q.slice());
    const n = p.length - 1, [x, y] = p[n], [px, py] = p[n - 1];
    const L = Math.hypot(x - px, y - py);
    if (L > d + 1) { p[n] = [x - (x - px) / L * d, y - (y - py) / L * d]; }
    return p;
  };

  function itemSVG(it, th) {
    const C = v => resolve(v, th);
    const sw = it.sw == null ? 1.5 : it.sw;
    const stroke = it.stroke ? ` stroke="${C(it.stroke)}" stroke-width="${sw}"` + (it.dash ? ` stroke-dasharray="${it.dash === true ? '6 5' : it.dash}"` : '') : '';
    const fill = ` fill="${it.fill ? C(it.fill) : 'none'}"`;
    switch (it.t) {
      case 'rect':
        return `<rect x="${f1(it.x)}" y="${f1(it.y)}" width="${f1(it.w)}" height="${f1(it.h)}" rx="${it.r || 0}"${fill}${stroke}/>`;
      case 'ellipse':
        return `<ellipse cx="${f1(it.cx)}" cy="${f1(it.cy)}" rx="${f1(it.rx)}" ry="${f1(it.ry)}"${fill}${stroke}/>`;
      case 'poly':
        return `<polygon points="${it.pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}"${fill}${stroke} stroke-linejoin="round"/>`;
      case 'path':
        return `<path d="${it.d}"${fill}${stroke} stroke-linejoin="round"/>`;
      case 'line': {
        const col = C(it.stroke || 'edge');
        let pts = it.pts, out = '';
        const head = it.end === 'arrow', tail = it.start === 'arrow';
        if (head) pts = trimEnd(pts, 6);
        if (tail) pts = trimEnd(pts.slice().reverse(), 6).reverse();
        const d = it.curve ? it.d : polyPath(pts, it.r == null ? 8 : it.r);
        out += `<path class="md-line" d="${d}" fill="none" stroke="${col}" stroke-width="${sw}"` +
          (it.dash ? ` stroke-dasharray="${it.dash === true ? '6 5' : it.dash}"` : '') + ` stroke-linecap="round" stroke-linejoin="round"/>`;
        if (head) out += `<polygon class="md-head" points="${arrowHead(it.pts).map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${col}"/>`;
        if (tail) out += `<polygon class="md-head" points="${arrowHead(it.pts.slice().reverse()).map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${col}"/>`;
        return out;
      }
      case 'text': {
        const anchor = it.anchor || 'start';
        const family = it.mono ? MD.FONT_STACK.mono : MD.FONT_STACK.sans;
        const tspans = it.lines.map((l, i) => {
          const by = it.y + i * it.lh + it.lh / 2 + it.size * 0.36;
          return `<tspan x="${f1(it.x)}" y="${f1(by)}">${esc(l)}</tspan>`;
        }).join('');
        return `<text font-family="${esc(family)}" font-size="${it.size}" font-weight="${it.weight || 400}" fill="${C(it.color || 'ink')}" text-anchor="${anchor}"` +
          (it.italic ? ' font-style="italic"' : '') + `>${tspans}</text>`;
      }
      case 'image': {
        const href = MD.iconHref(it.icon, th, it.tone ? C(it.tone) : null);
        return `<image href="${href}" x="${f1(it.x)}" y="${f1(it.y)}" width="${f1(it.w)}" height="${f1(it.h)}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }
    return '';
  }

  // fontCSS: @font-face rules (data URIs) supplied by build.py; omitted for embeds (added once by mount).
  MD.toSVG = (scene, themeName, fontCSS = '') => {
    const th = THEMES[themeName];
    const W = Math.ceil(scene.w), H = Math.ceil(scene.h);
    let body = '', cur = null;
    for (const it of scene.items) {
      const part = it.part || null;
      if (part !== cur) { if (cur) body += '</g>'; if (part) body += `<g data-part="${esc(part)}">`; cur = part; }
      body += itemSVG(it, th);
    }
    if (cur) body += '</g>';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-theme="${themeName}">` +
      `<title>${esc(scene.title || '')}</title>` + (fontCSS ? `<style>${fontCSS}</style>` : '') +
      `<rect class="md-bg" width="${W}" height="${H}" fill="${th.bg}"/>${body}</svg>`;
  };

  // ---------------------------------------------------------------- verify (the review round)
  // Every issue has a kind, a level, where it is (x, y) and what to do about it. Errors fail the build;
  // warnings are layout quality problems a reader would notice (crossings, detours, lines on lines).
  const FIX = {
    overlap: "Give the layout more room (spacing: 'roomy'), or move one of the two into another group or cell.",
    overflow: 'Shorten the label, or widen the shape (minWidth / maxWidth on the node).',
    'text-collision': 'Shorten one of the two texts or add room (spacing: \'roomy\'); an edge label can often be dropped.',
    canvas: 'Something is drawn outside the canvas: rebuild; if it persists, report it as an engine bug.',
    contrast: "Use the ink or dim token for this text, or a darker tone for the fill it sits on.",
    'edge-node': "Declare connected nodes next to each other, pin a node with layer: 'first' | 'last', or, for a link that runs against the flow, swap from/to and set arrow: 'start'.",
    'edge-text': 'Same as an edge through a node; or shorten the label it runs through.',
    crossing: "Declare targets in the order their lines leave the source (top to bottom), merge parallel links into one edge to their group, or run build.py --fix.",
    detour: "This link runs against the layout's flow: swap from/to and set arrow: 'start', or link to the group instead of a node inside it.",
    bends: 'Too many turns: same remedies as a detour; in a grid layout set sides: [\'E\', \'W\'] on the edge.',
    stacked: 'Two lines run on top of each other: merge them into one edge (to a group), or route one from another side.',
    corner: 'A line ends on a corner, so it looks unattached: an engine port problem; report it, or link to another node.',
  };
  MD.verify = scene => {
    const issues = [];
    const add = (level, kind, msg, at) => issues.push({ level, kind, msg, x: Math.round(at[0]), y: Math.round(at[1]), fix: FIX[kind] || '' });
    const nodes = scene.items.filter(i => i.role === 'node');
    const texts = scene.items.filter(i => i.t === 'text' && !i.noCheck);
    const lines = scene.items.filter(i => i.t === 'line' && (i.role === 'edge' || i.role === 'msg'));
    const boxOf = i => i.t === 'text'
      ? { x: i.anchor === 'middle' ? i.x - i.w / 2 : i.anchor === 'end' ? i.x - i.w : i.x, y: i.y, w: i.w, h: i.lines.length * i.lh }
      : i.t === 'ellipse' ? { x: i.cx - i.rx, y: i.cy - i.ry, w: 2 * i.rx, h: 2 * i.ry }
      : i.t === 'poly' ? (() => { const xs = i.pts.map(p => p[0]), ys = i.pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; })()
      : { x: i.x, y: i.y, w: i.w, h: i.h };
    const mid = b => [b.x + b.w / 2, b.y + b.h / 2];
    const ov = (a, b, pad = 0) => a.x + pad < b.x + b.w && b.x + pad < a.x + a.w && a.y + pad < b.y + b.h && b.y + pad < a.y + a.h;
    const inside = (a, b, tol = 1) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;
    const name = i => (i.t === 'text' ? '"' + i.lines[0] + '"'
      : i.uid && i.uid.startsWith('l:') ? 'the label on ' + (i.part || '').replace(/^(edge|msg|rel):/, '').replace('>', ' → ')
      : (i.uid || i.part || i.t).replace(/^[a-z]:/, ''));
    const lineName = l => (l.part || '').replace(/^(edge|msg|rel):/, '').replace('>', ' → ');
    // 1. solid things overlapping
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const ui = nodes[i].uid || '', uj = nodes[j].uid || '';
      if (ui && (ui === uj || ui.startsWith(uj + ':') || uj.startsWith(ui + ':'))) continue; // parts of one shape
      const a = boxOf(nodes[i]), b = boxOf(nodes[j]);
      if (ov(a, b, 1)) add('error', 'overlap', `${name(nodes[i])} overlaps ${name(nodes[j])}`, mid(a));
    }
    // 2. text overflowing the box it belongs to, and text over text
    const byUid = {};
    scene.items.forEach(i => { if (i.uid && !byUid[i.uid]) byUid[i.uid] = i; });
    for (const t of texts) if (t.fit && byUid[t.fit] && !inside(boxOf(t), boxOf(byUid[t.fit]), 2)) add('error', 'overflow', `text overflows its shape: "${t.lines.join(' ')}"`, mid(boxOf(t)));
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = boxOf(texts[i]), b = boxOf(texts[j]);
      if (ov(a, b, 1)) add('error', 'text-collision', `"${texts[i].lines[0]}" collides with "${texts[j].lines[0]}"`, mid(a));
    }
    // 2b. an edge's label pill sitting on someone else's text
    for (const pill of nodes.filter(n => (n.uid || '').startsWith('l:'))) for (const t of texts) {
      if (t.part === pill.part) continue;
      const a = boxOf(pill), b = boxOf(t);
      if (ov(a, b, 1)) add('error', 'text-collision', `${name(pill)} covers "${t.lines[0]}"`, mid(a));
    }
    // 3. edges through things they don't connect
    const segs = l => (l.curve ? [] : l.pts.slice(0, -1).map((p, k) => [p, l.pts[k + 1]]));
    const segHits = ([a, b], r) => {
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      return x1 < r.x + r.w - 2 && x2 > r.x + 2 && y1 < r.y + r.h - 2 && y2 > r.y + 2;
    };
    for (const l of lines) {
      for (const n of nodes) {
        if (n.uid === l.from || n.uid === l.to || n.edgeOk) continue;
        const r = boxOf(n), s = segs(l).find(sg => segHits(sg, r));
        if (s) add('warn', 'edge-node', `line ${lineName(l)} passes through ${name(n)}`, mid(r));
      }
      for (const t of texts) {
        if (t.part === l.part || t.edgeOk) continue;
        const r = boxOf(t), s = segs(l).find(sg => segHits(sg, r));
        if (s) add('warn', 'edge-text', `line ${lineName(l)} runs through ${name(t)}`, mid(r));
      }
    }
    // 3b. a line that meets its node on a corner (it reads as unattached)
    for (const l of lines) for (const [end, uid] of [[l.pts[l.pts.length - 1], l.to], [l.pts[0], l.from]]) {
      const n = uid && byUid[uid];
      if (!n || l.curve || !['rect', 'path'].includes(n.t) || n.role === 'group') continue;
      const b = boxOf(n);
      const nearX = Math.min(Math.abs(end[0] - b.x), Math.abs(end[0] - b.x - b.w)) < 6, nearY = Math.min(Math.abs(end[1] - b.y), Math.abs(end[1] - b.y - b.h)) < 6;
      if (nearX && nearY) add('warn', 'corner', `line ${lineName(l)} meets ${name(n)} at its corner`, end);
    }
    // 4. layout quality: crossings, lines on lines, detours, bends
    const H = ([a, b]) => Math.abs(a[1] - b[1]) < 0.5, V = ([a, b]) => Math.abs(a[0] - b[0]) < 0.5;
    // lines that merge into (or fan out of) the same node may share a stretch; an incoming and an outgoing line may not
    const shareEnd = (p, q) => (p.from && p.from === q.from) || (p.to && p.to === q.to);
    let crossings = 0;
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const p = lines[i], q = lines[j];
      let hit = null, stacked = null;
      for (const s of segs(p)) for (const t of segs(q)) {
        const [h, v] = H(s) && V(t) ? [s, t] : V(s) && H(t) ? [t, s] : [null, null];
        if (h) {
          const y = h[0][1], x = v[0][0];
          if (x > Math.min(h[0][0], h[1][0]) + 3 && x < Math.max(h[0][0], h[1][0]) - 3 && y > Math.min(v[0][1], v[1][1]) + 3 && y < Math.max(v[0][1], v[1][1]) - 3) hit = hit || [x, y];
        }
        if (!shareEnd(p, q)) {
          const along = (a, b, c, d) => Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d));
          if (H(s) && H(t) && Math.abs(s[0][1] - t[0][1]) < 3 && along(s[0][0], s[1][0], t[0][0], t[1][0]) > 24) stacked = stacked || [(Math.max(Math.min(s[0][0], s[1][0]), Math.min(t[0][0], t[1][0])) + 12), s[0][1]];
          if (V(s) && V(t) && Math.abs(s[0][0] - t[0][0]) < 3 && along(s[0][1], s[1][1], t[0][1], t[1][1]) > 24) stacked = stacked || [s[0][0], Math.max(Math.min(s[0][1], s[1][1]), Math.min(t[0][1], t[1][1])) + 12];
        }
      }
      if (hit) { crossings++; add('warn', 'crossing', `lines ${lineName(p)} and ${lineName(q)} cross`, hit); }
      if (stacked) add('warn', 'stacked', `lines ${lineName(p)} and ${lineName(q)} run on top of each other`, stacked);
    }
    let detours = 0;
    for (const l of lines) {
      if (l.curve || l.pts.length < 2) continue;
      const len = segs(l).reduce((s, [a, b]) => s + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 0);
      const [a, z] = [l.pts[0], l.pts[l.pts.length - 1]];
      const direct = Math.abs(a[0] - z[0]) + Math.abs(a[1] - z[1]);
      const longest = segs(l).sort((u, v) => (Math.abs(v[0][0] - v[1][0]) + Math.abs(v[0][1] - v[1][1])) - (Math.abs(u[0][0] - u[1][0]) + Math.abs(u[0][1] - u[1][1])))[0];
      const at = longest ? [(longest[0][0] + longest[1][0]) / 2, (longest[0][1] + longest[1][1]) / 2] : a;
      if (len > 1.8 * direct + 140) { detours++; add('warn', 'detour', `line ${lineName(l)} takes a long detour (${Math.round(len)} px for ${Math.round(direct)} px)`, at); }
      else if (l.pts.length - 2 > 4) add('warn', 'bends', `line ${lineName(l)} turns ${l.pts.length - 2} times`, at);
    }
    // 5. contrast of every text against what it sits on, in both themes
    for (const tn of ['light', 'dark']) {
      const th = THEMES[tn];
      for (const t of texts) {
        const bg = t.on ? resolve(t.on, th) : th.bg;
        const fg = resolve(t.color || 'ink', th);
        const need = t.size >= 18 || (t.weight >= 700 && t.size >= 14) ? 3 : 4.5;
        const c = contrast(fg, bg);
        if (c < need - 0.05) add(c < 3 ? 'error' : 'warn', 'contrast', `${tn} theme: contrast ${c.toFixed(2)}:1 for "${t.lines[0]}"`, mid(boxOf(t)));
      }
    }
    // 6. inside the canvas
    for (const i of scene.items) {
      if (i.t === 'line' || i.t === 'path') continue;
      const b = boxOf(i);
      if (b.x < -1 || b.y < -1 || b.x + b.w > scene.w + 1 || b.y + b.h > scene.h + 1) add('error', 'canvas', `outside the canvas: ${name(i)}`, [Math.max(10, Math.min(scene.w - 10, b.x)), Math.max(10, Math.min(scene.h - 10, b.y))]);
    }
    // de-duplicate (same kind and message)
    const seen = new Set();
    const list = issues.filter(i => { const k = i.kind + '|' + i.msg; if (seen.has(k)) return false; seen.add(k); return true; });
    list.forEach((i, k) => (i.n = k + 1));
    return {
      issues: list,
      errors: list.filter(i => i.level === 'error').map(i => i.msg),
      warnings: list.filter(i => i.level === 'warn').map(i => i.msg),
      metrics: { crossings, detours, edges: lines.length },
    };
  };
  // Lower is better: what --fix compares between layout variants.
  MD.score = r => r.errors.length * 1000 + r.issues.filter(i => i.level === 'warn').reduce((s, i) => s + ({ crossing: 4, detour: 8, stacked: 6, bends: 3, 'edge-node': 12, 'edge-text': 6, contrast: 2 }[i.kind] || 5), 0);

  // The review image: the light SVG with a numbered marker on every issue (numbers match the report).
  MD.reviewSVG = (svg, report) => {
    const marks = report.issues.map(i => {
      const col = i.level === 'error' ? '#D92D20' : '#E8590C';
      return `<g><circle cx="${i.x}" cy="${i.y}" r="22" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="5 3"/>` +
        `<circle cx="${i.x + 18}" cy="${i.y - 18}" r="12" fill="${col}" stroke="#FFFFFF" stroke-width="2"/>` +
        `<text x="${i.x + 18}" y="${i.y - 14}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">${i.n}</text></g>`;
    }).join('');
    return svg.replace(/<\/svg>\s*$/, `<g class="md-review">${marks}</g></svg>`);
  };

  // ---------------------------------------------------------------- title block, legend, aspect
  const shiftItem = (i, dx, dy) => {
    if (i.pts) i.pts = i.pts.map(p => [p[0] + dx, p[1] + dy]);
    if (i.d) i.d = MD.shiftPath(i.d, dx, dy);
    if (i.cx != null) { i.cx += dx; i.cy += dy; }
    if (i.x != null) i.x += dx;
    if (i.y != null) i.y += dy;
  };
  MD.shiftItem = shiftItem;
  const ASPECTS = { slides: 16 / 9, '16:9': 16 / 9, wiki: 4 / 3, '4:3': 4 / 3, square: 1, poster: Math.SQRT2, a3: Math.SQRT2 };
  const LEGEND = { solid: 'request / data flow', dashed: 'async · control · provisioning', dotted: 'association', badge: 'pipeline step' };

  MD.decorate = (scene, cfg) => {
    const items = scene.items;
    const header = cfg.header !== false;
    const lines = items.filter(i => i.t === 'line' && (i.role === 'edge' || i.role === 'msg'));
    const used = new Set(lines.map(l => (!l.dash ? 'solid' : l.dash === '2 4' ? 'dotted' : 'dashed')));
    const words = Object.assign({}, LEGEND, cfg.legend && typeof cfg.legend === 'object' && !Array.isArray(cfg.legend) ? cfg.legend : {});
    let entries = ['solid', 'dashed', 'dotted'].filter(s => used.has(s)).map(s => ({ style: s, label: words[s] }));
    if (items.some(i => i.badge)) entries.push({ style: 'badge', label: words.badge });
    if (Array.isArray(cfg.legend)) entries = cfg.legend;
    else if (cfg.legend === false || (cfg.legend !== true && entries.length < 2)) entries = [];
    const ratio = typeof cfg.aspect === 'number' ? cfg.aspect : ASPECTS[cfg.aspect];
    if (!header && !entries.length && !ratio) return scene;

    let W = scene.w, H = scene.h;
    const add = [];
    // header: title (and subtitle) top-left; legend on the right of the same band, or under it when tight
    const tb = block(cfg.title || '', 22, 700, 1400), sb = cfg.subtitle ? block(cfg.subtitle, 13.5, 400, 1400) : null;
    const leg = entries.map(e => Object.assign(e, { tb: block(e.label, 12, 500, 300) }));
    const legW = leg.reduce((s, e) => s + 34 + 8 + e.tb.w + 22, 0) - 22;
    const titleW = Math.max(tb.w, sb ? sb.w : 0);
    const legBelow = header && entries.length && titleW + 60 + legW > W - 56;
    const headH = (header ? 26 + tb.h + (sb ? sb.h + 2 : 0) : 8) + (legBelow ? 30 : 0) + (header || entries.length ? 14 : 0);
    items.forEach(i => shiftItem(i, 0, headH));
    H += headH;
    W = Math.max(W, (header ? titleW : 0) + 56, legW + 56);
    if (header) {
      add.push({ t: 'text', x: 28, y: 22, lines: tb.lines, w: tb.w, size: 22, weight: 700, lh: tb.lh, color: 'ink', part: 'header' });
      if (sb) add.push({ t: 'text', x: 28, y: 22 + tb.h + 2, lines: sb.lines, w: sb.w, size: 13.5, weight: 400, lh: sb.lh, color: 'dim', part: 'header' });
    }
    const drawLegend = (x, y) => {
      for (const e of leg) {
        if (e.style === 'badge') {
          add.push({ t: 'ellipse', cx: x + 17, cy: y + 9, rx: 9, ry: 9, fill: 'accent', part: 'legend' });
          const nb = block('1', 10.5, 700);
          add.push({ t: 'text', x: x + 17, y: y + 9 - nb.lh / 2, lines: nb.lines, w: nb.w, size: 10.5, weight: 700, lh: nb.lh, color: 'onSolid', anchor: 'middle', part: 'legend', noCheck: true });
        } else add.push({ t: 'line', pts: [[x, y + 9], [x + 34, y + 9]], stroke: 'edge', sw: 1.8, r: 0, dash: e.style === 'dashed' ? true : e.style === 'dotted' ? '2 4' : null, end: 'arrow', part: 'legend' });
        add.push({ t: 'text', x: x + 42, y: y + 9 - e.tb.lh / 2, lines: e.tb.lines, w: e.tb.w, size: 12, weight: 500, lh: e.tb.lh, color: 'dim', part: 'legend' });
        x += 34 + 8 + e.tb.w + 22;
      }
    };
    // aspect: grow the canvas to the target shape and centre the drawing in it (the header stays put)
    if (ratio) {
      if (W / H > ratio) { const H2 = W / ratio, dy = (H2 - H) / 2; items.forEach(i => shiftItem(i, 0, dy)); H = H2; }
      else { const W2 = H * ratio, dx = (W2 - W) / 2; items.forEach(i => shiftItem(i, dx, 0)); W = W2; }
    }
    if (leg.length) {
      if (legBelow || !header) drawLegend(28, header ? 22 + tb.h + (sb ? sb.h + 2 : 0) + 12 : 12);
      else drawLegend(W - 28 - legW, 26);
    }
    scene.items = [...add, ...items];
    scene.w = W; scene.h = H;
    return scene;
  };

  // ---------------------------------------------------------------- run
  MD.load = src => {
    MD.reset();
    // eslint-disable-next-line no-new-func
    new Function('Diagram', src)(Diagram);
    return model.config;
  };

  MD.build = async (opts = {}) => {
    await document.fonts.ready;
    if (opts.override) Object.assign(model.config, opts.override);
    const scene = MD.decorate(await MD.layout(model), model.config);
    const themes = opts.themes || ['light', 'dark'];
    const out = { title: model.config.title, kind: model.config.kind, w: Math.ceil(scene.w), h: Math.ceil(scene.h), svg: {}, report: MD.verify(scene) };
    for (const t of themes) out.svg[t] = MD.toSVG(scene, t, opts.fontCSS || '');
    if (opts.drawio) out.drawio = MD.toDrawio(scene);
    if (opts.excalidraw) out.excalidraw = MD.toExcalidraw(scene);
    if (opts.embed) {
      out.embed = { title: scene.title, kind: model.config.kind, w: out.w, h: out.h, svg: {}, parts: [] };
      for (const t of themes) out.embed.svg[t] = MD.toSVG(scene, t, '');
      const seen = new Set();
      scene.items.forEach(i => { if (i.part && !seen.has(i.part)) { seen.add(i.part); out.embed.parts.push(i.part); } });
    }
    return out;
  };
})();

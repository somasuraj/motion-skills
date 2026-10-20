/* motion-diagrams engine: layouts other than the ELK graph (sequence, er, swimlane, mindmap, timeline)
 * and the dispatcher. Each returns a scene {w, h, title, items}.
 */
'use strict';
(function () {
  const MD = window.MD;
  const T = (...a) => MD.text.block(...a);
  const txt = (o, b) => Object.assign({ t: 'text', lines: b.lines, w: b.w, size: b.size, weight: b.weight, lh: b.lh, mono: b.mono }, o);

  MD.layout = async (m) => {
    const k = m.config.kind;
    if (k === 'architecture' && m.config.layout === 'grid') return MD.layoutGrid(m);
    if (['architecture', 'flowchart', 'state', 'c4', 'org'].includes(k)) return MD.layoutGraph(m);
    if (k === 'sequence') return sequence(m);
    if (k === 'er') return er(m);
    if (k === 'swimlane') return swimlane(m);
    if (k === 'mindmap') return mindmap(m);
    if (k === 'timeline') return timeline(m);
    throw new Error(`unknown kind "${k}". Kinds: architecture, flowchart, swimlane, sequence, state, er, c4, mindmap, timeline, org`);
  };

  // Shift every item so the drawing starts at (pad, pad); returns the scene size.
  function frame(items, pad = 28) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, w = 0, h = 0) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
    for (const i of items) {
      if (i.t === 'line') i.pts.forEach(p => grow(p[0], p[1]));
      else if (i.t === 'ellipse') grow(i.cx - i.rx, i.cy - i.ry, 2 * i.rx, 2 * i.ry);
      else if (i.t === 'poly') i.pts.forEach(p => grow(p[0], p[1]));
      else if (i.t === 'text') grow(i.anchor === 'middle' ? i.x - i.w / 2 : i.anchor === 'end' ? i.x - i.w : i.x, i.y, i.w, i.lines.length * i.lh);
      else if (i.x != null) grow(i.x, i.y, i.w || 0, i.h || 0);
    }
    const dx = pad - x0, dy = pad - y0;
    for (const i of items) {
      if (i.t === 'line') { i.pts = i.pts.map(p => [p[0] + dx, p[1] + dy]); if (i.d) i.d = shiftPath(i.d, dx, dy); }
      else if (i.t === 'ellipse') { i.cx += dx; i.cy += dy; }
      else if (i.t === 'poly') i.pts = i.pts.map(p => [p[0] + dx, p[1] + dy]);
      else { if (i.x != null) i.x += dx; if (i.y != null) i.y += dy; if (i.d) i.d = shiftPath(i.d, dx, dy); }
    }
    return { w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }
  // Absolute commands only (M L Q C H V Z) are shifted; relative ones need no change.
  function shiftPath(d, dx, dy) {
    return d.replace(/([MLQCHVTSA])([^MLQCHVTSAZmlqchvtsaz]*)/g, (all, c, args) => {
      const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (c === 'H') return 'H' + n.map(v => v + dx).join(' ');
      if (c === 'V') return 'V' + n.map(v => v + dy).join(' ');
      if (c === 'A') return all;
      return c + n.map((v, i) => (i % 2 ? v + dy : v + dx)).join(' ');
    });
  }
  MD.shiftPath = shiftPath;

  // ================================================================ sequence
  async function sequence(m) {
    const cfg = m.config, P = m.participants;
    if (!P.length) throw new Error('sequence: add participants with Diagram.participant(id, {label})');
    const pid = {};
    P.forEach((p, i) => { if (pid[p.id] != null) throw new Error('duplicate participant ' + p.id); pid[p.id] = i; });
    for (const s of m.seq) {
      if (s.t === 'msg') for (const e of [s.from, s.to]) if (pid[e] == null) throw new Error(`message "${s.label}": no participant "${e}"`);
      if (s.t === 'note') for (const e of s.over) if (pid[e] == null) throw new Error(`note: no participant "${e}"`);
    }
    for (const p of P) if (p.icon) await MD.loadIcon(p.icon);
    const numbered = cfg.numbered !== false;
    const heads = P.map(p => {
      const lb = T(p.label || p.id, 14, 600, 170);
      const sub = p.sub ? Object.assign(T(p.sub, 12, 400, 170), { color: 'dim' }) : null;
      const ic = p.icon ? 36 : 0;
      const w = Math.max(136, Math.max(lb.w, sub ? sub.w : 0) + 32);
      const h = (ic ? ic + 8 : 0) + lb.h + (sub ? sub.h + 2 : 0) + 22;
      return { lb, sub, ic, w, h };
    });
    const headH = Math.max(...heads.map(h => h.h));
    // horizontal positions from the labels that must fit between lifelines
    const xs = [0];
    for (let i = 1; i < P.length; i++) xs[i] = xs[i - 1] + (heads[i - 1].w + heads[i].w) / 2 + 48;
    const msgs = m.seq.filter(s => s.t === 'msg').map(s => ({ s, a: pid[s.from], b: pid[s.to], lb: T(s.label, 13, 400, 300) }));
    for (let pass = 0; pass < 3; pass++) {
      for (const g of [...msgs].sort((u, v) => Math.abs(u.a - u.b) - Math.abs(v.a - v.b))) {
        let lo = Math.min(g.a, g.b), hi = Math.max(g.a, g.b);
        let need = g.lb.w + (numbered ? 60 : 36);
        if (lo === hi) { if (hi === P.length - 1) continue; hi = lo + 1; need = g.lb.w + 70; }
        const have = xs[hi] - xs[lo];
        if (have < need) { const add = (need - have) / (hi - lo); for (let i = lo + 1; i < P.length; i++) xs[i] += add * Math.min(i - lo, hi - lo); }
      }
    }
    const items = [];
    const top = 0;
    const lifeTop = top + headH;
    // vertical pass
    let y = lifeTop + 30;
    const act = P.map(() => []); // open activations: start y
    const acts = [];
    const depth = i => act[i].length;
    const blocks = [];
    const openB = [];
    let n = 0;
    const edgeX = (i, side) => xs[i] + side * (depth(i) ? 6 + (depth(i) - 1) * 5 : 0);
    for (const s of m.seq) {
      if (s.t === 'open') { const b = { kind: s.kind, label: s.label, y0: y, parts: [], elses: [], lo: Infinity, hi: -Infinity, id: blocks.length }; blocks.push(b); openB.push(b); y += 34; continue; }
      if (s.t === 'else') { const b = openB[openB.length - 1]; if (b) { b.elses.push({ y: y + 4, label: s.label }); y += 30; } continue; }
      if (s.t === 'close') { const b = openB.pop(); if (b) { b.y1 = y + 4; y += 18; } continue; }
      const touch = (i) => openB.forEach(b => { b.lo = Math.min(b.lo, i); b.hi = Math.max(b.hi, i); });
      if (s.t === 'note') {
        const idx = s.over.map(o => pid[o]);
        const lo = Math.min(...idx), hi = Math.max(...idx);
        const nb = T(s.text, 12.5, 400, lo === hi ? 200 : Math.max(200, xs[hi] - xs[lo] + 80));
        const w = lo === hi ? nb.w + 24 : Math.max(nb.w + 24, xs[hi] - xs[lo] + 90);
        const x = (xs[lo] + xs[hi]) / 2 - w / 2, h = nb.h + 16;
        const part = 'note:' + (++n);
        items.push({ t: 'rect', x, y, w, h, r: 4, fill: 'note', stroke: 'noteLine', sw: 1.2, part, role: 'node', uid: part, edgeOk: true, sem: { kind: 'node', id: part, shape: 'note' } });
        items.push(txt({ x: x + w / 2, y: y + 8, anchor: 'middle', color: 'ink', part, fit: part, on: 'note', boundTo: part }, nb));
        idx.forEach(touch);
        y += h + 16;
        continue;
      }
      const a = pid[s.from], b = pid[s.to];
      const g = msgs.find(q => q.s === s);
      const part = 'msg:' + (++n);
      touch(a); touch(b);
      if (s.reply && depth(a)) { const st = act[a].pop(); acts.push({ i: a, y0: st.y, y1: y, d: act[a].length }); }
      if (a === b) {
        const x0 = edgeX(a, 1), w = 44;
        const pts = [[x0, y], [x0 + w, y], [x0 + w, y + 26], [edgeX(a, 1), y + 26]];
        items.push({ t: 'line', pts, stroke: 'edge', sw: 1.5, dash: s.reply ? true : null, end: 'arrow', part, role: 'msg', uid: part, sem: { kind: 'edge', label: s.label } });
        items.push(txt({ x: x0 + w + 8, y: y + 13 - g.lb.h / 2, color: 'ink', part, boundTo: part }, g.lb));
        if (numbered) badge(items, x0 + w + 8 + g.lb.w + 14, y + 13, n, part);
        y += 50;
        continue;
      }
      const dir = Math.sign(xs[b] - xs[a]);
      const x1 = edgeX(a, dir), x2 = edgeX(b, -dir) + (!s.reply && dir ? -dir * 6 : 0);
      const ly = y + g.lb.h + 8;
      items.push({ t: 'line', pts: [[x1, ly], [x2, ly]], stroke: s.tone || 'edge', sw: 1.5, dash: s.reply ? true : null, end: 'arrow', part, role: 'msg', uid: part, from: 'p:' + s.from, to: 'p:' + s.to, sem: { kind: 'edge', label: s.label } });
      const mid = (x1 + x2) / 2 + (numbered ? 12 : 0);
      items.push(txt({ x: mid, y: ly - 6 - g.lb.h, anchor: 'middle', color: 'ink', part, boundTo: part }, g.lb));
      if (numbered) badge(items, mid - g.lb.w / 2 - 16, ly - 6 - g.lb.h / 2, n, part);
      if (!s.reply && !s.async) act[b].push({ y: ly });
      y = ly + 24;
    }
    const endY = y + 10;
    P.forEach((p, i) => { while (act[i].length) { const st = act[i].pop(); acts.push({ i, y0: st.y, y1: endY - 14, d: act[i].length }); } });
    const W = xs[P.length - 1];
    // blocks (frames) behind everything
    const behind = [], blockFront = [];
    // block labels sit on a ground-coloured chip above activation bars so a lifeline never hides them
    const chipText = (x, y, s, color, part) => {
      const lb = T(s, 12, 500);
      blockFront.push({ t: 'rect', x: x - 4, y: y - 1, w: lb.w + 8, h: lb.h + 2, r: 4, fill: 'bg', part, sem: { kind: 'deco' } });
      blockFront.push(txt({ x, y, color, part }, lb));
    };
    blocks.forEach((b, k) => {
      const lo = b.lo === Infinity ? 0 : b.lo, hi = b.hi === -Infinity ? P.length - 1 : b.hi;
      const nest = openDepth(blocks, b);
      const kb = T(b.kind, 11.5, 700);
      const x = xs[lo] - Math.max(90, kb.w + 60) + nest * 8, x2 = xs[hi] + 70 + (hi === P.length - 1 ? 40 : 0) - nest * 8;
      const part = 'block:' + (k + 1);
      behind.push({ t: 'rect', x, y: b.y0, w: x2 - x, h: (b.y1 || endY) - b.y0, r: 6, fill: 'none', stroke: 'edge', sw: 1.2, part, role: 'group', uid: part, sem: { kind: 'group', id: part } });
      blockFront.push({ t: 'path', d: `M${x} ${b.y0 + 22} h${kb.w + 18} l8 -8 v-14 h${-(kb.w + 26)} z`, fill: 'panel', stroke: 'edge', sw: 1.2, part, sem: { kind: 'deco' } });
      blockFront.push(txt({ x: x + 8, y: b.y0 + 11 - kb.lh / 2 + 1, color: 'ink', part, on: 'panel', boundTo: part }, kb));
      if (b.label) chipText(x + kb.w + 36, b.y0 + 4, '[' + b.label + ']', 'dim', part);
      b.elses.forEach(e => {
        behind.push({ t: 'line', pts: [[x, e.y], [x2, e.y]], stroke: 'edge', sw: 1.2, dash: '5 4', part, sem: { kind: 'deco' } });
        if (e.label) chipText(x + 10, e.y + 4, '[' + e.label + ']', 'dim', part);
      });
    });
    // lifelines and heads
    const front = [];
    P.forEach((p, i) => {
      const h = heads[i], x = xs[i] - h.w / 2, part = 'participant:' + p.id, uid = 'p:' + p.id;
      behind.push({ t: 'line', pts: [[xs[i], lifeTop], [xs[i], endY]], stroke: 'line', sw: 1.5, dash: '4 5', part, sem: { kind: 'deco' } });
      front.push({ t: 'rect', x, y: top, w: h.w, h: headH, r: 8, fill: 'panel', stroke: 'ink', sw: 1.5, part, role: 'node', uid, sem: { kind: 'node', id: p.id, shape: 'box' } });
      let ty = top + headH / 2 - ((h.ic ? h.ic + 8 : 0) + h.lb.h + (h.sub ? h.sub.h + 2 : 0)) / 2;
      if (h.ic) { front.push({ t: 'image', x: xs[i] - h.ic / 2, y: ty, w: h.ic, h: h.ic, icon: p.icon, part }); ty += h.ic + 8; }
      front.push(txt({ x: xs[i], y: ty, anchor: 'middle', color: 'ink', part, fit: uid, on: 'panel', boundTo: uid }, h.lb));
      if (h.sub) front.push(txt({ x: xs[i], y: ty + h.lb.h + 2, anchor: 'middle', color: 'dim', part, fit: uid, on: 'panel', boundTo: uid }, h.sub));
    });
    const actItems = acts.map((a, k) => ({ t: 'rect', x: xs[a.i] - 6 + a.d * 5, y: a.y0 - 6, w: 12, h: Math.max(12, a.y1 - a.y0 + 12), r: 2, fill: 'accent.fill', stroke: 'accent', sw: 1.2, part: 'participant:' + P[a.i].id, sem: { kind: 'deco' } }));
    const all = [...behind, ...actItems, ...blockFront, ...front, ...items];
    const sz = frame(all);
    return { w: Math.max(sz.w, W + 80), h: sz.h, title: cfg.title, items: all };
  }
  function openDepth(blocks, b) {
    return blocks.filter(o => o !== b && o.y0 < b.y0 && (o.y1 || 1e9) > (b.y1 || 1e9 - 1)).length;
  }
  function badge(items, cx, cy, n, part) {
    const b = T(String(n), 10.5, 700);
    items.push({ t: 'ellipse', cx, cy, rx: 10, ry: 10, fill: 'accent', part, sem: { kind: 'deco' } });
    items.push(txt({ x: cx, y: cy - b.lh / 2, anchor: 'middle', color: 'onSolid', part, on: 'accent', noCheck: true }, b));
  }

  // ================================================================ ER
  async function er(m) {
    const cfg = m.config;
    if (!m.tables.length) throw new Error('er: add tables with Diagram.table(id, {columns: [[name, type, "pk"|"fk"], …]})');
    const tabs = {};
    for (const t of m.tables) {
      const cols = (t.columns || []).map(c => (Array.isArray(c) ? { name: c[0], type: c[1] || '', key: (c[2] || '').toUpperCase() } : { name: c.name, type: c.type || '', key: (c.key || '').toUpperCase() }));
      const head = T(t.label || t.id, 14, 700, 260);
      const nameW = Math.max(0, ...cols.map(c => MD.text.width(c.name, 13, c.key === 'PK' ? 600 : 400)));
      const typeW = Math.max(0, ...cols.map(c => MD.text.width(c.type, 12, 400, true)));
      const w = Math.max(200, head.w + 32, 42 + nameW + 24 + typeW + 14);
      tabs[t.id] = { t, cols, head, w, h: 38 + cols.length * 30, nameW };
    }
    const col = ref => {
      const [tid, cname] = ref.split('.');
      const tb = tabs[tid];
      if (!tb) throw new Error(`relation: no table "${tid}"`);
      const i = cname ? tb.cols.findIndex(c => c.name === cname) : 0;
      if (i < 0) throw new Error(`relation: table "${tid}" has no column "${cname}"`);
      return { tid, i };
    };
    const rels = m.relations.map((r, k) => ({ r, k, a: col(r.from), b: col(r.to) }));
    const base = (extra) => ({
      id: 'root',
      layoutOptions: Object.assign({
        'elk.algorithm': 'layered', 'elk.direction': cfg.direction === 'down' ? 'DOWN' : 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '110', 'elk.spacing.nodeNode': '50', 'elk.spacing.edgeNode': '30',
        'elk.layered.spacing.edgeNodeBetweenLayers': '34', 'elk.spacing.edgeEdge': '16', 'elk.padding': '[top=20,left=20,bottom=20,right=20]',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      }, extra || {}),
    });
    const elk = new window.ELK();
    // pass 1: positions only, to know which side each relation leaves from
    const g1 = Object.assign(base(), {
      children: Object.values(tabs).map(tb => ({ id: tb.t.id, width: tb.w, height: tb.h })),
      edges: rels.map(x => ({ id: 'r' + x.k, sources: [x.a.tid], targets: [x.b.tid] })),
    });
    const o1 = await elk.layout(g1);
    const pos1 = {};
    o1.children.forEach(c => (pos1[c.id] = c));
    // pass 2: fixed ports on the facing sides at each column's row
    const ports = {};
    const rowY = i => 38 + i * 30 + 15;
    const portId = (end, k) => `p${k}${end}`;
    rels.forEach(x => {
      const A = pos1[x.a.tid], B = pos1[x.b.tid];
      const right = B.x + B.width / 2 >= A.x + A.width / 2;
      const self = x.a.tid === x.b.tid;
      (ports[x.a.tid] = ports[x.a.tid] || []).push({ id: portId('a', x.k), width: 1, height: 1, x: right || self ? tabs[x.a.tid].w : 0, y: rowY(x.a.i), layoutOptions: { 'elk.port.side': right || self ? 'EAST' : 'WEST' } });
      (ports[x.b.tid] = ports[x.b.tid] || []).push({ id: portId('b', x.k), width: 1, height: 1, x: right && !self ? 0 : tabs[x.b.tid].w, y: rowY(x.b.i), layoutOptions: { 'elk.port.side': right && !self ? 'WEST' : 'EAST' } });
    });
    const g2 = Object.assign(base(), {
      children: Object.values(tabs).map(tb => ({ id: tb.t.id, width: tb.w, height: tb.h, ports: ports[tb.t.id] || [], layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } })),
      edges: rels.map(x => ({ id: 'r' + x.k, sources: [portId('a', x.k)], targets: [portId('b', x.k)] })),
    });
    const o2 = await elk.layout(g2);
    const items = [], lines = [];
    o2.children.forEach(c => {
      const tb = tabs[c.id], x = c.x, y = c.y, part = 'table:' + c.id, uid = 'n:' + c.id, tone = tb.t.tone || 'data';
      items.push({ t: 'rect', x, y, w: tb.w, h: tb.h, r: 8, fill: 'bg', stroke: 'ink', sw: 1.5, part, role: 'node', uid, sem: { kind: 'table', id: c.id } });
      items.push({ t: 'path', d: `M${x} ${y + 8} a8 8 0 0 1 8 -8 h${tb.w - 16} a8 8 0 0 1 8 8 v30 h${-tb.w} z`, fill: tone, part, x, y, w: tb.w, h: 38, sem: { kind: 'deco' } });
      items.push(txt({ x: x + 14, y: y + 19 - tb.head.lh / 2, color: 'bg', part, on: tone, fit: uid, sem: { kind: 'tableHead' } }, tb.head));
      tb.cols.forEach((cl, i) => {
        const ry = y + 38 + i * 30;
        if (i) items.push({ t: 'line', pts: [[x, ry], [x + tb.w, ry]], stroke: 'line', sw: 1, part, sem: { kind: 'deco' } });
        if (cl.key) { const kb = T(cl.key, 10.5, 700, 99, { mono: true }); items.push(txt({ x: x + 12, y: ry + 15 - kb.lh / 2, color: cl.key === 'PK' ? 'warn' : 'accent', part, fit: uid, sem: { kind: 'col', table: c.id } }, kb)); }
        const nb = T(cl.name, 13, cl.key === 'PK' ? 600 : 400);
        items.push(txt({ x: x + 42, y: ry + 15 - nb.lh / 2, color: 'ink', part, fit: uid, sem: { kind: 'col', table: c.id } }, nb));
        if (cl.type) { const tyb = T(cl.type, 12, 400, 999, { mono: true }); items.push(txt({ x: x + tb.w - 12, y: ry + 15 - tyb.lh / 2, anchor: 'end', color: 'dim', part, fit: uid, sem: { kind: 'col', table: c.id } }, tyb)); }
      });
    });
    o2.edges.forEach((oe, k) => {
      const x = rels[k], sec = (oe.sections || [])[0];
      if (!sec) return;
      const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map(p => [p.x, p.y]);
      const part = 'rel:' + (k + 1), uid = 'r:' + k;
      const [ca, cb] = String(x.r.card || '1:N').split(':');
      lines.push({ t: 'line', pts, stroke: 'edge', sw: 1.5, part, role: 'edge', uid, from: 'n:' + x.a.tid, to: 'n:' + x.b.tid, dash: x.r.dashed ? true : null, sem: { kind: 'edge', label: x.r.label || '', card: [ca, cb] } });
      lines.push(...crow(pts, ca, part), ...crow(pts.slice().reverse(), cb, part));
      if (x.r.label) {
        const lb = T(x.r.label, 12, 500, 140);
        let best = 0, bi = 0;
        for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (L > best) { best = L; bi = i; } }
        const mx = (pts[bi][0] + pts[bi + 1][0]) / 2, my = (pts[bi][1] + pts[bi + 1][1]) / 2;
        lines.push({ t: 'rect', x: mx - lb.w / 2 - 9, y: my - lb.h / 2 - 3, w: lb.w + 18, h: lb.h + 6, r: 10, fill: 'bg', stroke: 'line', sw: 1, part, role: 'node', uid: 'l:' + k, edgeOk: true, boundTo: uid });
        lines.push(txt({ x: mx, y: my - lb.h / 2, anchor: 'middle', color: 'dim', part, fit: 'l:' + k, boundTo: uid, edgeOk: true }, lb));
      }
    });
    const all = [...lines.filter(i => i.role === 'edge'), ...items, ...lines.filter(i => i.role !== 'edge')];
    const sz = frame(all);
    return { w: sz.w, h: sz.h, title: cfg.title, items: all };
  }
  // Crow's-foot marks at pts[0] (the table border); card: 1 | 0..1 | N | 1..N | 0..N
  function crow(pts, card, part) {
    const [x, y] = pts[0], [nx, ny] = pts[1];
    const L = Math.hypot(nx - x, ny - y) || 1, ux = (nx - x) / L, uy = (ny - y) / L, px = -uy, py = ux;
    const at = k => [x + ux * k, y + uy * k];
    const bar = k => { const [cx, cy] = at(k); return { t: 'line', pts: [[cx + px * 8, cy + py * 8], [cx - px * 8, cy - py * 8]], stroke: 'edge', sw: 1.5, r: 0, part, sem: { kind: 'deco' } }; };
    const c = String(card).toUpperCase().replace('*', 'N').replace('M', 'N');
    const out = [];
    const many = c.includes('N'), zero = c.startsWith('0');
    if (many) {
      const [tx, ty] = at(14);
      out.push({ t: 'line', pts: [[x + px * 9, y + py * 9], [tx, ty], [x - px * 9, y - py * 9]], stroke: 'edge', sw: 1.5, r: 0, part, sem: { kind: 'deco' } });
      out.push({ t: 'line', pts: [[x, y], [tx, ty]], stroke: 'edge', sw: 1.5, r: 0, part, sem: { kind: 'deco' } });
    } else out.push(bar(8));
    if (zero) { const [cx, cy] = at(many ? 22 : 18); out.push({ t: 'ellipse', cx, cy, rx: 5, ry: 5, fill: 'bg', stroke: 'edge', sw: 1.5, part, sem: { kind: 'deco' } }); }
    else out.push(bar(many ? 20 : 14));
    return out;
  }

  // ================================================================ swimlane
  async function swimlane(m) {
    const cfg = Object.assign({}, m.config, { kind: 'flowchart' });
    if (!m.lanes.length) throw new Error('swimlane: add lanes with Diagram.lane(id, {label}) and put nodes in them with {lane: id}');
    const laneIdx = {};
    m.lanes.forEach((l, i) => (laneIdx[l.id] = i));
    for (const n of m.nodes) if (laneIdx[n.lane] == null) throw new Error(`node "${n.id}": lane "${n.lane}" doesn't exist. Lanes: ${m.lanes.map(l => l.id).join(', ')}`);
    for (const e of m.edges) for (const end of [e.from, e.to]) if (!m.nodes.some(n => n.id === end)) throw new Error(`edge ${e.from} -> ${e.to}: no node "${end}"`);
    for (const n of m.nodes) if (n.icon) await MD.loadIcon(n.icon);
    const specs = {};
    m.nodes.forEach(n => (specs[n.id] = MD.nodeSpec(n, cfg)));
    // columns from ELK's layering of the flow
    const o = await new window.ELK().layout({
      id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.spacing.nodeNodeBetweenLayers': '60' },
      children: m.nodes.map(n => ({ id: n.id, width: specs[n.id].w, height: specs[n.id].h })),
      edges: m.edges.map((e, i) => ({ id: 'e' + i, sources: [e.from], targets: [e.to] })),
    });
    const ex = {};
    o.children.forEach(c => (ex[c.id] = c));
    const starts = [...new Set(o.children.map(c => Math.round(c.x)))].sort((a, b) => a - b);
    const colOf = id => (m.nodes.find(n => n.id === id).col != null ? m.nodes.find(n => n.id === id).col : starts.indexOf(Math.round(ex[id].x)));
    const ncol = Math.max(...m.nodes.map(n => colOf(n.id))) + 1;
    const colW = Array(ncol).fill(0);
    m.nodes.forEach(n => (colW[colOf(n.id)] = Math.max(colW[colOf(n.id)], specs[n.id].w)));
    const headW = Math.max(110, ...m.lanes.map(l => T(l.label || l.id, 14, 600, 140).w + 32));
    const gap = 76;
    const colX = [];
    let cx = headW + 52;
    colW.forEach((w, i) => { colX[i] = cx; cx += w + gap; });
    const W = cx - gap + 52;
    // stack nodes that share a lane and column
    const cells = {};
    m.nodes.forEach(n => { const k = laneIdx[n.lane] + ':' + colOf(n.id); (cells[k] = cells[k] || []).push(n); });
    Object.values(cells).forEach(list => list.sort((a, b) => ex[a.id].y - ex[b.id].y));
    const laneH = m.lanes.map((l, li) => {
      let h = 120;
      for (let c = 0; c < ncol; c++) { const list = cells[li + ':' + c] || []; const sh = list.reduce((s, n) => s + specs[n.id].h, 0) + Math.max(0, list.length - 1) * 30; h = Math.max(h, sh + 72); }
      return h;
    });
    const laneY = [];
    let ly = 0;
    laneH.forEach((h, i) => { laneY[i] = ly; ly += h; });
    const box = {};
    Object.entries(cells).forEach(([k, list]) => {
      const [li, c] = k.split(':').map(Number);
      const sh = list.reduce((s, n) => s + specs[n.id].h, 0) + (list.length - 1) * 30;
      let y = laneY[li] + (laneH[li] - sh) / 2;
      list.forEach(n => { const s = specs[n.id]; box[n.id] = { x: colX[c] + (colW[c] - s.w) / 2, y, w: s.w, h: s.h, col: c, lane: li }; y += s.h + 30; });
    });
    const items = [];
    m.lanes.forEach((l, i) => {
      const part = 'lane:' + l.id;
      items.push({ t: 'rect', x: 0, y: laneY[i], w: W, h: laneH[i], r: 0, fill: i % 2 ? 'panel' : 'bg', stroke: 'line', sw: 1, part, role: 'group', uid: 'g:' + l.id, sem: { kind: 'group', id: l.id, lane: true } });
      items.push({ t: 'rect', x: 0, y: laneY[i], w: headW, h: laneH[i], r: 0, fill: (l.tone || 'accent') + '.fill', stroke: 'line', sw: 1, part, sem: { kind: 'deco' } });
      const lb = T(l.label || l.id, 14, 600, headW - 24);
      items.push(txt({ x: headW / 2, y: laneY[i] + laneH[i] / 2 - lb.h / 2, anchor: 'middle', color: 'ink', part, on: (l.tone || 'accent') + '.fill', boundTo: 'g:' + l.id }, lb));
    });
    // route edges around the nodes
    const obstacles = m.nodes.map(n => ({ id: n.id, ...box[n.id] }));
    const routed = [];
    const edgeItems = [], labelItems = [];
    m.edges.forEach((e, i) => {
      const A = box[e.from], B = box[e.to];
      const side = sides(A, B);
      const pts = route(A, B, side, obstacles.filter(o => o.id !== e.from && o.id !== e.to), routed, { w: W, h: ly, headW });
      routed.push(pts);
      const part = `edge:${e.from}>${e.to}`, uid = 'e:' + i;
      edgeItems.push({ t: 'line', pts, stroke: e.tone || 'edge', sw: 1.6, dash: e.dashed ? true : null, end: e.arrow === 'none' ? null : 'arrow', part, role: 'edge', uid, from: 'n:' + e.from, to: 'n:' + e.to, sem: { kind: 'edge', label: e.label || '' } });
      if (e.label) {
        const lb = T(e.label, 12, e.tone ? 700 : 500, 140);
        let best = -1, bi = 0;
        for (let k = 0; k < pts.length - 1; k++) { const L = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); if (L > best) { best = L; bi = k; } }
        const mx = (pts[bi][0] + pts[bi + 1][0]) / 2, my = (pts[bi][1] + pts[bi + 1][1]) / 2;
        labelItems.push({ t: 'rect', x: mx - lb.w / 2 - 8, y: my - lb.h / 2 - 3, w: lb.w + 16, h: lb.h + 6, r: 10, fill: 'bg', stroke: 'line', sw: 1, part, role: 'node', uid: 'l:' + i, edgeOk: true, boundTo: uid });
        labelItems.push(txt({ x: mx, y: my - lb.h / 2, anchor: 'middle', color: e.tone || 'dim', part, fit: 'l:' + i, boundTo: uid, edgeOk: true }, lb));
      }
    });
    const nodeItems = [];
    m.nodes.forEach(n => { const b = box[n.id]; nodeItems.push(...specs[n.id].draw(b.x, b.y).map(i => Object.assign(i, { parent: 'g:' + n.lane }))); });
    const all = [...items, ...edgeItems, ...nodeItems, ...labelItems];
    return { w: W, h: ly, title: cfg.title, items: all };
  }
  // Back edges (to an earlier column) leave sideways and come in over or under their target, clear of the forward flow.
  function sides(A, B) {
    if (B.col > A.col) return ['E', 'W'];
    if (B.col === A.col) return B.y > A.y ? ['S', 'N'] : ['N', 'S'];
    return B.lane >= A.lane ? ['N', 'N'] : ['S', 'S'];
  }
  const portOf = (b, s) => ({ E: [b.x + b.w, b.y + b.h / 2], W: [b.x, b.y + b.h / 2], N: [b.x + b.w / 2, b.y], S: [b.x + b.w / 2, b.y + b.h] }[s]);
  const DV = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
  // Orthogonal A* over a sparse grid built from obstacle edges; bends and shared segments cost extra.
  function route(A, B, [sa, sb], obs, routed, bounds) {
    const P0 = portOf(A, sa), P1 = portOf(B, sb), M = 18;
    const s0 = [P0[0] + DV[sa][0] * M, P0[1] + DV[sa][1] * M], s1 = [P1[0] + DV[sb][0] * M, P1[1] + DV[sb][1] * M];
    const inf = obs.map(o => ({ x: o.x - 12, y: o.y - 12, w: o.w + 24, h: o.h + 24 }));
    const ownA = { x: A.x - 2, y: A.y - 2, w: A.w + 4, h: A.h + 4 }, ownB = { x: B.x - 2, y: B.y - 2, w: B.w + 4, h: B.h + 4 };
    const blockers = [...inf, ownA, ownB];
    const xs = new Set([s0[0], s1[0]]), ys = new Set([s0[1], s1[1]]);
    for (const r of [...inf, ownA, ownB]) { xs.add(r.x - 4); xs.add(r.x + r.w + 4); ys.add(r.y - 4); ys.add(r.y + r.h + 4); }
    const X = [...xs].filter(v => v > bounds.headW && v < bounds.w).sort((a, b) => a - b);
    const Y = [...ys].filter(v => v > 0 && v < bounds.h).sort((a, b) => a - b);
    for (let i = X.length - 1; i > 0; i--) if (X[i] - X[i - 1] > 60) X.splice(i, 0, (X[i] + X[i - 1]) / 2);
    const inside = (x, y) => blockers.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
    const segFree = (a, b) => !blockers.some(r => {
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      return x1 < r.x + r.w && x2 > r.x && y1 < r.y + r.h && y2 > r.y;
    });
    const used = (a, b) => routed.some(pts => pts.some((p, k) => k < pts.length - 1 && overlap(a, b, p, pts[k + 1])));
    // optional: lines this route should not cross (second routing pass)
    const crosses = (a, b) => (bounds.cross || []).some(pts => pts.some((p, k) => k < pts.length - 1 && perpCross(a, b, p, pts[k + 1])));
    const key = (i, j, d) => i + ',' + j + ',' + d;
    const xi = X.indexOf(s0[0]), yi = Y.indexOf(s0[1]), xt = X.indexOf(s1[0]), yt = Y.indexOf(s1[1]);
    if (xi < 0 || yi < 0 || xt < 0 || yt < 0) return [P0, s0, [s1[0], s0[1]], s1, P1];
    const open = [{ i: xi, j: yi, d: sa, g: 0, f: 0, prev: null }];
    const best = {};
    const h = (i, j) => Math.abs(X[i] - X[xt]) + Math.abs(Y[j] - Y[yt]);
    let found = null, guard = 0;
    while (open.length && guard++ < 60000) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.i === xt && cur.j === yt) { found = cur; break; }
      for (const d of ['E', 'W', 'N', 'S']) {
        const ni = cur.i + (d === 'E' ? 1 : d === 'W' ? -1 : 0), nj = cur.j + (d === 'S' ? 1 : d === 'N' ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= X.length || nj >= Y.length) continue;
        const a = [X[cur.i], Y[cur.j]], b = [X[ni], Y[nj]];
        if (inside(b[0], b[1]) || !segFree(a, b)) continue;
        const back = { E: 'W', W: 'E', N: 'S', S: 'N' }[cur.d] === d;
        if (back) continue;
        let g = cur.g + Math.hypot(b[0] - a[0], b[1] - a[1]) + (d !== cur.d ? 46 : 0) + (used(a, b) ? 60 : 0) + (crosses(a, b) ? 260 : 0);
        if (ni === xt && nj === yt && d !== { E: 'W', W: 'E', N: 'S', S: 'N' }[sb]) g += 46;
        const k = key(ni, nj, d);
        if (best[k] != null && best[k] <= g) continue;
        best[k] = g;
        open.push({ i: ni, j: nj, d, g, f: g + h(ni, nj), prev: cur });
      }
    }
    if (!found) return [P0, s0, [s1[0], s0[1]], s1, P1];
    const path = [];
    for (let c = found; c; c = c.prev) path.unshift([X[c.i], Y[c.j]]);
    return simplify([P0, ...path, P1]);
  }
  // a horizontal and a vertical segment crossing strictly inside both
  function perpCross(a, b, c, d) {
    const h1 = Math.abs(a[1] - b[1]) < 0.5, h2 = Math.abs(c[1] - d[1]) < 0.5;
    if (h1 === h2) return false;
    const [H, V] = h1 ? [[a, b], [c, d]] : [[c, d], [a, b]];
    const y = H[0][1], x = V[0][0];
    return x > Math.min(H[0][0], H[1][0]) + 2 && x < Math.max(H[0][0], H[1][0]) - 2 && y > Math.min(V[0][1], V[1][1]) + 2 && y < Math.max(V[0][1], V[1][1]) - 2;
  }
  MD.perpCross = perpCross;
  function overlap(a, b, c, d) {
    if (a[0] === b[0] && c[0] === d[0] && Math.abs(a[0] - c[0]) < 3) return Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) > 4;
    if (a[1] === b[1] && c[1] === d[1] && Math.abs(a[1] - c[1]) < 3) return Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) > 4;
    return false;
  }
  function simplify(p) {
    const out = [p[0]];
    for (let i = 1; i < p.length - 1; i++) {
      const a = out[out.length - 1], b = p[i], c = p[i + 1];
      if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) continue;
      out.push(b);
    }
    out.push(p[p.length - 1]);
    return out;
  }
  MD.route = route;

  // ================================================================ mind map
  async function mindmap(m) {
    const cfg = m.config;
    if (!m.mind) throw new Error("mindmap: call Diagram.mindmap({label: 'Topic', children: ['A', {label: 'B', children: [...]}]})");
    const norm = (t, depth) => (typeof t === 'string' ? { label: t, children: [], depth } : { ...t, depth, children: (t.children || []).map(c => norm(c, depth + 1)) });
    const root = norm(m.mind, 0);
    let pid = 0;
    const measure = n => {
      n.id = n.id || 'topic' + (pid++ || '');
      if (n.depth === 0) { n.tb = T(n.label, 18, 700, 220); n.w = n.tb.w + 48; n.h = Math.max(60, n.tb.h + 28); }
      else if (n.depth === 1) { n.tb = T(n.label, 14, 600, 180); n.w = n.tb.w + 36; n.h = Math.max(40, n.tb.h + 18); }
      else { n.tb = T(n.label, n.depth === 2 ? 13.5 : 12.5, n.depth === 2 ? 500 : 400, 200); n.w = n.tb.w + 8; n.h = n.tb.h + 10; }
      n.children.forEach(measure);
      const kids = n.children.reduce((s, c) => s + c.sub, 0) + Math.max(0, n.children.length - 1) * (n.depth === 0 ? 26 : 8);
      n.sub = Math.max(n.h, kids);
    };
    measure(root);
    const right = [], left = [];
    const total = root.children.reduce((s, c) => s + c.sub, 0);
    let acc = 0;
    root.children.forEach((c, i) => { c.cat = c.tone || 'cat' + (i % 8); (cfg.side === 'right' || acc < total / 2 ? right : left).push(c); acc += c.sub; });
    const items = [];
    root.x = -root.w / 2; root.y = -root.h / 2;
    const place = (list, dir) => {
      const H = list.reduce((s, c) => s + c.sub, 0) + Math.max(0, list.length - 1) * 26;
      let y = -H / 2;
      list.forEach(c => { placeSub(c, dir, dir > 0 ? root.w / 2 + 110 : -root.w / 2 - 110, y); y += c.sub + 26; });
    };
    const placeSub = (n, dir, edgeX, top) => {
      n.y = top + n.sub / 2 - n.h / 2;
      n.x = dir > 0 ? edgeX : edgeX - n.w;
      n.dir = dir;
      const kidsH = n.children.reduce((s, c) => s + c.sub, 0) + Math.max(0, n.children.length - 1) * 8;
      let y = top + n.sub / 2 - kidsH / 2;
      n.children.forEach(c => { c.cat = n.cat; placeSub(c, dir, dir > 0 ? n.x + n.w + 56 : n.x - 56, y); y += c.sub + 8; });
    };
    place(right, 1);
    place(left, -1);
    const curves = [], nodes = [];
    const anchorOut = (n, dir) => (n.depth === 0 ? [dir > 0 ? n.x + n.w : n.x, n.y + n.h / 2] : n.depth === 1 ? [dir > 0 ? n.x + n.w : n.x, n.y + n.h / 2] : [dir > 0 ? n.x + n.w : n.x, n.y + n.h]);
    const anchorIn = n => (n.depth === 1 ? [n.dir > 0 ? n.x : n.x + n.w, n.y + n.h / 2] : [n.dir > 0 ? n.x : n.x + n.w, n.y + n.h]);
    const draw = (n, parent) => {
      const part = 'topic:' + n.id, uid = 'n:' + n.id;
      if (parent) {
        const [ax, ay] = anchorOut(parent, n.dir), [bx, by] = anchorIn(n);
        const k = (bx - ax) * 0.5;
        const d = `M${ax} ${ay} C${ax + k} ${ay} ${bx - k} ${by} ${bx} ${by}`;
        const pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, u = 1 - t; pts.push([u * u * u * ax + 3 * u * u * t * (ax + k) + 3 * u * t * t * (bx - k) + t * t * t * bx, u * u * u * ay + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * by]); }
        curves.push({ t: 'line', curve: true, d, pts, stroke: n.cat, sw: n.depth === 1 ? 3 : n.depth === 2 ? 2 : 1.5, part, role: 'edge', from: 'n:' + parent.id, to: uid, sem: { kind: 'edge', curve: true } });
      }
      if (n.depth === 0) {
        nodes.push({ t: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: n.h / 2, fill: 'ink', part, role: 'node', uid, sem: { kind: 'node', id: n.id, shape: 'terminal' } });
        nodes.push(txt({ x: 0, y: n.y + n.h / 2 - n.tb.h / 2, anchor: 'middle', color: 'bg', part, on: 'ink', fit: uid, boundTo: uid }, n.tb));
      } else if (n.depth === 1) {
        nodes.push({ t: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: n.h / 2, fill: n.cat + '.fill', stroke: n.cat, sw: 2, part, role: 'node', uid, sem: { kind: 'node', id: n.id, shape: 'terminal' } });
        nodes.push(txt({ x: n.x + n.w / 2, y: n.y + n.h / 2 - n.tb.h / 2, anchor: 'middle', color: 'ink', part, on: n.cat + '.fill', fit: uid, boundTo: uid }, n.tb));
      } else {
        nodes.push({ t: 'line', pts: [[n.x, n.y + n.h], [n.x + n.w, n.y + n.h]], stroke: n.cat, sw: n.depth === 2 ? 2 : 1.5, r: 0, part, sem: { kind: 'deco' } });
        nodes.push(txt({ x: n.dir > 0 ? n.x + 4 : n.x + n.w - 4, y: n.y + 2, anchor: n.dir > 0 ? 'start' : 'end', color: n.depth === 2 ? 'ink' : 'dim', part, uid, role: 'nodeText', sem: { kind: 'node', id: n.id, shape: 'text' } }, n.tb));
      }
      n.children.forEach(c => draw(c, n));
    };
    draw(root, null);
    const all = [...curves, ...nodes];
    const sz = frame(all, 32);
    return { w: sz.w, h: sz.h, title: cfg.title, items: all };
  }

  // ================================================================ timeline / roadmap
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function months(s) {
    const q = /^Q([1-4])\s+(\d{4})$/i.exec(String(s).trim());
    if (q) return +q[2] * 12 + (+q[1] - 1) * 3;
    const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(String(s).trim());
    if (!m) throw new Error(`timeline: can't read date "${s}" (use 2027-03, 2027-03-15 or Q2 2027)`);
    const y = +m[1], mo = m[2] ? +m[2] - 1 : 0, d = m[3] ? +m[3] - 1 : 0;
    return y * 12 + mo + d / new Date(y, mo + 1, 0).getDate();
  }
  async function timeline(m) {
    const cfg = m.config;
    if (!m.tracks.length) throw new Error('timeline: add tracks with Diagram.track(id, {label}) and bars with Diagram.bar(track, label, from, to)');
    const all = [...m.bars.flatMap(b => [b.from, b.to]), ...m.milestones.map(x => x.at), ...m.markers.map(x => x.at)];
    let a = cfg.from ? months(cfg.from) : Math.min(...all.map(months));
    let b = cfg.to ? months(cfg.to) : Math.max(...all.map(months));
    const span = b - a;
    const unit = cfg.unit || (span > 36 ? 'year' : span > 8 ? 'quarter' : 'month');
    const step = { year: 12, quarter: 3, month: 1 }[unit];
    a = Math.floor(a / step) * step;
    b = Math.ceil((b + (cfg.to ? 0.001 : 0.5)) / step) * step;
    const labelW = Math.max(...m.tracks.map(t => T(t.label || t.id, 14, 600, 200).w)) + 40;
    const W = cfg.width || 1200, x0 = labelW + 20, x1 = W - 32;
    const X = mo => x0 + (mo - a) / (b - a) * (x1 - x0);
    const rowH = 58, top = 56;
    const items = [];
    for (let t = a; t < b; t += step) {
      const y = Math.floor(t / 12), mo = t % 12;
      const lab = unit === 'year' ? String(y) : unit === 'quarter' ? `Q${mo / 3 + 1} ${y}` : (mo === 0 || t === a ? `${MON[mo]} ${y}` : MON[mo]);
      const lb = T(lab, 13, 700);
      items.push(txt({ x: (X(t) + X(t + step)) / 2, y: 18, anchor: 'middle', color: 'dim', part: 'axis' }, lb));
    }
    for (let t = a; t <= b; t += step) items.push({ t: 'line', pts: [[X(t), 46], [X(t), top + m.tracks.length * rowH + 4]], stroke: 'line', sw: 1, r: 0, part: 'axis', sem: { kind: 'deco' } });
    const tracksY = {};
    m.tracks.forEach((tr, i) => {
      const y = top + i * rowH;
      tracksY[tr.id] = y;
      const lb = T(tr.label || tr.id, 14, 600, 200);
      items.push(txt({ x: 24, y: y + rowH / 2 - lb.h / 2, color: 'ink', part: 'track:' + tr.id }, lb));
      if (i) items.push({ t: 'line', pts: [[24, y], [x1, y]], stroke: 'line', sw: 1, r: 0, dash: '2 4', part: 'track:' + tr.id, sem: { kind: 'deco' } });
    });
    m.bars.forEach((br, k) => {
      if (tracksY[br.track] == null) throw new Error(`bar "${br.label}": no track "${br.track}"`);
      const ti = m.tracks.findIndex(t => t.id === br.track);
      const col = br.tone || m.tracks[ti].tone || 'cat' + (ti % 8);
      const xa = X(months(br.from)), xb = X(months(br.to)), y = tracksY[br.track] + 11;
      const part = 'bar:' + (k + 1), uid = part;
      items.push({ t: 'rect', x: xa, y, w: Math.max(6, xb - xa), h: 36, r: 8, fill: col + '.fill', stroke: col, sw: 1.5, part, role: 'node', uid, sem: { kind: 'node', id: part, shape: 'box' } });
      const lb = T(br.label, 13, 500, 400);
      const inside = lb.w + 24 <= xb - xa;
      items.push(txt({ x: inside ? xa + 12 : xb + 8, y: y + 18 - lb.h / 2, color: 'ink', part, on: inside ? col + '.fill' : null, fit: inside ? uid : null, boundTo: inside ? uid : null }, lb));
    });
    m.milestones.forEach((ms, k) => {
      if (tracksY[ms.track] == null) throw new Error(`milestone "${ms.label}": no track "${ms.track}"`);
      const x = X(months(ms.at)), y = tracksY[ms.track] + rowH / 2, part = 'milestone:' + (k + 1);
      const col = ms.tone || 'accent';
      items.push({ t: 'poly', pts: [[x, y - 12], [x + 12, y], [x, y + 12], [x - 12, y]], fill: col, part, role: 'node', uid: part, sem: { kind: 'node', id: part, shape: 'rhombus' } });
      const lb = T(ms.label, 13, 700, 220);
      items.push(txt({ x: x + 18, y: y - lb.h / 2, color: col, part }, lb));
    });
    m.markers.forEach((mk, k) => {
      const x = X(months(mk.at)), part = 'marker:' + (k + 1), col = mk.tone || 'bad';
      const lb = T(mk.label, 11, 700);
      items.push({ t: 'line', pts: [[x, 50 + 10], [x, top + m.tracks.length * rowH + 4]], stroke: col, sw: 2, dash: '5 4', r: 0, part, sem: { kind: 'deco' } });
      items.push({ t: 'rect', x: x - lb.w / 2 - 9, y: 38, w: lb.w + 18, h: 20, r: 10, fill: col, part, sem: { kind: 'deco' } });
      items.push(txt({ x, y: 48 - lb.lh / 2, anchor: 'middle', color: 'onSolid', part, on: col, noCheck: true }, lb));
    });
    const H = top + m.tracks.length * rowH + 28;
    return { w: W, h: H, title: cfg.title, items };
  }
})();

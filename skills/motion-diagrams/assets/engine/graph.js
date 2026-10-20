/* motion-diagrams engine: graph layout (architecture, flowchart, state, c4, org) with ELK layered.
 * Groups become ELK compound nodes; every edge is declared at the root with INCLUDE_CHILDREN so edges
 * between groups route; edge labels are inline so they sit on their line like pills.
 */
'use strict';
(function () {
  const MD = window.MD;
  const SPACING = {
    compact: { layer: 56, node: 28, edge: 12 },
    normal: { layer: 76, node: 40, edge: 16 },
    roomy: { layer: 104, node: 56, edge: 20 },
  };
  const DIRS = { right: 'RIGHT', down: 'DOWN', left: 'LEFT', up: 'UP' };

  MD.layoutGraph = async (m) => {
    m.edges.forEach(e => { if (e.step != null && e.from === e.to) throw new Error(`edge ${e.from} -> ${e.to}: a step edge can't loop`); });
    const cfg = m.config;
    const dir = DIRS[cfg.direction || (cfg.kind === 'org' ? 'down' : 'right')] || 'RIGHT';
    const vertical = dir === 'DOWN' || dir === 'UP';
    // compact (for a document page) tightens spacing whatever the script set
    const sp = SPACING[cfg.compact ? 'compact' : cfg.spacing] || SPACING.normal;
    const ids = new Set();
    const known = (id, what) => { if (ids.has(id)) throw new Error(`${what}: duplicate id "${id}"`); ids.add(id); };
    m.groups.forEach(g => known(g.id, 'group'));
    m.nodes.forEach(n => known(n.id, 'node'));
    const parentOf = o => o.in || o.parent || null;
    for (const o of [...m.groups, ...m.nodes]) {
      const p = parentOf(o);
      if (p && !m.groups.some(g => g.id === p)) throw new Error(`"${o.id}" is in "${p}", which is not a group. Groups: ${m.groups.map(g => g.id).join(', ') || 'none'}`);
    }
    for (const e of m.edges) for (const end of [e.from, e.to]) {
      if (!m.nodes.some(n => n.id === end) && !m.groups.some(g => g.id === end))
        throw new Error(`edge ${e.from} -> ${e.to}: no node or group "${end}"`);
    }

    // icons first (sizes don't depend on them, but drawing does)
    const icons = new Set();
    m.nodes.forEach(n => { if (n.icon) icons.add(n.icon); (n.steps || []).forEach(s => s && s.icon && icons.add(s.icon)); });
    m.groups.forEach(g => { const s = MD.groupStyle(g); if (s.icon) icons.add(s.icon); });
    for (const id of icons) await MD.loadIcon(id);

    const specs = {};
    m.nodes.forEach(n => (specs[n.id] = MD.nodeSpec(n, cfg)));

    const elkNode = n => {
      const s = specs[n.id];
      const o = { id: n.id, width: s.w, height: s.h, layoutOptions: {} };
      if (s.label) {
        o.labels = [{ text: n.label || n.id, width: s.label.w, height: s.label.h }];
        o.layoutOptions['elk.nodeLabels.placement'] = vertical ? 'OUTSIDE V_CENTER H_RIGHT' : 'OUTSIDE V_BOTTOM H_CENTER';
      }
      // edges with `step` leave a steps card from that step's row
      const stepEdges = m.edges.map((e, i) => ({ e, i })).filter(q => q.e.from === n.id && q.e.step != null);
      if (s.rowCenter && stepEdges.length) {
        o.ports = stepEdges.map(({ e, i }) => ({ id: `${n.id}__p${i}`, width: 1, height: 1, x: s.w, y: s.rowCenter(e.step - 1), layoutOptions: { 'elk.port.side': 'EAST' } }));
        // with fixed ports, incoming edges need ports too, or ELK parks them on the corner: they enter at the header
        const inEdges = m.edges.map((e, i) => ({ e, i })).filter(q => q.e.to === n.id);
        inEdges.forEach(({ i }, k) => o.ports.push({ id: `${n.id}__in${i}`, width: 1, height: 1, x: 0, y: s.headCenter + (k - (inEdges.length - 1) / 2) * 10, layoutOptions: { 'elk.port.side': 'WEST' } }));
        o.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      }
      if (n.layer === 'first') o.layoutOptions['elk.layered.layering.layerConstraint'] = 'FIRST';
      if (n.layer === 'last') o.layoutOptions['elk.layered.layering.layerConstraint'] = 'LAST';
      return o;
    };
    const elkGroup = g => {
      const hd = MD.groupHeader(g);
      return {
        id: g.id,
        layoutOptions: {
          'elk.padding': `[top=${hd.h + 18},left=22,bottom=22,right=22]`,
          'elk.nodeSize.constraints': 'MINIMUM_SIZE',
          'elk.nodeSize.minimum': `(${Math.ceil(hd.w + 20)}, 80)`,
        },
        children: inOrder(g.id),
      };
    };
    // children in the order the script declared them (ELK keeps model order where it can)
    const inOrder = pid => [...m.groups.filter(c => parentOf(c) === pid), ...m.nodes.filter(c => parentOf(c) === pid)]
      .sort((a, b) => a.seq - b.seq)
      .map(c => (m.groups.includes(c) ? elkGroup(c) : elkNode(c)));
    const edgeLabel = e => (e.label ? MD.text.block(e.label, 12, 500, 160) : null);
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': dir,
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(sp.layer),
        'elk.spacing.nodeNode': String(sp.node),
        'elk.spacing.edgeNode': String(Math.round(sp.node * 0.55)),
        'elk.spacing.edgeEdge': String(sp.edge),
        'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.round(sp.layer * 0.3)),
        'elk.layered.spacing.edgeEdgeBetweenLayers': String(sp.edge),
        'elk.spacing.labelNode': '8',
        'elk.spacing.edgeLabel': '4',
        'elk.spacing.componentComponent': String(sp.node * 1.5),
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        // loops in flows: reverse the edge written against the flow (only reliable without groups)
        ...(m.groups.length ? {} : { 'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER' }),        // straight: long chains (pipelines, step lists) stay on one line even when side edges pull at them
        'elk.layered.nodePlacement.strategy': { straight: 'LINEAR_SEGMENTS', balanced: 'BRANDES_KOEPF' }[cfg.placement] || 'NETWORK_SIMPLEX',
        'elk.layered.thoroughness': '30',
        'elk.padding': '[top=28,left=28,bottom=28,right=28]',
      },
      children: inOrder(null),
      edges: m.edges.map((e, i) => {
        const lb = edgeLabel(e);
        return {
          id: 'e' + i, sources: [e.step != null && specs[e.from] && specs[e.from].rowCenter ? `${e.from}__p${i}` : e.from], targets: [specs[e.to] && specs[e.to].rowCenter && m.edges.some(q => q.from === e.to && q.step != null) ? `${e.to}__in${i}` : e.to],
          labels: lb ? [{ text: e.label, width: lb.w + 18, height: lb.h + 6, layoutOptions: { 'elk.edgeLabels.inline': 'true', 'elk.edgeLabels.placement': 'CENTER' } }] : [],
        };
      }),
    };
    const elk = new window.ELK();
    const out = await elk.layout(graph);

    // absolute positions
    const abs = { root: { x: 0, y: 0 } };
    const walk = (node, ox, oy) => {
      for (const c of node.children || []) {
        abs[c.id] = { x: ox + c.x, y: oy + c.y, w: c.width, h: c.height, elk: c };
        walk(c, ox + c.x, oy + c.y);
      }
    };
    walk(out, 0, 0);

    const items = { groups: [], edges: [], nodes: [], labels: [] };
    // groups, outer first
    const depth = g => { let d = 0, p = parentOf(g); while (p) { d++; p = parentOf(m.groups.find(x => x.id === p)); } return d; };
    [...m.groups].sort((a, b) => depth(a) - depth(b)).forEach(g => {
      const a = abs[g.id];
      items.groups.push(...MD.drawGroup(g, a.x, a.y, a.w, a.h).map(i => Object.assign(i, { parent: parentOf(g) ? 'g:' + parentOf(g) : null })));
    });
    // nodes
    m.nodes.forEach(n => {
      const a = abs[n.id], s = specs[n.id];
      let drawn;
      if (s.label) {
        const L = (a.elk.labels || [])[0] || { x: (s.w - s.label.w) / 2, y: s.h + 8 };
        drawn = s.draw(a.x, a.y, a.x + L.x, a.y + L.y, vertical ? 'right' : 'below');
      } else drawn = s.draw(a.x, a.y);
      drawn.forEach(i => (i.parent = parentOf(n) ? 'g:' + parentOf(n) : null));
      items.nodes.push(...drawn);
    });
    // edges
    const seen = {};
    const uidOf = id => (m.groups.some(g => g.id === id) ? 'g:' : 'n:') + id;
    out.edges.forEach((oe, i) => {
      const e = m.edges[i];
      const off = abs[oe.container] || abs.root;
      const sec = (oe.sections || [])[0];
      if (!sec) return;
      let pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map(p => [p.x + off.x, p.y + off.y]);
      // org charts: a bus from the parent's centre, across, and into the child's centre
      if (cfg.kind === 'org' && dir === 'DOWN' && abs[e.from] && abs[e.to] && abs[e.to].y > abs[e.from].y) {
        const A = abs[e.from], B = abs[e.to], mid = (A.y + A.h + B.y) / 2;
        pts = [[A.x + A.w / 2, A.y + A.h], [A.x + A.w / 2, mid], [B.x + B.w / 2, mid], [B.x + B.w / 2, B.y]];
        if (Math.abs(pts[1][0] - pts[2][0]) < 1) pts = [pts[0], pts[3]];
      }
      // ELK attaches to the bounding box; pull ends onto a diamond's outline
      const clip = (end, id) => {
        const n = m.nodes.find(x => x.id === id), a = abs[id];
        if (!n || !a || !specs[id] || !['decision', 'choice'].includes(specs[id].shape) || pts.length < 2) return;
        const i = end ? pts.length - 1 : 0, j = end ? pts.length - 2 : 1;
        const cx = a.x + a.w / 2, cy = a.y + a.h / 2, P = a.w / 2, Q = a.h / 2;
        const [x, y] = pts[i], [nx, ny] = pts[j];
        if (Math.abs(y - ny) < 0.5) { const dy = Math.min(Math.abs(y - cy), Q * 0.98); pts[i] = [cx + Math.sign(x - cx || nx - cx) * P * (1 - dy / Q), y]; }
        else if (Math.abs(x - nx) < 0.5) { const dx = Math.min(Math.abs(x - cx), P * 0.98); pts[i] = [x, cy + Math.sign(y - cy || ny - cy) * Q * (1 - dx / P)]; }
      };
      clip(false, e.from);
      clip(true, e.to);
      let key = `edge:${e.from}>${e.to}`;
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] > 1) key += '#' + seen[key];
      const t = e.tone ? e.tone : 'edge';
      // arrow: 'start' lays the edge out from -> to but points back at `from` (e.g. egress drawn against the flow)
      const end = e.arrow === 'none' || e.arrow === 'start' ? null : 'arrow';
      const start = e.arrow === 'both' || e.arrow === 'start' ? 'arrow' : null;
      const uid = 'e:' + i;
      items.edges.push({ t: 'line', pts, stroke: t, sw: e.width || 1.6, dash: e.dashed ? true : e.dotted ? '2 4' : null, end, start, part: key, role: 'edge', uid, from: uidOf(e.from), to: uidOf(e.to), sem: { kind: 'edge', label: e.label || '' } });
      // numbered badge near the start of a step edge: opt-in with Diagram.config({ stepBadges: true })
      if (e.step != null && cfg.stepBadges && pts.length > 1) {
        const [x0, y0] = pts[0], [x1, y1] = pts[1], L0 = Math.hypot(x1 - x0, y1 - y0) || 1;
        const k = Math.min(22, L0 / 2), bx = x0 + (x1 - x0) / L0 * k, by = y0 + (y1 - y0) / L0 * k;
        const nb = MD.text.block(String(e.step), 10.5, 700);
        items.labels.push({ t: 'ellipse', cx: bx, cy: by, rx: 10, ry: 10, fill: 'accent', part: key, badge: true, sem: { kind: 'deco' } });
        items.labels.push({ t: 'text', x: bx, y: by - nb.lh / 2, lines: nb.lines, w: nb.w, size: 10.5, weight: 700, lh: nb.lh, color: 'onSolid', anchor: 'middle', part: key, noCheck: true });
      }
      const L = (oe.labels || [])[0];
      if (L && e.label) {
        const lb = MD.text.block(e.label, 12, 500, 160);
        const x = L.x + off.x, y = L.y + off.y;
        items.labels.push({ t: 'rect', x, y, w: L.width, h: L.height, r: Math.min(11, L.height / 2), fill: 'bg', stroke: 'line', sw: 1, part: key, role: 'node', uid: 'l:' + i, edgeOk: true, boundTo: uid, sem: { kind: 'edgeLabel' } });
        items.labels.push({ t: 'text', x: x + L.width / 2, y: y + (L.height - lb.h) / 2, lines: lb.lines, w: lb.w, size: 12, weight: 500, lh: lb.lh, color: e.tone && e.tone !== 'edge' ? e.tone : 'dim', anchor: 'middle', part: key, fit: 'l:' + i, boundTo: uid, edgeOk: true });
      }
    });
    // A group title an edge runs through moves to the group's other top corner when that side is clear.
    const hits = r => items.edges.some(l => l.pts.some((p, k) => {
      if (k === l.pts.length - 1) return false;
      const q = l.pts[k + 1];
      return Math.min(p[0], q[0]) < r.x + r.w && Math.max(p[0], q[0]) > r.x && Math.min(p[1], q[1]) < r.y + r.h && Math.max(p[1], q[1]) > r.y;
    }));
    for (const g of m.groups) {
      const part = 'group:' + g.id;
      const box = items.groups.find(i => i.part === part && i.role === 'group');
      const txt = items.groups.find(i => i.part === part && i.t === 'text');
      const ico = items.groups.find(i => i.part === part && i.t === 'image');
      if (!box || !txt) continue;
      const left = { x: box.x, y: box.y, w: txt.x + txt.w - box.x + 4, h: 26 };
      if (!hits(left)) continue;
      const iw = ico ? 32 : 12;
      const right = { x: box.x + box.w - txt.w - iw - 4, y: box.y, w: txt.w + iw + 4, h: 26 };
      if (right.x <= left.x + left.w || hits(right)) continue;
      if (ico) ico.x = box.x + box.w - 24;
      txt.x = box.x + box.w - iw - txt.w;
    }
    return { w: out.width, h: out.height, title: cfg.title, items: [...items.groups, ...items.edges, ...items.nodes, ...items.labels] };
  };
})();

/* motion-diagrams engine: grid layout for architecture diagrams (AWS reference style).
 *
 *   One group is the grid (grid: true, usually the VPC). Inside it, tiers are columns (public, app, data
 *   subnets) and zones are rows (Availability Zones), always in the order declared: AZ a above AZ b.
 *   Each tier x zone is a subnet cell (tier preset, "Public subnet · 10.0.0.0/24"). A node sits in a cell
 *   (cell: [tier, zone]), spans a tier across zones (tier only: drawn in the gap between the zone bands,
 *   like a load balancer), or straddles its group's border (at: 'left' | 'right', like an internet gateway).
 *   Every other group packs its children around its main child in bands (band: 'left' | 'right' | 'top' |
 *   'bottom'). Edges are routed orthogonally around every node and label.
 */
'use strict';
(function () {
  const MD = window.MD;
  const T = (...a) => MD.text.block(...a);
  const PAD = 22, CELL_HEAD = 36, NODE_GAP = 40, GROUP_HEAD = 40;
  let COL_GAP = 64, BAND_GAP = 56;

  MD.layoutGrid = async (m) => {
    const cfg = m.config;
    // compact (a document page): tighter gaps, same orientation
    COL_GAP = cfg.compact ? 50 : 64; BAND_GAP = cfg.compact ? 42 : 56;
    const gridG = m.groups.find(g => g.grid);
    if (!gridG) throw new Error("grid layout: mark the group that holds the subnets with grid: true (usually the VPC)");
    if (!m.zones.length || !m.tiers.length) throw new Error('grid layout: declare Diagram.zone(...) rows and Diagram.tier(...) columns');
    const parentOf = o => o.in || o.parent || null;
    const zoneIx = {}, tierIx = {};
    m.zones.forEach((z, i) => (zoneIx[z.id] = i));
    m.tiers.forEach((t, i) => (tierIx[t.id] = i));
    for (const n of m.nodes) {
      const [t, z] = n.cell || [n.tier, n.zone];
      if (n.cell || n.tier) {
        if (tierIx[t] == null) throw new Error(`node "${n.id}": no tier "${t}". Tiers: ${m.tiers.map(x => x.id).join(', ')}`);
        if (z != null && zoneIx[z] == null) throw new Error(`node "${n.id}": no zone "${z}". Zones: ${m.zones.map(x => x.id).join(', ')}`);
        n._t = t; n._z = z == null ? null : z;
      }
    }
    // an edge end can be a node, a group, or a subnet cell written "tier.zone" (e.g. 'data.a')
    const isCell = id => { const [t, z] = String(id).split('.'); return tierIx[t] != null && zoneIx[z] != null && String(id).includes('.'); };
    for (const e of m.edges) for (const end of [e.from, e.to]) if (!m.nodes.some(n => n.id === end) && !m.groups.some(g => g.id === end) && !isCell(end)) throw new Error(`edge ${e.from} -> ${e.to}: no node, group or cell "${end}" (cells are written tier.zone, e.g. 'data.a')`);
    const cellBox = {};
    // which sides of the grid get a bracket (an edge between zones within the first or last tier)
    const endTier = id => (isCell(id) ? String(id).split('.')[0] : (m.nodes.find(n => n.id === id) || {})._t);
    const endZone = id => (isCell(id) ? String(id).split('.')[1] : (m.nodes.find(n => n.id === id) || {})._z);
    const bracketSides = () => m.edges.filter(e => !e.sides && endTier(e.from) && endTier(e.from) === endTier(e.to) && endZone(e.from) && endZone(e.to) && endZone(e.from) !== endZone(e.to))
      .map(e => (tierIx[endTier(e.from)] === m.tiers.length - 1 ? 'E' : 'W'));

    // icons
    const icons = new Set();
    m.nodes.forEach(n => { if (n.icon) icons.add(n.icon); (n.steps || []).forEach(s => s && s.icon && icons.add(s.icon)); });
    m.groups.forEach(g => { const s = MD.groupStyle(g); if (s.icon) icons.add(s.icon); });
    m.tiers.forEach(t => { const s = MD.groupStyle({ id: t.id, preset: t.preset, label: '' }); if (s.icon) icons.add(s.icon); });
    if (m.zones.some(z => z.preset)) m.zones.forEach(z => { const s = MD.groupStyle({ id: z.id, preset: z.preset || 'aws.az' }); if (s.icon) icons.add(s.icon); });
    for (const id of icons) await MD.loadIcon(id);

    const specs = {}, foot = {};
    m.nodes.forEach(n => {
      const s = (specs[n.id] = MD.nodeSpec(n, cfg));
      foot[n.id] = s.label ? { w: Math.max(s.w, s.label.w), h: s.h + 8 + s.label.h } : { w: s.w, h: s.h };
    });
    const pos = {};   // node id -> {x, y} of its footprint's top-left
    const box = {};   // group id -> {x, y, w, h}

    // ------------------------------------------------ the grid block (relative to its own origin)
    const cellNodes = (t, z) => m.nodes.filter(n => n._t === t && n._z === z);
    const spanNodes = t => m.nodes.filter(n => n._t === t && n._z == null);
    // nodes in a cell stack in a column (each faces the neighbouring tiers with its own line); stack: 'row' lines them up
    const stackRow = t => m.tiers[tierIx[t]].stack === 'row';
    const STACK_GAP = 30;
    const cellSize = (t, z) => {
      const ns = cellNodes(t, z);
      const head = T(cellLabel(t, z), 12.5, 600, 400);
      const row = stackRow(t);
      const inW = row ? ns.reduce((s, n) => s + foot[n.id].w, 0) + Math.max(0, ns.length - 1) * NODE_GAP : Math.max(0, ...ns.map(n => foot[n.id].w));
      const inH = row ? Math.max(0, ...ns.map(n => foot[n.id].h)) : ns.reduce((s, n) => s + foot[n.id].h, 0) + Math.max(0, ns.length - 1) * STACK_GAP;
      const w = Math.max(head.w + 50, inW + 2 * PAD + 20, 190);
      const h = CELL_HEAD + inH + PAD + 6;
      return { w, h: Math.max(h, 130) };
    };
    const cellLabel = (t, z) => {
      const tier = m.tiers[tierIx[t]], cidr = tier.cidr && tier.cidr[z];
      return (tier.cellLabel || tier.label || t) + (cidr ? ' · ' + cidr : '');
    };
    const colW = m.tiers.map(t => Math.max(...m.zones.map(z => cellSize(t.id, z.id).w), ...spanNodes(t.id).map(n => foot[n.id].w + 2 * PAD)));
    const rowH = m.zones.map(z => Math.max(...m.tiers.map(t => cellSize(t.id, z.id).h)));
    const spanH = Math.max(0, ...m.tiers.flatMap(t => spanNodes(t.id).map(n => foot[n.id].h)));
    const zoneHead = 30;
    const zGap = spanH ? spanH + 34 : 26;
    const colX = [], rowY = [];
    let x = 14;
    colW.forEach((w, i) => { colX[i] = x; x += w + COL_GAP; });
    const gridW = x - COL_GAP + 14;
    let y = 0;
    rowH.forEach((h, i) => { rowY[i] = y + zoneHead; y += zoneHead + h + 14 + (i < rowH.length - 1 ? zGap : 0); });
    const gridH = y;
    const gridItems = (ox, oy) => {
      const items = [];
      m.zones.forEach((z, zi) => {
        const zg = { id: 'zone-' + z.id, preset: z.preset || 'aws.az', label: z.label || z.id };
        items.push(...MD.drawGroup(zg, ox, oy + rowY[zi] - zoneHead, gridW, zoneHead + rowH[zi] + 14).map(i => Object.assign(i, { part: 'zone:' + z.id, parent: 'g:' + gridG.id })));
      });
      m.tiers.forEach((t, ti) => m.zones.forEach((z, zi) => {
        const cg = { id: t.id + '-' + z.id, preset: t.preset, color: t.color, fill: t.fill, label: cellLabel(t.id, z.id) };
        items.push(...MD.drawGroup(cg, ox + colX[ti], oy + rowY[zi], colW[ti], rowH[zi]).map(i => Object.assign(i, { parent: 'g:' + gridG.id })));
        cellBox[t.id + '.' + z.id] = { x: ox + colX[ti], y: oy + rowY[zi], w: colW[ti], h: rowH[zi] };
        const ns = cellNodes(t.id, z.id);
        const cy = oy + rowY[zi] + CELL_HEAD + (rowH[zi] - CELL_HEAD - PAD) / 2 + 3;
        const cx = ox + colX[ti] + colW[ti] / 2;
        if (stackRow(t.id)) {
          const used = ns.reduce((s, n) => s + foot[n.id].w, 0) + Math.max(0, ns.length - 1) * NODE_GAP;
          let nx = cx - used / 2;
          ns.forEach(n => { pos[n.id] = { x: nx, y: cy - foot[n.id].h / 2, parent: 'g:' + cg.id }; nx += foot[n.id].w + NODE_GAP; });
        } else {
          const used = ns.reduce((s, n) => s + foot[n.id].h, 0) + Math.max(0, ns.length - 1) * STACK_GAP;
          let ny = cy - used / 2;
          ns.forEach(n => { pos[n.id] = { x: cx - foot[n.id].w / 2, y: ny, parent: 'g:' + cg.id }; ny += foot[n.id].h + STACK_GAP; });
        }
      }));
      // spanning nodes sit in the gap between the zone bands, centred on their tier
      m.tiers.forEach((t, ti) => spanNodes(t.id).forEach((n, k, all) => {
        const gapTop = oy + rowY[0] + rowH[0] + 14, mid = gapTop + zGap / 2;
        const used = all.reduce((s, q) => s + foot[q.id].w, 0) + (all.length - 1) * NODE_GAP;
        const nx = ox + colX[ti] + (colW[ti] - used) / 2 + all.slice(0, k).reduce((s, q) => s + foot[q.id].w + NODE_GAP, 0);
        pos[n.id] = { x: nx, y: mid - foot[n.id].h / 2, parent: 'g:' + gridG.id };
      }));
      return items;
    };

    // ------------------------------------------------ packing groups around their main child
    const childrenOf = id => [...m.groups.filter(g => parentOf(g) === id), ...m.nodes.filter(n => parentOf(n) === id && !n._t)];
    const contains = (g, target) => { let p = target; while (p) { if (p === g.id) return true; const pg = m.groups.find(x => x.id === p); p = pg ? parentOf(pg) : null; } return false; };
    const isGroup = c => m.groups.includes(c);
    // returns {w, h, draw(ox, oy) -> items}
    const pack = (g) => {
      if (g && g.grid) {
        const hd = MD.groupHeader(g);
        // portrait layouts put border nodes on the top border instead, so nothing widens the drawing
        const atT = cfg.portrait ? m.nodes.filter(n => parentOf(n) === g.id && n.at) : [];
        const atL = cfg.portrait ? [] : m.nodes.filter(n => parentOf(n) === g.id && n.at === 'left');
        const atR = cfg.portrait ? [] : m.nodes.filter(n => parentOf(n) === g.id && n.at === 'right');
        const lane = side => (bracketSides().includes(side) ? 44 : 0);
        const innerL = 24 + lane('W') + (atL.length ? Math.max(...atL.map(n => foot[n.id].w)) / 2 + 12 : 0);
        const innerR = 24 + lane('E') + (atR.length ? Math.max(...atR.map(n => foot[n.id].w)) / 2 + 12 : 0);
        const w = Math.max(hd.w + 30, innerL + gridW + innerR), h = GROUP_HEAD + gridH + 24;
        return {
          w, h, draw(ox, oy) {
            box[g.id] = { x: ox, y: oy, w, h };
            const items = MD.drawGroup(g, ox, oy, w, h).map(i => Object.assign(i, { parent: parentOf(g) ? 'g:' + parentOf(g) : null }));
            items.push(...gridItems(ox + innerL, oy + GROUP_HEAD));
            // the icon straddles the border; its label (above) runs into the group, keeping the outside approach clear
            const place = (list, edgeX, side) => list.forEach((n, k) => {
              const iconX = edgeX - specs[n.id].w / 2;
              pos[n.id] = { x: side === 'left' ? iconX : iconX + specs[n.id].w - foot[n.id].w, iconX, side,
                y: oy + GROUP_HEAD + gridH / 2 - foot[n.id].h / 2 + (k - (list.length - 1) / 2) * (foot[n.id].h + 30), parent: 'g:' + g.id };
            });
            place(atL, ox, 'left');
            place(atR, ox + w, 'right');
            // on the top border, clear of the group's own title, label to the right of the icon
            let tx = ox + Math.max(hd.w + 70, innerL + colX[0] + colW[0] / 2);
            topBorder.push({ g, ox, w, min: ox + hd.w + 70, nodes: atT });
            atT.forEach(n => {
              const sw = specs[n.id].w;
              pos[n.id] = { x: tx - sw / 2, iconX: tx - sw / 2, y: oy - specs[n.id].h / 2, side: 'top', parent: 'g:' + g.id };
              tx += sw + (specs[n.id].label ? specs[n.id].label.w : 0) + 60;
            });
            return items;
          },
        };
      }
      const kids = childrenOf(g ? g.id : null);
      // a group of plain nodes off the grid's path (regional services, a toolchain): one row, or a column
      if (g && !contains(g, gridG.id) && kids.every(c => !isGroup(c))) {
        const hd = MD.groupHeader(g), vert = g.flow === 'column' && !cfg.portrait;
        const gap = 44;
        const inW = vert ? Math.max(...kids.map(c => foot[c.id].w)) : kids.reduce((s, c) => s + foot[c.id].w, 0) + (kids.length - 1) * gap;
        const inH = vert ? kids.reduce((s, c) => s + foot[c.id].h, 0) + (kids.length - 1) * 30 : Math.max(...kids.map(c => foot[c.id].h));
        const w = Math.max(hd.w + 30, inW + 48), h = GROUP_HEAD + inH + 24;
        return {
          w, h, draw(ox, oy) {
            box[g.id] = { x: ox, y: oy, w, h };
            const items = MD.drawGroup(g, ox, oy, w, h).map(i => Object.assign(i, { parent: parentOf(g) ? 'g:' + parentOf(g) : null }));
            let x = ox + (w - inW) / 2, y = oy + GROUP_HEAD;
            kids.forEach(c => {
              if (vert) { pos[c.id] = { x: ox + (w - foot[c.id].w) / 2, y, parent: 'g:' + g.id }; y += foot[c.id].h + 30; }
              else { pos[c.id] = { x, y: y + (inH - foot[c.id].h) / 2, parent: 'g:' + g.id }; x += foot[c.id].w + gap; }
            });
            return items;
          },
        };
      }
      const main = kids.find(c => isGroup(c) && (c.grid || contains(c, gridG.id))) || kids.find(isGroup) || kids[0];
      const bands = { left: [], right: [], top: [], bottom: [] };
      // portrait (only when a tall picture is wanted): side bands move above and below, so it grows down, not across
      const bandOf = c => { const b = c.band || (isGroup(c) ? 'bottom' : 'left'); return cfg.portrait ? ({ left: 'top', right: 'bottom' }[b] || b) : b; };
      kids.filter(c => c !== main).forEach(c => bands[bandOf(c)].push(c));
      const sizeOf = c => (isGroup(c) ? pack(c) : { w: foot[c.id].w, h: foot[c.id].h, node: true });
      const P = main ? sizeOf(main) : { w: 0, h: 0 };
      const S = {};
      for (const k in bands) S[k] = bands[k].map(c => ({ c, s: sizeOf(c) }));
      const colWd = list => (list.length ? Math.max(...list.map(q => q.s.w)) : 0);
      const colHt = list => list.reduce((a, q) => a + q.s.h, 0) + Math.max(0, list.length - 1) * 36;
      const RGAP = cfg.portrait ? 72 : 40;   // room for a label between neighbours in a row
      const rowWd = list => list.reduce((a, q) => a + q.s.w, 0) + Math.max(0, list.length - 1) * RGAP;
      const rowHt = list => (list.length ? Math.max(...list.map(q => q.s.h)) : 0);
      const lW = colWd(S.left), rW = colWd(S.right), tH = rowHt(S.top), bH = rowHt(S.bottom);
      const midW = Math.max(P.w, rowWd(S.top), rowWd(S.bottom));
      const midH = Math.max(P.h, colHt(S.left), colHt(S.right));
      const head = g ? GROUP_HEAD : 0, pad = g ? 24 : 0;
      const hd = g ? MD.groupHeader(g) : { w: 0 };
      const w = Math.max(hd.w + 30, pad * 2 + (lW ? lW + BAND_GAP : 0) + midW + (rW ? rW + BAND_GAP : 0));
      const h = head + pad + (tH ? tH + BAND_GAP : 0) + midH + (bH ? bH + BAND_GAP : 0) + pad;
      return {
        w, h, draw(ox, oy) {
          const items = [];
          if (g) {
            box[g.id] = { x: ox, y: oy, w, h };
            items.push(...MD.drawGroup(g, ox, oy, w, h).map(i => Object.assign(i, { parent: parentOf(g) ? 'g:' + parentOf(g) : null })));
          }
          const x0 = ox + pad + (lW ? lW + BAND_GAP : 0), y0 = oy + head + pad + (tH ? tH + BAND_GAP : 0);
          const put = (c, s, x, y) => {
            if (s.node) pos[c.id] = { x, y, parent: g ? 'g:' + g.id : null };
            else items.push(...s.draw(x, y));
          };
          if (main) put(main, P, x0 + (midW - P.w) / 2, y0 + (midH - P.h) / 2);
          const col = (list, x, wcol) => { let y = y0 + (midH - colHt(list)) / 2; list.forEach(q => { put(q.c, q.s, x + (wcol - q.s.w) / 2, y); y += q.s.h + 36; }); };
          // portrait rows start at the left, so the request path runs down the left side
          const row = (list, y, hrow) => { let x = cfg.portrait ? x0 : x0 + (midW - rowWd(list)) / 2; list.forEach(q => { put(q.c, q.s, x, y + (hrow - q.s.h) / 2); x += q.s.w + RGAP; }); };
          col(S.left, ox + pad, lW);
          col(S.right, x0 + midW + BAND_GAP, rW);
          row(S.top, oy + head + pad, tH);
          row(S.bottom, y0 + midH + BAND_GAP, bH);
          return items;
        },
      };
    };
    // a group that isn't on the path to the grid lays its children out in a row
    const packRow = pack;
    const topBorder = [];
    const root = packRow(null);
    const groupItems = root.draw(28, 28);
    // a node on a top border lines up under the outside node it connects to (CloudFront above the gateway)
    for (const tb of topBorder) for (const n of tb.nodes) {
      const other = m.edges.map(e => (e.to === n.id ? e.from : e.from === n.id ? e.to : null)).find(id => id && pos[id] && !contains(tb.g, (m.nodes.find(q => q.id === id) || {}).in));
      if (!other) continue;
      const sw = specs[n.id].w, cx = pos[other].x + foot[other].w / 2;
      const lw = specs[n.id].label ? specs[n.id].label.w + 8 : 0;
      const x = Math.max(tb.min, Math.min(tb.ox + tb.w - sw - lw - 16, cx - sw / 2));
      pos[n.id].x = pos[n.id].iconX = x;
    }

    // ------------------------------------------------ nodes
    const nodeItems = [];
    const iconBox = {}, footBox = {}, labelBox = {};
    m.nodes.forEach(n => {
      const p = pos[n.id];
      if (!p) throw new Error(`node "${n.id}" has no place: give it a cell, a tier, or put it in a group`);
      const s = specs[n.id], f = foot[n.id];
      const ix = p.iconX != null ? p.iconX : p.x + (f.w - s.w) / 2;
      // a node on a group's border keeps its label above the icon, off the border line and the edges
      if (p.side === 'top') {   // on a top border: icon on the line, label to its right
        const ly = p.y + s.h / 2 - (s.label ? s.label.h + 6 : 0);   // above the border line, right of the icon
        iconBox[n.id] = { x: ix, y: p.y, w: s.w, h: s.h };
        footBox[n.id] = { x: ix, y: p.y, w: s.w + (s.label ? 8 + s.label.w : 0), h: s.h };
        labelBox[n.id] = s.label ? { x: ix + s.w + 6, y: ly - 1, w: s.label.w + 4, h: s.label.h + 2 } : null;
        const drawnT = s.label ? s.draw(ix, p.y, ix + s.w + 8, ly, 'right') : s.draw(ix, p.y);
        drawnT.forEach(i => (i.parent = p.parent));
        nodeItems.push(...drawnT);
        return;
      }
      const above = !!n.at && s.label;
      const iy = above ? p.y + s.label.h + 8 : p.y;
      const lx = !s.label ? 0 : p.side === 'left' ? ix : p.side === 'right' ? ix + s.w - s.label.w : p.x + (f.w - s.label.w) / 2;
      iconBox[n.id] = { x: ix, y: iy, w: s.w, h: s.h };
      footBox[n.id] = { x: p.x, y: p.y, w: f.w, h: f.h };
      labelBox[n.id] = s.label ? { x: lx - 2, y: above ? p.y : iy + s.h + 6, w: s.label.w + 4, h: s.label.h + 2 } : null;
      const drawn = s.label ? s.draw(ix, iy, lx, above ? p.y : iy + s.h + 8, 'below') : s.draw(ix, iy);
      drawn.forEach(i => (i.parent = p.parent));
      nodeItems.push(...drawn);
    });

    // ------------------------------------------------ edges
    const W = root.w + 56, H = root.h + 56;
    const obstacles = m.nodes.map(n => ({ id: n.id, ...footBox[n.id] }));
    // Group titles are knocked out: drawn above the lines on a chip of their group's colour, so a line that
    // has to enter a subnet passes behind its title. The router still prefers to go around them.
    const headers = groupItems.filter(i => i.t === 'text').map(t => {
      const g = groupItems.find(r => r.part === t.part && r.role === 'group');
      return { id: '#h', x: t.x - 34, y: t.y - 4, w: t.w + 38, h: t.lines.length * t.lh + 6, g, t };
    });
    const knock = [];
    headers.forEach(hh => {
      const fill = hh.g && hh.g.fill && hh.g.fill !== 'none' ? hh.g.fill : 'bg';
      groupItems.splice(groupItems.indexOf(hh.t), 1);
      knock.push({ t: 'rect', x: hh.t.x - 4, y: hh.t.y - 1, w: hh.t.w + 8, h: hh.t.lines.length * hh.t.lh + 2, r: 3, fill, part: hh.t.part, sem: { kind: 'deco' } });
      knock.push(Object.assign(hh.t, { edgeOk: true }));
    });
    const within = (b, g) => g && b.x >= g.x && b.y >= g.y && b.x + b.w <= g.x + g.w && b.y + b.h <= g.y + g.h;
    const endBox = id => iconBox[id] || box[id] || cellBox[id];
    const tierOf = id => { if (cellBox[id]) return id.split('.')[0]; const n = m.nodes.find(q => q.id === id); return n && n._t; };
    const zoneOf = id => { if (cellBox[id]) return id.split('.')[1]; const n = m.nodes.find(q => q.id === id); return n && n._z; };
    const areaOf = id => box[id] || cellBox[id];
    const edgeItems = [], labelItems = [], routed = [];
    const placedLabels = [], labelJobs = [], jobs = [];
    m.edges.forEach((e, i) => {
      const A = endBox(e.from), B = endBox(e.to);
      const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
      const dx = cb[0] - ca[0], dy = cb[1] - ca[1];
      let sides = Math.abs(dx) >= Math.abs(dy) * 0.7 ? (dx > 0 ? ['E', 'W'] : ['W', 'E']) : (dy > 0 ? ['S', 'N'] : ['N', 'S']);
      const ta = tierOf(e.from), tb = tierOf(e.to);
      // between tiers: always leave sideways, climb in the gap between columns, enter from the side
      if (ta && tb && ta !== tb) sides = tierIx[tb] > tierIx[ta] ? ['E', 'W'] : ['W', 'E'];
      // same tier, different zones (primary -> standby): a bracket down the outer side of the cells
      if (ta && ta === tb && zoneOf(e.from) && zoneOf(e.to) && zoneOf(e.from) !== zoneOf(e.to))
        sides = tierIx[ta] === m.tiers.length - 1 ? ['E', 'E'] : ['W', 'W'];
      if (e.sides) sides = e.sides;
      // a node's S port is under its label (N above it for nodes labelled above)
      const portBox = (id, side) => {
        const n = m.nodes.find(q => q.id === id);
        if (n && n.at && cfg.portrait) return endBox(id);
        if (side === 'S' && footBox[id] && !(n && n.at)) return footBox[id];
        if (side === 'N' && footBox[id] && n && n.at) return footBox[id];
        return endBox(id);
      };
      const Ab = portBox(e.from, sides[0]), Bb = portBox(e.to, sides[1]);
      const fa = footBox[e.from], fb = footBox[e.to];
      // an edge between zones has to enter the other zone's cells: let it pass behind their (knocked-out) titles
      const crossZone = zoneOf(e.from) && zoneOf(e.to) && zoneOf(e.from) !== zoneOf(e.to);
      const obs = [
        ...obstacles.filter(o => o.id !== e.from && o.id !== e.to && !(areaOf(e.from) && inside(o, areaOf(e.from))) && !(areaOf(e.to) && inside(o, areaOf(e.to)))),
        ...headers.filter(hh => !(fa && within(fa, hh.g)) && !(fb && within(fb, hh.g)) && !crossZone),
        ...[labelBox[e.from], labelBox[e.to]].filter(Boolean),   // never through an endpoint's own label
      ];
      const pts = MD.route(Ab, Bb, sides, obs, routed, { w: W, h: H, headW: 0 });
      routed.push(pts);
      jobs.push({ Ab, Bb, sides, obs });
      const part = `edge:${e.from}>${e.to}`, uid = 'e:' + i;
      const end = e.arrow === 'none' || e.arrow === 'start' ? null : 'arrow';
      const start = e.arrow === 'both' || e.arrow === 'start' ? 'arrow' : null;
      const uidOf = id => (cellBox[id] ? 'g:' + id.replace('.', '-') : (m.groups.some(g => g.id === id) ? 'g:' : 'n:') + id);
      edgeItems.push({ t: 'line', pts, stroke: e.tone || 'edge', sw: e.width || 1.6, dash: e.dashed ? true : e.dotted ? '2 4' : null, end, start, part, role: 'edge', uid, from: uidOf(e.from), to: uidOf(e.to), sem: { kind: 'edge', label: e.label || '' } });
      if (e.label) labelJobs.push({ e, i, pts, part, uid, room: Math.max(...pts.slice(0, -1).map((q, k) => Math.hypot(pts[k + 1][0] - q[0], pts[k + 1][1] - q[1]))) });
    });
    // second pass: a line that crosses others is routed again with crossings priced in; kept only if it crosses less
    const crossCount = (pts, others) => others.reduce((n, o) => n + pts.slice(0, -1).reduce((c, p, k) => c + o.slice(0, -1).filter((q, j) => MD.perpCross(p, pts[k + 1], q, o[j + 1])).length, 0), 0);
    for (let pass = 0; pass < 2; pass++) jobs.forEach((j, i) => {
      const others = routed.filter((_, k) => k !== i);
      const before = crossCount(routed[i], others);
      if (!before) return;
      const alt = MD.route(j.Ab, j.Bb, j.sides, j.obs, others, { w: W, h: H, headW: 0, cross: others });
      if (crossCount(alt, others) < before) {
        routed[i] = alt;
        edgeItems[i].pts = alt;
        labelJobs.filter(l => l.i === i).forEach(l => { l.pts = alt; l.room = Math.max(...alt.slice(0, -1).map((q, k) => Math.hypot(alt[k + 1][0] - q[0], alt[k + 1][1] - q[1]))); });
      }
    });
    // labels for the most constrained lines (shortest straight stretch) go first, so they get the spots they need
    labelJobs.sort((u, v) => u.room - v.room).forEach(({ e, i, pts, part, uid }) => {
        const lb = T(e.label, 12, 500, 170);
      const segs = pts.slice(0, -1).map((p, k) => ({ a: p, b: pts[k + 1], L: Math.hypot(pts[k + 1][0] - p[0], pts[k + 1][1] - p[1]) })).sort((u, v) => v.L - u.L);
      let best = null;
      for (const s of segs) {
        if (s.L < lb.w * 0.6 && s.a[1] === s.b[1]) continue;          // too short to carry it
        for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
          const mx = s.a[0] + (s.b[0] - s.a[0]) * f, my = s.a[1] + (s.b[1] - s.a[1]) * f;
          const r = { x: mx - lb.w / 2 - 9, y: my - lb.h / 2 - 3, w: lb.w + 18, h: lb.h + 6 };
          if (![...obstacles, ...headers, ...placedLabels].some(o => ov(o, r))) { best = r; break; }
        }
        if (best) break;
      }
      // nothing free on the line: beside it (above/below a horizontal stretch, left/right of a vertical one)
      if (!best) for (const s of segs) {
        const horiz = Math.abs(s.a[1] - s.b[1]) < 0.5, mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2;
        const W2 = lb.w + 18, H2 = lb.h + 6;
        const cands = [];
        for (const d of [6, 24, 48]) cands.push(...(horiz ? [[mx - W2 / 2, my - H2 - d], [mx - W2 / 2, my + d]] : [[mx + d + 2, my - H2 / 2], [mx - W2 - d - 2, my - H2 / 2]]));
        // a short segment: in line with it, just before it starts or just after it ends
        if (horiz) cands.push([Math.min(s.a[0], s.b[0]) - W2 - 4, my - H2 / 2], [Math.max(s.a[0], s.b[0]) + 4, my - H2 / 2]);
        else cands.push([mx - W2 / 2, Math.min(s.a[1], s.b[1]) - H2 - 4], [mx - W2 / 2, Math.max(s.a[1], s.b[1]) + 4]);
        for (const f of [0.25, 0.75]) {
          const px = s.a[0] + (s.b[0] - s.a[0]) * f, py = s.a[1] + (s.b[1] - s.a[1]) * f;
          cands.push(...(horiz ? [[px - W2 / 2, py - H2 - 6], [px - W2 / 2, py + 6]] : [[px + 8, py - H2 / 2], [px - W2 - 8, py - H2 / 2]]));
        }
        for (const [x0, y0] of cands) { const r = { x: x0, y: y0, w: W2, h: H2 }; if (![...obstacles, ...headers, ...placedLabels].some(o => ov(o, r))) { best = r; break; } }
        if (best) break;
      }
      if (!best) { const s = segs[0]; const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2; best = { x: mx - lb.w / 2 - 9, y: my - lb.h / 2 - 3, w: lb.w + 18, h: lb.h + 6 }; }
      placedLabels.push(best);
      labelItems.push({ t: 'rect', ...best, r: Math.min(11, best.h / 2), fill: 'bg', stroke: 'line', sw: 1, part, role: 'node', uid: 'l:' + i, edgeOk: true, boundTo: uid, sem: { kind: 'edgeLabel' } });
      labelItems.push({ t: 'text', x: best.x + best.w / 2, y: best.y + 3, lines: lb.lines, w: lb.w, size: 12, weight: 500, lh: lb.lh, color: e.tone && e.tone !== 'edge' ? e.tone : 'dim', anchor: 'middle', part, fit: 'l:' + i, boundTo: uid, edgeOk: true });
    });
    return { w: W, h: H, title: cfg.title, items: [...groupItems, ...edgeItems, ...knock, ...nodeItems, ...labelItems] };
  };
  const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
})();

/* motion-diagrams engine: editable exports from the scene (light theme).
 *  .drawio      mxGraph XML: groups are containers, nodes carry their labels, edges are bound to nodes
 *               (exit/entry points kept) with the layout's waypoints; icons as embedded images.
 *  .excalidraw  clean style (roughness 0, Helvetica): shapes with bound text, arrows bound to shapes,
 *               icons as embedded image files.
 */
'use strict';
(function () {
  const MD = window.MD;
  const TH = () => MD.THEMES.light;
  const C = v => MD.resolve(v, TH());
  const esc = MD.esc;
  const r1 = n => Math.round(n * 10) / 10;

  // ---------------------------------------------------------------- shared reading of the scene
  function read(scene) {
    const byUid = {}, bound = {};
    for (const it of scene.items) if (it.uid && !byUid[it.uid] && (it.role === 'node' || it.role === 'group' || it.role === 'nodeText')) byUid[it.uid] = it;
    // edges (lines with a uid) own their label texts and pills too
    for (const it of scene.items) if (it.t === 'line' && it.uid && !byUid[it.uid]) byUid[it.uid] = it;
    for (const it of scene.items) if (it.boundTo && byUid[it.boundTo] && byUid[it.boundTo] !== it) (bound[it.boundTo] = bound[it.boundTo] || []).push(it);
    return { byUid, bound };
  }
  const bbox = it => {
    if (it.t === 'ellipse') return { x: it.cx - it.rx, y: it.cy - it.ry, w: 2 * it.rx, h: 2 * it.ry };
    if (it.t === 'poly' || it.t === 'line') { const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
    if (it.t === 'text') return { x: it.anchor === 'middle' ? it.x - it.w / 2 : it.anchor === 'end' ? it.x - it.w : it.x, y: it.y, w: it.w, h: it.lines.length * it.lh };
    if (it.x != null && it.w != null) return { x: it.x, y: it.y, w: it.w, h: it.h };
    return null;
  };
  const onBorder = (p, b, tol = 4) => b && p[0] >= b.x - tol && p[0] <= b.x + b.w + tol && p[1] >= b.y - tol && p[1] <= b.y + b.h + tol;
  const isDiamond = it => it.t === 'poly' && it.pts.length === 4 && Math.abs(it.pts[0][0] - it.pts[2][0]) < 1 && Math.abs(it.pts[1][1] - it.pts[3][1]) < 1;

  // ---------------------------------------------------------------- draw.io
  MD.toDrawio = scene => {
    const { byUid, bound } = read(scene);
    const cells = [];
    const cellOf = {}, absOf = {};
    let n = 2;
    const nid = () => 'c' + n++;
    const drawioImg = href => 'data:image/svg+xml,' + href.split(',')[1];
    const html = texts => (texts || []).filter(t => t.t === 'text').map((t, i) => {
      const s = t.lines.map(esc).join('<br>');
      const col = C(t.color || 'ink');
      const body = t.weight >= 600 ? `<b>${s}</b>` : s;
      return (i ? '<br>' : '') + `<font style="font-size:${Math.round(t.size)}px" color="${col}">${body}</font>`;
    }).join('');
    const geom = (b, parent) => {
      const o = parent && absOf[parent] ? absOf[parent] : { x: 0, y: 0 };
      return `<mxGeometry x="${r1(b.x - o.x)}" y="${r1(b.y - o.y)}" width="${r1(b.w)}" height="${r1(b.h)}" as="geometry"/>`;
    };
    const vertex = (it, style, value, b) => {
      const id = nid();
      const parent = it.parent && cellOf[it.parent] ? it.parent : null;
      cells.push(`<mxCell id="${id}" value="${esc(value || '')}" style="${style}" vertex="1" parent="${parent ? cellOf[parent] : '1'}">${geom(b, parent)}</mxCell>`);
      return id;
    };
    // Place the label where the engine put it (draw.io would otherwise centre it over icons/avatars).
    const labelPos = (b, texts) => {
      const tt = (texts || []).filter(t => t.t === 'text');
      if (!tt.length || !b) return '';
      const top = Math.min(...tt.map(t => t.y)), a = tt[0].anchor || 'start';
      let s = `whiteSpace=nowrap;verticalAlign=top;spacing=0;spacingTop=${r1(top - b.y)};`;
      if (a === 'middle') { const d = tt[0].x - (b.x + b.w / 2); s += 'align=center;' + (d > 1 ? `spacingLeft=${r1(2 * d)};` : d < -1 ? `spacingRight=${r1(-2 * d)};` : ''); }
      else if (a === 'end') s += `align=right;spacingRight=${r1(b.x + b.w - tt[0].x)};`;
      else s += `align=left;spacingLeft=${r1(tt[0].x - b.x)};`;
      return s;
    };
    const stroke = it => (it.stroke ? `strokeColor=${C(it.stroke)};strokeWidth=${it.sw == null ? 1.5 : it.sw};` + (it.dash ? 'dashed=1;' + (it.dash !== true ? `dashPattern=${String(it.dash).replace(/,/g, ' ')};` : '') : '') : 'strokeColor=none;');
    const fill = it => `fillColor=${it.fill && it.fill !== 'none' ? C(it.fill) : 'none'};`;
    const skip = new Set();
    Object.values(bound).forEach(list => list.forEach(t => skip.add(t)));

    for (const it of scene.items) {
      if (skip.has(it) && byUid[it.boundTo]) continue;
      const b = bbox(it);
      const isMain = it.uid && byUid[it.uid] === it;
      const label = isMain ? html(bound[it.uid]) : '';
      if (it.sem && it.sem.kind === 'group' && it.t === 'rect') {
        const hasIcon = scene.items.some(x => x.sem && x.sem.kind === 'groupIcon' && x.sem.of === it.uid);
        const id = vertex(it, `rounded=1;arcSize=${it.r || 0};absoluteArcSize=1;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;${fill(it)}${stroke(it)}verticalAlign=top;align=left;spacingLeft=${hasIcon ? 30 : 10};spacingTop=-1;fontSize=12;`, label, b);
        cellOf[it.uid] = id; absOf[it.uid] = b;
        continue;
      }
      if (it.t === 'image') {
        const href = MD.iconHref(it.icon, TH(), it.tone ? C(it.tone) : null);
        let style = `shape=image;html=1;image=${drawioImg(href)};imageAspect=1;aspect=fixed;verticalAlign=top;`;
        if (isMain) {
          const right = (bound[it.uid] || []).some(t => t.sem && t.sem.labelSide === 'right');
          style += right ? 'labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=6;' : 'verticalLabelPosition=bottom;labelPosition=center;align=center;spacingTop=2;';
        }
        const id = vertex(it, style, label, b);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      const lp = isMain ? labelPos(b, bound[it.uid]) : '';
      if (it.t === 'rect') {
        const style = `rounded=${it.r ? 1 : 0};arcSize=${it.r || 0};absoluteArcSize=1;whiteSpace=wrap;html=1;${fill(it)}${stroke(it)}${lp}`;
        const id = vertex(it, style, label, b);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      if (it.t === 'ellipse') {
        const id = vertex(it, `ellipse;whiteSpace=wrap;html=1;${fill(it)}${stroke(it)}${lp}`, label, b);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      if (it.t === 'poly') {
        const para = it.pts.length === 4 && !isDiamond(it);
        const id = vertex(it, (para ? 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=16;' : 'rhombus;') + `whiteSpace=wrap;html=1;${fill(it)}${stroke(it)}${lp}`, label, b);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      if (it.t === 'path') {
        if (!b) continue;
        const shape = it.sem && (it.sem.shape === 'db' || it.sem.shape === 'database') ? 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;' : it.sem && it.sem.shape === 'doc' ? 'shape=document;boundedLbl=1;size=0.2;' : 'rounded=1;arcSize=8;absoluteArcSize=1;';
        const id = vertex(it, shape + `whiteSpace=wrap;html=1;${fill(it)}${stroke(it)}${lp}`, label, b);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      if (it.t === 'text') {
        const al = it.anchor === 'middle' ? 'center' : it.anchor === 'end' ? 'right' : 'left';
        const style = `text;html=1;align=${al};verticalAlign=top;whiteSpace=nowrap;spacing=0;fontSize=${Math.round(it.size)};fontColor=${C(it.color || 'ink')};` + (it.weight >= 600 ? 'fontStyle=1;' : '') + (it.mono ? 'fontFamily=Courier New;' : '');
        const id = nid();
        const parent = it.parent && cellOf[it.parent] ? it.parent : null;
        cells.push(`<mxCell id="${id}" value="${esc(it.lines.join('\n'))}" style="${style}" vertex="1" parent="${parent ? cellOf[parent] : '1'}">${geom({ x: b.x, y: b.y, w: b.w + 4, h: b.h }, parent)}</mxCell>`);
        if (isMain) { cellOf[it.uid] = id; absOf[it.uid] = b; }
        continue;
      }
      if (it.t === 'line') {
        const src = it.from && cellOf[it.from] && onBorder(it.pts[0], absOf[it.from]) ? it.from : null;
        const dst = it.to && cellOf[it.to] && onBorder(it.pts[it.pts.length - 1], absOf[it.to]) ? it.to : null;
        const lab = it.uid ? html((bound[it.uid] || []).filter(t => t.t === 'text')) : '';
        let style = `html=1;rounded=${it.r === 0 ? 0 : 1};${it.curve ? 'curved=1;' : 'edgeStyle=orthogonalEdgeStyle;'}endArrow=${it.end === 'arrow' ? 'block' : 'none'};endFill=1;startArrow=${it.start === 'arrow' ? 'block' : 'none'};startFill=1;endSize=6;startSize=6;` +
          `strokeColor=${C(it.stroke || 'edge')};strokeWidth=${it.sw || 1.5};` + (it.dash ? 'dashed=1;' : '') + `fontSize=12;fontColor=${C('dim')};labelBackgroundColor=#FFFFFF;`;
        const rel = (p, box) => [r1((p[0] - box.x) / box.w), r1((p[1] - box.y) / box.h)].map(v => Math.max(0, Math.min(1, v)));
        if (src) { const [ex, ey] = rel(it.pts[0], absOf[src]); style += `exitX=${ex};exitY=${ey};exitDx=0;exitDy=0;`; }
        if (dst) { const [ex, ey] = rel(it.pts[it.pts.length - 1], absOf[dst]); style += `entryX=${ex};entryY=${ey};entryDx=0;entryDy=0;`; }
        const inner = (it.curve ? it.pts.filter((_, i) => i % 4 === 0) : it.pts).slice(1, -1);
        const pts = inner.length ? `<Array as="points">${inner.map(p => `<mxPoint x="${r1(p[0])}" y="${r1(p[1])}"/>`).join('')}</Array>` : '';
        const a = it.pts[0], z = it.pts[it.pts.length - 1];
        const ends = (src ? '' : `<mxPoint x="${r1(a[0])}" y="${r1(a[1])}" as="sourcePoint"/>`) + (dst ? '' : `<mxPoint x="${r1(z[0])}" y="${r1(z[1])}" as="targetPoint"/>`);
        cells.push(`<mxCell id="${nid()}" value="${esc(lab)}" style="${style}" edge="1" parent="1"${src ? ` source="${cellOf[src]}"` : ''}${dst ? ` target="${cellOf[dst]}"` : ''}><mxGeometry relative="1" as="geometry">${ends}${pts}</mxGeometry></mxCell>`);
      }
    }
    const W = Math.ceil(scene.w), H = Math.ceil(scene.h);
    return `<mxfile host="motion-diagrams" type="device"><diagram id="md" name="${esc(scene.title || 'Diagram')}">` +
      `<mxGraphModel dx="${W}" dy="${H}" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${W}" pageHeight="${H}" background="#FFFFFF" math="0" shadow="0">` +
      `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>\n`;
  };

  // ---------------------------------------------------------------- Excalidraw
  MD.toExcalidraw = scene => {
    const { byUid, bound } = read(scene);
    const els = [], files = {};
    const elOf = {};
    let n = 0, seed = 1000;
    const id = () => 'md' + (++n).toString(36).padStart(4, '0');
    const now = 1767225600000;
    const base = (type, b, extra = {}) => Object.assign({
      id: id(), type, x: r1(b.x), y: r1(b.y), width: r1(Math.max(1, b.w)), height: r1(Math.max(1, b.h)), angle: 0,
      strokeColor: '#1E1E1E', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
      roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: ++seed, version: 1, versionNonce: ++seed * 7,
      isDeleted: false, boundElements: null, updated: now, link: null, locked: false,
    }, extra);
    const styleOf = it => ({
      strokeColor: it.stroke ? C(it.stroke) : 'transparent',
      backgroundColor: it.fill && it.fill !== 'none' ? C(it.fill) : 'transparent',
      strokeWidth: it.stroke ? Math.max(1, Math.round(it.sw == null ? 1.5 : it.sw)) : 1,
      strokeStyle: it.dash ? (it.dash === '2 4' ? 'dotted' : 'dashed') : 'solid',
    });
    const textEl = (t, extra = {}) => {
      const b = bbox(t);
      const str = t.lines.join('\n');
      return base('text', { x: b.x, y: b.y, w: b.w + 2, h: t.lines.length * t.size * 1.25 }, Object.assign({
        strokeColor: C(t.color || 'ink'), text: str, originalText: str, fontSize: Math.round(t.size), fontFamily: t.mono ? 3 : 2,
        textAlign: t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left', verticalAlign: 'top',
        containerId: null, autoResize: true, lineHeight: 1.25,
      }, extra));
    };
    const bindText = (shape, texts) => {
      const tt = (texts || []).filter(t => t.t === 'text');
      if (!tt.length) return;
      // Excalidraw always centres bound text; keep off-centre labels (beside an avatar or icon) as
      // free text grouped with their shape instead.
      const cx = shape.x + shape.width / 2;
      if (tt.some(t => t.anchor !== 'middle' || Math.abs(t.x - cx) > 3)) {
        const g = 'grp' + shape.id;
        shape.groupIds = [g];
        tt.forEach(t => els.push(textEl(t, { groupIds: [g] })));
        return;
      }
      const str = tt.map(t => t.lines.join('\n')).join('\n');
      const size = Math.round(tt[0].size);
      const lines = str.split('\n').length;
      const h = lines * size * 1.25, w = Math.max(...tt.map(t => t.w)) + 4;
      const el = base('text', { x: shape.x + shape.width / 2 - w / 2, y: shape.y + shape.height / 2 - h / 2, w, h }, {
        strokeColor: C(tt[0].color || 'ink'), text: str, originalText: str, fontSize: size, fontFamily: 2,
        textAlign: 'center', verticalAlign: 'middle', containerId: shape.id, autoResize: true, lineHeight: 1.25,
      });
      shape.boundElements = (shape.boundElements || []).concat([{ type: 'text', id: el.id }]);
      els.push(el);
    };
    const skip = new Set();
    Object.values(bound).forEach(list => list.forEach(t => skip.add(t)));
    const groupOf = {};

    for (const it of scene.items) {
      const isMain = it.uid && byUid[it.uid] === it;
      if (skip.has(it) && byUid[it.boundTo]) continue;
      const b = bbox(it);
      if (it.t === 'rect' || (it.t === 'path' && b)) {
        const el = base('rectangle', b, Object.assign(styleOf(it), { roundness: it.r || it.t === 'path' ? { type: 3 } : null }));
        els.push(el);
        if (isMain) {
          elOf[it.uid] = el;
          if (it.sem && it.sem.kind === 'group') {
            const tt = (bound[it.uid] || []).filter(t => t.t === 'text');
            tt.forEach(t => els.push(textEl(t)));
          } else bindText(el, bound[it.uid]);
        }
        continue;
      }
      if (it.t === 'ellipse' || (it.t === 'poly' && isDiamond(it))) {
        const el = base(it.t === 'ellipse' ? 'ellipse' : 'diamond', b, styleOf(it));
        els.push(el);
        if (isMain) { elOf[it.uid] = el; bindText(el, bound[it.uid]); }
        continue;
      }
      if (it.t === 'poly') {
        const pts = [...it.pts, it.pts[0]].map(p => [r1(p[0] - b.x), r1(p[1] - b.y)]);
        const el = base('line', b, Object.assign(styleOf(it), { points: pts, lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, polygon: true }));
        els.push(el);
        if (isMain) { elOf[it.uid] = el; (bound[it.uid] || []).filter(t => t.t === 'text').forEach(t => els.push(textEl(t))); }
        continue;
      }
      if (it.t === 'image') {
        const href = MD.iconHref(it.icon, TH(), it.tone ? C(it.tone) : null);
        let fid = Object.keys(files).find(k => files[k].dataURL === href);
        if (!fid) { fid = 'f' + (Object.keys(files).length + 1).toString(36) + Math.abs(hash(href)).toString(36); files[fid] = { mimeType: 'image/svg+xml', id: fid, dataURL: href, created: now }; }
        const el = base('image', b, { fileId: fid, status: 'saved', scale: [1, 1], strokeColor: 'transparent' });
        els.push(el);
        if (isMain) {
          elOf[it.uid] = el;
          const tt = (bound[it.uid] || []).filter(t => t.t === 'text');
          if (tt.length) {
            const g = 'grp' + el.id;
            el.groupIds = [g];
            tt.forEach(t => els.push(textEl(t, { groupIds: [g] })));
            groupOf[it.uid] = g;
          }
        }
        continue;
      }
      if (it.t === 'text') { els.push(textEl(it)); continue; }
      if (it.t === 'line') {
        const pts = it.curve ? it.pts.filter((_, i) => i % 2 === 0 || i === it.pts.length - 1) : it.pts;
        const lb = bbox({ t: 'line', pts });
        const rel = pts.map(p => [r1(p[0] - pts[0][0]), r1(p[1] - pts[0][1])]);
        const isArrow = it.end === 'arrow' || it.start === 'arrow';
        const src = it.from && elOf[it.from] && onBorder(pts[0], bbox(byUid[it.from])) ? elOf[it.from] : null;
        const dst = it.to && elOf[it.to] && onBorder(pts[pts.length - 1], bbox(byUid[it.to])) ? elOf[it.to] : null;
        const el = base(isArrow ? 'arrow' : 'line', { x: pts[0][0], y: pts[0][1], w: lb.w, h: lb.h }, Object.assign(styleOf({ stroke: it.stroke || 'edge', sw: it.sw, dash: it.dash }), {
          points: rel, lastCommittedPoint: null, roundness: it.curve ? { type: 2 } : null,
          startBinding: src ? { elementId: src.id, focus: 0, gap: 1 } : null, endBinding: dst ? { elementId: dst.id, focus: 0, gap: 1 } : null,
          startArrowhead: it.start === 'arrow' ? 'arrow' : null, endArrowhead: it.end === 'arrow' ? 'arrow' : null, elbowed: false,
        }));
        els.push(el);
        for (const s of [src, dst]) if (s) s.boundElements = (s.boundElements || []).concat([{ type: 'arrow', id: el.id }]);
        const tt = it.uid ? (bound[it.uid] || []).filter(t => t.t === 'text') : [];
        if (tt.length) {
          const t = tt[0], tb = bbox(t), str = tt.map(x => x.lines.join('\n')).join('\n');
          const te = base('text', { x: tb.x, y: tb.y, w: tb.w + 2, h: t.lines.length * t.size * 1.25 }, {
            strokeColor: C(t.color || 'dim'), text: str, originalText: str, fontSize: Math.round(t.size), fontFamily: 2,
            textAlign: 'center', verticalAlign: 'middle', containerId: isArrow ? el.id : null, autoResize: true, lineHeight: 1.25,
          });
          if (isArrow) el.boundElements = (el.boundElements || []).concat([{ type: 'text', id: te.id }]);
          els.push(te);
        }
      }
    }
    return JSON.stringify({ type: 'excalidraw', version: 2, source: 'https://github.com/motion-diagrams', elements: els, appState: { viewBackgroundColor: '#FFFFFF', gridSize: null }, files }, null, 1);
  };
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
})();

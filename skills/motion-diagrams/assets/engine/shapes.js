/* motion-diagrams engine: node shapes and group presets.
 * spec(node) measures a node and returns {w, h, labelBox?, draw(x, y)} where draw returns scene items.
 * Every item a node draws carries part 'node:<id>'; its main shape has uid 'n:<id>' and role 'node',
 * and texts inside it carry fit: 'n:<id>' so verify can catch overflow.
 */
'use strict';
(function () {
  const MD = window.MD;
  const T = (...a) => MD.text.block(...a);

  // ---------------------------------------------------------------- group presets
  MD.PRESETS = {
    'aws.cloud': { label: 'AWS Cloud', color: { light: '#232F3E', dark: '#C9D1DB' }, icon: 'aws/group/aws-cloud-logo' },
    'aws.region': { label: 'Region', color: '#00A4A6', dash: true, icon: 'aws/group/region' },
    'aws.az': { label: 'Availability Zone', color: '#00A4A6', dash: true },
    'aws.vpc': { label: 'VPC', color: '#8C4FFF', icon: 'aws/group/virtual-private-cloud-vpc' },
    'aws.subnet.public': { label: 'Public subnet', color: '#7AA116', fill: '#7AA116.fill', icon: 'aws/group/public-subnet' },
    'aws.subnet.private': { label: 'Private subnet', color: '#00A4A6', fill: '#00A4A6.fill', icon: 'aws/group/private-subnet' },
    'aws.account': { label: 'AWS account', color: '#E7157B', icon: 'aws/group/aws-account' },
    'aws.asg': { label: 'Auto Scaling group', color: '#ED7100', dash: true, icon: 'aws/group/auto-scaling-group' },
    'aws.datacenter': { label: 'Corporate data center', color: '#7D8998', icon: 'aws/group/corporate-data-center' },
    'aws.sg': { label: 'Security group', color: '#DD344C', dash: true },
    'aws.ec2': { label: 'EC2 instance', color: '#ED7100', icon: 'aws/group/ec2-instance-contents' },
    'aws.spot': { label: 'Spot Fleet', color: '#ED7100', icon: 'aws/group/spot-fleet' },
    'aws.server': { label: 'Server', color: '#7D8998', icon: 'aws/group/server-contents' },
    'azure.subscription': { label: 'Subscription', color: '#0078D4', icon: 'azure/subscriptions' },
    'azure.rg': { label: 'Resource group', color: '#0078D4', dash: true, icon: 'azure/resource-groups' },
    'azure.vnet': { label: 'Virtual network', color: '#0078D4', fill: '#0078D4.fill', icon: 'azure/virtual-networks' },
    'azure.subnet': { label: 'Subnet', color: '#5EA0EF', dash: true, icon: 'azure/subnet' },
    'gcp.project': { label: 'Project', color: { light: '#5F6368', dark: '#9AA0A6' }, fill: '#5F6368.fill' },
    'gcp.region': { label: 'Region', color: '#4285F4', dash: true },
    'gcp.zone': { label: 'Zone', color: '#4285F4', dash: '2 4' },
    'gcp.vpc': { label: 'VPC network', color: '#34A853', icon: 'gcp/virtual-private-cloud' },
    'k8s.cluster': { label: 'Kubernetes cluster', color: '#326CE5', icon: 'logo/kubernetes' },
    'k8s.namespace': { label: 'Namespace', color: 'dim', fill: 'panel', icon: 'k8s/ns' },
    'k8s.node': { label: 'Node', color: '#326CE5', dash: true, icon: 'k8s/node' },
    'c4.boundary': { label: 'System boundary', color: 'dim', dash: true },
    'onprem': { label: 'On-premises', color: '#7D8998', icon: 'aws/group/corporate-data-center' },
    'generic': { color: 'dim' },
  };

  MD.groupStyle = g => {
    const p = g.preset ? MD.PRESETS[g.preset] : MD.PRESETS.generic;
    if (!p) throw new Error(`group "${g.id}": unknown preset "${g.preset}". Presets: ${Object.keys(MD.PRESETS).join(', ')}`);
    const color = g.color || g.tone || p.color;
    let fill = g.fill != null ? g.fill : p.fill || 'none';
    if (fill === 'tint') fill = (typeof color === 'string' ? color : 'accent') + '.fill';
    return { label: g.label != null ? g.label : p.label || g.id, color, dash: g.dash != null ? g.dash : p.dash, fill, icon: g.icon !== undefined ? g.icon : p.icon };
  };
  MD.groupHeader = g => {
    const s = MD.groupStyle(g);
    const tb = T(s.label, 12.5, 600, 600);
    return { style: s, tb, w: (s.icon ? 32 : 12) + tb.w + 16, h: 34 };
  };
  MD.drawGroup = (g, x, y, w, h) => {
    const { style: s, tb } = MD.groupHeader(g);
    const part = 'group:' + g.id, uid = 'g:' + g.id;
    const items = [{ t: 'rect', x, y, w, h, r: 6, fill: s.fill, stroke: s.color, sw: 1.5, dash: s.dash, part, uid, role: 'group', sem: { kind: 'group', id: g.id } }];
    if (s.icon) items.push({ t: 'image', x, y, w: 24, h: 24, icon: s.icon, part, sem: { kind: 'groupIcon', of: uid } });
    items.push({ t: 'text', x: x + (s.icon ? 32 : 12), y: y + 4, lines: tb.lines, w: tb.w, size: 12.5, weight: 600, lh: tb.lh, color: 'ink', on: s.fill === 'none' ? null : s.fill, part, boundTo: uid, edgeOk: false });
    return items;
  };

  // ---------------------------------------------------------------- node specs
  const C4 = {
    person: { fill: '#08427B', type: 'Person' }, system: { fill: '#1168BD', type: 'Software System' },
    external: { fill: '#6B6B6B', type: 'External System' }, container: { fill: '#2B6FB3', type: 'Container' },
    component: { fill: '#3D7FC1', type: 'Component' }, database: { fill: '#2B6FB3', type: 'Database' },
  };

  function textItems(blocks, cx, top, part, fit, on) {
    const items = [];
    let y = top;
    for (const b of blocks) {
      if (!b) continue;
      items.push({ t: 'text', x: cx, y, lines: b.lines, w: b.w, size: b.size, weight: b.weight, lh: b.lh, color: b.color || 'ink', anchor: 'middle', part, fit, on, boundTo: fit, mono: b.mono });
      y += b.h + (b.gap || 2);
    }
    return items;
  }
  const stackH = blocks => blocks.filter(Boolean).reduce((s, b) => s + b.h + (b.gap || 2), 0) - 2;
  const stackW = blocks => Math.max(0, ...blocks.filter(Boolean).map(b => b.w));

  MD.nodeSpec = (n, cfg) => {
    const part = 'node:' + n.id, uid = 'n:' + n.id;
    const kind = cfg.kind;
    let shape = n.shape;
    if (!shape) {
      if (n.icon && kind === 'architecture') shape = 'icon';
      else if (kind === 'state') shape = 'state';
      else if (kind === 'c4') shape = 'system';
      else if (kind === 'org') shape = 'card';
      else shape = 'box';
    }
    const tone = MD.tone(n.tone);
    const maxW = n.maxWidth || cfg.labelWidth || (shape === 'icon' ? 150 : 190);
    const main = (o) => Object.assign({ part, uid, role: 'node', sem: { kind: 'node', id: n.id, shape } }, o);

    // -- icon node: the icon is the box ELK sees; the label sits below (or to the right going down)
    if (shape === 'icon') {
      const S = n.size || cfg.iconSize || 56;
      const lab = T(n.label != null ? n.label : n.id, 14, 600, maxW);
      const sub = n.sub ? Object.assign(T(n.sub, 12.5, 400, maxW), { color: 'dim' }) : null;
      const blocks = [lab, sub];
      const lw = stackW(blocks), lh = stackH(blocks);
      return {
        w: S, h: S, shape, label: { w: lw, h: lh },
        draw(x, y, lx, ly, anchor) {
          const items = [main({ t: 'image', x, y, w: S, h: S, icon: n.icon, tone: n.tone && n.tone !== 'neutral' ? n.tone : null, labelBelow: true })];
          if (anchor === 'right') {
            let ty = ly;
            for (const b of blocks.filter(Boolean)) {
              items.push({ t: 'text', x: lx, y: ty, lines: b.lines, w: b.w, size: b.size, weight: b.weight, lh: b.lh, color: b.color || 'ink', anchor: 'start', part, boundTo: uid });
              ty += b.h + 2;
            }
            items.forEach(i => { if (i.boundTo) i.sem = { labelSide: 'right' }; });
          } else items.push(...textItems(blocks, lx + lw / 2, ly, part, null, null).map(i => Object.assign(i, { fit: null, boundTo: uid })));
          return items;
        },
      };
    }

    // -- C4 elements
    if (C4[shape]) {
      const c = C4[shape];
      const typeTxt = '[' + c.type + (n.tech ? ': ' + n.tech : '') + ']';
      const name = Object.assign(T(n.label || n.id, 15, 700, 220), { color: '#FFFFFF' });
      const type = Object.assign(T(typeTxt, 11.5, 400, 220), { color: '#E6EEF8', gap: 8 });
      const desc = n.sub ? Object.assign(T(n.sub, 12.5, 400, 220), { color: '#FFFFFF' }) : null;
      const blocks = [name, type, desc];
      const w = Math.max(shape === 'person' ? 180 : 210, stackW(blocks) + 36);
      const bh = stackH(blocks) + 32;
      const head = shape === 'person' ? 46 : 0;
      return {
        w, h: bh + head, shape,
        draw(x, y) {
          const items = [];
          const by = y + head;
          if (shape === 'person') items.push({ t: 'ellipse', cx: x + w / 2, cy: y + 26, rx: 26, ry: 26, fill: c.fill, part, role: 'node', uid: uid + ':head', sem: { kind: 'deco' } });
          if (shape === 'database') {
            const ry = 9;
            items.push(main({ t: 'path', d: cyl(x, by, w, bh, ry), fill: c.fill, x, y: by, w, h: bh }));
            items.push({ t: 'path', d: `M${x} ${by + ry} a${w / 2} ${ry} 0 0 0 ${w} 0`, stroke: '#FFFFFF', sw: 1, part, sem: { kind: 'deco' } });
          } else items.push(main({ t: 'rect', x, y: by, w, h: bh, r: shape === 'person' ? 22 : 10, fill: c.fill }));
          items.push(...textItems(blocks, x + w / 2, by + 16, part, uid, c.fill));
          return items;
        },
      };
    }

    // -- org chart card
    if (shape === 'card') {
      const name = T(n.label || n.id, 13.5, 600, 200);
      const role = n.sub ? Object.assign(T(n.sub, 12, 400, 200), { color: 'dim' }) : null;
      const w = Math.max(176, 58 + Math.max(name.w, role ? role.w : 0) + 16);
      const h = 62;
      const col = n.tone || 'accent';
      const ini = (n.initials || String(n.label || n.id).split(/\s+/).map(s => s[0]).join('').slice(0, 2)).toUpperCase();
      return {
        w, h, shape,
        draw(x, y) {
          const items = [main({ t: 'rect', x, y, w, h, r: 10, fill: 'bg', stroke: 'line', sw: 1.5 })];
          items.push({ t: 'rect', x, y, w: 5, h, r: 2, fill: col, part, sem: { kind: 'deco' } });
          if (n.icon) items.push({ t: 'image', x: x + 14, y: y + h / 2 - 17, w: 34, h: 34, icon: n.icon, part });
          else {
            items.push({ t: 'ellipse', cx: x + 31, cy: y + h / 2, rx: 17, ry: 17, fill: col + '.soft', part, sem: { kind: 'deco' } });
            const ib = T(ini, 12, 700);
            items.push({ t: 'text', x: x + 31, y: y + h / 2 - ib.h / 2, lines: ib.lines, w: ib.w, size: 12, weight: 700, lh: ib.lh, color: 'ink', anchor: 'middle', part, on: col + '.soft', noCheck: false, sem: { kind: 'deco' } });
          }
          const th = name.h + (role ? role.h + 1 : 0);
          let ty = y + h / 2 - th / 2;
          items.push({ t: 'text', x: x + 58, y: ty, lines: name.lines, w: name.w, size: 13.5, weight: 600, lh: name.lh, color: 'ink', part, fit: uid, boundTo: uid });
          if (role) items.push({ t: 'text', x: x + 58, y: ty + name.h + 1, lines: role.lines, w: role.w, size: 12, weight: 400, lh: role.lh, color: 'dim', part, fit: uid, boundTo: uid });
          return items;
        },
      };
    }

    // -- steps card: a titled list of numbered steps, each with its tool's icon (a CI/CD job, a runbook)
    if (shape === 'steps') {
      const head = T(n.label || n.id, 13.5, 700, 260);
      const sub = n.sub ? Object.assign(T(n.sub, 12, 400, 260), { color: 'dim' }) : null;
      const rows = (n.steps || []).map(s => (typeof s === 'string' ? { label: s } : s)).map((s, i) => Object.assign(s, { tb: T((n.numbered === false ? '' : (i + 1) + '  ') + s.label, 13, 500, 280) }));
      const rowH = 34, headH = 46 + (sub ? sub.h : 0);
      const w = Math.max(n.minWidth || 220, head.w + 64, sub ? sub.w + 64 : 0, ...rows.map(r => r.tb.w + 66));
      const h = headH + rows.length * rowH + 10;
      const tone = n.tone || 'dim';
      return {
        w, h, shape,
        rowCenter: i => headH + 5 + i * rowH + rowH / 2,
        headCenter: headH / 2,
        draw(x, y) {
          const items = [main({ t: 'rect', x, y, w, h, r: 10, fill: 'bg', stroke: tone === 'dim' ? 'line' : tone, sw: 1.5 })];
          items.push({ t: 'rect', x, y, w, h: headH, r: 10, fill: 'panel', part, sem: { kind: 'deco' } });
          items.push({ t: 'line', pts: [[x, y + headH], [x + w, y + headH]], stroke: 'line', sw: 1, r: 0, part, sem: { kind: 'deco' } });
          if (n.icon) items.push({ t: 'image', x: x + 12, y: y + 11, w: 24, h: 24, icon: n.icon, part });
          const hx = x + (n.icon ? 44 : 14);
          items.push({ t: 'text', x: hx, y: y + 12, lines: head.lines, w: head.w, size: 13.5, weight: 700, lh: head.lh, color: 'ink', part, fit: uid, on: 'panel', boundTo: uid });
          if (sub) items.push({ t: 'text', x: hx, y: y + 12 + head.h, lines: sub.lines, w: sub.w, size: 12, weight: 400, lh: sub.lh, color: 'dim', part, fit: uid, on: 'panel', boundTo: uid });
          rows.forEach((r, i) => {
            const ry = y + headH + 5 + i * rowH;
            if (i) items.push({ t: 'line', pts: [[x + 12, ry], [x + w - 12, ry]], stroke: 'line', sw: 1, r: 0, dash: '2 3', part, sem: { kind: 'deco' } });
            if (r.icon) items.push({ t: 'image', x: x + 14, y: ry + 6, w: 22, h: 22, icon: r.icon, part });
            items.push({ t: 'text', x: x + 46, y: ry + rowH / 2 - r.tb.lh / 2, lines: r.tb.lines, w: r.tb.w, size: 13, weight: 500, lh: r.tb.lh, color: 'ink', part, fit: uid, sem: { kind: 'step' } });
          });
          return items;
        },
      };
    }

    // -- state machine pseudo-states
    if (shape === 'start') return { w: 22, h: 22, shape, draw: (x, y) => [main({ t: 'ellipse', cx: x + 11, cy: y + 11, rx: 11, ry: 11, fill: 'ink' })] };
    if (shape === 'end') return {
      w: 28, h: 28, shape,
      draw: (x, y) => [main({ t: 'ellipse', cx: x + 14, cy: y + 14, rx: 13, ry: 13, stroke: 'ink', sw: 2 }), { t: 'ellipse', cx: x + 14, cy: y + 14, rx: 8, ry: 8, fill: 'ink', part, sem: { kind: 'deco' } }],
    };
    if (shape === 'choice') return { w: 34, h: 34, shape, draw: (x, y) => [main({ t: 'poly', pts: [[x + 17, y], [x + 34, y + 17], [x + 17, y + 34], [x, y + 17]], fill: 'warn.fill', stroke: 'warn' })] };

    // -- text-bearing shapes (flowchart and friends)
    const icon = n.icon ? 30 : 0;
    const lab = T(n.label != null ? n.label : n.id, 14, 600, maxW);
    const sub = n.sub ? Object.assign(T(n.sub, 12.5, 400, maxW), { color: 'dim' }) : null;
    const blocks = [lab, sub];
    const tw = stackW(blocks) + (icon ? icon + 10 : 0), th = Math.max(stackH(blocks), icon);
    let st = tone;
    if (shape === 'decision' && !n.tone) st = MD.tone('warn');
    if (shape === 'terminal' && !n.tone) st = MD.tone('accent');
    if (shape === 'note' && !n.tone) st = { stroke: 'noteLine', fill: 'note', text: 'ink' };
    if (shape === 'state' && !n.tone) st = MD.tone('accent');
    if (n.final) st = Object.assign({}, st);
    let w, h, body;
    const textAt = (x, y, w, h) => {
      const items = [];
      const tx = x + w / 2 + (icon ? (icon + 10) / 2 : 0);
      if (icon) items.push({ t: 'image', x: x + w / 2 - tw / 2, y: y + h / 2 - icon / 2, w: icon, h: icon, icon: n.icon, part });
      items.push(...textItems(blocks, tx, y + h / 2 - stackH(blocks) / 2, part, uid, st.fill));
      return items;
    };
    switch (shape) {
      case 'decision': {
        const a = tw / 2 + 12, b = th / 2 + 8;
        const Q = Math.max(34, a / 1.7 + b), P = 1.7 * Q;
        w = 2 * P; h = 2 * Q;
        body = (x, y) => [main({ t: 'poly', pts: [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], fill: st.fill, stroke: st.stroke })];
        break;
      }
      case 'terminal': case 'state': {
        w = Math.max(shape === 'state' ? 110 : 120, tw + 44); h = Math.max(44, th + 22);
        const r = shape === 'state' ? 16 : h / 2;
        body = (x, y) => [main({ t: 'rect', x, y, w, h, r, fill: st.fill, stroke: st.stroke, sw: n.final ? 3 : 1.5 })];
        break;
      }
      case 'io': {
        const k = 16; w = Math.max(130, tw + 52 + k); h = Math.max(48, th + 22);
        body = (x, y) => [main({ t: 'poly', pts: [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]], fill: st.fill, stroke: st.stroke })];
        break;
      }
      case 'db': {
        const ry = 8; w = Math.max(110, tw + 36); h = Math.max(70, th + 30 + 2 * ry);
        body = (x, y) => [main({ t: 'path', d: cyl(x, y, w, h, ry), fill: st.fill, stroke: st.stroke, sw: 1.5, x, y, w, h }),
          { t: 'path', d: `M${x} ${y + ry} a${w / 2} ${ry} 0 0 0 ${w} 0`, stroke: st.stroke, sw: 1.5, part, sem: { kind: 'deco' } }];
        break;
      }
      case 'doc': {
        w = Math.max(120, tw + 40); h = Math.max(56, th + 34);
        body = (x, y) => [main({ t: 'path', d: `M${x} ${y + 6} q0 -6 6 -6 h${w - 12} q6 0 6 6 v${h - 16} c${-w / 4} -12 ${-w / 4} 14 ${-w / 2} 6 s${-w / 4} -8 ${-w / 2} 4 z`, fill: st.fill, stroke: st.stroke, sw: 1.5, x, y, w, h })];
        break;
      }
      case 'circle': {
        const d = Math.max(64, Math.max(tw, th) + 34); w = h = d;
        body = (x, y) => [main({ t: 'ellipse', cx: x + d / 2, cy: y + d / 2, rx: d / 2, ry: d / 2, fill: st.fill, stroke: st.stroke })];
        break;
      }
      default: { // box, note
        w = Math.max(n.minWidth || 120, tw + 36); h = Math.max(52, th + 24);
        body = (x, y) => [main({ t: 'rect', x, y, w, h, r: shape === 'note' ? 2 : 10, fill: st.fill, stroke: st.stroke })];
      }
    }
    if (n.w) w = n.w;
    if (n.h) h = n.h;
    return { w, h, shape, draw: (x, y) => [...body(x, y), ...textAt(x, y, w, h)] };
  };

  function cyl(x, y, w, h, ry) {
    return `M${x} ${y + ry} a${w / 2} ${ry} 0 0 1 ${w} 0 v${h - 2 * ry} a${w / 2} ${ry} 0 0 1 ${-w} 0 z`;
  }
  MD.cyl = cyl;
})();

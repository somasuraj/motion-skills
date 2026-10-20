/* MotionDiagrams: show a motion-diagrams diagram inside a motion-slides deck or a motion-videos film.
 * Every method that animates is a pure function of t (call it from render(t) every frame).
 *   const d = MotionDiagrams.mount(el, 'shop', {theme: 'auto'});     // in init
 *   d.play(t, [{at: 0, show: 'group:*'}, {at: .8, show: ['node:users', 'edge:users>dns']}, …]);   // in render
 *   d.packet('edge:cdn>alb', p) · d.focus('node:db', amount) · d.box('node:db') · d.sync()
 */
window.MotionDiagrams = window.MotionDiagrams || (function () {
  'use strict';
  const reg = {};
  let fontsAdded = false;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = x => 1 - Math.pow(1 - clamp01(x), 3);

  function groundIsDark(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || '');
      if (m && (m[4] == null || +m[4] > 0.5)) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.45;
    }
    return false;
  }
  const match = (part, sel) => sel === 'all' || sel === '*' || sel === part || (sel.endsWith(':*') && part.startsWith(sel.slice(0, -1)));

  function mount(el, name, opts) {
    opts = opts || {};
    const d = reg[name];
    if (!d) throw new Error('MotionDiagrams: no diagram "' + name + '" (paste its .embed.js first)');
    if (!fontsAdded && d.fonts) {
      const s = document.createElement('style');
      s.textContent = d.fonts;
      document.head.appendChild(s);
      fontsAdded = true;
    }
    const wrap = document.createElement('div');
    wrap.className = 'md-embed';
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center';
    el.appendChild(wrap);
    const h = { el: wrap, name, w: d.w, h: d.h, parts: d.parts.slice(), theme: null };
    let nodes = {}, lens = new WeakMap(), dots = {};

    h.setTheme = t => {
      if (t === h.theme) return;
      h.theme = t;
      wrap.innerHTML = d.svg[t] || d.svg.light;
      const svg = wrap.querySelector('svg');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.cssText = 'width:100%;height:100%;display:block';
      svg.setAttribute('preserveAspectRatio', opts.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet');
      if (opts.transparent) { const bg = svg.querySelector('.md-bg'); if (bg) bg.setAttribute('fill', 'none'); }
      h.svg = svg;
      nodes = {};
      svg.querySelectorAll('[data-part]').forEach(g => (nodes[g.getAttribute('data-part')] = nodes[g.getAttribute('data-part')] || []).push(g));
      lens = new WeakMap();
      svg.querySelectorAll('.md-line').forEach(p => { try { lens.set(p, p.getTotalLength()); } catch (e) { /* not rendered yet */ } });
      dots = {};
    };
    h.sync = () => h.setTheme(opts.theme && opts.theme !== 'auto' ? opts.theme : groundIsDark(el) ? 'dark' : 'light');
    h.sync();

    // Set one part's reveal progress p (0 hidden … 1 shown). Edges draw on; everything else fades and rises.
    h.show = (part, p) => {
      const e = ease(p);
      for (const g of nodes[part] || []) {
        const isEdge = part.startsWith('edge:') || part.startsWith('msg:') || part.startsWith('rel:');
        if (isEdge) {
          g.style.opacity = p > 0 ? '1' : '0';
          g.querySelectorAll('.md-line').forEach(path => {
            const L = lens.get(path) || 0;
            if (path.getAttribute('stroke-dasharray')) { path.style.opacity = String(e); return; }
            path.style.strokeDasharray = L + ' ' + L;
            path.style.strokeDashoffset = String(L * (1 - e));
          });
          g.querySelectorAll('.md-head').forEach(a => (a.style.opacity = String(clamp01((p - 0.8) / 0.2))));
          g.querySelectorAll('rect, text, ellipse').forEach(x => (x.style.opacity = String(clamp01((p - 0.5) / 0.5))));
        } else {
          g.style.opacity = String(e);
          g.setAttribute('transform', 'translate(0 ' + ((1 - e) * 10).toFixed(2) + ')');
        }
      }
    };
    // A build-up plan: [{at: seconds, show: 'node:a' | ['node:a', 'edge:a>b'] | 'group:*', dur: 0.6, stagger: 0.12}, …]
    // Parts named in the plan stay hidden until their step; parts never named are always shown.
    h.play = (t, plan) => {
      const when = {};
      for (const step of plan) {
        const sels = [].concat(step.show || []);
        let k = 0;
        for (const part of h.parts) if (sels.some(s => match(part, s)) && when[part] == null) when[part] = [step.at + (step.stagger || 0) * k++, step.dur || 0.6];
      }
      for (const part of h.parts) h.show(part, when[part] ? (t - when[part][0]) / when[part][1] : 1);
    };
    // Dim everything except the parts matching sel (amount 0…1).
    h.focus = (sel, amount) => {
      const sels = [].concat(sel);
      for (const part of h.parts) {
        if (sels.some(s => match(part, s))) continue;
        for (const g of nodes[part] || []) g.style.opacity = String((+g.style.opacity || 1) * (1 - 0.72 * clamp01(amount)));
      }
    };
    // A dot travelling along an edge (p 0…1); p outside 0…1 hides it.
    h.packet = (part, p, o) => {
      o = o || {};
      const g = (nodes[part] || [])[0];
      const path = g && g.querySelector('.md-line');
      if (!path) return;
      let dot = dots[part];
      if (!dot) {
        dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('r', String(o.r || 6));
        h.svg.appendChild(dot);
        dots[part] = dot;
      }
      dot.setAttribute('fill', o.color || (h.theme === 'dark' ? '#4DA3FF' : '#0972D3'));
      if (p < 0 || p > 1) { dot.style.opacity = '0'; return; }
      const L = lens.get(path) || path.getTotalLength();
      const pt = path.getPointAtLength(L * p);
      dot.style.opacity = '1';
      dot.setAttribute('cx', pt.x.toFixed(2));
      dot.setAttribute('cy', pt.y.toFixed(2));
    };
    // A part's box in diagram coordinates (for a camera move or a callout).
    h.box = part => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const g of nodes[part] || []) { const b = g.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
      return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    return h;
  }

  return { add: (name, data) => { reg[name] = data; }, get: name => reg[name], list: () => Object.keys(reg), mount };
})();

// "Webb's mirror in 3D": a three-slide test of kit.three (motion-slides).
const { seg, eo, eio, lerp, clamp01 } = kit;
Deck.config({
  title: 'Webb\'s mirror in 3D', background: '#0B1020',
  fonts: { display: { family: 'Space Grotesk', weights: [700] }, sans: { family: 'Inter', weights: [400, 600] } },
});
Deck.css(`
#stage { --ground:#0B1020; --main:#5AA9FF; --ink:#EEF2FA; --accent:#F2B63C }
.dk-rect { background:var(--ground); box-shadow:none }
.cap { position:absolute; left:80px; top:60px; width:1440px; color:var(--ink) }
.cap h2 { margin:0; font:700 64px/1.1 var(--display) } .cap p { margin:14px 0 0; font:400 34px/1.3 var(--sans); opacity:.8 }
`);

Deck.frame('title', { kick: 'A test of the 3D option', title: 'Webb\'s mirror, in three dimensions', sub: 'Eighteen gold hexagons that had to fold to fit a rocket.' });

Deck.frame('mirror3d', { name: 'The mirror in 3D',
  notes: 'Arrival: the 18 segments assemble. Click 1: turn it to see the depth. Click 2: the side wings fold back, as they were for launch. Click 3: they unfold in space and the gold coating appears.',
  anim: { dur: 12, stops: [3, 6, 9], ambient: true,
    init(k) {
      const v = k.three(k.stage, { fov: 32, dist: 13.5 }), T = v.THREE; this.v = v;   // the 3D first, the caption after it (on top)
      k.stage.insertAdjacentHTML('beforeend', '<div class="cap"><h2 class="h"></h2><p class="s"></p></div>');
      this.h = k.stage.querySelector('.h'); this.s = k.stage.querySelector('.s');
      this.rig = new T.Group(); v.scene.add(this.rig);
      const R = 0.62, geo = new T.CylinderGeometry(R, R, 0.16, 6); geo.rotateX(Math.PI / 2); geo.rotateZ(Math.PI / 6);
      this.segs = []; this.wingL = new T.Group(); this.wingR = new T.Group(); this.rig.add(this.wingL, this.wingR);
      const dx = R * Math.sqrt(3) * 1.04, dy = R * 1.5 * 1.04, hinge = dx * 1.5;
      this.wingL.position.x = -hinge; this.wingR.position.x = hinge;
      for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
        const s = -q - r, ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s)); if (ring === 0 || ring > 2) continue;
        const x = dx * (q + r / 2), y = dy * r, m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x8e96a3, metalness: .3, roughness: .45 }));
        const parent = x < -hinge + .01 ? this.wingL : x > hinge - .01 ? this.wingR : this.rig;
        m.position.set(x - parent.position.x, y, 0); parent.add(m); this.segs.push({ m, d: Math.hypot(x, y) });
      }
      this.segs.sort((a, b) => a.d - b.d);
      this.grey = new T.Color(0x8e96a3); this.gold = new T.Color(0xffc24a);
      const fill = new T.DirectionalLight(0xfff1d6, 1.6); fill.position.set(-5, 2, 6); v.scene.add(fill);
    },
    render(t, k) {
      kit.say(this.h, [[0, 'Eighteen hexagons, one mirror.'], [3, 'Turn it, and it has depth.'], [6, 'Folded to fit the rocket.'], [9, 'Unfolded, and coated in gold.']], t);
      kit.say(this.s, [[0, '6.5 metres across.'], [3, 'Each segment can be nudged by tiny motors.'], [6, 'The two side wings swung back for launch.'], [9, 'Gold reflects infrared light superbly.']], t);
      this.segs.forEach((o, n) => { const p = eo(seg(t, .3 + n * .1, .9 + n * .1)); o.m.scale.setScalar(Math.max(.001, p));
        o.m.material.color.copy(this.grey).lerp(this.gold, eo(seg(t, 9.6 + n * .04, 10.4 + n * .04)));
        o.m.material.metalness = lerp(.3, .55, seg(t, 9.6, 10.6)); o.m.material.roughness = lerp(.45, .3, seg(t, 9.6, 10.6)); });
      const fold = eio(seg(t, 6.3, 7.8)) - eio(seg(t, 9.0, 10.2));
      this.wingL.rotation.y = -fold * 1.9; this.wingR.rotation.y = fold * 1.9;
      const turn = eio(seg(t, 3.2, 5)), sway = .12 * Math.sin(k.clock * .5) * seg(k.clock, 1, 3);   // the slow sway is ambient
      this.rig.rotation.y = turn * -.75 + sway; this.rig.rotation.x = turn * .28;
      this.rig.position.y = -1.05;
      this.v.render();
    } } });

Deck.frame('flat', { kick: 'Recap', title: 'Why it folds', points: ['6.5 m mirror', 'Rocket fairing 5 m wide', 'Wings fold back', 'Unfold in space'] });

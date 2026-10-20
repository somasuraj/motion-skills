// "Bean to cup" — a zooming talk in five stops around a hub, one stop with nested detail.
// Style: warm café map · Colors: espresso ground, caramel main, cream ink, honey accent · Fonts: Fraunces over Inter.
Deck.config({
  title: 'Bean to cup', background: '#1B1410', style: 'canvas',
  fonts: { display: { family: 'Fraunces', weights: [600, 700] }, sans: { family: 'Inter', weights: [400, 600] }, mono: { family: 'JetBrains Mono', weights: [600] } },
  notes: 'The whole journey on one map. We will visit each stop in turn; press O any time to see the map again.',
});
Deck.css(`
#stage { --ground:#1B1410; --main:#C8874A; --ink:#F6EEE4; --accent:#E8B04B }
.dk-title { font-size:112px }
.hub .dk-title { font-size:150px }
.hub .dk-sub { font-size:50px }
.stat { margin-top:36px; display:flex; gap:22px }
.stat div { padding:22px 26px; border-radius:28px; background:color-mix(in srgb, var(--main) 18%, var(--ground)) }
.stat b { display:block; font-family:var(--display, serif); font-size:68px; white-space:nowrap; color:var(--accent) }
.stat span { font-size:30px; color:var(--dim) }
`);

Deck.frame('cup', { cls: 'hub', shape: 'circle', w: 2000, kick: 'A five-stop journey', title: 'Bean to cup', sub: 'Where your morning coffee really comes from.',
  notes: 'Open on the map. Five stops, clockwise from the top.' });
Deck.frame('grow', { shape: 'circle', kick: '01 · Grow', title: 'It starts as a cherry', points: ['Grown in a belt around the equator', 'Takes three to four years to fruit', 'Two seeds in every cherry'],
  notes: 'The bean is the seed of a red fruit. Altitude and shade shape its flavour.' });
Deck.frame('pick', { shape: 'circle', kick: '02 · Pick', title: 'Picked by hand', points: ['Cherries ripen unevenly', 'Pickers pass the same tree many times', 'Only the red ones make the cut'],
  notes: 'Selective picking is slow and expensive, and it is where quality is decided.' });
Deck.frame('process', { shape: 'circle', kick: '03 · Process', title: 'Fruit off, seed out', points: ['Washed: clean, bright cups', 'Natural: dried whole, fruity', 'Honey: somewhere in between'],
  notes: 'The method changes the taste as much as the farm does.' });
Deck.frame('roast', { shape: 'circle', w: 1900, kick: '04 · Roast', title: 'Heat makes the flavour', sub: 'Three common roasts. Zoom in on each.',
  notes: 'This stop has detail inside it. We zoom into each roast, then come back out.' });
Deck.frame('light', { parent: 'roast', kick: 'Light', title: 'Bright & fruity', points: ['Keeps the origin character', 'Higher acidity'], reveal: false, notes: 'Popular for filter coffee.' });
Deck.frame('medium', { parent: 'roast', kick: 'Medium', title: 'Sweet & balanced', points: ['Caramel and nuts', 'The crowd-pleaser'], reveal: false, notes: 'The default for most cafés.' });
Deck.frame('dark', { parent: 'roast', kick: 'Dark', title: 'Bold & bitter', points: ['Chocolate and smoke', 'Built for milk drinks'], reveal: false, notes: 'Origin flavour gives way to roast flavour.' });
Deck.frame('brew', { shape: 'circle', kick: '05 · Brew', title: 'The last two minutes',
  html: '<div class="stat"><div><b>93°C</b><span>water</span></div><div><b>1 : 16</b><span>coffee to water</span></div><div><b>3 min</b><span>contact</span></div></div>',
  notes: 'Everything before this can be undone by bad brewing. Three numbers to remember.' });

Deck.layout('ring', ['cup', 'grow', 'pick', 'process', 'roast', 'brew'], { center: 'cup' });

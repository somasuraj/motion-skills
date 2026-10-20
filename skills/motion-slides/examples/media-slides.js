// Real images (fetched with their licence), a YouTube slide and two interactive slides (a quiz and a slider).
// Build: python ../scripts/build.py media-slides.js -o media.html  (from this folder, so images/ resolves)
Deck.config({ title: 'Images, video and interaction', background: '#0E1726' });
Deck.css(`#stage { --ground:#0E1726; --main:#4C9BFF; --ink:#EEF3FA; --accent:#FFB547 }
.q { display:flex; gap:20px; margin-top:30px } .q button { font:600 36px/1 var(--sans, sans-serif); padding:22px 30px; border-radius:16px; border:3px solid var(--line); background:var(--panel); color:var(--ink); cursor:pointer }
.q button.ok { border-color:#4ED38A } .q button.no { border-color:#FF7A7A } .fb { font-size:36px; margin-top:24px; min-height:44px }`);
Deck.credits('images/credits.json');
Deck.frame('photo', { name: 'The mirror', notes: 'A real photo: credit on the slide, and again on the credits slide at the end.', credit: 'webb-mirror.jpg', shape: 'none', html: '<img src="' + asset('images/webb-mirror.jpg') + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' });
Deck.frame('vid', { name: 'A video', notes: 'Plays when the deck is opened from a website; from a file it shows the thumbnail and a Watch on YouTube link.', youtube: { id: 'aqz-KE-bpKQ', title: 'Big Buck Bunny (Blender Foundation)', start: 30 } });
Deck.frame('quiz', { name: 'Quiz', title: 'Why is the mirror gold?', interactive: {
  init(k) { const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:130px;top:330px;right:130px';
    box.innerHTML = '<div class="q"><button data-a="0">It looks nice</button><button data-a="1">Gold reflects infrared</button><button data-a="0">It is cheaper</button></div><p class="fb"></p>';
    box.querySelectorAll('button').forEach(b => b.onclick = () => { box.querySelectorAll('button').forEach(x => x.className = ''); b.className = b.dataset.a === '1' ? 'ok' : 'no'; box.querySelector('.fb').textContent = b.dataset.a === '1' ? 'Right: gold reflects infrared light very well.' : 'Not quite. Try again.'; });
    k.stage.append(box); } } });
Deck.frame('slider', { name: 'Slider', title: 'Stretch the light', interactive: {
  init(k) { const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:130px;top:340px;right:130px';
    box.innerHTML = '<div class="sw" style="height:200px;border-radius:24px"></div><input type="range" min="400" max="2000" value="450" style="width:100%;margin-top:30px"><p class="fb"></p>';
    const sw = box.querySelector('.sw'), r = box.querySelector('input'), fb = box.querySelector('.fb');
    const upd = () => { const v = +r.value; sw.style.background = v < 700 ? 'hsl(' + (260 - (v - 400) * .8) + ',90%,60%)' : '#3a1210'; fb.textContent = v + ' nm · ' + (v < 700 ? 'visible light' : 'infrared: invisible to us, clear to Webb'); };
    r.oninput = upd; upd(); k.stage.append(box); } } });

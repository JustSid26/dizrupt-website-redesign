/* =========================================================
   Menu — "channel change".

   Opening it retunes the screen: nine bands of signal slide in from alternating sides, each carrying
   a thin red and blue ghost that settles into register as it lands, like a picture locking onto a
   new channel. Then the words decode out of noise, left to right. Closing runs the bands back out
   the way they came, twice as fast.

   The six solutions live here too. Hovering one hands the particle field that solution's shape (the
   same models the case studies use) — the menu is a way to feel what Dizrupt does, not a list.
   ========================================================= */

const SOLUTIONS = [
  { name: 'Social & Paid Media', line: 'Strategy, content plans and paid boosting that grow the audience and the sales behind it.', shape: 'hanger', colors: ['#ff3d8b', '#ffc2da'], work: 'SlickFix · Kiaash' },
  { name: 'Branding', line: 'Names, identities and logos built on research into the sector they have to stand out in.', shape: 'shield', colors: ['#3d6bff', '#b8c8ff'], work: 'Alwrite · KP Packaging' },
  { name: 'Website Development', line: 'Full UX/UI revamps and builds that meet the standard of the brands they represent.', shape: 'openBox', colors: ['#1fd6b8', '#2a6bff'], work: 'Mae Mae Industrial · Furnfetch' },
  { name: 'Search Engine Optimisation', line: 'Technical and content SEO that puts the business in front of the people already looking.', shape: 'windscreen', colors: ['#2ad4ff', '#dff6ff'], work: 'AVG Windscreens · KP Packaging' },
  { name: 'Digital Content Creation', line: 'Launch films, artist reveals and campaign content made to move as fast as the brand.', shape: 'vinyl', colors: ['#8a5bff', '#ff4fd8'], work: 'Nykonos · Samir Gems · Maverick' },
  { name: 'Production', line: 'Shoots and production for products that have to look as good as they are.', shape: 'glasses', colors: ['#ff5b5b', '#ffc9b8'], work: 'Crossline · SlickFix' },
];

const BANDS = 9;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, r = document) => r.querySelector(s);
const menu = $('#menu');
const btn = $('#menu-btn');
const bandsEl = $('.menu-bands', menu);
const list = $('#menu-solutions');
const site = () => window.site;

// ---------- build ----------
for (let i = 0; i < BANDS; i++) {
  const b = document.createElement('span');
  b.className = 'menu-band';
  b.style.setProperty('--i', i);
  b.style.setProperty('--dir', i % 2 ? 1 : -1);
  bandsEl.appendChild(b);
}
SOLUTIONS.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `
    <button class="sol" type="button" style="--a:${s.colors[0]};--b:${s.colors[1]}">
      <span class="menu-no">${String(i + 1).padStart(2, '0')}</span>
      <span class="sol-body">
        <span class="menu-word sol-name"></span>
        <span class="sol-line"></span>
        <span class="sol-work"></span>
      </span>
    </button>`;
  $('.sol-name', li).textContent = s.name;
  $('.sol-line', li).textContent = s.line;
  $('.sol-work', li).textContent = s.work;
  const b = $('.sol', li);
  const on = () => { list.querySelectorAll('.sol').forEach((x) => x.classList.toggle('is-on', x === b)); site()?.previewShape(s.shape, s.colors); };
  b.addEventListener('pointerenter', on);
  b.addEventListener('focus', on);
  b.addEventListener('click', () => { close(); site()?.menuGo('contact'); });
  list.appendChild(li);
});
menu.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  const where = b.dataset.go;
  close();
  site()?.menuGo(where);
}));

// ---------- decode ----------
const words = () => [...menu.querySelectorAll('.menu-word')];
words().forEach((w) => { w.dataset.text = w.textContent; w.setAttribute('aria-label', w.textContent); });

function decode(el, delay) {
  const text = el.dataset.text;
  if (reduce) { el.textContent = text; return; }
  const start = performance.now() + delay;
  const dur = 380 + text.length * 22;
  const step = (now) => {
    const t = (now - start) / dur;
    if (t < 0) { el.textContent = text.replace(/\S/g, ' '); requestAnimationFrame(step); return; }
    if (t >= 1) { el.textContent = text; return; }
    const lock = Math.floor(t * text.length);
    el.textContent = [...text].map((c, i) =>
      c === ' ' ? ' ' : i < lock ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- open / close ----------
let isOpen = false;
let hideTimer = 0;
function open() {
  if (isOpen) return;
  isOpen = true;
  clearTimeout(hideTimer);
  menu.hidden = false;
  menu.classList.remove('closing');
  // next frame, so the bands start from off-screen
  requestAnimationFrame(() => menu.classList.add('open'));
  document.body.classList.add('menu-open');
  btn.setAttribute('aria-expanded', 'true');
  btn.querySelector('.menu-btn-label').textContent = 'Close';
  words().forEach((w, i) => decode(w, 380 + i * 55));
  setTimeout(() => menu.querySelector('[data-go]')?.focus({ preventScroll: true }), reduce ? 0 : 420);
}
function close() {
  if (!isOpen) return;
  isOpen = false;
  menu.classList.remove('open');
  menu.classList.add('closing');
  document.body.classList.remove('menu-open');
  btn.setAttribute('aria-expanded', 'false');
  btn.querySelector('.menu-btn-label').textContent = 'Menu';
  list.querySelectorAll('.sol').forEach((x) => x.classList.remove('is-on'));
  site()?.endPreview();
  hideTimer = setTimeout(() => { menu.hidden = true; menu.classList.remove('closing'); }, reduce ? 0 : 700);
  btn.focus({ preventScroll: true });
}

btn.addEventListener('click', () => (isOpen ? close() : open()));
addEventListener('keydown', (e) => {
  if (!isOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'Tab') {
    // keep focus inside the menu while it is open
    const f = [btn, ...menu.querySelectorAll('button, a')];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});
// Leaving the list lets the field go back to the page underneath, even with the menu still open.
list.addEventListener('pointerleave', () => {
  list.querySelectorAll('.sol').forEach((x) => x.classList.remove('is-on'));
  site()?.endPreview();
});

// Mumbai time in the menu foot
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const tick = () => menu.querySelectorAll('[data-mumbai-time]').forEach((el) => { el.textContent = fmt.format(new Date()); });
tick();
setInterval(tick, 15000);

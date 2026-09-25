const VARIANTS = {
  mask: { number: '01', name: 'Masked Lift', note: 'Editorial clipping and staggered vertical motion. Clean, premium and the safest fit for the current site.' },
  focus: { number: '02', name: 'Optical Focus', note: 'Letters emerge from shallow focus, linking the typography naturally to the selected Depth Rack transition.' },
  axis: { number: '03', name: 'Split Axis', note: 'Opposing horizontal movement creates tension, then resolves into a stable centred composition.' },
  scan: { number: '04', name: 'Scan Resolve', note: 'A single restrained light pass reveals each lockup. Technological, but deliberately avoids a noisy glitch aesthetic.' },
  tracking: { number: '05', name: 'Tracking Lock', note: 'Cinematic spacing tightens into the final typography, giving both pages a measured, confident arrival.' },
};

const variant = document.body.dataset.animation || 'mask';
const config = VARIANTS[variant];

document.body.insertAdjacentHTML('afterbegin', `
  <div class="grain" aria-hidden="true"></div>
  <header class="lab-nav">
    <a class="lab-brand" href="../index.html">DI<span>Z</span>RUPT</a>
    <a class="lab-index" href="index.html">Text motion lab</a>
    <nav aria-label="Text animation variants">
      ${Object.entries(VARIANTS).map(([id, item]) => `<a href="${item.number}-${id}.html"${id === variant ? ' aria-current="page"' : ''}>${item.number}</a>`).join('')}
    </nav>
  </header>

  <main class="comparison">
    <section class="stage stage-intro" aria-label="Intro text preview">
      <canvas class="particle-field" aria-hidden="true"></canvas>
      <span class="stage-label">Intro page</span>
      <div class="intro-copy">
        <h1 class="hero-title split-chars" data-text="DIZRUPT" aria-label="Dizrupt"></h1>
        <p class="intro-tag split-words" data-text="A solutions-led full stack digital marketing agency, headquartered in Mumbai."></p>
      </div>
      <span class="scan-line" aria-hidden="true"></span>
    </section>

    <section class="stage stage-contact" aria-label="Contact text preview">
      <span class="stage-label">Contact page</span>
      <div class="contact-copy">
        <p class="contact-kicker split-words" data-text="Contact"></p>
        <h2 class="contact-title">
          <span class="contact-line split-words" data-text="Have a"></span>
          <strong class="contact-line split-chars" data-text="PROJECT?"></strong>
        </h2>
        <a class="contact-email split-words" href="mailto:shamit.g@dizrupt.in" data-text="shamit.g@dizrupt.in"></a>
        <p class="contact-meta split-words" data-text="+91 99209 39203 · Mumbai, India"></p>
      </div>
      <span class="scan-line" aria-hidden="true"></span>
    </section>
  </main>

  <aside class="lab-caption">
    <span>${config.number} / 05</span>
    <div><strong>${config.name}</strong><p>${config.note}</p></div>
  </aside>
  <button class="replay" type="button"><span>Replay both</span><i>R</i></button>
  <p class="stage-help">Click either half to replay</p>
`);

function splitText(element, mode) {
  const value = element.dataset.text || '';
  const parts = mode === 'words' ? value.split(/(\s+)/) : [...value];
  const visible = parts.filter((part) => part.trim()).length;
  let index = 0;
  element.style.setProperty('--count', visible);
  element.innerHTML = parts.map((part, sourceIndex) => {
    if (!part.trim()) return '<span class="space">&nbsp;</span>';
    const current = index++;
    const mirrored = mode === 'chars' && value === 'DIZRUPT' && sourceIndex === 2 ? ' flip-z' : '';
    return `<span class="unit-wrap${mirrored}" style="--i:${current};--rev:${visible - current - 1}"><span class="unit">${part}</span></span>`;
  }).join('');
}

document.querySelectorAll('.split-chars').forEach((el) => splitText(el, 'chars'));
document.querySelectorAll('.split-words').forEach((el) => splitText(el, 'words'));

function drawParticles(canvas) {
  const ctx = canvas.getContext('2d');
  let points = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let seed = 7241;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    points = Array.from({ length: Math.round(Math.min(520, width * .52)) }, () => ({
      x: random() * width, y: random() * height, size: .3 + random() * 1.25,
      alpha: .04 + random() * .2, phase: random() * Math.PI * 2, speed: .2 + random() * .6,
    }));
  }
  function frame(time) {
    ctx.clearRect(0, 0, width, height);
    for (const point of points) {
      const x = point.x + Math.sin(time * .00011 * point.speed + point.phase) * 8;
      const y = point.y + Math.cos(time * .00008 * point.speed + point.phase) * 5;
      ctx.fillStyle = `rgba(181,220,255,${point.alpha})`;
      ctx.beginPath(); ctx.arc(x, y, point.size, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
}

document.querySelectorAll('.particle-field').forEach(drawParticles);

function replay() {
  document.body.classList.remove('is-running');
  void document.body.offsetWidth;
  document.body.classList.add('is-running');
}

document.querySelector('.replay').addEventListener('click', replay);
document.querySelectorAll('.stage').forEach((stage) => stage.addEventListener('click', replay));
addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'r' || event.key === ' ') replay(); });
requestAnimationFrame(() => requestAnimationFrame(replay));

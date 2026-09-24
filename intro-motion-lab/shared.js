const MOTIONS = {
  vault: { number:'01', name:'Vault Lift', note:'Masked rise · glyph echo · perspective settle', file:'01-vault.html' },
  counterflow: { number:'02', name:'Counterflow', note:'Alternating masks · opposing vertical energy', file:'02-counterflow.html' },
  split: { number:'03', name:'Split Glyph', note:'Upper and lower planes · horizontal fusion', file:'03-split.html' },
  aperture: { number:'04', name:'Aperture Lock', note:'Expanding word window · tracking correction', file:'04-aperture.html' },
  slices: { number:'05', name:'Slice Assembly', note:'Three-band construction · velocity offset', file:'05-slices.html' },
};
const id = document.body.dataset.motion || 'vault';
const config = MOTIONS[id];

const glyphs = [...'DIZRUPT'].map((char,index) => `
  <span class="glyph-shell${index===2?' flip-z':''}" style="--i:${index};--rev:${6-index}" aria-hidden="true">
    <span class="glyph-base">${char}</span>
    <span class="glyph-echo">${char}</span>
    <span class="glyph-slice slice-a">${char}</span>
    <span class="glyph-slice slice-b">${char}</span>
    <span class="glyph-slice slice-c">${char}</span>
  </span>`).join('');

document.body.insertAdjacentHTML('afterbegin', `
  <canvas class="ambient" aria-hidden="true"></canvas><div class="aura" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>
  <header class="lab-nav">
    <a class="lab-brand" href="../index.html">DI<span>Z</span>RUPT</a>
    <a class="lab-index" href="index.html">Intro motion lab</a>
    <nav aria-label="Intro motion variants">${Object.entries(MOTIONS).map(([key,item])=>`<a href="${item.file}"${key===id?' aria-current="page"':''}>${item.number}</a>`).join('')}</nav>
  </header>
  <main class="stage">
    <div class="stage-grid" aria-hidden="true"></div>
    <section class="intro-copy">
      <div class="word-window"><h1 class="intro-word" aria-label="Dizrupt">${glyphs}</h1></div>
      <div class="tag-mask"><p class="intro-tag">A solutions-led full stack digital marketing agency, headquartered in Mumbai.</p></div>
    </section>
    <button class="enter-cue" type="button"><span>Scroll to enter</span><i></i></button>
  </main>
  <aside class="lab-caption"><span>${config.number} / 05</span><div><strong>${config.name}</strong><p>${config.note}</p></div></aside>
  <button class="replay" type="button"><span>Replay</span><i>R</i></button>
  <p class="instruction">Click anywhere or press space</p>
`);

const canvas = document.querySelector('.ambient');
const ctx = canvas.getContext('2d');
let points=[],width=0,height=0,dpr=1,seed=9327;
const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);points=Array.from({length:Math.min(800,Math.round(width*.58))},()=>({x:random()*width,y:random()*height,r:.25+random()*1.25,a:.025+random()*.16,p:random()*6.28,s:.25+random()*.7}))}
function draw(t){ctx.clearRect(0,0,width,height);for(const p of points){const x=p.x+Math.sin(t*.00008*p.s+p.p)*10,y=p.y+Math.cos(t*.00006*p.s+p.p)*7;ctx.fillStyle=`rgba(${p.a>.14?'220,205,178':'151,204,244'},${p.a})`;ctx.beginPath();ctx.arc(x,y,p.r,0,6.28);ctx.fill()}requestAnimationFrame(draw)}
addEventListener('resize',resize);resize();requestAnimationFrame(draw);

function replay(){document.body.classList.remove('is-running');void document.body.offsetWidth;document.body.classList.add('is-running')}
document.querySelector('.replay').addEventListener('click',event=>{event.stopPropagation();replay()});
document.querySelector('.stage').addEventListener('click',replay);
addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'||event.key===' ')replay()});
requestAnimationFrame(()=>requestAnimationFrame(replay));

/* The project page: white ground, the client's banner, the case study under it.

   Opening it is a click-driven version of the "scroll expand" move. The banner starts as the card
   you clicked — same place, same size, on the spiral — and grows into the page's hero band, its
   corners squaring off and its picture settling from a slight zoom, while the white ground rises
   under it and the particle field dissolves. Once the frame has landed exactly on the hero's spot
   the page's own (scrollable) copy of the banner takes over and the flying frame is put away.
   Closing runs the same move backwards, to wherever the card is now. */

import { BANNERS } from './banners.js';
import { CARD_LIGHT } from './spiral.js';

const OPEN_MS = 1150;
const CLOSE_MS = 900;
const LEAD_MS = 200;   // how long the fault runs before the move it sets off actually starts
/* The card dims its banner in the renderer, which works in linear light; CSS brightness works in
   the sRGB the screen is given. The same number in both would not look the same, so the card's
   multiplier is converted here and the flight starts on a picture that matches it exactly. */
const START_LIGHT = CARD_LIGHT <= 0.0031308
  ? CARD_LIGHT * 12.92
  : 1.055 * Math.pow(CARD_LIGHT, 1 / 2.4) - 0.055;
const START_RADIUS = 18;  // the card's corners
const END_RADIUS = 8;     // the hero's
/* The picture is never scaled during the move. It is sized to the frame's height, which barely
   changes between the card and the hero, so widening the frame uncovers more of the same photograph
   rather than sliding it about underneath. Pushing it in and easing it back out, the way a
   scroll-expand does, made the opening look like it was cutting into the part of the picture the
   card had just been showing. */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const ramp = (a, b, t) => smooth((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const page = $('#project');
const scroller = page.querySelector('.project-scroll');
const hero = page.querySelector('.project-hero');
const heroImg = hero.querySelector('img');
const frame = page.querySelector('.project-frame');
const frameImg = frame.querySelector('.project-frame-img');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let raf = 0;
let fromEl = null;   // the card this page grew out of; it is where the page shrinks back to
let isOpen = false;
let closing = false;
let white = 0;       // how much of the white page is up, 0 → 1
let listener = null;

/* The rest of the site watches this move rather than running its own version of it: the spiral uses
   it to lean the card back in step with the frame shrinking, and the particle field uses `white` to
   come apart and back together exactly as the page rises and falls. One clock, so nothing drifts. */
export function onFlight(fn) { listener = fn; }
export const projectWhite = () => white;

let sceneGlitch = null;
/* The particle field faults at the same moment the page does. It belongs to the scene, not to this
   page, so the site hands its own glitch over rather than this reaching across for it. */
export function onGlitch(fn) { sceneGlitch = fn; }

/* A short burst of broken signal on one element: it jumps sideways, loses a band across its middle
   and takes on the red and blue fringing the rest of the site glitches with. Driven frame by frame
   rather than by keyframes, so no two bursts are the same. */
function burst(el, ms, strength = 1) {
  if (reduceMotion) return;
  const started = performance.now();
  el.classList.add('glitching');
  const clear = () => {
    el.classList.remove('glitching');
    el.style.removeProperty('--slip');
    el.style.removeProperty('--rgb');
    el.style.removeProperty('clip-path');
  };
  // a backgrounded tab stops serving frames, and the fault would be left on the page for good
  const guard = setTimeout(clear, ms + 400);
  const step = () => {
    const t = (performance.now() - started) / ms;
    if (t >= 1) {
      clearTimeout(guard);
      clear();
      return;
    }
    // it comes apart hardest at the start and pulls itself together
    const force = (1 - t) * strength;
    el.style.setProperty('--slip', `${((Math.random() - 0.5) * 34 * force).toFixed(1)}px`);
    el.style.setProperty('--rgb', `${(Math.random() * 7 * force).toFixed(1)}px`);
    if (Math.random() < 0.55) {
      const top = Math.random() * 82;
      const height = 4 + Math.random() * 13;
      el.style.clipPath = `inset(0 0 0 0)`;
      el.style.clipPath = `polygon(0 0, 100% 0, 100% ${top}%, 0 ${top}%, 0 ${top + height}%, 100% ${top + height}%, 100% 100%, 0 100%)`;
    } else {
      el.style.removeProperty('clip-path');
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let nextHandler = null;
let nextProject = null;

/* Which project follows this one. The site owns the running order, so it hands that over rather
   than this page guessing at it. */
export function onNext(fn) { nextHandler = fn; }

function fill(p, position = null) {
  const banner = BANNERS[p.title];
  page.style.setProperty('--project-a', p.colors[0]);
  page.style.setProperty('--project-b', p.colors[1]);
  page.classList.toggle('no-banner', !banner);
  heroImg.src = frameImg.src = banner || '';
  heroImg.alt = banner ? `${p.title} — campaign banner` : '';
  page.querySelector('.project-hero-word').textContent = p.title;

  const [sector, place] = (p.tags || '').split('·').map((part) => part.trim());
  $('#project-no').textContent = position ? `Project ${position}` : 'Project';
  $('#project-title').textContent = p.title;
  $('#project-summary').textContent = p.summary ?? '';
  $('#project-client').textContent = [p.title, place].filter(Boolean).join(', ');
  $('#project-services').textContent = p.client ?? '';
  $('#project-sector').textContent = sector ?? '';

  const chapters = $('#project-chapters');
  chapters.hidden = !p.caseStudy;
  if (p.caseStudy) {
    $('#project-ask').textContent = p.caseStudy.ask;
    $('#project-solution').textContent = p.caseStudy.solution;
    $('#project-dizruption').textContent = p.caseStudy.dizruption;
  }

  nextProject = nextHandler?.(p) ?? null;
  const next = $('#project-next');
  next.hidden = !nextProject;
  if (nextProject) $('#project-next-name').textContent = nextProject.title;

  // everything under the banner rises on the page's own count; further down the page, further to go
  const blocks = [...page.querySelectorAll('.project-inner > *')];
  blocks.forEach((block, i) => {
    block.classList.add('project-reveal');
    block.style.setProperty('--rise', `${18 + i * 12}px`);
  });
}

/* Where the frame lands: the hero's box on screen. On the way back the page may have been scrolled,
   putting the hero above the viewport — the banner would then fly in from nowhere — so the box it
   leaves from is held to the edge of the screen. */
function heroRect(clamp = false) {
  const r = hero.getBoundingClientRect();
  const y = clamp ? Math.max(r.top, -r.height * 0.3) : r.top;
  return { x: r.left, y, w: r.width, h: r.height };
}

// Where it starts: the card. If there is none to be had (keyboard, or the card has scrolled away)
// a small box in the middle of the screen stands in for it.
function cardRect() {
  const r = fromEl?.getBoundingClientRect();
  if (r && r.width > 4 && r.height > 4) return { x: r.left, y: r.top, w: r.width, h: r.height };
  const w = Math.min(innerWidth, innerHeight) * 0.36;
  return { x: (innerWidth - w) / 2, y: (innerHeight - w * 0.62) / 2, w, h: w * 0.62 };
}

/* One frame of the move. `t` runs 0 (card) → 1 (hero) either way; closing just runs it down. */
function apply(t, from, to) {
  const e = smooth(t);
  const x = lerp(from.x, to.x, e), y = lerp(from.y, to.y, e);
  const w = lerp(from.w, to.w, e), h = lerp(from.h, to.h, e);
  frame.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
  frame.style.width = `${w.toFixed(2)}px`;
  frame.style.height = `${h.toFixed(2)}px`;
  frame.style.borderRadius = `${lerp(START_RADIUS, END_RADIUS, e).toFixed(2)}px`;
  // it leaves at the brightness the card was holding it at and comes up to full as it lands
  frameImg.style.filter = `brightness(${lerp(START_LIGHT, 1, ramp(0.1, 0.8, t)).toFixed(3)})`;

  // the white ground comes up under the growing frame, and the copy only once it has landed
  white = ramp(0.12, 0.66, t);
  root.style.setProperty('--project-in', white.toFixed(4));
  root.style.setProperty('--project-text', ramp(0.62, 1, t).toFixed(4));
  /* At either end of the move the frame and the card it belongs to are in the same place, so the
     hand-over between them is a short dissolve rather than one being swapped for the other. */
  frame.style.opacity = ramp(0, 0.12, t).toFixed(3);
  listener?.(t, closing);
}

let guard = 0;

function animate(fromT, toT, ms, getFrom, to, done) {
  cancelAnimationFrame(raf);
  clearTimeout(guard);
  /* The card is re-measured on every frame. Going back it is leaning out of the middle of the
     screen and into its place on the spiral while this runs, and a box measured once at the start
     would leave the page landing somewhere the card no longer is. */
  const land = () => { apply(toT, getFrom(), to); done(); };
  if (reduceMotion) { land(); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const k = clamp01((now - t0) / ms);
    apply(lerp(fromT, toT, k), getFrom(), to);
    if (k < 1) raf = requestAnimationFrame(tick);
    else { raf = 0; clearTimeout(guard); done(); }
  };
  raf = requestAnimationFrame(tick);
  /* A background tab stops serving frames, and the move would be left half-made — the page stuck
     behind a frame that never lands and never takes its clicks. The timer keeps running there, so
     it finishes the job if the frames dry up. */
  guard = setTimeout(() => { cancelAnimationFrame(raf); raf = 0; land(); }, ms + 400);
}

export function openProject(p, from = null, done = null, position = null) {
  fromEl = from;
  isOpen = true;
  closing = false;
  fill(p, position);
  scroller.scrollTop = 0;
  page.classList.add('open', 'moving');
  page.classList.remove('settled');
  const end = heroRect();
  apply(0, cardRect(), end);
  burst(frame, 320);       // the banner tears again as it comes off the card; the field already has
  animate(0, 1, OPEN_MS, cardRect, end, () => {
    page.classList.add('settled');
    page.classList.remove('moving');
    done?.();
  });
}

export function closeProject(done = null) {
  if (!isOpen) return;
  isOpen = false;
  closing = true;
  const end = heroRect(true);
  page.classList.add('moving');
  page.classList.remove('settled');
  apply(1, cardRect(), end);
  /* The page breaks up where it stands, and only once it has lost its hold does it start to go.
     Glitching and contracting at the same instant reads as an effect laid over a transition; the
     fault arriving first is what sets the move off. */
  burst(scroller, 420, 0.9);
  burst(frame, 460);
  sceneGlitch?.(380);
  setTimeout(() => animate(1, 0, CLOSE_MS, cardRect, end, () => {
    page.classList.remove('open', 'moving');
    closing = false;
    fromEl = null;
    done?.();
  }), LEAD_MS);
}

export const projectOpen = () => isOpen;

/* Moving to the next case does not fly anywhere. The page stays where it is, the copy goes out and
   the next one comes in under a banner that cross-fades — the flight belongs to arriving at the
   work from the spiral and leaving it, not to turning a page. */
export function showNext(position = null, done = null) {
  if (!isOpen || !nextProject) return;
  const project = nextProject;
  page.classList.add('turning');
  setTimeout(() => {
    scroller.scrollTop = 0; // under the fade, so the jump back to the top is never seen
    fill(project, position);
    page.classList.remove('turning');
    done?.(project);
  }, 420);
}

export const projectNext = () => nextProject;

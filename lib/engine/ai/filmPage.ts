import * as THREE from 'three';
import type { TechProject } from '@/content/techProjects';

/* A project page in the AI section for a project with a film: drawn in the product's own look rather
   than the console, with the film playing live in it. The page is laid out once; while it is up, the
   film's frame, the chapter it's on and the time are drawn over it about thirty times a second.

   The bottom of the page and its top left are left quiet: the section's own controls sit there. */
type Theme = {
  bg: string; bar: string; barLine: string; barInk: string; ink: string; sub: string; line: string;
  acc: string; accInk: string; card: string; dark?: boolean; mark:(g: CanvasRenderingContext2D, x: number, y: number) => void;
};

const THEMES: Record<string, Theme> = {
  // Lead Engine: the cream page and the black rail of the app itself
  'lead-gen': {
    bg: '#eeebe3', bar: '#0d0d0d', barLine: '#0d0d0d', barInk: '#f3f0e8', ink: '#141414', sub: '#5f5c55', line: 'rgba(20,20,20,0.14)',
    acc: '#141414', accInk: '#f3f0e8', card: '#fbfaf7',
    mark: (g, x, y) => {
      // its diamond
      g.strokeStyle = '#f3f0e8'; g.lineWidth = 2.2; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x - 11, y - 4); g.lineTo(x - 6, y - 10); g.lineTo(x + 6, y - 10); g.lineTo(x + 11, y - 4); g.lineTo(x, y + 10); g.closePath();
      g.moveTo(x - 11, y - 4); g.lineTo(x + 11, y - 4); g.stroke();
    },
  },
  // Payment Recon: a white dashboard and its blue
  'payment-recon': {
    bg: '#eef1f7', bar: '#fbfcfe', barLine: '#dde2ec', barInk: '#0f172a', ink: '#0f172a', sub: '#56607a', line: 'rgba(15,23,42,0.12)',
    acc: '#3d5afe', accInk: '#ffffff', card: '#ffffff',
    mark: (g, x, y) => {
      g.fillStyle = '#3d5afe';
      g.beginPath(); g.roundRect(x - 15, y - 15, 30, 30, 8); g.fill();
      g.fillStyle = '#fff'; g.font = '700 13px "Inter Tight", system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('PR', x, y + 5); g.textAlign = 'left';
    },
  },
  // PostStack: the app's night, its violet and the stacked "p" card
  'post-stack': {
    bg: '#101010', bar: '#141217', barLine: '#25202e', barInk: '#f0eefc', ink: '#f0eefc', sub: '#9a94ab', line: 'rgba(240,238,252,0.12)',
    acc: '#7c4dff', accInk: '#ffffff', card: '#1a1622', dark: true,
    mark: (g, x, y) => {
      g.fillStyle = '#5428c6';
      g.beginPath(); g.roundRect(x - 15, y - 11, 26, 26, 6); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(x - 10, y - 16, 26, 26, 6); g.fill();
      g.fillStyle = '#141217'; g.font = '800 18px "Inter Tight", system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('p', x + 3, y + 2); g.textAlign = 'left';
    },
  },
};

export const hasFilmPage = (pj: TechProject) => !!(pj.video && pj.chapters?.length && THEMES[pj.slug]);

const W = 1600, H = 900;
// the site's vignette is for the night: over a light page it only muddies it, so it eases off
let upCount = 0;
const soften = (d: number) => { upCount += d; document.body.classList.toggle('is-light-page', upCount > 0); };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function filmPage(pj: TechProject, k: number) {
  const th = THEMES[pj.slug];
  const chapters = pj.chapters!;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const b = base.getContext('2d')!;
  const sans = (px: number, w = 500) => `${w} ${px}px "Inter Tight", system-ui, sans-serif`;
  const mono = (px: number, w = 500) => `${w} ${px}px "JetBrains Mono", Menlo, monospace`;
  const no = String(k + 1).padStart(2, '0');

  // the film's window
  const FX = 652, FY = 128, FW = 876, CH = 40, FH = Math.round(FW * 0.5625);
  const TY = FY + CH + FH + 34; // the chapter bar

  const wrap = (x: CanvasRenderingContext2D, text: string, px: number, py: number, maxW: number, lh: number, maxLines: number) => {
    const words = text.split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (x.measureText(test).width > maxW && line) {
        if (n === maxLines - 1) { while (x.measureText(`${line}…`).width > maxW) line = line.slice(0, -1); x.fillText(`${line}…`, px, py + n * lh); return py + (n + 1) * lh; }
        x.fillText(line, px, py + n * lh); n++; line = w;
      } else line = test;
    }
    x.fillText(line, px, py + n * lh);
    return py + (n + 1) * lh;
  };

  const layout = () => {
    b.fillStyle = th.bg; b.fillRect(0, 0, W, H);
    // the app's bar, its mark and name on the right (the site's nav is over the left and middle)
    b.fillStyle = th.bar; b.fillRect(0, 0, W, 72);
    b.fillStyle = th.barLine; b.fillRect(0, 72, W, 1);
    b.font = sans(20, 600); b.textAlign = 'right'; b.fillStyle = th.barInk;
    b.fillText(pj.name, W - 64, 43);
    const nw = b.measureText(pj.name).width;
    b.textAlign = 'left';
    th.mark(b, W - 64 - nw - 26, 36);

    // the project
    const L = 72, LW = 520;
    b.font = mono(14, 500); b.fillStyle = th.sub;
    b.fillText(`FEATURED WORK ${no}  ·  ${pj.about.toUpperCase()}  ·  ${pj.year}`, L, 176);
    b.font = sans(78, 600); b.fillStyle = th.ink;
    b.fillText(pj.name, L - 3, 258);
    b.font = sans(23, 400); b.fillStyle = th.ink;
    let y = wrap(b, pj.summary, L, 314, LW, 33, 4);
    b.fillStyle = th.line; b.fillRect(L, y + 10, LW, 1);
    b.font = mono(13, 600); b.fillStyle = th.sub;
    b.fillText('WHAT IT CHANGED', L, y + 46);
    b.font = sans(19, 400); b.fillStyle = th.sub;
    y = wrap(b, pj.result, L, y + 78, LW, 28, 3);
    // the stack, as the app's own tags
    b.font = sans(15, 500);
    let cx = L, cy = y + 24;
    for (const st of pj.stack.slice(0, 7)) {
      const w = b.measureText(st).width + 26;
      if (cx + w > L + LW) { cx = L; cy += 40; }
      if (cy > 690) break;
      b.fillStyle = th.card; b.beginPath(); b.roundRect(cx, cy, w, 30, 15); b.fill();
      b.strokeStyle = th.line; b.lineWidth = 1; b.stroke();
      b.fillStyle = th.ink; b.fillText(st, cx + 13, cy + 20);
      cx += w + 8;
    }

    // the film's window: a soft card with a title strip
    b.save();
    b.shadowColor = 'rgba(20,20,40,0.18)'; b.shadowBlur = 40; b.shadowOffsetY = 16;
    b.fillStyle = th.card; b.beginPath(); b.roundRect(FX, FY, FW, CH + FH, 14); b.fill();
    b.restore();
    b.strokeStyle = th.line; b.lineWidth = 1; b.beginPath(); b.roundRect(FX + 0.5, FY + 0.5, FW - 1, CH + FH - 1, 14); b.stroke();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { b.fillStyle = col; b.beginPath(); b.arc(FX + 22 + i * 18, FY + CH / 2, 5.5, 0, 7); b.fill(); });
    b.fillStyle = th.line; b.fillRect(FX, FY + CH - 1, FW, 1);
  };
  layout();

  const video = document.createElement('video');
  Object.assign(video, { src: pj.video!, muted: true, loop: true, playsInline: true, preload: 'auto' });
  const still = new Image();
  still.onload = () => { dirty = true; };
  if (pj.still) still.src = pj.still;
  // the base is drawn in the site's fonts: lay it out again once they are in
  document.fonts?.ready.then(() => { layout(); dirty = true; });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let dirty = true, last = -1, playing = false;

  const draw = () => {
    g.drawImage(base, 0, 0);
    const t = video.currentTime || 0, dur = video.duration || chapters[chapters.length - 1].at + 4;
    const ready = video.readyState >= 2;
    // the film, its corners rounded into the card
    g.save();
    g.beginPath(); g.roundRect(FX, FY + CH, FW, FH, [0, 0, 14, 14]); g.clip();
    if (ready) g.drawImage(video, FX, FY + CH, FW, FH);
    else if (still.complete && still.naturalWidth) g.drawImage(still, FX, FY + CH, FW, FH);
    else { g.fillStyle = th.bg; g.fillRect(FX, FY + CH, FW, FH); }
    g.restore();
    let at = 0;
    for (let i = 0; i < chapters.length; i++) if (t >= chapters[i].at) at = i;
    // the strip: the chapter it's on, and the time
    g.font = sans(15, 600); g.fillStyle = th.ink; g.textAlign = 'center';
    g.fillText(`${chapters[at].label}`, FX + FW / 2, FY + CH / 2 + 5);
    g.textAlign = 'right'; g.font = mono(13); g.fillStyle = th.sub;
    g.fillText(`${mmss(t)} / ${mmss(dur)}`, FX + FW - 18, FY + CH / 2 + 5);
    g.textAlign = 'left';
    // the film in its chapters: one segment each, the one playing filling as it goes
    const gap = 6;
    const total = FW - gap * (chapters.length - 1);
    let x = FX, overrun = false;
    for (let i = 0; i < chapters.length; i++) {
      const a = chapters[i].at, e = i + 1 < chapters.length ? chapters[i + 1].at : dur;
      const w = Math.max(8, ((e - a) / dur) * total);
      const fill = i < at ? 1 : i > at ? 0 : Math.min(1, Math.max(0, (t - a) / (e - a)));
      g.fillStyle = th.line; g.beginPath(); g.roundRect(x, TY, w, 4, 2); g.fill();
      if (fill > 0) { g.fillStyle = th.acc; g.beginPath(); g.roundRect(x, TY, Math.max(4, w * fill), 4, 2); g.fill(); }
      // a label where it fits in its segment; the one playing always, and the one after it gives way
      // if the playing one runs over
      g.font = i === at ? sans(14, 600) : sans(14, 400);
      const lw = g.measureText(chapters[i].label).width;
      if (i === at || (lw + 10 < w && !(i === at + 1 && overrun))) {
        g.fillStyle = i === at ? th.ink : th.sub;
        g.fillText(chapters[i].label, x, TY + 28);
      }
      if (i === at) overrun = lw + 10 > w;
      x += w + gap;
    }
    // what's playing, under the project's copy
    g.fillStyle = th.acc; g.beginPath(); g.arc(78, TY + 2, 5, 0, 7); g.fill();
    g.font = mono(13, 600); g.fillStyle = th.ink;
    g.fillText(`LIVE DEMO  ·  ${String(at + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}  ${chapters[at].label.toUpperCase()}`, 94, TY + 7);
    g.font = sans(17, 400); g.fillStyle = th.sub;
    wrap(g, chapters[at].title, 72, TY + 38, 520, 24, 2);
    tex.needsUpdate = true;
  };

  return {
    tex: tex as THREE.Texture,
    /** Called every frame: the film plays while its page is up, and the page is drawn while it does. */
    tick(time: number, up: boolean) {
      // a night page keeps the vignette
      if (up && !playing) { playing = true; if (!th.dark) soften(1); video.play().catch(() => {}); }
      if (!up && playing) { playing = false; if (!th.dark) soften(-1); video.pause(); }
      if ((playing && time - last > 1 / 30) || dirty) { last = time; dirty = false; draw(); }
    },
  };
}

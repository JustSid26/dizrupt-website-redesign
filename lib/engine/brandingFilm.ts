import * as THREE from 'three';

/* =========================================================
   Branding's billboard: a short film, drawn live.

   A painter at an easel, late in the studio. The canvas has
   DIZRUPT pencilled on it; they load the brush and paint it
   in, letter by letter, going back to the palette for violet
   before the mirrored Z. They step back and sign it, the
   camera comes in on the finished mark, the wet paint catches
   the light, the Z loses the signal the way it does on the
   landing, and the brand's colours pin up beside it.

   The letters are painted for real: brush strokes swept over
   the lettering's mask, the arm posed from the brush tip.
   draw(t) renders the frame t seconds into the loop.
   ========================================================= */
export const BRANDING_FILM_LENGTH = 10;

const VIOLET = '#a310e7', BLUE = '#3d6bff', MIST = '#b8c8ff', INK = '#07060e', PAPER = '#efe9de';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const out = (x: number) => 1 - (1 - x) ** 3;
const pop = (x: number) => { const c = 1.7; const y = x - 1; return x <= 0 ? 0 : 1 + (c + 1) * y ** 3 + c * y ** 2; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type G = CanvasRenderingContext2D;
type V = { x: number; y: number };

const WORD = ['D', 'I', 'Z', 'R', 'U', 'P', 'T'];
// when each letter is painted [start, end], and the trips to the palette between
const PAINT: [number, number][] = [[0.7, 1.45], [1.6, 2.0], [2.65, 3.45], [4.05, 4.8], [4.95, 5.7], [5.85, 6.5], [6.65, 7.3]];
const DIPS: [number, number][] = [[0.25, 0.6], [2.1, 2.55], [3.55, 3.95]]; // white, violet, white
const SIGN: [number, number] = [7.55, 8.05];
const STEP_BACK: [number, number] = [8.1, 8.6]; // out of the way of the finished mark

export function createBrandingFilm(W = 1600, H = 660) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  /* ---- the studio's layout (canvas pixels) ---- */
  const FLOOR = 600;
  const P = { x: 600, y: 40, w: 680, h: 330 }; // the painting, on its easel
  // the artist is drawn a little smaller than life about their feet, so their head stays under the lettering
  const S = 0.8;
  const font = (s: number) => `800 ${s}px "Inter Tight", system-ui, sans-serif`;

  /* ---- the lettering, laid out once on the painting ---- */
  const make = () => { const c = document.createElement('canvas'); c.width = P.w; c.height = P.h; return c; };
  const art = make(), mask = make(), wet = make();
  const ag = art.getContext('2d')!, mg = mask.getContext('2d')!, wg = wet.getContext('2d')!;
  ag.font = font(150);
  const w0 = ag.measureText('DIZRUPT').width;
  const fs = Math.min(150 * (P.w * 0.82) / w0, P.h * 0.5);
  ag.font = font(fs);
  const total = ag.measureText('DIZRUPT').width;
  const mid = P.h * 0.4; // the lettering sits high on the canvas, above the artist's head
  const letters = WORD.map((l, i) => {
    const x0 = (P.w - total) / 2 + ag.measureText(WORD.slice(0, i).join('')).width;
    const w = ag.measureText(l).width;
    return { l, x0, w, top: mid - fs * 0.39, bot: mid + fs * 0.39, flip: l === 'Z' };
  });
  const glyph = (c: G, L: (typeof letters)[number], dx = 0) => {
    c.save();
    if (L.flip) { c.translate(L.x0 + L.w / 2 + dx, mid); c.scale(-1, 1); c.fillText(L.l, -L.w / 2, 0); }
    else c.fillText(L.l, L.x0 + dx, mid);
    c.restore();
  };
  // the finished paint: flat colour, then bristle streaks laid along the strokes
  ag.textBaseline = 'middle';
  letters.forEach((L) => { ag.fillStyle = L.flip ? VIOLET : '#f7f4ff'; glyph(ag, L); });
  ag.globalCompositeOperation = 'source-atop';
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 900; i++) {
    const y = mid - fs * 0.42 + rnd() * fs * 0.84, x = rnd() * P.w, len = 30 + rnd() * 90;
    ag.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.06 + rnd() * 0.12})`;
    ag.lineWidth = 0.6 + rnd() * 1.6;
    ag.beginPath(); ag.moveTo(x, y); ag.lineTo(x + len, y + (rnd() - 0.5) * 3); ag.stroke();
  }
  ag.globalCompositeOperation = 'source-over';

  /* ---- each letter's brush path: rows swept back and forth across it ---- */
  const ROWS = 4;
  const strokePath = (L: (typeof letters)[number]) => {
    const pts: V[] = [];
    const pad = fs * 0.06;
    for (let r = 0; r < ROWS; r++) {
      const y = L.top + ((r + 0.5) / ROWS) * (L.bot - L.top);
      const a = L.x0 - pad, b = L.x0 + L.w + pad;
      if (r % 2) pts.push({ x: b, y }, { x: a, y: y + 2 }); else pts.push({ x: a, y }, { x: b, y: y + 2 });
    }
    return pts;
  };
  const paths = letters.map(strokePath);
  const lens = paths.map((ps) => ps.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0));
  const along = (ps: V[], len: number, k: number): V => {
    let d = k * len;
    for (let i = 1; i < ps.length; i++) {
      const sl = Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y);
      if (d <= sl) { const f = d / sl; return { x: lerp(ps[i - 1].x, ps[i].x, f), y: lerp(ps[i - 1].y, ps[i].y, f) }; }
      d -= sl;
    }
    return ps[ps.length - 1];
  };
  const STROKE = ((letters[0].bot - letters[0].top) / ROWS) * 1.5;

  /* ---- where the artist stands: shuffling along the canvas with the work ---- */
  const REACH = 190; // how far right of their feet the brush tip lands, painting overhead
  const standAt = (t: number) => {
    if (t >= STEP_BACK[0]) return P.x - 190 + REACH; // stepped aside, clear of the canvas
    if (t >= 7.3) return P.x + P.w - 85; // signing
    let i = PAINT.findIndex(([, e]) => t < e);
    if (i < 0) i = PAINT.length - 1;
    const L = letters[i];
    return P.x + L.x0 + L.w / 2;
  };
  // averaged over the last moment, so they shuffle along with the work rather than jump
  const bodyX = (t: number) => {
    let s = 0;
    for (let k = 0; k < 10; k++) s += standAt(Math.max(0, t - k * 0.09));
    const back = ease(seg(t, 9.45, 10)); // and in again for the loop
    return lerp(s / 10 - REACH, standAt(0) - REACH, back);
  };
  // the artist's own frame (drawn at S about their feet) to the studio's
  const world = (bx: number, x: number, y: number) => ({ x: bx + (x - bx) * S, y: FLOOR + (y - FLOOR) * S });
  const palette = (bx: number) => world(bx, bx + 50, 395);

  // the brush tip at time t, and whether it is on the canvas
  function brush(t: number): { tip: V; painting: boolean; color: string } {
    const bx = bodyX(t), pal = palette(bx);
    const rest = world(bx, bx + 190, 330);
    const dip = DIPS.findIndex(([a, b]) => t >= a - 0.2 && t <= b + 0.15);
    for (let i = 0; i < PAINT.length; i++) {
      const [a, b] = PAINT[i];
      if (t >= a && t <= b) {
        const p = along(paths[i], lens[i], ease(seg(t, a, b)) * 0.15 + seg(t, a, b) * 0.85);
        return { tip: { x: P.x + p.x, y: P.y + p.y + Math.sin(t * 40) * 1.2 }, painting: true, color: letters[i].flip ? VIOLET : '#fff' };
      }
    }
    if (dip >= 0) {
      const [a, b] = DIPS[dip];
      const swirl = seg(t, a, b);
      const from = dip === 0 ? rest : endOf(dip === 1 ? 1 : 2);
      const k = ease(seg(t, a - 0.2, a));
      const at = { x: pal.x + 10 + Math.cos(swirl * 12) * 8, y: pal.y - 6 + Math.sin(swirl * 12) * 3 };
      const leave = ease(seg(t, b, b + 0.15));
      const next = startOf(dip === 0 ? 0 : dip === 1 ? 2 : 3);
      return { tip: { x: lerp(lerp(from.x, at.x, k), next.x, leave), y: lerp(lerp(from.y, at.y, k), next.y, leave) }, painting: false, color: '#fff' };
    }
    // between letters: through the air from the end of one to the start of the next
    for (let i = 1; i < PAINT.length; i++) {
      const [, pe] = PAINT[i - 1], [ns] = PAINT[i];
      if (t > pe && t < ns) { const k = ease(seg(t, pe, ns)); const a = endOf(i - 1), b = startOf(i); return { tip: { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * 18 }, painting: false, color: '#fff' }; }
    }
    // the signature, then at rest
    const sk = seg(t, SIGN[0], SIGN[1]);
    if (t >= 7.3 && t < SIGN[1] + 0.3) {
      const sig = { x: P.x + P.w - 120 + sk * 70, y: P.y + P.h - 34 + Math.sin(sk * 18) * 6 };
      const k = ease(seg(t, 7.3, SIGN[0]));
      const a = endOf(PAINT.length - 1);
      const lift = ease(seg(t, SIGN[1], SIGN[1] + 0.3));
      return { tip: { x: lerp(lerp(a.x, sig.x, k), rest.x, lift), y: lerp(lerp(a.y, sig.y, k), rest.y, lift) }, painting: sk > 0 && sk < 1, color: '#fff' };
    }
    if (t < PAINT[0][0]) { const k = ease(seg(t, 0.6, 0.7)); const s0 = startOf(0); return { tip: { x: lerp(rest.x, s0.x, k), y: lerp(rest.y, s0.y, k) }, painting: false, color: '#fff' }; }
    return { tip: rest, painting: false, color: '#fff' };
  }
  function startOf(i: number): V { const p = paths[i][0]; return { x: P.x + p.x, y: P.y + p.y }; }
  function endOf(i: number): V { const p = paths[i][paths[i].length - 1]; return { x: P.x + p.x, y: P.y + p.y }; }

  /* ---- the painting itself ---- */
  function painting(t: number) {
    // the canvas board and its weave
    g.fillStyle = PAPER; g.fillRect(P.x, P.y, P.w, P.h);
    g.fillStyle = 'rgba(0,0,0,0.035)';
    for (let x = 0; x < P.w; x += 4) g.fillRect(P.x + x, P.y, 1, P.h);
    for (let y = 0; y < P.h; y += 4) g.fillRect(P.x, P.y + y, P.w, 1);
    // a dark ground the artist laid first, so the white reads
    const gr = g.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h);
    gr.addColorStop(0, '#14102a'); gr.addColorStop(1, '#0b1030');
    g.fillStyle = gr; g.fillRect(P.x + 10, P.y + 10, P.w - 20, P.h - 20);
    // the pencil sketch, fading as the paint covers it
    g.save();
    g.translate(P.x, P.y);
    g.font = font(fs); g.textBaseline = 'middle';
    g.strokeStyle = `rgba(184,200,255,${0.28 * (1 - seg(t, 7.6, 8.4))})`; g.lineWidth = 1.2; g.setLineDash([6, 4]);
    letters.forEach((L) => {
      g.save();
      if (L.flip) { g.translate(L.x0 + L.w / 2, mid); g.scale(-1, 1); g.strokeText(L.l, -L.w / 2, 0); } else g.strokeText(L.l, L.x0, mid);
      g.restore();
    });
    g.setLineDash([]);
    // guide lines
    g.strokeStyle = 'rgba(184,200,255,0.12)'; g.lineWidth = 1;
    for (const y of [letters[0].top, letters[0].bot]) { g.beginPath(); g.moveTo(30, y); g.lineTo(P.w - 30, y); g.stroke(); }
    g.restore();

    // the paint: the strokes so far, as a mask over the finished lettering
    mg.clearRect(0, 0, P.w, P.h);
    mg.lineCap = 'round'; mg.lineJoin = 'round'; mg.strokeStyle = '#000';
    letters.forEach((L, i) => {
      const [a, b] = PAINT[i];
      const k = seg(t, a, b);
      if (k <= 0) return;
      const ps = paths[i], d = (ease(k) * 0.15 + k * 0.85) * lens[i];
      mg.lineWidth = STROKE;
      mg.beginPath(); mg.moveTo(ps[0].x, ps[0].y);
      let run = 0;
      for (let j = 1; j < ps.length; j++) {
        const sl = Math.hypot(ps[j].x - ps[j - 1].x, ps[j].y - ps[j - 1].y);
        if (run + sl >= d) { const f = (d - run) / sl; mg.lineTo(lerp(ps[j - 1].x, ps[j].x, f), lerp(ps[j - 1].y, ps[j].y, f)); break; }
        mg.lineTo(ps[j].x, ps[j].y); run += sl;
      }
      mg.stroke();
      void L;
    });
    wg.clearRect(0, 0, P.w, P.h);
    wg.globalCompositeOperation = 'source-over';
    wg.drawImage(art, 0, 0);
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(mask, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    // the Z loses the signal once it's finished, as it does on the landing
    const glitch = t > 8.75 && t < 9.2 && Math.floor(t * 22) % 3 !== 0;
    if (glitch) {
      const Z = letters[2];
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.8;
      g.drawImage(wet, Z.x0 - 20, 0, Z.w + 40, P.h, P.x + Z.x0 - 20 - 9, P.y - 3, Z.w + 40, P.h);
      g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5;
      g.fillStyle = '#ff2d4f';
      g.translate(P.x, P.y);
      g.font = font(fs); g.textBaseline = 'middle';
      glyph(g, Z, 7);
      g.fillStyle = '#2f6bff'; glyph(g, Z, -7);
      g.restore();
    }
    g.drawImage(wet, P.x, P.y);
    // drips running down from each letter as it dries
    letters.forEach((L, i) => {
      const k = seg(t, PAINT[i][1], PAINT[i][1] + 1.6);
      if (k <= 0) return;
      for (let d = 0; d < 2; d++) {
        const x = P.x + L.x0 + L.w * (0.25 + d * 0.45) + (i % 2) * 6;
        const len = out(k) * (14 + ((i * 7 + d * 13) % 18));
        g.fillStyle = L.flip ? VIOLET : '#f2efff';
        g.fillRect(x, P.y + L.bot - 4, 4, len);
        g.beginPath(); g.arc(x + 2, P.y + L.bot - 4 + len, 3, 0, Math.PI * 2); g.fill();
      }
    });
    // the signature
    const sk = seg(t, SIGN[0], SIGN[1]);
    if (sk > 0) {
      g.save();
      g.beginPath(); g.rect(P.x + P.w - 130, P.y + P.h - 60, 80 * sk + 10, 50); g.clip();
      g.strokeStyle = MIST; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath();
      for (let s = 0; s <= 1; s += 0.02) { const x = P.x + P.w - 120 + s * 70, y = P.y + P.h - 34 + Math.sin(s * 18) * 6; if (s) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      g.restore();
    }
    // wet paint catching the light
    const shine = seg(t, 8.45, 9.3);
    if (shine > 0 && shine < 1) {
      g.save();
      g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
      const sx = P.x - 200 + shine * (P.w + 400);
      const sh = g.createLinearGradient(sx - 120, 0, sx + 120, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = sh; g.fillRect(P.x, P.y, P.w, P.h);
      g.restore();
    }
    // the frame's edge
    g.strokeStyle = '#2b2236'; g.lineWidth = 6; g.strokeRect(P.x, P.y, P.w, P.h);
  }

  /* ---- the studio ---- */
  function studio(t: number) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d0f26'); bg.addColorStop(1, INK);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // a tall window, the city behind it
    g.fillStyle = 'rgba(61,107,255,0.08)'; g.fillRect(60, 40, 260, 420);
    for (let i = 0; i < 80; i++) {
      const x = 70 + ((i * 89) % 240), y = 150 + ((i * 47) % 300);
      g.fillStyle = Math.sin(i * 7.3 + t * 0.5) > 0.3 ? 'rgba(255,214,150,0.35)' : 'rgba(184,200,255,0.12)';
      g.fillRect(x, y, 3, 4);
    }
    g.strokeStyle = 'rgba(184,200,255,0.25)'; g.lineWidth = 4; g.strokeRect(60, 40, 260, 420);
    g.beginPath(); g.moveTo(190, 40); g.lineTo(190, 460); g.moveTo(60, 250); g.lineTo(320, 250); g.stroke();
    // shelves of jars on the right
    g.fillStyle = '#1a1830'; g.fillRect(1380, 170, 200, 8); g.fillRect(1380, 290, 200, 8);
    const jars = ['#a310e7', '#3d6bff', '#ff3d8b', '#f2efff', '#1fd6b8', '#ffd27a'];
    jars.forEach((c, i) => {
      for (const sy of [170, 290]) {
        const x = 1392 + i * 30, h = 26 + ((i * 5 + sy) % 14);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, sy - h, 22, h);
        g.fillStyle = c; g.globalAlpha = 0.8; g.fillRect(x + 2, sy - h * 0.6, 18, h * 0.6 - 1); g.globalAlpha = 1;
      }
    });
    // the spotlight on the easel
    const sp = g.createRadialGradient(P.x + P.w / 2, P.y + P.h / 2, 40, P.x + P.w / 2, P.y + P.h / 2, 520);
    sp.addColorStop(0, 'rgba(184,200,255,0.16)'); sp.addColorStop(1, 'rgba(184,200,255,0)');
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
    // floor, splattered
    g.fillStyle = '#0c0b18'; g.fillRect(0, FLOOR, W, H - FLOOR);
    g.fillStyle = 'rgba(61,107,255,0.4)'; g.fillRect(0, FLOOR, W, 2);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = jars[i % jars.length]; g.globalAlpha = 0.35;
      g.beginPath(); g.ellipse(200 + ((i * 173) % 1200), FLOOR + 14 + ((i * 31) % 40), 4 + (i % 4) * 3, 2 + (i % 3), 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // the easel's legs and tray
    g.strokeStyle = '#3a2a22'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(P.x + 120, P.y + P.h); g.lineTo(P.x + 60, FLOOR + 20);
    g.moveTo(P.x + P.w - 120, P.y + P.h); g.lineTo(P.x + P.w - 60, FLOOR + 20);
    g.moveTo(P.x + P.w / 2, P.y - 40); g.lineTo(P.x + P.w / 2, FLOOR + 10);
    g.stroke();
    g.fillStyle = '#4a372c'; g.fillRect(P.x - 20, P.y + P.h, P.w + 40, 14);
    g.fillStyle = '#4a372c'; g.fillRect(P.x + P.w / 2 - 40, P.y - 46, 80, 12);
  }

  /* ---- the artist, facing the canvas ---- */
  function artist(t: number, b: ReturnType<typeof brush>) {
    const bx = bodyX(t);
    const breathe = Math.sin(t * 1.6) * 1.5;
    const lean = b.painting ? -0.04 : 0;
    g.save();
    g.translate(bx, FLOOR); g.scale(S, S); g.translate(-bx, -FLOOR);
    // legs: a stride while they move along, planted while they paint
    const v = (bodyX(t) - bodyX(t - 0.05)) / 0.05;
    const stride = Math.min(1, Math.abs(v) / 120) * Math.sin(bx * 0.06) * 0.35;
    g.strokeStyle = '#1b1a2e'; g.lineWidth = 26; g.lineCap = 'round';
    for (const [hx, sgn] of [[-10, 1], [14, -1]] as const) {
      const fx = bx + hx + Math.sin(stride * sgn) * 160, lift = Math.max(0, Math.sin(stride * sgn)) * 18;
      g.beginPath(); g.moveTo(bx + hx, 430); g.lineTo(fx + (sgn > 0 ? -16 : 16), FLOOR + 4 - lift); g.stroke();
    }
    // torso, leaning into the work
    g.save();
    g.translate(bx, 440); g.rotate(lean);
    g.fillStyle = '#2b3a78';
    rr(g, -42, -190 + breathe, 84, 196, 30); g.fill();
    // the apron, spattered
    g.fillStyle = '#d9d2c4'; rr(g, -30, -140 + breathe, 64, 150, 10); g.fill();
    ['#a310e7', '#3d6bff', '#ff3d8b', '#a310e7', '#1fd6b8'].forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.arc(-18 + ((i * 23) % 50), -110 + ((i * 41) % 110) + breathe, 3 + (i % 3), 0, Math.PI * 2); g.fill();
    });
    g.strokeStyle = 'rgba(61,107,255,0.6)'; g.lineWidth = 3; rr(g, -42, -190 + breathe, 84, 196, 30); g.stroke(); // rim light
    // head, turned to the canvas: hair up, a pencil behind the ear
    g.fillStyle = '#b97a62'; g.fillRect(-10, -210 + breathe, 22, 26);
    g.fillStyle = '#c98a70'; g.beginPath(); g.ellipse(8, -238 + breathe, 32, 36, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#140c1f';
    g.beginPath(); g.ellipse(-4, -256 + breathe, 34, 22, -0.2, Math.PI * 0.9, Math.PI * 2.05); g.fill();
    g.beginPath(); g.arc(-22, -270 + breathe, 15, 0, Math.PI * 2); g.fill(); // the bun
    g.strokeStyle = '#ffd27a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-30, -280 + breathe); g.lineTo(-12, -262 + breathe); g.stroke();
    // face in profile: an eye on the work, the nose, a small smile at the end
    g.fillStyle = '#2a1424'; g.beginPath(); g.ellipse(26, -242 + breathe, 3, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c98a70'; g.beginPath(); g.moveTo(38, -240 + breathe); g.lineTo(46, -230 + breathe); g.lineTo(37, -226 + breathe); g.fill();
    g.strokeStyle = '#2a1424'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.arc(30, -218 + breathe, 6, 0.1, t > 7.4 ? 1.4 : 0.9); g.stroke();
    g.strokeStyle = 'rgba(184,200,255,0.65)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(8, -238 + breathe, 32, 36, 0, -0.9, 0.7); g.stroke();
    g.restore();

    // the near arm holds the palette at the hip (in the artist's own frame)
    const pal = { x: bx + 50, y: 395 };
    g.strokeStyle = '#2b3a78'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(bx - 20, 300); g.quadraticCurveTo(bx - 30, 380, pal.x - 20, pal.y + 4); g.stroke();
    g.fillStyle = '#a07a52'; g.beginPath(); g.ellipse(pal.x, pal.y, 58, 26, -0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.ellipse(pal.x - 34, pal.y + 6, 8, 6, 0, 0, Math.PI * 2); g.fill(); // the thumb hole
    [['#f2efff', -10, -10], ['#a310e7', 14, -12], ['#3d6bff', 34, -2], ['#ff3d8b', 16, 10], ['#1fd6b8', -8, 10]].forEach(([c, dx, dy]) => {
      g.fillStyle = c as string; g.beginPath(); g.ellipse(pal.x + (dx as number), pal.y + (dy as number), 9, 6, 0.3, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#c98a70'; g.beginPath(); g.ellipse(pal.x - 26, pal.y + 8, 10, 8, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // the brush arm: posed from the brush tip (two-bone IK from the shoulder)
    const sh = world(bx, bx + 22 + lean * 120, 270 + breathe);
    const dir = { x: 0.85, y: -0.53 }; // how the brush is held: reaching up to the lettering
    const BR = 80;
    const hand = { x: b.tip.x - dir.x * BR, y: b.tip.y - dir.y * BR };
    const A = 108, B = 104;
    let dx = hand.x - sh.x, dy = hand.y - sh.y;
    let d = Math.hypot(dx, dy);
    if (d > A + B - 2) { const k = (A + B - 2) / d; dx *= k; dy *= k; d = A + B - 2; }
    const hx = sh.x + dx, hy = sh.y + dy;
    const th = Math.atan2(dy, dx);
    const al = Math.acos(Math.min(1, Math.max(-1, (A * A + d * d - B * B) / (2 * A * d))));
    const el = { x: sh.x + Math.cos(th + al) * A, y: sh.y + Math.sin(th + al) * A }; // elbow hangs below
    g.strokeStyle = '#2b3a78'; g.lineWidth = 24 * S; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(el.x, el.y); g.stroke();
    g.strokeStyle = '#c98a70'; g.lineWidth = 18 * S;
    g.beginPath(); g.moveTo(el.x, el.y); g.lineTo(hx, hy); g.stroke();
    // the brush, from the hand to the tip
    const tip = { x: hx + dir.x * BR, y: hy + dir.y * BR };
    g.strokeStyle = '#d7b46a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(hx - dir.x * 26, hy - dir.y * 26); g.lineTo(tip.x - dir.x * 16, tip.y - dir.y * 16); g.stroke();
    g.strokeStyle = '#9aa0b4'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(tip.x - dir.x * 18, tip.y - dir.y * 18); g.lineTo(tip.x - dir.x * 8, tip.y - dir.y * 8); g.stroke();
    // the loaded bristles: this letter's colour once dipped
    const loaded = t > 2.4 && t < 3.8 ? VIOLET : '#f2efff';
    g.strokeStyle = loaded; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(tip.x - dir.x * 8, tip.y - dir.y * 8); g.lineTo(tip.x, tip.y); g.stroke();
    g.fillStyle = '#c98a70'; g.beginPath(); g.ellipse(hx, hy, 12 * S, 10 * S, 0, 0, Math.PI * 2); g.fill();
    // flecks off the brush while it paints
    if (b.painting) {
      for (let i = 0; i < 5; i++) {
        const k = ((t * 3 + i * 0.2) % 1);
        g.globalAlpha = 1 - k;
        g.fillStyle = loaded;
        g.beginPath(); g.arc(tip.x - 10 - k * 30 + i * 4, tip.y + k * 40 - i * 3, 2, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  /* ---- the brand's colours, pinned up beside the finished mark ---- */
  function swatches(t: number) {
    const chips = [[VIOLET, '#A310E7'], ['#f7f4ff', '#F7F4FF'], ['#07060e', '#07060E'], [BLUE, '#3D6BFF']];
    chips.forEach(([c, label], i) => {
      const k = pop(seg(t, 8.65 + i * 0.12, 9.05 + i * 0.12));
      if (k <= 0) return;
      const x = P.x + P.w + 30, y = P.y + 6 + i * 82;
      g.save();
      g.translate(x + 50, y + 34); g.rotate((i % 2 ? 1 : -1) * 0.04); g.scale(k, k);
      g.fillStyle = '#efe9de'; rr(g, -50, -34, 100, 74, 4); g.fill();
      g.fillStyle = c; g.fillRect(-44, -28, 88, 44);
      if (c === '#f7f4ff') { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; g.strokeRect(-44, -28, 88, 44); }
      g.fillStyle = '#2b2236'; g.font = '600 11px ui-monospace, Menlo, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(label, -44, 28);
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(0, -34, 5, 0, Math.PI * 2); g.fill(); // the pin
      g.restore();
    });
    const k = seg(t, 9.0, 9.35);
    if (k > 0) {
      g.globalAlpha = k;
      g.fillStyle = MIST; g.font = '500 16px ui-monospace, Menlo, monospace'; g.textAlign = 'left';
      g.fillText('// BRAND IDENTITY — v1.0', P.x, P.y - 22);
      g.globalAlpha = 1;
    }
  }

  function camera(t: number) {
    // a slow drift with the work, then in on the finished mark
    const k = ease(seg(t, 8.3, 9.45));
    const z = lerp(1.04 + 0.03 * seg(t, 0, 8.3), 1.5, k);
    const fx = lerp(W / 2 + (bodyX(t) - 600) * 0.12, P.x + P.w / 2 + 60, k);
    const fy = lerp(H / 2, P.y + mid + 10, k);
    return { z, fx, fy };
  }

  function draw(time: number) {
    const t = ((time % BRANDING_FILM_LENGTH) + BRANDING_FILM_LENGTH) % BRANDING_FILM_LENGTH;
    const cam = camera(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    g.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.fx * cam.z, H / 2 - cam.fy * cam.z);
    studio(t);
    painting(t);
    swatches(t);
    artist(t, brush(t));
    g.setTransform(1, 0, 0, 1, 0, 0);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
    v.addColorStop(0, 'rgba(7,6,14,0)'); v.addColorStop(1, 'rgba(7,6,14,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // the loop's seam: a short glitch out and back in
    const seam = Math.max(seg(t, 9.55, 10), 1 - seg(t, 0, 0.35));
    if (seam > 0) {
      g.globalAlpha = seam;
      g.fillStyle = INK; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? BLUE : VIOLET;
        g.globalAlpha = seam * 0.5;
        g.fillRect(0, ((i * 131 + Math.floor(t * 40) * 37) % H), W, 3 + (i % 3) * 3);
      }
      g.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  }

  draw(0);
  return { tex, draw, canvas, length: BRANDING_FILM_LENGTH };
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

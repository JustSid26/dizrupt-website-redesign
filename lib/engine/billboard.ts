import * as THREE from 'three';
import { isMobile } from './config';

/* =========================================================
   The billboard. The landing you first see — DIZRUPT on black
   snow — is this board, seen from so close it fills the screen.
   Scroll and the camera pulls back to show it standing on a
   tower in the middle of the city.

   So the swap is invisible, the board copies the page: each
   letter and each word of the line under it is drawn where the
   page has laid it out, scaled from the screen to the board.
   ========================================================= */
export const BOARD_HEIGHT = 4;

export function createBillboard(center: THREE.Vector3, normal: THREE.Vector3) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const snow = document.createElement('canvas');
  const sctx = snow.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  const group = new THREE.Group();
  group.add(plane);
  group.position.copy(center);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());

  // the frame round it: a lit edge and two legs down to the roof
  const framePts: number[] = [];
  const frameGeo = new THREE.BufferGeometry();
  const frame = new THREE.Points(
    frameGeo,
    new THREE.PointsMaterial({ color: '#b98bff', size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(frame);

  type Glyph = { text: string; x: number; y: number; font: string; color: string; flip?: boolean };
  let glyphs: Glyph[] = [];
  let aspect = 1;

  // read the landing's layout off the page, as fractions of the screen
  function measure() {
    aspect = innerWidth / innerHeight;
    /* the board is drawn afresh every other frame and sent to the GPU whole: a phone's no sharper than
       the picture it fills (a phone's screen at up to 2x, a quarter of a 1600-wide board stood on end) */
    const W = isMobile ? Math.min(1600, Math.round(innerWidth * Math.min(2, devicePixelRatio))) : 1600;
    const H = Math.round(W / aspect);
    // (set only when it changes: setting a canvas's size, even to the same, throws its picture away)
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const sh = Math.max(1, Math.round(200 / aspect));
    if (snow.width !== 200 || snow.height !== sh) { snow.width = 200; snow.height = sh; }
    const k = W / innerWidth;
    /* Measured against the landing's own frame, not the window: once you have scrolled on, the
       landing sits above the screen, and reading it against the window put every letter off the
       board — which is why it went blank. */
    const pin = document.querySelector('.intro-pin')?.getBoundingClientRect();
    const ox = pin?.left ?? 0, oy = pin?.top ?? 0;
    if (pin && pin.height < 10) return; // not laid out: keep what we have
    glyphs = [];
    /* Layout positions, not on-screen ones: the letters are forever animating (arriving, the Z
       tearing), and reading their transformed boxes caught them mid-move and scattered the word.
       Offsets ignore transforms, so the board always gets the word as it rests. */
    const pinEl = document.querySelector<HTMLElement>('.intro-pin');
    const offset = (el: HTMLElement) => {
      let x = 0, y = 0, e: HTMLElement | null = el;
      while (e && e !== pinEl) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent as HTMLElement | null; }
      return { x, y };
    };
    document.querySelectorAll<HTMLElement>('#intro-word .char').forEach((el) => {
      const o = offset(el);
      const r = { left: o.x + ox, top: o.y + oy, width: el.offsetWidth };
      const cs = getComputedStyle(el);
      const flip = !!el.closest('.flip');
      glyphs.push({
        text: el.dataset.char ?? el.textContent ?? '',
        x: (r.left - ox + r.width / 2) * k,
        y: (r.top - oy) * k,
        font: `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`,
        color: flip ? '#a310e7' : '#ffffff',
        flip,
      });
    });
    const tag = document.querySelector<HTMLElement>('.intro-tag');
    const node = tag?.firstChild;
    if (tag && node && node.nodeType === Node.TEXT_NODE) {
      const cs = getComputedStyle(tag);
      const text = node.textContent ?? '';
      const range = document.createRange();
      let i = 0;
      for (const word of text.split(' ')) {
        range.setStart(node, i);
        range.setEnd(node, i + word.length);
        const r = range.getBoundingClientRect();
        glyphs.push({ text: word, x: (r.left - ox + r.width / 2) * k, y: (r.top - oy) * k, font: `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`, color: 'rgba(255,255,255,0.55)' });
        i += word.length + 1;
      }
    }
    plane.scale.set(BOARD_HEIGHT * aspect, BOARD_HEIGHT, 1);
    // the frame follows the board's size
    framePts.length = 0;
    const w = (BOARD_HEIGHT * aspect) / 2 + 0.06, h = BOARD_HEIGHT / 2 + 0.06;
    const edge = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.02);
      for (let j = 0; j <= n; j++) framePts.push(x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n, -0.02);
    };
    edge(-w, -h, w, -h); edge(w, -h, w, h); edge(w, h, -w, h); edge(-w, h, -w, -h);
    for (const x of [-w * 0.55, w * 0.55]) for (let y = -h; y > -h - 2.4; y -= 0.03) framePts.push(x, y, -0.15);
    frameGeo.setAttribute('position', new THREE.Float32BufferAttribute(framePts, 3));
    frameGeo.computeBoundingSphere();
  }

  let frameNo = 0;
  let boardNext = 3, boardUntil = 0;
  const snap = document.createElement('canvas');
  let nextBurst = 0;
  let snowImg: ImageData | null = null;
  let snowPx = new Uint32Array(0);
  let burstUntil = 0;
  let tear: null | { jx: number; jy: number; rx: number; ry: number; bx: number; by: number; band: number[] | null } = null;
  // text: false while the landing's own DOM word is up, so the cursor's hole in the veil shows
  // snow and not a second, slightly offset DIZRUPT behind the real one
  function draw(time: number, text = true) {
    if (frameNo++ % 2) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // the snow: coarse, screen-blended at the page's strength
    // (one buffer, kept: a new one each frame was most of what the page threw away)
    if (snowImg?.width !== snow.width || snowImg.height !== snow.height) {
      snowImg = sctx.createImageData(snow.width, snow.height);
      snowPx = new Uint32Array(snowImg.data.buffer);
    }
    for (let i = 0; i < snowPx.length; i++) snowPx[i] = 0xff000000 | (((Math.random() * 256) | 0) * 0x010101); // grey, opaque
    sctx.putImageData(snowImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(snow, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    /* The Z never stops losing the signal, the same fault it runs on the landing: every so often,
       at an interval rolled fresh each time, it tears for a few held steps — the three colour
       channels thrown apart by different amounts, the letter jumping, a band of it dropping out. */
    if (time > nextBurst) {
      burstUntil = time + 0.2 + Math.random() * 0.3;
      nextBurst = burstUntil + 0.7 + Math.random() * 0.8;
    }
    const tearing = time < burstUntil;
    const fs = Math.max(8, parseFloat(glyphs.find((g) => g.flip)?.font.split(' ')[1] ?? '100'));
    if (tearing && frameNo % 4 < 2) {
      const spread = fs * (0.05 + Math.random() * 0.2);
      tear = {
        jx: (Math.random() - 0.5) * fs * 0.16, jy: (Math.random() - 0.5) * fs * 0.06,
        rx: (Math.random() - 0.5) * spread * 2, ry: (Math.random() - 0.5) * fs * 0.08,
        bx: (Math.random() - 0.5) * spread * 2.4, by: (Math.random() - 0.5) * fs * 0.08,
        band: Math.random() < 0.35 ? [Math.random() * 0.55, 0.1 + Math.random() * 0.3] : null,
      };
    } else if (!tearing) tear = null;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const g of text ? glyphs : []) {
      ctx.font = g.font;
      ctx.fillStyle = g.color;
      if (g.flip) {
        ctx.save();
        ctx.translate(g.x + (tear?.jx ?? 0), g.y + (tear?.jy ?? 0));
        ctx.scale(-1, 1);
        if (tear) {
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = '#ff2d4f';
          ctx.fillText(g.text, tear.rx, tear.ry);
          ctx.fillStyle = '#2f6bff';
          ctx.fillText(g.text, tear.bx, tear.by);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = g.color;
          if (tear.band) {
            // a band of the letter is lost: draw it above and below the gap only
            const [top, h] = tear.band;
            ctx.save();
            ctx.beginPath();
            ctx.rect(-fs, -fs * 0.2, fs * 2, fs * (top + 0.2));
            ctx.rect(-fs, fs * (top + h), fs * 2, fs * 1.5);
            ctx.clip();
            ctx.fillText(g.text, 0, 0);
            ctx.restore();
          } else ctx.fillText(g.text, 0, 0);
        } else ctx.fillText(g.text, 0, 0);
        ctx.restore();
      } else ctx.fillText(g.text, g.x, g.y);
    }
    /* Now and then the whole board loses the signal: the picture is copied back over itself in red
       and blue, pulled apart, and bands of it slip sideways, for a few held frames. */
    if (time > boardNext) { boardUntil = time + 0.18 + Math.random() * 0.25; boardNext = boardUntil + 2 + Math.random() * 4; }
    if (time < boardUntil) {
      if (snap.width !== W || snap.height !== H) { snap.width = W; snap.height = H; } // (else it's a new canvas every frame of it)
      const sx = snap.getContext('2d')!;
      sx.drawImage(canvas, 0, 0);
      const sp = W * (0.006 + Math.random() * 0.018);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)'; ctx.drawImage(snap, sp, 0);
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(180deg)'; ctx.drawImage(snap, -sp, 0);
      ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      for (let b = 0; b < 4; b++) {
        if (Math.random() < 0.5) continue;
        const by = Math.random() * H, bh = H * (0.03 + Math.random() * 0.1);
        ctx.drawImage(snap, 0, by, W, bh, (Math.random() - 0.5) * W * 0.08, by, W, bh);
      }
      group.position.x = center.x + (Math.random() - 0.5) * 0.15;
    } else group.position.x = center.x;
    // scanlines, as on the page
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    for (let y = (time * 6) % 3; y < H; y += 3 * (H / innerHeight)) ctx.fillRect(0, y, W, H / innerHeight);
    texture.needsUpdate = true;
  }

  /** The camera distance at which the board exactly fills a view of this field of view. */
  const fillDistance = (fov: number) => BOARD_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

  return { group, plane, measure, draw, fillDistance, material };
}

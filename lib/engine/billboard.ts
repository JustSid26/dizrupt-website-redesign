import * as THREE from 'three';

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
    const W = 1600;
    const H = Math.round(W / aspect);
    canvas.width = W;
    canvas.height = H;
    snow.width = 200;
    snow.height = Math.max(1, Math.round(200 / aspect));
    const k = W / innerWidth;
    glyphs = [];
    document.querySelectorAll<HTMLElement>('#intro-word .char').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const flip = !!el.closest('.flip');
      glyphs.push({
        text: el.dataset.char ?? el.textContent ?? '',
        x: (r.left + r.width / 2) * k,
        y: r.top * k,
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
        glyphs.push({ text: word, x: (r.left + r.width / 2) * k, y: r.top * k, font: `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`, color: 'rgba(255,255,255,0.55)' });
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
  let zSlip = 0;
  function draw(time: number) {
    if (frameNo++ % 2) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // the snow: coarse, screen-blended at the page's strength
    const img = sctx.createImageData(snow.width, snow.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(snow, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // the Z still loses the signal now and then
    zSlip = Math.random() < 0.02 ? (Math.random() - 0.5) * W * 0.02 : zSlip * 0.6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const g of glyphs) {
      ctx.font = g.font;
      ctx.fillStyle = g.color;
      if (g.flip) {
        ctx.save();
        ctx.translate(g.x + zSlip, g.y);
        ctx.scale(-1, 1);
        if (Math.abs(zSlip) > 2) {
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = '#ff2d4f';
          ctx.fillText(g.text, zSlip * 0.8, 0);
          ctx.fillStyle = '#2f6bff';
          ctx.fillText(g.text, -zSlip * 0.8, 0);
          ctx.fillStyle = g.color;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillText(g.text, 0, 0);
        ctx.restore();
      } else ctx.fillText(g.text, g.x, g.y);
    }
    // scanlines, as on the page
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    for (let y = (time * 6) % 3; y < H; y += 3 * (H / innerHeight)) ctx.fillRect(0, y, W, H / innerHeight);
    texture.needsUpdate = true;
  }

  /** The camera distance at which the board exactly fills a view of this field of view. */
  const fillDistance = (fov: number) => BOARD_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

  return { group, measure, draw, fillDistance, material };
}

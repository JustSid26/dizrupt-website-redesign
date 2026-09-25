// @ts-nocheck — ported from the original site.
/* =========================================================
   Analogue snow for the landing screen — the black-and-white crawl of a TV tuned to nothing.

   Real snow is uncorrelated from pixel to pixel and from frame to frame, but generating that
   honestly means writing a million bytes every frame for something nobody looks at directly. A
   handful of noise tiles, cycled and shifted by a random offset each frame, is indistinguishable
   once it is moving and costs one fill instead.
   ========================================================= */
const BLOCK = 2.6;  // screen pixels per grain — the chunk that makes it read as analogue, not film
const TILE = 256;   // size of each pre-rendered noise tile
const BANKS = 6;    // how many of them to cycle through
const FPS = 30;     // snow crawls fast, but not every frame fast

// The crawl is mostly black with sparse bright specks. An even spread of grey reads as fog.
function makeTile() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = TILE;
  const ctx = tile.getContext('2d');
  const image = ctx.createImageData(TILE, TILE);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const roll = Math.random();
    const lum = roll > 0.88 ? 150 + Math.random() * 105
      : roll > 0.58 ? 30 + Math.random() * 70
      : 0;
    data[i] = data[i + 1] = data[i + 2] = lum;
    data[i + 3] = lum ? 255 : 0; // the dark grains are holes, so the black underneath stays black
  }
  ctx.putImageData(image, 0, 0);
  return tile;
}

export function createStatic(canvas) {
  const ctx = canvas.getContext('2d');
  const banks = Array.from({ length: BANKS }, () => ctx.createPattern(makeTile(), 'repeat'));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, raf = 0, last = 0, running = false, roll = 0;

  function resize() {
    w = Math.max(1, Math.round(innerWidth / BLOCK));
    h = Math.max(1, Math.round(innerHeight / BLOCK));
    canvas.width = w;
    canvas.height = h;
    if (!running) paint(0); // keep the last look while the loop is stopped
  }

  function paint(time) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    // a different tile, offset differently, so the repeat never shows
    ctx.translate(-Math.random() * TILE, -Math.random() * TILE);
    ctx.fillStyle = banks[(Math.random() * BANKS) | 0];
    ctx.fillRect(0, 0, w + TILE, h + TILE);
    ctx.restore();

    /* The bar that rolls up a mistuned picture. Soft, dim, and slow enough that it reads as the
       frame failing to hold rather than as something deliberately animated. */
    roll = (roll + h * 0.0016 + 0.35) % (h + 160);
    const y = h + 80 - roll;
    const band = ctx.createLinearGradient(0, y - 70, 0, y + 70);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 70, w, 140);

    // and every so often the picture drops a line altogether
    if (Math.random() < 0.06) {
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(0, (Math.random() * h) | 0, w, 1 + ((Math.random() * 2) | 0));
    }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    paint(now);
  }

  addEventListener('resize', resize);
  resize();

  return {
    start() {
      if (running) return;
      paint(0);
      if (still) return; // one frame of grain, held, for anyone who asked for less movement
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

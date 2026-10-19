import * as THREE from 'three';
import { isMobile } from './config';

/* The clients' banners are up on the city's screens, the billboards, the work's windows and the
   spiral's cards: a texture for each, but one picture on the GPU, since they share its source (and
   the settings it is uploaded with). A phone's is smaller: a 1800px banner is 8 MB there. */
const MAX_W = isMobile ? 1024 : Infinity;
type Waiting = [THREE.Texture, ((t: THREE.Texture) => void) | undefined][];
const cache = new Map<string, { source: THREE.TextureSource<TexImageSource | null>; waiting: Waiting | null }>();

export function bannerTexture(url: string, onLoad?: (t: THREE.Texture) => void) {
  let e = cache.get(url);
  if (!e) {
    const entry = { source: new THREE.TextureSource<TexImageSource | null>(null), waiting: [] as Waiting | null };
    cache.set(url, entry);
    const im = new Image();
    im.onload = () => {
      let data: HTMLImageElement | HTMLCanvasElement = im;
      if (im.naturalWidth > MAX_W) {
        const c = document.createElement('canvas');
        c.width = MAX_W;
        c.height = Math.round((im.naturalHeight * MAX_W) / im.naturalWidth);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        data = c;
      }
      entry.source.data = data;
      entry.waiting!.forEach(([t, cb]) => {
        t.needsUpdate = true;
        cb?.(t);
      });
      entry.waiting = null;
    };
    im.src = url;
    e = entry;
  }
  const t = new THREE.Texture();
  t.source = e.source as typeof t.source;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (e.waiting) e.waiting.push([t, onLoad]);
  else {
    t.needsUpdate = true;
    onLoad?.(t);
  }
  return t;
}

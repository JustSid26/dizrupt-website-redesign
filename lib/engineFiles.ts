/* The 3D's own files (the city, the train, its station, the landmarks, the mascot), asked for the
   moment the page knows it will draw the 3D (Stage.tsx), alongside the engine's code rather than
   after it. Asked for by the engine once its code had arrived and started, they began two seconds
   into a slow connection's load, and the visitor waited for the two one after the other. Each file
   is fetched once; the engine reads the same download (engine.ts, mascot.ts). */
export const ENGINE_FILES = [
  "/models/nyc-city.glb",
  "/models/train.glb",
  "/models/station.glb",
  "/models/nyc.glb",
  "/mascot-neutral-claude.bin",
  "/mascot-transition-claude.json",
];

const files = new Map<string, Promise<ArrayBuffer>>();

export function engineFile(url: string): Promise<ArrayBuffer> {
  let p = files.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    });
    p.catch(() => {}); // (asked for ahead of time: whoever reads it hears of a failure, not the console)
    files.set(url, p);
  }
  return p;
}

export const fetchEngineFiles = () => ENGINE_FILES.forEach(engineFile);

import { create } from 'zustand';

type State = {
  loaded: boolean; // the count has reached 100 and the mascot is on disk
  reducedMotion: boolean;
  menuOpen: boolean;
  mode: 'dusk' | 'night';
  macOpen: boolean; // the projects Mac
  macProject: string | null; // open it straight onto this project's film
  /* the 3D: still being built ('pending'), running ('ok'), or not to be had on this device ('none':
     no WebGL 2, only a software renderer, it failed, or it took too long; Stage.tsx). With none the
     home page is the light version (LiteHome.tsx) and the scroll is the browser's own */
  gl: 'pending' | 'ok' | 'none';
  set: (partial: Partial<Omit<State, 'set'>>) => void;
};

export const useStore = create<State>((set) => ({
  loaded: false,
  reducedMotion: false,
  menuOpen: false,
  mode: 'night',
  macOpen: false,
  macProject: null,
  gl: 'pending',
  set: (partial) => set(partial),
}));

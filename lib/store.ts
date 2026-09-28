import { create } from 'zustand';

type State = {
  loaded: boolean; // the count has reached 100 and the mascot is on disk
  reducedMotion: boolean;
  menuOpen: boolean;
  mode: 'dusk' | 'night';
  macOpen: boolean; // the projects Mac
  macProject: string | null; // open it straight onto this project's film
  set: (partial: Partial<Omit<State, 'set'>>) => void;
};

export const useStore = create<State>((set) => ({
  loaded: false,
  reducedMotion: false,
  menuOpen: false,
  mode: 'dusk',
  macOpen: false,
  macProject: null,
  set: (partial) => set(partial),
}));

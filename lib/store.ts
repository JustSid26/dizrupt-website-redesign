import { create } from 'zustand';

type State = {
  loaded: boolean; // the count has reached 100 and the mascot is on disk
  reducedMotion: boolean;
  menuOpen: boolean;
  mode: 'dusk' | 'night';
  set: (partial: Partial<Omit<State, 'set'>>) => void;
};

export const useStore = create<State>((set) => ({
  loaded: false,
  reducedMotion: false,
  menuOpen: false,
  mode: 'dusk',
  set: (partial) => set(partial),
}));

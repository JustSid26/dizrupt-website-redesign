import { create } from 'zustand';

type State = {
  loaded: boolean; // the count has reached 100 and the mascot is on disk
  reducedMotion: boolean;
  menuOpen: boolean;
  set: (partial: Partial<Omit<State, 'set'>>) => void;
};

export const useStore = create<State>((set) => ({
  loaded: false,
  reducedMotion: false,
  menuOpen: false,
  set: (partial) => set(partial),
}));

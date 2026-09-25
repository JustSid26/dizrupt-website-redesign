import { create } from 'zustand';

type State = {
  loaded: boolean; // the count has reached 100 and the mascot is on disk
  reducedMotion: boolean;
  menuOpen: boolean;
  mode: 'dusk' | 'night';
  macOpen: boolean; // the Mac at the Tech & Automation stop
  set: (partial: Partial<Omit<State, 'set'>>) => void;
};

export const useStore = create<State>((set) => ({
  loaded: false,
  reducedMotion: false,
  menuOpen: false,
  mode: 'dusk',
  macOpen: false,
  set: (partial) => set(partial),
}));

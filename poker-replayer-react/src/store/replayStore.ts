// Zustand store for replay state management

import { create } from 'zustand';
import { HandReplay, GameState } from '../types/poker';
import { HandHistoryParser } from '../parser/handParser';

interface ReplayState {
  replay: HandReplay | null;
  currentActionIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  gameState: GameState | null;
  
  // Actions
  loadHand: (handText: string) => void;
  setActionIndex: (index: number) => void;
  nextAction: () => void;
  previousAction: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  updateGameState: () => void;
}

const parser = new HandHistoryParser();

export const useReplayStore = create<ReplayState>((set, get) => ({
  replay: null,
  currentActionIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  gameState: null,

  loadHand: (handText: string) => {
    const replay = parser.parseHandForReplay(handText);
    if (replay) {
      set({ replay, currentActionIndex: 0, isPlaying: false });
      get().updateGameState();
    }
  },

  setActionIndex: (index: number) => {
    const { replay } = get();
    if (replay) {
      const clampedIndex = Math.max(0, Math.min(index, replay.actions.length));
      set({ currentActionIndex: clampedIndex });
      get().updateGameState();
    }
  },

  nextAction: () => {
    const { currentActionIndex, replay } = get();
    if (replay && currentActionIndex < replay.actions.length) {
      get().setActionIndex(currentActionIndex + 1);
    }
  },

  previousAction: () => {
    const { currentActionIndex } = get();
    if (currentActionIndex > 0) {
      get().setActionIndex(currentActionIndex - 1);
    }
  },

  goToStart: () => {
    get().setActionIndex(0);
  },

  goToEnd: () => {
    const { replay } = get();
    if (replay) {
      get().setActionIndex(replay.actions.length);
    }
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  updateGameState: () => {
    const { replay, currentActionIndex } = get();
    if (replay) {
      const gameState = parser.getStateAtAction(replay, currentActionIndex);
      set({ gameState });
    }
  },
}));


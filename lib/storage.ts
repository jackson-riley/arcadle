import { PlayerStats } from "./types";

const STATS_KEY = "frameguessr-stats";
const GAME_STATE_KEY = "frameguessr-state";

const DEFAULT_STATS: PlayerStats = {
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  distribution: {},
};

export function loadStats(): PlayerStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : DEFAULT_STATS;
  } catch {
    return DEFAULT_STATS;
  }
}

export function saveStats(stats: PlayerStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/**
 * Save/load today's game state so refreshing doesn't reset progress.
 * Keyed by puzzle number so yesterday's state doesn't carry over.
 */
interface SavedGameState {
  puzzleNumber: number;
  guesses: string[];
  completed: boolean;
}

export function loadGameState(puzzleNumber: number): SavedGameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return null;
    const state: SavedGameState = JSON.parse(raw);
    return state.puzzleNumber === puzzleNumber ? state : null;
  } catch {
    return null;
  }
}

export function saveGameState(state: SavedGameState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  } catch {
    // fail silently
  }
}

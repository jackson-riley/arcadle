import { PlayerStats } from "./types";

const STATS_KEY = "ludle-stats";
const GAME_STATE_KEY_PREFIX = "ludle-state-";

// Back-compat keys (migrate from older names)
const LEGACY_STATS_KEY = "frameguessr-stats";
const LEGACY_GAME_STATE_KEY_PREFIX = "frameguessr-state-";

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
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };

    // Migrate legacy stats if present
    const legacyRaw = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacyRaw) {
      localStorage.setItem(STATS_KEY, legacyRaw);
      return { ...DEFAULT_STATS, ...JSON.parse(legacyRaw) };
    }

    return DEFAULT_STATS;
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
 * Save/load per-puzzle game state so refreshing or switching days
 * doesn't reset progress for that specific puzzle.
 */
export interface SavedGameState {
  puzzleNumber: number;
  guesses: string[];
  completed: boolean;
}

export function loadGameState(puzzleNumber: number): SavedGameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(`${GAME_STATE_KEY_PREFIX}${puzzleNumber}`) ??
      localStorage.getItem(`${LEGACY_GAME_STATE_KEY_PREFIX}${puzzleNumber}`);
    if (!raw) return null;
    const state: SavedGameState = JSON.parse(raw);

    // Basic shape validation so older saved data doesn't break restore
    if (
      typeof state.puzzleNumber !== "number" ||
      !Array.isArray(state.guesses)
    ) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

export function saveGameState(state: SavedGameState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${GAME_STATE_KEY_PREFIX}${state.puzzleNumber}`,
      JSON.stringify(state)
    );
  } catch {
    // fail silently
  }
}

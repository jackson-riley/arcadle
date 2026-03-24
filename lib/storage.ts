import { PlayerStats } from "./types";

const HAS_VISITED_KEY = "ludle-has-visited";

const STATS_KEY = "ludle-stats-v2";
const GAME_STATE_KEY_PREFIX = "ludle-state-v2-";

// Back-compat keys (no migration — v2 is a fresh start)
const LEGACY_STATS_KEY = "ludle-stats-unused";
const LEGACY_GAME_STATE_KEY_PREFIX = "ludle-state-unused-";

/**
 * Bump this when the daily puzzle lineup / shuffle changes in a way that makes
 * old saved guesses and stats misleading (e.g. new games in the pool). On the
 * next visit, all ludle/frameguessr localStorage keys are cleared for that browser.
 */
const DATA_VERSION_KEY = "ludle-data-version";
export const LUDLE_DATA_VERSION = 4;

function wipeLudleLocalStorage(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === DATA_VERSION_KEY) continue;
    if (key.startsWith("ludle-") || key.startsWith("frameguessr-")) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    localStorage.removeItem(key);
  }
}

/** Call once on client boot before loadStats / loadGameState. */
export function ensureLudleDataVersion(): void {
  if (typeof window === "undefined") return;
  try {
    const current = localStorage.getItem(DATA_VERSION_KEY);
    if (current === String(LUDLE_DATA_VERSION)) return;
    wipeLudleLocalStorage();
    localStorage.setItem(DATA_VERSION_KEY, String(LUDLE_DATA_VERSION));
  } catch {
    // localStorage unavailable — ignore
  }
}

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

export function hasLudleVisitedBefore(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(HAS_VISITED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLudleVisited(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HAS_VISITED_KEY, "1");
  } catch {
    // ignore
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
  /**
   * True if this puzzle was completed while it was the "today" puzzle, meaning
   * stats were tracked for it.
   *
   * Older saved states may not have this field.
   */
  statsTracked?: boolean;
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

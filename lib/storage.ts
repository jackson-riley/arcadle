import { guessMatchesGame } from "./guessMatch";
import { getDateForPuzzleNumber, getPuzzleForNumber, getPuzzleNumber } from "./puzzle";
import { PlayerStats } from "./types";
import { formatLocalDate, normalizeStreakStats } from "./streak";

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

/** Cached streak derived from per-puzzle saves; invalidated on saveStats/saveGameState. */
let streakRecomputeCache: {
  today: number;
  streak: number;
  lastWinDate?: string;
  maxStreak: number;
} | null = null;

function invalidateStreakRecomputeCache(): void {
  streakRecomputeCache = null;
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

function isWinningSavedState(puzzleNum: number): boolean {
  const state = loadGameState(puzzleNum);
  if (!state?.completed || state.guesses.length === 0) return false;
  const puzzle = getPuzzleForNumber(puzzleNum);
  const last = state.guesses[state.guesses.length - 1];
  return guessMatchesGame(puzzle.game, last);
}

/** Most recent calendar day (any puzzle ≤ today) where the player has a saved win. */
function findMostRecentWinDate(): string | undefined {
  const today = getPuzzleNumber();
  for (let p = today; p >= 1; p--) {
    const state = loadGameState(p);
    if (!state?.completed) continue;
    if (isWinningSavedState(p)) return formatLocalDate(getDateForPuzzleNumber(p));
  }
  return undefined;
}

/** Longest run of consecutive calendar days (puzzle numbers) with a win. */
function recomputeMaxStreakFromSavedGames(): number {
  const today = getPuzzleNumber();
  let best = 0;
  let run = 0;
  for (let p = 1; p <= today; p++) {
    if (!isWinningSavedState(p)) {
      run = 0;
      continue;
    }
    const prevWon = p > 1 && isWinningSavedState(p - 1);
    run = prevWon ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Derive current streak + lastWinDate from saved game states (reverse from today).
 * Consecutive wins only; a loss or missing day breaks the chain.
 */
function recomputeStreakFromSavedGames(): {
  streak: number;
  lastWinDate?: string;
  maxStreak: number;
} {
  const today = getPuzzleNumber();
  const todayState = loadGameState(today);

  if (todayState?.completed && !isWinningSavedState(today)) {
    return {
      streak: 0,
      lastWinDate: findMostRecentWinDate(),
      maxStreak: recomputeMaxStreakFromSavedGames(),
    };
  }

  let end = today;
  if (!todayState?.completed) {
    end = today - 1;
  }

  if (end < 1) {
    return {
      streak: 0,
      lastWinDate: findMostRecentWinDate(),
      maxStreak: recomputeMaxStreakFromSavedGames(),
    };
  }

  let streak = 0;
  let lastWinDate: string | undefined;
  for (let p = end; p >= 1; p--) {
    const state = loadGameState(p);
    if (!state?.completed) break;
    if (!isWinningSavedState(p)) break;
    streak += 1;
    if (lastWinDate === undefined) {
      lastWinDate = formatLocalDate(getDateForPuzzleNumber(p));
    }
  }

  return {
    streak,
    lastWinDate,
    maxStreak: recomputeMaxStreakFromSavedGames(),
  };
}

function getCachedStreakFields(): {
  streak: number;
  lastWinDate?: string;
  maxStreak: number;
} {
  const today = getPuzzleNumber();
  if (streakRecomputeCache && streakRecomputeCache.today === today) {
    return {
      streak: streakRecomputeCache.streak,
      lastWinDate: streakRecomputeCache.lastWinDate,
      maxStreak: streakRecomputeCache.maxStreak,
    };
  }
  const rec = recomputeStreakFromSavedGames();
  streakRecomputeCache = { today, ...rec };
  return rec;
}

function applyRecomputedStreak(merged: PlayerStats): PlayerStats {
  const rec = getCachedStreakFields();
  const mergedWithStreak: PlayerStats = {
    ...merged,
    streak: rec.streak,
    lastWinDate: rec.lastWinDate,
    maxStreak: Math.max(merged.maxStreak ?? 0, rec.maxStreak),
  };
  const normalized = normalizeStreakStats(mergedWithStreak);
  if (
    normalized.streak !== merged.streak ||
    normalized.lastWinDate !== merged.lastWinDate ||
    normalized.maxStreak !== merged.maxStreak
  ) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function loadStats(): PlayerStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const merged = { ...DEFAULT_STATS, ...JSON.parse(raw) } as PlayerStats;
      return applyRecomputedStreak(merged);
    }

    const legacyRaw = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacyRaw) {
      localStorage.setItem(STATS_KEY, legacyRaw);
      const merged = { ...DEFAULT_STATS, ...JSON.parse(legacyRaw) } as PlayerStats;
      return applyRecomputedStreak(merged);
    }

    return applyRecomputedStreak(DEFAULT_STATS);
  } catch {
    return DEFAULT_STATS;
  }
}

export function saveStats(stats: PlayerStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    invalidateStreakRecomputeCache();
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

export function saveGameState(state: SavedGameState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${GAME_STATE_KEY_PREFIX}${state.puzzleNumber}`,
      JSON.stringify(state)
    );
    invalidateStreakRecomputeCache();
  } catch {
    // fail silently
  }
}

import { getGamesOrderForYear, selectGameForFixedIndex } from "./games";
import { Clue, DailyPuzzle, GameEntry } from "./types";

// Anchor date for Day #1 (local calendar date: March 20, 2026).
// We compute puzzle numbers using UTC-midnight timestamps derived from
// local calendar components to avoid DST off-by-one issues.
const EPOCH_Y = 2026;
const EPOCH_M = 2; // March (0-indexed)
const EPOCH_D = 20;

// Offset so Day 1 (March 20) maps to the same game as old Day 79 (Jan 1 + 78 days = March 20).
const EPOCH_INDEX_OFFSET = 78;

/** Puzzle number (1-indexed) based on days since epoch */
export function getPuzzleNumber(): number {
  const now = new Date();
  const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcEpoch = Date.UTC(EPOCH_Y, EPOCH_M, EPOCH_D);
  return Math.floor((utcToday - utcEpoch) / 86_400_000) + 1;
}

/** Date (local) corresponding to a given puzzle number */
export function getDateForPuzzleNumber(num: number): Date {
  const d = new Date(EPOCH_Y, EPOCH_M, EPOCH_D);
  d.setDate(d.getDate() + (num - 1));
  return d;
}

/** Deterministic puzzle selection for a given puzzle number.
 * Day N maps to fixed index (N-1 + EPOCH_INDEX_OFFSET). If that game is excluded,
 * substitutes the next non-excluded after it. Other days' mappings are unchanged. */
export function getPuzzleForNumber(num: number): DailyPuzzle {
  const date = getDateForPuzzleNumber(num);
  const year = date.getFullYear();
  const shuffled = getGamesOrderForYear(year);
  const preferredIndex = (num - 1) + EPOCH_INDEX_OFFSET;
  const game = selectGameForFixedIndex(shuffled, preferredIndex);
  return {
    puzzleNumber: num,
    game,
    clues: getCluesForGame(game),
  };
}

/** Deterministic daily puzzle selection based on today's date */
export function getDailyPuzzle(): DailyPuzzle {
  const num = getPuzzleNumber();
  return getPuzzleForNumber(num);
}

/**
 * Clue reveal order.
 * - All four labels are always visible; values unlock after each guess (in order).
 * - When the game ends (win or loss), all clue values are revealed.
 *
 * Ordering rationale:
 *   1. Genre — great starting point; gives the player a chance to guess correctly early
 *   2. Platforms — narrows by ecosystem (PS4 exclusive? everywhere?)
 *   3. Year — combined with genre + platform, field shrinks fast
 *   4. Developer — basically confirms for anyone paying attention
 */
export function getCluesForGame(game: GameEntry): Clue[] {
  return [
    { label: "GENRE", value: game.genre },
    { label: "PLATFORMS", value: game.platforms },
    { label: "YEAR", value: String(game.year) },
    { label: "DEVELOPER", value: game.developer },
  ];
}

import { GAMES_DB } from "./games";
import { Clue, DailyPuzzle, GameEntry } from "./types";

// Anchor date for Day #1 (local calendar date: Jan 1, 2026).
// We compute puzzle numbers using UTC-midnight timestamps derived from
// local calendar components to avoid DST off-by-one issues.
const EPOCH_Y = 2026;
const EPOCH_M = 0; // Jan (0-indexed)
const EPOCH_D = 1;

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

/** Deterministic puzzle selection for a given puzzle number */
export function getPuzzleForNumber(num: number): DailyPuzzle {
  const index = ((num - 1) % GAMES_DB.length + GAMES_DB.length) % GAMES_DB.length;
  const game = GAMES_DB[index];
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
 * - Players see clue[0] before any guesses.
 * - Each new guess reveals the next clue while the game is still in progress.
 * - When the game ends (win or give up), all clues are revealed at once.
 *
 * Ordering rationale:
 *   1. Genre — great starting point; gives the player a chance to guess correctly early
 *   2. Length — broad bucket (dozens of 6–8 hour games exist)
 *   3. Platforms — narrows by ecosystem (PS4 exclusive? everywhere?)
 *   4. Year — combined with length + platform, field shrinks fast
 *   5. Developer — basically confirms for anyone paying attention
 *   6. Core loop — the kill shot; describes what you *do* in the game
 */
export function getCluesForGame(game: GameEntry): Clue[] {
  return [
    { label: "GENRE", value: game.genre },
    { label: "LENGTH", value: game.length },
    { label: "PLATFORMS", value: game.platforms },
    { label: "YEAR", value: String(game.year) },
    { label: "DEVELOPER", value: game.developer },
    { label: "CORE LOOP", value: game.coreLoop },
  ];
}

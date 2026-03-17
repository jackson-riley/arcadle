import { GAMES_DB } from "./games";
import { Clue, DailyPuzzle, GameEntry } from "./types";

const EPOCH = new Date("2026-01-01T00:00:00Z");

/** Puzzle number (1-indexed) based on days since epoch */
export function getPuzzleNumber(): number {
  const now = new Date();
  return Math.floor((now.getTime() - EPOCH.getTime()) / 86_400_000) + 1;
}

/** Deterministic daily puzzle selection */
export function getDailyPuzzle(): DailyPuzzle {
  const num = getPuzzleNumber();
  const index = ((num - 1) % GAMES_DB.length + GAMES_DB.length) % GAMES_DB.length;
  const game = GAMES_DB[index];
  return {
    puzzleNumber: num,
    game,
    clues: getCluesForGame(game),
  };
}

/** Random puzzle selection on each game load */
export function getRandomPuzzle(): DailyPuzzle {
  const num = getPuzzleNumber();
  const index = Math.floor(Math.random() * GAMES_DB.length);
  const game = GAMES_DB[index];
  return {
    puzzleNumber: num,
    game,
    clues: getCluesForGame(game),
  };
}

/**
 * Clue reveal order. Each wrong guess reveals the next clue.
 * Players start seeing clue[0] (length) before their first guess.
 *
 * Ordering rationale:
 *   1. Length — broad bucket (dozens of 6–8 hour games exist)
 *   2. Platforms — narrows by ecosystem (PS4 exclusive? everywhere?)
 *   3. Year — combined with length + platform, field shrinks fast
 *   4. Genre — the pivot where it starts clicking
 *   5. Developer — basically confirms for anyone paying attention
 *   6. Core loop — the kill shot; describes what you *do* in the game
 */
export function getCluesForGame(game: GameEntry): Clue[] {
  return [
    { label: "LENGTH", value: game.length },
    { label: "PLATFORMS", value: game.platforms },
    { label: "YEAR", value: String(game.year) },
    { label: "GENRE", value: game.genre },
    { label: "DEVELOPER", value: game.developer },
    { label: "CORE LOOP", value: game.coreLoop },
  ];
}

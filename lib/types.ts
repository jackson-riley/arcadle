// ============================================================
// Core types for Ludle
// Pin this file in Cursor chat context so the AI always
// knows your data shapes.
// ============================================================

export interface GameEntry {
  /** Canonical title (display, storage, screenshot paths, autocomplete) */
  title: string;
  /** Alternate names accepted as correct guesses (not added to autocomplete) */
  aliases?: string[];
  developer: string;
  year: number;
  genre: string;
  platforms: string;
  length: string;
  /** One-sentence description of the core gameplay loop */
  coreLoop: string;
  /** Hex color for abstract card visual */
  color: string;
  /** Optional: path to screenshot for image-based reveal */
  screenshotUrl?: string;
}

export interface Clue {
  label: string;
  value: string;
}

export interface DailyPuzzle {
  puzzleNumber: number;
  game: GameEntry;
  clues: Clue[];
}

export type GameState = "playing" | "won" | "lost";

export interface PlayerStats {
  played: number;
  wins: number;
  streak: number;
  /** Key = number of guesses (1-6), value = count (stats-tracked wins only) */
  distribution: Record<number, number>;
  /** ISO date string of last completed puzzle */
  lastPlayed?: string;
  /** Local calendar day (YYYY-MM-DD) of the last win that counts toward streak */
  lastWinDate?: string;
}

export interface GuessResult {
  guess: string;
  correct: boolean;
  /** Next clue to reveal (only if incorrect and guesses remain) */
  nextClue?: Clue;
}

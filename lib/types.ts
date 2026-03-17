// ============================================================
// Core types for FrameGuessr
// Pin this file in Cursor chat context so the AI always
// knows your data shapes.
// ============================================================

export interface GameEntry {
  /** Canonical title — must match exactly for correct guesses */
  title: string;
  developer: string;
  year: number;
  genre: string;
  platforms: string;
  /** Typical first-playthrough length, e.g. "15–20 hours" */
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
  maxStreak: number;
  /** Key = number of guesses (1-6), value = count */
  distribution: Record<number, number>;
  /** ISO date string of last completed puzzle */
  lastPlayed?: string;
}

export interface GuessResult {
  guess: string;
  correct: boolean;
  /** Next clue to reveal (only if incorrect and guesses remain) */
  nextClue?: Clue;
}

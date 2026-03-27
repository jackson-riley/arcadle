import type { GameEntry } from "./types";

/** True if the guess equals the canonical title or any alias (exact match after trim). */
export function guessMatchesGame(game: GameEntry, guess: string): boolean {
  const g = guess.trim();
  if (g === game.title) return true;
  return (game.aliases ?? []).some((a) => a === g);
}

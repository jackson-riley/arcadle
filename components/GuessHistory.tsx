"use client";

import type { GameEntry } from "@/lib/types";
import { guessMatchesGame } from "@/lib/guessMatch";

interface GuessHistoryProps {
  guesses: string[];
  maxGuesses: number;
  game: GameEntry;
}

export default function GuessHistory({ guesses, maxGuesses, game }: GuessHistoryProps) {
  const slots = Array.from({ length: maxGuesses }, (_, i) => guesses[i] || null);

  return (
    <div className="flex gap-1.5 w-full">
      {slots.map((g, i) => (
        <div
          key={i}
          className={`flex-1 h-2 rounded-full transition-all duration-300 ${
            g === null
              ? "bg-zinc-800"
              : guessMatchesGame(game, g)
              ? "bg-ludle-green"
              : "bg-red-500/70"
          }`}
        />
      ))}
    </div>
  );
}

"use client";

interface GuessHistoryProps {
  guesses: string[];
  maxGuesses: number;
  answer: string;
}

export default function GuessHistory({ guesses, maxGuesses, answer }: GuessHistoryProps) {
  const slots = Array.from({ length: maxGuesses }, (_, i) => guesses[i] || null);

  return (
    <div className="flex gap-1.5 w-full">
      {slots.map((g, i) => (
        <div
          key={i}
          className={`flex-1 h-2 rounded-full transition-all duration-300 ${
            g === null
              ? "bg-zinc-800"
              : g === answer
              ? "bg-emerald-500"
              : "bg-red-500/70"
          }`}
        />
      ))}
    </div>
  );
}

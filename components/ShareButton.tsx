"use client";

import { useState } from "react";

interface ShareButtonProps {
  guesses: string[];
  maxGuesses: number;
  won: boolean;
  puzzleNumber: number;
}

export default function ShareButton({ guesses, maxGuesses, won, puzzleNumber }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const squares: string[] = guesses.map((_, i) =>
      i === guesses.length - 1 && won ? "🟩" : "🟥"
    );
    while (squares.length < maxGuesses) squares.push("⬛");

    const text = `🎮 Ludle #${puzzleNumber}\n${won ? guesses.length : "X"}/${maxGuesses}\n\n${squares.join("")}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleShare}
      className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

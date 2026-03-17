"use client";

import type { Clue } from "@/lib/types";

interface ClueStackProps {
  clues: Clue[];
  revealCount: number;
}

export default function ClueStack({ clues, revealCount }: ClueStackProps) {
  return (
    <div className="space-y-2 w-full">
      {clues.slice(0, revealCount).map((clue, i) => (
        <div
          key={clue.label}
          className="flex items-start gap-3 text-sm animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="text-zinc-600 font-mono text-xs mt-0.5 w-24 shrink-0 text-right tracking-wider">
            {clue.label}
          </span>
          <span className="text-zinc-300">{clue.value}</span>
        </div>
      ))}

      {revealCount < 6 && (
        <div className="flex items-start gap-3 text-sm">
          <span className="text-zinc-700 font-mono text-xs mt-0.5 w-24 shrink-0 text-right tracking-wider">
            {clues[revealCount]?.label}
          </span>
          <span className="text-zinc-700 italic">revealed after next guess</span>
        </div>
      )}
    </div>
  );
}

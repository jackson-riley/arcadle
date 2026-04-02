"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Clue } from "@/lib/types";

interface ClueStackProps {
  clues: Clue[];
  revealCount: number;
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ClueStack({ clues, revealCount }: ClueStackProps) {
  const prevRevealRef = useRef(revealCount);
  const [fadeIndices, setFadeIndices] = useState(() => new Set<number>());

  useLayoutEffect(() => {
    const prev = prevRevealRef.current;
    if (revealCount > prev) {
      const next = new Set<number>();
      for (let j = prev; j < revealCount; j++) next.add(j);
      setFadeIndices(next);
      const t = window.setTimeout(() => setFadeIndices(new Set()), 640);
      prevRevealRef.current = revealCount;
      return () => window.clearTimeout(t);
    }
    prevRevealRef.current = revealCount;
  }, [revealCount]);

  return (
    <div className="flex w-full flex-col gap-1">
      {clues.map((clue, i) => {
        const revealed = i < revealCount;
        const isNext = !revealed && i === revealCount;
        const isLocked = !revealed && i > revealCount;

        return (
          <div
            key={clue.label}
            className="grid w-full items-center gap-x-2 text-[13px] leading-tight [grid-template-columns:minmax(0,6.5rem)_0.75rem_minmax(0,1fr)]"
          >
            <span
              className={`text-right font-mono text-xs leading-none tracking-wider ${
                isLocked ? "text-zinc-700" : "text-zinc-600"
              }`}
            >
              {clue.label}
            </span>
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center">
              {isLocked ? (
                <LockIcon className="text-zinc-700 opacity-90" />
              ) : null}
            </span>
            <div className="clue-stack-clue-perspective min-w-0 leading-snug">
              {revealed && (
                <span
                  className={
                    fadeIndices.has(i)
                      ? "clue-unlock-flip inline-block text-white"
                      : "inline-block text-white"
                  }
                >
                  {clue.value}
                </span>
              )}
              {isNext && (
                <span className="text-zinc-600 italic">
                  revealed after next guess
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

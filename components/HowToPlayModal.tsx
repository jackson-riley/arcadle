"use client";

import { useEffect } from "react";

interface HowToPlayModalProps {
  onPlay: () => void;
  onClose: () => void;
}

export default function HowToPlayModal({ onPlay, onClose }: HowToPlayModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="how-to-play-title"
          className="text-zinc-100 text-lg font-semibold mb-4 tracking-wide"
        >
          How to Play
        </h2>

        <div className="space-y-3 text-sm text-zinc-400 leading-relaxed mb-5">
          <p className="text-zinc-300">
            Guess today&apos;s video game in <span className="text-zinc-100 font-medium">6</span>{" "}
            tries.
          </p>
          <p>
            Each wrong guess reveals a new clue and sharpens the screenshot.
          </p>
        </div>

        <div className="rounded-lg bg-zinc-950/80 border border-zinc-800/80 p-4 mb-5 space-y-3">
          <div className="flex justify-center gap-1 text-lg leading-none tracking-tight">
            <span aria-hidden>🟩</span>
            <span aria-hidden>🟥</span>
            <span aria-hidden>⬛</span>
            <span aria-hidden>⬛</span>
            <span aria-hidden>⬛</span>
            <span aria-hidden>⬛</span>
          </div>
          <ul className="text-xs text-zinc-500 space-y-2">
            <li className="flex gap-2">
              <span className="shrink-0" aria-hidden>
                🟩
              </span>
              <span>correct guess</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0" aria-hidden>
                🟥
              </span>
              <span>wrong guess</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0" aria-hidden>
                ⬛
              </span>
              <span>unused guess</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-zinc-500 text-center mb-5">
          A new puzzle drops every day at midnight.
        </p>

        <button
          type="button"
          onClick={onPlay}
          className="w-full py-2.5 bg-emerald-600/90 text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm font-medium"
        >
          Play
        </button>
      </div>
    </div>
  );
}

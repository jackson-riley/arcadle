"use client";

import { useState } from "react";

interface ShareButtonProps {
  guesses: string[];
  maxGuesses: number;
  won: boolean;
  puzzleNumber: number;
  isArchive?: boolean;
}

export default function ShareButton({
  guesses,
  maxGuesses,
  won,
  puzzleNumber,
  isArchive,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const squares: string[] = guesses.map((_, i) =>
      i === guesses.length - 1 && won ? "🟩" : "🟥"
    );
    while (squares.length < maxGuesses) squares.push("⬛");

    const headline = isArchive
      ? `🎮 Ludle #${puzzleNumber} (Archive)`
      : `🎮 Ludle #${puzzleNumber}`;

    const text = `${headline}\n${won ? guesses.length : "X"}/${maxGuesses}\n\n${squares.join(
      ""
    )}\n\nhttps://ludle.gg`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={[
        "inline-flex items-center justify-center rounded-lg border px-[14px] py-2 text-[13px] font-semibold tracking-[0.04em]",
        "font-['DM_Sans',sans-serif] transition-all duration-200 ease-in-out",
        "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8A8480]",
        "hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C8C4BF] hover:border-[rgba(255,255,255,0.1)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]",
        copied && "text-[#C8C4BF]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

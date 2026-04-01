"use client";

import { useState } from "react";
import type { GameEntry } from "@/lib/types";
import { slugify } from "@/lib/slug";

interface GameCardProps {
  game: GameEntry;
  revealLevel: number; // 0-6
  solved: boolean;
}

/**
 * Screenshot uses pre-generated blur levels from `/public/screenshots/<slug>/blur-{0..5}.jpg`
 * and `solved.jpg` (see `scripts/generate-blurs.ts`).
 * Natural aspect ratio (w-full h-auto), capped with max-h-[45dvh] for desktop.
 */
export default function GameCard({ game, revealLevel, solved }: GameCardProps) {
  const [imageError, setImageError] = useState(false);

  const slug = slugify(game.title);
  const levelIndex = Math.min(5, Math.max(0, revealLevel - 1));
  const imageSrc = solved
    ? `/screenshots/${slug}/solved.jpg`
    : `/screenshots/${slug}/blur-${levelIndex}.jpg`;

  return (
    <div className="flex w-full shrink-0 flex-col items-center">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ background: "#111" }}
      >
        {!imageError && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={game.title}
              className="block h-auto w-full max-h-[45dvh] object-contain transition-all duration-700 ease-out"
              onError={() => setImageError(true)}
            />
            {!solved && (
              <div
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{
                  boxShadow: "inset 0 0 48px rgba(0,0,0,0.45)",
                }}
                aria-hidden
              />
            )}
          </>
        )}

        {!solved && imageError && (
          <div
            className="min-h-[min(45dvh,12rem)] w-full"
            style={{
              background: `
                radial-gradient(ellipse at 40% 35%, ${game.color}55 0%, transparent 55%),
                radial-gradient(ellipse at 65% 70%, ${game.color}33 0%, transparent 50%),
                linear-gradient(160deg, #0a0a0a 0%, ${game.color}22 45%, #0a0a0a 100%)
              `,
            }}
          />
        )}
      </div>

      {solved && (
        <div className="mt-1.5 shrink-0 text-center text-[9px] uppercase tracking-[0.2em] text-zinc-600">
          SCREENSHOTS &copy; IGDB / TWITCH
        </div>
      )}
    </div>
  );
}

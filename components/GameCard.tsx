"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { GameEntry } from "@/lib/types";
import { slugify } from "@/lib/slug";

interface GameCardProps {
  game: GameEntry;
  revealLevel: number; // 0-6
  solved: boolean;
  /** Wrong titles guessed so far; overlaid on the image bottom (does not affect layout height). */
  wrongGuesses?: string[];
}

/**
 * Screenshot uses pre-generated blur levels from `/public/screenshots/<slug>/blur-{0..5}.jpg`
 * and `solved.jpg` (see `scripts/generate-blurs.ts`). `next/image` is `unoptimized` so JPEGs
 * are served straight from `/public` (no `/_next/image` pipeline on every blur swap).
 * Loading area uses 16:9 (aspect-video) capped at max-h-[45dvh]; image uses object-contain inside.
 */
export default function GameCard({
  game,
  revealLevel,
  solved,
  wrongGuesses = [],
}: GameCardProps) {
  /** Indices that skip entrance anim: preloaded on mount / after puzzle change, or after anim ends. */
  const skipEntranceAnimRef = useRef<Set<number> | null>(null);
  const lastGameTitleRef = useRef(game.title);
  if (lastGameTitleRef.current !== game.title) {
    lastGameTitleRef.current = game.title;
    skipEntranceAnimRef.current = null;
  }
  if (skipEntranceAnimRef.current === null) {
    skipEntranceAnimRef.current = new Set(
      wrongGuesses.map((_, i) => i)
    );
  }

  const slug = slugify(game.title);
  const levelIndex = Math.min(5, Math.max(0, revealLevel - 1));
  const imageSrc = solved
    ? `/screenshots/${slug}/solved.jpg`
    : `/screenshots/${slug}/blur-${levelIndex}.jpg`;

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  /** URL actually shown; stays on the previous image until the next one is preloaded (avoids flash). */
  const [displaySrc, setDisplaySrc] = useState(imageSrc);

  useEffect(() => {
    if (imageSrc === displaySrc) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) {
        setDisplaySrc(imageSrc);
        setImageLoaded(true);
        setImageError(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setDisplaySrc(imageSrc);
        setImageLoaded(true);
        setImageError(true);
      }
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, displaySrc]);

  return (
    <div className="flex w-full shrink-0 flex-col items-center">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ background: "#111" }}
      >
        {!imageError && (
          <>
            <div className="relative mx-auto aspect-video w-full max-h-[45dvh]">
              {!imageLoaded && (
                <div
                  className="absolute inset-0 z-0 animate-pulse rounded-lg bg-zinc-800"
                  aria-hidden
                />
              )}
              <Image
                src={displaySrc}
                alt={game.title}
                fill
                sizes="(max-width: 700px) 100vw, 700px"
                unoptimized
                className={`z-[1] object-contain transition-opacity duration-300 ease-out ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
            {!solved && (
              <div
                className="pointer-events-none absolute inset-0 z-[2]"
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

        {!solved && wrongGuesses.length > 0 && (
          <div
            role="region"
            aria-label="Wrong guesses"
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] flex flex-wrap gap-1 px-2 pb-2 pt-8"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.12) 85%, transparent 100%)",
            }}
          >
            {wrongGuesses.map((g, i) => {
              const playEntrance = !skipEntranceAnimRef.current!.has(i);
              return (
                <span
                  key={`${i}-${g}`}
                  className={`max-w-full truncate rounded-md border border-red-400/25 bg-black/35 px-1.5 py-0.5 text-[10px] text-red-200/95 shadow-sm backdrop-blur-[2px] sm:text-[11px]${
                    playEntrance ? " wrong-guess-chip-enter" : ""
                  }`}
                  title={g}
                  onAnimationEnd={(e) => {
                    if (
                      e.animationName !== "wrongGuessChipIn" ||
                      e.target !== e.currentTarget
                    )
                      return;
                    skipEntranceAnimRef.current?.add(i);
                  }}
                >
                  {g}
                </span>
              );
            })}
          </div>
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

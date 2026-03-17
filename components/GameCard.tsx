"use client";

import type { GameEntry } from "@/lib/types";

interface GameCardProps {
  game: GameEntry;
  revealLevel: number; // 0-6
  solved: boolean;
}

/**
 * Abstract visual card for the cardboard prototype.
 * Replace with actual screenshot + pixelation in production.
 *
 * UPGRADE PATH (for Cursor):
 *   1. Add `screenshotUrl` to GameEntry
 *   2. If screenshotUrl exists, render an <img> with CSS blur
 *   3. Blur levels: [30, 24, 18, 12, 6, 0]px
 *   4. In production, pre-generate blur levels server-side with sharp
 *      and serve different images per level (prevents devtools cheating)
 */
export default function GameCard({ game, revealLevel, solved }: GameCardProps) {
  const blur = solved ? 0 : Math.max(0, 30 - revealLevel * 5);
  const saturation = solved ? 100 : 30 + revealLevel * 14;

  return (
    <div
      className="relative w-full aspect-video rounded-lg overflow-hidden"
      style={{ background: "#111" }}
    >
      {/* Background gradient layers */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background: `
            radial-gradient(ellipse at 30% 40%, ${game.color}ee 0%, transparent 60%),
            radial-gradient(ellipse at 70% 60%, ${game.color}99 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, ${game.color}55 0%, transparent 70%),
            linear-gradient(135deg, #0a0a0a 0%, ${game.color}33 50%, #0a0a0a 100%)
          `,
          filter: `blur(${blur}px) saturate(${saturation}%)`,
        }}
      />

      {/* Abstract geometric shapes */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          filter: `blur(${blur}px)`,
          opacity: solved ? 1 : 0.4 + revealLevel * 0.1,
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: "40%",
            height: "40%",
            top: "20%",
            left: "15%",
            background: `${game.color}40`,
            border: `1px solid ${game.color}60`,
          }}
        />
        <div
          className="absolute"
          style={{
            width: "30%",
            height: "50%",
            bottom: "10%",
            right: "20%",
            background: `${game.color}30`,
            transform: "rotate(15deg)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "15%",
            height: "15%",
            top: "60%",
            left: "55%",
            background: `${game.color}70`,
          }}
        />
      </div>

      {/* Title overlay on solve */}
      {solved && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <span className="text-2xl font-bold text-white tracking-wide drop-shadow-lg">
            {game.title}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getCluesForGame, getDailyPuzzle, getPuzzleForNumber, getPuzzleNumber, getDateForPuzzleNumber } from "@/lib/puzzle";
import { GAME_TITLES } from "@/lib/games";
import { loadStats, saveStats, loadGameState, saveGameState } from "@/lib/storage";
import type { DailyPuzzle, GameState, PlayerStats } from "@/lib/types";
import GameCard from "./GameCard";
import GuessInput from "./GuessInput";
import ClueStack from "./ClueStack";
import GuessHistory from "./GuessHistory";
import StatsModal from "./StatsModal";
import ShareButton from "./ShareButton";

const MAX_GUESSES = 6;

export default function Game() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const todayNumber = useMemo(() => getPuzzleNumber(), []);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const savedStats = loadStats();
    setStats(savedStats);

    const todaysNumber = getPuzzleNumber();
    const savedGame = loadGameState(todaysNumber);
    if (savedGame) {
      const restored = getPuzzleForNumber(todaysNumber);
      setPuzzle(restored);
      setGuesses(savedGame.guesses);

      if (savedGame.completed) {
        const won =
          savedGame.guesses[savedGame.guesses.length - 1] === restored.game.title;
        setGameState(won ? "won" : "lost");
      }
    } else {
      const next = getDailyPuzzle();
      setPuzzle(next);
      saveGameState({
        puzzleNumber: next.puzzleNumber,
        guesses: [],
        completed: false,
      });
    }

    setHydrated(true);
  }, []);

  const revealCount = Math.min(guesses.length + 1, 6);

  const loadPuzzleByNumber = useCallback((num: number) => {
    const clamped = Math.max(1, Math.min(todayNumber, num));
    const saved = loadGameState(clamped);
    const next = getPuzzleForNumber(clamped);
    setPuzzle(next);
    setGuesses(saved?.guesses ?? []);
    setGameState(() => {
      if (!saved || !saved.completed) return "playing";
      const won =
        saved.guesses[saved.guesses.length - 1] === next.game.title;
      return won ? "won" : "lost";
    });
    if (!saved) {
      saveGameState({
        puzzleNumber: next.puzzleNumber,
        guesses: [],
        completed: false,
      });
    }
  }, [todayNumber]);

  const handleGuess = useCallback(
    (title: string) => {
      if (gameState !== "playing" || !puzzle) return;

      const newGuesses = [...guesses, title];
      setGuesses(newGuesses);

      const won = title === puzzle.game.title;
      const lost = !won && newGuesses.length >= MAX_GUESSES;

      if (won) {
        setGameState("won");
        setStats((prev) => {
          const s = prev || loadStats();
          const newStreak = s.streak + 1;
          const updated: PlayerStats = {
            played: s.played + 1,
            wins: s.wins + 1,
            streak: newStreak,
            maxStreak: Math.max(s.maxStreak, newStreak),
            distribution: {
              ...s.distribution,
              [newGuesses.length]: (s.distribution[newGuesses.length] || 0) + 1,
            },
            lastPlayed: new Date().toISOString(),
          };
          saveStats(updated);
          return updated;
        });
      } else if (lost) {
        setGameState("lost");
        setStats((prev) => {
          const s = prev || loadStats();
          const updated: PlayerStats = {
            ...s,
            played: s.played + 1,
            streak: 0,
            lastPlayed: new Date().toISOString(),
          };
          saveStats(updated);
          return updated;
        });
      }

      saveGameState({
        puzzleNumber: puzzle.puzzleNumber,
        guesses: newGuesses,
        completed: won || lost,
      });
    },
    [gameState, guesses, puzzle]
  );

  const handleGiveUp = useCallback(() => {
    setGameState("lost");
    setStats((prev) => {
      const s = prev || loadStats();
      const updated: PlayerStats = {
        ...s,
        played: s.played + 1,
        streak: 0,
        lastPlayed: new Date().toISOString(),
      };
      saveStats(updated);
      return updated;
    });
    if (!puzzle) return;
    saveGameState({
      puzzleNumber: puzzle.puzzleNumber,
      guesses,
      completed: true,
    });
  }, [guesses, puzzle]);

  const dateLabel = useMemo(() => {
    const date = getDateForPuzzleNumber(puzzle?.puzzleNumber ?? todayNumber);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [puzzle?.puzzleNumber, todayNumber]);

  // Don't render until hydrated to avoid localStorage mismatch
  if (!hydrated || !puzzle) {
    return (
      <div className="w-full max-w-lg px-4 pt-20 text-center">
        <div className="text-zinc-700 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg px-4">
      {/* Header */}
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
          >
            frame<span className="text-zinc-500">guessr</span>
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {dateLabel} · Day #{puzzle.puzzleNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadPuzzleByNumber(puzzle.puzzleNumber - 1)}
              disabled={puzzle.puzzleNumber <= 1}
              className="text-xs px-2 py-1 rounded-md border border-zinc-700 text-zinc-400 disabled:opacity-40"
            >
              ←
            </button>
            <span className="text-xs text-zinc-500 min-w-[4rem] text-center">
              Day #{puzzle.puzzleNumber}
            </span>
            <button
              onClick={() => loadPuzzleByNumber(puzzle.puzzleNumber + 1)}
              disabled={puzzle.puzzleNumber >= todayNumber}
              className="text-xs px-2 py-1 rounded-md border border-zinc-700 text-zinc-400 disabled:opacity-40"
            >
              →
            </button>
          </div>
          {gameState !== "playing" && (
            <ShareButton
              guesses={guesses}
              maxGuesses={MAX_GUESSES}
              won={gameState === "won"}
              puzzleNumber={puzzle.puzzleNumber}
            />
          )}
          <button
            onClick={() => setShowStats(true)}
            className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors"
          >
            Stats
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 pb-8">
        {/* Visual card */}
        <GameCard
          game={puzzle.game}
          revealLevel={revealCount}
          solved={gameState !== "playing"}
        />

        {/* Guess progress */}
        <GuessHistory
          guesses={guesses}
          maxGuesses={MAX_GUESSES}
          answer={puzzle.game.title}
        />

        {/* Clues */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
          <ClueStack clues={puzzle.clues} revealCount={revealCount} />
        </div>

        {/* Wrong guesses */}
        {guesses.length > 0 && gameState === "playing" && (
          <div className="flex flex-wrap gap-1.5">
            {guesses
              .filter((g) => g !== puzzle.game.title)
              .map((g, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-red-500/10 text-red-400/70 rounded border border-red-500/20"
                >
                  {g}
                </span>
              ))}
          </div>
        )}

        {/* Input */}
        {gameState === "playing" && (
          <>
            <GuessInput onGuess={handleGuess} gameTitles={GAME_TITLES} />
            <button
              onClick={handleGiveUp}
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors self-center"
            >
              Give up
            </button>
          </>
        )}

        {/* End state */}
        {gameState !== "playing" && (
          <div className="text-center py-4 animate-slide-up">
            {gameState === "won" ? (
              <p className="text-emerald-400 text-sm">
                Solved in {guesses.length} guess{guesses.length !== 1 && "es"}
              </p>
            ) : (
              <div>
                <p className="text-zinc-500 text-sm">The answer was</p>
                <p className="text-zinc-100 text-lg font-semibold mt-1">
                  {puzzle.game.title}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats modal */}
      {showStats && stats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

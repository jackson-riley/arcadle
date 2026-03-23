"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getDailyPuzzle, getPuzzleForNumber, getPuzzleNumber, getDateForPuzzleNumber } from "@/lib/puzzle";
import {
  ensureLudleDataVersion,
  loadStats,
  saveStats,
  loadGameState,
  saveGameState,
  hasLudleVisitedBefore,
  markLudleVisited,
} from "@/lib/storage";
import type { DailyPuzzle, GameState, PlayerStats } from "@/lib/types";
import GameCard from "./GameCard";
import GuessInput from "./GuessInput";
import ClueStack from "./ClueStack";
import GuessHistory from "./GuessHistory";
import StatsModal from "./StatsModal";
import HowToPlayModal from "./HowToPlayModal";
import ShareButton from "./ShareButton";

const MAX_GUESSES = 6;
const MAX_TEXT_CLUES = 4;

function getMsUntilLocalMidnight(): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return next.getTime() - now.getTime();
}

function formatCountdownHms(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function NextPuzzleCountdown() {
  const [countdown, setCountdown] = useState(() =>
    formatCountdownHms(getMsUntilLocalMidnight())
  );

  useEffect(() => {
    const tick = () => {
      setCountdown(formatCountdownHms(getMsUntilLocalMidnight()));
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="text-zinc-500 text-sm mt-3">
      Next puzzle in{" "}
      <span className="tabular-nums text-zinc-400">{countdown}</span>
    </p>
  );
}

export default function Game() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [todayNumber, setTodayNumber] = useState(() => getPuzzleNumber());
  const todayNumberRef = useRef(todayNumber);

  useEffect(() => {
    todayNumberRef.current = todayNumber;
  }, [todayNumber]);

  const applyPuzzleNumber = useCallback((num: number) => {
    const today = todayNumberRef.current;
    if (num < 1 || num > today) return;

    const p = getPuzzleForNumber(num);
    const saved = loadGameState(num);
    setPuzzle(p);
    setGuesses(saved?.guesses ?? []);
    if (saved?.completed) {
      const won = saved.guesses[saved.guesses.length - 1] === p.game.title;
      setGameState(won ? "won" : "lost");
    } else {
      setGameState("playing");
    }
    if (!saved) {
      saveGameState({ puzzleNumber: num, guesses: [], completed: false });
    }
  }, []);

  // Hydrate from localStorage after mount
  useEffect(() => {
    ensureLudleDataVersion();
    const savedStats = loadStats();
    setStats(savedStats);

    const todaysNumber = getPuzzleNumber();
    setTodayNumber(todaysNumber);
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

    if (!hasLudleVisitedBefore()) {
      setShowHowToPlay(true);
    }

    setHydrated(true);
  }, []);

  // Roll over to the next puzzle at local midnight (without requiring reload).
  // Only auto-switch if the player is currently on "today".
  useEffect(() => {
    const syncIfDayChanged = () => {
      const newToday = getPuzzleNumber();
      const prevToday = todayNumberRef.current;

      // Always keep the "today" bound fresh, but only auto-advance puzzles
      // when the day actually rolls over.
      if (newToday !== prevToday) {
        setTodayNumber(newToday);

        // Auto-advance when viewing today's puzzle and the calendar day rolls over.
        if (puzzle && puzzle.puzzleNumber === prevToday) {
          const saved = loadGameState(newToday);
          const next = getPuzzleForNumber(newToday);
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
              puzzleNumber: newToday,
              guesses: [],
              completed: false,
            });
          }
        }
      } else {
        // Still update state in case something else changed it earlier
        setTodayNumber(newToday);
      }

      // Ensure ref is up-to-date even if state update is async
      todayNumberRef.current = newToday;
    };

    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      );
      const ms = Math.max(1_000, nextMidnight.getTime() - now.getTime());
      return window.setTimeout(() => {
        syncIfDayChanged();
        scheduleId = scheduleNextMidnight();
      }, ms);
    };

    // Immediate sync (covers "tab was sleeping past midnight" cases)
    syncIfDayChanged();

    // Also sync when tab becomes active again
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncIfDayChanged();
    };
    window.addEventListener("focus", syncIfDayChanged);
    document.addEventListener("visibilitychange", onVisibility);

    // Fallback periodic sync (browsers can throttle timers in background)
    const intervalId = window.setInterval(syncIfDayChanged, 60_000);
    let scheduleId = scheduleNextMidnight();

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(scheduleId);
      window.removeEventListener("focus", syncIfDayChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [puzzle]);

  // Text clues: 4 total. None before the first guess; each guess reveals one more (capped at 4).
  const revealCount =
    gameState === "playing"
      ? Math.min(guesses.length, MAX_TEXT_CLUES)
      : MAX_TEXT_CLUES;

  // Visual blur: 6 stages (final guess improves blur only).
  const revealLevel =
    gameState === "playing" ? Math.min(guesses.length + 1, MAX_GUESSES) : MAX_GUESSES;

  const handleGuess = useCallback(
    (title: string) => {
      if (gameState !== "playing" || !puzzle) return;

      const newGuesses = [...guesses, title];
      setGuesses(newGuesses);

      const won = title === puzzle.game.title;
      const lost = !won && newGuesses.length >= MAX_GUESSES;
      const trackStats = puzzle.puzzleNumber === todayNumber;

      if (won) {
        setGameState("won");
        if (trackStats) {
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
        }
      } else if (lost) {
        setGameState("lost");
        if (trackStats) {
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
      }

      saveGameState({
        puzzleNumber: puzzle.puzzleNumber,
        guesses: newGuesses,
        completed: won || lost,
      });
    },
    [gameState, guesses, puzzle, todayNumber]
  );

  const handleGiveUp = useCallback(() => {
    setGameState("lost");
    if (puzzle && puzzle.puzzleNumber === todayNumber) {
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
    if (!puzzle) return;
    saveGameState({
      puzzleNumber: puzzle.puzzleNumber,
      guesses,
      completed: true,
    });
  }, [guesses, puzzle, todayNumber]);

  const dateLabel = useMemo(() => {
    const date = getDateForPuzzleNumber(puzzle?.puzzleNumber ?? todayNumber);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
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

  const isArchiveView = puzzle.puzzleNumber !== todayNumber;
  const canGoBack = puzzle.puzzleNumber > 1;
  const canGoForward = puzzle.puzzleNumber < todayNumber;

  return (
    <div className="w-full max-w-lg px-4">
      {/* Header */}
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
          >
            lud<span className="text-zinc-500">le</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => applyPuzzleNumber(puzzle.puzzleNumber - 1)}
              disabled={!canGoBack}
              className="text-sm px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-zinc-800"
              aria-label="Previous day"
            >
              ←
            </button>
            <span className="tabular-nums font-medium">
              Day {puzzle.puzzleNumber} · {dateLabel}
            </span>
            <button
              type="button"
              onClick={() => applyPuzzleNumber(puzzle.puzzleNumber + 1)}
              disabled={!canGoForward}
              className="text-sm px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-zinc-800"
              aria-label="Next day"
            >
              →
            </button>
            {isArchiveView && (
              <button
                type="button"
                onClick={() => applyPuzzleNumber(todayNumber)}
                className="text-[11px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors font-medium"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div
            className={`transition-opacity duration-200 ${
              gameState === "playing"
                ? "opacity-30 pointer-events-none"
                : "opacity-100"
            }`}
            aria-hidden={gameState === "playing"}
          >
            <ShareButton
              guesses={guesses}
              maxGuesses={MAX_GUESSES}
              won={gameState === "won"}
              puzzleNumber={puzzle.puzzleNumber}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="text-xs px-2.5 py-1.5 bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700 transition-colors font-medium min-w-[2rem]"
            aria-label="How to play"
          >
            ?
          </button>
          <button
            type="button"
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
          revealLevel={revealLevel}
          solved={gameState !== "playing"}
        />
        {isArchiveView && (
          <p className="text-center text-xs text-zinc-600 -mt-1">
            Archive — stats not tracked
          </p>
        )}

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
            <GuessInput onGuess={handleGuess} />
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
            {!isArchiveView && <NextPuzzleCountdown />}
          </div>
        )}
      </div>

      {/* How to play */}
      {showHowToPlay && (
        <HowToPlayModal
          onPlay={() => {
            markLudleVisited();
            setShowHowToPlay(false);
          }}
          onClose={() => setShowHowToPlay(false)}
        />
      )}

      {/* Stats modal */}
      {showStats && stats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

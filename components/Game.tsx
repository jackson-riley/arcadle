"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDailyPuzzle, getPuzzleForNumber, getPuzzleNumber } from "@/lib/puzzle";
import {
  ensureLudleDataVersion,
  loadStats,
  saveStats,
  loadGameState,
  saveGameState,
  hasLudleVisitedBefore,
  markLudleVisited,
  type SavedGameState,
} from "@/lib/storage";
import { getOrCreatePlayerId } from "@/lib/playerId";
import { postPuzzleResult } from "@/lib/globalStatsApi";
import type { DailyPuzzle, GameState, PlayerStats } from "@/lib/types";
import {
  localTodayString,
  normalizeStreakStats,
  streakAfterWin,
} from "@/lib/streak";
import { guessMatchesGame } from "@/lib/guessMatch";
import GameCard from "./GameCard";
import GuessInput from "./GuessInput";
import ClueStack from "./ClueStack";
import GuessHistory from "./GuessHistory";
import StatsModal from "./StatsModal";
import HowToPlayModal from "./HowToPlayModal";
import ShareButton from "./ShareButton";

const MAX_GUESSES = 6;
const MAX_TEXT_CLUES = 4;

function saveGameStateMerged(state: SavedGameState): void {
  const prev = loadGameState(state.puzzleNumber);
  saveGameState({
    ...state,
    globalStatsSubmitted:
      state.globalStatsSubmitted ?? prev?.globalStatsSubmitted,
  });
}

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
  const [statsTrackedForPuzzle, setStatsTrackedForPuzzle] = useState<
    boolean | undefined
  >(undefined);

  useEffect(() => {
    todayNumberRef.current = todayNumber;
  }, [todayNumber]);

  const submitGlobalStatsIfNeeded = useCallback(
    async (puzzleNumber: number, guessList: string[], solved: boolean) => {
      if (puzzleNumber !== todayNumberRef.current) return;
      const playerId = getOrCreatePlayerId();
      if (!playerId) return;
      const saved = loadGameState(puzzleNumber);
      if (saved?.globalStatsSubmitted) return;
      try {
        await postPuzzleResult({
          puzzleNumber,
          guesses: guessList.length,
          solved,
          playerId,
        });
        const latest = loadGameState(puzzleNumber);
        if (latest) {
          saveGameStateMerged({ ...latest, globalStatsSubmitted: true });
        }
      } catch {
        /* retried from effect below */
      }
    },
    []
  );

  const applyPuzzleNumber = useCallback((num: number) => {
    const today = todayNumberRef.current;
    if (num < 1 || num > today) return;

    const p = getPuzzleForNumber(num);
    const saved = loadGameState(num);
    setPuzzle(p);
    setGuesses(saved?.guesses ?? []);
    setStatsTrackedForPuzzle(saved?.statsTracked);
    if (saved?.completed) {
      const last = saved.guesses[saved.guesses.length - 1];
      const won = guessMatchesGame(p.game, last);
      setGameState(won ? "won" : "lost");
    } else {
      setGameState("playing");
    }
    if (!saved) {
      saveGameStateMerged({
        puzzleNumber: num,
        guesses: [],
        completed: false,
        statsTracked: false,
      });
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
      setStatsTrackedForPuzzle(savedGame.statsTracked);

      if (savedGame.completed) {
        const last = savedGame.guesses[savedGame.guesses.length - 1];
        const won = guessMatchesGame(restored.game, last);
        setGameState(won ? "won" : "lost");
      }
    } else {
      const next = getDailyPuzzle();
      setPuzzle(next);
      setStatsTrackedForPuzzle(false);
      saveGameStateMerged({
        puzzleNumber: next.puzzleNumber,
        guesses: [],
        completed: false,
        statsTracked: false,
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
        setStats(loadStats());

        // Auto-advance when viewing today's puzzle and the calendar day rolls over.
        if (puzzle && puzzle.puzzleNumber === prevToday) {
          const saved = loadGameState(newToday);
          const next = getPuzzleForNumber(newToday);
          setPuzzle(next);
          setGuesses(saved?.guesses ?? []);
          setStatsTrackedForPuzzle(saved?.statsTracked);
          setGameState(() => {
            if (!saved || !saved.completed) return "playing";
            const last = saved.guesses[saved.guesses.length - 1];
            const won = guessMatchesGame(next.game, last);
            return won ? "won" : "lost";
          });
          if (!saved) {
            saveGameStateMerged({
              puzzleNumber: newToday,
              guesses: [],
              completed: false,
              statsTracked: false,
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

  // Retry global stats if a previous submit failed (e.g. offline).
  useEffect(() => {
    if (!hydrated || !puzzle) return;
    if (puzzle.puzzleNumber !== todayNumber) return;
    const saved = loadGameState(puzzle.puzzleNumber);
    if (!saved?.completed || saved.globalStatsSubmitted) return;
    const last = saved.guesses[saved.guesses.length - 1];
    const won = guessMatchesGame(puzzle.game, last);
    void submitGlobalStatsIfNeeded(puzzle.puzzleNumber, saved.guesses, won);
  }, [hydrated, puzzle, todayNumber, submitGlobalStatsIfNeeded]);

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

      const won = guessMatchesGame(puzzle.game, title);
      const lost = !won && newGuesses.length >= MAX_GUESSES;
      const trackStats = puzzle.puzzleNumber === todayNumber; // Only today's puzzle affects stats
      const completed = won || lost;
      const statsTracked = completed && trackStats;

      if (won) {
        setGameState("won");
        if (trackStats) {
          setStats((prev) => {
            const s = normalizeStreakStats(prev || loadStats());
            const todayLocal = localTodayString();
            const newStreak = streakAfterWin(s, todayLocal);
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
              lastWinDate: todayLocal,
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

      saveGameStateMerged({
        puzzleNumber: puzzle.puzzleNumber,
        guesses: newGuesses,
        completed,
        statsTracked,
      });

      if (completed && puzzle.puzzleNumber === todayNumber) {
        void submitGlobalStatsIfNeeded(
          puzzle.puzzleNumber,
          newGuesses,
          won
        );
      }
    },
    [gameState, guesses, puzzle, todayNumber, submitGlobalStatsIfNeeded]
  );

  const handleGiveUp = useCallback(() => {
    const statsTracked = !!(puzzle && puzzle.puzzleNumber === todayNumber);
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
    saveGameStateMerged({
      puzzleNumber: puzzle.puzzleNumber,
      guesses,
      completed: true,
      statsTracked,
    });
    if (puzzle.puzzleNumber === todayNumber) {
      void submitGlobalStatsIfNeeded(puzzle.puzzleNumber, guesses, false);
    }
  }, [guesses, puzzle, todayNumber, submitGlobalStatsIfNeeded]);

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
      <header className="pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
          >
            lud<span className="text-zinc-500">le</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 whitespace-nowrap">
            <button
              type="button"
              onClick={() => applyPuzzleNumber(puzzle.puzzleNumber - 1)}
              disabled={!canGoBack}
              className="text-sm px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-zinc-800 outline-none focus:outline-none"
              aria-label="Previous day"
            >
              ←
            </button>
            <span className="tabular-nums font-medium min-w-[4.5rem] text-center">
              Day {puzzle.puzzleNumber}
            </span>
            <button
              type="button"
              onClick={() => applyPuzzleNumber(puzzle.puzzleNumber + 1)}
              disabled={!canGoForward}
              className="text-sm px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-zinc-800 outline-none focus:outline-none"
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
              isArchive={isArchiveView}
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
            Archive
          </p>
        )}

        {/* Guess progress */}
        <GuessHistory
          guesses={guesses}
          maxGuesses={MAX_GUESSES}
          game={puzzle.game}
        />

        {/* Clues */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
          <ClueStack clues={puzzle.clues} revealCount={revealCount} />
        </div>

        {/* Wrong guesses */}
        {guesses.length > 0 && gameState === "playing" && (
          <div className="flex flex-wrap gap-1.5">
            {guesses
              .filter((g) => !guessMatchesGame(puzzle.game, g))
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
        <StatsModal
          stats={stats}
          todayPuzzleNumber={todayNumber}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

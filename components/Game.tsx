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

const HEADER_GHOST_BTN =
  "rounded-lg border py-2 px-[14px] text-[13px] font-semibold tracking-[0.04em] " +
  "font-['DM_Sans',sans-serif] transition-all duration-200 ease-in-out " +
  "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8A8480] " +
  "hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C8C4BF] hover:border-[rgba(255,255,255,0.1)] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]";

/** Same as HEADER_GHOST_BTN but equal horizontal padding for the single-char control. */
const HEADER_GHOST_BTN_SQUARE =
  "rounded-lg border py-2 px-2 text-[13px] font-semibold tracking-[0.04em] " +
  "font-['DM_Sans',sans-serif] transition-all duration-200 ease-in-out " +
  "inline-flex min-w-[2.25rem] items-center justify-center " +
  "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8A8480] " +
  "hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C8C4BF] hover:border-[rgba(255,255,255,0.1)] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]";

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
    <p className="text-[12px] text-zinc-500">
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

  /** Leaderboard / global stats only — archive completions never call the API. */
  const submitGlobalStatsIfNeeded = useCallback(
    async (puzzleNumber: number, guessList: string[], solved: boolean) => {
      // Calendar day index — same source as Redis keys (not React state, which can lag after midnight).
      const calendarToday = getPuzzleNumber();
      if (puzzleNumber !== calendarToday) return;
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
    if (puzzle.puzzleNumber !== getPuzzleNumber()) return;
    const saved = loadGameState(puzzle.puzzleNumber);
    if (!saved?.completed || saved.globalStatsSubmitted) return;
    const last = saved.guesses[saved.guesses.length - 1];
    const won = guessMatchesGame(puzzle.game, last);
    void submitGlobalStatsIfNeeded(puzzle.puzzleNumber, saved.guesses, won);
  }, [hydrated, puzzle, submitGlobalStatsIfNeeded]);

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

      if (completed && puzzle.puzzleNumber === getPuzzleNumber()) {
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
    if (puzzle.puzzleNumber === getPuzzleNumber()) {
      void submitGlobalStatsIfNeeded(puzzle.puzzleNumber, guesses, false);
    }
  }, [guesses, puzzle, todayNumber, submitGlobalStatsIfNeeded]);

  // Don't render until hydrated to avoid localStorage mismatch
  if (!hydrated || !puzzle) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <div className="text-sm text-zinc-700">Loading...</div>
      </div>
    );
  }

  const isArchiveView = puzzle.puzzleNumber !== todayNumber;
  const canGoBack = puzzle.puzzleNumber > 1;
  const canGoForward = puzzle.puzzleNumber < todayNumber;

  const playing = gameState === "playing";

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-5 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* One vertical unit: header → … → input / “Next puzzle” — centered; playing uses same image height as solved */}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
        <div className="flex w-full shrink-0 flex-col gap-2">
          <header className="flex shrink-0 flex-col gap-1 border-b border-[rgba(255,255,255,0.04)] py-2">
            <div className="flex items-center justify-between gap-3">
              <h1
                className="m-0 text-[26px] font-extrabold leading-none tracking-[-0.03em] lowercase sm:text-[28px]"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                <span style={{ color: "#E8E4DF" }}>lud</span>
                <span style={{ color: "#A09A94" }}>le</span>
              </h1>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div
                  className={`transition-opacity duration-200 ${
                    playing
                      ? "pointer-events-none opacity-30"
                      : "opacity-100"
                  }`}
                  aria-hidden={playing}
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
                  className={HEADER_GHOST_BTN_SQUARE + " shrink-0 tabular-nums"}
                  aria-label="How to play"
                >
                  ?
                </button>
                <button
                  type="button"
                  onClick={() => setShowStats(true)}
                  className={
                    HEADER_GHOST_BTN + " inline-flex items-center justify-center"
                  }
                >
                  Stats
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-['DM_Sans',sans-serif] whitespace-nowrap">
              <button
                type="button"
                onClick={() => applyPuzzleNumber(puzzle.puzzleNumber - 1)}
                disabled={!canGoBack}
                className="rounded p-0.5 text-base leading-none text-[#6A6560] transition-colors hover:text-[#C8C4BF] disabled:pointer-events-none disabled:opacity-25 disabled:hover:text-[#6A6560] outline-none focus-visible:text-[#C8C4BF] focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]"
                aria-label="Previous day"
              >
                ←
              </button>
              <span className="min-w-[4rem] text-center text-[12px] font-medium tabular-nums text-[#8A8480] sm:text-[13px]">
                Day {puzzle.puzzleNumber}
                {isArchiveView && (
                  <span className="text-zinc-600"> · Archive</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => applyPuzzleNumber(puzzle.puzzleNumber + 1)}
                disabled={!canGoForward}
                className="rounded p-0.5 text-base leading-none text-[#6A6560] transition-colors hover:text-[#C8C4BF] disabled:pointer-events-none disabled:opacity-25 disabled:hover:text-[#6A6560] outline-none focus-visible:text-[#C8C4BF] focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]"
                aria-label="Next day"
              >
                →
              </button>
              {isArchiveView && (
                <button
                  type="button"
                  onClick={() => applyPuzzleNumber(todayNumber)}
                  className="ml-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-[#6A6560] transition-colors hover:text-[#C8C4BF] outline-none focus-visible:ring-2 focus-visible:ring-white/10 sm:text-[12px]"
                >
                  Today
                </button>
              )}
            </div>
          </header>

          {/* Screenshot — same aspect-video frame playing vs solved (avoids flex-1 height / gap issue) */}
          <div className="flex w-full shrink-0 flex-col items-center overflow-hidden">
            <GameCard
              game={puzzle.game}
              revealLevel={revealLevel}
              solved={!playing}
            />
          </div>

          {/* Guess progress */}
          <div className="w-full shrink-0 py-0.5">
            <GuessHistory
              guesses={guesses}
              maxGuesses={MAX_GUESSES}
              game={puzzle.game}
            />
          </div>

          {/* Clues */}
          <div className="w-full shrink-0 rounded-lg border border-zinc-800/50 bg-zinc-900/50 px-2.5 py-2">
            <ClueStack
              key={puzzle.puzzleNumber}
              clues={puzzle.clues}
              revealCount={revealCount}
            />
          </div>

          {/* Wrong guesses — clip instead of growing the layout */}
          {guesses.length > 0 && playing && (
            <div className="max-h-7 shrink-0 overflow-hidden">
              <div className="flex flex-wrap gap-1">
                {guesses
                  .filter((g) => !guessMatchesGame(puzzle.game, g))
                  .map((g, i) => (
                    <span
                      key={i}
                      className="max-w-full truncate rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400/80 sm:text-[11px]"
                      title={g}
                    >
                      {g}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Input / end state */}
          <div className="shrink-0 space-y-1.5 pt-1">
            {playing && (
              <GuessInput onGuess={handleGuess} onGiveUp={handleGiveUp} />
            )}

            {!playing && (
              <div className="animate-slide-up space-y-1 text-center">
                {gameState === "won" ? (
                  <div>
                    <p className="font-dm-sans text-[13px] text-ludle-green sm:text-sm">
                      Solved in {guesses.length} guess{guesses.length !== 1 && "es"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold leading-tight text-zinc-100 sm:text-base">
                      {puzzle.game.title}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[12px] text-zinc-500 sm:text-sm">
                      The answer was
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold leading-tight text-zinc-100 sm:text-base">
                      {puzzle.game.title}
                    </p>
                  </div>
                )}
                {!isArchiveView && <NextPuzzleCountdown />}
              </div>
            )}
          </div>
        </div>
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
          globalStatsPuzzleNumber={puzzle.puzzleNumber}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

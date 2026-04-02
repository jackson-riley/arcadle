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
import { slugify } from "@/lib/slug";
import { fireWinConfetti } from "@/lib/winConfetti";
import GameCard from "./GameCard";
import GuessInput from "./GuessInput";
import ClueStack from "./ClueStack";
import GuessHistory from "./GuessHistory";
import StatsModal from "./StatsModal";
import HowToPlayModal from "./HowToPlayModal";
import ShareButton from "./ShareButton";

const MAX_GUESSES = 6;
const MAX_TEXT_CLUES = 4;
/** Must match `gamecardLossShake` duration in `app/globals.css`. */
const LOSS_SCREEN_SHAKE_MS = 500;
// After a lineup correction, we reset day 14 community stats server-side.
// This client logic allows resubmitting day 14 once per player even if the
// browser previously marked it as already submitted.
const GLOBAL_STATS_RESET_PUZZLE_NUMBER = 14;

const HEADER_GHOST_BTN =
  "rounded-lg border py-2 px-[14px] text-[13px] font-semibold tracking-[0.04em] " +
  "font-dm-sans transition-all duration-200 ease-in-out " +
  "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8A8480] " +
  "hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C8C4BF] hover:border-[rgba(255,255,255,0.1)] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]";

/** Same as HEADER_GHOST_BTN but equal horizontal padding for the single-char control. */
const HEADER_GHOST_BTN_SQUARE =
  "rounded-lg border py-2 px-2 text-[13px] font-semibold tracking-[0.04em] " +
  "font-dm-sans transition-all duration-200 ease-in-out " +
  "inline-flex min-w-[2.25rem] items-center justify-center " +
  "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#8A8480] " +
  "hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C8C4BF] hover:border-[rgba(255,255,255,0.1)] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]";

/** Same screenshot URL rules as `GameCard`, for prefetching adjacent archive days. */
function getPrefetchScreenshotUrl(puzzleNumber: number): string {
  const p = getPuzzleForNumber(puzzleNumber);
  const saved = loadGameState(puzzleNumber);
  const slug = slugify(p.game.title);
  if (!saved || !saved.completed) {
    const revealLevel = saved
      ? Math.min(saved.guesses.length + 1, MAX_GUESSES)
      : 1;
    const levelIndex = Math.min(5, Math.max(0, revealLevel - 1));
    return `/screenshots/${slug}/blur-${levelIndex}.jpg`;
  }
  return `/screenshots/${slug}/solved.jpg`;
}

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
  const [giveUpConfirming, setGiveUpConfirming] = useState(false);
  /** True only for a fresh loss (6th wrong guess or give up); delays solved screenshot until shake ends. */
  const [pendingLossReveal, setPendingLossReveal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [todayNumber, setTodayNumber] = useState(() => getPuzzleNumber());
  const todayNumberRef = useRef(todayNumber);
  useEffect(() => {
    todayNumberRef.current = todayNumber;
  }, [todayNumber]);

  useEffect(() => {
    setGiveUpConfirming(false);
    setPendingLossReveal(false);
  }, [puzzle?.puzzleNumber]);

  useEffect(() => {
    if (gameState !== "lost" || !pendingLossReveal) return;
    const id = window.setTimeout(
      () => setPendingLossReveal(false),
      LOSS_SCREEN_SHAKE_MS
    );
    return () => window.clearTimeout(id);
  }, [gameState, pendingLossReveal]);

  /** Leaderboard / global stats only — archive completions never call the API. */
  const submitGlobalStatsIfNeeded = useCallback(
    async (puzzleNumber: number, guessList: string[], solved: boolean) => {
      // Calendar day index — same source as Redis keys (not React state, which can lag after midnight).
      const calendarToday = getPuzzleNumber();
      if (
        puzzleNumber !== calendarToday &&
        puzzleNumber !== GLOBAL_STATS_RESET_PUZZLE_NUMBER
      )
        return;
      const playerId = getOrCreatePlayerId();
      if (!playerId) return;
      const saved = loadGameState(puzzleNumber);
      if (
        saved?.globalStatsSubmitted &&
        puzzleNumber !== GLOBAL_STATS_RESET_PUZZLE_NUMBER
      )
        return;
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

      if (savedGame.completed) {
        const last = savedGame.guesses[savedGame.guesses.length - 1];
        const won = guessMatchesGame(restored.game, last);
        setGameState(won ? "won" : "lost");
      }
    } else {
      const next = getDailyPuzzle();
      setPuzzle(next);
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

  // Archive: warm cache for prev/next day screenshots so day-to-day navigation feels instant.
  useEffect(() => {
    if (!puzzle || puzzle.puzzleNumber === todayNumber) return;
    const n = puzzle.puzzleNumber;
    if (n > 1) {
      const prev = new Image();
      prev.src = getPrefetchScreenshotUrl(n - 1);
    }
    if (n < todayNumber) {
      const next = new Image();
      next.src = getPrefetchScreenshotUrl(n + 1);
    }
  }, [puzzle, todayNumber]);

  // Retry global stats if a previous submit failed (e.g. offline).
  useEffect(() => {
    if (!hydrated || !puzzle) return;
    if (
      puzzle.puzzleNumber !== getPuzzleNumber() &&
      puzzle.puzzleNumber !== GLOBAL_STATS_RESET_PUZZLE_NUMBER
    )
      return;
    const saved = loadGameState(puzzle.puzzleNumber);
    if (
      !saved?.completed ||
      (saved.globalStatsSubmitted &&
        puzzle.puzzleNumber !== GLOBAL_STATS_RESET_PUZZLE_NUMBER)
    )
      return;
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
        fireWinConfetti();
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
        // Deferred solved screenshot + shake: daily and archive (not only stats-eligible days).
        setPendingLossReveal(true);
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
    // Same loss shake + reveal delay as a 6th wrong guess (daily and archive).
    setPendingLossReveal(true);
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
      <div className="mx-auto flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-[700px] flex-col items-center justify-center overflow-hidden px-5">
        <div className="text-sm text-zinc-700">Loading...</div>
      </div>
    );
  }

  const isArchiveView = puzzle.puzzleNumber !== todayNumber;
  const canGoBack = puzzle.puzzleNumber > 1;
  const canGoForward = puzzle.puzzleNumber < todayNumber;

  const playing = gameState === "playing";

  return (
    <div className="mx-auto flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-[700px] flex-col overflow-hidden px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <header className="flex w-full shrink-0 flex-col gap-1 border-b border-[rgba(255,255,255,0.04)] bg-[#111110] py-2 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="m-0 font-outfit text-[26px] font-extrabold leading-none tracking-[-0.03em] lowercase sm:text-[28px]">
            <span style={{ color: "#E8E4DF" }}>lud</span>
            <span style={{ color: "#A09A94" }}>le</span>
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div
              className={`transition-opacity duration-200 ${
                playing ? "pointer-events-none opacity-30" : "opacity-100"
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
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-dm-sans whitespace-nowrap">
          <button
            type="button"
            onClick={() => applyPuzzleNumber(puzzle.puzzleNumber - 1)}
            disabled={!canGoBack}
            className="rounded p-0.5 text-base leading-none text-[#6A6560] transition-colors hover:text-[#C8C4BF] disabled:pointer-events-none disabled:opacity-25 disabled:hover:text-[#6A6560] outline-none focus-visible:text-[#C8C4BF] focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110]"
            aria-label="Previous day"
          >
            ←
          </button>
          <span className="inline-flex items-baseline justify-center gap-1 text-[12px] font-medium text-[#8A8480] sm:text-[13px]">
            <span className="inline-block min-w-[3rem] whitespace-nowrap text-center tabular-nums">
              Day {puzzle.puzzleNumber}
            </span>
            {isArchiveView && (
              <span className="text-zinc-600">· Archive</span>
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-2 overflow-hidden pt-4">
        {/* Screenshot — intrinsic height; max 45dvh */}
        <div className="w-full shrink-0">
          <GameCard
            key={puzzle.puzzleNumber}
            game={puzzle.game}
            gameState={gameState}
            revealLevel={revealLevel}
            pendingLossReveal={pendingLossReveal}
            wrongGuesses={
              playing
                ? guesses.filter((g) => !guessMatchesGame(puzzle.game, g))
                : undefined
            }
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

        {/* Input / end state */}
        <div className="shrink-0 space-y-1.5 pt-1">
          {playing && (
            <>
              <GuessInput onGuess={handleGuess} />
              <div className="flex flex-col items-center pt-0.5">
                {!giveUpConfirming ? (
                  <button
                    type="button"
                    onClick={() => setGiveUpConfirming(true)}
                    className="text-[11px] leading-snug text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110] rounded-sm"
                  >
                    Give up
                  </button>
                ) : (
                  <div
                    className="flex flex-col items-center gap-1.5 text-center"
                    role="group"
                    aria-label="Confirm give up"
                  >
                    <p className="m-0 text-[11px] leading-snug text-zinc-600">
                      Are you sure?
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          handleGiveUp();
                          setGiveUpConfirming(false);
                        }}
                        className="text-[11px] font-medium leading-snug text-zinc-500 transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110] rounded-sm"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setGiveUpConfirming(false)}
                        className="text-[11px] leading-snug text-zinc-600 transition-colors hover:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110] rounded-sm"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
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

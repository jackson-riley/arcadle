"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PlayerStats } from "@/lib/types";
import { formatAvgGuessesOnWins } from "@/lib/storage";
import {
  fetchGlobalStats,
  type GlobalStatsResponse,
} from "@/lib/globalStatsApi";

interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
  /** Which puzzle’s global aggregates to load (today or archive day). */
  globalStatsPuzzleNumber: number;
}

const TEXT_PRIMARY = "#E8E4DF";
const TEXT_MUTED = "#8A8480";
const NESTED_LABEL_COLOR = "#6A6560";
const BORDER_SUBTLE = "rgba(255,255,255,0.04)";
const BORDER_CARD = "rgba(255,255,255,0.06)";

/** Guess-distribution bar fill (all rows with data) */
const BAR_FILL_GRADIENT =
  "linear-gradient(90deg, var(--color-green), var(--color-green-light))";

/** BASE = 0.35s — animation delays (pure CSS stagger via --d / --bar-d) */
const T = {
  overlay: "0.35s",
  card: "0.35s",
  title: "0.4s",
  personalHdr: "0.43s",
  stat0: "0.45s",
  stat1: "0.5s",
  stat2: "0.55s",
  stat3: "0.6s",
  dayHdr: "0.65s",
  community: "0.67s",
  distLabel: "0.72s",
  bar1: "0.75s",
  bar2: "0.8s",
  bar3: "0.85s",
  bar4: "0.9s",
  bar5: "0.95s",
  bar6: "1s",
  close: "1.05s",
} as const;

const barFadeDelays = [
  T.bar1,
  T.bar2,
  T.bar3,
  T.bar4,
  T.bar5,
  T.bar6,
] as const;

function dVar(value: string): CSSProperties {
  return { ["--d"]: value } as CSSProperties;
}

function barGrowVars(growDelay: string, w: string): CSSProperties {
  return {
    ["--bar-d"]: growDelay,
    ["--w"]: w,
  } as CSSProperties;
}

export default function StatsModal({
  stats,
  onClose,
  globalStatsPuzzleNumber,
}: StatsModalProps) {
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalData, setGlobalData] = useState<GlobalStatsResponse | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    setGlobalLoading(true);
    setGlobalData(null);
    fetchGlobalStats(globalStatsPuzzleNumber)
      .then((d) => {
        if (!cancelled) setGlobalData(d);
      })
      .catch(() => {
        if (!cancelled) setGlobalData(null);
      })
      .finally(() => {
        if (!cancelled) setGlobalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [globalStatsPuzzleNumber]);

  const hasGlobalStats =
    globalData != null && globalData.totalPlayers > 0;

  const dist = useMemo(
    () => globalData?.guessDistribution ?? {},
    [globalData?.guessDistribution]
  );
  const maxGlobal = Math.max(
    1,
    ...[1, 2, 3, 4, 5, 6].map((n) => dist[n] ?? 0)
  );

  const winningGuessRow = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].reduce((best, n) => {
      const cb = dist[best] ?? 0;
      const cn = dist[n] ?? 0;
      return cn > cb ? n : best;
    }, 1);
  }, [dist]);

  const personalStats: { label: string; val: number | string }[] = [
    { label: "Played", val: stats.played },
    { label: "Won", val: stats.wins },
    { label: "Streak", val: stats.streak },
    { label: "Avg", val: formatAvgGuessesOnWins(stats) },
  ];

  const statDelays = [T.stat0, T.stat1, T.stat2, T.stat3] as const;

  return (
    <div
      className="stats-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        ...dVar(T.overlay),
        backgroundColor: "rgba(17, 17, 16, 0.92)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div className="relative w-full max-w-[340px]">
        <div
          className="stats-modal-ambient pointer-events-none absolute left-1/2 top-0 h-[200px] w-[min(120%,420px)] -translate-x-1/2 -translate-y-[35%] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--color-green-surface) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div
          className="stats-modal-card relative max-h-[90vh] w-full overflow-y-auto rounded-[20px] border p-7 font-dm-sans shadow-[0_24px_80px_rgba(0,0,0,0.6),0_2px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
          style={{
            ...dVar(T.card),
            background:
              "linear-gradient(170deg, #1E1D1B 0%, #181714 100%)",
            borderColor: BORDER_CARD,
            color: TEXT_PRIMARY,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="stats-modal-fade-in font-outfit" style={dVar(T.title)}>
            <h1
              className="text-[20px] font-bold uppercase tracking-[0.08em]"
              style={{ color: TEXT_PRIMARY }}
            >
              Statistics
            </h1>
          </header>

          <h2
            className="stats-modal-fade-in mt-6 font-outfit text-[13px] font-semibold uppercase tracking-[0.12em]"
            style={{ ...dVar(T.personalHdr), color: TEXT_PRIMARY }}
          >
            Personal
          </h2>

          <div
            className="mt-3 border-y"
            style={{ borderColor: BORDER_SUBTLE }}
          >
            <div className="grid grid-cols-4 gap-2 py-5">
              {personalStats.map((s, i) => (
                <div
                  key={s.label}
                  className="stats-modal-fade-in text-center"
                  style={dVar(statDelays[i])}
                >
                  <div
                    className="font-outfit text-[36px] font-bold tabular-nums leading-none tracking-tight"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    {s.val}
                  </div>
                  <div
                    className="mt-2 text-[11px] font-medium uppercase tracking-[0.1em]"
                    style={{ color: TEXT_MUTED }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h2
              className="stats-modal-fade-in font-outfit text-[13px] font-semibold uppercase tracking-[0.12em]"
              style={{ ...dVar(T.dayHdr), color: TEXT_PRIMARY }}
            >
              Day {globalStatsPuzzleNumber}
            </h2>
            {globalLoading ? (
              <p
                className="stats-modal-fade-in mt-3 text-sm font-dm-sans"
                style={{ ...dVar(T.community), color: TEXT_MUTED }}
              >
                Loading...
              </p>
            ) : hasGlobalStats ? (
              <>
                <div
                  className="stats-modal-fade-in mt-3 grid grid-cols-2 gap-3"
                  style={dVar(T.community)}
                >
                    <div
                      className="rounded-[12px] border px-3 py-3 text-center"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        borderColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <div
                        className="font-outfit text-[22px] font-bold tabular-nums leading-tight"
                        style={{ color: TEXT_PRIMARY }}
                      >
                        {globalData.totalPlayers}
                      </div>
                      <div
                        className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em]"
                        style={{ color: TEXT_MUTED }}
                      >
                        Players today
                      </div>
                    </div>
                    <div
                      className="rounded-[12px] border px-3 py-3 text-center"
                      style={{
                        background: "var(--color-green-surface)",
                        borderColor: "var(--color-green-border)",
                      }}
                    >
                      <div
                        className="font-outfit text-[22px] font-bold tabular-nums leading-tight"
                        style={{ color: "var(--color-green)" }}
                      >
                        {`${globalData.solveRate}%`}
                      </div>
                      <div
                        className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em]"
                        style={{ color: "var(--color-green-dim)" }}
                      >
                        Solve rate
                      </div>
                    </div>
                  </div>

                  <h3
                    className="stats-modal-fade-in mb-3 mt-6 font-dm-sans text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ ...dVar(T.distLabel), color: NESTED_LABEL_COLOR }}
                  >
                    Guess distribution
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => {
                      const count = dist[n] ?? 0;
                      const pct = Math.max(
                        0,
                        (count / maxGlobal) * 100
                      );
                      const isWinningRow = n === winningGuessRow;
                      const fadeD = barFadeDelays[n - 1];
                      const growD = `${0.75 + (n - 1) * 0.05 + 0.12}s`;
                      return (
                        <div
                          key={n}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="stats-modal-fade-in w-[14px] shrink-0 text-right text-sm tabular-nums"
                            style={{ ...dVar(fadeD), color: TEXT_MUTED }}
                          >
                            {n}
                          </span>
                          <div
                            className="stats-modal-fade-in relative h-[30px] min-w-0 flex-1 overflow-hidden rounded-md"
                            style={{
                              ...dVar(fadeD),
                              background: "rgba(255,255,255,0.03)",
                            }}
                          >
                            <div
                              className={
                                pct > 0
                                  ? isWinningRow
                                    ? "stats-modal-bar-fill absolute left-0 top-0 flex h-full min-w-0 items-center justify-end overflow-hidden rounded-md pr-2 font-dm-sans text-sm font-medium tabular-nums text-[#E8E4DF]"
                                    : "absolute left-0 top-0 flex h-full min-w-0 items-center justify-end overflow-hidden rounded-md pr-2 font-dm-sans text-sm font-medium tabular-nums text-[#E8E4DF]"
                                  : "absolute left-0 top-0 flex h-full min-w-0 items-center justify-end overflow-hidden rounded-md pr-2 font-dm-sans text-sm font-medium tabular-nums"
                              }
                              style={
                                pct === 0
                                  ? {
                                      width: "0%",
                                      background: "transparent",
                                      color: TEXT_PRIMARY,
                                    }
                                  : isWinningRow
                                    ? ({
                                        ...barGrowVars(growD, `${pct}%`),
                                        background: BAR_FILL_GRADIENT,
                                        boxShadow:
                                          "0 0 20px var(--color-green-glow)",
                                      } as CSSProperties)
                                    : {
                                        width: `${pct}%`,
                                        background: BAR_FILL_GRADIENT,
                                        color: TEXT_PRIMARY,
                                      }
                              }
                            >
                              {isWinningRow && pct > 0 ? (
                                <span className="relative z-10">{count}</span>
                              ) : (
                                <span>{count}</span>
                              )}
                            </div>
                            {!isWinningRow && pct === 0 && (
                              <span
                                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm tabular-nums"
                                style={{ color: TEXT_MUTED }}
                              >
                                {count}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p
                  className="stats-modal-fade-in mt-3 text-sm font-dm-sans"
                  style={{ ...dVar(T.community), color: TEXT_MUTED }}
                >
                  No Data Available
                </p>
              )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="stats-modal-close stats-modal-fade-in mt-7 w-full rounded-[10px] py-2.5 font-dm-sans text-sm font-medium"
            style={dVar(T.close)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

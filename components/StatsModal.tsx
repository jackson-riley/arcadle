"use client";

import { useEffect, useState } from "react";
import { getPuzzleNumber } from "@/lib/puzzle";
import type { PlayerStats } from "@/lib/types";
import {
  fetchGlobalStats,
  type GlobalStatsResponse,
} from "@/lib/globalStatsApi";

interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
  todayPuzzleNumber: number;
}

export default function StatsModal({
  stats,
  onClose,
  todayPuzzleNumber,
}: StatsModalProps) {
  const [todaysLoading, setTodaysLoading] = useState(true);
  const [todaysData, setTodaysData] = useState<GlobalStatsResponse | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    setTodaysLoading(true);
    setTodaysData(null);
    // Same calendar index as POST/Redis — parent `todayPuzzleNumber` can lag briefly after midnight.
    const n = getPuzzleNumber();
    if (
      process.env.NODE_ENV === "development" &&
      todayPuzzleNumber !== n
    ) {
      console.debug(
        "[StatsModal] todayPuzzleNumber prop vs getPuzzleNumber()",
        todayPuzzleNumber,
        n
      );
    }
    fetchGlobalStats(n)
      .then((d) => {
        if (!cancelled) setTodaysData(d);
      })
      .catch(() => {
        if (!cancelled) setTodaysData(null);
      })
      .finally(() => {
        if (!cancelled) setTodaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todayPuzzleNumber]);

  const dist = todaysData?.guessDistribution ?? {};
  const maxGlobal = Math.max(
    1,
    ...[1, 2, 3, 4, 5, 6].map((n) => dist[n] ?? 0)
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-zinc-100 text-lg font-semibold mb-4 tracking-wide">
          Statistics
        </h2>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Played", val: stats.played },
            {
              label: "Win %",
              val: stats.played
                ? Math.round((stats.wins / stats.played) * 100)
                : 0,
            },
            { label: "Streak", val: stats.streak },
            { label: "Best", val: stats.maxStreak },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-zinc-100">{s.val}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <h3 className="text-zinc-400 text-xs font-mono tracking-wider mb-2">
          GUESS DISTRIBUTION
        </h3>
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const count = stats.distribution[n] || 0;
            const max = Math.max(1, ...Object.values(stats.distribution));
            return (
              <div key={n} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-3 text-right">{n}</span>
                <div
                  className="h-5 bg-zinc-700 rounded-sm flex items-center justify-end px-1.5 transition-all"
                  style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                >
                  <span className="text-xs text-zinc-300">{count}</span>
                </div>
              </div>
            );
          })}
        </div>

        {(todaysLoading || todaysData) && (
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <h3 className="text-zinc-100 text-sm font-semibold mb-3 tracking-wide">
              Today&apos;s Puzzle
            </h3>
            {todaysLoading ? (
              <p className="text-zinc-500 text-sm">Loading...</p>
            ) : todaysData ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center rounded-lg bg-zinc-800/50 py-2.5 px-2">
                    <div className="text-xl font-bold text-zinc-100 tabular-nums">
                      {todaysData.totalPlayers}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Total players today
                    </div>
                  </div>
                  <div className="text-center rounded-lg bg-zinc-800/50 py-2.5 px-2">
                    <div className="text-xl font-bold text-zinc-100 tabular-nums">
                      {todaysData.totalPlayers > 0
                        ? `${todaysData.solveRate}%`
                        : "—"}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Solve rate
                    </div>
                  </div>
                </div>
                <h4 className="text-zinc-400 text-xs font-mono tracking-wider mb-2">
                  GUESS DISTRIBUTION
                </h4>
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => {
                    const count = dist[n] ?? 0;
                    return (
                      <div key={n} className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 w-3 text-right">
                          {n}
                        </span>
                        <div
                          className="h-5 bg-zinc-700 rounded-sm flex items-center justify-end px-1.5 transition-all"
                          style={{
                            width: `${Math.max(8, (count / maxGlobal) * 100)}%`,
                          }}
                        >
                          <span className="text-xs text-zinc-300">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

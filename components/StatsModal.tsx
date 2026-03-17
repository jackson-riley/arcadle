"use client";

import type { PlayerStats } from "@/lib/types";

interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
}

export default function StatsModal({ stats, onClose }: StatsModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-zinc-100 text-lg font-semibold mb-4 tracking-wide">
          Statistics
        </h2>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Played", val: stats.played },
            { label: "Win %", val: stats.played ? Math.round((stats.wins / stats.played) * 100) : 0 },
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

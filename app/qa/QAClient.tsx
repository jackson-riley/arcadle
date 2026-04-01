"use client";
// app/qa/QAClient.tsx

import { useState, useMemo } from "react";
import type { QACandidate } from "./page";

type Status = "pending" | "add" | "skip";

export default function QAClient({
  candidates,
  missingCount,
}: {
  candidates: QACandidate[];
  missingCount: number;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    Object.fromEntries(candidates.map((c) => [c.slug, "pending"]))
  );
  const [filter, setFilter] = useState<"all" | "pending" | "add" | "skip">("all");
  const [search, setSearch] = useState("");

  const set = (slug: string, status: Status) =>
    setStatuses((prev) => ({ ...prev, [slug]: status }));

  const counts = useMemo(() => {
    const add = Object.values(statuses).filter((s) => s === "add").length;
    const skip = Object.values(statuses).filter((s) => s === "skip").length;
    const pending = Object.values(statuses).filter((s) => s === "pending").length;
    return { add, skip, pending };
  }, [statuses]);

  const visible = useMemo(() =>
    candidates.filter((c) => {
      if (filter !== "all" && statuses[c.slug] !== filter) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [candidates, statuses, filter, search]
  );

  const exportApproved = () => {
    const approved = candidates.filter((c) => statuses[c.slug] === "add");
    const blob = new Blob([JSON.stringify(approved, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved-candidates.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGameEntries = () => {
    const approved = candidates.filter((c) => statuses[c.slug] === "add");
    const entries = approved.map((c) => `  {
    title: "${c.title}",
    developer: "${c.developer}",
    year: ${c.year ?? 0},
    genre: "${c.genre}",
    platforms: "${c.platforms}",
  },`).join("\n");
    const blob = new Blob([entries], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "game-entries.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-bold text-white">Screenshot QA</h1>
        <div className="flex gap-3 text-sm">
          <span className="text-zinc-400">{candidates.length} total</span>
          <span className="text-green-400">{counts.add} add</span>
          <span className="text-red-400">{counts.skip} skip</span>
          <span className="text-zinc-500">{counts.pending} pending</span>
          {missingCount > 0 && (
            <span className="text-yellow-500">{missingCount} missing screenshots</span>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportGameEntries}
            disabled={counts.add === 0}
            className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 rounded-lg transition-colors"
          >
            Export entries ({counts.add})
          </button>
          <button
            onClick={exportApproved}
            disabled={counts.add === 0}
            className="px-3 py-1.5 text-sm bg-zinc-100 text-zinc-900 font-semibold hover:bg-white disabled:opacity-30 rounded-lg transition-colors"
          >
            Export JSON ({counts.add})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 w-48"
        />
        {(["all", "pending", "add", "skip"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
              filter === f
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {visible.map((c) => {
          const status = statuses[c.slug];
          return (
            <div
              key={c.slug}
              className={`relative rounded-lg overflow-hidden border transition-all ${
                status === "add"
                  ? "border-green-500 ring-1 ring-green-500"
                  : status === "skip"
                  ? "border-red-800 opacity-40"
                  : "border-zinc-700"
              }`}
            >
              {/* Screenshot */}
              <div className="aspect-video bg-zinc-800 relative">
                <img
                  src={`/screenshots-staging/${c.slug}/original.jpg`}
                  alt={c.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="p-2 bg-zinc-900">
                <div className="text-xs font-semibold text-white leading-tight mb-0.5 line-clamp-2">
                  {c.title}
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight">
                  {c.year} · {c.developer}
                </div>
                <div className="text-[10px] text-zinc-600 leading-tight truncate">
                  {c.genre}
                </div>
                <div className="text-[10px] text-zinc-600">
                  ★ {c.rating_count.toLocaleString()} ratings
                </div>
                {c.series && (
                  <div className="text-[10px] text-zinc-600 italic truncate">{c.series}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex border-t border-zinc-800">
                <button
                  onClick={() => set(c.slug, status === "add" ? "pending" : "add")}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                    status === "add"
                      ? "bg-green-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-green-900 hover:text-green-300"
                  }`}
                >
                  Add
                </button>
                <button
                  onClick={() => set(c.slug, status === "skip" ? "pending" : "skip")}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                    status === "skip"
                      ? "bg-red-800 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-red-900 hover:text-red-300"
                  }`}
                >
                  Skip
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="text-center text-zinc-600 py-16">No candidates match this filter.</div>
      )}
    </div>
  );
}

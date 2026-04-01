"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { normalizeForTextMatch } from "@/lib/stringNormalize";

interface GuessInputProps {
  onGuess: (title: string) => void;
  disabled?: boolean;
}

export default function GuessInput({ onGuess, disabled }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeqRef = useRef(0);

  const shownSuggestions = useMemo(() => suggestions.slice(0, 8), [suggestions]);
  const selectedSuggestion = useMemo(
    () => (selectedIndex >= 0 ? shownSuggestions[selectedIndex] : null),
    [selectedIndex, shownSuggestions]
  );

  const exactMatch = useMemo(() => {
    const q = value.trim();
    if (!q) return null;
    const key = normalizeForTextMatch(q);
    return shownSuggestions.find((s) => normalizeForTextMatch(s) === key) ?? null;
  }, [value, shownSuggestions]);

  const canSubmit = Boolean(selectedSuggestion || exactMatch);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [shownSuggestions.length]);

  useEffect(() => {
    const q = value.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as string[];
        if (requestSeqRef.current === seq) {
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore (aborts + transient failures)
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  const submit = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      // Only allow submitting a title the user selected (or an exact match in the list).
      const key = normalizeForTextMatch(trimmed);
      const allowed =
        shownSuggestions.find((s) => normalizeForTextMatch(s) === key) ?? null;
      if (!allowed) return;

      onGuess(allowed);
      setValue("");
      setSuggestions([]);
    },
    [onGuess, shownSuggestions]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedSuggestion) submit(selectedSuggestion);
      else if (exactMatch) submit(exactMatch);
    } else if (e.key === "Escape") {
      setValue("");
    }
  };

  return (
    <div className="relative w-full min-w-0">
      <div className="flex min-w-0 items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            placeholder={disabled ? "Game over" : "Type a game title..."}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 px-3 py-2.5 rounded-lg text-[15px]
                       focus:outline-none focus:border-zinc-500 placeholder-zinc-600
                       disabled:opacity-40 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />
          {value.trim().length >= 2 &&
            (shownSuggestions.length > 0 || loading) && (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(10rem,32dvh)] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                {loading && (
                  <li className="px-4 py-2.5 text-sm text-zinc-500">
                    Searching…
                  </li>
                )}
                {shownSuggestions.map((s, i) => (
                  <li
                    key={s}
                    onClick={() => submit(s)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors text-sm ${
                      i === selectedIndex
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              if (selectedSuggestion) submit(selectedSuggestion);
              else if (exactMatch) submit(exactMatch);
            }}
            disabled={disabled || !canSubmit}
            className="px-4 py-2.5 bg-zinc-100 text-zinc-900 text-[15px] font-semibold rounded-lg
                       hover:bg-white disabled:opacity-20 transition-all"
          >
            Guess
          </button>
        </div>
      </div>
    </div>
  );
}

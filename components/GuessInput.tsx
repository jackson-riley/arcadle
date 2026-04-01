"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { GAME_TITLES } from "@/lib/games";
import { normalizeForTextMatch } from "@/lib/stringNormalize";

interface GuessInputProps {
  onGuess: (title: string) => void;
  disabled?: boolean;
}

export default function GuessInput({ onGuess, disabled }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const key = normalizeForTextMatch(q);
    setSuggestions(
      GAME_TITLES.filter((title) =>
        normalizeForTextMatch(title).includes(key)
      )
    );
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

      inputRef.current?.blur();
      window.setTimeout(() => {
        window.scrollTo(0, 0);
      }, 0);
      onGuess(allowed);
      setValue("");
      setSuggestions([]);
    },
    [onGuess, shownSuggestions]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) =>
        Math.min(i + 1, shownSuggestions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setValue("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !canSubmit) return;
    if (selectedSuggestion) submit(selectedSuggestion);
    else if (exactMatch) submit(exactMatch);
  };

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <form
        className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2"
        onSubmit={handleSubmit}
      >
        <div className="relative min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            placeholder={disabled ? "Game over" : "Type a game title..."}
            className="box-border w-full min-w-0 bg-zinc-900 border border-zinc-700 text-zinc-100 px-3 py-2.5 rounded-lg text-[15px]
                       focus:outline-none focus:border-zinc-500 placeholder-zinc-600
                       disabled:opacity-40 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />
          {value.trim().length >= 3 && shownSuggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(10rem,32dvh)] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
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
        <div className="flex min-w-0 shrink-0 items-center justify-self-end">
          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="px-4 py-2.5 bg-zinc-100 text-zinc-900 text-[15px] font-semibold rounded-lg
                       hover:bg-white disabled:opacity-20 transition-all"
          >
            Guess
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";

interface GuessInputProps {
  onGuess: (title: string) => void;
  gameTitles: string[];
  disabled?: boolean;
}

export default function GuessInput({ onGuess, gameTitles, disabled }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return gameTitles.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
  }, [value, gameTitles]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions.length]);

  const submit = useCallback(
    (title: string) => {
      if (!title.trim()) return;
      const match = gameTitles.find((t) => t.toLowerCase() === title.toLowerCase());
      if (match) {
        onGuess(match);
        setValue("");
      }
    },
    [onGuess, gameTitles]
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
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        submit(suggestions[selectedIndex]);
      } else if (suggestions.length === 1) {
        submit(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setValue("");
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? "Game over" : "Type a game title..."}
          className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-100 px-4 py-3 rounded-lg
                     focus:outline-none focus:border-zinc-500 placeholder-zinc-600
                     disabled:opacity-40 transition-colors"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() =>
            submit(selectedIndex >= 0 ? suggestions[selectedIndex] : value)
          }
          disabled={disabled || !value.trim()}
          className="px-5 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg
                     hover:bg-white disabled:opacity-20 transition-all"
        >
          Guess
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
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
  );
}

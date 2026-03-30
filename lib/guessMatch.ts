import type { GameEntry } from "./types";

/** Standalone Roman numeral words (longest first so "III" is not parsed as "I" + "II"). */
const ROMAN_WORD_PATTERN =
  /\b(?:VIII|VII|VI|V|IV|III|II|IX|X|I)\b/gi;

const ROMAN_WORD_TO_ARABIC: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
  VII: "7",
  VIII: "8",
  IX: "9",
  X: "10",
};

const ARABIC_DIGIT_TO_ROMAN: Record<string, string> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "7": "VII",
  "8": "VIII",
  "9": "IX",
};

const ARABIC_SINGLE_DIGIT_PATTERN = /\b[1-9]\b/g;

function normalizeRomanWordsToArabic(s: string): string {
  return s.replace(ROMAN_WORD_PATTERN, (m) => {
    const mapped = ROMAN_WORD_TO_ARABIC[m.toUpperCase()];
    return mapped ?? m;
  });
}

function normalizeArabicSingleDigitsToRoman(s: string): string {
  return s.replace(ARABIC_SINGLE_DIGIT_PATTERN, (d) => ARABIC_DIGIT_TO_ROMAN[d] ?? d);
}

function titlesMatch(guess: string, canonical: string): boolean {
  const g = guess.trim();
  const c = canonical.trim();
  if (g === c) return true;
  if (normalizeRomanWordsToArabic(g) === normalizeRomanWordsToArabic(c)) return true;
  if (
    normalizeArabicSingleDigitsToRoman(g) === normalizeArabicSingleDigitsToRoman(c)
  )
    return true;
  return false;
}

/** True if the guess equals the canonical title or any alias (trim; Roman/Arabic numeral variants). */
export function guessMatchesGame(game: GameEntry, guess: string): boolean {
  if (titlesMatch(guess, game.title)) return true;
  return (game.aliases ?? []).some((a) => titlesMatch(guess, a));
}

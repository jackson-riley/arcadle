import type { PlayerStats } from "./types";

/** Local calendar date YYYY-MM-DD */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localTodayString(): string {
  return formatLocalDate(new Date());
}

export function localYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/**
 * Current win streak is only valid if the last counted win was today or yesterday
 * (local calendar). Otherwise the player missed a day and the streak breaks.
 */
export function normalizeStreakStats(s: PlayerStats): PlayerStats {
  const today = localTodayString();
  const yesterday = localYesterdayString();

  if (!s.lastWinDate) {
    if (s.streak > 0) {
      return { ...s, streak: 0 };
    }
    return s;
  }

  if (s.lastWinDate === today || s.lastWinDate === yesterday) {
    return s;
  }

  return { ...s, streak: 0 };
}

/**
 * Next streak after a win on `todayLocal`, assuming `s` is already normalized.
 */
export function streakAfterWin(s: PlayerStats, todayLocal: string): number {
  if (s.lastWinDate === todayLocal) {
    return s.streak;
  }

  const [y, m, day] = todayLocal.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() - 1);
  const yesterday = formatLocalDate(d);

  if (s.lastWinDate === yesterday) {
    return s.streak + 1;
  }
  return 1;
}

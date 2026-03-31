const PLAYER_ID_KEY = "ludle-player-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable anonymous id for server-side deduplication (no accounts). */
export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id || id.length < 8) {
      id = randomId();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Strip combining marks for fuzzy compare (e.g. Pokémon ↔ pokemon). */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeForTextMatch(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

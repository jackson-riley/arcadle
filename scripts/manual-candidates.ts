/**
 * Hand-picked games to prepend to scripts/candidates.json when running
 * fetch-candidates. Each entry is merged into the full Candidate shape with
 * igdb_id: null (screenshots script resolves via IGDB search).
 */

export type ManualCandidateSeed = {
  title: string;
  developer: string;
  year: number;
  genre: string;
  platforms: string;
};

export const MANUAL_CANDIDATES: ManualCandidateSeed[] = [
  {
    title: "Unravel Two",
    developer: "Coldwood Interactive",
    year: 2018,
    genre: "Platformer / Co-op",
    platforms: "PC, PS4, Xbox One, Switch",
  },
  {
    title: "Pokémon Diamond and Pearl",
    developer: "Game Freak",
    year: 2006,
    genre: "RPG",
    platforms: "DS",
  },
  {
    title: "Kirby and the Forgotten Land",
    developer: "HAL Laboratory",
    year: 2022,
    genre: "Platformer / Action",
    platforms: "Switch",
  },
];

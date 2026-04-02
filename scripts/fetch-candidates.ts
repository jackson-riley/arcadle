/**
 * scripts/fetch-candidates.ts
 *
 * Queries IGDB for popular, well-received games not already in RAW_GAMES_DB,
 * prepends entries from manual-candidates.ts, applies quality filters, caps
 * series representation, and writes a reviewable candidate list to candidates.json.
 *
 * Usage:
 *   npx tsx scripts/fetch-candidates.ts
 *   npx tsx scripts/fetch-candidates.ts --min-ratings=300
 *   npx tsx scripts/fetch-candidates.ts --limit=500
 *
 * Output: scripts/candidates.json — review this, then manually add chosen games
 * to RAW_GAMES_DB in lib/games.ts (you'll need to write coreLoop for each).
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { RAW_GAMES_DB } from "../lib/games";
import { MANUAL_CANDIDATES, type ManualCandidateSeed } from "./manual-candidates";

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config();

const TWITCH_CLIENT_ID =
  process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID;
const TWITCH_CLIENT_SECRET =
  process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET;

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  console.error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in env.");
  process.exit(1);
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const argMinRatings = process.argv.find((a) => a.startsWith("--min-ratings="));
const argLimit = process.argv.find((a) => a.startsWith("--limit="));

const MIN_RATING_COUNT = argMinRatings ? parseInt(argMinRatings.split("=")[1]) : 200;
const TARGET_CANDIDATES = argLimit ? parseInt(argLimit.split("=")[1]) : 400;
const MAX_PER_SERIES = 3;       // max games from the same IGDB collection
const IGDB_PAGE_SIZE = 500;     // max IGDB allows per request

// ── Types ─────────────────────────────────────────────────────────────────────
type IgdbGame = {
  id: number;
  name: string;
  rating: number;
  rating_count: number;
  first_release_date?: number;
  category: number;
  collection?: { id: number; name: string };
  involved_companies?: { company: { name: string }; developer: boolean }[];
  genres?: { name: string }[];
  platforms?: { name: string }[];
  screenshots?: { id: number }[];
};

export type Candidate = {
  title: string;
  developer: string;
  year: number | null;
  genre: string;
  platforms: string;
  rating: number;
  rating_count: number;
  series: string | null;
  /** null = resolve via IGDB search when fetching staging screenshots */
  igdb_id: number | null;
};

function toManualCandidate(seed: ManualCandidateSeed): Candidate {
  return {
    title: seed.title,
    developer: seed.developer,
    year: seed.year,
    genre: seed.genre,
    platforms: seed.platforms,
    rating: 0,
    rating_count: 0,
    series: null,
    igdb_id: null,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getTwitchToken(): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID!,
      client_secret: TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function igdbQuery<T>(body: string, token: string): Promise<T[]> {
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB error: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function releaseYear(game: IgdbGame): number | null {
  if (!game.first_release_date) return null;
  return new Date(game.first_release_date * 1000).getFullYear();
}

function developerName(game: IgdbGame): string {
  if (!game.involved_companies?.length) return "Unknown";
  const dev = game.involved_companies.find((c) => c.developer);
  return dev?.company?.name ?? game.involved_companies[0]?.company?.name ?? "Unknown";
}

function genreLabel(game: IgdbGame): string {
  if (!game.genres?.length) return "Unknown";
  return game.genres.slice(0, 2).map((g) => g.name).join(" / ");
}

// Rough platform grouping — IGDB has very granular platform entries
const PLATFORM_MAP: Record<string, string> = {
  "PC (Microsoft Windows)": "PC",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  "PlayStation 3": "PS3",
  "PlayStation 2": "PS2",
  "Xbox One": "Xbox One",
  "Xbox Series X|S": "Xbox Series",
  "Xbox 360": "Xbox 360",
  "Nintendo Switch": "Switch",
  "Nintendo 3DS": "3DS",
  "Wii U": "Wii U",
  "Wii": "Wii",
  "iOS": "Mobile",
  "Android": "Mobile",
  "Mac": "Mac",
  "Linux": "PC",
};

function platformLabel(game: IgdbGame): string {
  if (!game.platforms?.length) return "Unknown";
  const labels = game.platforms
    .map((p) => PLATFORM_MAP[p.name] ?? p.name)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .slice(0, 5);
  return labels.join(", ");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const token = await getTwitchToken();

  // Build exclusion set from existing DB titles (normalized)
  const existingTitles = new Set(
    RAW_GAMES_DB.map((g) => normalizeTitle(g.title))
  );

  console.log(`Existing DB size: ${RAW_GAMES_DB.length} games`);
  console.log(`Min rating_count: ${MIN_RATING_COUNT}`);
  console.log(`Target candidates: ${TARGET_CANDIDATES}`);
  console.log("Fetching from IGDB...\n");

  const query = `fields name, rating, rating_count, first_release_date, collection.id, collection.name, involved_companies.company.name, involved_companies.developer, genres.name, platforms.name, screenshots; where rating_count > ${MIN_RATING_COUNT}; sort rating_count desc; limit ${IGDB_PAGE_SIZE};`;
  const allGames = await igdbQuery<IgdbGame>(query, token);
  console.log("Sample game:", JSON.stringify(allGames[0], null, 2));
  console.log("Existing titles count:", existingTitles.size);
  console.log("First existing title:", Array.from(existingTitles)[0]);
  console.log(`Raw results: ${allGames.length}`);

  // ── Filter & dedupe ────────────────────────────────────────────────────────
  const seriesCounts = new Map<number, number>();
  const candidates: Candidate[] = [];
  const seenTitles = new Set<string>();

  for (const seed of MANUAL_CANDIDATES) {
    const norm = normalizeTitle(seed.title);
    if (existingTitles.has(norm)) continue;
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    candidates.push(toManualCandidate(seed));
  }

  for (const game of allGames) {
  //  if (!game.screenshots?.length) continue;
    if (!game.name) continue;
   
    // Skip DLC/expansions — category 0 = main game, null/undefined = also fine
    if (game.category !== undefined && game.category !== 0) continue;
    
    const normName = normalizeTitle(game.name);

    // Skip if already in our DB
    if (existingTitles.has(normName)) continue;

    // Skip dupes within this run
    if (seenTitles.has(normName)) continue;

    // Series cap
    if (game.collection?.id) {
      const count = seriesCounts.get(game.collection.id) ?? 0;
      if (count >= MAX_PER_SERIES) continue;
      seriesCounts.set(game.collection.id, count + 1);
    }

    seenTitles.add(normName);

    candidates.push({
      title: game.name,
      developer: developerName(game),
      year: releaseYear(game),
      genre: genreLabel(game),
      platforms: platformLabel(game),
      rating: Math.round(game.rating ?? 0),
      rating_count: game.rating_count,
      series: game.collection?.name ?? null,
      igdb_id: game.id,
    });

    if (candidates.length >= TARGET_CANDIDATES) break;
  }

  console.log(`Candidates after filtering: ${candidates.length}`);

  // ── Write output ───────────────────────────────────────────────────────────
  const outputPath = path.join(__dirname, "candidates.json");
  fs.writeFileSync(outputPath, JSON.stringify(candidates, null, 2));
  console.log(`\nWrote ${outputPath}`);
  console.log("\nNext steps:");
  console.log("  1. Review candidates.json — each entry has title, developer, year, genre, platforms");
  console.log("  2. Add chosen games to RAW_GAMES_DB in lib/games.ts (write a coreLoop for each)");
  console.log("  3. Run: npm run fetch-screenshots");
  console.log("  4. Run: npm run generate-blurs");
  console.log("  5. QA screenshots and exclude any bad ones via ADDITIONAL_EXCLUDED_TITLES\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

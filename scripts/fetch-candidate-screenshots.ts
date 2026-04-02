/**
 * scripts/fetch-candidate-screenshots.ts
 *
 * Downloads screenshots for games in scripts/candidates.json into
 * public/screenshots-staging/<slug>/original.jpg.
 *
 * Uses igdb_id when set; otherwise resolves the game via IGDB search (manual candidates).
 *
 * Usage:
 *   npx tsx scripts/fetch-candidate-screenshots.ts
 *   npx tsx scripts/fetch-candidate-screenshots.ts --force
 *   npx tsx scripts/fetch-candidate-screenshots.ts --only-slug=grand-theft-auto-v
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

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

const FORCE = process.argv.includes("--force");
const ONLY_SLUG_ARG = process.argv.find((a) => a.startsWith("--only-slug="));
const ONLY_SLUG = ONLY_SLUG_ARG ? ONLY_SLUG_ARG.split("=")[1] : null;

type Candidate = {
  title: string;
  developer: string;
  year: number | null;
  genre: string;
  platforms: string;
  rating: number;
  rating_count: number;
  series: string | null;
  igdb_id: number | null;
};

function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type IgdbGameSearchResult = {
  id: number;
  name?: string;
  screenshots?: number[];
  first_release_date?: number;
};

async function searchGameByTitle(
  title: string,
  year: number,
  token: string
): Promise<IgdbGameSearchResult | null> {
  const games = await igdbQuery<IgdbGameSearchResult>(
    "games",
    `search "${title.replace(/"/g, '\\"')}"; fields name, screenshots, first_release_date; limit 10;`,
    token
  );

  if (!games.length) return null;

  const hasScreenshots = (g: IgdbGameSearchResult): boolean =>
    Array.isArray(g.screenshots) && g.screenshots.length > 0;
  const queryTitleNorm = normalizeTitle(title);
  const isNameMatch = (g: IgdbGameSearchResult): boolean =>
    normalizeTitle(g.name ?? "") === queryTitleNorm;
  const releaseYear = (g: IgdbGameSearchResult): number | null => {
    if (typeof g.first_release_date !== "number") return null;
    return new Date(g.first_release_date * 1000).getFullYear();
  };

  const nameAndYearAndScreenshots = games.find((g) => {
    if (!hasScreenshots(g) || !isNameMatch(g)) return false;
    const y = releaseYear(g);
    return y !== null && Math.abs(y - year) <= 1;
  });
  if (nameAndYearAndScreenshots) return nameAndYearAndScreenshots;

  const nameAndScreenshots = games.find(
    (g) => hasScreenshots(g) && isNameMatch(g)
  );
  if (nameAndScreenshots) return nameAndScreenshots;

  return games.find(hasScreenshots) ?? null;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

async function igdbQuery<T>(endpoint: string, body: string, token: string): Promise<T[]> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB error: ${res.status}`);
  return (await res.json()) as T[];
}

async function main() {
  const candidatesPath = path.join(__dirname, "candidates.json");
  if (!fs.existsSync(candidatesPath)) {
    console.error("candidates.json not found. Run fetch-candidates first.");
    process.exit(1);
  }

  const candidates: Candidate[] = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));
  const stagingRoot = path.join(rootDir, "public", "screenshots-staging");
  const token = await getTwitchToken();

  console.log(`Processing ${candidates.length} candidates...`);

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const slug = slugify(candidate.title);
    if (ONLY_SLUG && slug !== ONLY_SLUG) continue;

    const gameDir = path.join(stagingRoot, slug);
    const originalPath = path.join(gameDir, "original.jpg");

    if (fs.existsSync(originalPath) && !FORCE) {
      skipped++;
      continue;
    }

    try {
      let gameId = candidate.igdb_id;
      if (gameId == null) {
        const found = await searchGameByTitle(
          candidate.title,
          candidate.year ?? 2000,
          token
        );
        if (!found) {
          console.warn(`  IGDB search miss: "${candidate.title}"`);
          failed++;
          continue;
        }
        gameId = found.id;
      }

      const shots = await igdbQuery<{ image_id: string; width?: number; height?: number }>(
        "screenshots",
        `fields image_id, width, height; where game = ${gameId}; limit 20;`,
        token
      );

      if (!shots.length) {
        console.warn(`  No screenshots: "${candidate.title}"`);
        failed++;
        continue;
      }

      // Pick highest resolution
      let best = shots[0];
      let bestArea = -1;
      for (const s of shots) {
        const area = (s.width ?? 0) * (s.height ?? 0);
        if (area > bestArea) { bestArea = area; best = s; }
      }

      const url = `https://images.igdb.com/igdb/image/upload/t_1080p/${best.image_id}.jpg`;
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        console.warn(`  Download failed: "${candidate.title}"`);
        failed++;
        continue;
      }

      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(originalPath, Buffer.from(await imgRes.arrayBuffer()));
      console.log(`  ✓ ${candidate.title}`);
      saved++;
    } catch (err) {
      console.error(`  Error: "${candidate.title}":`, err);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone. Saved: ${saved}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`\nNext: run 'npm run generate-blurs-staging' or open /qa to review`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

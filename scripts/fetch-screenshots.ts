import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getNonExcludedCatalogEntries } from "../lib/games";
import { slugify } from "../lib/slug";

// Load env from .env.local (Next.js-style) or fallback to .env
const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config(); // also load .env if present

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

function diceCoefficient(aTokens: string[], bTokens: string[]): number {
  const b = new Set(bTokens);
  const aUnique = new Set(aTokens);
  let intersection = 0;

  // Avoid iterating over Set directly (TS target/es5 build compatibility).
  const seen = new Set<string>();
  for (const t of aTokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (b.has(t)) intersection += 1;
  }

  const denom = aUnique.size + b.size;
  if (denom === 0) return 0;
  return (2 * intersection) / denom;
}

type IgdbGameSearchResult = {
  id: number;
  name?: string;
  screenshots?: number[];
  first_release_date?: number;
};

async function searchGame(
  title: string,
  developer: string,
  year: number,
  token: string
): Promise<IgdbGameSearchResult | null> {
  const games = await igdbQuery<IgdbGameSearchResult>(
    "games",
    `search "${title}"; fields name, screenshots, first_release_date; limit 10;`,
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

  if (!res.ok) {
    throw new Error(`Failed to get Twitch token: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function igdbQuery<T>(endpoint: string, query: string, token: string): Promise<T[]> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`IGDB ${endpoint} error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T[];
}

async function main() {
  const token = await getTwitchToken();
  const screenshotsRoot = path.join(rootDir, "public", "screenshots");

  console.log(`Using screenshots directory: ${screenshotsRoot}`);

  const catalog = getNonExcludedCatalogEntries();
  for (const game of catalog) {
    const slug = slugify(game.title);
    if (ONLY_SLUG && slug !== ONLY_SLUG) continue;
    const gameDir = path.join(screenshotsRoot, slug);
    const originalPath = path.join(gameDir, "original.jpg");

    if (fs.existsSync(originalPath) && !FORCE) {
      console.log(`Skipping ${game.title} (already has original.jpg). Use --force to overwrite.`);
      continue;
    }

    console.log(`Fetching screenshot for ${game.title}...`);

    try {
      // 1. Find game in IGDB by title and prefer release-year-consistent matches.
      const picked = await searchGame(
        game.title,
        game.developer,
        game.year,
        token
      );
      if (!picked) {
        console.warn(`No IGDB match for "${game.title}"`);
        continue;
      }

      const igdbId = picked.id;

      // 2. Get screenshots for that game (pick the biggest one)
      const shots = await igdbQuery<{ image_id: string; width?: number; height?: number }>(
        "screenshots",
        `fields image_id, width, height; where game = ${igdbId}; limit 20;`,
        token
      );

      if (!shots.length) {
        console.warn(`No screenshots for "${game.title}" (IGDB id ${igdbId})`);
        continue;
      }

      let bestShot = shots[0];
      let bestArea = -1;
      for (const s of shots) {
        const w = typeof s.width === "number" ? s.width : 0;
        const h = typeof s.height === "number" ? s.height : 0;
        const area = w * h;
        if (area > bestArea) {
          bestArea = area;
          bestShot = s;
        }
      }

      const imageId = bestShot.image_id;
      const imageUrl = `https://images.igdb.com/igdb/image/upload/t_1080p/${imageId}.jpg`;

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        console.warn(`Failed to download image for "${game.title}": ${imgRes.statusText}`);
        continue;
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());

      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(originalPath, buffer);
      console.log(`Saved ${originalPath}`);
    } catch (err) {
      console.error(`Error processing "${game.title}":`, err);
    }

    // Be polite to IGDB
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Done fetching screenshots.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


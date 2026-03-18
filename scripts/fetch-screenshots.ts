import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { GAMES_DB } from "../lib/games";
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

  for (const game of GAMES_DB) {
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
      // 1. Find game in IGDB by name (then pick the best match)
      const games = await igdbQuery<{ id: number; name?: string; rating_count?: number }>(
        "games",
        `search "${game.title}"; fields id, name, rating_count; limit 20;`,
        token
      );

      if (!games.length) {
        console.warn(`No IGDB match for "${game.title}"`);
        continue;
      }

      const qNorm = normalizeTitle(game.title);
      const qTokens = qNorm.split(" ").filter(Boolean);

      const exactMatches = games.filter((g) => normalizeTitle(g.name ?? "") === qNorm);
      const chooseBest = (cands: Array<{ id: number; rating_count?: number }>) => {
        let best = cands[0];
        for (const cand of cands) {
          if ((cand.rating_count ?? 0) > (best.rating_count ?? 0)) best = cand;
        }
        return best;
      };

      let picked = exactMatches.length ? chooseBest(exactMatches) : null;

      if (!picked) {
        // Otherwise, fall back to token similarity (helps with punctuation/aliases).
        let best = games[0];
        let bestScore = -1;
        for (const cand of games) {
          const candTokens = normalizeTitle(cand.name ?? "").split(" ").filter(Boolean);
          const score = diceCoefficient(qTokens, candTokens);
          if (score > bestScore) {
            bestScore = score;
            best = cand;
          }
        }
        picked = best;
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


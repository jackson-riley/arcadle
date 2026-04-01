/**
 * scripts/fetch-candidate-screenshots.ts
 *
 * Downloads screenshots for games in scripts/candidates.json into
 * public/screenshots-staging/<slug>/original.jpg.
 *
 * Uses igdb_id directly — no search step needed.
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
  igdb_id: number;
};

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
      const shots = await igdbQuery<{ image_id: string; width?: number; height?: number }>(
        "screenshots",
        `fields image_id, width, height; where game = ${candidate.igdb_id}; limit 20;`,
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

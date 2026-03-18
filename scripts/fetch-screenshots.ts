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

async function getTwitchToken(): Promise<string> {
  const res = await fetch(
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    }
  );

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
    const gameDir = path.join(screenshotsRoot, slug);
    const originalPath = path.join(gameDir, "original.jpg");

    if (fs.existsSync(originalPath)) {
      console.log(`Skipping ${game.title} (already has original.jpg)`);
      continue;
    }

    console.log(`Fetching screenshot for ${game.title}...`);

    try {
      // 1. Find game in IGDB by name
      const games = await igdbQuery<{ id: number }>(
        "games",
        `search "${game.title}"; fields id; limit 1;`,
        token
      );

      if (!games.length) {
        console.warn(`No IGDB match for "${game.title}"`);
        continue;
      }

      const igdbId = games[0].id;

      // 2. Get screenshots for that game
      const shots = await igdbQuery<{ image_id: string }>(
        "screenshots",
        `fields image_id; where game = ${igdbId}; limit 1;`,
        token
      );

      if (!shots.length) {
        console.warn(`No screenshots for "${game.title}" (IGDB id ${igdbId})`);
        continue;
      }

      const imageId = shots[0].image_id;
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


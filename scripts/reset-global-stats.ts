/**
 * Clears community stats for one puzzle in Upstash/Vercel KV (same env as /api/stats).
 *
 * Deletes:
 *   - stats:<n>     (aggregates: total, solved, g1..g6)
 *   - submitted:n:* (per-player dedupe keys so clients can POST again)
 *
 * Usage (production: point env at prod KV):
 *   npx tsx scripts/reset-global-stats.ts 15
 */

import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
import path from "path";

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config();

function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function collectSubmittedKeys(
  redis: Redis,
  puzzleNumber: number
): Promise<string[]> {
  const pattern = `submitted:${puzzleNumber}:*`;
  const out: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, {
      match: pattern,
      count: 500,
    });
    out.push(...batch);
    cursor = next;
  } while (cursor !== "0");
  return out;
}

async function main() {
  const n = Number(process.argv[2]);
  if (!Number.isFinite(n) || n < 1 || n !== Math.floor(n)) {
    console.error("Usage: npx tsx scripts/reset-global-stats.ts <puzzleNumber>");
    process.exit(1);
  }

  const redis = getRedis();
  if (!redis) {
    console.error(
      "Missing UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_*)."
    );
    process.exit(1);
  }

  const statsKey = `stats:${n}`;
  const submitted = await collectSubmittedKeys(redis, n);
  console.log(`Deleting ${statsKey} and ${submitted.length} submitted:${n}:* keys…`);

  const chunk = 100;
  for (let i = 0; i < submitted.length; i += chunk) {
    const part = submitted.slice(i, i + chunk);
    if (part.length) await redis.del(...part);
  }
  await redis.del(statsKey);

  console.log("Done. Deploy client with puzzle in GLOBAL_STATS_RESET_PUZZLE_NUMBERS so browsers resubmit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

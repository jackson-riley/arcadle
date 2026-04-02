import dotenv from "dotenv";
import { Redis } from "@upstash/redis";

dotenv.config({ path: ".env.local" });

const puzzleNumberArg = process.argv[2];
const puzzleNumber = puzzleNumberArg ? Number(puzzleNumberArg) : 14;

if (!Number.isFinite(puzzleNumber) || puzzleNumber < 1) {
  console.error("Usage: node scripts/reset-global-stats-for-puzzle.mjs [puzzleNumber]");
  process.exit(1);
}

const url =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error("Missing redis credentials. Set UPSTASH_REDIS_REST_* or KV_REST_* in env.");
  process.exit(1);
}

const redis = new Redis({ url, token });

function statsKey(pn) {
  return `stats:${pn}`;
}

function submittedPrefix(pn) {
  return `submitted:${pn}:`;
}

async function scanAndDel(matchPattern, label) {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: matchPattern,
      count: 200,
    });
    cursor = String(nextCursor);
    if (keys.length) {
      deleted += keys.length;
      // Bulk delete in batches to avoid very large single calls.
      const chunkSize = 200;
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        await redis.del(...chunk);
      }
    }
  } while (cursor !== "0");

  console.log(`Deleted ${deleted} keys for ${label}`);
  return deleted;
}

const main = async () => {
  const st = await redis.del(statsKey(puzzleNumber));
  console.log(`Deleted stats hash '${statsKey(puzzleNumber)}': ${st}`);

  await scanAndDel(`${submittedPrefix(puzzleNumber)}*`, "submitted keys");
  console.log("Done.");
};

await main();


import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const STATS_KEY = (puzzleNumber: number) => `stats:${puzzleNumber}`;
const SUBMITTED_KEY = (puzzleNumber: number, playerId: string) =>
  `submitted:${puzzleNumber}:${playerId}`;

/**
 * `UPSTASH_REDIS_REST_*` or Vercel-style `KV_REST_*` (same fallbacks as
 * `Redis.fromEnv()` in @upstash/redis).
 */
function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const PLAYER_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

function parsePuzzleNumber(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n !== Math.floor(n)) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const redis = getRedis();
  const puzzleNumber = parsePuzzleNumber(
    req.nextUrl.searchParams.get("puzzleNumber")
  );
  if (puzzleNumber == null) {
    return NextResponse.json({ error: "Invalid puzzleNumber" }, { status: 400 });
  }

  const empty = {
    totalPlayers: 0,
    solveRate: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };

  // 200 + zeros when KV is not configured so the client and local dev behave
  // like “no data yet” instead of a failed fetch.
  if (!redis) {
    return NextResponse.json(empty);
  }

  try {
    const raw = await redis.hgetall(STATS_KEY(puzzleNumber));
    const total = Number(raw?.total ?? 0) || 0;
    const solved = Number(raw?.solved ?? 0) || 0;
    const solveRate = total > 0 ? Math.round((solved / total) * 1000) / 10 : 0;
    const guessDistribution = {
      1: Number(raw?.g1 ?? 0) || 0,
      2: Number(raw?.g2 ?? 0) || 0,
      3: Number(raw?.g3 ?? 0) || 0,
      4: Number(raw?.g4 ?? 0) || 0,
      5: Number(raw?.g5 ?? 0) || 0,
      6: Number(raw?.g6 ?? 0) || 0,
    };
    return NextResponse.json({
      totalPlayers: total,
      solveRate,
      guessDistribution,
    });
  } catch (e) {
    console.error("GET /api/stats", e);
    return NextResponse.json(empty);
  }
}

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "KV not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { puzzleNumber, guesses, solved, playerId } = body as Record<
    string,
    unknown
  >;

  const pn =
    typeof puzzleNumber === "number"
      ? puzzleNumber
      : typeof puzzleNumber === "string"
        ? Number(puzzleNumber)
        : NaN;
  if (!Number.isFinite(pn) || pn < 1 || pn !== Math.floor(pn)) {
    return NextResponse.json({ error: "Invalid puzzleNumber" }, { status: 400 });
  }

  if (typeof solved !== "boolean") {
    return NextResponse.json({ error: "Invalid solved" }, { status: 400 });
  }

  const g =
    typeof guesses === "number"
      ? guesses
      : typeof guesses === "string"
        ? Number(guesses)
        : NaN;
  if (!Number.isFinite(g) || g < 0 || g > 6 || g !== Math.floor(g)) {
    return NextResponse.json({ error: "Invalid guesses" }, { status: 400 });
  }

  if (solved && (g < 1 || g > 6)) {
    return NextResponse.json(
      { error: "Invalid guesses for solved game" },
      { status: 400 }
    );
  }

  if (typeof playerId !== "string" || !PLAYER_ID_RE.test(playerId)) {
    return NextResponse.json({ error: "Invalid playerId" }, { status: 400 });
  }

  const statsKey = STATS_KEY(pn);
  const dedupeKey = SUBMITTED_KEY(pn, playerId);

  try {
    const firstTime = await redis.set(dedupeKey, "1", {
      nx: true,
      ex: 60 * 60 * 24 * 400,
    });

    if (firstTime === null) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    try {
      await redis.hincrby(statsKey, "total", 1);
      if (solved) {
        await redis.hincrby(statsKey, "solved", 1);
        await redis.hincrby(statsKey, `g${g}`, 1);
      }
    } catch (incrErr) {
      await redis.del(dedupeKey).catch(() => {});
      throw incrErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/stats", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}

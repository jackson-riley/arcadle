import { NextRequest, NextResponse } from "next/server";
import { GAME_TITLES } from "@/lib/games";

let cachedToken: { token: string; expiresAtMs: number } | null = null;

function getClientId() {
  return process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID;
}

function getClientSecret() {
  return process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET;
}

async function getTwitchToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) return cachedToken.token;

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) throw new Error("Missing IGDB/Twitch credentials");

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    // avoid cached edge responses
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAtMs: now + data.expires_in * 1000,
  };
  return data.access_token;
}

function escapeIgdbSearch(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json<string[]>([]);

  try {
    const lowerQ = q.toLowerCase();

    const localMatches = GAME_TITLES.filter((title) =>
      title.toLowerCase().includes(lowerQ)
    );

    const token = await getTwitchToken();
    const clientId = getClientId();
    if (!clientId) throw new Error("Missing client id");

    const baseHeaders = {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    } as const;

    const needle = escapeIgdbSearch(q);

    const query =
      `search "${needle}"; ` +
      `fields name, rating_count, category; ` +
      `limit 50;`;

    const run = async (body: string) => {
      const res = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: baseHeaders,
        body,
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("IGDB /games failed", res.status, text);
        return [] as Array<{ name?: string }>;
      }
      return (await res.json()) as Array<{ name?: string }>;
    };

    const games = await run(query);
    if (process.env.NODE_ENV !== "production") {
      console.log("IGDB games raw count", games.length, "for query", q);
    }

    const filteredIgdb = games
      .filter((g: any) => g && typeof g.name === "string")
      // Prefer main games with a decent number of ratings when possible
      .filter((g: any) => g.category === 0 && (g.rating_count ?? 0) > 15);

    const rankedIgdb = (filteredIgdb.length > 0 ? filteredIgdb : games).sort(
      (a: any, b: any) => (b.rating_count ?? 0) - (a.rating_count ?? 0)
    );

    const igdbNames = rankedIgdb
      .map((g: any) => g.name as string)
      .filter((n): n is string => Boolean(n && n.trim()))
      .slice(0, 5);

    const merged: string[] = [];
    const seen = new Set<string>();

    const addName = (name: string) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(name);
    };

    for (const name of localMatches.slice(0, 4)) addName(name);
    for (const name of igdbNames) addName(name);

    return NextResponse.json(merged.slice(0, 8));
  } catch (err) {
    console.error("Search route error", err);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: (err as Error)?.message ?? "Unknown error" },
        { status: 500 }
      );
    }
    return NextResponse.json<string[]>([]);
  }
}


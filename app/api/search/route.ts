import { NextRequest, NextResponse } from "next/server";
import { GAME_TITLES } from "@/lib/games";

let cachedToken: { token: string; expiresAtMs: number } | null = null;
let inFlightTokenRequest: Promise<string> | null = null;
const igdbResultsCache = new Map<
  string,
  { results: string[]; expiresAtMs: number }
>();

function getIgdbCacheKey(q: string) {
  return q.toLowerCase();
}

function getClientId() {
  return process.env.IGDB_CLIENT_ID || process.env.TWITCH_CLIENT_ID;
}

function getClientSecret() {
  return process.env.IGDB_CLIENT_SECRET || process.env.TWITCH_CLIENT_SECRET;
}

async function getTwitchToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken) {
    const graceMs = 60_000;
    // If the token is still valid, reuse it—even if it's close to expiry—
    // to avoid a refresh failure disabling autocomplete.
    if (cachedToken.expiresAtMs > now - graceMs) return cachedToken.token;
    // If it's expired, we'll attempt a refresh below.
  }

  // Avoid hammering Twitch/IGDB with concurrent token requests while typing.
  if (inFlightTokenRequest) return inFlightTokenRequest;

  inFlightTokenRequest = (async () => {
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
  })();

  try {
    return await inFlightTokenRequest;
  } catch (err) {
    // If the refresh fails but we still had an (almost) valid token cached,
    // fall back to it instead of disabling autocomplete entirely.
    const graceMs = 60_000;
    if (cachedToken && cachedToken.expiresAtMs > Date.now() - graceMs) {
      return cachedToken.token;
    }
    throw err;
  } finally {
    inFlightTokenRequest = null;
  }
}

function escapeIgdbSearch(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json<string[]>([]);

  const lowerQ = q.toLowerCase();
  const localMatches = GAME_TITLES.filter((title) =>
    title.toLowerCase().includes(lowerQ)
  );

  try {
    const cacheKey = getIgdbCacheKey(lowerQ);
    const cacheTtlMs = 5 * 60_000; // 5 minutes

    let token: string | null = null;
    try {
      token = await getTwitchToken();
    } catch (tokenErr) {
      // If Twitch/IGDB is temporarily unreachable, keep autocomplete working
      // with the local curated database instead of returning 500s.
      console.error("IGDB token fetch failed", tokenErr);
    }

    if (!token) {
      const cachedIgdb = igdbResultsCache.get(cacheKey);
      const igdbNames = cachedIgdb && cachedIgdb.expiresAtMs > Date.now() ? cachedIgdb.results : [];

      // Merge local matches + cached IGDB (local first, deduped, capped at 8).
      const merged: string[] = [];
      const seen = new Set<string>();
      const addName = (name: string) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(name);
      };
      for (const name of localMatches.slice(0, 4)) addName(name);
      for (const name of igdbNames.slice(0, 4)) addName(name);
      return NextResponse.json(merged);
    }

    const clientId = getClientId();
    if (!clientId) throw new Error("Missing client id");

    const buildHeaders = (accessToken: string) =>
      ({
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
      }) as const;

    const needle = escapeIgdbSearch(q);

    const query =
      `search "${needle}"; ` +
      `fields name, rating_count, category; ` +
      `limit 50;`;

    const run = async (body: string) => {
      const fetchOnce = async (accessToken: string) => {
        try {
          return await fetch("https://api.igdb.com/v4/games", {
            method: "POST",
            headers: buildHeaders(accessToken),
            body,
            cache: "no-store",
          });
        } catch (err) {
          console.error("IGDB fetch failed", err);
          return null;
        }
      };

      // First attempt with the token we have.
      let res = await fetchOnce(token);
      if (!res) return [] as Array<{ name?: string }>;

      // If the token was rejected, refresh once and retry.
      if (res.status === 401) {
        cachedToken = null;
        try {
          const refreshed = await getTwitchToken();
          res = await fetchOnce(refreshed);
        } catch {
          // ignore and fall through to error handling below
        }
      }

      if (!res) return [] as Array<{ name?: string }>;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("IGDB /games failed", res.status, text);
        return [] as Array<{ name?: string }>;
      }

      return (await res.json()) as Array<{ name?: string }>;
    };

    const games = await run(query);

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

    // Cache IGDB portion for short periods to keep autocomplete stable
    // even if Twitch/IGDB refreshes fail during subsequent keystrokes.
    igdbResultsCache.set(cacheKey, {
      results: igdbNames,
      expiresAtMs: Date.now() + cacheTtlMs,
    });

    return NextResponse.json(merged.slice(0, 8));
  } catch (err) {
    console.error("Search route error", err);
    // Never hard-fail autocomplete if IGDB is down/unreachable.
    return NextResponse.json(localMatches.slice(0, 8));
  }
}


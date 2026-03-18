import { NextRequest, NextResponse } from "next/server";

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
    const token = await getTwitchToken();
    const clientId = getClientId();
    if (!clientId) throw new Error("Missing client id");

    // Note: filtering by `category = 0` looks like it returns empty results for some titles
    // (category field can be missing/undefined in search results). We'll fetch broadly and
    // keep it to a small limit, then dedupe/sort.
    const body = `search "${escapeIgdbSearch(q)}"; fields name; limit 10;`;
    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("IGDB /games failed", res.status, text);
      return NextResponse.json<string[]>([]);
    }

    const games = (await res.json()) as Array<{ name?: string }>;
    const names = games
      .map((g) => g.name)
      .filter((n): n is string => Boolean(n && n.trim()));

    const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    return NextResponse.json(uniqueSorted);
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


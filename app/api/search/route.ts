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

    const baseHeaders = {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    } as const;

    // IGDB doesn't allow `sort` together with `search`.
    // We'll use `search` for relevancy, then filter/sort client-side by rating_count.
    const needle = escapeIgdbSearch(q);

    const query = `search "${needle}"; fields name, rating_count, category; limit 50;`;

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

    const filtered = games
      .filter((g: any) => g && typeof g.name === "string")
      // `category` is often missing in search results, so we can't reliably filter DLC here.
      // Use rating_count as a proxy for "well-known".
      .filter(
        (g: any) => (typeof g.rating_count === "number" ? g.rating_count : 0) > 5
      );

    filtered.sort(
      (a: any, b: any) =>
        (b.rating_count ?? 0) - (a.rating_count ?? 0)
    );

    const names = filtered
      .map((g: any) => g.name as string)
      .filter((n): n is string => Boolean(n && n.trim()))
      .slice(0, 8);

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


export type GlobalStatsResponse = {
  totalPlayers: number;
  solveRate: number;
  guessDistribution: Record<number, number>;
};

export async function fetchGlobalStats(
  puzzleNumber: number
): Promise<GlobalStatsResponse> {
  const n = Math.floor(Number(puzzleNumber));
  const res = await fetch(
    `/api/stats?puzzleNumber=${encodeURIComponent(String(n))}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json() as Promise<GlobalStatsResponse>;
}

export async function postPuzzleResult(body: {
  puzzleNumber: number;
  guesses: number;
  solved: boolean;
  playerId: string;
}): Promise<void> {
  const payload = {
    ...body,
    puzzleNumber: Math.floor(Number(body.puzzleNumber)),
  };
  const res = await fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`post stats ${res.status}`);
  }
}

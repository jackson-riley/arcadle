export type GlobalStatsResponse = {
  totalPlayers: number;
  solveRate: number;
  guessDistribution: Record<number, number>;
};

export async function fetchGlobalStats(
  puzzleNumber: number
): Promise<GlobalStatsResponse> {
  const res = await fetch(
    `/api/stats?puzzleNumber=${encodeURIComponent(String(puzzleNumber))}`,
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
  const res = await fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`post stats ${res.status}`);
  }
}

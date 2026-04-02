/**
 * Centered burst on any correct solve (daily or archive). Dynamic import keeps it off the main bundle
 * until needed. Call before `setGameState("won")` so it lines up with the solved screenshot appearing.
 */
export function fireWinConfetti(): void {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void import("canvas-confetti").then((mod) => {
        mod.default({
          particleCount: 150,
          spread: 70,
          origin: { x: 0.5, y: 0.5 },
        });
      });
    });
  });
}

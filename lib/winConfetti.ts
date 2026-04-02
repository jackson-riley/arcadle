/**
 * One centered burst for a same-day win; dynamic import keeps it off the main bundle until needed.
 * Timed with double rAF so it runs after React commits the solved screenshot.
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

"use client";

import { useEffect } from "react";

const BORDER_CARD = "rgba(255,255,255,0.06)";
const LEGEND_WRONG = "#C45C5C";
const TEXT_PRIMARY = "#E8E4DF";
const TEXT_BODY = "#C8C4BF";
const TEXT_BODY_STRONG = "#E8E4DF";
const TEXT_LEGEND_LABEL = "#8A8480";
const TEXT_FOOTNOTE = "#6A6560";

interface HowToPlayModalProps {
  onPlay: () => void;
  onClose: () => void;
}

export default function HowToPlayModal({ onPlay, onClose }: HowToPlayModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(17, 17, 16, 0.92)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
    >
      <div
        className="animate-slide-up max-h-[90vh] w-full max-w-[340px] overflow-y-auto rounded-[20px] border p-7 font-dm-sans shadow-[0_24px_80px_rgba(0,0,0,0.6),0_2px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{
          background: "linear-gradient(170deg, #1E1D1B 0%, #181714 100%)",
          borderColor: BORDER_CARD,
          color: TEXT_BODY,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="how-to-play-title"
          className="mb-5 font-outfit text-[20px] font-bold uppercase tracking-[0.08em]"
          style={{ color: TEXT_PRIMARY }}
        >
          How to Play
        </h2>

        <div className="mb-5 space-y-3 text-[14px] font-normal leading-relaxed">
          <p>
            Guess today&apos;s video game in{" "}
            <span className="font-semibold" style={{ color: TEXT_BODY_STRONG }}>
              6 tries
            </span>
            .
          </p>
          <p>
            Each wrong guess reveals a new clue and{" "}
            <span className="font-semibold" style={{ color: TEXT_BODY_STRONG }}>
              sharpens the screenshot
            </span>
            .
          </p>
        </div>

        <div
          className="mb-5 space-y-3 rounded-[12px] border p-4"
          style={{
            background: "rgba(255,255,255,0.025)",
            borderColor: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            className="flex justify-center gap-1"
            role="img"
            aria-label="Example: one wrong segment, one correct, four unused"
          >
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px]"
              style={{ background: LEGEND_WRONG }}
              aria-hidden
            />
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px]"
              style={{ background: "var(--color-green)" }}
              aria-hidden
            />
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px] border"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              aria-hidden
            />
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px] border"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              aria-hidden
            />
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px] border"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              aria-hidden
            />
            <span
              className="h-2.5 min-w-0 flex-1 rounded-[3px] border"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              aria-hidden
            />
          </div>

          <ul className="space-y-2.5 text-[12px] font-medium" style={{ color: TEXT_LEGEND_LABEL }}>
            <li className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-[2px]"
                style={{ background: LEGEND_WRONG }}
                aria-hidden
              />
              <span>wrong guess</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-[2px]"
                style={{ background: "var(--color-green)" }}
                aria-hidden
              />
              <span>correct guess</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-[2px] border"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.1)",
                }}
                aria-hidden
              />
              <span>unused guess</span>
            </li>
          </ul>
        </div>

        <p
          className="mb-5 text-center text-[13px] font-normal italic"
          style={{ color: TEXT_FOOTNOTE }}
        >
          A new puzzle drops every day at midnight.
        </p>

        <button type="button" onClick={onPlay} className="how-to-play-play">
          Play
        </button>
      </div>
    </div>
  );
}

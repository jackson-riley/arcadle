import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ludle — Daily Video Game Guessing",
  description: "Guess the video game from progressive clues. A new puzzle every day.",
  openGraph: {
    title: "Ludle",
    description: "Can you guess today's video game?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

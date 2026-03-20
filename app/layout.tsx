import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ludle.gg"),
  icons: {
    icon: "/favicon.svg",
  },
  title: "Ludle — Daily Video Game Guessing Game",
  description:
    "Guess today's video game from progressive clues and blurred screenshots. A new puzzle every day.",
  openGraph: {
    title: "Ludle — Daily Video Game Guessing Game",
    description:
      "Guess today's video game from progressive clues and blurred screenshots. A new puzzle every day.",
    url: "https://ludle.gg",
    siteName: "Ludle",
    images: [
      {
        url: "https://ludle.gg/og.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ludle — Daily Video Game Guessing Game",
    description:
      "Guess today's video game from progressive clues and blurred screenshots.",
    images: ["https://ludle.gg/og.png"],
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

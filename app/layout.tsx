import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ludle.gg"),
  title: "Ludle — Daily Video Game Guessing Game",
  description:
    "Guess today's video game from progressive clues and blurred screenshots. A new puzzle every day.",
  openGraph: {
    title: "Ludle — Daily Video Game Guessing Game",
    description:
      "Guess today's video game from progressive clues and blurred screenshots. A new puzzle every day.",
    url: "https://ludle.gg",
    siteName: "Ludle",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ludle — Daily Video Game Guessing Game",
    description:
      "Guess today's video game from progressive clues and blurred screenshots.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full overflow-hidden ${outfit.variable} ${dmSans.variable}`}
    >
      <body className="h-full min-h-0 overflow-hidden overscroll-none bg-[#111110]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

// app/qa/page.tsx
// Dev-only QA page for reviewing candidate screenshots.
// Visit /qa while running locally.

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import QAClient from "./QAClient";

export type QACandidate = {
  title: string;
  developer: string;
  year: number | null;
  genre: string;
  platforms: string;
  rating: number;
  rating_count: number;
  series: string | null;
  igdb_id: number;
  slug: string;
  hasScreenshot: boolean;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function QAPage() {
  const candidatesPath = path.join(process.cwd(), "scripts", "candidates.json");
  const stagingRoot = path.join(process.cwd(), "public", "screenshots-staging");

  if (!fs.existsSync(candidatesPath)) {
    return (
      <div className="p-8 font-mono">
        <p className="text-red-400">
          candidates.json not found. Run <code>npm run fetch-candidates</code> first.
        </p>
        <Link
          href="/qa/excluded"
          className="mt-4 inline-block text-sm text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
        >
          Excluded games screenshots →
        </Link>
      </div>
    );
  }

  const raw = JSON.parse(fs.readFileSync(candidatesPath, "utf-8"));

  const candidates: QACandidate[] = raw.map((c: any) => {
    const slug = slugify(c.title);
    const screenshotPath = path.join(stagingRoot, slug, "original.jpg");
    return {
      ...c,
      slug,
      hasScreenshot: fs.existsSync(screenshotPath),
    };
  });

  const withScreenshots = candidates.filter((c) => c.hasScreenshot);
  const withoutScreenshots = candidates.filter((c) => !c.hasScreenshot);

  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-2">
        <Link
          href="/qa/excluded"
          className="text-sm text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
        >
          Excluded games screenshots →
        </Link>
      </div>
      <QAClient
        candidates={withScreenshots}
        missingCount={withoutScreenshots.length}
      />
    </>
  );
}

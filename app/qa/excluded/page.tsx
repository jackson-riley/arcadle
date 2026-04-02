import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExcludedScreenshotGameEntries } from "@/lib/games";
import { slugify } from "@/lib/slug";

/**
 * QA: blur-5 thumbnails for games in ADDITIONAL_EXCLUDED_TITLES / ADDITIONAL_GAMES_EXCLUDED_TITLES
 * (omitted from /screenshots because they are not in GAMES_DB / normal additional tooling list).
 */
export default function QAExcludedScreenshotsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const games = getExcludedScreenshotGameEntries();
  const screenshotsRoot = path.join(process.cwd(), "public", "screenshots");

  let missingBlur = 0;
  const rows = games.map((game) => {
    const slug = slugify(game.title);
    const blurPath = path.join(screenshotsRoot, slug, "blur-5.jpg");
    const hasBlur = fs.existsSync(blurPath);
    if (!hasBlur) missingBlur++;
    return { game, slug, hasBlur };
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Excluded games — screenshots</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Same layout as /screenshots: blur-5 preview; click opens solved.jpg. These titles are
            skipped in dailies but may still have assets under{" "}
            <code className="text-zinc-400">public/screenshots/&lt;slug&gt;/</code>.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-sm">
          <Link href="/qa" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
            Candidate QA
          </Link>
          <Link
            href="/screenshots"
            className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            All screenshots
          </Link>
        </div>
      </div>

      <div className="mb-4 text-sm text-zinc-400">
        {games.length} excluded {games.length === 1 ? "title" : "titles"}
        {missingBlur > 0 && (
          <span className="text-amber-500"> · {missingBlur} missing blur-5.jpg</span>
        )}
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map(({ game, slug, hasBlur }) => (
          <div key={game.title} className="group block">
            {hasBlur ? (
              <a
                href={`/screenshots/${slug}/solved.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Image
                  src={`/screenshots/${slug}/blur-5.jpg`}
                  alt=""
                  width={200}
                  height={113}
                  unoptimized
                  className="mx-auto aspect-video w-full max-w-[200px] rounded border border-zinc-800 object-cover group-hover:border-zinc-600"
                />
              </a>
            ) : (
              <div className="mx-auto flex aspect-video w-full max-w-[200px] items-center justify-center rounded border border-dashed border-zinc-700 bg-zinc-900 text-center text-xs text-zinc-500">
                No blur-5
              </div>
            )}
            <p className="mt-2 text-center text-xs text-zinc-400 group-hover:text-zinc-200">
              {game.title}
            </p>
            <p className="text-center text-[10px] text-zinc-600">
              {game.year} · {game.developer}
            </p>
          </div>
        ))}
      </div>

      {games.length === 0 && (
        <p className="text-center text-zinc-500 py-16">No excluded titles in the exclusion sets.</p>
      )}
    </main>
  );
}

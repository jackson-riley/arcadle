import Image from "next/image";
import { notFound } from "next/navigation";
import { GAMES_DB, ADDITIONAL_GAMES_DB } from "@/lib/games";
import { slugify } from "@/lib/slug";

/**
 * Internal QA: browse blur-5 thumbnails and open solved.jpg.
 * Not available in production builds.
 */
export default function ScreenshotsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6">
      <h1 className="mb-2 text-xl font-semibold text-zinc-100">Screenshot QA</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Thumbnails are blur-5; click to open solved.jpg in a new tab.
      </p>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {[...GAMES_DB, ...ADDITIONAL_GAMES_DB]
          .sort((a, b) => a.title.localeCompare(b.title, "en"))
          .map((game) => {
          const slug = slugify(game.title);
          return (
            <a
              key={game.title}
              href={`/screenshots/${slug}/solved.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <Image
                src={`/screenshots/${slug}/blur-5.jpg`}
                alt=""
                width={200}
                height={113}
                unoptimized
                className="mx-auto aspect-video w-full max-w-[200px] rounded border border-zinc-800 object-cover"
              />
              <p className="mt-2 text-center text-xs text-zinc-400 group-hover:text-zinc-200">
                {game.title}
              </p>
            </a>
          );
        })}
      </div>
    </main>
  );
}

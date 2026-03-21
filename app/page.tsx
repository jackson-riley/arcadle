import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <Game />
      <footer className="w-full max-w-lg px-4 pt-6 pb-8 text-center">
        <a
          href="https://forms.gle/M2yf5ozhmUFoX6J87"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-600 no-underline hover:text-zinc-400 transition-colors"
        >
          Feedback
        </a>
      </footer>
    </main>
  );
}

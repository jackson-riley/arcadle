# FrameGuessr

A daily video game guessing game. Players get progressive clues (and eventually a pixelated screenshot) to identify a video game in 6 guesses or fewer.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
frameguessr/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Daily puzzle page
│   ├── globals.css         # Tailwind + custom styles
│   └── api/
│       └── puzzle/
│           └── route.ts    # Daily puzzle API (serves clues + validates guesses)
├── components/
│   ├── Game.tsx            # Main game orchestrator
│   ├── GameCard.tsx        # Visual card with blur reveal
│   ├── GuessInput.tsx      # Autocomplete search input
│   ├── ClueStack.tsx       # Progressive clue display
│   ├── GuessHistory.tsx    # Progress bar / guess slots
│   ├── ShareButton.tsx     # Copy-to-clipboard share card
│   └── StatsModal.tsx      # Statistics overlay
├── lib/
│   ├── games.ts            # Game database (static for now)
│   ├── puzzle.ts           # Daily puzzle selection logic
│   ├── types.ts            # TypeScript interfaces
│   └── storage.ts          # localStorage wrapper for stats
├── scripts/
│   └── generate-blurs.ts   # Pre-generate pixelated image levels
└── public/
    └── screenshots/        # Game screenshots (add manually)
```

## Cursor Development Guide

### Recommended Cursor Settings
- Enable **Copilot++** for inline completions
- Use **Cmd+K** (inline edit) for targeted changes within components
- Use **Cmd+L** (chat) for architectural questions and multi-file changes
- Pin `lib/types.ts` in chat context so Cursor always knows your types

### Prompt Templates for Cursor Chat

**Adding a new feature:**
> "Add [feature] to the Game component. Follow the existing pattern of
> keeping state in Game.tsx and passing props down. Use the types from
> lib/types.ts."

**Extending the game database:**
> "Add 20 more games to lib/games.ts. Include a mix of indie and AAA
> titles from 2000-2024. Follow the existing GameEntry shape exactly."

**Upgrading from clues to screenshots:**
> "Modify GameCard.tsx to accept an optional `screenshotUrl` prop.
> When present, render a blurred image instead of the abstract gradient.
> Use CSS filter: blur() with levels [30, 24, 18, 12, 6, 0]px
> corresponding to reveal stages 0-5."

**Adding the API route:**
> "Create an API route at app/api/puzzle/route.ts that:
> 1. GET returns today's puzzle clues up to the requested reveal level
>    (never sends the answer or unrevealed clues)
> 2. POST accepts a guess, validates it, returns correct/incorrect
>    and the next clue if incorrect
> Keep the answer server-side only."

### Development Sequence

This is the order I'd build things in, using Cursor to accelerate each step:

1. **[DONE] Cardboard prototype** — core loop works with hardcoded data
2. **Decompose into components** — break the prototype into the file structure above
3. **Add localStorage stats** — persist streaks/distribution across sessions
4. **Screenshot pipeline** — add real game screenshots, generate blur levels
5. **Server-side puzzle API** — move answer validation to the server (anti-cheat)
6. **Polish** — animations, mobile responsiveness, social sharing preview
7. **Content pipeline** — build a script/admin UI to curate 365+ puzzles
8. **Deploy** — Vercel, custom domain, OG image generation for social shares

### Key Technical Decisions

| Decision | Prototype | Production |
|----------|-----------|------------|
| Puzzle data | Hardcoded in `lib/games.ts` | PostgreSQL via Supabase |
| Image reveal | CSS `filter: blur()` client-side | Pre-generated blur levels on S3/R2 |
| Answer validation | Client-side comparison | Server-side API route |
| Stats storage | `localStorage` | `localStorage` + optional auth sync |
| Game search | Local array filter | IGDB API for autocomplete |
| Deployment | `npm run dev` | Vercel |

### Screenshot Pipeline (when ready)

1. Source screenshots from IGDB API or capture manually
2. Store originals in `public/screenshots/{game-slug}/original.jpg`
3. Run `npx tsx scripts/generate-blurs.ts` to create 6 blur levels per image
4. In production, serve from CDN and never send original until puzzle is solved

### Environment Variables (for later)

```env
# .env.local
IGDB_CLIENT_ID=       # Twitch/IGDB API credentials
IGDB_CLIENT_SECRET=
DATABASE_URL=         # Supabase PostgreSQL connection string
```

## Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Images**: sharp (blur generation), Cloudflare R2 or S3 (storage)
- **Database**: SQLite (dev) → PostgreSQL/Supabase (prod)
- **Hosting**: Vercel
- **Game Data**: IGDB API

## License

MIT

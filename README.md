# Food Twin

Find foods with identical nutritional profiles. Search any food, get a ranked list of alternatives with the closest macro match — swap ingredients without changing your targets.

Built with the [T3 Stack](https://create.t3.gg/) · Data from [Open Food Facts](https://world.openfoodfacts.org/)

## Features

- **Autocomplete search** with real-time suggestions as you type
- **Macro similarity ranking** — normalized Euclidean distance across protein, carbs, fat and calories
- **Visual macro bars** — stacked protein/carbs/fat breakdown with per-food diff indicators vs the reference
- **Filters** — minimum protein ratio, calorie ceiling, vegan-only
- **AI search** — when `ANTHROPIC_API_KEY` is set, the AI button unlocks; works for any food not in the database
- **Keyboard navigation** in the suggestion dropdown (↑ ↓ Enter Esc)
- **Dark mode** — persisted to `localStorage`, respects system preference on first visit
- **Add custom foods** — create entries with your own macro values and portion sizes
- **Portion display** — common serving sizes shown per food

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, Turbopack) |
| API | tRPC v11 |
| Database | SQLite via Prisma |
| Styling | Tailwind CSS |
| Language | TypeScript |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) — used as the package manager and runtime

### Installation

```bash
git clone https://github.com/yourusername/food-twin.git
cd food-twin
bun install
```

### Environment

Copy the example env file and fill in the values:

```bash
cp .env.example .env
```

```env
DATABASE_URL="file:./db.sqlite"
USDA_API_KEY="your-key"        # required by the Open Food Facts seeder (bun db:seed:off)
ANTHROPIC_API_KEY="sk-ant-..."  # optional — enables the AI search button
```

### Database setup

```bash
bun db:push          # create db.sqlite and apply schema
bun db:seed:off      # import real foods from Open Food Facts (~1200 foods)
```

`db:seed` is also available if you just want the 100-food random placeholder dataset.

### Run

```bash
bun dev              # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server with Turbopack |
| `bun build` | Production build |
| `bun check` | Lint + TypeScript type check |
| `bun format:write` | Format all files with Prettier |
| `bun db:push` | Apply schema changes to database |
| `bun db:seed` | Seed with 100 random placeholder foods |
| `bun db:seed:off` | Seed with real data from Open Food Facts |
| `bun db:studio` | Open Prisma Studio GUI |

## How the similarity algorithm works

All macros are normalized against daily reference values (2000 kcal, 50g protein, 300g carbs, 65g fat) before computing Euclidean distance. This prevents calories from dominating the score.

Candidate pool: foods within ±200% of the reference food's calories are pre-selected (up to 500), falling back to the full pool if fewer than 20 qualify. The top 10 closest matches are returned.

## Deployment

The app deploys as a standard Next.js project. SQLite is file-based so you'll need persistent storage (e.g. a volume on Railway or Fly.io) for the database file.

- [Vercel](https://vercel.com) — works for the frontend but requires an external database (SQLite is ephemeral on serverless)
- [Railway](https://railway.app) / [Fly.io](https://fly.io) — recommended, supports persistent volumes

## License

MIT — see [LICENSE](./LICENSE)

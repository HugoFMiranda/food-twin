# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev          # Start dev server (Next.js turbo mode)
bun build        # Production build
bun start        # Start production server

# Code quality
bun lint         # ESLint check
bun lint:fix     # ESLint with auto-fix
bun check        # Lint + TypeScript type check
bun typecheck    # TypeScript only
bun format:write # Auto-format with Prettier

# Database
bun db:push      # Push schema changes to database (dev)
bun db:generate  # Generate migration files
bun db:migrate   # Deploy migrations
bun db:seed      # Seed with USDA food data
bun db:studio    # Open Prisma Studio GUI
```

## Architecture

**T3 Stack** (Next.js 15 App Router + tRPC + Prisma + TypeScript + Tailwind).

All API calls go through a single tRPC endpoint at `/api/trpc/[trpc]`. There is no REST API — add new endpoints as tRPC procedures in `src/server/api/routers/` and register them in `src/server/api/root.ts`.

**Path alias:** `food-twin/*` maps to `./src/*`.

### Key Files

| Path | Purpose |
|------|---------|
| `src/server/api/routers/foodRouter.ts` | All food-related tRPC procedures |
| `src/server/db.ts` | Prisma client singleton |
| `src/trpc/react.tsx` | Client-side tRPC + React Query provider |
| `src/env.js` | Zod-validated env vars (add new vars here) |
| `prisma/schema.prisma` | SQLite schema (Food, FoodNutrient, Measure, Brand, etc.) |
| `prisma/seed.ts` | Database seeder script |

### Food Similarity Algorithm

`foodRouter.ts` implements a normalized Euclidean distance search:
- Normalizes macros against daily values: 2000 kcal, 50g protein, 300g carbs, 65g fat
- Candidate pre-filter: foods within ±200% of reference calories (up to 500); falls back to full pool if fewer than 20 candidates
- Returns top 10 matches sorted by distance; 10-second timeout
- Scores color-coded on the frontend: green (≥90%) → lime → amber → orange → rose

### Portion Calculator

Each `FoodCard` maintains its own `portionGrams` state (default 100g). All displayed macro and calorie values are scaled by `portionGrams / 100`. USDA predefined portions render as quick-set buttons that set the gram input. The reference food card exposes an `onPortionChange` callback so `SearchPage` can keep a `referencePortion` state and pass scaled reference macros to all similar-food diff indicators, ensuring the comparison is always between the chosen portions on both sides.

### State & Data Flow

- **Server state**: React Query via tRPC hooks (`api.food.xxx.useQuery`)
- **Local state**: `useState`/`useRef` hooks only — no external state manager
- **Search debouncing**: 150ms before API calls
- **Query caching**: 5 min for search results, 1 min for autocomplete suggestions

### Environment Variables

Required in `.env` (validated by `src/env.js`):
```
DATABASE_URL="file:./db.sqlite"
USDA_API_KEY="..."   # Note: .env.example incorrectly shows FOOD_API_KEY
```

`SKIP_ENV_VALIDATION=1` skips validation (useful in CI/Docker).

### Database

SQLite file at `./db.sqlite`. The `Food` model is indexed on `description`, `protein`, `calories`, `category`, `isUserCreated`, and `isVegan`. User-created foods use `isUserCreated = true`; the `isVegan` flag is set by the user when adding custom foods (USDA foods default to `false`). User-created `fdcId` values use `Date.now() * 10 + rand(10)` to avoid sequential-read race conditions.

After any schema change run `bun db:push` (dev) to apply and regenerate the Prisma client.

### Dark Mode

Persisted to `localStorage` under key `food-twin-dark-mode`. Falls back to `prefers-color-scheme` on first visit. Applied through conditional Tailwind classes throughout the app.

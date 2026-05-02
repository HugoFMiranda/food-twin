# Food Twin — AI-Powered Architecture

## Overview

This document describes the full architecture for migrating food-twin from a static seeded
SQLite database to an AI-powered system where any food can be looked up on demand. It covers
the target state, implementation phases, API contracts, prompt design, caching, and migration
strategy.

---

## Current State

```
User → Search page → tRPC getSimilarFoods → Prisma → SQLite (1,248 foods)
                                                      ↓
                                              Euclidean distance
                                              on 4 macros × top 500 foods
```

**Limitations:**
- Fixed food pool — obscure, regional, or branded foods return no results
- Requires seeding step before the app works at all
- Seeder depends on Open Food Facts API (rate-limited, partial English coverage)
- Schema migrations needed for any new nutritional field
- ~1,248 foods is a tiny fraction of real-world coverage

---

## Target State

```
User → Search page → tRPC getSimilarFoods → AI Router → Anthropic API
                                                  ↓              ↓
                                           Cache layer     Structured JSON
                                         (optional KV)    (reference + 25 twins)
                                                  ↓
                                          In-memory distance
                                          ranking (no DB query)
```

**Properties:**
- Any food, any language, any specificity — works immediately
- No seed step, no database required for the core search flow
- User-created foods stored in a lightweight append-only table (or localStorage)
- New nutritional fields require only prompt changes, not schema migrations
- Stateless server — deployable to edge runtimes (Vercel Edge, Cloudflare Workers)

---

## Technical Requirements

### API Key

```env
ANTHROPIC_API_KEY="sk-ant-..."
```

Add to `src/env.js`:
```typescript
ANTHROPIC_API_KEY: z.string().min(1),
```

### Package

```bash
bun add @anthropic-ai/sdk
```

Current Claude model to use: `claude-haiku-4-5-20251001` for cost efficiency on every search
call. Upgrade to `claude-sonnet-4-6` only if nutritional accuracy needs improvement.

### Optional Cache

For production: Vercel KV (Redis-compatible, zero-config on Vercel).
For local dev: in-memory `Map` with TTL.

```bash
bun add @vercel/kv          # optional, only if deploying to Vercel
```

---

## Data Contracts

### AI Response Shape (per food item)

```typescript
interface AIFood {
  name: string;           // canonical English name
  calories: number;       // kcal per 100g
  protein: number;        // g per 100g
  carbs: number;          // g per 100g
  fat: number;            // g per 100g
  fiber?: number;         // g per 100g
  sugar?: number;         // g per 100g
  sodium?: number;        // mg per 100g
  isVegan: boolean;
  category: string;       // e.g. "Poultry", "Legumes", "Dairy"
  confidence: "high" | "medium" | "low";
}

interface AISearchResult {
  referenceFood: AIFood;
  candidates: AIFood[];   // 20–30 nutritionally diverse options
}
```

### tRPC Procedure Output (unchanged shape, new source)

The existing `getSimilarFoods` output shape is preserved so the frontend requires zero changes:

```typescript
{
  referenceFood: FoodWithPortions;
  similarFoods: (FoodWithPortions & { similarity: number; proteinRatio: number })[];
}
```

The AI result is mapped into this shape in-process. No Prisma call needed for the search path.

---

## Prompt Design

### System Prompt

```
You are a nutritional database. You return precise macronutrient data for foods.
All values are per 100g of the food in its most common prepared/ready-to-eat form.
Respond only with valid JSON matching the schema provided. No prose, no markdown fences.
```

### User Prompt — Reference Food

```
Return the macronutrients for: "${foodName}"

Schema:
{
  "name": string,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "isVegan": boolean,
  "category": string,
  "confidence": "high" | "medium" | "low"
}
```

### User Prompt — Candidates (batched with reference)

Send both in a single API call to minimise latency and cost:

```
Return the macronutrients for: "${foodName}"

Then return 25 nutritionally diverse foods that could substitute for it.
Vary across: protein content, calorie density, food category, preparation method.
Avoid repeating the reference food or near-identical variants.

Response schema (JSON only):
{
  "referenceFood": { <AIFood> },
  "candidates": [ { <AIFood> }, ... ]
}
```

### Prompt Hardening Rules

1. Ask for `confidence` field — filter out `"low"` confidence results client-side (show warning)
2. Wrap `JSON.parse` in try/catch and retry once on parse failure
3. Add `z.object({...})` Zod validation on the parsed result before using it
4. If Zod fails, throw a typed tRPC error with `code: "INTERNAL_SERVER_ERROR"` and a user-safe message

---

## Implementation Plan

### Phase 1 — AI Service Layer (no frontend changes)

**Files to create:**

```
src/server/ai/
├── client.ts          # Anthropic SDK singleton
├── prompts.ts         # Prompt templates
├── schemas.ts         # Zod schemas for AI response validation
└── foodLookup.ts      # fetchFoodWithCandidates(foodName) → AISearchResult
```

**`src/server/ai/client.ts`**
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "food-twin/env";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
```

**`src/server/ai/schemas.ts`**
```typescript
import { z } from "zod";

export const AIFoodSchema = z.object({
  name: z.string(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().optional(),
  sugar: z.number().nonnegative().optional(),
  sodium: z.number().nonnegative().optional(),
  isVegan: z.boolean(),
  category: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const AISearchResultSchema = z.object({
  referenceFood: AIFoodSchema,
  candidates: z.array(AIFoodSchema).min(1).max(30),
});

export type AIFood = z.infer<typeof AIFoodSchema>;
export type AISearchResult = z.infer<typeof AISearchResultSchema>;
```

**`src/server/ai/foodLookup.ts`**
```typescript
import { anthropic } from "./client";
import { AISearchResultSchema, type AISearchResult } from "./schemas";
import { buildSearchPrompt } from "./prompts";

const MAX_RETRIES = 2;

export async function fetchFoodWithCandidates(
  foodName: string,
): Promise<AISearchResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: "You are a nutritional database. Return only valid JSON, no prose.",
      messages: [{ role: "user", content: buildSearchPrompt(foodName) }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";

    try {
      const parsed = JSON.parse(text) as unknown;
      return AISearchResultSchema.parse(parsed);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`AI lookup failed for "${foodName}": ${String(lastError)}`);
}
```

### Phase 2 — Cache Layer

**`src/server/ai/cache.ts`**

Two implementations behind the same interface — swap by env var:

```typescript
export interface FoodCache {
  get(key: string): Promise<AISearchResult | null>;
  set(key: string, value: AISearchResult): Promise<void>;
}
```

- **`MemoryCache`**: `Map<string, { value, expiresAt }>` — default for dev/testing
- **`VercelKVCache`**: wraps `@vercel/kv` with 24h TTL — used when `KV_REST_API_URL` is set

Cache key: `food-twin:search:v1:${foodName.toLowerCase().trim()}`

### Phase 3 — Router Migration

Update `foodRouter.ts`:

```typescript
// getSimilarFoods — AI path
const raw = await cache.get(cacheKey) ?? await fetchFoodWithCandidates(input.foodName);
await cache.set(cacheKey, raw);

// Map AIFood → existing output shape
const toFoodRecord = (f: AIFood) => ({
  id: crypto.randomUUID(),
  fdcId: 0,
  description: f.name,
  calories: f.calories,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  category: f.category,
  isVegan: f.isVegan,
  isUserCreated: false,
  portions: [],
  // new fields available but ignored by current UI
  fiber: f.fiber ?? null,
  sugar: f.sugar ?? null,
  sodium: f.sodium ?? null,
});
```

Keep `getFoodSuggestions` hitting the DB (or a lightweight static wordlist) for autocomplete —
this does not need AI and the DB still holds user-created foods.

Keep `createFood` unchanged — user foods go to SQLite as before.

### Phase 4 — Schema Simplification (optional, deferred)

Once AI is the primary search path, the Prisma schema can be slimmed to just:

```prisma
model Food {
  id            String  @id @default(cuid())
  fdcId         Int     @unique
  description   String
  protein       Float?
  carbs         Float?
  fat           Float?
  calories      Float?
  fiber         Float?
  sugar         Float?
  sodium        Float?
  category      String?
  isVegan       Boolean @default(false)
  isUserCreated Boolean @default(true)
  portions      FoodPortion[]

  @@index([description])
  @@index([isUserCreated])
}
```

Drop `FoodNutrient`, `Measure`, `Brand`, `NutrientSource`, `MeasureUnit`,
`ProteinConversionFactor` — none are used by the current UI.

### Phase 5 — Enhanced Similarity (post-AI)

With fiber, sugar, sodium available from the AI, upgrade the distance function:

```typescript
const similarity = Math.sqrt(
  Math.pow((f.calories  - ref.calories)  / 2000, 2) +
  Math.pow((f.protein   - ref.protein)   / 50,   2) +
  Math.pow((f.carbs     - ref.carbs)     / 300,  2) +
  Math.pow((f.fat       - ref.fat)       / 65,   2) +
  Math.pow((f.fiber     - ref.fiber)     / 30,   2) * 0.5 +  // lower weight
  Math.pow((f.sugar     - ref.sugar)     / 50,   2) * 0.5 +
  Math.pow((f.sodium    - ref.sodium)    / 2300,  2) * 0.3,
);
```

---

## Autocomplete Strategy

`getFoodSuggestions` currently queries SQLite. Three options in order of simplicity:

| Option | How | Tradeoff |
|--------|-----|----------|
| Keep DB suggestions | Query existing 1,248 foods | Limited to seeded set |
| AI streaming suggestions | Stream partial completions via SSE | Latency, cost |
| Static wordlist | Bundle a 5k-word food name list as JSON | Fast, no AI cost, limited coverage |

**Recommended:** Keep DB suggestions for now. After AI search lands, add a curated static
wordlist (exported from Open Food Facts top-1000 English names) to supplement it.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| AI parse failure after 2 retries | tRPC error → toast "We couldn't find that food. Try a different name." |
| `confidence: "low"` on reference food | Return result with `lowConfidence: true` → UI shows amber warning banner |
| Anthropic 529 overload | Retry with 2s backoff × 2; then fail with user-safe message |
| Cache read failure | Log + fall through to live AI call silently |
| No `ANTHROPIC_API_KEY` | Fail at startup via `src/env.js` Zod validation |

---

## Cost Model

| Volume | Model | Tokens/call | Cost/call | Monthly (1k searches/day) |
|--------|-------|------------|-----------|--------------------------|
| Reference + 25 candidates | Haiku 4.5 | ~800 in / ~600 out | ~$0.0005 | ~$15 |
| With 24h cache (80% hit rate) | Haiku 4.5 | same | ~$0.0001 effective | ~$3 |

Upgrade to Sonnet 4.6 only if nutritional accuracy complaints arise — ~10× cost.

---

## Deployment Requirements

### Vercel (recommended)

```env
ANTHROPIC_API_KEY=sk-ant-...
KV_REST_API_URL=...          # Vercel KV (optional but recommended)
KV_REST_API_TOKEN=...
DATABASE_URL=file:./db.sqlite  # only for user-created foods
```

Enable **Fluid Compute** (or set function timeout to 30s) — AI calls typically take 2–5s.

### Self-hosted / Docker

No special requirements beyond Node 18+ and the env vars above. SQLite works fine
for the user-foods table at any reasonable scale.

---

## File Tree After Full Implementation

```
src/server/
├── ai/
│   ├── client.ts          # Anthropic singleton
│   ├── prompts.ts         # buildSearchPrompt()
│   ├── schemas.ts         # AIFoodSchema, AISearchResultSchema
│   ├── foodLookup.ts      # fetchFoodWithCandidates()
│   └── cache.ts           # MemoryCache + VercelKVCache
├── api/routers/
│   └── foodRouter.ts      # getSimilarFoods → AI; createFood → Prisma
└── db.ts                  # Prisma client (user foods only)
```

---

## Migration Path (zero-downtime)

1. **Deploy Phase 1–3** with `USE_AI_SEARCH=true` env flag — router checks flag and falls back
   to DB if false. Both paths live simultaneously.
2. **Verify** AI accuracy against known foods (compare DB results vs AI results for 20 foods).
3. **Flip flag** to `true` in production. DB search path remains as emergency fallback.
4. **After 2 weeks** with no regressions, remove the DB fallback path and run Phase 4 schema
   cleanup.

---

## Open Questions

- **User-created food search**: Should custom foods be included in AI candidate ranking?
  Simplest approach: run AI candidates, then merge user-created foods from DB (re-rank combined pool).
- **Serving size**: AI returns per-100g. A serving-size field can be added to the prompt with
  minimal prompt change once Phase 1–3 land.
- **Goal-based filtering**: "High protein, low carb" maps naturally to a prompt instruction:
  `"Bias candidates toward high protein-to-calorie ratio"` — no algorithm change needed.
- **Offline / PWA**: Cache last 10 search results in `localStorage` for offline access.
  Combine with the Phase 5 PWA manifest item from NEXT_STEPS.md.

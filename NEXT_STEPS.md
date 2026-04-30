# Next Steps

## AI-powered food lookup — no database required

The biggest architectural shift worth pursuing: replace the static database entirely with an LLM.

Instead of pre-seeding a fixed set of foods, the user types any food name and an AI model returns its macros on the fly. Similarity matching then runs in-memory against the same AI-generated pool of alternatives, meaning the app works for any food imaginable — obscure recipes, regional dishes, branded products — without ever needing a CSV import, schema migration or seeding step.

**How it would work:**

1. User searches "Roast Chicken Breast with Herbs"
2. API calls Claude/GPT with a structured prompt requesting macros per 100g as JSON
3. The model returns `{ calories, protein, carbs, fat }` with high accuracy (LLMs are well-calibrated on nutritional data)
4. The same model generates 20–30 nutritionally diverse candidate foods with their macros in a single prompt
5. Similarity is computed in-memory and the top 10 are returned
6. No database, no seeding, no schema — just an API key

The only infrastructure needed is the LLM API itself. Optional: cache results in a lightweight key-value store (Redis, Cloudflare KV) so repeated lookups are instant and cheap.

---

## Other improvements

**Better similarity model**
The current Euclidean distance on raw macros is fast but crude. A weighted model that accounts for micronutrients (fibre, sugar, sodium) or uses cosine similarity on a macro ratio vector would produce more nutritionally meaningful matches.

**Serving size awareness**
All current data is per 100g. Letting users specify an actual serving (e.g. "1 chicken breast, ~150g") and normalising matches to that serving size would make comparisons more practical.

**Goal-based filtering**
Rather than manual ratio filters, let users state a goal ("high protein, low carb") and have the algorithm optimise for it — e.g. rank by protein-to-calorie ratio within a calorie band.

**User accounts and history**
Save searches, favourite foods and custom entries per user. Currently all custom foods are global and anonymous.

**Meal builder**
Select multiple foods and see the combined macro profile, then find a single-food or two-food alternative that matches the total.

**Barcode scanning**
Mobile users could scan a product barcode and get instant twins. Open Food Facts already has barcode data; the AI approach would handle anything not in the database.

**Progressive Web App**
Add a manifest and service worker so the app installs on mobile and works offline for recent searches.

**Export**
Let users export their food list or meal plan as CSV or copy it to a calorie-tracking app.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Nutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  nutriments?: Nutriments;
  labels_tags?: string[];
}

interface OFFResponse {
  products?: OFFProduct[];
}

const CATEGORIES: { tag: string; label: string; pages: number }[] = [
  { tag: 'en:meats',                      label: 'Meat',         pages: 4 },
  { tag: 'en:poultry',                    label: 'Poultry',      pages: 3 },
  { tag: 'en:fish-and-seafood',           label: 'Seafood',      pages: 3 },
  { tag: 'en:dairy',                      label: 'Dairy',        pages: 4 },
  { tag: 'en:eggs',                       label: 'Eggs',         pages: 2 },
  { tag: 'en:vegetables',                 label: 'Vegetables',   pages: 4 },
  { tag: 'en:fruits',                     label: 'Fruits',       pages: 4 },
  { tag: 'en:cereals-and-their-products', label: 'Cereals',      pages: 3 },
  { tag: 'en:legumes',                    label: 'Legumes',      pages: 3 },
  { tag: 'en:nuts',                       label: 'Nuts',         pages: 3 },
  { tag: 'en:snacks',                     label: 'Snacks',       pages: 3 },
  { tag: 'en:breads',                     label: 'Bread',        pages: 3 },
  { tag: 'en:pasta',                      label: 'Pasta',        pages: 2 },
  { tag: 'en:oils-and-fats',             label: 'Oils & Fats',  pages: 2 },
  { tag: 'en:condiments',                 label: 'Condiments',   pages: 2 },
];

const PAGE_SIZE = 50;
const BASE_DELAY_MS = 600;
const MAX_RETRIES = 4;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(tag: string, page: number): Promise<OFFProduct[]> {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search');
  url.searchParams.set('categories_tags', tag);
  url.searchParams.set('languages_tags', 'en:english');
  url.searchParams.set('countries_tags', 'en:united-states');
  url.searchParams.set('fields', 'product_name,nutriments,labels_tags');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort_by', 'unique_scans_n');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'FoodTwin/1.0 (educational project)' },
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json() as OFFResponse;
      return data.products ?? [];
    }

    if (res.status === 503) {
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt + 1);
      await sleep(backoff);
      continue;
    }

    throw new Error(`HTTP ${res.status}`);
  }

  throw new Error('Max retries exceeded');
}

function isValid(p: OFFProduct): boolean {
  if (!p.product_name?.trim()) return false;
  // Reject names with non-ASCII characters (catches Spanish ñ, accented vowels, etc.)
  if (!/^[\x20-\x7E]+$/.test(p.product_name.trim())) return false;
  const n = p.nutriments;
  if (!n) return false;
  return (
    typeof n['energy-kcal_100g'] === 'number' && n['energy-kcal_100g'] >= 0 &&
    typeof n.proteins_100g === 'number'        && n.proteins_100g >= 0 &&
    typeof n.carbohydrates_100g === 'number'   && n.carbohydrates_100g >= 0 &&
    typeof n.fat_100g === 'number'             && n.fat_100g >= 0
  );
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.foodNutrient.deleteMany();
  await prisma.measure.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.foodPortion.deleteMany();
  await prisma.food.deleteMany();

  const seen = new Set<string>();
  let inserted = 0;
  let fdcId = 3_000_000;

  for (const { tag, label, pages } of CATEGORIES) {
    process.stdout.write(`  ${label.padEnd(14)}`);
    let categoryCount = 0;

    for (let page = 1; page <= pages; page++) {
      try {
        const products = await fetchPage(tag, page);

        for (const product of products) {
          if (!isValid(product)) continue;

          const name = product.product_name!.trim();
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const n = product.nutriments!;
          const isVegan = product.labels_tags?.some(
            t => t === 'en:vegan' || t === 'en:vegan-product',
          ) ?? false;

          await prisma.food.create({
            data: {
              fdcId: fdcId++,
              description: name,
              category: label,
              protein:  Math.round((n.proteins_100g ?? 0)        * 10) / 10,
              carbs:    Math.round((n.carbohydrates_100g ?? 0)   * 10) / 10,
              fat:      Math.round((n.fat_100g ?? 0)              * 10) / 10,
              calories: Math.round((n['energy-kcal_100g'] ?? 0)  * 10) / 10,
              isVegan,
              portions: {
                create: [{
                  sequenceNumber: 1,
                  amount: 100,
                  portionDescription: 'g',
                  gramWeight: 100,
                }],
              },
            },
          });

          inserted++;
          categoryCount++;
        }

        await sleep(BASE_DELAY_MS);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`\n    ⚠  page ${page} failed: ${msg}\n  ${label.padEnd(14)}`);
      }
    }

    console.log(`${categoryCount} foods`);
  }

  console.log(`\nDone — ${inserted} foods imported from Open Food Facts.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

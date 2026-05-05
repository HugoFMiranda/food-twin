import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { getAIFoodData, isAISearchAvailable } from "food-twin/server/ai";

const FilterSchema = z.object({
  minProteinRatio: z.number().min(0).max(1).optional(),
  veganOnly: z.boolean().optional(),
  maxCalories: z.number().min(0).optional(),
});

const CreateFoodSchema = z.object({
  description: z.string().min(3, "Food name must be at least 3 characters").max(200),
  protein: z.number().min(0).max(10000).nullable(),
  carbs: z.number().min(0).max(10000).nullable(),
  fat: z.number().min(0).max(10000).nullable(),
  calories: z.number().min(0).max(10000).nullable(),
  isVegan: z.boolean().default(false),
  portions: z.array(z.object({
    amount: z.number().min(0).max(10000).nullable(),
    portionDescription: z.string().max(200).nullable(),
    gramWeight: z.number().min(0).max(10000).nullable(),
  })).max(20).optional(),
});

export const foodRouter = createTRPCRouter({
  getSimilarFoods: publicProcedure
    .input(z.object({
      foodName: z.string().min(1).max(200),
      filters: FilterSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Search timed out. Please try again.")), 10000);
      });

      try {
        const result = await Promise.race([
          (async () => {
            const referenceFood = await ctx.db.food.findFirst({
              where: { description: { contains: input.foodName } },
              include: { portions: true },
            });

            if (!referenceFood) {
              return { referenceFood: null, similarFoods: [] };
            }

            if (
              referenceFood.calories === null &&
              referenceFood.protein === null &&
              referenceFood.carbs === null &&
              referenceFood.fat === null
            ) {
              throw new Error(`Nutritional data not available for "${input.foodName}"`);
            }

            const refCalories = referenceFood.calories ?? 0;
            const refProtein = referenceFood.protein ?? 0;
            const refCarbs = referenceFood.carbs ?? 0;
            const refFat = referenceFood.fat ?? 0;

            const calorieBuffer = Math.max(refCalories * 2, 200);

            const baseWhere = {
              id: { not: referenceFood.id },
              OR: [
                { calories: { not: null } },
                { protein: { not: null } },
                { carbs: { not: null } },
                { fat: { not: null } },
              ],
              ...(input.filters?.veganOnly ? { isVegan: true } : {}),
            };

            // Prefer calorie-range candidates for better similarity matches
            let foods = await ctx.db.food.findMany({
              where: {
                ...baseWhere,
                calories: {
                  gte: Math.max(0, refCalories - calorieBuffer),
                  lte: refCalories + calorieBuffer,
                },
              },
              include: { portions: true },
              take: 500,
            });

            // Fall back to full pool if not enough candidates
            if (foods.length < 20) {
              foods = await ctx.db.food.findMany({
                where: baseWhere,
                include: { portions: true },
                take: 500,
              });
            }

            const results = foods.map(food => {
              const foodCalories = food.calories ?? 0;
              const foodProtein = food.protein ?? 0;
              const foodCarbs = food.carbs ?? 0;
              const foodFat = food.fat ?? 0;

              const similarity = Math.sqrt(
                Math.pow((foodCalories - refCalories) / 2000, 2) +
                Math.pow((foodProtein - refProtein) / 50, 2) +
                Math.pow((foodCarbs - refCarbs) / 300, 2) +
                Math.pow((foodFat - refFat) / 65, 2),
              );

              const proteinRatio = foodCalories > 0 ? (foodProtein * 4) / foodCalories : 0;

              return { ...food, similarity, proteinRatio };
            });

            const filteredResults = results
              .filter(food => {
                if (
                  input.filters?.minProteinRatio !== undefined &&
                  food.proteinRatio < input.filters.minProteinRatio
                ) {
                  return false;
                }
                if (
                  input.filters?.maxCalories !== undefined &&
                  (food.calories ?? 0) > input.filters.maxCalories
                ) {
                  return false;
                }
                return true;
              })
              .sort((a, b) => a.similarity - b.similarity)
              .slice(0, 10);

            const mapPortions = (portions: typeof referenceFood.portions) =>
              portions.map(p => ({
                amount: p.amount,
                portionDescription: p.portionDescription,
                gramWeight: p.gramWeight,
              }));

            return {
              referenceFood: {
                ...referenceFood,
                portions: mapPortions(referenceFood.portions),
              },
              similarFoods: filteredResults.map(food => ({
                ...food,
                portions: mapPortions(food.portions),
              })),
            };
          })(),
          timeout,
        ]);

        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        if (error instanceof Error) {
          throw new Error(`Error searching for similar foods: ${error.message}`);
        }
        throw new Error("An unexpected error occurred while searching for similar foods.");
      }
    }),

  getFoodSuggestions: publicProcedure
    .input(z.object({ searchTerm: z.string().max(200) }))
    .query(async ({ ctx, input }) => {
      const trimmed = input.searchTerm.trim();
      if (!trimmed) return [];

      const foods = await ctx.db.food.findMany({
        where: { description: { contains: trimmed } },
        take: 10,
        select: { description: true },
      });

      return foods.map(food => food.description);
    }),

  getAISearchAvailable: publicProcedure
    .query(() => isAISearchAvailable()),

  getAISimilarFoods: publicProcedure
    .input(z.object({ foodName: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const data = await getAIFoodData(input.foodName);

      const ref = data.referenceFood;
      const refCalories = ref.calories;
      const refProtein = ref.protein;
      const refCarbs = ref.carbs;
      const refFat = ref.fat;

      const candidates = data.candidates.map((food, index) => {
        const similarity = Math.sqrt(
          Math.pow((food.calories - refCalories) / 2000, 2) +
          Math.pow((food.protein - refProtein) / 50, 2) +
          Math.pow((food.carbs - refCarbs) / 300, 2) +
          Math.pow((food.fat - refFat) / 65, 2),
        );
        const proteinRatio = food.calories > 0 ? (food.protein * 4) / food.calories : 0;
        return {
          id: `ai-${index}`,
          description: food.description,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          isVegan: food.isVegan,
          isUserCreated: false,
          portions: [] as { amount: number | null; portionDescription: string | null; gramWeight: number | null }[],
          similarity,
          proteinRatio,
        };
      });

      const similarFoods = candidates
        .sort((a, b) => a.similarity - b.similarity)
        .slice(0, 10);

      return {
        referenceFood: {
          description: ref.description,
          calories: ref.calories,
          protein: ref.protein,
          carbs: ref.carbs,
          fat: ref.fat,
          isVegan: ref.isVegan,
          isUserCreated: false,
          portions: [] as { amount: number | null; portionDescription: string | null; gramWeight: number | null }[],
        },
        similarFoods,
      };
    }),

  createFood: publicProcedure
    .input(CreateFoodSchema)
    .mutation(async ({ ctx, input }) => {
      // Timestamp + random offset avoids the sequential read-then-write race
      const newFdcId = Date.now() * 10 + Math.floor(Math.random() * 10);

      return ctx.db.food.create({
        data: {
          fdcId: newFdcId,
          description: input.description,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          calories: input.calories,
          isVegan: input.isVegan,
          isUserCreated: true,
          portions: {
            create:
              input.portions?.map((portion, index) => ({
                sequenceNumber: index + 1,
                amount: portion.amount,
                portionDescription: portion.portionDescription,
                gramWeight: portion.gramWeight,
              })) ?? [],
          },
        },
        include: { portions: true },
      });
    }),
});

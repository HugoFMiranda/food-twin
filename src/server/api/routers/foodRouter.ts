import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

// Filter schema for type safety
const FilterSchema = z.object({
  minProteinRatio: z.number().min(0).max(1).optional(),
  veganOnly: z.boolean().optional(),
  maxCalories: z.number().min(0).optional(),
});

// Helper function to calculate Euclidean distance
function calculateSimilarity(food1: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}, food2: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): number {
  // Normalize values to prevent calories from dominating
  const normalizedDiff = {
    calories: (food1.calories - food2.calories) / 2000, // Assuming 2000 cal daily value
    protein: (food1.protein - food2.protein) / 50,
    carbs: (food1.carbs - food2.carbs) / 300,
    fat: (food1.fat - food2.fat) / 65,
  };

  return Math.sqrt(
    Math.pow(normalizedDiff.calories, 2) +
    Math.pow(normalizedDiff.protein, 2) +
    Math.pow(normalizedDiff.carbs, 2) +
    Math.pow(normalizedDiff.fat, 2)
  );
}

export const foodRouter = createTRPCRouter({
  getSimilarFoods: publicProcedure
    .input(z.object({
      foodName: z.string(),
      filters: FilterSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const referenceFood = await ctx.db.food.findFirst({
        where: { description: { contains: input.foodName.toLowerCase() } },
      });

      if (!referenceFood) {
        throw new Error("Food not found in database");
      }

      const foods = await ctx.db.food.findMany({
        where: {
          id: { not: referenceFood.id },
        },
      });

      const results = foods.map(food => ({
        ...food,
        similarity: calculateSimilarity({
          calories: food.calories ?? 0,
          protein: food.protein ?? 0,
          carbs: food.carbs ?? 0,
          fat: food.fat ?? 0,
        }, {
          calories: referenceFood.calories ?? 0,
          protein: referenceFood.protein ?? 0,
          carbs: referenceFood.carbs ?? 0,
          fat: referenceFood.fat ?? 0,
        }),
        proteinRatio: (food.protein ?? 0) / (food.calories ?? 1) * 4,
      }));

      const filteredResults = results
        .filter(food =>
          (!input.filters?.minProteinRatio || food.proteinRatio >= input.filters.minProteinRatio) &&
          (!input.filters?.maxCalories || (food.calories ?? 0) <= input.filters.maxCalories)
        )
        .sort((a, b) => a.similarity - b.similarity)
        .slice(0, 10);

      return {
        referenceFood,
        similarFoods: filteredResults,
      };
    }),

  getFoodSuggestions: publicProcedure
    .input(z.object({ searchTerm: z.string() }))
    .query(async ({ ctx, input }) => {
      const foods = await ctx.db.food.findMany({
        where: {
          description: {
            contains: input.searchTerm.toLowerCase(),
          },
        },
        take: 10,
        select: {
          description: true,
        },
      });

      return foods.map(food => food.description);
    }),
}); 
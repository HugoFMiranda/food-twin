import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

// Filter schema for type safety
const FilterSchema = z.object({
  minProteinRatio: z.number().min(0).max(1).optional(),
  veganOnly: z.boolean().optional(),
  maxCalories: z.number().min(0).optional(),
});

// Schema for creating a new food
const CreateFoodSchema = z.object({
  description: z.string().min(3, "Food name must be at least 3 characters"),
  protein: z.number().min(0).nullable(),
  carbs: z.number().min(0).nullable(),
  fat: z.number().min(0).nullable(),
  calories: z.number().min(0).nullable(),
  isVegan: z.boolean().default(false),
  portions: z.array(z.object({
    amount: z.number().nullable(),
    portionDescription: z.string().nullable(),
    gramWeight: z.number().nullable(),
  })).optional(),
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
      // Add a timeout to prevent long-running queries
      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Search timed out. Please try again."));
        }, 10000); // 10 second timeout
      });

      try {
        // Use Promise.race to implement a timeout
        const result = await Promise.race([
          (async () => {
            const referenceFood = await ctx.db.food.findFirst({
              where: { 
                description: { 
                  contains: input.foodName.toLowerCase(),
                } 
              },
              include: {
                portions: true
              }
            });

            if (!referenceFood) {
              // Return empty result instead of throwing an error
              return {
                referenceFood: null,
                similarFoods: []
              };
            }

            if (referenceFood.calories === null && referenceFood.protein === null &&
              referenceFood.carbs === null && referenceFood.fat === null) {
              throw new Error(`Nutritional data not available for "${input.foodName}"`);
            }

            // Limit the number of foods to compare for better performance
            const foods = await ctx.db.food.findMany({
              where: {
                id: { not: referenceFood.id },
                // Add index to improve query performance
                AND: [
                  { description: { not: { equals: referenceFood.description } } },
                  {
                    OR: [
                      { calories: { not: null } },
                      { protein: { not: null } },
                      { carbs: { not: null } },
                      { fat: { not: null } }
                    ]
                  }
                ]
              },
              include: {
                portions: true
              },
              // Reduce the number of foods to compare for better performance
              take: 100 // Further reduce to 100 for faster results
            });

            console.log(`Found ${foods.length} foods to compare with "${referenceFood.description}"`);

            // Pre-calculate reference food values to avoid repeated calculations
            const refCalories = referenceFood.calories ?? 0;
            const refProtein = referenceFood.protein ?? 0;
            const refCarbs = referenceFood.carbs ?? 0;
            const refFat = referenceFood.fat ?? 0;

            // Define the result type to fix type errors
            type FoodResult = typeof foods[0] & {
              similarity: number;
              proteinRatio: number;
            };

            // Process foods in batches to avoid blocking the event loop
            const batchSize = 50;
            let results: FoodResult[] = [];

            for (let i = 0; i < foods.length; i += batchSize) {
              const batch = foods.slice(i, i + batchSize);
              
              const batchResults = batch.map(food => {
                const foodCalories = food.calories ?? 0;
                const foodProtein = food.protein ?? 0;
                const foodCarbs = food.carbs ?? 0;
                const foodFat = food.fat ?? 0;
                
                // Calculate similarity directly instead of using the helper function
                // to avoid function call overhead
                const normalizedDiff = {
                  calories: (foodCalories - refCalories) / 2000,
                  protein: (foodProtein - refProtein) / 50,
                  carbs: (foodCarbs - refCarbs) / 300,
                  fat: (foodFat - refFat) / 65,
                };
                
                const similarity = Math.sqrt(
                  Math.pow(normalizedDiff.calories, 2) +
                  Math.pow(normalizedDiff.protein, 2) +
                  Math.pow(normalizedDiff.carbs, 2) +
                  Math.pow(normalizedDiff.fat, 2)
                );
                
                return {
                  ...food,
                  similarity,
                  proteinRatio: foodProtein / (foodCalories || 1) * 4,
                };
              });
              
              results = results.concat(batchResults as FoodResult[]);
            }

            const filteredResults = results
              .filter(food => {
                if (input.filters?.minProteinRatio &&
                  food.proteinRatio < input.filters.minProteinRatio) {
                  return false;
                }

                if (input.filters?.maxCalories &&
                  (food.calories ?? 0) > input.filters.maxCalories) {
                  return false;
                }
                
                if (input.filters?.veganOnly) {
                  // For now, we'll just return true to avoid filtering
                  // This will be fixed when we add the isVegan field to the Food model
                  // return false;
                }

                return true;
              })
              .sort((a, b) => a.similarity - b.similarity)
              .slice(0, 10);

            return {
              referenceFood: {
                ...referenceFood,
                portions: referenceFood.portions.map(p => ({
                  amount: p.amount,
                  portionDescription: p.portionDescription,
                  gramWeight: p.gramWeight
                }))
              },
              similarFoods: filteredResults.map(food => ({
                ...food,
                portions: food.portions.map(p => ({
                  amount: p.amount,
                  portionDescription: p.portionDescription,
                  gramWeight: p.gramWeight
                }))
              }))
            };
          })(),
          timeout
        ]);

        return result;
      } catch (error) {
        console.error("Error in getSimilarFoods:", error);
        if (error instanceof Error) {
          throw new Error(`Error searching for similar foods: ${error.message}`);
        }
        throw new Error("An unexpected error occurred while searching for similar foods.");
      }
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

  createFood: publicProcedure
    .input(CreateFoodSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Generate a unique FDC ID for user-created foods (using a high number to avoid conflicts)
        const highestFdcId = await ctx.db.food.findFirst({
          orderBy: {
            fdcId: 'desc'
          },
          select: {
            fdcId: true
          }
        });

        const newFdcId = (highestFdcId?.fdcId || 9000000) + 1;

        // Create the new food
        const newFood = await ctx.db.food.create({
          data: {
            fdcId: newFdcId,
            description: input.description.toLowerCase(),
            protein: input.protein,
            carbs: input.carbs,
            fat: input.fat,
            calories: input.calories,
            isUserCreated: true,
            portions: {
              create: input.portions?.map((portion, index) => ({
                sequenceNumber: index + 1,
                amount: portion.amount,
                portionDescription: portion.portionDescription,
                gramWeight: portion.gramWeight
              })) || []
            }
          },
          include: {
            portions: true
          }
        });

        // Add isUserCreated flag to the returned object for the UI
        return {
          ...newFood,
          isUserCreated: true
        };
      } catch (error) {
        console.error("Error creating food:", error);
        throw new Error("Failed to create food. Please try again.");
      }
    }),
}); 
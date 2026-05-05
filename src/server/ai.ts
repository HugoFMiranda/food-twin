import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "food-twin/env";

const FoodMacrosSchema = z.object({
  description: z.string(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  isVegan: z.boolean().default(false),
});

const AIFoodResponseSchema = z.object({
  referenceFood: FoodMacrosSchema,
  candidates: z.array(FoodMacrosSchema).min(1).max(30),
});

export type AIFoodMacros = z.infer<typeof FoodMacrosSchema>;

export function isAISearchAvailable(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

export async function getAIFoodData(foodName: string) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI search requires ANTHROPIC_API_KEY to be configured.");
  }

  const sanitizedName = foodName.replace(/["\\\n\r]/g, " ").trim().slice(0, 200);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a nutritional database. For the food "${sanitizedName}", return its macros and 25 nutritionally diverse alternatives.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "referenceFood": {
    "description": "exact common name",
    "calories": 165,
    "protein": 31.0,
    "carbs": 0.0,
    "fat": 3.6,
    "isVegan": false
  },
  "candidates": [
    {
      "description": "food name",
      "calories": 0,
      "protein": 0.0,
      "carbs": 0.0,
      "fat": 0.0,
      "isVegan": false
    }
  ]
}

All values are per 100g. Include a mix of nutritionally similar AND dissimilar foods to enable meaningful comparison.`,
      },
    ],
  });

  const content = message.content[0];
  if (content?.type !== "text") {
    throw new Error("Unexpected response format from AI.");
  }

  const jsonMatch = /\{[\s\S]*\}/.exec(content.text);
  if (!jsonMatch?.[0]) {
    throw new Error("Could not parse nutritional data from AI response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Invalid JSON in AI response.");
  }

  const result = AIFoodResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("AI returned unexpected data structure.");
  }

  return result.data;
}

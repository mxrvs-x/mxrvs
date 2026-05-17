import Constants from "expo-constants";

export type NutritionAnalysis = {
  food_summary: {
    name: string;
    estimated_serving_size: string;
    servings: number;
  };
  macro_breakdown: {
    calories: number | null;
    protein_g: number | null;
    carbohydrates_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
  ingredient_quality_review: {
    whole_food_ingredients: string[];
    processed_ingredients: string[];
    potential_health_concerns: string[];
    allergen_warnings: string[];
  };
  confidence_level: "High" | "Medium" | "Low";
  confidence_explanation: string;
  missing_data_assumptions: string[];
  sources_used: string[];
  can_add_to_custom_food: boolean;
};

export type GeminiNutritionResponse = {
  answer: string;
  analysis: NutritionAnalysis | null;
};

const MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
You are a nutrition analysis assistant specializing in food ingredient macro estimation and recipe nutrition breakdowns.

Your job is to analyze ingredient lists and recipes, estimate calories, protein, carbohydrates, fats, fiber, sodium, and sugar, and detect ultra-processed ingredients, allergens, artificial additives, hidden sugars, and hidden oils.

Approved food composition sources, in priority order:
1. Brand-specific nutrition labels or official brand product nutrition data when a brand is provided.
2. Nutrition Coordinating Center Food & Nutrient Database (NCCDB).
3. United States Department of Agriculture National Nutrient Database for Standard Reference (USDA SR28).
4. Canadian Nutrient File (CNF 2015).
5. Irish Food Composition Database (IFCDB).
6. Dutch Food Composition Database (NEVO).
7. McCance and Widdowson's The Composition of Foods Integrated Database (CoFID).
8. Australian Food Composition Database (NUTTAB).
9. USDA FoodData Central.
10. FDA Nutrition Labeling Guidance.
11. Nutrition.gov.

Rules:
- Use Google Search grounding when brand-specific nutrition, restaurant nutrition, product labels, or database-specific entries are needed to answer accurately.
- When the user provides a brand, product line, restaurant, or package name, search and reason using that brand plus the food name first. Prefer exact brand/product nutrition data over generic food composition entries.
- If an exact branded food cannot be matched, use the closest generic entry from the approved food composition sources and clearly state the brand-match uncertainty in confidence_explanation and missing_data_assumptions.
- Include the specific database or brand label used in sources_used. Do not list a source unless it materially informed the estimate.
- Use grams and standard serving sizes whenever available.
- If exact quantities are missing, ask for exact measurements before calculating.
- Never invent nutrition data. Clearly state uncertainty if data is incomplete.
- Separate estimated values, exact label values, and missing data assumptions.
- Calories are whole numbers. Macros are rounded to 0.1g. Sodium is whole mg.
- Flag added sugars, hydrogenated oils/trans fats, artificial sweeteners, high sodium ingredients, preservatives, artificial coloring, and common allergens: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame.
- Do not provide medical diagnoses, unsafe diets, or extreme calorie restriction.
- Prefer evidence-based nutrition interpretation over internet trends.
- If values are good enough to save as a custom food, set can_add_to_custom_food to true. If measurements are missing, set it to false.

Always write the answer with this structure:
Food Summary
Macro Breakdown
Ingredient Quality Review
Confidence Level
Sources Used
`.trim();

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    analysis: {
      type: "object",
      nullable: true,
      properties: {
        food_summary: {
          type: "object",
          properties: {
            name: { type: "string" },
            estimated_serving_size: { type: "string" },
            servings: { type: "number" },
          },
          required: ["name", "estimated_serving_size", "servings"],
        },
        macro_breakdown: {
          type: "object",
          properties: {
            calories: { type: "number", nullable: true },
            protein_g: { type: "number", nullable: true },
            carbohydrates_g: { type: "number", nullable: true },
            fat_g: { type: "number", nullable: true },
            fiber_g: { type: "number", nullable: true },
            sugar_g: { type: "number", nullable: true },
            sodium_mg: { type: "number", nullable: true },
          },
          required: [
            "calories",
            "protein_g",
            "carbohydrates_g",
            "fat_g",
            "fiber_g",
            "sugar_g",
            "sodium_mg",
          ],
        },
        ingredient_quality_review: {
          type: "object",
          properties: {
            whole_food_ingredients: { type: "array", items: { type: "string" } },
            processed_ingredients: { type: "array", items: { type: "string" } },
            potential_health_concerns: { type: "array", items: { type: "string" } },
            allergen_warnings: { type: "array", items: { type: "string" } },
          },
          required: [
            "whole_food_ingredients",
            "processed_ingredients",
            "potential_health_concerns",
            "allergen_warnings",
          ],
        },
        confidence_level: {
          type: "string",
          enum: ["High", "Medium", "Low"],
        },
        confidence_explanation: { type: "string" },
        missing_data_assumptions: { type: "array", items: { type: "string" } },
        sources_used: { type: "array", items: { type: "string" } },
        can_add_to_custom_food: { type: "boolean" },
      },
      required: [
        "food_summary",
        "macro_breakdown",
        "ingredient_quality_review",
        "confidence_level",
        "confidence_explanation",
        "missing_data_assumptions",
        "sources_used",
        "can_add_to_custom_food",
      ],
    },
  },
  required: ["answer", "analysis"],
};

function getGeminiApiKey() {
  const extra = Constants.expoConfig?.extra ?? {};
  const manifestExtra = Constants.manifest2?.extra?.expoClient?.extra ?? {};

  return (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    extra.geminiApiKey ||
    extra.EXPO_PUBLIC_GEMINI_API_KEY ||
    extra.GEMINI_API_KEY ||
    manifestExtra.geminiApiKey ||
    manifestExtra.EXPO_PUBLIC_GEMINI_API_KEY ||
    manifestExtra.GEMINI_API_KEY
  );
}

function textFromGeminiResponse(json: any) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: any) => part.text ?? "").join("").trim();
}

export async function askGeminiNutrition(
  prompt: string,
): Promise<GeminiNutritionResponse> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env or expose GEMINI_API_KEY through app.config.js.",
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error?.message ?? "Gemini could not analyze this recipe.",
    );
  }

  const text = textFromGeminiResponse(json);

  if (!text) {
    throw new Error("Gemini returned an empty nutrition response.");
  }

  return JSON.parse(text) as GeminiNutritionResponse;
}

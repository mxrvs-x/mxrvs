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

export type NutritionLabelScanResult = {
  serving_name: string | null;
  serving_size: number | null;
  serving_unit: "g" | "ml" | "serving" | "piece" | "cup" | "tbsp" | "tsp" | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  magnesium_mg: number | null;
  zinc_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_c_mg: number | null;
  vitamin_d_mcg: number | null;
  vitamin_b12_mcg: number | null;
};

const MODEL = "gemini-2.5-flash-lite";

const geminiUrl = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;

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

const JSON_FORMAT_INSTRUCTION = `
Convert the grounded nutrition response into the required app JSON shape.

Rules:
- Preserve the nutrition facts, assumptions, confidence, and sources from the grounded response.
- Do not add new sourced claims that are not in the grounded response.
- If the grounded response asks the user for measurements or says there is not enough data to calculate macros, set analysis to null.
- The answer field must be a readable summary using the same section structure requested by the nutrition assistant.
- Return only JSON that matches the schema.
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

const NUTRITION_LABEL_SCAN_SCHEMA = {
  type: "object",
  properties: {
    serving_name: { type: "string", nullable: true },
    serving_size: { type: "number", nullable: true },
    serving_unit: {
      type: "string",
      enum: ["g", "ml", "serving", "piece", "cup", "tbsp", "tsp"],
      nullable: true,
    },
    calories: { type: "number", nullable: true },
    protein_g: { type: "number", nullable: true },
    carbs_g: { type: "number", nullable: true },
    fat_g: { type: "number", nullable: true },
    fiber_g: { type: "number", nullable: true },
    sugar_g: { type: "number", nullable: true },
    sodium_mg: { type: "number", nullable: true },
    cholesterol_mg: { type: "number", nullable: true },
    potassium_mg: { type: "number", nullable: true },
    calcium_mg: { type: "number", nullable: true },
    iron_mg: { type: "number", nullable: true },
    magnesium_mg: { type: "number", nullable: true },
    zinc_mg: { type: "number", nullable: true },
    vitamin_a_mcg: { type: "number", nullable: true },
    vitamin_c_mg: { type: "number", nullable: true },
    vitamin_d_mcg: { type: "number", nullable: true },
    vitamin_b12_mcg: { type: "number", nullable: true },
  },
  required: [
    "serving_name",
    "serving_size",
    "serving_unit",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "cholesterol_mg",
    "potassium_mg",
    "calcium_mg",
    "iron_mg",
    "magnesium_mg",
    "zinc_mg",
    "vitamin_a_mcg",
    "vitamin_c_mg",
    "vitamin_d_mcg",
    "vitamin_b12_mcg",
  ],
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

async function generateGeminiContent(apiKey: string, body: object) {
  const response = await fetch(geminiUrl(apiKey), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (response.ok) {
      throw new Error("Gemini returned a response that could not be decoded.");
    }
  }

  if (!response.ok) {
    throw new Error(
      json?.error?.message || text || "Gemini could not analyze this recipe.",
    );
  }

  return json;
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

  const groundedJson = await generateGeminiContent(apiKey, {
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
    },
  });

  const groundedText = textFromGeminiResponse(groundedJson);

  if (!groundedText) {
    throw new Error("Gemini returned an empty nutrition response.");
  }

  const structuredJson = await generateGeminiContent(apiKey, {
    systemInstruction: {
      parts: [{ text: JSON_FORMAT_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Original user request:",
              prompt,
              "",
              "Grounded nutrition response:",
              groundedText,
            ].join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const structuredText = textFromGeminiResponse(structuredJson);

  if (!structuredText) {
    throw new Error("Gemini returned an empty structured nutrition response.");
  }

  return JSON.parse(structuredText) as GeminiNutritionResponse;
}

export async function scanNutritionLabelImage({
  base64,
  mimeType = "image/jpeg",
}: {
  base64: string;
  mimeType?: string;
}): Promise<NutritionLabelScanResult> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env or expose GEMINI_API_KEY through app.config.js.",
    );
  }

  const json = await generateGeminiContent(apiKey, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Read this nutrition facts label image and return only the nutrition facts that are visible.",
              "Do not estimate missing values.",
              "Use the nutrition label's serving size as serving_name, serving_size, and serving_unit.",
              "For serving_unit, choose one of: g, ml, serving, piece, cup, tbsp, tsp.",
              "Use grams for macros, milligrams for sodium/cholesterol/minerals, and micrograms for vitamins A/D/B12 when the label shows them.",
              "If a value is unreadable or missing, return null.",
            ].join("\n"),
          },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: NUTRITION_LABEL_SCAN_SCHEMA,
    },
  });

  const text = textFromGeminiResponse(json);

  if (!text) {
    throw new Error("Gemini could not read the nutrition label.");
  }

  return JSON.parse(text) as NutritionLabelScanResult;
}

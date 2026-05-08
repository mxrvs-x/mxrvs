import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type ResultType = "local" | "usda";
type FoodSource = "custom" | "usda_fdc";
type ServingMode = "serving" | "gram";

type FoodServing = {
  mode: ServingMode;
  name: string;
  amount: number;
  unit: string;
  gram_weight: number;
  is_default: boolean;
};

type NormalizedFood = {
  foodId?: string;
  source: FoodSource;
  external_id?: string | null;
  name: string;
  brand?: string | null;

  serving_size: number;
  serving_unit: string;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;

  potassium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  zinc_mg: number;

  vitamin_a_mcg: number;
  vitamin_c_mg: number;
  vitamin_d_mcg: number;
  vitamin_b12_mcg: number;

  raw_data?: any;
};

const USDA_DETAIL_URL = "https://api.nal.usda.gov/fdc/v1/food";

function n(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function isUuid(value?: string | null) {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function sourceLabel(source: string) {
  if (source === "usda_fdc") return "USDA";
  return "Custom";
}

function scaled(
  food: NormalizedFood | null,
  key: keyof NormalizedFood,
  grams: number,
) {
  if (!food) return 0;

  const baseGrams = Number(food.serving_size) || 100;
  const value = Number(food[key] ?? 0);

  return value * (grams / baseGrams);
}

function getUsdaNutrient(
  food: any,
  names: string[],
  preferredUnits?: string[],
) {
  const nutrients = food.foodNutrients ?? [];

  const matches = nutrients.filter((item: any) => {
    const nutrientName = String(
      item.nutrient?.name ?? item.nutrientName ?? item.name ?? "",
    ).toLowerCase();

    return names.some((name) => nutrientName.includes(name.toLowerCase()));
  });

  if (matches.length === 0) return 0;

  if (preferredUnits?.length) {
    const preferred = matches.find((item: any) => {
      const unit = String(
        item.nutrient?.unitName ?? item.unitName ?? item.unit ?? "",
      ).toLowerCase();

      return preferredUnits.some((preferredUnit) =>
        unit.includes(preferredUnit.toLowerCase()),
      );
    });

    if (preferred) {
      return Number(
        preferred?.amount ??
          preferred?.value ??
          preferred?.nutrient?.amount ??
          0,
      );
    }
  }

  const first = matches[0];

  return Number(first?.amount ?? first?.value ?? first?.nutrient?.amount ?? 0);
}

function buildServingOptions(food: NormalizedFood | null): FoodServing[] {
  const baseGrams = Number(food?.serving_size) || 100;
  const unit = food?.serving_unit || "g";

  return [
    {
      mode: "serving",
      name: `${baseGrams}${unit}`,
      amount: 1,
      unit: "serving",
      gram_weight: baseGrams,
      is_default: true,
    },
    {
      mode: "gram",
      name: "g",
      amount: 1,
      unit: "g",
      gram_weight: 1,
      is_default: false,
    },
  ];
}

function nutritionRow(
  label: string,
  value: number,
  unit: string,
  theme: any,
  decimals = 1,
) {
  const displayValue =
    unit === "kcal" || unit === "mg"
      ? Math.round(n(value))
      : n(value).toFixed(decimals);

  return (
    <View
      key={label}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.textMuted }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {displayValue}
        {unit ? ` ${unit}` : ""}
      </Text>
    </View>
  );
}

export default function SearchFoodDetailScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { payload, resultType, mealType, date } = useLocalSearchParams<{
    payload: string;
    resultType: ResultType;
    mealType: MealType;
    date: string;
  }>();

  const parsedPayload = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(payload ?? "{}"));
    } catch {
      return {};
    }
  }, [payload]);

  const [food, setFood] = useState<NormalizedFood | null>(null);

  const [selectedServing, setSelectedServing] = useState<FoodServing | null>(
    null,
  );

  const [quantity, setQuantity] = useState("1");

  const [servingsOpen, setServingsOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const servingOptions = useMemo(() => buildServingOptions(food), [food]);

  const [alertOpen, setAlertOpen] = useState(false);

  const [alertTitle, setAlertTitle] = useState("");

  const [alertMessage, setAlertMessage] = useState("");

  const scrollRef = useRef<ScrollView>(null);

  const grams = useMemo(() => {
    if (!selectedServing) return 0;

    const qty = n(quantity);

    if (selectedServing.mode === "gram") {
      return qty;
    }

    return selectedServing.gram_weight;
  }, [quantity, selectedServing]);

  useEffect(() => {
    loadFoodDetails();
  }, []);

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  async function findExistingFoodId(
    source: FoodSource,
    externalId?: string | null,
  ) {
    if (!externalId) return null;

    const { data, error } = await supabase
      .from("foods")
      .select("id")
      .eq("source", source)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw error;

    return data?.id ?? null;
  }

  async function loadFoodDetails() {
    setLoading(true);

    try {
      if (resultType === "local") {
        const normalized: NormalizedFood = {
          foodId: isUuid(parsedPayload.id) ? parsedPayload.id : undefined,
          source: parsedPayload.source ?? "custom",

          external_id: parsedPayload.external_id ?? null,

          name: parsedPayload.name,
          brand: parsedPayload.brand ?? null,

          serving_size: n(parsedPayload.serving_size) || 100,

          serving_unit: parsedPayload.serving_unit ?? "g",

          calories: n(parsedPayload.calories),
          protein_g: n(parsedPayload.protein_g),
          carbs_g: n(parsedPayload.carbs_g),
          fat_g: n(parsedPayload.fat_g),

          fiber_g: n(parsedPayload.fiber_g),
          sugar_g: n(parsedPayload.sugar_g),
          sodium_mg: n(parsedPayload.sodium_mg),
          cholesterol_mg: n(parsedPayload.cholesterol_mg),

          potassium_mg: n(parsedPayload.potassium_mg),
          calcium_mg: n(parsedPayload.calcium_mg),
          iron_mg: n(parsedPayload.iron_mg),
          magnesium_mg: n(parsedPayload.magnesium_mg),
          zinc_mg: n(parsedPayload.zinc_mg),

          vitamin_a_mcg: n(parsedPayload.vitamin_a_mcg),
          vitamin_c_mg: n(parsedPayload.vitamin_c_mg),
          vitamin_d_mcg: n(parsedPayload.vitamin_d_mcg),
          vitamin_b12_mcg: n(parsedPayload.vitamin_b12_mcg),

          raw_data: parsedPayload,
        };

        const options = buildServingOptions(normalized);

        setFood(normalized);
        setSelectedServing(options[0]);
        setQuantity("1");

        return;
      }

      if (resultType === "usda") {
        const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

        if (!apiKey) {
          showAlert("Missing API key", "Missing EXPO_PUBLIC_USDA_API_KEY.");

          return;
        }

        const response = await fetch(
          `${USDA_DETAIL_URL}/${parsedPayload.fdcId}?api_key=${apiKey}`,
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(json));
        }

        const externalId = String(parsedPayload.fdcId);

        const existingFoodId = await findExistingFoodId("usda_fdc", externalId);

        const normalized: NormalizedFood = {
          foodId: existingFoodId ?? undefined,

          source: "usda_fdc",

          external_id: externalId,

          name: json.description ?? parsedPayload.name,

          brand:
            json.brandOwner ?? json.brandName ?? parsedPayload.brand ?? "USDA",

          serving_size: 100,
          serving_unit: "g",

          calories: getUsdaNutrient(json, ["energy"], ["kcal"]),

          protein_g: getUsdaNutrient(json, ["protein"]),

          carbs_g: getUsdaNutrient(json, [
            "carbohydrate, by difference",
            "carbohydrate",
          ]),

          fat_g: getUsdaNutrient(json, ["total lipid", "total fat", "fat"]),

          fiber_g: getUsdaNutrient(json, ["fiber"]),

          sugar_g: getUsdaNutrient(json, [
            "total sugars",
            "sugars, total",
            "sugars",
          ]),

          sodium_mg: getUsdaNutrient(json, ["sodium"]),

          cholesterol_mg: getUsdaNutrient(json, ["cholesterol"]),

          potassium_mg: getUsdaNutrient(json, ["potassium"]),
          calcium_mg: getUsdaNutrient(json, ["calcium"]),
          iron_mg: getUsdaNutrient(json, ["iron"]),
          magnesium_mg: getUsdaNutrient(json, ["magnesium"]),
          zinc_mg: getUsdaNutrient(json, ["zinc"]),

          vitamin_a_mcg: getUsdaNutrient(json, ["vitamin a, rae", "vitamin a"]),
          vitamin_c_mg: getUsdaNutrient(json, ["vitamin c"]),
          vitamin_d_mcg: getUsdaNutrient(json, [
            "vitamin d",
            "vitamin d (d2 + d3)",
          ]),
          vitamin_b12_mcg: getUsdaNutrient(json, [
            "vitamin b-12",
            "vitamin b12",
          ]),

          raw_data: json,
        };

        const options = buildServingOptions(normalized);

        setFood(normalized);
        setSelectedServing(options[0]);
        setQuantity("1");
      }
    } catch (error: any) {
      showAlert("Error", error?.message ?? "Could not load food details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFood() {
    if (!food || !selectedServing) return;

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        showAlert("Error", "User not authenticated.");

        return;
      }

      const logDate = String(date);

      if (!logDate || logDate === "undefined") {
        showAlert("Missing date", "Please select a date again.");

        return;
      }

      const totalGrams =
        selectedServing.mode === "serving"
          ? selectedServing.gram_weight
          : n(quantity);

      if (totalGrams <= 0) {
        showAlert("Invalid serving", "Enter valid grams.");

        return;
      }

      const foodId = isUuid(food.foodId) ? food.foodId : null;

      const calories = scaled(food, "calories", totalGrams);

      const protein = scaled(food, "protein_g", totalGrams);

      const carbs = scaled(food, "carbs_g", totalGrams);

      const fat = scaled(food, "fat_g", totalGrams);

      const fiber = scaled(food, "fiber_g", totalGrams);

      const sugar = scaled(food, "sugar_g", totalGrams);

      const sodium = scaled(food, "sodium_mg", totalGrams);

      const cholesterol = scaled(food, "cholesterol_mg", totalGrams);

      const { error } = await supabase.from("food_logs").insert({
        user_id: user.id,

        food_id: foodId ?? null,

        food_name: food.name,
        food_brand: food.brand ?? null,
        food_source: food.source,
        external_id: food.external_id ?? null,

        date: logDate,

        meal_type: mealType ?? "breakfast",

        quantity: selectedServing.mode === "serving" ? 1 : totalGrams,
        unit: selectedServing.mode === "serving" ? "serving" : "g",

        serving_size: totalGrams,
        serving_unit: "g",

        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,

        fiber_g: fiber,
        sugar_g: sugar,
        sodium_mg: sodium,
        cholesterol_mg: cholesterol,
      });

      if (error) {
        showAlert("Could not log food", error.message);

        return;
      }

      router.dismissAll();

      router.replace("/(tabs)/diary");
    } catch (error: any) {
      showAlert("Error", error?.message ?? "Could not log food.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!food || !selectedServing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 18,
          }}
        >
          Food not found.
        </Text>
      </View>
    );
  }

  const calories = scaled(food, "calories", grams);

  const protein = scaled(food, "protein_g", grams);

  const carbs = scaled(food, "carbs_g", grams);

  const fat = scaled(food, "fat_g", grams);

  const fiber = scaled(food, "fiber_g", grams);
  const sugar = scaled(food, "sugar_g", grams);
  const sodium = scaled(food, "sodium_mg", grams);
  const cholesterol = scaled(food, "cholesterol_mg", grams);

  const potassium = scaled(food, "potassium_mg", grams);
  const calcium = scaled(food, "calcium_mg", grams);
  const iron = scaled(food, "iron_mg", grams);
  const magnesium = scaled(food, "magnesium_mg", grams);
  const zinc = scaled(food, "zinc_mg", grams);

  const vitaminA = scaled(food, "vitamin_a_mcg", grams);
  const vitaminC = scaled(food, "vitamin_c_mg", grams);
  const vitaminD = scaled(food, "vitamin_d_mcg", grams);
  const vitaminB12 = scaled(food, "vitamin_b12_mcg", grams);

  const quantityDisabled = selectedServing.mode === "serving";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "",
          headerBackVisible: false,
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },

          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 46,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={30} color={theme.colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: 18, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,

            borderRadius: 20,
            padding: 18,

            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 24,
              fontWeight: "900",
            }}
          >
            {food.name}
          </Text>

          {food.brand ? (
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 15,
                marginTop: 4,
              }}
            >
              {food.brand}
            </Text>
          ) : null}

          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 13,
              fontWeight: "900",
              marginTop: 10,
            }}
          >
            {sourceLabel(food.source)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,

            borderRadius: 20,
            padding: 18,

            marginTop: 14,

            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 18,
              fontWeight: "900",
              marginBottom: 12,
            }}
          >
            Serving
          </Text>

          <Pressable
            onPress={() => setServingsOpen((value) => !value)}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,

              borderRadius: 14,
              padding: 14,

              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
              }}
            >
              {selectedServing.name}
            </Text>

            <ChevronDown size={22} color={theme.colors.textMuted} />
          </Pressable>

          {servingsOpen ? (
            <View
              style={{
                marginTop: 10,

                borderWidth: 1,
                borderColor: theme.colors.border,

                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {servingOptions.map((serving, index) => (
                <Pressable
                  key={`${serving.name}-${index}`}
                  onPress={() => {
                    setSelectedServing(serving);

                    if (serving.mode === "serving") {
                      setQuantity("1");
                    } else {
                      setQuantity(String(Math.round(food.serving_size || 100)));
                    }

                    setServingsOpen(false);
                  }}
                  style={{
                    padding: 14,

                    borderBottomWidth:
                      index === servingOptions.length - 1 ? 0 : 1,

                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,

                      fontWeight:
                        serving.mode === selectedServing.mode ? "900" : "500",
                    }}
                  >
                    {serving.mode === "serving"
                      ? `${serving.name} · 1 serving`
                      : "g · custom grams"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {quantityDisabled ? (
            <View
              style={{
                marginTop: 18,
              }}
            >
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                }}
              >
                1 serving selected = {Math.round(selectedServing.gram_weight)}g
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: "900",

                  marginTop: 18,
                  marginBottom: 10,
                }}
              >
                Grams
              </Text>

              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 14,
                  padding: 14,
                  color: theme.colors.text,
                  fontSize: 18,
                }}
              />
            </>
          )}

          <Text
            style={{
              color: theme.colors.textMuted,

              marginTop: 8,
              fontSize: 14,
            }}
          >
            Total weight: {grams.toFixed(0)}g · Base: per {food.serving_size}
            {food.serving_unit}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,

            borderRadius: 20,
            padding: 18,

            marginTop: 14,

            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 18,
              fontWeight: "900",
              marginBottom: 14,
            }}
          >
            Nutrition
          </Text>

          {nutritionRow("Calories", calories, "kcal", theme)}
          {nutritionRow("Protein", protein, "g", theme)}
          {nutritionRow("Carbs", carbs, "g", theme)}
          {nutritionRow("Fat", fat, "g", theme)}
          {nutritionRow("Fiber", fiber, "g", theme)}
          {nutritionRow("Sugar", sugar, "g", theme)}
          {nutritionRow("Sodium", sodium, "mg", theme)}
          {nutritionRow("Cholesterol", cholesterol, "mg", theme)}
          {nutritionRow("Potassium", potassium, "mg", theme)}
          {nutritionRow("Calcium", calcium, "mg", theme)}
          {nutritionRow("Iron", iron, "mg", theme)}
          {nutritionRow("Magnesium", magnesium, "mg", theme)}
          {nutritionRow("Zinc", zinc, "mg", theme)}
          {nutritionRow("Vitamin A", vitaminA, "mcg", theme)}
          {nutritionRow("Vitamin C", vitaminC, "mg", theme)}
          {nutritionRow("Vitamin D", vitaminD, "mcg", theme)}
          {nutritionRow("Vitamin B12", vitaminB12, "mcg", theme)}
        </View>

        <Pressable
          onPress={handleAddFood}
          disabled={saving}
          style={{
            height: 56,
            borderRadius: 18,

            backgroundColor: saving
              ? theme.colors.textFaint
              : theme.colors.primary,

            alignItems: "center",
            justifyContent: "center",

            marginTop: 18,
          }}
        >
          <Text
            style={{
              color: theme.colors.surface,

              fontSize: 18,
              fontWeight: "900",
            }}
          >
            {saving ? "Adding..." : `Add to ${mealType ?? "breakfast"}`}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

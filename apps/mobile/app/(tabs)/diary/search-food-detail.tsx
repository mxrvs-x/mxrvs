import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import {
  getFatSecretDefaultServing,
  getFatSecretFood,
  getFatSecretServings,
  type FatSecretFood,
  type FatSecretServing,
} from "@/lib/fatsecret";
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
type ResultType = "local" | "fatsecret";
type FoodSource = "custom" | "fatsecret";
type ServingMode = "serving" | "custom";
type MetricUnit = "g" | "ml";
type NutrientKey =
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "fiber_g"
  | "sugar_g"
  | "sodium_mg"
  | "cholesterol_mg"
  | "potassium_mg"
  | "calcium_mg"
  | "iron_mg"
  | "magnesium_mg"
  | "zinc_mg"
  | "vitamin_a_mcg"
  | "vitamin_c_mg"
  | "vitamin_d_mcg"
  | "vitamin_b12_mcg";

type FoodServing = {
  mode: ServingMode;
  name: string;
  amount: number;
  unit: string;
  metric_amount: number;
  metric_unit: string;
  is_default: boolean;
  nutrients?: Partial<Record<NutrientKey, number>>;
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
  if (source === "fatsecret") return "FatSecret";
  return "Custom";
}

function normalizeMetricUnit(unit?: string | null) {
  const normalized = String(unit ?? "").trim().toLowerCase();

  if (normalized === "g" || normalized === "gram" || normalized === "grams") {
    return "g" as const;
  }

  if (
    normalized === "ml" ||
    normalized === "milliliter" ||
    normalized === "milliliters"
  ) {
    return "ml" as const;
  }

  return null;
}

function servingNutrients(serving?: FatSecretServing) {
  if (!serving) return undefined;

  return {
    calories: n(serving.calories),
    protein_g: n(serving.protein),
    carbs_g: n(serving.carbohydrate),
    fat_g: n(serving.fat),
    fiber_g: n(serving.fiber),
    sugar_g: n(serving.sugar),
    sodium_mg: n(serving.sodium),
    cholesterol_mg: n(serving.cholesterol),
    potassium_mg: n(serving.potassium),
    calcium_mg: n(serving.calcium),
    iron_mg: n(serving.iron),
    vitamin_a_mcg: n(serving.vitamin_a),
    vitamin_c_mg: n(serving.vitamin_c),
    vitamin_d_mcg: n(serving.vitamin_d),
  } satisfies Partial<Record<NutrientKey, number>>;
}

function formatAmount(value: number, unit: string) {
  const rounded = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");

  return `${rounded}${unit}`;
}

function scaled(
  food: NormalizedFood | null,
  serving: FoodServing | null,
  key: NutrientKey,
  amount: number,
) {
  if (!food) return 0;

  const servingBase = Number(serving?.metric_amount ?? 0);
  const servingValue = Number(serving?.nutrients?.[key]);

  if (
    serving &&
    Number.isFinite(servingBase) &&
    servingBase > 0 &&
    Number.isFinite(servingValue)
  ) {
    return servingValue * (amount / servingBase);
  }

  const baseAmount = Number(food.serving_size) || 100;
  const value = Number(food[key] ?? 0);

  return value * (amount / baseAmount);
}

function normalizeFatSecretPayload(food: FatSecretFood) {
  const serving = getFatSecretDefaultServing(food);
  const servingSize = n(serving?.metric_serving_amount) || 100;
  const descriptionCalories = String((food as any).food_description ?? "").match(
    /Calories:\s*([0-9.]+)/i,
  )?.[1];
  const descriptionFat = String((food as any).food_description ?? "").match(
    /Fat:\s*([0-9.]+)/i,
  )?.[1];
  const descriptionCarbs = String((food as any).food_description ?? "").match(
    /Carbs:\s*([0-9.]+)/i,
  )?.[1];
  const descriptionProtein = String((food as any).food_description ?? "").match(
    /Protein:\s*([0-9.]+)/i,
  )?.[1];

  return {
    source: "fatsecret" as const,
    external_id: String(food.food_id ?? ""),
    name: food.food_name ?? `FatSecret Food ${food.food_id ?? ""}`,
    brand: food.brand_name ?? null,
    serving_size: servingSize,
    serving_unit: serving?.metric_serving_unit ?? "g",
    calories: n(serving?.calories) || n(descriptionCalories),
    protein_g: n(serving?.protein) || n(descriptionProtein),
    carbs_g: n(serving?.carbohydrate) || n(descriptionCarbs),
    fat_g: n(serving?.fat) || n(descriptionFat),
    fiber_g: n(serving?.fiber),
    sugar_g: n(serving?.sugar),
    sodium_mg: n(serving?.sodium),
    cholesterol_mg: n(serving?.cholesterol),
    potassium_mg: n(serving?.potassium),
    calcium_mg: n(serving?.calcium),
    iron_mg: n(serving?.iron),
    magnesium_mg: 0,
    zinc_mg: 0,
    vitamin_a_mcg: n(serving?.vitamin_a),
    vitamin_c_mg: n(serving?.vitamin_c),
    vitamin_d_mcg: n(serving?.vitamin_d),
    vitamin_b12_mcg: 0,
    raw_data: food,
  } satisfies NormalizedFood;
}

function buildServingOptions(food: NormalizedFood | null): FoodServing[] {
  if (!food) return [];

  if (food?.source === "fatsecret") {
    const servings = getFatSecretServings(food.raw_data);

    if (servings.length > 0) {
      const options = servings.map((serving: FatSecretServing, index: number) => {
        const metricAmount =
          n(serving.metric_serving_amount) || Number(food.serving_size) || 100;
        const metricUnit =
          normalizeMetricUnit(serving.metric_serving_unit) ??
          serving.metric_serving_unit ??
          food.serving_unit ??
          "serving";

        return {
          mode: "serving" as const,
          name: serving.serving_description ?? `Serving ${index + 1}`,
          amount: n(serving.number_of_units) || 1,
          unit: serving.measurement_description ?? "serving",
          metric_amount: metricAmount,
          metric_unit: metricUnit,
          is_default: String(serving.is_default) === "1" || index === 0,
          nutrients: servingNutrients(serving),
        };
      });
      const metricUnits = new Set<MetricUnit>();

      options.forEach((option) => {
        const unit = normalizeMetricUnit(option.metric_unit);

        if (unit) metricUnits.add(unit);
      });

      return [
        ...options,
        ...Array.from(metricUnits).map((unit) => {
          const reference =
            options.find(
              (option) =>
                normalizeMetricUnit(option.metric_unit) === unit &&
                option.is_default,
            ) ??
            options.find(
              (option) => normalizeMetricUnit(option.metric_unit) === unit,
            );

          return {
            mode: "custom" as const,
            name: `Custom ${unit}`,
            amount: 1,
            unit,
            metric_amount: reference?.metric_amount || 100,
            metric_unit: unit,
            is_default: false,
            nutrients: reference?.nutrients,
          };
        }),
      ];
    }
  }

  const baseAmount = Number(food?.serving_size) || 100;
  const unit = food?.serving_unit || "g";
  const metricUnit = normalizeMetricUnit(unit) ?? "g";

  return [
    {
      mode: "serving",
      name: `${baseAmount}${unit}`,
      amount: 1,
      unit: "serving",
      metric_amount: baseAmount,
      metric_unit: unit,
      is_default: true,
    },
    {
      mode: "custom",
      name: `Custom ${metricUnit}`,
      amount: 1,
      unit: metricUnit,
      metric_amount: baseAmount,
      metric_unit: metricUnit,
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

  const selectedAmount = useMemo(() => {
    if (!selectedServing) return 0;

    const qty = n(quantity);

    if (selectedServing.mode === "custom") {
      return qty;
    }

    return selectedServing.metric_amount;
  }, [quantity, selectedServing]);

  useEffect(() => {
    loadFoodDetails();
  }, []);

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
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

      if (resultType === "fatsecret") {
        const fallback = normalizeFatSecretPayload(parsedPayload);
        const fallbackOptions = buildServingOptions(fallback);

        setFood(fallback);
        setSelectedServing(fallbackOptions[0]);
        setQuantity("1");

        try {
          const fullFood = await getFatSecretFood(
            String(parsedPayload.food_id ?? parsedPayload.external_id ?? ""),
          );

          const normalized = normalizeFatSecretPayload(fullFood);
          const options = buildServingOptions(normalized);

          setFood(normalized);
          setSelectedServing(options[0]);
          setQuantity("1");
        } catch (error) {
          console.log("Diary FatSecret food detail error:", error);
          showAlert(
            "FatSecret details unavailable",
            "Showing available search-result data for this food.",
          );
        }
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

      const totalAmount =
        selectedServing.mode === "serving"
          ? selectedServing.metric_amount
          : n(quantity);
      const totalUnit = selectedServing.metric_unit || "g";

      if (totalAmount <= 0) {
        showAlert("Invalid serving", "Enter a valid amount.");

        return;
      }

      const foodId = isUuid(food.foodId) ? food.foodId : null;

      const calories = scaled(food, selectedServing, "calories", totalAmount);

      const protein = scaled(food, selectedServing, "protein_g", totalAmount);

      const carbs = scaled(food, selectedServing, "carbs_g", totalAmount);

      const fat = scaled(food, selectedServing, "fat_g", totalAmount);

      const fiber = scaled(food, selectedServing, "fiber_g", totalAmount);

      const sugar = scaled(food, selectedServing, "sugar_g", totalAmount);

      const sodium = scaled(food, selectedServing, "sodium_mg", totalAmount);

      const cholesterol = scaled(
        food,
        selectedServing,
        "cholesterol_mg",
        totalAmount,
      );

      const potassium = scaled(
        food,
        selectedServing,
        "potassium_mg",
        totalAmount,
      );

      const calcium = scaled(food, selectedServing, "calcium_mg", totalAmount);

      const iron = scaled(food, selectedServing, "iron_mg", totalAmount);

      const magnesium = scaled(
        food,
        selectedServing,
        "magnesium_mg",
        totalAmount,
      );

      const zinc = scaled(food, selectedServing, "zinc_mg", totalAmount);

      const vitaminA = scaled(
        food,
        selectedServing,
        "vitamin_a_mcg",
        totalAmount,
      );

      const vitaminC = scaled(
        food,
        selectedServing,
        "vitamin_c_mg",
        totalAmount,
      );

      const vitaminD = scaled(
        food,
        selectedServing,
        "vitamin_d_mcg",
        totalAmount,
      );

      const vitaminB12 = scaled(
        food,
        selectedServing,
        "vitamin_b12_mcg",
        totalAmount,
      );

      const logPayload = {
        user_id: user.id,

        food_id: foodId ?? null,

        food_name: food.name,
        food_brand: food.brand ?? null,
        food_source: food.source,
        external_id: food.external_id ?? null,

        date: logDate,

        meal_type: mealType ?? "breakfast",

        quantity: selectedServing.mode === "serving" ? 1 : totalAmount,
        unit: selectedServing.mode === "serving" ? "serving" : totalUnit,

        serving_size: totalAmount,
        serving_unit: totalUnit,

        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,

        fiber_g: fiber,
        sugar_g: sugar,
        sodium_mg: sodium,
        cholesterol_mg: cholesterol,
        potassium_mg: potassium,
        calcium_mg: calcium,
        iron_mg: iron,
        magnesium_mg: magnesium,
        zinc_mg: zinc,
        vitamin_a_mcg: vitaminA,
        vitamin_c_mg: vitaminC,
        vitamin_d_mcg: vitaminD,
        vitamin_b12_mcg: vitaminB12,
      };

      const { error } = await supabase.from("food_logs").insert(logPayload);

      if (error) {
        if (food.source === "fatsecret") {
          const { error: fallbackError } = await supabase
            .from("food_logs")
            .insert({
              ...logPayload,
              food_brand: food.brand ? `FatSecret - ${food.brand}` : "FatSecret",
              food_source: "custom",
              external_id: food.external_id
                ? `fatsecret:${food.external_id}`
                : "fatsecret",
            });

          if (!fallbackError) {
            router.dismissAll();
            router.replace("/(tabs)/diary");
            return;
          }
        }

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

  const calories = scaled(food, selectedServing, "calories", selectedAmount);

  const protein = scaled(food, selectedServing, "protein_g", selectedAmount);

  const carbs = scaled(food, selectedServing, "carbs_g", selectedAmount);

  const fat = scaled(food, selectedServing, "fat_g", selectedAmount);

  const fiber = scaled(food, selectedServing, "fiber_g", selectedAmount);
  const sugar = scaled(food, selectedServing, "sugar_g", selectedAmount);
  const sodium = scaled(food, selectedServing, "sodium_mg", selectedAmount);
  const cholesterol = scaled(
    food,
    selectedServing,
    "cholesterol_mg",
    selectedAmount,
  );

  const potassium = scaled(food, selectedServing, "potassium_mg", selectedAmount);
  const calcium = scaled(food, selectedServing, "calcium_mg", selectedAmount);
  const iron = scaled(food, selectedServing, "iron_mg", selectedAmount);
  const magnesium = scaled(
    food,
    selectedServing,
    "magnesium_mg",
    selectedAmount,
  );
  const zinc = scaled(food, selectedServing, "zinc_mg", selectedAmount);

  const vitaminA = scaled(
    food,
    selectedServing,
    "vitamin_a_mcg",
    selectedAmount,
  );
  const vitaminC = scaled(food, selectedServing, "vitamin_c_mg", selectedAmount);
  const vitaminD = scaled(food, selectedServing, "vitamin_d_mcg", selectedAmount);
  const vitaminB12 = scaled(
    food,
    selectedServing,
    "vitamin_b12_mcg",
    selectedAmount,
  );

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
                      setQuantity("100");
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
                        serving.name === selectedServing.name &&
                        serving.metric_unit === selectedServing.metric_unit
                          ? "900"
                          : "500",
                    }}
                  >
                    {serving.mode === "serving"
                      ? `${serving.name} - ${formatAmount(
                          serving.metric_amount,
                          serving.metric_unit,
                        )}`
                      : `${serving.name} - enter ${serving.metric_unit}`}
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
                1 serving selected ={" "}
                {formatAmount(
                  selectedServing.metric_amount,
                  selectedServing.metric_unit,
                )}
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
                Amount ({selectedServing.metric_unit})
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
            Total amount:{" "}
            {formatAmount(selectedAmount, selectedServing.metric_unit)} - Base:
            per {formatAmount(food.serving_size, food.serving_unit)}
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

      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        confirmText="OK"
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}

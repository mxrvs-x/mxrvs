import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type SearchPayload = any;

type NormalizedFood = {
  foodId?: string;
  source: "custom" | "usda_fdc" | "nccdb";
  external_id?: string | null;
  source_food_type?: string | null;

  name: string;
  brand?: string | null;
  description?: string | null;

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

const AU_BASE_URL =
  "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/search/api/foods";

function n(value: any) {
  return Number(value ?? 0);
}

function label(source: string) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

function getUsdaNutrient(food: any, names: string[]) {
  const nutrients = food.foodNutrients ?? [];

  const found = nutrients.find((item: any) => {
    const nutrientName = String(
      item.nutrient?.name ?? item.nutrientName ?? "",
    ).toLowerCase();

    return names.some((name) => nutrientName.includes(name.toLowerCase()));
  });

  return Number(found?.amount ?? found?.value ?? 0);
}

function getAuNutrient(food: any, names: string[]) {
  const nutrients =
    food.nutrients ??
    food.foodNutrients ??
    food.nutrient_profiles ??
    food.nutrientProfiles ??
    [];

  const found = nutrients.find((item: any) => {
    const nutrientName = String(
      item.name ??
        item.nutrient_name ??
        item.nutrientName ??
        item.nutrient?.name ??
        "",
    ).toLowerCase();

    return names.some((name) => nutrientName.includes(name.toLowerCase()));
  });

  return Number(found?.amount ?? found?.value ?? found?.nutrient_value ?? 0);
}

export default function SearchFoodDetailScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { payload, resultType, mealType, date } = useLocalSearchParams<{
    payload: string;
    resultType: "local" | "usda" | "au";
    mealType: MealType;
    date: string;
  }>();

  const parsedPayload: SearchPayload = useMemo(() => {
    try {
      return JSON.parse(payload ?? "{}");
    } catch {
      return {};
    }
  }, [payload]);

  const [food, setFood] = useState<NormalizedFood | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFoodDetails();
  }, []);

  async function loadFoodDetails() {
    setLoading(true);

    try {
      if (resultType === "local") {
        const normalized: NormalizedFood = {
          foodId: parsedPayload.id,
          source: parsedPayload.source,
          external_id: null,
          source_food_type: null,

          name: parsedPayload.name,
          brand: parsedPayload.brand ?? null,
          description: parsedPayload.description ?? null,

          serving_size: Number(parsedPayload.serving_size ?? 100),
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

        setFood(normalized);
        setQuantity(String(normalized.serving_size));
        setLoading(false);
        return;
      }

      if (resultType === "usda") {
        const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

        if (!apiKey) {
          Alert.alert("Missing API key", "Missing EXPO_PUBLIC_USDA_API_KEY.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${USDA_DETAIL_URL}/${parsedPayload.fdcId}?api_key=${apiKey}`,
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(json));
        }

        const normalized: NormalizedFood = {
          source: "usda_fdc",
          external_id: String(parsedPayload.fdcId),
          source_food_type: json.dataType ?? parsedPayload.dataType ?? "USDA",

          name: json.description ?? parsedPayload.name,
          brand:
            json.brandOwner ?? json.brandName ?? parsedPayload.brand ?? null,
          description: json.description ?? parsedPayload.name,

          serving_size: 100,
          serving_unit: "g",

          calories: getUsdaNutrient(json, ["energy"]),
          protein_g: getUsdaNutrient(json, ["protein"]),
          carbs_g: getUsdaNutrient(json, ["carbohydrate"]),
          fat_g: getUsdaNutrient(json, ["total lipid", "fat"]),

          fiber_g: getUsdaNutrient(json, ["fiber"]),
          sugar_g: getUsdaNutrient(json, ["sugars"]),
          sodium_mg: getUsdaNutrient(json, ["sodium"]),
          cholesterol_mg: getUsdaNutrient(json, ["cholesterol"]),

          potassium_mg: getUsdaNutrient(json, ["potassium"]),
          calcium_mg: getUsdaNutrient(json, ["calcium"]),
          iron_mg: getUsdaNutrient(json, ["iron"]),
          magnesium_mg: getUsdaNutrient(json, ["magnesium"]),
          zinc_mg: getUsdaNutrient(json, ["zinc"]),

          vitamin_a_mcg: getUsdaNutrient(json, ["vitamin a"]),
          vitamin_c_mg: getUsdaNutrient(json, ["vitamin c"]),
          vitamin_d_mcg: getUsdaNutrient(json, ["vitamin d"]),
          vitamin_b12_mcg: getUsdaNutrient(json, [
            "vitamin b-12",
            "vitamin b12",
          ]),

          raw_data: json,
        };

        setFood(normalized);
        setQuantity("100");
        setLoading(false);
        return;
      }

      if (resultType === "au") {
        const response = await fetch(`${AU_BASE_URL}/${parsedPayload.pfk}`);
        const json = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(json));
        }

        const normalized: NormalizedFood = {
          source: "nccdb",
          external_id: parsedPayload.pfk,
          source_food_type: "AFCD",

          name: json.name ?? parsedPayload.name,
          brand: null,
          description: json.name ?? parsedPayload.name,

          serving_size: 100,
          serving_unit: "g",

          calories: getAuNutrient(json, ["energy"]),
          protein_g: getAuNutrient(json, ["protein"]),
          carbs_g: getAuNutrient(json, ["carbohydrate"]),
          fat_g: getAuNutrient(json, ["fat", "lipid"]),

          fiber_g: getAuNutrient(json, ["fibre", "fiber"]),
          sugar_g: getAuNutrient(json, ["sugars"]),
          sodium_mg: getAuNutrient(json, ["sodium"]),
          cholesterol_mg: getAuNutrient(json, ["cholesterol"]),

          potassium_mg: getAuNutrient(json, ["potassium"]),
          calcium_mg: getAuNutrient(json, ["calcium"]),
          iron_mg: getAuNutrient(json, ["iron"]),
          magnesium_mg: getAuNutrient(json, ["magnesium"]),
          zinc_mg: getAuNutrient(json, ["zinc"]),

          vitamin_a_mcg: getAuNutrient(json, ["vitamin a"]),
          vitamin_c_mg: getAuNutrient(json, ["vitamin c"]),
          vitamin_d_mcg: getAuNutrient(json, ["vitamin d"]),
          vitamin_b12_mcg: getAuNutrient(json, ["vitamin b12", "vitamin b-12"]),

          raw_data: json,
        };

        setFood(normalized);
        setQuantity("100");
        setLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      console.log("Search food detail error:", message);
      Alert.alert("Error", "Could not load food details.");
      setLoading(false);
    }
  }

  const multiplier = useMemo(() => {
    if (!food) return 0;
    return (Number(quantity) || 0) / (Number(food.serving_size) || 100);
  }, [food, quantity]);

  const computed = useMemo(() => {
    if (!food) return null;

    return {
      calories: food.calories * multiplier,
      protein_g: food.protein_g * multiplier,
      carbs_g: food.carbs_g * multiplier,
      fat_g: food.fat_g * multiplier,

      fiber_g: food.fiber_g * multiplier,
      sugar_g: food.sugar_g * multiplier,
      sodium_mg: food.sodium_mg * multiplier,
      cholesterol_mg: food.cholesterol_mg * multiplier,

      potassium_mg: food.potassium_mg * multiplier,
      calcium_mg: food.calcium_mg * multiplier,
      iron_mg: food.iron_mg * multiplier,
      magnesium_mg: food.magnesium_mg * multiplier,
      zinc_mg: food.zinc_mg * multiplier,

      vitamin_a_mcg: food.vitamin_a_mcg * multiplier,
      vitamin_c_mg: food.vitamin_c_mg * multiplier,
      vitamin_d_mcg: food.vitamin_d_mcg * multiplier,
      vitamin_b12_mcg: food.vitamin_b12_mcg * multiplier,
    };
  }, [food, multiplier]);

  async function getOrCreateFoodId(userId: string) {
    if (!food) return null;

    if (food.foodId) return food.foodId;

    const { data: existing } = await supabase
      .from("foods")
      .select("id")
      .eq("user_id", userId)
      .eq("source", food.source)
      .eq("external_id", food.external_id)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data, error } = await supabase
      .from("foods")
      .insert({
        user_id: userId,

        source: food.source,
        external_id: food.external_id,
        source_food_type: food.source_food_type,

        name: food.name,
        brand: food.brand,
        description: food.description,

        serving_size: food.serving_size,
        serving_unit: food.serving_unit,

        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,

        fiber_g: food.fiber_g,
        sugar_g: food.sugar_g,
        sodium_mg: food.sodium_mg,
        cholesterol_mg: food.cholesterol_mg,

        potassium_mg: food.potassium_mg,
        calcium_mg: food.calcium_mg,
        iron_mg: food.iron_mg,
        magnesium_mg: food.magnesium_mg,
        zinc_mg: food.zinc_mg,

        vitamin_a_mcg: food.vitamin_a_mcg,
        vitamin_c_mg: food.vitamin_c_mg,
        vitamin_d_mcg: food.vitamin_d_mcg,
        vitamin_b12_mcg: food.vitamin_b12_mcg,

        raw_data: food.raw_data ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.log("Create food error:", error);
      throw error;
    }

    return data.id;
  }

  async function addToDiary() {
    if (!food || !computed) return;

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a valid quantity.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        Alert.alert("Not logged in", "Please sign in first.");
        setSaving(false);
        return;
      }

      const foodId = await getOrCreateFoodId(user.id);

      const { error } = await supabase.from("food_logs").insert({
        user_id: user.id,
        food_id: foodId,

        log_date: date,
        meal_type: mealType,

        quantity: qty,
        unit: food.serving_unit,

        calories: computed.calories,
        protein_g: computed.protein_g,
        carbs_g: computed.carbs_g,
        fat_g: computed.fat_g,

        fiber_g: computed.fiber_g,
        sugar_g: computed.sugar_g,
        sodium_mg: computed.sodium_mg,
        cholesterol_mg: computed.cholesterol_mg,

        potassium_mg: computed.potassium_mg,
        calcium_mg: computed.calcium_mg,
        iron_mg: computed.iron_mg,
        magnesium_mg: computed.magnesium_mg,
        zinc_mg: computed.zinc_mg,
      });

      if (error) throw error;

      router.replace("/(tabs)/diary" as never);
    } catch (err) {
      console.log("Add to diary error:", err);
      Alert.alert("Error", "Could not add food to diary.");
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
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!food || !computed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: 20,
        }}
      >
        <Text style={{ color: theme.colors.text }}>Food not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 20 }}>
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            {food.name}
          </Text>

          {!!food.brand && (
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              {food.brand}
            </Text>
          )}

          <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
            {label(food.source)} · base {food.serving_size} {food.serving_unit}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              marginBottom: 8,
              color: theme.colors.text,
            }}
          >
            Quantity
          </Text>

          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.textFaint}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 14,
                padding: 14,
                backgroundColor: theme.colors.surfaceAlt,
                fontSize: 16,
                color: theme.colors.text,
              }}
            />

            <Text style={{ fontWeight: "900", color: theme.colors.text }}>
              {food.serving_unit}
            </Text>
          </View>

          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Logging to {mealType} · {date}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              marginBottom: 12,
              color: theme.colors.calories,
            }}
          >
            {Math.round(computed.calories)} kcal
          </Text>

          <NutrientRow
            label="Protein"
            value={`${computed.protein_g.toFixed(1)} g`}
          />
          <NutrientRow
            label="Carbs"
            value={`${computed.carbs_g.toFixed(1)} g`}
          />
          <NutrientRow label="Fat" value={`${computed.fat_g.toFixed(1)} g`} />
          <NutrientRow
            label="Fiber"
            value={`${computed.fiber_g.toFixed(1)} g`}
          />
          <NutrientRow
            label="Sugar"
            value={`${computed.sugar_g.toFixed(1)} g`}
          />
          <NutrientRow
            label="Sodium"
            value={`${Math.round(computed.sodium_mg)} mg`}
          />
          <NutrientRow
            label="Cholesterol"
            value={`${Math.round(computed.cholesterol_mg)} mg`}
          />
          <NutrientRow
            label="Potassium"
            value={`${Math.round(computed.potassium_mg)} mg`}
          />
          <NutrientRow
            label="Calcium"
            value={`${Math.round(computed.calcium_mg)} mg`}
          />
          <NutrientRow
            label="Iron"
            value={`${computed.iron_mg.toFixed(1)} mg`}
          />
          <NutrientRow
            label="Magnesium"
            value={`${Math.round(computed.magnesium_mg)} mg`}
          />
          <NutrientRow
            label="Zinc"
            value={`${computed.zinc_mg.toFixed(1)} mg`}
          />
          <NutrientRow
            label="Vitamin A"
            value={`${Math.round(computed.vitamin_a_mcg)} mcg`}
          />
          <NutrientRow
            label="Vitamin C"
            value={`${Math.round(computed.vitamin_c_mg)} mg`}
          />
          <NutrientRow
            label="Vitamin D"
            value={`${computed.vitamin_d_mcg.toFixed(1)} mcg`}
          />
          <NutrientRow
            label="Vitamin B12"
            value={`${computed.vitamin_b12_mcg.toFixed(1)} mcg`}
          />
        </View>

        <Pressable
          onPress={addToDiary}
          disabled={saving}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: 16,
            padding: 16,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              color: theme.colors.textInverse,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            {saving ? "Adding..." : "Add to Diary"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  function NutrientRow({ label, value }: { label: string; value: string }) {
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 7,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>{label}</Text>
        <Text style={{ fontWeight: "800", color: theme.colors.text }}>
          {value}
        </Text>
      </View>
    );
  }
}

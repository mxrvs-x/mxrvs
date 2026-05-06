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

type FoodLog = {
  id: string;
  food_id: string | null;
  meal_type: MealType;
  log_date: string;
  quantity: number;
  unit: string;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  cholesterol_mg?: number | null;

  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  magnesium_mg?: number | null;
  zinc_mg?: number | null;

  foods?: {
    id: string;
    name: string;
    brand: string | null;
    source: string;
    serving_size: number;
    serving_unit: string;

    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;

    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    cholesterol_mg?: number | null;

    potassium_mg?: number | null;
    calcium_mg?: number | null;
    iron_mg?: number | null;
    magnesium_mg?: number | null;
    zinc_mg?: number | null;
  } | null;
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function n(value?: number | null) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

export default function EditFoodLogScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { logId } = useLocalSearchParams<{ logId: string }>();

  const [log, setLog] = useState<FoodLog | null>(null);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [quantity, setQuantity] = useState("100");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLog();
  }, [logId]);

  async function loadLog() {
    setLoading(true);

    const { data, error } = await supabase
      .from("food_logs")
      .select(
        `
        *,
        foods (
          id,
          name,
          brand,
          source,
          serving_size,
          serving_unit,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          sugar_g,
          sodium_mg,
          cholesterol_mg,
          potassium_mg,
          calcium_mg,
          iron_mg,
          magnesium_mg,
          zinc_mg
        )
      `,
      )
      .eq("id", logId)
      .single();

    if (error) {
      console.log("Load log error:", error);
      setLog(null);
    } else {
      const item = data as FoodLog;
      setLog(item);
      setMealType(item.meal_type);
      setQuantity(String(item.quantity));
    }

    setLoading(false);
  }

  const computed = useMemo(() => {
    if (!log) return null;

    const qty = Number(quantity) || 0;

    if (log.foods) {
      const baseServing = Number(log.foods.serving_size) || 100;
      const multiplier = qty / baseServing;

      return {
        calories: n(log.foods.calories) * multiplier,
        protein_g: n(log.foods.protein_g) * multiplier,
        carbs_g: n(log.foods.carbs_g) * multiplier,
        fat_g: n(log.foods.fat_g) * multiplier,

        fiber_g: n(log.foods.fiber_g) * multiplier,
        sugar_g: n(log.foods.sugar_g) * multiplier,
        sodium_mg: n(log.foods.sodium_mg) * multiplier,
        cholesterol_mg: n(log.foods.cholesterol_mg) * multiplier,

        potassium_mg: n(log.foods.potassium_mg) * multiplier,
        calcium_mg: n(log.foods.calcium_mg) * multiplier,
        iron_mg: n(log.foods.iron_mg) * multiplier,
        magnesium_mg: n(log.foods.magnesium_mg) * multiplier,
        zinc_mg: n(log.foods.zinc_mg) * multiplier,
      };
    }

    const oldQty = Number(log.quantity) || 1;
    const multiplier = qty / oldQty;

    return {
      calories: n(log.calories) * multiplier,
      protein_g: n(log.protein_g) * multiplier,
      carbs_g: n(log.carbs_g) * multiplier,
      fat_g: n(log.fat_g) * multiplier,

      fiber_g: n(log.fiber_g) * multiplier,
      sugar_g: n(log.sugar_g) * multiplier,
      sodium_mg: n(log.sodium_mg) * multiplier,
      cholesterol_mg: n(log.cholesterol_mg) * multiplier,

      potassium_mg: n(log.potassium_mg) * multiplier,
      calcium_mg: n(log.calcium_mg) * multiplier,
      iron_mg: n(log.iron_mg) * multiplier,
      magnesium_mg: n(log.magnesium_mg) * multiplier,
      zinc_mg: n(log.zinc_mg) * multiplier,
    };
  }, [log, quantity]);

  async function saveChanges() {
    if (!log || !computed) return;

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a valid quantity.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("food_logs")
      .update({
        meal_type: mealType,
        quantity: qty,

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
      })
      .eq("id", log.id);

    setSaving(false);

    if (error) {
      console.log("Save log error:", error);
      Alert.alert("Error", "Could not update food log.");
      return;
    }

    router.replace("/(tabs)/diary" as never);
  }

  async function deleteLog() {
    if (!log) return;

    Alert.alert(
      "Delete food log?",
      "This will remove this food from your diary.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("food_logs")
              .delete()
              .eq("id", log.id);

            if (error) {
              console.log("Delete log error:", error);
              Alert.alert("Error", "Could not delete food log.");
              return;
            }

            router.replace("/(tabs)/diary" as never);
          },
        },
      ],
    );
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

  if (!log || !computed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: 20,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 20,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          Food log not found.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 18,
            backgroundColor: theme.colors.primary,
            borderRadius: 14,
            padding: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>
            Cancel
          </Text>
        </Pressable>

        <Text
          style={{
            color: theme.colors.text,
            fontSize: 20,
            fontWeight: "900",
          }}
        >
          Edit Food Log
        </Text>

        <View style={{ width: 52 }} />
      </View>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          {log.foods?.name ?? "Unknown food"}
        </Text>

        {!!log.foods?.brand && (
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            {log.foods.brand}
          </Text>
        )}

        <Text style={{ color: theme.colors.textFaint, marginTop: 6 }}>
          {sourceLabel(log.foods?.source)} · {log.log_date}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "900",
            marginBottom: 10,
          }}
        >
          Meal
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {MEALS.map((meal) => {
            const active = mealType === meal;

            return (
              <Pressable
                key={meal}
                onPress={() => setMealType(meal)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: active
                      ? theme.colors.textInverse
                      : theme.colors.text,
                    fontWeight: "900",
                    textTransform: "capitalize",
                  }}
                >
                  {meal}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "900",
            marginBottom: 10,
          }}
        >
          Quantity
        </Text>

        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="Quantity"
          placeholderTextColor={theme.colors.textFaint}
          style={{
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 14,
            padding: 14,
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "800",
          }}
        />

        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          Unit: {log.unit}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "900",
            marginBottom: 12,
          }}
        >
          Updated Nutrition
        </Text>

        <Text
          style={{
            color: theme.colors.calories,
            fontSize: 34,
            fontWeight: "900",
          }}
        >
          {Math.round(computed.calories)} kcal
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <MacroBox
            label="Protein"
            value={`${Math.round(computed.protein_g)}g`}
            color={theme.colors.protein}
          />
          <MacroBox
            label="Carbs"
            value={`${Math.round(computed.carbs_g)}g`}
            color={theme.colors.carbs}
          />
          <MacroBox
            label="Fat"
            value={`${Math.round(computed.fat_g)}g`}
            color={theme.colors.fat}
          />
        </View>
      </View>

      <Pressable
        disabled={saving}
        onPress={saveChanges}
        style={{
          backgroundColor: theme.colors.primary,
          borderRadius: 14,
          padding: 15,
          alignItems: "center",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
            Save Changes
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={deleteLog}
        style={{
          marginTop: 12,
          backgroundColor: theme.colors.danger,
          borderRadius: 14,
          padding: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
          Delete Food Log
        </Text>
      </Pressable>
    </ScrollView>
  );

  function MacroBox({
    label,
    value,
    color,
  }: {
    label: string;
    value: string;
    color: string;
  }) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: `${color}55`,
        }}
      >
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          {label}
        </Text>
        <Text
          style={{
            color,
            fontSize: 17,
            fontWeight: "900",
            marginTop: 4,
          }}
        >
          {value}
        </Text>
      </View>
    );
  }
}

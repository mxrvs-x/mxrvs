import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

type Food = {
  id: string;
  name: string;
  brand: string | null;
  serving_name: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  created_at: string;
};

export default function CustomFoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  async function loadFood() {
    if (!id) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Not signed in", "Please sign in first.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("source", "custom")
      .single();

    if (error) {
      Alert.alert("Error", error.message);
      setLoading(false);
      return;
    }

    setFood(data);
    setLoading(false);
  }

  useEffect(() => {
    loadFood();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: "#666" }}>Loading food...</Text>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Text>Food not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 26, fontWeight: "800" }}>{food.name}</Text>

      {!!food.brand && (
        <Text style={{ marginTop: 4, color: "#666" }}>{food.brand}</Text>
      )}

      {!!food.serving_name && (
        <Text style={{ marginTop: 8, color: "#666" }}>{food.serving_name}</Text>
      )}

      <Text style={{ marginTop: 12, color: "#999" }}>
        Serving: {food.serving_size} {food.serving_unit}
      </Text>

      <NutritionCard title="Macros">
        <NutritionRow label="Calories" value={food.calories} unit="kcal" />
        <NutritionRow label="Protein" value={food.protein_g} unit="g" />
        <NutritionRow label="Carbs" value={food.carbs_g} unit="g" />
        <NutritionRow label="Fat" value={food.fat_g} unit="g" />
      </NutritionCard>

      <Pressable
        onPress={() => setShowFullNutrition((prev) => !prev)}
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          backgroundColor: "#000",
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>
          {showFullNutrition ? "Hide Full Nutrition" : "Show Full Nutrition"}
        </Text>
      </Pressable>

      {showFullNutrition && (
        <>
          <NutritionCard title="Extra Nutrition">
            <NutritionRow label="Fiber" value={food.fiber_g} unit="g" />
            <NutritionRow label="Sugar" value={food.sugar_g} unit="g" />
            <NutritionRow label="Sodium" value={food.sodium_mg} unit="mg" />
            <NutritionRow
              label="Cholesterol"
              value={food.cholesterol_mg}
              unit="mg"
            />
          </NutritionCard>

          <NutritionCard title="Micronutrients">
            <NutritionRow
              label="Potassium"
              value={food.potassium_mg}
              unit="mg"
            />
            <NutritionRow label="Calcium" value={food.calcium_mg} unit="mg" />
            <NutritionRow label="Iron" value={food.iron_mg} unit="mg" />
            <NutritionRow
              label="Magnesium"
              value={food.magnesium_mg}
              unit="mg"
            />
            <NutritionRow label="Zinc" value={food.zinc_mg} unit="mg" />
          </NutritionCard>

          <NutritionCard title="Vitamins">
            <NutritionRow
              label="Vitamin A"
              value={food.vitamin_a_mcg}
              unit="mcg"
            />
            <NutritionRow
              label="Vitamin C"
              value={food.vitamin_c_mg}
              unit="mg"
            />
            <NutritionRow
              label="Vitamin D"
              value={food.vitamin_d_mcg}
              unit="mcg"
            />
            <NutritionRow
              label="Vitamin B12"
              value={food.vitamin_b12_mcg}
              unit="mcg"
            />
          </NutritionCard>
        </>
      )}
    </ScrollView>
  );
}

function NutritionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function NutritionRow({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number | null;
  unit: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: "#eee",
      }}
    >
      <Text style={{ color: "#666" }}>{label}</Text>
      <Text style={{ fontWeight: "700" }}>
        {value ?? 0} {unit}
      </Text>
    </View>
  );
}

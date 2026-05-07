import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import ThemedAlert from "@/components/ThemedAlert";
import { ChevronDown, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type ServingMode = "serving" | "gram";

type FoodLog = {
  id: string;
  food_id: string | null;

  food_name?: string | null;
  food_brand?: string | null;
  food_source?: string | null;
  external_id?: string | null;

  meal_type: MealType;
  date: string;
  quantity: number;
  unit: string;
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
  } | null;
};

type FoodServing = {
  mode: ServingMode;
  name: string;
  gram_weight: number;
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function n(value?: number | string | null) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  return "CUSTOM";
}

function buildServingOptions(log: FoodLog | null): FoodServing[] {
  const baseGrams = Number(log?.foods?.serving_size ?? 100) || 100;
  const unit = log?.foods?.serving_unit ?? "g";

  return [
    { mode: "serving", name: `${baseGrams}${unit}`, gram_weight: baseGrams },
    { mode: "gram", name: "g", gram_weight: 1 },
  ];
}

export default function EditFoodLogScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { logId } = useLocalSearchParams<{ logId: string }>();

  const [log, setLog] = useState<FoodLog | null>(null);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [selectedServing, setSelectedServing] = useState<FoodServing | null>(
    null,
  );
  const [quantity, setQuantity] = useState("1");
  const [servingsOpen, setServingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const servingOptions = useMemo(() => buildServingOptions(log), [log]);

  const [alertOpen, setAlertOpen] = useState(false);

  const [alertTitle, setAlertTitle] = useState("");

  const [alertMessage, setAlertMessage] = useState("");

  const grams = useMemo(() => {
    if (!selectedServing) return 0;

    const qty = n(quantity);

    if (selectedServing.mode === "gram") return qty;

    return qty * selectedServing.gram_weight;
  }, [quantity, selectedServing]);

  useEffect(() => {
    loadLog();
  }, [logId]);

  async function loadLog() {
    setLoading(true);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (error) {
      console.log("Load log error:", error);
      setLog(null);
    } else {
      const item = data as FoodLog;

      setLog(item);
      setMealType(item.meal_type);

      const options = buildServingOptions(item);
      const isGram = item.unit === "g";
      const nextServing = isGram ? options[1] : options[0];

      setSelectedServing(nextServing);
      setQuantity(isGram ? String(item.quantity) : String(item.quantity || 1));
    }

    setLoading(false);
  }

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  const computed = useMemo(() => {
    if (!log) return null;

    const currentGrams = Number(log.serving_size ?? 100) || 100;
    const multiplier = grams / currentGrams;

    return {
      calories: n(log.calories) * multiplier,
      protein_g: n(log.protein_g) * multiplier,
      carbs_g: n(log.carbs_g) * multiplier,
      fat_g: n(log.fat_g) * multiplier,
      fiber_g: n(log.fiber_g) * multiplier,
      sugar_g: n(log.sugar_g) * multiplier,
      sodium_mg: n(log.sodium_mg) * multiplier,
      cholesterol_mg: n(log.cholesterol_mg) * multiplier,
    };
  }, [log, grams]);

  async function handleSave() {
    if (!log || !computed || !selectedServing) return;

    const qty = n(quantity);

    if (!qty || qty <= 0) {
      showAlert("Invalid quantity", "Please enter a valid quantity.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("food_logs")
      .update({
        meal_type: mealType,
        quantity: qty,
        unit: selectedServing.mode === "gram" ? "g" : selectedServing.name,
        serving_size: grams,
        serving_unit: "g",
        calories: computed.calories,
        protein_g: computed.protein_g,
        carbs_g: computed.carbs_g,
        fat_g: computed.fat_g,
        fiber_g: computed.fiber_g,
        sugar_g: computed.sugar_g,
        sodium_mg: computed.sodium_mg,
        cholesterol_mg: computed.cholesterol_mg,
      })
      .eq("id", log.id);

    setSaving(false);

    if (error) {
      console.log("Update food log error:", error);
      showAlert("Error", "Could not update food log.");
      return;
    }

    router.dismissAll();
    router.replace("/(tabs)/diary");
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

  if (!log || !computed || !selectedServing) {
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
        <Text style={{ color: theme.colors.text, fontSize: 18 }}>
          Food log not found.
        </Text>
      </View>
    );
  }

  const foodName = log.food_name ?? log.foods?.name ?? "Unknown food";
  const foodBrand = log.food_brand ?? log.foods?.brand ?? null;
  const foodSource = log.food_source ?? log.foods?.source ?? null;

  const quantityDisabled = selectedServing.mode === "serving";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "Edit Food",
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTitleStyle: { color: theme.colors.text, fontWeight: "900" },
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
            {foodName}
          </Text>
          {foodBrand ? (
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              {foodBrand}
            </Text>
          ) : null}
          <Text
            style={{
              color: theme.colors.primary,
              fontWeight: "900",
              marginTop: 10,
            }}
          >
            {sourceLabel(foodSource)} · {log.date}
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
                      : theme.colors.background,
                    borderWidth: 1,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? theme.colors.surface : theme.colors.text,
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
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>
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
                    setQuantity(
                      serving.mode === "serving"
                        ? "1"
                        : String(
                            Math.round(grams || log.foods?.serving_size || 100),
                          ),
                    );
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
            <Text style={{ color: theme.colors.textMuted, marginTop: 14 }}>
              1 serving selected automatically ={" "}
              {Math.round(selectedServing.gram_weight)}g
            </Text>
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

          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Total weight: {Math.round(grams)}g
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
            Updated Nutrition
          </Text>
          {[
            ["Calories", `${Math.round(computed.calories)} kcal`],
            ["Protein", `${computed.protein_g.toFixed(1)}g`],
            ["Carbs", `${computed.carbs_g.toFixed(1)}g`],
            ["Fat", `${computed.fat_g.toFixed(1)}g`],
          ].map(([label, value]) => (
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
                {value}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleSave}
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
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pencil, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type FoodLog = {
  id: string;
  user_id: string;
  food_id: string | null;

  food_name?: string | null;
  food_brand?: string | null;
  food_source?: string | null;
  external_id?: string | null;

  date: string;
  meal_type: MealType;
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
  } | null;
};

function n(value?: number | string | null) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  return "CUSTOM";
}

export default function FoodLogDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { logId } = useLocalSearchParams<{ logId: string }>();

  const [log, setLog] = useState<FoodLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    loadLog();
  }, [logId]);

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

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
          serving_unit
        )
      `,
      )
      .eq("id", logId)
      .single();

    if (error) {
      console.log("Food log detail error:", error);
      setLog(null);
    } else {
      setLog(data as FoodLog);
    }

    setLoading(false);
  }

  function deleteLog() {
    setConfirmDeleteOpen(true);
  }

  async function confirmDeleteLog() {
    if (!log) return;

    setDeleting(true);

    const { error } = await supabase
      .from("food_logs")
      .delete()
      .eq("id", log.id);

    setDeleting(false);

    if (error) {
      showAlert("Error", "Could not delete food log.");
      return;
    }

    setConfirmDeleteOpen(false);

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

  if (!log) {
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

  const foodName = log.foods?.name ?? log.food_name ?? "Food";
  const foodBrand = log.foods?.brand ?? log.food_brand ?? null;
  const foodSource = log.foods?.source ?? log.food_source ?? null;

  const servingText =
    log.unit === "g"
      ? `${n(log.quantity)}g`
      : `${n(log.quantity)} × ${log.unit}`;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "Food Details",
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
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/diary/edit-food-log" as any,
                  params: { logId: log.id },
                })
              }
              style={{
                width: 46,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil size={22} color={theme.colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
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

          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            {log.meal_type.toUpperCase()} · {servingText} ·{" "}
            {Math.round(n(log.serving_size))}g total
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
            Nutrition Logged
          </Text>

          {[
            ["Calories", `${Math.round(n(log.calories))} kcal`],
            ["Protein", `${n(log.protein_g).toFixed(1)}g`],
            ["Carbs", `${n(log.carbs_g).toFixed(1)}g`],
            ["Fat", `${n(log.fat_g).toFixed(1)}g`],
            ["Fiber", `${n(log.fiber_g).toFixed(1)}g`],
            ["Sugar", `${n(log.sugar_g).toFixed(1)}g`],
            ["Sodium", `${Math.round(n(log.sodium_mg))}mg`],
            ["Cholesterol", `${Math.round(n(log.cholesterol_mg))}mg`],
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
          onPress={deleteLog}
          disabled={deleting}
          style={{
            height: 56,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.colors.danger ?? "#ef4444",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
            flexDirection: "row",
            gap: 8,
            opacity: deleting ? 0.6 : 1,
          }}
        >
          <Trash2 size={20} color={theme.colors.danger ?? "#ef4444"} />
          <Text
            style={{
              color: theme.colors.danger ?? "#ef4444",
              fontSize: 18,
              fontWeight: "900",
            }}
          >
            {deleting ? "Deleting..." : "Delete Food Log"}
          </Text>
        </Pressable>
      </ScrollView>

      <ThemedAlert
        visible={confirmDeleteOpen}
        title="Delete food log?"
        message="This will permanently remove this food from your diary."
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        danger
        onClose={() => {
          if (!deleting) {
            setConfirmDeleteOpen(false);
          }
        }}
        onConfirm={() => {
          if (!deleting) {
            confirmDeleteLog();
          }
        }}
      />

      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}
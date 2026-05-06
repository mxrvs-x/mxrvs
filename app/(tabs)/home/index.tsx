import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [foodLogs, setFoodLogs] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [cardio, setCardio] = useState<any[]>([]);

  const today = new Date().toISOString().split("T")[0];

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [foods, w, c] = await Promise.all([
      supabase.from("food_logs").select("*").eq("date", today),
      supabase.from("workout_logs").select("*").eq("date", today),
      supabase.from("cardio_sessions").select("*").eq("date", today),
    ]);

    setFoodLogs(foods.data || []);
    setWorkouts(w.data || []);
    setCardio(c.data || []);

    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  const nutrition = useMemo(() => {
    return foodLogs.reduce(
      (acc, f) => {
        acc.calories += Number(f.calories || 0);
        acc.protein += Number(f.protein_g || 0);
        acc.carbs += Number(f.carbs_g || 0);
        acc.fat += Number(f.fat_g || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [foodLogs]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.layout.screenPadding }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: theme.fontSize.xxl,
          fontWeight: "900",
          color: theme.colors.text,
        }}
      >
        Dashboard
      </Text>

      <Text
        style={{
          marginTop: 6,
          color: theme.colors.textMuted,
        }}
      >
        Today’s overview
      </Text>

      {/* CALORIES */}
      <Card theme={theme}>
        <Text style={{ color: theme.colors.textMuted }}>Calories</Text>

        <Text
          style={{
            fontSize: 34,
            fontWeight: "900",
            color: theme.colors.calories,
            marginTop: 4,
          }}
        >
          {Math.round(nutrition.calories)} kcal
        </Text>

        <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
          <MacroBox
            theme={theme}
            label="Protein"
            value={`${nutrition.protein}g`}
            color={theme.colors.protein}
          />
          <MacroBox
            theme={theme}
            label="Carbs"
            value={`${nutrition.carbs}g`}
            color={theme.colors.carbs}
          />
          <MacroBox
            theme={theme}
            label="Fat"
            value={`${nutrition.fat}g`}
            color={theme.colors.fat}
          />
        </View>
      </Card>

      {/* WORKOUT */}
      <Card theme={theme}>
        <Text style={{ color: theme.colors.textMuted }}>Workout</Text>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: workouts.length ? theme.colors.success : theme.colors.text,
            marginTop: 4,
          }}
        >
          {workouts.length ? "Completed" : "Not Started"}
        </Text>

        <PrimaryButton
          theme={theme}
          label="Open Workouts"
          onPress={() => router.push("/workouts" as any)}
        />
      </Card>

      {/* CARDIO */}
      <Card theme={theme}>
        <Text style={{ color: theme.colors.textMuted }}>Cardio</Text>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: theme.colors.primary,
            marginTop: 4,
          }}
        >
          {cardio.length} session(s)
        </Text>

        <PrimaryButton
          theme={theme}
          label="Open Cardio"
          onPress={() => router.push("/cardio" as any)}
        />
      </Card>
    </ScrollView>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Card({ theme, children }: any) {
  return (
    <View
      style={{
        marginTop: 20,
        padding: theme.layout.cardPadding,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
      }}
    >
      {children}
    </View>
  );
}

function MacroBox({ theme, label, value, color }: any) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: `${color}55`,
      }}
    >
      <Text style={{ color: theme.colors.textMuted }}>{label}</Text>
      <Text
        style={{
          color,
          fontWeight: "900",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({ theme, label, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.accent,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: theme.colors.textInverse,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

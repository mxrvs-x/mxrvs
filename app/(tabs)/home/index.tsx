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

  // example targets (could come from user settings)
  const targets = { calories: 2200, protein: 150, carbs: 250, fat: 70 };

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
      contentContainerStyle={{
        padding: theme.layout.screenPadding,
        paddingBottom: 40,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* HEADER ROW */}
      <View
        style={{
          flexDirection: "row",
          marginBottom: 12,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            Welcome, Marvs
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ marginTop: 6, color: theme.colors.textMuted }}>
            {new Date().toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* NUTRITION SUMMARY CARD */}
      <Card theme={theme} style={{ paddingVertical: 18 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
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
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              {Math.max(0, Math.round(targets.calories - nutrition.calories))}{" "}
              kcal left
            </Text>
          </View>

          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 999,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <Text style={{ fontSize: 18, color: theme.colors.textMuted }}>
              Progress
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: theme.colors.primary,
                marginTop: 6,
              }}
            >
              {Math.min(
                100,
                Math.round((nutrition.calories / targets.calories) * 100),
              )}
              %
            </Text>
          </View>
        </View>

        {/* MACRO ROW */}
        <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
          <MacroBox
            theme={theme}
            label="Protein"
            value={`${nutrition.protein}g`}
            color={theme.colors.protein}
            progress={nutrition.protein / targets.protein}
          />
          <MacroBox
            theme={theme}
            label="Carbs"
            value={`${nutrition.carbs}g`}
            color={theme.colors.carbs}
            progress={nutrition.carbs / targets.carbs}
          />
          <MacroBox
            theme={theme}
            label="Fat"
            value={`${nutrition.fat}g`}
            color={theme.colors.fat}
            progress={nutrition.fat / targets.fat}
          />
        </View>
      </Card>

      {/* WORKOUT + CARDIO GRID */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <Card theme={theme} style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textMuted }}>Workout</Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: workouts.length ? theme.colors.success : theme.colors.text,
              marginTop: 6,
            }}
          >
            {workouts.length ? "Completed" : "Not Started"}
          </Text>

          <InfoRow
            theme={theme}
            label="Sessions"
            value={`${workouts.length}`}
          />
          <PrimaryButton
            theme={theme}
            label="Open"
            onPress={() => router.push("/workouts" as any)}
          />
        </Card>

        <Card theme={theme} style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textMuted }}>Cardio</Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: theme.colors.primary,
              marginTop: 6,
            }}
          >
            {cardio.length} session(s)
          </Text>

          <InfoRow
            theme={theme}
            label="Duration"
            value={cardio.length ? `${sumCardioMinutes(cardio)} min` : "—"}
          />
          <PrimaryButton
            theme={theme}
            label="Open"
            onPress={() => router.push("/cardio" as any)}
          />
        </Card>
      </View>
    </ScrollView>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Card({ theme, children, style = {} }: any) {
  return (
    <View
      style={{
        marginTop: 0,
        padding: theme.layout.cardPadding,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function MacroBox({ theme, label, value, color, progress = 0 }: any) {
  const clamped = Math.max(0, Math.min(1, progress));
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
      <Text style={{ color, fontWeight: "900", marginTop: 6 }}>{value}</Text>

      <View
        style={{
          height: 8,
          backgroundColor: `${theme.colors.border}33`,
          borderRadius: 8,
          marginTop: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(clamped * 100)}%`,
            height: "100%",
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={{ marginTop: 6, color: theme.colors.textMuted, fontSize: 12 }}
      >
        {Math.round(clamped * 100)}% of target
      </Text>
    </View>
  );
}

function PrimaryButton({ theme, label, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.accent,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TinyButton({ theme, label, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ theme, label, value }: any) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
      }}
    >
      <Text style={{ color: theme.colors.textMuted }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function sumCardioMinutes(sessions: any[]) {
  return sessions.reduce((acc, s) => acc + Number(s.duration_min || 0), 0);
}

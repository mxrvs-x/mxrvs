import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FoodLog = {
  calories?: number | string | null;
  protein_g?: number | string | null;
  carbs_g?: number | string | null;
  fat_g?: number | string | null;
};

type WorkoutLog = {
  id?: string;
  workout_date?: string | null;
};

type CardioSession = {
  duration_seconds?: number | string | null;
  distance_km?: number | string | null;
  session_date?: string | null;
};

type MacroTarget = {
  calories_target?: number | null;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fat_target_g?: number | null;
};

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const FALLBACK_TARGETS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
};

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function n(value?: number | string | null) {
  return Number(value ?? 0);
}

function percent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-PH");
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [cardio, setCardio] = useState<CardioSession[]>([]);
  const [target, setTarget] = useState<MacroTarget | null>(null);

  const today = useMemo(() => localDateString(new Date()), []);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFoodLogs([]);
        setWorkouts([]);
        setCardio([]);
        setTarget(null);
        return;
      }

      const [foods, workoutLogs, cardioSessions, macroTarget] =
        await Promise.all([
          supabase.from("food_logs").select("*").eq("date", today),
          supabase
            .from("workouts")
            .select("id, workout_date")
            .eq("user_id", user.id)
            .eq("workout_date", today),
          supabase
            .from("cardio_sessions")
            .select("id, session_date, distance_km, duration_seconds")
            .eq("user_id", user.id)
            .eq("session_date", today),
          supabase
            .from("macro_targets")
            .select(
              "calories_target, protein_target_g, carbs_target_g, fat_target_g",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (foods.error) console.log("Home food logs error:", foods.error);
      if (workoutLogs.error) {
        console.log("Home workout logs error:", workoutLogs.error);
      }
      if (cardioSessions.error) {
        console.log("Home cardio sessions error:", cardioSessions.error);
      }
      if (macroTarget.error) {
        console.log("Home macro target error:", macroTarget.error);
      }

      setFoodLogs((foods.data ?? []) as FoodLog[]);
      setWorkouts((workoutLogs.data ?? []) as WorkoutLog[]);
      setCardio((cardioSessions.data ?? []) as CardioSession[]);
      setTarget((macroTarget.data ?? null) as MacroTarget | null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  const nutrition = useMemo(
    () =>
      foodLogs.reduce<NutritionTotals>(
        (acc, food) => {
          acc.calories += n(food.calories);
          acc.protein += n(food.protein_g);
          acc.carbs += n(food.carbs_g);
          acc.fat += n(food.fat_g);
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [foodLogs],
  );

  const targets = useMemo(
    () => ({
      calories: target?.calories_target ?? FALLBACK_TARGETS.calories,
      protein: target?.protein_target_g ?? FALLBACK_TARGETS.protein,
      carbs: target?.carbs_target_g ?? FALLBACK_TARGETS.carbs,
      fat: target?.fat_target_g ?? FALLBACK_TARGETS.fat,
    }),
    [target],
  );

  const caloriesProgress = percent(nutrition.calories, targets.calories);
  const caloriesLeft = Math.max(0, targets.calories - nutrition.calories);
  const cardioMinutes = cardio.reduce(
    (acc, session) => acc + n(session.duration_seconds) / 60,
    0,
  );
  const cardioDistance = cardio.reduce(
    (acc, session) => acc + n(session.distance_km),
    0,
  );
  const hasAnyActivity =
    foodLogs.length > 0 || workouts.length > 0 || cardio.length > 0;

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
        paddingBottom: insets.bottom + 32,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            Today
          </Text>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 30,
              fontWeight: "900",
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            Hi, Marvs
          </Text>
        </View>

        <View
          style={{
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          }}
        >
          <CalendarDays size={16} color={theme.colors.primary} />
          <Text
            style={{
              color: theme.colors.text,
              fontWeight: "900",
              fontSize: 12,
            }}
          >
            {new Date().toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      </View>

      <Card theme={theme} style={{ marginTop: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <SectionLabel theme={theme} label="Energy" icon={Flame} />
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 36,
                fontWeight: "900",
                marginTop: 8,
              }}
            >
              {formatNumber(nutrition.calories)}
              <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>
                {" "}
                kcal
              </Text>
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                marginTop: 4,
                fontWeight: "700",
              }}
            >
              {formatNumber(caloriesLeft)} kcal left of{" "}
              {formatNumber(targets.calories)}
            </Text>
          </View>

          <ProgressBadge
            theme={theme}
            value={Math.round(caloriesProgress * 100)}
            color={theme.colors.calories}
          />
        </View>

        <ProgressBar
          theme={theme}
          value={caloriesProgress}
          color={theme.colors.calories}
          style={{ marginTop: 18 }}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <MacroTile
            theme={theme}
            label="Protein"
            value={nutrition.protein}
            target={targets.protein}
            color={theme.colors.protein}
          />
          <MacroTile
            theme={theme}
            label="Carbs"
            value={nutrition.carbs}
            target={targets.carbs}
            color={theme.colors.carbs}
          />
          <MacroTile
            theme={theme}
            label="Fat"
            value={nutrition.fat}
            target={targets.fat}
            color={theme.colors.fat}
          />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
        <StatCard
          theme={theme}
          icon={Dumbbell}
          label="Workout"
          value={workouts.length ? "Done" : "Open"}
          detail={plural(workouts.length, "session")}
          color={workouts.length ? theme.colors.success : theme.colors.primary}
          onPress={() => router.push("/(tabs)/workouts" as any)}
        />
        <StatCard
          theme={theme}
          icon={Activity}
          label="Cardio"
          value={`${formatNumber(cardioMinutes)} min`}
          detail={
            cardioDistance > 0
              ? `${cardioDistance.toFixed(2)} km`
              : plural(cardio.length, "session")
          }
          color={theme.colors.running}
          onPress={() => router.push("/(tabs)/cardio" as any)}
        />
      </View>

      {!hasAnyActivity ? (
        <View
          style={{
            marginTop: 18,
            borderRadius: theme.radius.lg,
            padding: 16,
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            Start today with one log
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              marginTop: 6,
              lineHeight: 20,
            }}
          >
            Add a meal, start a workout, or record cardio to populate your
            dashboard.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Card({
  theme,
  children,
  style,
}: {
  theme: AppTheme;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          padding: theme.layout.cardPadding,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          ...theme.shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function SectionLabel({
  theme,
  label,
  icon: Icon,
}: {
  theme: AppTheme;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={17} color={theme.colors.primary} />
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 13,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressBadge({
  theme,
  value,
  color,
}: {
  theme: AppTheme;
  value: number;
  color: string;
}) {
  return (
    <View
      style={{
        width: 76,
        height: 76,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 6,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>
        {value}
      </Text>
      <Text
        style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" }}
      >
        percent
      </Text>
    </View>
  );
}

function ProgressBar({
  theme,
  value,
  color,
  style,
}: {
  theme: AppTheme;
  value: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height: 10,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${Math.round(percent(value, 1) * 100)}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: theme.radius.pill,
        }}
      />
    </View>
  );
}

function MacroTile({
  theme,
  label,
  value,
  target,
  color,
}: {
  theme: AppTheme;
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const progress = percent(value, target);

  return (
    <View
      style={{
        flex: 1,
        minHeight: 112,
        padding: 12,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color,
          fontSize: 20,
          fontWeight: "900",
          marginTop: 8,
        }}
      >
        {formatNumber(value)}g
      </Text>
      <ProgressBar theme={theme} value={progress} color={color} style={{ marginTop: 10 }} />
      <Text
        style={{
          color: theme.colors.textFaint,
          fontSize: 11,
          fontWeight: "800",
          marginTop: 7,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatNumber(target)}g target
      </Text>
    </View>
  );
}

function StatCard({
  theme,
  icon: Icon,
  label,
  value,
  detail,
  color,
  onPress,
}: {
  theme: AppTheme;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  detail: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 132,
        padding: 14,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={color} />
      </View>

      <Text
        style={{
          color: theme.colors.textMuted,
          fontWeight: "900",
          fontSize: 12,
          marginTop: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          fontWeight: "900",
          fontSize: 20,
          marginTop: 3,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={{
          color: theme.colors.textFaint,
          fontWeight: "800",
          fontSize: 12,
          marginTop: 5,
        }}
        numberOfLines={1}
      >
        {detail}
      </Text>
    </Pressable>
  );
}

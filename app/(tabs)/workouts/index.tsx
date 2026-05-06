import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

type WorkoutType = "push" | "pull" | "legs" | "upper" | "lower" | "rest";

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  set_count?: number;
  total_volume?: number;
};

type WorkoutSet = {
  workout_id: string;
  reps: number;
  weight_kg: number;
};

const WEEK_SPLIT = [
  { day: "Monday", type: "push" as WorkoutType, label: "Push", emoji: "🔥" },
  { day: "Tuesday", type: "pull" as WorkoutType, label: "Pull", emoji: "💪" },
  {
    day: "Wednesday",
    type: "legs" as WorkoutType,
    label: "Legs / Core",
    emoji: "🦵",
  },
  { day: "Thursday", type: "rest" as WorkoutType, label: "Rest", emoji: "😴" },
  {
    day: "Friday",
    type: "upper" as WorkoutType,
    label: "Upper Body",
    emoji: "🏋️",
  },
  {
    day: "Saturday",
    type: "lower" as WorkoutType,
    label: "Lower / Arms / Core",
    emoji: "⚡",
  },
  { day: "Sunday", type: "rest" as WorkoutType, label: "Rest", emoji: "😴" },
];

function getTodaySplit() {
  const today = new Date().getDay();

  const map: Record<number, (typeof WEEK_SPLIT)[number]> = {
    0: WEEK_SPLIT[6],
    1: WEEK_SPLIT[0],
    2: WEEK_SPLIT[1],
    3: WEEK_SPLIT[2],
    4: WEEK_SPLIT[3],
    5: WEEK_SPLIT[4],
    6: WEEK_SPLIT[5],
  };

  return map[today];
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWorkoutType(type: WorkoutType) {
  const labels: Record<WorkoutType, string> = {
    push: "Push",
    pull: "Pull",
    legs: "Legs / Core",
    upper: "Upper Body",
    lower: "Lower / Arms / Core",
    rest: "Rest",
  };

  return labels[type];
}

export default function WorkoutIndexScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [exerciseCount, setExerciseCount] = useState(0);

  const todaySplit = useMemo(() => getTodaySplit(), []);

  async function loadWorkoutData(showLoader = true) {
    if (showLoader) setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const today = getTodayDateString();

    const [{ data: workouts }, { count }, { data: todayWorkouts }] =
      await Promise.all([
        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", user.id)
          .order("workout_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("exercises")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),

        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", user.id)
          .eq("workout_date", today)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    const workoutRows = (workouts || []) as Workout[];
    const workoutIds = workoutRows.map((w) => w.id);

    let setRows: WorkoutSet[] = [];

    if (workoutIds.length > 0) {
      const { data: workoutSets } = await supabase
        .from("workout_sets")
        .select("workout_id, reps, weight_kg")
        .in("workout_id", workoutIds);

      setRows = (workoutSets || []) as WorkoutSet[];
    }

    const mappedWorkouts = workoutRows.map((workout) => {
      const workoutSets = setRows.filter(
        (set) => set.workout_id === workout.id,
      );

      const totalVolume = workoutSets.reduce((sum, set) => {
        return sum + (Number(set.reps) || 0) * (Number(set.weight_kg) || 0);
      }, 0);

      return {
        ...workout,
        set_count: workoutSets.length,
        total_volume: totalVolume,
      };
    });

    setRecentWorkouts(mappedWorkouts);
    setExerciseCount(count || 0);
    setTodayWorkout(((todayWorkouts || [])[0] as Workout) || null);

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkoutData(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, []),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F7F7" }}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={{ fontSize: 28, fontWeight: "800", marginTop: 48 }}>
        Workout
      </Text>

      <Text style={{ color: "#666", marginTop: 4 }}>
        PPL / UL strength tracking
      </Text>

      <View
        style={{
          marginTop: 20,
          backgroundColor: "#111",
          borderRadius: 20,
          padding: 18,
        }}
      >
        <Text style={{ color: "#aaa", fontSize: 13 }}>{"Today's Split"}</Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          {todaySplit.emoji} {todaySplit.label}
        </Text>

        <Text style={{ color: "#bbb", marginTop: 8 }}>
          {todaySplit.type === "rest"
            ? "Recovery day. Keep it light, walk, stretch, or rest fully."
            : "Log your sets, reps, weight, and rest time."}
        </Text>
      </View>

      {todayWorkout && (
        <View
          style={{
            backgroundColor: "#FFF4E5",
            borderRadius: 16,
            padding: 16,
            marginTop: 14,
            borderWidth: 1,
            borderColor: "#FFE0AD",
          }}
        >
          <Text style={{ fontWeight: "900", color: "#9A5A00" }}>
            ⚠️ Already logged today
          </Text>

          <Text style={{ color: "#9A5A00", marginTop: 6, fontWeight: "700" }}>
            {formatWorkoutType(todayWorkout.workout_type)}
            {todayWorkout.duration_minutes
              ? ` • ${todayWorkout.duration_minutes} min`
              : ""}
          </Text>

          <Text style={{ color: "#7A5A22", marginTop: 6 }}>
            You’ve already completed today’s session. You can still train again,
            but rest and recovery are also important.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <Pressable
          onPress={() => router.push("/workouts/setup")}
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: "#eee",
          }}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>
          <Text style={{ fontWeight: "800", marginTop: 8 }}>Setup</Text>
          <Text style={{ color: "#666", marginTop: 4 }}>
            {exerciseCount} exercises
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/workouts/start")}
          style={{
            flex: 1,
            backgroundColor: todayWorkout ? "#333" : "#111",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 22, color: "#fff" }}>
            {todaySplit.type === "rest" ? "😴" : "🏋️"}
          </Text>

          <Text style={{ color: "#fff", fontWeight: "800", marginTop: 8 }}>
            {todaySplit.type === "rest"
              ? "Rest Day"
              : todayWorkout
                ? "Train Again?"
                : "Start Workout"}
          </Text>

          <Text style={{ color: "#bbb", marginTop: 4 }}>
            {todaySplit.type === "rest"
              ? "Recovery screen"
              : todayWorkout
                ? "Already logged today"
                : "Log sets, reps, weight"}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          marginTop: 24,
          marginBottom: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800" }}>Recent Workouts</Text>

        <Pressable onPress={() => router.push("/workouts/history")}>
          <Text style={{ color: "#111", fontWeight: "900" }}>View All</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : recentWorkouts.length === 0 ? (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: "#eee",
          }}
        >
          <Text style={{ fontWeight: "700" }}>No workouts yet</Text>
          <Text style={{ color: "#666", marginTop: 6 }}>
            Start logging to see your progress.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentWorkouts}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/workouts/[id]",
                  params: { id: item.id },
                } as any)
              }
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: "#eee",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16 }}>
                    {formatWorkoutType(item.workout_type)}
                  </Text>

                  <Text style={{ color: "#666", marginTop: 4 }}>
                    {formatDate(item.workout_date)}
                    {item.duration_minutes
                      ? ` • ${item.duration_minutes} min`
                      : ""}
                  </Text>
                </View>

                <Text style={{ color: "#777", fontWeight: "800" }}>View</Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <MiniStat label="Sets" value={`${item.set_count || 0}`} />
                <MiniStat
                  label="Volume"
                  value={`${(item.total_volume || 0).toLocaleString()} kg`}
                />
              </View>

              {item.notes ? (
                <Text style={{ marginTop: 8, color: "#444" }}>
                  {item.notes}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: "#f4f4f4",
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: "#777" }}>{label}</Text>
      <Text style={{ fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

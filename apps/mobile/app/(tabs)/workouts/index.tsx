import { isOnline } from "@/lib/offlineCardio";
import { toLocalDateKey } from "@/lib/dates";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  cacheWorkoutSets,
  cacheWorkouts,
  getCachedWorkoutExercises,
  getCachedWorkoutSets,
  getCachedWorkouts,
  getOfflineWorkouts,
  mapCachedWorkout,
  mapOfflineWorkout,
  syncOfflineWorkouts,
} from "@/lib/offlineWorkouts";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  formatWorkoutType,
  getTodayWorkoutPlan,
  type WorkoutType,
} from "@/lib/workoutPlans";
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

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  set_count?: number;
  total_volume?: number;
  offline?: boolean;
};

type WorkoutSet = {
  workout_id: string;
  reps: number;
  weight_kg: number;
};

function getTodayDateString() {
  return toLocalDateKey();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkoutIndexScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [exerciseCount, setExerciseCount] = useState(0);

  const suggestedPlan = useMemo(() => getTodayWorkoutPlan(), []);

  async function loadWorkoutData(showLoader = true) {
    if (showLoader) setLoading(true);

    const online = await isOnline();
    const userId = await resolveOfflineUserId();

    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const today = getTodayDateString();
    let offlineWorkouts = (await getOfflineWorkouts()).map(mapOfflineWorkout);
    const cachedWorkouts = await getCachedWorkouts();
    const cachedSets = await getCachedWorkoutSets();
    const mappedCachedWorkouts = cachedWorkouts.map((workout) =>
      mapCachedWorkout(workout, cachedSets),
    );

    if (!online) {
      const cachedExercises = await getCachedWorkoutExercises();
      const cachedDates = new Set(
        mappedCachedWorkouts.map((workout) => workout.workout_date),
      );
      const merged = [
        ...offlineWorkouts.filter(
          (workout) => !cachedDates.has(workout.workout_date),
        ),
        ...mappedCachedWorkouts,
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));

      setRecentWorkouts(merged.slice(0, 5) as Workout[]);
      setExerciseCount(cachedExercises.length);
      setTodayWorkout(
        (merged.find((workout) => workout.workout_date === today) as
          | Workout
          | undefined) || null,
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    await syncOfflineWorkouts();
    offlineWorkouts = (await getOfflineWorkouts()).map(mapOfflineWorkout);

    const [{ data: workouts }, { count }, { data: todayWorkouts }] =
      await Promise.all([
        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", userId)
          .order("workout_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("exercises")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),

        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", userId)
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
      await cacheWorkoutSets(setRows);
    }
    await cacheWorkouts(workoutRows);

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

    setRecentWorkouts(
      [...offlineWorkouts, ...mappedWorkouts]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5) as Workout[],
    );
    setExerciseCount(count || 0);
    setTodayWorkout(
      ((todayWorkouts || [])[0] as Workout) ||
        ((offlineWorkouts.find((workout) => workout.workout_date === today) as
          | Workout
          | undefined) ||
          null),
    );

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkoutData(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      theme.setSessionTheme(suggestedPlan.type);
    }, [suggestedPlan.type]),
  );

  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, []),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          marginTop: 48,
          color: theme.colors.text,
        }}
      >
        Workouts
      </Text>
      <View
        style={{
          marginTop: 20,
          backgroundColor: theme.colors.primary,
          borderRadius: 20,
          padding: 18,
        }}
      >
        <Text style={{ color: theme.colors.textInverse, fontSize: 13 }}>
          {"Suggested Focus"}
        </Text>

        <Text
          style={{
            color: theme.colors.textInverse,
            fontSize: 26,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          {suggestedPlan.emoji} {suggestedPlan.label}
        </Text>

        <Text style={{ color: theme.colors.textInverse, marginTop: 8 }}>
          {suggestedPlan.type === "rest"
            ? "Recovery day. Keep it light, walk, stretch, or rest fully."
            : "You can switch focus when you start a workout."}
        </Text>
      </View>

      {todayWorkout && (
        <View
          style={{
            backgroundColor: theme.colors.primarySoft,
            borderRadius: 16,
            padding: 16,
            marginTop: 14,
            borderWidth: 1,
            borderColor: theme.colors.primary,
          }}
        >
          <Text style={{ fontWeight: "900", color: theme.colors.primary }}>
            ⚠️ Already logged today
          </Text>

          <Text
            style={{
              color: theme.colors.primary,
              marginTop: 6,
              fontWeight: "700",
            }}
          >
            {formatWorkoutType(todayWorkout.workout_type)}
            {todayWorkout.duration_minutes
              ? ` • ${todayWorkout.duration_minutes} min`
              : ""}
          </Text>

          <Text style={{ color: theme.colors.primary, marginTop: 6 }}>
            You’ve already completed today’s session. You can still train again,
            but rest and recovery are also important.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/workouts/setup",
              params: {
                split: suggestedPlan.type,
              },
            } as any)
          }
          style={{
            flex: 1,
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>

          <Text
            style={{
              fontWeight: "800",
              marginTop: 8,
              color: theme.colors.text,
            }}
          >
            Setup
          </Text>

          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            {exerciseCount} exercises
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/workouts/start")}
          style={{
            flex: 1,
            backgroundColor: todayWorkout
              ? theme.colors.surfaceAlt
              : theme.colors.primary,
            borderRadius: 16,
            padding: 16,
            borderWidth: todayWorkout ? 1 : 0,
            borderColor: todayWorkout ? theme.colors.border : "transparent",
          }}
        >
          <Text style={{ fontSize: 22 }}>
            {suggestedPlan.type === "rest" ? "😴" : "🏋️"}
          </Text>

          <Text
            style={{
              color: todayWorkout
                ? theme.colors.text
                : theme.colors.textInverse,
              fontWeight: "800",
              marginTop: 8,
            }}
          >
            {todayWorkout ? "Train Again?" : "Start Workout"}
          </Text>

          <Text
            style={{
              color: todayWorkout
                ? theme.colors.textMuted
                : theme.colors.textInverse,
              marginTop: 4,
            }}
          >
            {todayWorkout ? "Already logged today" : "Choose focus and log"}
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
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: theme.colors.text,
          }}
        >
          Recent Workouts
        </Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/workouts/history",
              params: {
                split: suggestedPlan.type,
              },
            } as any)
          }
        >
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>
            View All
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : recentWorkouts.length === 0 ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ fontWeight: "700", color: theme.colors.text }}>
            No workouts yet
          </Text>

          <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
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
              disabled={item.offline}
              onPress={() =>
                router.push({
                  pathname: "/workouts/[id]",
                  params: {
                    id: item.id,
                    split: item.workout_type,
                  },
                } as any)
              }
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                marginBottom: 10,
                opacity: item.offline ? 0.75 : 1,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: 16,
                      color: theme.colors.text,
                    }}
                  >
                    {formatWorkoutType(item.workout_type)}
                  </Text>

                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                    {formatDate(item.workout_date)}
                    {item.duration_minutes
                      ? ` • ${item.duration_minutes} min`
                      : ""}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <MiniStat label="Sets" value={`${item.set_count || 0}`} />

                  <MiniStat
                    label="Volume"
                    value={`${(item.total_volume || 0).toLocaleString()} kg`}
                  />
                </View>
              </View>
              {item.notes ? (
                <Text style={{ marginTop: 8, color: theme.colors.textMuted }}>
                  {item.notes}
                </Text>
              ) : null}
              {item.offline ? (
                <Text style={{ marginTop: 8, color: theme.colors.warning }}>
                  Waiting to sync
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
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
        {label}
      </Text>

      <Text style={{ fontWeight: "900", color: theme.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

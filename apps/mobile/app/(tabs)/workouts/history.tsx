import ActivityCalendar from "@/components/ActivityCalendar";
import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  cacheWorkoutSets,
  cacheWorkouts,
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
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { BarChart3, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  offline?: boolean;
};

type WorkoutSet = {
  workout_id: string;
  reps: number;
  weight_kg: number;
};

function isWorkoutType(value?: string | string[]): value is WorkoutType {
  return (
    value === "push" ||
    value === "pull" ||
    value === "legs" ||
    value === "upper" ||
    value === "lower" ||
    value === "rest"
  );
}

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ split?: WorkoutType }>();

  const currentSplit: WorkoutType = isWorkoutType(params.split)
    ? params.split
    : "push";

  const [sessions, setSessions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function handleClosePress() {
    router.back();
  }

  async function loadSessions(showLoader = false) {
    if (showLoader) setLoading(true);

    const online = await isOnline();
    const userId = await resolveOfflineUserId();

    if (!userId) {
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let offlineWorkouts = (await getOfflineWorkouts()).map(mapOfflineWorkout);
    const cachedWorkouts = await getCachedWorkouts();
    const cachedSets = await getCachedWorkoutSets();
    const mappedCachedWorkouts = cachedWorkouts.map((workout) =>
      mapCachedWorkout(workout, cachedSets),
    );

    if (!online) {
      const cachedDates = new Set(
        mappedCachedWorkouts.map((workout) => workout.workout_date),
      );
      setSessions(
        [
          ...offlineWorkouts.filter(
            (workout) => !cachedDates.has(workout.workout_date),
          ),
          ...mappedCachedWorkouts,
        ] as Workout[],
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    await syncOfflineWorkouts();
    offlineWorkouts = (await getOfflineWorkouts()).map(mapOfflineWorkout);

    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load workout history error:", error);
      setSessions([...offlineWorkouts, ...mappedCachedWorkouts] as Workout[]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const workoutRows = (data || []) as Workout[];
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

    setSessions(
      [...offlineWorkouts, ...mappedWorkouts].sort((a, b) => {
        const dateCompare = b.workout_date.localeCompare(a.workout_date);
        if (dateCompare !== 0) return dateCompare;
        return b.created_at.localeCompare(a.created_at);
      }) as Workout[],
    );
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      theme.setSessionTheme(currentSplit);
      loadSessions(true);

      return () => {
        theme.setSessionTheme("default");
      };
    }, [currentSplit]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadSessions(false);
  }

  const activeDates = useMemo(() => {
    const map: Record<string, number> = {};

    sessions.forEach((session) => {
      map[session.workout_date] = (map[session.workout_date] || 0) + 1;
    });

    return map;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter((s) => s.workout_date === selectedDate);
  }, [sessions, selectedDate]);

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

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function handleDatePress(date: string) {
    setSelectedDate((prev) => (prev === date ? null : date));
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <HistoryHeader
          theme={theme}
          topInset={insets.top}
          onClose={handleClosePress}
        />

        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <HistoryHeader
        theme={theme}
        topInset={insets.top}
        onClose={handleClosePress}
      />

      <FlatList
        style={{ flex: 1 }}
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 80,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 30,
                    fontWeight: "900",
                    color: theme.colors.text,
                  }}
                >
                  All Workouts
                </Text>

                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  Complete workout session history.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/workouts/reports",
                    params: { split: currentSplit },
                  } as any)
                }
                style={{
                  height: 42,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: theme.colors.primary,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <BarChart3 size={18} color={theme.colors.textInverse} />
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "900",
                  }}
                >
                  Reports
                </Text>
              </Pressable>
            </View>

            <ActivityCalendar
              activeDates={activeDates}
              marker="🏋️"
              selectedDate={selectedDate}
              onSelectDate={handleDatePress}
              clearSelectionOnMonthChange={() => setSelectedDate(null)}
            />
            <View
              style={{
                marginTop: 20,
                marginBottom: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {selectedDate ? "Selected Date" : "Sessions"}
              </Text>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontWeight: "800",
                }}
              >
                {filteredSessions.length}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              {selectedDate
                ? "No workout sessions on this date."
                : "No workout sessions yet."}
            </Text>
          </View>
        }
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
              borderRadius: 18,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor:
                item.workout_type === currentSplit
                  ? theme.colors.primary
                  : theme.colors.border,
              opacity: item.offline ? 0.75 : 1,
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
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: theme.colors.text,
                  }}
                >
                  {formatWorkoutType(item.workout_type)}
                </Text>

                <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                  {item.notes ? item.notes : "Workout session"}
                  {item.offline ? " - waiting to sync" : ""}
                </Text>
              </View>

              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {formatDate(item.workout_date)}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                marginTop: 12,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <MiniStat
                label="Duration"
                value={`${item.duration_minutes || 0} min`}
              />
              <MiniStat label="Sets" value={`${item.set_count || 0}`} />
              <MiniStat
                label="Volume"
                value={`${(item.total_volume || 0).toLocaleString()} kg`}
              />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function HistoryHeader({
  theme,
  topInset,
  onClose,
}: {
  theme: ReturnType<typeof useTheme>;
  topInset: number;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        paddingTop: topInset,
        height: topInset + 56,
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          width: 46,
          height: 46,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 4,
        }}
      >
        <X size={30} color={theme.colors.text} />
      </Pressable>
    </View>
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

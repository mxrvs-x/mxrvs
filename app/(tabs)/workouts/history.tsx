import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { X, ExpandIcon } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
  const params = useLocalSearchParams<{ split?: WorkoutType }>();

  const currentSplit: WorkoutType = isWorkoutType(params.split)
    ? params.split
    : "push";

  const [sessions, setSessions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  function handleClosePress() {
    router.back();
  }

  async function loadSessions(showLoader = false) {
    if (showLoader) setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load workout history error:", error);
      setSessions([]);
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

    setSessions(mappedWorkouts);
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

  function toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  const weekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);

      return {
        day: d.getDate(),
        date: toDateKey(d),
        label: ["S", "M", "T", "W", "T", "F", "S"][index],
      };
    });
  }, []);

  const monthDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const firstWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: {
      date: string | null;
      day: number | null;
    }[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push({ date: null, day: null });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(calendarYear, calendarMonth, day);

      days.push({
        date: toDateKey(date),
        day,
      });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  function changeMonth(direction: "prev" | "next") {
    const nextDate = new Date(calendarYear, calendarMonth, 1);

    if (direction === "prev") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    setCalendarMonth(nextDate.getMonth());
    setCalendarYear(nextDate.getFullYear());
    setSelectedDate(null);
  }

  function monthTitle() {
    return new Date(calendarYear, calendarMonth, 1).toLocaleDateString(
      "en-PH",
      {
        month: "long",
        year: "numeric",
      },
    );
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
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
        }}
      >
        <Stack.Screen
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerBackVisible: false,
            headerTitle: "",
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerTintColor: theme.colors.text,
            headerLeft: () => (
              <Pressable
                onPress={handleClosePress}
                style={{
                  width: 42,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={30} color={theme.colors.text} />
              </Pressable>
            ),
          }}
        />

        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitle: "",
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.text,
          headerLeft: () => (
            <Pressable
              onPress={handleClosePress}
              style={{
                width: 42,
                height: 42,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={30} color={theme.colors.text} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        style={{ flex: 1, backgroundColor: theme.colors.background }}
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
            </View>

            <View
              style={{
                marginTop: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
                padding: 14,
              }}
            >
              {!calendarExpanded ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      This Week
                    </Text>

                    <Pressable
                      onPress={() => setCalendarExpanded(true)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                      }}
                    >
                      <ExpandIcon size={18} color={theme.colors.primary} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {weekDays.map((item) => {
                      const isSelected = selectedDate === item.date;
                      const isToday = item.date === toDateKey(new Date());
                      const hasWorkout = activeDates[item.date] > 0;

                      return (
                        <Pressable
                          key={item.date}
                          onPress={() => handleDatePress(item.date)}
                          style={{
                            flex: 1,
                            backgroundColor: isSelected
                              ? theme.colors.primary
                              : isToday
                                ? theme.colors.primarySoft
                                : theme.colors.background,
                            borderRadius: 14,
                            paddingVertical: 10,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: isSelected
                                ? theme.colors.textInverse
                                : theme.colors.textMuted,
                              fontWeight: "800",
                            }}
                          >
                            {item.label}
                          </Text>

                          <Text
                            style={{
                              marginTop: 4,
                              fontSize: 15,
                              fontWeight: "900",
                              color: isSelected
                                ? theme.colors.textInverse
                                : theme.colors.text,
                            }}
                          >
                            {item.day}
                          </Text>

                          <Text style={{ fontSize: 12, marginTop: 2 }}>
                            {hasWorkout ? "🏋️" : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => changeMonth("prev")}
                      style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: theme.colors.text,
                        }}
                      >
                        ‹
                      </Text>
                    </Pressable>

                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      {monthTitle()}
                    </Text>

                    <Pressable
                      onPress={() => changeMonth("next")}
                      style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: theme.colors.text,
                        }}
                      >
                        ›
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", marginBottom: 6 }}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
                      <Text
                        key={`${d}-${index}`}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          color: theme.colors.textMuted,
                          fontWeight: "800",
                          fontSize: 11,
                        }}
                      >
                        {d}
                      </Text>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {monthDays.map((item, index) => {
                      const isSelected = item.date === selectedDate;
                      const isToday = item.date === toDateKey(new Date());
                      const hasWorkout = item.date
                        ? activeDates[item.date] > 0
                        : false;

                      return (
                        <Pressable
                          key={`${item.date || "empty"}-${index}`}
                          disabled={!item.date}
                          onPress={() => {
                            if (item.date) handleDatePress(item.date);
                          }}
                          style={{
                            width: `${100 / 7}%`,
                            paddingVertical: 4,
                            alignItems: "center",
                          }}
                        >
                          {item.day ? (
                            <View
                              style={{
                                width: 34,
                                height: 40,
                                borderRadius: 14,
                                overflow: "hidden",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isSelected
                                  ? theme.colors.primary
                                  : isToday
                                    ? theme.colors.primarySoft
                                    : "transparent",
                                borderWidth: isSelected || isToday ? 1 : 0,
                                borderColor: isSelected
                                  ? theme.colors.primary
                                  : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "900",
                                  color: isSelected
                                    ? theme.colors.textInverse
                                    : theme.colors.text,
                                }}
                              >
                                {item.day}
                              </Text>

                              <Text style={{ fontSize: 10 }}>
                                {hasWorkout ? "🏋️" : ""}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ width: 34, height: 40 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={() => setCalendarExpanded(false)}
                    style={{
                      padding: 10,
                      alignItems: "center",
                    }}
                  >
                    <X size={24} color={theme.colors.primary} />
                  </Pressable>
                </>
              )}
            </View>

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
    </>
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

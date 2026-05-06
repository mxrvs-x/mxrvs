import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
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

export default function WorkoutHistoryScreen() {
  const router = useRouter();

  const [sessions, setSessions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

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
      loadSessions(true);
    }, []),
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
          backgroundColor: "#f7f7f7",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
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
              marginTop: 48,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={{ fontSize: 30, fontWeight: "900" }}>
                All Workouts
              </Text>

              <Text style={{ color: "#666", marginTop: 4 }}>
                Complete workout session history.
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={{
                backgroundColor: "#fff",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontWeight: "900" }}>Back</Text>
            </Pressable>
          </View>

          <View
            style={{
              marginTop: 16,
              backgroundColor: "#fff",
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
                  <Text style={{ fontSize: 16, fontWeight: "900" }}>
                    This Week
                  </Text>

                  <Pressable
                    onPress={() => setCalendarExpanded(true)}
                    style={{
                      backgroundColor: "#f4f4f4",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "900" }}>Expand</Text>
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
                            ? "#111"
                            : isToday
                              ? "#eee"
                              : "#f7f7f7",
                          borderRadius: 14,
                          paddingVertical: 10,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: isSelected ? "#fff" : "#777",
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
                            color: isSelected ? "#fff" : "#111",
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
                      backgroundColor: "#f4f4f4",
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "900" }}>‹</Text>
                  </Pressable>

                  <Text style={{ fontSize: 16, fontWeight: "900" }}>
                    {monthTitle()}
                  </Text>

                  <Pressable
                    onPress={() => changeMonth("next")}
                    style={{
                      backgroundColor: "#f4f4f4",
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "900" }}>›</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", marginBottom: 6 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
                    <Text
                      key={`${d}-${index}`}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        color: "#777",
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
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: isSelected
                                ? "#111"
                                : isToday
                                  ? "#eee"
                                  : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "900",
                                color: isSelected ? "#fff" : "#111",
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
                    marginTop: 10,
                    backgroundColor: "#f4f4f4",
                    padding: 10,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>
                    Collapse to Current Week
                  </Text>
                </Pressable>
              </>
            )}

            {selectedDate && (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: "#f4f4f4",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ fontWeight: "900" }}>
                  {activeDates[selectedDate] || 0} workout
                  {(activeDates[selectedDate] || 0) === 1 ? "" : "s"} on{" "}
                  {formatDate(selectedDate)}
                </Text>

                <Pressable onPress={() => setSelectedDate(null)}>
                  <Text style={{ color: "#666", marginTop: 6 }}>
                    Clear date filter
                  </Text>
                </Pressable>
              </View>
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
            <Text style={{ fontSize: 20, fontWeight: "900" }}>
              {selectedDate ? "Selected Date" : "Sessions"}
            </Text>

            <Text style={{ color: "#777", fontWeight: "800" }}>
              {filteredSessions.length}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#777" }}>
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
              params: { id: item.id },
            } as any)
          }
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
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
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                {formatWorkoutType(item.workout_type)}
              </Text>

              <Text style={{ color: "#666", marginTop: 2 }}>
                {item.notes ? item.notes : "Workout session"}
              </Text>
            </View>

            <Text style={{ color: "#777", fontSize: 12 }}>
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

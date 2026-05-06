import {
    getOfflineCardioSessions,
    syncOfflineCardioSessions,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import NetInfo from "@react-native-community/netinfo";
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

type CardioSession = {
  id: string;
  cardio_type: "walking" | "running";
  cardio_source: "outdoor" | "treadmill" | "manual";
  session_date: string;
  distance_km: number;
  duration_seconds: number;
  calories_burned: number | null;
  is_mock?: boolean;
  offline?: boolean;
};

export default function CardioHistoryScreen() {
  const router = useRouter();

  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  async function loadSessions(showLoader = false) {
    if (showLoader) setLoading(true);

    const net = await NetInfo.fetch();
    const isOnline = Boolean(
      net.isConnected && net.isInternetReachable !== false,
    );

    if (isOnline) {
      await syncOfflineCardioSessions();
    }

    const offlineSessions = await getOfflineCardioSessions();

    const mappedOffline: CardioSession[] = offlineSessions.map((s) => ({
      id: s.temp_id,
      cardio_type: s.cardio_type,
      cardio_source: s.cardio_source,
      session_date: s.session_date,
      distance_km: s.distance_km,
      duration_seconds: s.duration_seconds,
      calories_burned: s.calories_burned,
      is_mock: s.is_mock,
      offline: true,
    }));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isOnline) {
      setSessions(mappedOffline);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, is_mock",
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load cardio history error:", error);
      setSessions(mappedOffline);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const combined = [...mappedOffline, ...(data || [])].sort(
      (a, b) =>
        new Date(b.session_date).getTime() - new Date(a.session_date).getTime(),
    );

    setSessions(combined);
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
      map[session.session_date] = (map[session.session_date] || 0) + 1;
    });

    return map;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter((s) => s.session_date === selectedDate);
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

  function formatTime(sec: number) {
    if (!sec) return "0:00";

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function paceText(distance: number, seconds: number) {
    if (!distance || !seconds) return "—";

    const pace = seconds / 60 / distance;
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60);

    return `${m}:${String(s).padStart(2, "0")}/km`;
  }

  function sourceText(source: CardioSession["cardio_source"]) {
    if (source === "outdoor") return "Outdoor";
    if (source === "treadmill") return "Treadmill";
    return "Manual";
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
          <Text style={{ fontSize: 30, fontWeight: "900" }}>
            All Activities
          </Text>

          <Text style={{ color: "#666", marginTop: 4 }}>
            Complete cardio history.
          </Text>

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
                    const hasActivity = activeDates[item.date] > 0;

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
                          {hasActivity ? "🔥" : ""}
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
                    const hasActivity = item.date
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
                              {hasActivity ? "🔥" : ""}
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
                  {activeDates[selectedDate] || 0} record
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
              {selectedDate ? "Selected Date" : "Activities"}
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
              ? "No cardio records on this date."
              : "No cardio sessions yet."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          disabled={item.offline}
          onPress={() =>
            router.push({
              pathname: "/cardio/[id]",
              params: { id: item.id },
            } as any)
          }
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            opacity: item.offline ? 0.75 : 1,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                {item.cardio_type === "running" ? "Run" : "Walk"}
              </Text>

              <Text style={{ color: "#666", marginTop: 2 }}>
                {sourceText(item.cardio_source)}
                {item.is_mock ? " • Mock" : ""}
                {item.offline ? " • Waiting to sync" : ""}
              </Text>
            </View>

            <Text style={{ color: "#777", fontSize: 12 }}>
              {formatDate(item.session_date)}
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
            <MiniStat label="Distance" value={`${item.distance_km} km`} />
            <MiniStat label="Time" value={formatTime(item.duration_seconds)} />
            <MiniStat
              label="Pace"
              value={paceText(item.distance_km, item.duration_seconds)}
            />
            <MiniStat
              label="Calories"
              value={`${item.calories_burned || 0} kcal`}
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

import ActivityCalendar from "@/components/ActivityCalendar";
import { AppTheme, useTheme } from "@/lib/theme";
import {
  cacheCardioSessions,
  getCachedCardioSessions,
  getOfflineCardioSessions,
  mapOfflineCardioSession,
  syncOfflineCardioSessions,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import NetInfo from "@react-native-community/netinfo";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text as RNText,
  View,
} from "react-native";
import { BarChart3, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const Text = (props: any) => (
    <RNText {...props} style={[{ color: theme.colors.text }, props.style]} />
  );

  const router = useRouter();

  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function loadSessions(showLoader = false) {
    if (showLoader) setLoading(true);

    const net = await NetInfo.fetch();
    const isOnline = Boolean(
      net.isConnected && net.isInternetReachable !== false,
    );

    if (isOnline) {
      await syncOfflineCardioSessions();
    }

    const cachedSessions = (await getCachedCardioSessions()) as CardioSession[];
    const mappedOffline = (await getOfflineCardioSessions()).map(
      mapOfflineCardioSession,
    ) as CardioSession[];

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isOnline) {
      const cachedDates = new Set(cachedSessions.map((session) => session.session_date));
      setSessions(
        [
          ...mappedOffline.filter(
            (session) => !cachedDates.has(session.session_date),
          ),
          ...cachedSessions,
        ].sort(
          (a, b) =>
            new Date(b.session_date).getTime() -
            new Date(a.session_date).getTime(),
        ),
      );
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
      setSessions([...mappedOffline, ...cachedSessions]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    await cacheCardioSessions(data as any);

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
          backgroundColor: theme.colors.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <HistoryHeader
        theme={theme}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <FlatList
        style={{ flex: 1 }}
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
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
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 30, fontWeight: "900" }}>
                  All Activities
                </Text>

                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  Complete cardio history.
                </Text>
              </View>

              <Pressable
                onPress={() => router.push("/cardio/reports" as any)}
                style={{
                  height: 42,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: theme.colors.text,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <BarChart3 size={18} color={theme.colors.surface} />
                <Text
                  style={{
                    color: theme.colors.surface,
                    fontWeight: "900",
                  }}
                >
                  Reports
                </Text>
              </Pressable>
            </View>

            <ActivityCalendar
              activeDates={activeDates}
              marker="🔥"
              selectedDate={selectedDate}
              onSelectDate={handleDatePress}
              clearSelectionOnMonthChange={() => setSelectedDate(null)}
            >
              {selectedDate && (
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: theme.colors.surfaceAlt,
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
                    <Text
                      style={{ color: theme.colors.textMuted, marginTop: 6 }}
                    >
                      Clear date filter
                    </Text>
                  </Pressable>
                </View>
              )}
            </ActivityCalendar>
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

              <Text
                style={{ color: theme.colors.textFaint, fontWeight: "800" }}
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
            <Text style={{ color: theme.colors.textFaint }}>
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
              backgroundColor: theme.colors.surface,
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

                <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                  {sourceText(item.cardio_source)}
                  {item.is_mock ? " • Mock" : ""}
                  {item.offline ? " • Waiting to sync" : ""}
                </Text>
              </View>

              <Text style={{ color: theme.colors.textFaint, fontSize: 12 }}>
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
              <MiniStat
                theme={theme}
                label="Distance"
                value={`${item.distance_km} km`}
              />
              <MiniStat
                theme={theme}
                label="Time"
                value={formatTime(item.duration_seconds)}
              />
              <MiniStat
                theme={theme}
                label="Pace"
                value={paceText(item.distance_km, item.duration_seconds)}
              />
              <MiniStat
                theme={theme}
                label="Calories"
                value={`${item.calories_burned || 0} kcal`}
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
  theme: AppTheme;
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

function MiniStat({
  theme,
  label,
  value,
}: {
  theme: AppTheme;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <RNText style={{ fontSize: 11, color: theme.colors.textFaint }}>
        {label}
      </RNText>
      <RNText style={{ color: theme.colors.text, fontWeight: "900" }}>
        {value}
      </RNText>
    </View>
  );
}

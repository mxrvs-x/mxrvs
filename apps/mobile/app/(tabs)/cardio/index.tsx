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
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as RNText,
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

export default function CardioHome() {
  const theme = useTheme();
  const Text = (props: any) => (
    <RNText {...props} style={[{ color: theme.colors.text }, props.style]} />
  );

  const router = useRouter();

  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      const merged = [
        ...mappedOffline.filter((session) => !cachedDates.has(session.session_date)),
        ...cachedSessions,
      ].sort(
        (a, b) =>
          new Date(b.session_date).getTime() -
          new Date(a.session_date).getTime(),
      );

      setSessions(merged.slice(0, 5));
      setWeeklySessions(merged);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const sevenDaysAgoString = sevenDaysAgo.toISOString().split("T")[0];

    const { data: recentData, error: recentError } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, is_mock",
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: weeklyData, error: weeklyError } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, is_mock",
      )
      .eq("user_id", user.id)
      .gte("session_date", sevenDaysAgoString)
      .order("session_date", { ascending: false });

    if (recentError) console.log("Load recent cardio error:", recentError);
    if (weeklyError) console.log("Load weekly cardio error:", weeklyError);
    if (weeklyData) {
      await cacheCardioSessions(weeklyData as any);
    }

    const combinedRecent = [...mappedOffline, ...(recentData || [])]
      .sort(
        (a, b) =>
          new Date(b.session_date).getTime() -
          new Date(a.session_date).getTime(),
      )
      .slice(0, 5);

    const combinedWeekly = [...mappedOffline, ...(weeklyData || [])];

    setSessions(combinedRecent);
    setWeeklySessions(combinedWeekly);
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

  const weekly = useMemo(() => {
    return {
      sessions: weeklySessions.length,
      distance: weeklySessions.reduce(
        (sum, s) => sum + Number(s.distance_km || 0),
        0,
      ),
      duration: weeklySessions.reduce(
        (sum, s) => sum + Number(s.duration_seconds || 0),
        0,
      ),
      calories: weeklySessions.reduce(
        (sum, s) => sum + Number(s.calories_burned || 0),
        0,
      ),
    };
  }, [weeklySessions]);

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
      month: "short",
      day: "numeric",
    });
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
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
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
        Cardio
      </Text>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <StartButton
          theme={theme}
          label="Run"
          emoji="🏃"
          onPress={() => router.push("/cardio/run" as any)}
        />
        <StartButton
          theme={theme}
          label="Walk"
          emoji="🚶"
          onPress={() => router.push("/cardio/walk" as any)}
        />
      </View>

      <View
        style={{
          marginTop: 20,
          backgroundColor: theme.colors.surface,
          borderRadius: 20,
          padding: 16,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Last 7 Days</Text>

        <View style={{ flexDirection: "row", marginTop: 12, gap: 12 }}>
          <Stat theme={theme} label="Sessions" value={`${weekly.sessions}`} />
          <Stat
            theme={theme}
            label="Distance"
            value={`${weekly.distance.toFixed(2)} km`}
          />
        </View>

        <View style={{ flexDirection: "row", marginTop: 12, gap: 12 }}>
          <Stat
            theme={theme}
            label="Time"
            value={formatTime(weekly.duration)}
          />
          <Stat
            theme={theme}
            label="Calories"
            value={`${Math.round(weekly.calories)} kcal`}
          />
        </View>
      </View>

      <View
        style={{
          marginTop: 24,
          marginBottom: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900" }}>
          Recent Activities
        </Text>

        <Pressable onPress={() => router.push("/cardio/history" as any)}>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>
            View All
          </Text>
        </Pressable>
      </View>

      {sessions.length === 0 ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.colors.textFaint }}>
            No cardio yet. Start your first session.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
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
      )}
    </ScrollView>
  );
}

function StartButton({
  theme,
  label,
  emoji,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: theme.colors.text,
        padding: 18,
        borderRadius: 18,
        alignItems: "center",
      }}
    >
      <RNText style={{ fontSize: 22 }}>{emoji}</RNText>
      <RNText
        style={{ color: theme.colors.surface, fontWeight: "900", marginTop: 6 }}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

function Stat({
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
        flex: 1,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <RNText style={{ color: theme.colors.textFaint, fontSize: 12 }}>
        {label}
      </RNText>
      <RNText
        style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}
      >
        {value}
      </RNText>
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

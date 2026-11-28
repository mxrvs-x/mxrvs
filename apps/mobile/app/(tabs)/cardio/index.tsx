import DailyActivityHistory from "@/components/DailyActivityHistory";
import { toLocalDateKey } from "@/lib/dates";
import {
  getDailyActivitySnapshot,
  refreshDailyActivity,
  requestDailyActivityPermission,
  subscribeDailyActivity,
} from "@/lib/dailyActivity";
import { AppTheme, useTheme } from "@/lib/theme";
import {
  cacheCardioSessions,
  getCachedCardioSessions,
  getOfflineCardioSessions,
  mapOfflineCardioSession,
  mergeCardioSessions,
  syncOfflineCardioSessions,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const { view } = useLocalSearchParams<{ view?: string }>();
  const daily = view === "daily";
  const dailyActivity = useSyncExternalStore(
    subscribeDailyActivity,
    getDailyActivitySnapshot,
    getDailyActivitySnapshot,
  );

  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadSessions(showLoader = false) {
    if (showLoader) setLoading(true);

    await refreshDailyActivity();

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
      const merged = mergeCardioSessions(mappedOffline, cachedSessions);

      setSessions(merged.slice(0, 5));
      setWeeklySessions(merged);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const sevenDaysAgoString = toLocalDateKey(sevenDaysAgo);

    const { data: recentData, error: recentError } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, is_mock, created_at",
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: weeklyData, error: weeklyError } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, is_mock, created_at",
      )
      .eq("user_id", user.id)
      .gte("session_date", sevenDaysAgoString)
      .order("session_date", { ascending: false });

    if (recentError) console.log("Load recent cardio error:", recentError);
    if (weeklyError) console.log("Load weekly cardio error:", weeklyError);
    if (weeklyData) {
      await cacheCardioSessions(weeklyData as any);
    }

    const combinedRecent = mergeCardioSessions(
      mappedOffline,
      recentData || [],
    ).slice(0, 5);

    const combinedWeekly = mergeCardioSessions(mappedOffline, weeklyData || []);

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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Cardio</Text>
        <View accessibilityRole="tablist" style={[styles.views, { backgroundColor: theme.colors.surface }]}>
          {(["sessions", "daily"] as const).map((tab) => {
            const selected = daily === (tab === "daily");
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => router.setParams({ view: tab })}
                style={[
                  styles.view,
                  selected && { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.primary },
                ]}
              >
                <Text style={[styles.viewLabel, { color: selected ? theme.colors.primary : theme.colors.textMuted }]}>
                  {tab === "daily" ? "Daily Activity" : "Sessions"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        key={daily ? "daily" : "sessions"}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={daily ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {daily ? (
          <>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
                padding: 16,
              }}
            >
              <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "900" }}>
                Today&apos;s activity
              </Text>

              {!dailyActivity.available ? (
                <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>
                  A native step-counter sensor is not available on this device.
                </Text>
              ) : !dailyActivity.permissionGranted ? (
                <>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>
                    Enable Physical Activity access to show daily steps.
                  </Text>
                  <Pressable
                    onPress={() => void requestDailyActivityPermission()}
                    style={{
                      marginTop: 12,
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                      backgroundColor: theme.colors.text,
                    }}
                  >
                    <Text
                      style={{ color: theme.colors.surface, fontWeight: "900" }}
                    >
                      Enable Daily Steps
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", marginTop: 12, gap: 10 }}>
                    <Stat
                      theme={theme}
                      label="Steps"
                      value={dailyActivity.steps.toLocaleString()}
                    />
                    <Stat
                      theme={theme}
                      label="Moving Time"
                      value={formatTime(dailyActivity.movingSeconds)}
                    />
                    <Stat
                      theme={theme}
                      label="Est. Calories"
                      value={
                        dailyActivity.weightKg
                          ? `${dailyActivity.caloriesBurned} kcal`
                          : "Log weight"
                      }
                    />
                  </View>

                  <Text
                    style={{
                      color: theme.colors.textFaint,
                      marginTop: 12,
                      lineHeight: 18,
                      fontSize: 12,
                    }}
                  >
                    Moving time is estimated from your steps
                    {dailyActivity.weightKg
                      ? `; calories use your latest ${dailyActivity.weightKg.toFixed(1)} kg log.`
                      : "; log today’s weight for a calorie estimate."}
                  </Text>

                  {dailyActivity.trackingScope === "while-app-running" ? (
                    <Text
                      style={{
                        color: theme.colors.textFaint,
                        marginTop: 6,
                        lineHeight: 18,
                        fontSize: 12,
                      }}
                    >
                      On Android, this build records daily steps while mxrvs is
                      running. Full closed-app history requires Health Connect.
                    </Text>
                  ) : null}
                </>
              )}
            </View>
            <DailyActivityHistory />
          </>
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
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

            <Pressable
              onPress={() => router.push("/cardio/manual" as any)}
              style={{
                minHeight: 50,
                marginTop: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
                Add session manually
              </Text>
            </Pressable>

            <View
              style={{
                marginTop: 20,
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "900" }}>Last 7 days</Text>

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
                Recent sessions
              </Text>

              <Pressable onPress={() => router.push("/cardio/history" as any)}>
                <Text style={{ fontWeight: "900", color: theme.colors.primary }}>
                  View history
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  title: { fontSize: 28, fontWeight: "900" },
  views: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14 },
  view: { flex: 1, minHeight: 44, justifyContent: "center", padding: 6, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  viewLabel: { textAlign: "center", fontWeight: "800" },
  content: { padding: 16, paddingBottom: 20, gap: 12 },
});

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

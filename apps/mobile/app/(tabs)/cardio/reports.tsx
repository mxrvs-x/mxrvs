import {
  cacheCardioSessions,
  getCachedCardioSessions,
  getOfflineCardioSessions,
  mapOfflineCardioSession,
  syncOfflineCardioSessions,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import NetInfo from "@react-native-community/netinfo";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

type CardioType = "walking" | "running";

type CardioSource = "outdoor" | "treadmill" | "manual";

type CardioSession = {
  id: string;
  cardio_type: CardioType;
  cardio_source: CardioSource;
  session_date: string;
  distance_km: number;
  duration_seconds: number;
  calories_burned: number | null;
  steps: number | null;
  created_at?: string;
  offline?: boolean;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function paceText(distanceKm: number, seconds: number) {
  if (distanceKm <= 0 || seconds <= 0) return "-";

  const pace = seconds / 60 / distanceKm;
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);

  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function sourceText(source: CardioSource) {
  if (source === "outdoor") return "Outdoor";
  if (source === "treadmill") return "Treadmill";
  return "Manual";
}

function n(value: number | null | undefined) {
  return Number(value || 0);
}

export default function CardioReportsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [selectedType, setSelectedType] = useState<CardioType>("running");

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => session.cardio_type === selectedType)
      .sort((a, b) => {
        const dateCompare = a.session_date.localeCompare(b.session_date);
        if (dateCompare !== 0) return dateCompare;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });
  }, [selectedType, sessions]);

  const prDistance = useMemo(() => {
    return Math.max(...filteredSessions.map((session) => n(session.distance_km)), 0);
  }, [filteredSessions]);

  const latestSession = filteredSessions[filteredSessions.length - 1] || null;
  const totalDistance = filteredSessions.reduce(
    (sum, session) => sum + n(session.distance_km),
    0,
  );
  const totalDuration = filteredSessions.reduce(
    (sum, session) => sum + n(session.duration_seconds),
    0,
  );
  const totalCalories = filteredSessions.reduce(
    (sum, session) => sum + n(session.calories_burned),
    0,
  );
  const totalSteps = filteredSessions.reduce(
    (sum, session) => sum + n(session.steps),
    0,
  );
  const bestPaceSession = [...filteredSessions]
    .filter((session) => n(session.distance_km) > 0 && n(session.duration_seconds) > 0)
    .sort((a, b) => {
      return (
        n(a.duration_seconds) / n(a.distance_km) -
        n(b.duration_seconds) / n(b.distance_km)
      );
    })[0];

  async function loadReports(showLoader = false) {
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
        ] as CardioSession[],
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from("cardio_sessions")
      .select(
        "id, cardio_type, cardio_source, session_date, distance_km, duration_seconds, calories_burned, steps, created_at",
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.log("Load cardio reports error:", error);
      setSessions([...mappedOffline, ...cachedSessions] as CardioSession[]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    await cacheCardioSessions(data as any);
    setSessions([...mappedOffline, ...((data || []) as CardioSession[])]);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadReports(true);
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadReports(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ReportHeader
          theme={theme}
          topInset={insets.top}
          onClose={() => router.back()}
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
      <ReportHeader
        theme={theme}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 30,
            fontWeight: "900",
          }}
        >
          Cardio Reports
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Run and walk progress with distance PRs.
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 18,
          }}
        >
          <TypeButton
            type="running"
            label="Run"
            active={selectedType === "running"}
            onPress={() => setSelectedType("running")}
          />
          <TypeButton
            type="walking"
            label="Walk"
            active={selectedType === "walking"}
            onPress={() => setSelectedType("walking")}
          />
        </View>

        {filteredSessions.length === 0 ? (
          <View
            style={{
              marginTop: 18,
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              No {selectedType === "running" ? "run" : "walk"} sessions yet.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                marginTop: 18,
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                {selectedType === "running" ? "Run" : "Walk"} Details
              </Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                {filteredSessions.length} total sessions
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <ReportStat label="Distance PR" value={`${prDistance.toFixed(2)} km`} />
                <ReportStat
                  label="Latest"
                  value={`${n(latestSession?.distance_km).toFixed(2)} km`}
                />
                <ReportStat
                  label="Best Pace"
                  value={
                    bestPaceSession
                      ? paceText(
                          n(bestPaceSession.distance_km),
                          n(bestPaceSession.duration_seconds),
                        )
                      : "-"
                  }
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <ReportStat
                  label="Total Km"
                  value={`${totalDistance.toFixed(2)}`}
                />
                <ReportStat label="Time" value={formatTime(totalDuration)} />
                <ReportStat
                  label="Calories"
                  value={`${Math.round(totalCalories)} kcal`}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <ReportStat
                  label="Steps"
                  value={totalSteps.toLocaleString()}
                />
                <ReportStat
                  label="Last Source"
                  value={latestSession ? sourceText(latestSession.cardio_source) : "-"}
                />
                <ReportStat
                  label="Last Date"
                  value={latestSession ? formatShortDate(latestSession.session_date) : "-"}
                />
              </View>
            </View>

            <CardioChart
              sessions={filteredSessions}
              prDistance={prDistance}
              theme={theme}
            />

            <Text
              style={{
                color: theme.colors.text,
                fontSize: 20,
                fontWeight: "900",
                marginTop: 22,
                marginBottom: 10,
              }}
            >
              Progress Log
            </Text>

            {[...filteredSessions].reverse().map((session) => {
              const isPr = n(session.distance_km) === prDistance;

              return (
                <View
                  key={`${session.id}-${session.offline ? "offline" : "online"}`}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: isPr ? theme.colors.primary : theme.colors.border,
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
                          color: theme.colors.text,
                          fontSize: 16,
                          fontWeight: "900",
                        }}
                      >
                        {formatDate(session.session_date)}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                        {sourceText(session.cardio_source)}
                        {session.offline ? " - Waiting to sync" : ""}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      {isPr ? (
                        <Text
                          style={{
                            color: theme.colors.primary,
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          PR
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          color: theme.colors.primary,
                          fontWeight: "900",
                        }}
                      >
                        {n(session.distance_km).toFixed(2)} km
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <ReportStat
                      label="Time"
                      value={formatTime(n(session.duration_seconds))}
                    />
                    <ReportStat
                      label="Pace"
                      value={paceText(
                        n(session.distance_km),
                        n(session.duration_seconds),
                      )}
                    />
                    <ReportStat
                      label="Steps"
                      value={n(session.steps).toLocaleString()}
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CardioChart({
  sessions,
  prDistance,
  theme,
}: {
  sessions: CardioSession[];
  prDistance: number;
  theme: AppTheme;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(300, width - 32);
  const chartHeight = 230;
  const left = 44;
  const right = 16;
  const top = 24;
  const bottom = 54;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const visibleSessions = sessions.slice(-12);
  const maxDistance = Math.max(
    ...visibleSessions.map((session) => n(session.distance_km)),
    1,
  );
  const maxMinutes = Math.max(
    ...visibleSessions.map((session) => n(session.duration_seconds) / 60),
    1,
  );
  const slotWidth = plotWidth / Math.max(visibleSessions.length, 1);
  const barGap = 3;
  const barWidth = Math.max(6, Math.min(18, (slotWidth - barGap * 3) / 2));
  const showEveryLabel =
    visibleSessions.length <= 6 ? 1 : visibleSessions.length <= 9 ? 2 : 3;

  return (
    <View
      style={{
        marginTop: 18,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontWeight: "900",
          marginBottom: 8,
        }}
      >
        Distance and Time
      </Text>

      <Svg width={chartWidth - 24} height={chartHeight}>
        {[0, 0.5, 1].map((tick) => {
          const y = top + plotHeight - plotHeight * tick;
          return (
            <Line
              key={tick}
              x1={left}
              x2={chartWidth - right - 24}
              y1={y}
              y2={y}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          );
        })}

        {visibleSessions.map((session, index) => {
          const slotX = left + index * slotWidth;
          const groupWidth = barWidth * 2 + barGap;
          const groupX = slotX + (slotWidth - groupWidth) / 2;
          const distance = n(session.distance_km);
          const minutes = n(session.duration_seconds) / 60;
          const distanceHeight = (distance / maxDistance) * plotHeight;
          const timeHeight = (minutes / maxMinutes) * plotHeight;
          const shouldShowLabel =
            index === 0 ||
            index === visibleSessions.length - 1 ||
            index % showEveryLabel === 0;

          return (
            <Fragment key={`${session.id}-${session.offline ? "offline" : "online"}`}>
              <Rect
                x={groupX}
                y={top + plotHeight - distanceHeight}
                width={barWidth}
                height={distanceHeight}
                rx={4}
                fill={theme.colors.primary}
              />
              <Rect
                x={groupX + barWidth + barGap}
                y={top + plotHeight - timeHeight}
                width={barWidth}
                height={timeHeight}
                rx={4}
                fill={theme.colors.info}
              />
              {distance === prDistance ? (
                <SvgText
                  x={groupX + barWidth / 2}
                  y={Math.max(10, top + plotHeight - distanceHeight - 6)}
                  fill={theme.colors.primary}
                  fontSize={9}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  PR
                </SvgText>
              ) : null}
              {shouldShowLabel ? (
                <SvgText
                  x={slotX + slotWidth / 2}
                  y={chartHeight - 24}
                  fill={theme.colors.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {formatShortDate(session.session_date)}
                </SvgText>
              ) : null}
            </Fragment>
          );
        })}

        <SvgText
          x={left}
          y={top - 8}
          fill={theme.colors.textMuted}
          fontSize={10}
        >
          {maxDistance.toFixed(1)} km
        </SvgText>
        <SvgText
          x={left}
          y={top + plotHeight + 34}
          fill={theme.colors.textFaint}
          fontSize={9}
        >
          Last {visibleSessions.length} logged sessions
        </SvgText>
      </Svg>

      <View style={{ flexDirection: "row", gap: 14, marginTop: 4 }}>
        <LegendDot color={theme.colors.primary} label="Distance" />
        <LegendDot color={theme.colors.info} label="Time" />
      </View>
    </View>
  );
}

function TypeButton({
  type,
  label,
  active,
  onPress,
}: {
  type: CardioType;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = type === "running" ? theme.colors.running : theme.colors.walking;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: active ? color : theme.colors.surface,
        borderRadius: 16,
        padding: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: active ? color : theme.colors.border,
      }}
    >
      <Text
        style={{
          color: active ? theme.colors.textInverse : theme.colors.text,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ReportHeader({
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

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
        }}
      />
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        minHeight: 62,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: theme.colors.text,
          fontWeight: "900",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

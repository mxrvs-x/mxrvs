import { isOnline } from "@/lib/offlineCardio";
import { loadBodyWeightLogs } from "@/lib/offlineWeight";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

type BodyWeightLog = {
  id: string;
  date: string;
  logged_at: string | null;
  weight_kg: number;
  body_fat_percent: number | null;
  created_at: string | null;
};

function n(value: number | null | undefined) {
  return Number(value || 0);
}

function formatNumber(value: number, unit = "") {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}${unit}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function logTime(log: BodyWeightLog) {
  return new Date(log.logged_at || log.created_at || `${log.date}T00:00:00`);
}

function latestDailyLogs(logs: BodyWeightLog[]) {
  const byDate = new Map<string, BodyWeightLog>();

  logs.forEach((log) => {
    const existing = byDate.get(log.date);

    if (!existing || logTime(log).getTime() > logTime(existing).getTime()) {
      byDate.set(log.date, log);
    }
  });

  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export default function WeightReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<BodyWeightLog[]>([]);

  const dailyLogs = useMemo(() => latestDailyLogs(logs), [logs]);
  const latestLog = dailyLogs[dailyLogs.length - 1] || null;
  const firstLog = dailyLogs[0] || null;
  const latestFatLog =
    [...dailyLogs].reverse().find((log) => log.body_fat_percent != null) || null;

  const weightDelta =
    latestLog && firstLog ? n(latestLog.weight_kg) - n(firstLog.weight_kg) : 0;
  const highestWeight = Math.max(...dailyLogs.map((log) => n(log.weight_kg)), 0);
  const lowestWeight =
    dailyLogs.length > 0
      ? Math.min(...dailyLogs.map((log) => n(log.weight_kg)))
      : 0;
  const averageRecent =
    dailyLogs.length > 0
      ? dailyLogs
          .slice(-7)
          .reduce((sum, log) => sum + n(log.weight_kg), 0) /
        Math.min(dailyLogs.length, 7)
      : 0;

  const weeklyRate = useMemo(() => {
    if (!firstLog || !latestLog || firstLog.date === latestLog.date) return 0;

    const first = new Date(`${firstLog.date}T00:00:00`).getTime();
    const latest = new Date(`${latestLog.date}T00:00:00`).getTime();
    const days = Math.max((latest - first) / 86400000, 1);

    return (weightDelta / days) * 7;
  }, [firstLog, latestLog, weightDelta]);

  async function loadReports(showLoader = false) {
    if (showLoader) setLoading(true);

    const userId = await resolveOfflineUserId();

    if (!userId) {
      setLogs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const offlineCapableLogs = await loadBodyWeightLogs();

    if (!(await isOnline())) {
      setLogs(offlineCapableLogs as BodyWeightLog[]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from("body_weight_logs")
      .select("id, date, logged_at, weight_kg, body_fat_percent, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("logged_at", { ascending: true });

    if (error) {
      console.log("Load weight reports error:", error);
      setLogs(offlineCapableLogs as BodyWeightLog[]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const onlineLogs = (data || []) as BodyWeightLog[];
    const onlineDates = new Set(onlineLogs.map((log) => log.date));
    setLogs(
      [
        ...((offlineCapableLogs as BodyWeightLog[]).filter(
          (log) => !onlineDates.has(log.date),
        )),
        ...onlineLogs,
      ] as BodyWeightLog[],
    );
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
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <ReportHeader
          theme={theme}
          onClose={() => router.replace("/(tabs)/profile" as any)}
        />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ReportHeader
        theme={theme}
        onClose={() => router.replace("/(tabs)/profile" as any)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 30,
            fontWeight: "900",
          }}
        >
          Weight Reports
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Body weight trend and cardio estimate inputs.
        </Text>

        {dailyLogs.length === 0 ? (
          <View style={cardStyle(theme, 18)}>
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
              No weight logs yet.
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Log weight from Profile to start building your trend.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <ReportStat
                theme={theme}
                label="Current"
                value={formatNumber(n(latestLog?.weight_kg), " kg")}
                detail={latestLog ? formatDate(latestLog.date) : "--"}
              />
              <ReportStat
                theme={theme}
                label="Change"
                value={`${weightDelta >= 0 ? "+" : ""}${formatNumber(
                  weightDelta,
                  " kg",
                )}`}
                detail="Since first log"
              />
              <ReportStat
                theme={theme}
                label="7-log Avg"
                value={formatNumber(averageRecent, " kg")}
                detail="Recent average"
              />
              <ReportStat
                theme={theme}
                label="Low / High"
                value={`${formatNumber(lowestWeight)} / ${formatNumber(
                  highestWeight,
                )}`}
                detail="kg range"
              />
              <ReportStat
                theme={theme}
                label="Weekly Pace"
                value={`${weeklyRate >= 0 ? "+" : ""}${formatNumber(
                  weeklyRate,
                  " kg",
                )}`}
                detail="Estimated trend"
              />
              <ReportStat
                theme={theme}
                label="Body Fat"
                value={
                  latestFatLog?.body_fat_percent != null
                    ? formatNumber(n(latestFatLog.body_fat_percent), "%")
                    : "--"
                }
                detail={latestFatLog ? formatDate(latestFatLog.date) : "Optional"}
              />
            </View>

            <View style={cardStyle(theme, 18)}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: "900",
                }}
              >
                Weight Trend
              </Text>
              <WeightChart
                logs={dailyLogs}
                theme={theme}
                width={Math.max(width - 64, 240)}
              />
            </View>

            <Text
              style={{
                marginTop: 18,
                marginBottom: 10,
                color: theme.colors.text,
                fontSize: 20,
                fontWeight: "900",
              }}
            >
              Recent Logs
            </Text>

            {[...dailyLogs].reverse().map((log) => (
              <View key={log.id} style={logRowStyle(theme)}>
                <View>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
                    {formatDate(log.date)}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                    {log.body_fat_percent != null
                      ? `${formatNumber(n(log.body_fat_percent), "%")} body fat`
                      : "Body fat not logged"}
                  </Text>
                </View>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  {formatNumber(n(log.weight_kg), " kg")}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeightChart({
  logs,
  theme,
  width,
}: {
  logs: BodyWeightLog[];
  theme: AppTheme;
  width: number;
}) {
  const height = 220;
  const left = 44;
  const right = 12;
  const top = 22;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const weights = logs.map((log) => n(log.weight_kg));
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = Math.max(maxWeight - minWeight, 1);

  const points = logs.map((log, index) => {
    const x =
      logs.length === 1
        ? left + plotWidth / 2
        : left + (index / (logs.length - 1)) * plotWidth;
    const y = top + plotHeight - ((n(log.weight_kg) - minWeight) / range) * plotHeight;

    return { x, y, log };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const ySteps = [maxWeight, (maxWeight + minWeight) / 2, minWeight];

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width={width} height={height}>
        {ySteps.map((value, index) => {
          const y =
            top + plotHeight - ((value - minWeight) / range) * plotHeight;

          return (
            <Fragment key={`${value}-${index}`}>
              <Line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={0}
                y={y + 4}
                fill={theme.colors.textFaint}
                fontSize="10"
                fontWeight="700"
              >
                {formatNumber(value)}
              </SvgText>
            </Fragment>
          );
        })}

        {points.length > 1 ? (
          <Polyline
            points={linePoints}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.map((point) => (
          <Circle
            key={point.log.id}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={theme.colors.primary}
          />
        ))}

        <SvgText
          x={left}
          y={height - 8}
          fill={theme.colors.textFaint}
          fontSize="10"
          fontWeight="700"
        >
          {formatDate(logs[0].date)}
        </SvgText>
        <SvgText
          x={width - right}
          y={height - 8}
          fill={theme.colors.textFaint}
          fontSize="10"
          fontWeight="700"
          textAnchor="end"
        >
          {formatDate(logs[logs.length - 1].date)}
        </SvgText>
      </Svg>
    </View>
  );
}

function ReportHeader({
  theme,
  onClose,
}: {
  theme: AppTheme;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        height: 56,
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

function ReportStat({
  theme,
  label,
  value,
  detail,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View
      style={{
        marginTop: 18,
        flexGrow: 1,
        flexBasis: "31%",
        minWidth: 106,
        padding: 12,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: "900",
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={{ marginTop: 4, color: theme.colors.textFaint, fontSize: 11 }}>
        {detail}
      </Text>
    </View>
  );
}

function cardStyle(theme: AppTheme, marginTop: number) {
  return {
    marginTop,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  };
}

function logRowStyle(theme: AppTheme) {
  return {
    marginBottom: 10,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 12,
  };
}

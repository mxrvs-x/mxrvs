import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { ChevronDown, X } from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

type RangeKey =
  | "today"
  | "week"
  | "twoWeeks"
  | "threeWeeks"
  | "fourWeeks"
  | "eightWeeks"
  | "sixMonths";

type BodyWeightLog = {
  id: string;
  date: string;
  logged_at?: string | null;
  weight_kg: number | string | null;
  body_fat_percent?: number | string | null;
  created_at?: string | null;
};

type DailyWeight = {
  date: string;
  label: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  logged_at: string | null;
};

type ReportRange = {
  key: RangeKey;
  label: string;
  start: Date;
  end: Date;
};

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 Days" },
  { key: "twoWeeks", label: "Last 2 Weeks" },
  { key: "threeWeeks", label: "Last 3 Weeks" },
  { key: "fourWeeks", label: "Last 4 Weeks" },
  { key: "eightWeeks", label: "Last 8 Weeks" },
  { key: "sixMonths", label: "Last 6 Months" },
];

const CHART_HEIGHT = 230;
const CHART_TOP = 18;
const CHART_BOTTOM = 38;
const CHART_LEFT = 36;
const CHART_RIGHT = 14;

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  const days: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(localDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function rangeForKey(key: RangeKey): ReportRange {
  const today = new Date();
  const daysBack =
    key === "sixMonths"
      ? 182
      : key === "eightWeeks"
        ? 55
        : key === "fourWeeks"
          ? 27
          : key === "threeWeeks"
            ? 20
            : key === "twoWeeks"
              ? 13
              : key === "week"
                ? 6
                : 0;

  const option = RANGE_OPTIONS.find((item) => item.key === key);

  return {
    key,
    label: option?.label ?? "Last 7 Days",
    start: addDays(today, -daysBack),
    end: today,
  };
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatRangeDate(date: Date) {
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(value?: number | null, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(decimals);
}

function n(value?: number | string | null) {
  return Number(value ?? 0);
}

function aggregateWeightLogs(logs: BodyWeightLog[], range: ReportRange) {
  const byDate = new Map<string, DailyWeight>();

  for (const date of daysBetween(range.start, range.end)) {
    byDate.set(date, {
      date,
      label: formatShortDate(dateFromKey(date)),
      weight_kg: null,
      body_fat_percent: null,
      logged_at: null,
    });
  }

  const sortedLogs = [...logs].sort((a, b) => {
    const aTime = new Date(a.logged_at || a.created_at || a.date).getTime();
    const bTime = new Date(b.logged_at || b.created_at || b.date).getTime();

    return aTime - bTime;
  });

  sortedLogs.forEach((log) => {
    const date = String(log.date);
    const existing = byDate.get(date);

    if (!existing) return;

    existing.weight_kg = n(log.weight_kg);
    existing.body_fat_percent =
      log.body_fat_percent === null || log.body_fat_percent === undefined
        ? null
        : n(log.body_fat_percent);
    existing.logged_at = log.logged_at || log.created_at || null;
  });

  return Array.from(byDate.values());
}

function compactChartData(days: DailyWeight[]) {
  const filled = days.filter((day) => day.weight_kg !== null);

  if (filled.length <= 56) return filled;

  const grouped = new Map<string, DailyWeight>();
  const useMonth = filled.length > 120;

  filled.forEach((day, index) => {
    const date = dateFromKey(day.date);
    const bucketKey = useMonth
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `week-${Math.floor(index / 7)}`;

    grouped.set(bucketKey, {
      ...day,
      label: useMonth
        ? date.toLocaleDateString("en-PH", { month: "short" })
        : formatShortDate(date),
    });
  });

  return Array.from(grouped.values());
}

export default function BodyWeightReportScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [logs, setLogs] = useState<BodyWeightLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const range = useMemo(() => rangeForKey(rangeKey), [rangeKey]);
  const chartWidth = Math.min(680, Math.max(220, Math.floor(width - 64)));

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  const loadReport = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("body_weight_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", localDateString(range.start))
      .lte("date", localDateString(range.end))
      .order("date", { ascending: true })
      .order("logged_at", { ascending: true });

    if (error) {
      console.log("Load body weight report error:", error);
      showAlert("Report Error", "Could not load your body weight report.");
      setLogs([]);
    } else {
      setLogs((data ?? []) as BodyWeightLog[]);
    }

    setLoading(false);
  }, [range.end, range.start]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function handleClosePress() {
    router.back();
  }

  const dailyWeights = useMemo(
    () => aggregateWeightLogs(logs, range),
    [logs, range],
  );
  const filledDays = useMemo(
    () => dailyWeights.filter((day) => day.weight_kg !== null),
    [dailyWeights],
  );
  const chartData = useMemo(
    () => compactChartData(dailyWeights),
    [dailyWeights],
  );
  const firstWeight = filledDays[0]?.weight_kg ?? null;
  const currentWeight = filledDays[filledDays.length - 1]?.weight_kg ?? null;
  const change =
    firstWeight !== null && currentWeight !== null
      ? currentWeight - firstWeight
      : null;
  const averageWeight =
    filledDays.length > 0
      ? filledDays.reduce((sum, day) => sum + n(day.weight_kg), 0) /
        filledDays.length
      : null;
  const currentBodyFat =
    filledDays
      .slice()
      .reverse()
      .find((day) => day.body_fat_percent !== null)?.body_fat_percent ?? null;

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

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ marginTop: 18 }}>
          <Pressable
            onPress={() => setRangeMenuOpen((open) => !open)}
            style={{
              minHeight: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: rangeMenuOpen
                ? theme.colors.primary
                : theme.colors.border,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              {range.label}
            </Text>
            <ChevronDown size={20} color={theme.colors.textMuted} />
          </Pressable>

          {rangeMenuOpen ? (
            <View
              style={{
                marginTop: 8,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                overflow: "hidden",
              }}
            >
              {RANGE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setRangeKey(option.key);
                    setRangeMenuOpen(false);
                  }}
                  style={{
                    minHeight: 46,
                    paddingHorizontal: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    backgroundColor:
                      option.key === rangeKey
                        ? theme.colors.surfaceAlt
                        : theme.colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontWeight: option.key === rangeKey ? "900" : "700",
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ margin: 24 }}
          />
        ) : null}

        <ReportCard
          theme={theme}
          range={range}
          chartWidth={chartWidth}
          chartData={chartData}
          dailyWeights={dailyWeights}
          currentWeight={currentWeight}
          firstWeight={firstWeight}
          change={change}
          averageWeight={averageWeight}
          currentBodyFat={currentBodyFat}
          logCount={logs.length}
          activeDays={filledDays.length}
        />
      </ScrollView>

      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}

function ReportCard({
  theme,
  range,
  chartWidth,
  chartData,
  dailyWeights,
  currentWeight,
  firstWeight,
  change,
  averageWeight,
  currentBodyFat,
  logCount,
  activeDays,
}: {
  theme: AppTheme;
  range: ReportRange;
  chartWidth: number;
  chartData: DailyWeight[];
  dailyWeights: DailyWeight[];
  currentWeight: number | null;
  firstWeight: number | null;
  change: number | null;
  averageWeight: number | null;
  currentBodyFat: number | null;
  logCount: number;
  activeDays: number;
}) {
  const changeColor =
    change === null
      ? theme.colors.textMuted
      : change > 0
        ? theme.colors.warning
        : change < 0
          ? theme.colors.success
          : theme.colors.primary;

  return (
    <View
      style={{
        marginTop: 18,
        backgroundColor: theme.colors.surface,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 24,
          fontWeight: "900",
        }}
      >
        {range.label} Body Weight Report
      </Text>

      <Text
        style={{
          color: theme.colors.textMuted,
          marginTop: 4,
          fontWeight: "700",
        }}
      >
        {formatRangeDate(range.start)} - {formatRangeDate(range.end)}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <SummaryTile
          theme={theme}
          label="Current"
          value={formatNumber(currentWeight)}
          unit="kg"
          color={theme.colors.primary}
        />
        <SummaryTile
          theme={theme}
          label="Change"
          value={
            change === null
              ? "--"
              : `${change > 0 ? "+" : ""}${change.toFixed(1)}`
          }
          unit="kg"
          color={changeColor}
        />
        <SummaryTile
          theme={theme}
          label="Average"
          value={formatNumber(averageWeight)}
          unit="kg"
          color={theme.colors.info}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <SummaryTile
          theme={theme}
          label="Start"
          value={formatNumber(firstWeight)}
          unit="kg"
          color={theme.colors.text}
        />
        <SummaryTile
          theme={theme}
          label="Body Fat"
          value={formatNumber(currentBodyFat)}
          unit="%"
          color={theme.colors.fat}
        />
        <SummaryTile
          theme={theme}
          label="Logs"
          value={`${logCount}`}
          unit={`${activeDays} days`}
          color={theme.colors.carbs}
        />
      </View>

      <View
        style={{
          marginTop: 16,
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: 18,
          padding: 14,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: "900",
            fontSize: 16,
          }}
        >
          Weight Trend
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            marginTop: 3,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          Latest log per day
        </Text>

        <WeightTrendChart theme={theme} data={chartData} width={chartWidth} />
      </View>

      {dailyWeights.every((day) => day.weight_kg === null) ? (
        <Text
          style={{
            marginTop: 16,
            color: theme.colors.textMuted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          No body weight logs found for this range.
        </Text>
      ) : null}

      <Text
        style={{
          marginTop: 16,
          color: theme.colors.textFaint,
          fontSize: 11,
          textAlign: "center",
          fontWeight: "800",
        }}
      >
        mxrvs body weight report
      </Text>
    </View>
  );
}

function WeightTrendChart({
  theme,
  data,
  width,
}: {
  theme: AppTheme;
  data: DailyWeight[];
  width: number;
}) {
  const chartWidth = width - CHART_LEFT - CHART_RIGHT;
  const chartHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const weights = data
    .map((day) => day.weight_kg)
    .filter((value): value is number => value !== null);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = Math.max(1, (maxWeight - minWeight) * 0.2);
  const minValue = weights.length ? minWeight - padding : 0;
  const maxValue = weights.length ? maxWeight + padding : 1;
  const labelIndexes = new Set(
    data.length <= 1 ? [0] : [0, Math.floor(data.length / 2), data.length - 1],
  );

  function xFor(index: number) {
    if (data.length <= 1) return CHART_LEFT + chartWidth / 2;
    return CHART_LEFT + (index / (data.length - 1)) * chartWidth;
  }

  function yFor(value: number) {
    if (maxValue === minValue) return CHART_TOP + chartHeight / 2;
    return (
      CHART_TOP +
      chartHeight -
      ((value - minValue) / (maxValue - minValue)) * chartHeight
    );
  }

  const points = data
    .map((day, index) =>
      day.weight_kg === null
        ? null
        : {
            index,
            value: day.weight_kg,
          },
    )
    .filter(
      (point): point is { index: number; value: number } => point !== null,
    );
  const path = points
    .map(
      (point, pointIndex) =>
        `${pointIndex === 0 ? "M" : "L"} ${xFor(point.index)} ${yFor(
          point.value,
        )}`,
    )
    .join(" ");

  return (
    <View style={{ alignItems: "center", marginTop: 12 }}>
      <Svg width={width} height={CHART_HEIGHT}>
        <Rect
          x={CHART_LEFT}
          y={CHART_TOP}
          width={chartWidth}
          height={chartHeight}
          fill={theme.mode === "dark" ? "#111827" : "#FFFFFF"}
          rx={10}
        />

        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = CHART_TOP + chartHeight - chartHeight * tick;

          return (
            <Rect
              key={tick}
              x={CHART_LEFT}
              y={y}
              width={chartWidth}
              height={1}
              fill={theme.colors.border}
              opacity={0.8}
            />
          );
        })}

        {path ? (
          <Path
            d={path}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {data.map((day, index) =>
          day.weight_kg !== null ? (
            <Circle
              key={`${day.date}-${index}`}
              cx={xFor(index)}
              cy={yFor(day.weight_kg)}
              r={4.5}
              fill={theme.colors.primary}
            />
          ) : null,
        )}

        {data.map((day, index) =>
          labelIndexes.has(index) ? (
            <SvgText
              key={`label-${day.date}-${index}`}
              x={xFor(index)}
              y={CHART_HEIGHT - 10}
              fill={theme.colors.textMuted}
              fontSize="10"
              textAnchor="middle"
            >
              {day.label}
            </SvgText>
          ) : null,
        )}

        <SvgText
          x={CHART_LEFT - 5}
          y={CHART_TOP + 8}
          fill={theme.colors.textMuted}
          fontSize="10"
          textAnchor="end"
        >
          {weights.length ? maxValue.toFixed(1) : "--"}
        </SvgText>
        <SvgText
          x={CHART_LEFT - 5}
          y={CHART_TOP + chartHeight}
          fill={theme.colors.textMuted}
          fontSize="10"
          textAnchor="end"
        >
          {weights.length ? minValue.toFixed(1) : "--"}
        </SvgText>
      </Svg>
    </View>
  );
}

function SummaryTile({
  theme,
  label,
  value,
  unit,
  color,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 92,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <Text style={{ color: theme.colors.textFaint, fontSize: 11 }}>
        {label}
      </Text>
      <Text
        style={{
          color,
          fontSize: 20,
          fontWeight: "900",
          marginTop: 4,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {unit}
      </Text>
    </View>
  );
}

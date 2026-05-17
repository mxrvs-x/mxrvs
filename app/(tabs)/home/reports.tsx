import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { ChevronDown, Download, Share2 } from "lucide-react-native";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";

type RangeKey =
  | "week"
  | "month"
  | "twoWeeks"
  | "threeWeeks"
  | "fourWeeks"
  | "lastMonth"
  | "sixMonths";

type FoodLog = {
  date: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

type DailyTotals = {
  date: string;
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  count: number;
};

type ReportRange = {
  key: RangeKey;
  label: string;
  start: Date;
  end: Date;
};

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "twoWeeks", label: "Last 2 Weeks" },
  { key: "threeWeeks", label: "Last 3 Weeks" },
  { key: "fourWeeks", label: "Last 4 Weeks" },
  { key: "lastMonth", label: "Last Month" },
  { key: "sixMonths", label: "Last 6 Months" },
];

const CHART_HEIGHT = 214;
const CHART_TOP = 18;
const CHART_BOTTOM = 34;
const CHART_LEFT = 26;
const CHART_RIGHT = 10;

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
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

function n(value?: number | string | null) {
  return Number(value ?? 0);
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

function rangeForKey(key: RangeKey): ReportRange {
  const today = new Date();

  if (key === "month") {
    return {
      key,
      label: "This Month",
      start: startOfMonth(today),
      end: today,
    };
  }

  if (key === "lastMonth") {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    return {
      key,
      label: "Last Month",
      start: startOfMonth(lastMonth),
      end: endOfMonth(lastMonth),
    };
  }

  if (key === "sixMonths") {
    return {
      key,
      label: "Last 6 Months",
      start: addDays(today, -182),
      end: today,
    };
  }

  if (key === "fourWeeks") {
    return {
      key,
      label: "Last 4 Weeks",
      start: addDays(today, -27),
      end: today,
    };
  }

  const days = key === "threeWeeks" ? 20 : key === "twoWeeks" ? 13 : 6;

  return {
    key,
    label:
      key === "threeWeeks"
        ? "Last 3 Weeks"
        : key === "twoWeeks"
          ? "Last 2 Weeks"
          : "Last 7 Days",
    start: addDays(today, -days),
    end: today,
  };
}

function aggregateLogs(logs: FoodLog[], range: ReportRange) {
  const byDate = new Map<string, DailyTotals>();

  for (const date of daysBetween(range.start, range.end)) {
    byDate.set(date, {
      date,
      label: formatShortDate(dateFromKey(date)),
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      count: 0,
    });
  }

  for (const log of logs) {
    const date = String(log.date);
    const existing = byDate.get(date);

    if (!existing) continue;

    existing.calories += n(log.calories);
    existing.protein_g += n(log.protein_g);
    existing.carbs_g += n(log.carbs_g);
    existing.fat_g += n(log.fat_g);
    existing.fiber_g += n(log.fiber_g);
    existing.count += 1;
  }

  return Array.from(byDate.values());
}

function bucketForChart(days: DailyTotals[]) {
  if (days.length <= 35) return days;

  const grouped = new Map<string, DailyTotals>();
  const useMonth = days.length > 120;

  days.forEach((day, index) => {
    const date = dateFromKey(day.date);
    const bucketKey = useMonth
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `week-${Math.floor(index / 7)}`;
    const label = useMonth
      ? date.toLocaleDateString("en-PH", { month: "short" })
      : `${formatShortDate(dateFromKey(days[Math.floor(index / 7) * 7].date))}`;

    const current =
      grouped.get(bucketKey) ??
      ({
        date: day.date,
        label,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        count: 0,
      } satisfies DailyTotals);

    current.calories += day.calories;
    current.protein_g += day.protein_g;
    current.carbs_g += day.carbs_g;
    current.fat_g += day.fat_g;
    current.fiber_g += day.fiber_g;
    current.count += day.count;

    grouped.set(bucketKey, current);
  });

  return Array.from(grouped.values());
}

function macroCalories(day: DailyTotals) {
  return day.protein_g * 4 + day.carbs_g * 4 + day.fat_g * 9;
}

function macroPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reportRef = useRef<View>(null);

  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const range = useMemo(() => rangeForKey(rangeKey), [rangeKey]);
  const chartWidth = Math.min(680, Math.max(200, Math.floor(width - 112)));

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
      .from("food_logs")
      .select("date, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", user.id)
      .gte("date", localDateString(range.start))
      .lte("date", localDateString(range.end))
      .order("date", { ascending: true });

    if (error) {
      console.log("Load report food logs error:", error);
      showAlert("Report Error", "Could not load your food log report.");
      setLogs([]);
    } else {
      setLogs((data ?? []) as FoodLog[]);
    }

    setLoading(false);
  }, [range.end, range.start]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const dailyTotals = useMemo(() => aggregateLogs(logs, range), [logs, range]);
  const chartData = useMemo(
    () =>
      range.key === "sixMonths" ? dailyTotals : bucketForChart(dailyTotals),
    [dailyTotals, range.key],
  );

  const totals = useMemo(
    () =>
      dailyTotals.reduce(
        (acc, day) => {
          acc.calories += day.calories;
          acc.protein_g += day.protein_g;
          acc.carbs_g += day.carbs_g;
          acc.fat_g += day.fat_g;
          acc.fiber_g += day.fiber_g;
          acc.count += day.count;
          return acc;
        },
        {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          count: 0,
        },
      ),
    [dailyTotals],
  );

  const activeDays = dailyTotals.filter((day) => day.count > 0).length;
  const dayCount = Math.max(1, dailyTotals.length);
  const proteinCalories = totals.protein_g * 4;
  const carbsCalories = totals.carbs_g * 4;
  const fatCalories = totals.fat_g * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

  async function captureReportImage() {
    if (!reportRef.current) return null;

    await new Promise((resolve) => requestAnimationFrame(resolve));

    return captureRef(reportRef.current, {
      format: "png",
      quality: 1,
      fileName: `mxrvs-macro-report-${range.key}`,
      result: "tmpfile",
    });
  }

  async function saveReportImage() {
    if (exporting) return;

    try {
      setExporting(true);

      const uri = await captureReportImage();

      if (!uri) {
        showAlert("Export Failed", "Report image is not ready yet.");
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
      ]);

      if (!permission.granted) {
        showAlert(
          "Permission Required",
          "Please allow photo access so mxrvs can save report images.",
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      showAlert("Saved", "Macro report PNG saved to your gallery.");
    } catch (error) {
      console.log("Save report image error:", error);
      showAlert(
        "Export Failed",
        "Something went wrong while saving the PNG.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function shareReportImage() {
    if (exporting) return;

    try {
      setExporting(true);

      const uri = await captureReportImage();

      if (!uri) {
        showAlert("Share Failed", "Report image is not ready yet.");
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        showAlert("Sharing Unavailable", "Sharing is not available here.");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `${range.label} Macro Report`,
        UTI: "public.png",
      });
    } catch (error) {
      console.log("Share report image error:", error);
      showAlert(
        "Share Failed",
        "Something went wrong while sharing the PNG.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 20,
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

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <Pressable
          onPress={saveReportImage}
          disabled={loading || exporting}
          style={{
            flex: 1,
            height: 50,
            borderRadius: 16,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: loading || exporting ? 0.65 : 1,
          }}
        >
          <Download size={18} color={theme.colors.textInverse} />
          <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
            Save PNG
          </Text>
        </Pressable>

        <Pressable
          onPress={shareReportImage}
          disabled={loading || exporting}
          style={{
            flex: 1,
            height: 50,
            borderRadius: 16,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: loading || exporting ? 0.65 : 1,
          }}
        >
          <Share2 size={18} color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
            Share
          </Text>
        </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ margin: 24 }}
          />
        ) : null}

        <ReportCard
          refView={reportRef}
          theme={theme}
          range={range}
          totals={totals}
          dailyTotals={dailyTotals}
          chartData={chartData}
          chartWidth={chartWidth}
          activeDays={activeDays}
          dayCount={dayCount}
          proteinPercent={macroPercent(proteinCalories, totalMacroCalories)}
          carbsPercent={macroPercent(carbsCalories, totalMacroCalories)}
          fatPercent={macroPercent(fatCalories, totalMacroCalories)}
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
  refView,
  theme,
  range,
  totals,
  dailyTotals,
  chartData,
  chartWidth,
  activeDays,
  dayCount,
  proteinPercent,
  carbsPercent,
  fatPercent,
}: {
  refView: RefObject<View | null>;
  theme: AppTheme;
  range: ReportRange;
  totals: Omit<DailyTotals, "date" | "label">;
  dailyTotals: DailyTotals[];
  chartData: DailyTotals[];
  chartWidth: number;
  activeDays: number;
  dayCount: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
}) {
  const averageCalories = totals.calories / dayCount;

  return (
    <View
      ref={refView}
      collapsable={false}
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
        {range.label} Macro Report
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

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <SummaryTile
          theme={theme}
          label="Calories"
          value={`${Math.round(totals.calories)}`}
          unit="kcal"
          color={theme.colors.calories}
        />
        <SummaryTile
          theme={theme}
          label="Avg / Day"
          value={`${Math.round(averageCalories)}`}
          unit="kcal"
          color={theme.colors.primary}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <SummaryTile
          theme={theme}
          label="Logs"
          value={`${totals.count}`}
          unit={`${activeDays} days`}
          color={theme.colors.info}
        />
        <SummaryTile
          theme={theme}
          label="Fiber"
          value={`${Math.round(totals.fiber_g)}`}
          unit="g"
          color={theme.colors.fiber}
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
          Energy Consumed (kcal)
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            marginTop: 3,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {formatRangeDate(range.start)} to {formatRangeDate(range.end)}
        </Text>

        <MacroStackedChart
          theme={theme}
          data={chartData}
          width={chartWidth}
          mode={range.key === "sixMonths" ? "area" : "bar"}
        />

        <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
          <Legend color={theme.colors.protein} label="Protein" />
          <Legend color={theme.colors.carbs} label="Carbs" />
          <Legend color={theme.colors.fat} label="Fat" />
        </View>
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
          Macro Split
        </Text>

        <MacroRow
          theme={theme}
          label="Protein"
          value={`${Math.round(totals.protein_g)}g`}
          percent={proteinPercent}
          color={theme.colors.protein}
        />
        <MacroRow
          theme={theme}
          label="Carbs"
          value={`${Math.round(totals.carbs_g)}g`}
          percent={carbsPercent}
          color={theme.colors.carbs}
        />
        <MacroRow
          theme={theme}
          label="Fat"
          value={`${Math.round(totals.fat_g)}g`}
          percent={fatPercent}
          color={theme.colors.fat}
        />
      </View>

      {dailyTotals.every((day) => day.count === 0) ? (
        <Text
          style={{
            marginTop: 16,
            color: theme.colors.textMuted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          No food logs found for this range.
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
        mxrvs food log report
      </Text>
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
          fontSize: 22,
          fontWeight: "900",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {unit}
      </Text>
    </View>
  );
}

function MacroStackedChart({
  theme,
  data,
  width,
  mode,
}: {
  theme: AppTheme;
  data: DailyTotals[];
  width: number;
  mode: "bar" | "area";
}) {
  const chartWidth = width - CHART_LEFT - CHART_RIGHT;
  const chartHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const maxValue = Math.max(1, ...data.map(macroCalories));
  const barGap = data.length > 28 ? 1.5 : data.length > 20 ? 2 : 4;
  const barWidth = Math.max(
    4,
    (chartWidth - barGap * (data.length - 1)) / Math.max(1, data.length),
  );
  const labelIndexes = new Set(
    mode === "area"
      ? [
          0,
          Math.floor(data.length * 0.25),
          Math.floor(data.length * 0.5),
          Math.floor(data.length * 0.75),
          data.length - 1,
        ]
      : [0, Math.floor(data.length / 2), data.length - 1],
  );

  function xFor(index: number) {
    if (data.length <= 1) return CHART_LEFT + chartWidth / 2;
    return CHART_LEFT + (index / (data.length - 1)) * chartWidth;
  }

  function yFor(value: number) {
    return CHART_TOP + chartHeight - (value / maxValue) * chartHeight;
  }

  function areaPath(upper: number[], lower: number[]) {
    if (upper.length === 0) return "";

    const upperPath = upper
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`,
      )
      .join(" ");
    const lowerPath = lower
      .map((_, index) => {
        const reverseIndex = lower.length - 1 - index;

        return `L ${xFor(reverseIndex)} ${yFor(lower[reverseIndex])}`;
      })
      .join(" ");

    return `${upperPath} ${lowerPath} Z`;
  }

  const proteinValues = data.map((day) => day.protein_g * 4);
  const carbsValues = data.map(
    (day, index) => proteinValues[index] + day.carbs_g * 4,
  );
  const fatValues = data.map(
    (day, index) => carbsValues[index] + day.fat_g * 9,
  );
  const zeroValues = data.map(() => 0);

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

        {mode === "area" ? (
          <>
            <Path
              d={areaPath(proteinValues, zeroValues)}
              fill={theme.colors.protein}
              opacity={0.78}
            />
            <Path
              d={areaPath(carbsValues, proteinValues)}
              fill={theme.colors.carbs}
              opacity={0.82}
            />
            <Path
              d={areaPath(fatValues, carbsValues)}
              fill={theme.colors.fat}
              opacity={0.86}
            />
          </>
        ) : (
          data.map((day, index) => {
            const x = CHART_LEFT + index * (barWidth + barGap);
            const proteinHeight =
              ((day.protein_g * 4) / maxValue) * chartHeight;
            const carbsHeight = ((day.carbs_g * 4) / maxValue) * chartHeight;
            const fatHeight = ((day.fat_g * 9) / maxValue) * chartHeight;
            let y = CHART_TOP + chartHeight;

            y -= fatHeight;
            const fatY = y;
            y -= carbsHeight;
            const carbsY = y;
            y -= proteinHeight;
            const proteinY = y;

            return (
              <Fragment key={`${day.date}-${index}`}>
                <Rect
                  x={x}
                  y={proteinY}
                  width={barWidth}
                  height={proteinHeight}
                  fill={theme.colors.protein}
                  rx={2}
                />
                <Rect
                  x={x}
                  y={carbsY}
                  width={barWidth}
                  height={carbsHeight}
                  fill={theme.colors.carbs}
                  rx={2}
                />
                <Rect
                  x={x}
                  y={fatY}
                  width={barWidth}
                  height={fatHeight}
                  fill={theme.colors.fat}
                  rx={2}
                />
              </Fragment>
            );
          })
        )}

        {data.map((day, index) =>
          labelIndexes.has(index) ? (
            <SvgText
              key={`label-${day.date}-${index}`}
              x={
                mode === "area"
                  ? xFor(index)
                  : CHART_LEFT + index * (barWidth + barGap) + barWidth / 2
              }
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
          x={CHART_LEFT - 4}
          y={CHART_TOP + 8}
          fill={theme.colors.textMuted}
          fontSize="10"
          textAnchor="end"
        >
          {Math.round(maxValue)}
        </SvgText>
        <SvgText
          x={CHART_LEFT - 4}
          y={CHART_TOP + chartHeight}
          fill={theme.colors.textMuted}
          fontSize="10"
          textAnchor="end"
        >
          0
        </SvgText>
      </Svg>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
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
      <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

function MacroRow({
  theme,
  label,
  value,
  percent,
  color,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
          {label}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>
          {value} - {percent}%
        </Text>
      </View>
      <View
        style={{
          height: 9,
          borderRadius: 999,
          backgroundColor: theme.colors.border,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        <View
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            height: "100%",
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

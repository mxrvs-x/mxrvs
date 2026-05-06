import FullNutritionDetails from "@/components/FullNutritionDetails";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { StepBack, StepForward } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type FoodLog = {
  id: string;
  log_date: string;
  meal_type: MealType;
  quantity: number;
  unit: string;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  cholesterol_mg?: number | null;

  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  magnesium_mg?: number | null;
  zinc_mg?: number | null;

  foods?: {
    id: string;
    name: string;
    brand: string | null;
    source: "custom" | "usda_fdc" | "nccdb";
  } | null;
};

type MacroTarget = {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  goal: "cut" | "maintain" | "bulk";
  activity_level: "sedentary" | "light" | "moderate" | "active";
};

type LoggedDateRow = {
  log_date: string;
};

const MEALS: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const DEFAULT_TARGETS = {
  calories_target: 2300,
  protein_target_g: 125,
  carbs_target_g: 300,
  fat_target_g: 65,
  fiber_target_g: 30,
};

function n(value?: number | null) {
  return Number(value ?? 0);
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatHeaderDate(date: Date) {
  const today = localDateString(new Date());
  const selected = localDateString(date);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateString(yesterdayDate);

  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: selected === today || selected === yesterday ? undefined : "numeric",
  });

  if (selected === today) return `Today, ${label}`;
  if (selected === yesterday) return `← Yesterday, ${label}`;
  if (selected < today) return `← ${label}`;
  return `${label} →`;
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

function goalLabel(goal?: string) {
  if (goal === "cut") return "Cut";
  if (goal === "bulk") return "Bulk";
  return "Maintain";
}

export default function DiaryScreen() {
  const theme = useTheme();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loggedDates, setLoggedDates] = useState<Record<string, number>>({});
  const [macroTarget, setMacroTarget] = useState<MacroTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedDateString = localDateString(selectedDate);

  const [calendarMonth, setCalendarMonth] = useState(selectedDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(selectedDate.getFullYear());

  const targets = {
    calories: Math.round(
      Number(macroTarget?.calories_target ?? DEFAULT_TARGETS.calories_target),
    ),
    protein_g: Math.round(
      Number(macroTarget?.protein_target_g ?? DEFAULT_TARGETS.protein_target_g),
    ),
    carbs_g: Math.round(
      Number(macroTarget?.carbs_target_g ?? DEFAULT_TARGETS.carbs_target_g),
    ),
    fat_g: Math.round(
      Number(macroTarget?.fat_target_g ?? DEFAULT_TARGETS.fat_target_g),
    ),
    fiber_g: DEFAULT_TARGETS.fiber_target_g,
  };

  const loadDiaryData = useCallback(async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLogs([]);
      setLoggedDates({});
      setMacroTarget(null);
      setLoading(false);
      return;
    }

    const [logsResult, targetResult, datesResult] = await Promise.all([
      supabase
        .from("food_logs")
        .select(
          `
          *,
          foods (
            id,
            name,
            brand,
            source
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("log_date", selectedDateString)
        .order("created_at", { ascending: true }),

      supabase
        .from("macro_targets")
        .select(
          `
          calories_target,
          protein_target_g,
          carbs_target_g,
          fat_target_g,
          goal,
          activity_level
        `,
        )
        .eq("user_id", user.id)
        .lte("date", selectedDateString)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase.from("food_logs").select("log_date").eq("user_id", user.id),
    ]);

    if (logsResult.error) {
      console.log("Diary logs error:", logsResult.error);
      setLogs([]);
    } else {
      setLogs((logsResult.data ?? []) as FoodLog[]);
    }

    if (targetResult.error) {
      console.log("Macro target error:", targetResult.error);
      setMacroTarget(null);
    } else {
      setMacroTarget((targetResult.data ?? null) as MacroTarget | null);
    }

    if (datesResult.error) {
      console.log("Logged dates error:", datesResult.error);
      setLoggedDates({});
    } else {
      const rows = (datesResult.data ?? []) as LoggedDateRow[];
      const map: Record<string, number> = {};

      rows.forEach((row) => {
        map[row.log_date] = (map[row.log_date] || 0) + 1;
      });

      setLoggedDates(map);
    }

    setLoading(false);
  }, [selectedDateString]);

  useFocusEffect(
    useCallback(() => {
      loadDiaryData();
    }, [loadDiaryData]),
  );

  const totals = useMemo(() => {
    return logs.reduce(
      (acc, item) => {
        acc.calories += n(item.calories);
        acc.protein_g += n(item.protein_g);
        acc.carbs_g += n(item.carbs_g);
        acc.fat_g += n(item.fat_g);
        acc.fiber_g += n(item.fiber_g);
        acc.sugar_g += n(item.sugar_g);
        acc.sodium_mg += n(item.sodium_mg);
        acc.cholesterol_mg += n(item.cholesterol_mg);
        acc.potassium_mg += n(item.potassium_mg);
        acc.calcium_mg += n(item.calcium_mg);
        acc.iron_mg += n(item.iron_mg);
        acc.magnesium_mg += n(item.magnesium_mg);
        acc.zinc_mg += n(item.zinc_mg);
        return acc;
      },
      {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        cholesterol_mg: 0,
        potassium_mg: 0,
        calcium_mg: 0,
        iron_mg: 0,
        magnesium_mg: 0,
        zinc_mg: 0,
      },
    );
  }, [logs]);

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
      days.push({
        date: localDateString(new Date(calendarYear, calendarMonth, day)),
        day,
      });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  function changeDate(days: number) {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);

      setCalendarMonth(next.getMonth());
      setCalendarYear(next.getFullYear());

      return next;
    });
  }

  function goToToday() {
    const today = new Date();

    setSelectedDate(today);
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
  }

  function openCalendar() {
    setCalendarMonth(selectedDate.getMonth());
    setCalendarYear(selectedDate.getFullYear());
    setCalendarOpen((value) => !value);
  }

  function selectCalendarDate(date: string) {
    const next = dateFromKey(date);

    setSelectedDate(next);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
    setCalendarOpen(false);
  }

  function changeMonth(direction: "prev" | "next") {
    const nextDate = new Date(calendarYear, calendarMonth, 1);

    if (direction === "prev") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    setCalendarMonth(nextDate.getMonth());
    setCalendarYear(nextDate.getFullYear());
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

  function formatDate(date: string) {
    return dateFromKey(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const dateSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);

        return horizontal > 20 && horizontal > vertical * 1.5;
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderRelease: (_, gestureState) => {
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);

        if (horizontal < 50 || horizontal < vertical * 1.5) return;

        if (gestureState.dx > 0) {
          changeDate(-1);
        } else {
          changeDate(1);
        }
      },
    }),
  ).current;

  return (
    <ScrollView
      directionalLockEnabled
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View style={{ padding: 12 }}>
        <View
          {...dateSwipeResponder.panHandlers}
          style={{
            marginBottom: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable onPress={() => changeDate(-1)}>
            <StepBack color={theme.colors.text} />
          </Pressable>

          <Pressable
            onPress={openCalendar}
            style={{
              alignItems: "center",
              flex: 1,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: theme.colors.text,
              }}
            >
              {formatHeaderDate(selectedDate)}
            </Text>
          </Pressable>

          <Pressable onPress={() => changeDate(+1)}>
            <StepForward color={theme.colors.text} />
          </Pressable>
        </View>

        {calendarOpen && (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 20,
              padding: 14,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
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
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <Text
                  key={`${day}-${index}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    color: theme.colors.textMuted,
                    fontWeight: "800",
                    fontSize: 11,
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthDays.map((item, index) => {
                const isSelected = item.date === selectedDateString;
                const isToday = item.date === localDateString(new Date());
                const hasFoodLog = item.date
                  ? loggedDates[item.date] > 0
                  : false;

                return (
                  <Pressable
                    key={`${item.date || "empty"}-${index}`}
                    disabled={!item.date}
                    onPress={() => {
                      if (item.date) selectCalendarDate(item.date);
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
                          width: 36,
                          height: 42,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected
                            ? theme.colors.selectedDay
                            : isToday
                              ? theme.colors.surfaceAlt
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
                          {hasFoodLog ? "🍽️" : ""}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ width: 36, height: 42 }} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                marginTop: 10,
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontWeight: "900", color: theme.colors.text }}>
                {loggedDates[selectedDateString] || 0} food log
                {(loggedDates[selectedDateString] || 0) === 1
                  ? ""
                  : "s"} on {formatDate(selectedDateString)}
              </Text>

              <Pressable onPress={goToToday}>
                <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
                  Go to today
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: theme.colors.textMuted,
              marginBottom: 4,
            }}
          >
            Daily Nutrition
          </Text>

          <Text
            style={{
              fontSize: 32,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            {Math.round(totals.calories)} / {targets.calories} kcal
          </Text>

          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Goal: {goalLabel(macroTarget?.goal)} · Activity:{" "}
            {macroTarget?.activity_level ?? "active"}
          </Text>

          {!macroTarget && (
            <Text
              style={{
                color: theme.colors.warning,
                marginTop: 6,
                fontSize: 12,
              }}
            >
              No Supabase macro target found. Using fallback targets.
            </Text>
          )}

          <Pressable
            onPress={() => setNutritionModalOpen(true)}
            style={{ flexDirection: "row", gap: 10, marginTop: 16 }}
          >
            <MacroBox
              theme={theme}
              label="Protein"
              value={`${Math.round(totals.protein_g)}g`}
              target={`${targets.protein_g}g`}
            />
            <MacroBox
              theme={theme}
              label="Carbs"
              value={`${Math.round(totals.carbs_g)}g`}
              target={`${targets.carbs_g}g`}
            />
            <MacroBox
              theme={theme}
              label="Fat"
              value={`${Math.round(totals.fat_g)}g`}
              target={`${targets.fat_g}g`}
            />
          </Pressable>

          <Text
            style={{
              color: theme.colors.textFaint,
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Tap macros to view full nutrition
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          MEALS.map((meal) => (
            <MealSection
              key={meal.key}
              theme={theme}
              title={meal.label}
              mealType={meal.key}
              date={selectedDateString}
              logs={logs.filter((log) => log.meal_type === meal.key)}
            />
          ))
        )}
      </View>

      <FullNutritionDetails
        visible={nutritionModalOpen}
        onClose={() => setNutritionModalOpen(false)}
        totals={totals}
      />
    </ScrollView>
  );
}

function MacroBox({
  theme,
  label,
  value,
  target,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  target: string;
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
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: theme.colors.text,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: theme.colors.textFaint, fontSize: 12 }}>
        Goal {target}
      </Text>
    </View>
  );
}

function MealSection({
  theme,
  title,
  mealType,
  date,
  logs,
}: {
  theme: AppTheme;
  title: string;
  mealType: MealType;
  date: string;
  logs: FoodLog[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const mealTotals = logs.reduce(
    (acc, item) => {
      acc.calories += n(item.calories);
      acc.protein_g += n(item.protein_g);
      acc.carbs_g += n(item.carbs_g);
      acc.fat_g += n(item.fat_g);
      return acc;
    },
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
  );

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        marginBottom: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Pressable
        onPress={() => setIsOpen((value) => !value)}
        style={{
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: isOpen ? 1 : 0,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            {isOpen ? "⌄" : "›"} {title}
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              marginTop: 4,
              fontSize: 12,
            }}
          >
            {logs.length} item{logs.length === 1 ? "" : "s"} ·{" "}
            {Math.round(mealTotals.calories)} kcal
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>
            {Math.round(mealTotals.calories)}
          </Text>

          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            P {Math.round(mealTotals.protein_g)} · C{" "}
            {Math.round(mealTotals.carbs_g)} · F {Math.round(mealTotals.fat_g)}
          </Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={{ padding: 16, paddingTop: 12 }}>
          {logs.length === 0 ? (
            <Text
              style={{
                color: theme.colors.textFaint,
                marginBottom: 12,
              }}
            >
              No foods logged yet.
            </Text>
          ) : (
            logs.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/diary/edit-log" as never,
                    params: { logId: item.id },
                  })
                }
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      {item.foods?.name ?? "Unknown food"}
                    </Text>

                    {!!item.foods?.brand && (
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: 12,
                        }}
                      >
                        {item.foods.brand}
                      </Text>
                    )}

                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 12,
                      }}
                    >
                      {Number(item.quantity)} {item.unit} ·{" "}
                      {sourceLabel(item.foods?.source)}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      {Math.round(Number(item.calories))} kcal
                    </Text>

                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 12,
                      }}
                    >
                      P {Math.round(Number(item.protein_g))} · C{" "}
                      {Math.round(Number(item.carbs_g))} · F{" "}
                      {Math.round(Number(item.fat_g))}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/diary/add-food" as never,
                params: { mealType, date },
              })
            }
            style={{
              marginTop: 14,
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: 14,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: theme.colors.text }}>
              + Add Food
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

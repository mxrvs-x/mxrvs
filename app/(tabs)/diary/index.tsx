import FullNutritionDetails from "@/components/FullNutritionDetails";
import MacroProgressCard from "@/components/MacroProgressCard";
import MealCard from "@/components/MealCard";
import { useDiary } from "@/contexts/DiaryContext";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight, SaladIcon } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type FoodLog = {
  id: string;
  date: string;
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
    source: "custom" | "usda_fdc";
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

function n(value?: number | string | null) {
  return Number(value ?? 0);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function goalLabel(goal?: string) {
  if (goal === "cut") return "Cut";
  if (goal === "bulk") return "Bulk";
  return "Maintain";
}

export default function DiaryScreen() {
  const theme = useTheme();
  const diary = useDiary();

  const selectedDateString = diary.selectedDateString;

  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [macroTarget, setMacroTarget] = useState<MacroTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false);

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
      setMacroTarget(null);
      setLoading(false);
      return;
    }

    const [logsResult, targetResult] = await Promise.all([
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
        .eq("date", selectedDateString)
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

  return (
    <ScrollView
      directionalLockEnabled
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
    >
      <View>
        {diary.calendarOpen && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 8,
            }}
          >
            <ExpandedDiaryCalendar theme={theme} />
          </View>
        )}

        <MacroProgressCard
          theme={theme}
          totals={{
            calories: totals.calories,
            protein_g: totals.protein_g,
            carbs_g: totals.carbs_g,
            fat_g: totals.fat_g,
          }}
          targets={{
            calories: targets.calories,
            protein_g: targets.protein_g,
            carbs_g: targets.carbs_g,
            fat_g: targets.fat_g,
          }}
          goalLabel={goalLabel(macroTarget?.goal)}
          activityLevel={macroTarget?.activity_level ?? "active"}
          hasMacroTarget={!!macroTarget}
          onPress={() => setNutritionModalOpen(true)}
        />

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 20 }}
          />
        ) : (
          MEALS.map((meal) => (
            <MealCard
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

function ExpandedDiaryCalendar({ theme }: { theme: AppTheme }) {
  const diary = useDiary();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Pressable
          onPress={() => diary.changeMonth("prev")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={22} color={theme.colors.text} />
        </Pressable>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          {diary.monthTitle}
        </Text>

        <Pressable
          onPress={() => diary.changeMonth("next")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <Text
            key={`${day}-${index}`}
            style={{
              width: `${100 / 7}%`,
              textAlign: "center",
              color: theme.colors.textMuted,
              fontSize: 13,
              fontWeight: "900",
            }}
          >
            {day}
          </Text>
        ))}
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
        }}
      >
        {diary.monthDays.map((item, index) => {
          const isSelected = item.date === diary.selectedDateString;
          const isToday = item.date === formatDateKey(new Date());
          const hasFoodLog = item.date
            ? diary.loggedDates[item.date] > 0
            : false;

          return (
            <Pressable
              key={`${item.date || "empty"}-${index}`}
              disabled={!item.date}
              onPress={() => {
                if (item.date) {
                  diary.selectCalendarDate(item.date);
                }
              }}
              style={{
                width: `${100 / 7}%`,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.day ? (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    overflow: "hidden",

                    alignItems: "center",
                    justifyContent: "center",

                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : isToday
                        ? theme.colors.surfaceAlt
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "900",
                      color: isSelected
                        ? theme.colors.background
                        : theme.colors.text,
                    }}
                  >
                    {item.day}
                  </Text>

                  {hasFoodLog && (
                    <View
                      style={{
                        position: "relative",

                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        backgroundColor: isSelected
                          ? theme.colors.background
                          : theme.colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <SaladIcon
                        size={9}
                        strokeWidth={2.5}
                        color={
                          isSelected
                            ? theme.colors.primary
                            : theme.colors.background
                        }
                      />
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          marginTop: 14,
          backgroundColor: theme.colors.surfaceAlt,
          borderRadius: 14,
          padding: 12,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 14,
            fontWeight: "900",
          }}
        >
          {diary.loggedDates[diary.selectedDateString] || 0} food log
          {(diary.loggedDates[diary.selectedDateString] || 0) === 1
            ? ""
            : "s"}{" "}
          on {formatHeaderDate(diary.selectedDate)}
        </Text>

        <Pressable onPress={diary.goToToday}>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
              marginTop: 6,
            }}
          >
            Go to today
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

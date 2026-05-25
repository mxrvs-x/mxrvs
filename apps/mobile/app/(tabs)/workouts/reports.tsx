import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  cacheWorkoutSets,
  cacheWorkouts,
  getCachedWorkoutExercises,
  getCachedWorkoutSets,
  getCachedWorkouts,
  getOfflineWorkouts,
  syncOfflineWorkouts,
} from "@/lib/offlineWorkouts";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { isWorkoutType, type WorkoutType } from "@/lib/workoutPlans";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
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
import Svg, {
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  created_at: string;
};

type WorkoutSet = {
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
};

type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
};

type ExercisePoint = {
  workout_id: string;
  date: string;
  workout_type: WorkoutType;
  setCount: number;
  totalReps: number;
  topWeight: number;
  totalVolume: number;
};

type ExerciseReport = {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  points: ExercisePoint[];
  bestWeight: number;
  latestWeight: number;
  latestSets: number;
  totalSets: number;
  totalVolume: number;
};

function hasReportableSet(set: WorkoutSet) {
  return Number(set.set_number || 0) > 0 && Number(set.reps || 0) > 0;
}

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

export default function WorkoutReportsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ split?: WorkoutType }>();

  const currentSplit: WorkoutType = isWorkoutType(params.split)
    ? params.split
    : "push";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<ExerciseReport[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  const selectedReport = useMemo(() => {
    if (reports.length === 0) return null;

    return (
      reports.find((report) => report.exercise_id === selectedExerciseId) ||
      reports[0]
    );
  }, [reports, selectedExerciseId]);

  async function loadReports(showLoader = false) {
    if (showLoader) setLoading(true);

    const online = await isOnline();
    const userId = await resolveOfflineUserId();

    if (!userId) {
      setReports([]);
      setSelectedExerciseId(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let offlineWorkouts = await getOfflineWorkouts();
    let offlineSets = offlineWorkouts.flatMap((workout) =>
      workout.sets.map((set) => ({
        workout_id: workout.temp_id,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        reps: set.reps,
        weight_kg: set.weight_kg,
      })),
    );
    let offlineWorkoutRows = offlineWorkouts.map((workout) => ({
      id: workout.temp_id,
      workout_date: workout.workout_date,
      workout_type: workout.workout_type,
      created_at: workout.created_at,
    }));
    const cachedExercises = await getCachedWorkoutExercises();
    const cachedWorkoutRows = (await getCachedWorkouts()) as Workout[];
    const cachedSetRows = (await getCachedWorkoutSets()) as WorkoutSet[];

    if (!online) {
      const cachedDates = new Set(
        cachedWorkoutRows.map((workout) => workout.workout_date),
      );
      buildReports(
        [
          ...((offlineWorkoutRows as Workout[]).filter(
            (workout) => !cachedDates.has(workout.workout_date),
          )),
          ...cachedWorkoutRows,
        ],
        [...(offlineSets as WorkoutSet[]), ...cachedSetRows],
        cachedExercises,
      );
      return;
    }

    await syncOfflineWorkouts();
    offlineWorkouts = await getOfflineWorkouts();
    offlineSets = offlineWorkouts.flatMap((workout) =>
      workout.sets.map((set) => ({
        workout_id: workout.temp_id,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        reps: set.reps,
        weight_kg: set.weight_kg,
      })),
    );
    offlineWorkoutRows = offlineWorkouts.map((workout) => ({
      id: workout.temp_id,
      workout_date: workout.workout_date,
      workout_type: workout.workout_type,
      created_at: workout.created_at,
    }));

    const { data: workoutData, error: workoutError } = await supabase
      .from("workouts")
      .select("id, workout_date, workout_type, created_at")
      .eq("user_id", userId)
      .order("workout_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (workoutError) {
      console.log("Load workout report workouts error:", workoutError);
      buildReports(
        offlineWorkoutRows as Workout[],
        offlineSets as WorkoutSet[],
        cachedExercises,
      );
      return;
    }

    const workouts = [
      ...offlineWorkoutRows,
      ...((workoutData || []) as Workout[]),
    ] as Workout[];
    await cacheWorkouts((workoutData || []) as Workout[]);
    const workoutIds = workouts.map((workout) => workout.id);

    if (workoutIds.length === 0) {
      buildReports(workouts, offlineSets as WorkoutSet[], cachedExercises);
      return;
    }

    const { data: setData, error: setError } = await supabase
      .from("workout_sets")
      .select("workout_id, exercise_id, set_number, reps, weight_kg")
      .in("workout_id", workoutIds);

    if (setError) {
      console.log("Load workout report sets error:", setError);
      buildReports(workouts, offlineSets as WorkoutSet[], cachedExercises);
      return;
    }

    const sets = [
      ...offlineSets,
      ...((setData || []) as WorkoutSet[]),
    ].filter(hasReportableSet);
    await cacheWorkoutSets((setData || []) as WorkoutSet[]);
    const exerciseIds = Array.from(new Set(sets.map((set) => set.exercise_id)));

    let exercises: Exercise[] = [];

    if (exerciseIds.length > 0) {
      const { data: exerciseData, error: exerciseError } = await supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .in("id", exerciseIds);

      if (exerciseError) {
        console.log("Load workout report exercises error:", exerciseError);
      }

      exercises = [...cachedExercises, ...((exerciseData || []) as Exercise[])];
    }

    buildReports(workouts, sets, exercises);
  }

  function buildReports(
    workouts: Workout[],
    sets: WorkoutSet[],
    exercises: Exercise[],
  ) {
    const workoutMap = new Map(workouts.map((workout) => [workout.id, workout]));
    const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const grouped = new Map<string, Map<string, ExercisePoint>>();
    const groupMeta = new Map<string, Exercise>();

    sets.forEach((set) => {
      const workout = workoutMap.get(set.workout_id);
      if (!workout) return;

      const exercise = exerciseMap.get(set.exercise_id);
      const groupKey = exercise
        ? `${exercise.name.trim().toLowerCase()}|${exercise.muscle_group || ""}`
        : set.exercise_id;

      if (exercise && !groupMeta.has(groupKey)) {
        groupMeta.set(groupKey, exercise);
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, new Map());
      }

      const exercisePoints = grouped.get(groupKey)!;
      const existing = exercisePoints.get(set.workout_id);
      const reps = Number(set.reps || 0);
      const weight = Number(set.weight_kg || 0);
      const volume = reps * weight;

      if (existing) {
        existing.setCount += 1;
        existing.totalReps += reps;
        existing.topWeight = Math.max(existing.topWeight, weight);
        existing.totalVolume += volume;
        return;
      }

      exercisePoints.set(set.workout_id, {
        workout_id: set.workout_id,
        date: workout.workout_date,
        workout_type: workout.workout_type,
        setCount: 1,
        totalReps: reps,
        topWeight: weight,
        totalVolume: volume,
      });
    });

    const nextReports = Array.from(grouped.entries())
      .map(([exerciseKey, pointMap]) => {
        const exercise = groupMeta.get(exerciseKey);
        const points = Array.from(pointMap.values()).sort((a, b) => {
          return a.date.localeCompare(b.date);
        });

        const latest = points[points.length - 1];
        const bestWeight = Math.max(...points.map((point) => point.topWeight));
        const totalSets = points.reduce((sum, point) => sum + point.setCount, 0);
        const totalVolume = points.reduce(
          (sum, point) => sum + point.totalVolume,
          0,
        );

        return {
          exercise_id: exerciseKey,
          exercise_name: exercise?.name || "Unknown Exercise",
          muscle_group: exercise?.muscle_group || null,
          points,
          bestWeight,
          latestWeight: latest?.topWeight || 0,
          latestSets: latest?.setCount || 0,
          totalSets,
          totalVolume,
        };
      })
      .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

    setReports(nextReports);
    setSelectedExerciseId((current) => {
      if (current && nextReports.some((report) => report.exercise_id === current)) {
        return current;
      }

      return nextReports[0]?.exercise_id || null;
    });
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      theme.setSessionTheme(currentSplit);
      loadReports(true);

      return () => {
        theme.setSessionTheme("default");
      };
    }, [currentSplit, theme]), // eslint-disable-line react-hooks/exhaustive-deps
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
            fontSize: 30,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          Workout Reports
        </Text>

        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Exercise progress by weight, sets, reps, and volume.
        </Text>

        {reports.length === 0 || !selectedReport ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              marginTop: 18,
            }}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              No reportable workout sets yet.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 18 }}
              contentContainerStyle={{ gap: 10, paddingRight: 2 }}
            >
              {reports.map((report) => {
                const active = report.exercise_id === selectedReport.exercise_id;

                return (
                  <Pressable
                    key={report.exercise_id}
                    onPress={() => setSelectedExerciseId(report.exercise_id)}
                    style={{
                      width: 180,
                      minHeight: 104,
                      backgroundColor: active
                        ? theme.colors.primary
                        : theme.colors.surface,
                      borderRadius: 16,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: active
                        ? theme.colors.primary
                        : theme.colors.border,
                    }}
                    >
                    <View
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: active
                          ? "rgba(255,255,255,0.18)"
                          : theme.colors.primarySoft,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: active
                            ? theme.colors.textInverse
                            : theme.colors.primary,
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        PR {report.bestWeight} kg
                      </Text>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={{
                        color: active
                          ? theme.colors.textInverse
                          : theme.colors.text,
                        fontWeight: "900",
                      }}
                    >
                      {report.exercise_name}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        color: active
                          ? theme.colors.textInverse
                          : theme.colors.textMuted,
                        marginTop: 6,
                        fontSize: 12,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.muscle_group || "No muscle group"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

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
                {selectedReport.exercise_name}
              </Text>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  marginTop: 4,
                  textTransform: "capitalize",
                }}
              >
                {selectedReport.muscle_group || "No muscle group"}
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <ReportStat
                  label="PR"
                  value={`${selectedReport.bestWeight} kg`}
                />
                <ReportStat
                  label="Latest"
                  value={`${selectedReport.latestWeight} kg`}
                />
                <ReportStat
                  label="Sets"
                  value={`${selectedReport.totalSets}`}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <ReportStat
                  label="Last Session"
                  value={`${selectedReport.latestSets} sets`}
                />
                <ReportStat
                  label="Sessions"
                  value={`${selectedReport.points.length}`}
                />
                <ReportStat
                  label="Volume"
                  value={`${selectedReport.totalVolume.toLocaleString()} kg`}
                />
              </View>
            </View>

            <ProgressChart points={selectedReport.points} theme={theme} />

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

            {[...selectedReport.points].reverse().map((point) => (
              <View
                key={point.workout_id}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    {formatDate(point.date)}
                  </Text>

                  <View style={{ alignItems: "flex-end" }}>
                    {point.topWeight === selectedReport.bestWeight ? (
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
                      {point.topWeight} kg
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <ReportStat label="Sets" value={`${point.setCount}`} />
                  <ReportStat label="Reps" value={`${point.totalReps}`} />
                  <ReportStat
                    label="Volume"
                    value={`${point.totalVolume.toLocaleString()} kg`}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProgressChart({
  points,
  theme,
}: {
  points: ExercisePoint[];
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
  const visiblePoints = points.slice(-12);
  const maxWeight = Math.max(...visiblePoints.map((point) => point.topWeight), 1);
  const maxSets = Math.max(...visiblePoints.map((point) => point.setCount), 1);
  const slotWidth = plotWidth / Math.max(visiblePoints.length, 1);
  const barGap = 3;
  const barWidth = Math.max(
    6,
    Math.min(18, (slotWidth - barGap * 3) / 2),
  );
  const showEveryLabel =
    visiblePoints.length <= 6 ? 1 : visiblePoints.length <= 9 ? 2 : 3;

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
        Weight and Sets
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

        {visiblePoints.map((point, index) => {
          const slotX = left + index * slotWidth;
          const groupWidth = barWidth * 2 + barGap;
          const groupX = slotX + (slotWidth - groupWidth) / 2;
          const weightHeight = (point.topWeight / maxWeight) * plotHeight;
          const setsHeight = (point.setCount / maxSets) * plotHeight;
          const shouldShowLabel =
            index === 0 ||
            index === visiblePoints.length - 1 ||
            index % showEveryLabel === 0;

          return (
            <Fragment key={point.workout_id}>
              <Rect
                x={groupX}
                y={top + plotHeight - weightHeight}
                width={barWidth}
                height={weightHeight}
                rx={4}
                fill={theme.colors.primary}
              />
              <Rect
                x={groupX + barWidth + barGap}
                y={top + plotHeight - setsHeight}
                width={barWidth}
                height={setsHeight}
                rx={4}
                fill={theme.colors.info}
              />
              {shouldShowLabel ? (
                <SvgText
                  x={slotX + slotWidth / 2}
                  y={chartHeight - 24}
                  fill={theme.colors.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {formatShortDate(point.date)}
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
          {maxWeight} kg
        </SvgText>
      </Svg>

      <View style={{ flexDirection: "row", gap: 14, marginTop: 4 }}>
        <LegendDot color={theme.colors.primary} label="Top weight" />
        <LegendDot color={theme.colors.info} label="Sets" />
      </View>
    </View>
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

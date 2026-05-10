import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import * as MediaLibrary from "expo-media-library";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as Sharing from "expo-sharing";
import { Download, Share2, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

type WorkoutType = "push" | "pull" | "legs" | "upper" | "lower" | "rest";

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
};

type WorkoutSet = {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number | null;
};

type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
};

type DisplaySet = WorkoutSet & {
  exercise_name: string;
  muscle_group: string | null;
};

type GroupedExercise = {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  sets: DisplaySet[];
  totalVolume: number;
  totalReps: number;
};

function isWorkoutType(value?: string | string[]): value is WorkoutType {
  return (
    value === "push" ||
    value === "pull" ||
    value === "legs" ||
    value === "upper" ||
    value === "lower" ||
    value === "rest"
  );
}

function formatWorkoutType(type: WorkoutType) {
  const labels: Record<WorkoutType, string> = {
    push: "Push",
    pull: "Pull",
    legs: "Legs / Core",
    upper: "Upper Body",
    lower: "Lower / Arms / Core",
    rest: "Rest",
  };

  return labels[type];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRest(seconds: number | null) {
  if (!seconds) return "—";

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function WorkoutDetailsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const exportRef = useRef<View>(null);

  const params = useLocalSearchParams<{
    id: string;
    split?: WorkoutType;
  }>();

  const { id } = params;

  const currentSplit: WorkoutType = isWorkoutType(params.split)
    ? params.split
    : "push";

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<DisplaySet[]>([]);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

  const totalVolume = sets.reduce((sum, set) => {
    return sum + Number(set.reps || 0) * Number(set.weight_kg || 0);
  }, 0);

  const totalReps = sets.reduce((sum, set) => {
    return sum + Number(set.reps || 0);
  }, 0);

  const groupedExercises = useMemo<GroupedExercise[]>(() => {
    const grouped = sets.reduce<Record<string, GroupedExercise>>((acc, set) => {
      const volume = Number(set.reps || 0) * Number(set.weight_kg || 0);

      if (!acc[set.exercise_id]) {
        acc[set.exercise_id] = {
          exercise_id: set.exercise_id,
          exercise_name: set.exercise_name,
          muscle_group: set.muscle_group,
          sets: [],
          totalVolume: 0,
          totalReps: 0,
        };
      }

      acc[set.exercise_id].sets.push(set);
      acc[set.exercise_id].totalVolume += volume;
      acc[set.exercise_id].totalReps += Number(set.reps || 0);

      return acc;
    }, {});

    return Object.values(grouped).map((exercise) => ({
      ...exercise,
      sets: exercise.sets.sort((a, b) => a.set_number - b.set_number),
    }));
  }, [sets]);

  function showAlert({
    title,
    message,
    confirmText = "OK",
    cancelText,
    danger = false,
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm?: () => void;
  }) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertConfirmText(confirmText);
    setAlertCancelText(cancelText);
    setAlertDanger(danger);
    setAlertOnConfirm(() => onConfirm);
    setAlertOpen(true);
  }

  function handleClosePress() {
    router.back();
  }

  async function exportWorkoutImage(type: "save" | "share") {
    try {
      if (!exportRef.current || exporting) return;

      setExporting(true);

      const uri = await captureRef(exportRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      if (type === "save") {
        const permission = await MediaLibrary.requestPermissionsAsync(false);

        if (!permission.granted) {
          setExporting(false);

          showAlert({
            title: "Permission Required",
            message:
              "Please allow photo library access to save your workout summary.",
            danger: true,
          });

          return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);

        showAlert({
          title: "Saved",
          message: "Workout summary saved to gallery.",
        });
      } else {
        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          setExporting(false);

          showAlert({
            title: "Sharing Unavailable",
            message: "Sharing is not available here.",
            danger: true,
          });

          return;
        }

        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share Workout Summary",
        });
      }

      setExporting(false);
    } catch (error) {
      console.log("Export workout image error:", error);
      setExporting(false);

      showAlert({
        title: "Export Failed",
        message: "Something went wrong while exporting workout summary.",
        danger: true,
      });
    }
  }

  async function loadWorkoutDetails() {
    if (!id) return;

    setLoading(true);

    const [{ data: workoutData, error: workoutError }, { data: setData }] =
      await Promise.all([
        supabase.from("workouts").select("*").eq("id", id).single(),

        supabase
          .from("workout_sets")
          .select("*")
          .eq("workout_id", id)
          .order("exercise_id", { ascending: true })
          .order("set_number", { ascending: true }),
      ]);

    if (workoutError || !workoutData) {
      console.log("Load workout details error:", workoutError);
      setWorkout(null);
      setSets([]);
      setLoading(false);
      return;
    }

    const currentWorkout = workoutData as Workout;
    theme.setSessionTheme(currentWorkout.workout_type);

    const workoutSets = (setData || []) as WorkoutSet[];

    const exerciseIds = Array.from(
      new Set(workoutSets.map((set) => set.exercise_id)),
    );

    let exerciseRows: Exercise[] = [];

    if (exerciseIds.length > 0) {
      const { data: exercises } = await supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .in("id", exerciseIds);

      exerciseRows = (exercises || []) as Exercise[];
    }

    const mappedSets: DisplaySet[] = workoutSets.map((set) => {
      const exercise = exerciseRows.find((item) => item.id === set.exercise_id);

      return {
        ...set,
        exercise_name: exercise?.name || "Unknown Exercise",
        muscle_group: exercise?.muscle_group || null,
      };
    });

    setWorkout(currentWorkout);
    setSets(mappedSets);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      if (currentSplit) {
        theme.setSessionTheme(currentSplit);
      }

      loadWorkoutDetails();

      return () => {
        theme.setSessionTheme("default");
      };
    }, [id, currentSplit]),
  );

  const themedAlert = (
    <ThemedAlert
      visible={alertOpen}
      title={alertTitle}
      message={alertMessage}
      confirmText={alertConfirmText}
      cancelText={alertCancelText}
      danger={alertDanger}
      onClose={() => setAlertOpen(false)}
      onConfirm={() => {
        setAlertOpen(false);

        if (alertOnConfirm) {
          alertOnConfirm();
        }
      }}
    />
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
        }}
      >
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

        <ActivityIndicator color={theme.colors.primary} />

        {themedAlert}
      </View>
    );
  }

  if (!workout) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
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

        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          Workout not found
        </Text>

        <Pressable
          onPress={handleClosePress}
          style={{
            marginTop: 18,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
            Go Back
          </Text>
        </Pressable>

        {themedAlert}
      </View>
    );
  }

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
          headerRight: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Pressable
                onPress={() => exportWorkoutImage("share")}
                disabled={exporting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Share2 size={20} color={theme.colors.text} />
              </Pressable>

              <Pressable
                onPress={() => exportWorkoutImage("save")}
                disabled={exporting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Download size={20} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <FlatList
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          data={sets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          ListHeaderComponent={
            <View>
              <View
                ref={exportRef}
                collapsable={false}
                style={{
                  backgroundColor: theme.colors.background,
                  padding: 16,
                  borderRadius: 24,
                }}
              >
                <View
                  style={{
                    marginTop: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      {formatWorkoutType(workout.workout_type)}
                    </Text>

                    <Text
                      style={{ color: theme.colors.textMuted, marginTop: 4 }}
                    >
                      {formatDate(workout.workout_date)}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: theme.colors.primary,
                      fontSize: 13,
                      fontWeight: "900",
                    }}
                  >
                    mxrvs
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderRadius: 20,
                    padding: 18,
                    marginTop: 20,
                  }}
                >
                  <Text style={{ color: theme.colors.textInverse }}>
                    Session Summary
                  </Text>

                  <Text
                    style={{
                      color: theme.colors.textInverse,
                      fontSize: 34,
                      fontWeight: "900",
                      marginTop: 6,
                    }}
                  >
                    {(totalVolume || 0).toLocaleString()} kg
                  </Text>

                  <Text
                    style={{ color: theme.colors.textInverse, marginTop: 8 }}
                  >
                    {sets.length} sets • {totalReps} reps •{" "}
                    {workout.duration_minutes || 0} min
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <ExportStat label="Sets" value={`${sets.length}`} />
                  <ExportStat label="Reps" value={`${totalReps}`} />
                  <ExportStat
                    label="Volume"
                    value={`${totalVolume.toLocaleString()} kg`}
                  />
                </View>

                {workout.notes ? (
                  <View
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderRadius: 16,
                      padding: 16,
                      marginTop: 14,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        color: theme.colors.text,
                      }}
                    >
                      Notes
                    </Text>

                    <Text
                      style={{ color: theme.colors.textMuted, marginTop: 6 }}
                    >
                      {workout.notes}
                    </Text>
                  </View>
                ) : null}

                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    marginTop: 22,
                    marginBottom: 10,
                    color: theme.colors.text,
                  }}
                >
                  Exercises
                </Text>

                {groupedExercises.length === 0 ? (
                  <Text style={{ color: theme.colors.textMuted }}>
                    No exercises found.
                  </Text>
                ) : (
                  groupedExercises.map((exercise) => (
                    <View
                      key={exercise.exercise_id}
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        marginBottom: 10,
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
                              fontWeight: "900",
                              fontSize: 16,
                              color: theme.colors.text,
                            }}
                          >
                            {exercise.exercise_name}
                          </Text>

                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              marginTop: 3,
                              textTransform: "capitalize",
                            }}
                          >
                            {exercise.muscle_group || "No muscle group"}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontWeight: "900",
                            }}
                          >
                            {exercise.sets.length} sets
                          </Text>

                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              marginTop: 3,
                              fontSize: 12,
                            }}
                          >
                            {exercise.totalVolume.toLocaleString()} kg
                          </Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 12, gap: 8 }}>
                        {exercise.sets.map((set) => {
                          const setVolume =
                            Number(set.reps || 0) * Number(set.weight_kg || 0);

                          return (
                            <View
                              key={set.id}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                backgroundColor: theme.colors.surfaceAlt,
                                borderRadius: 12,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                gap: 10,
                              }}
                            >
                              <Text
                                style={{
                                  color: theme.colors.text,
                                  fontWeight: "900",
                                  width: 48,
                                }}
                              >
                                Set {set.set_number}
                              </Text>

                              <Text
                                style={{
                                  color: theme.colors.textMuted,
                                  flex: 1,
                                }}
                              >
                                {set.reps} reps × {set.weight_kg} kg
                              </Text>

                              <Text
                                style={{
                                  color: theme.colors.text,
                                  fontWeight: "900",
                                }}
                              >
                                {setVolume.toLocaleString()} kg
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}

                <Text
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    color: theme.colors.textMuted,
                    fontWeight: "800",
                  }}
                >
                  Logged with mxrvs
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  marginTop: 24,
                  marginBottom: 10,
                  color: theme.colors.text,
                }}
              >
                Sets
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.textMuted }}>
                No sets found.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 16,
                  color: theme.colors.text,
                }}
              >
                {item.exercise_name}
              </Text>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  marginTop: 2,
                  textTransform: "capitalize",
                }}
              >
                {item.muscle_group || "No muscle group"}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  marginTop: 12,
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <MiniStat label="Set" value={`${item.set_number}`} />
                <MiniStat label="Reps" value={`${item.reps}`} />
                <MiniStat label="Weight" value={`${item.weight_kg} kg`} />
                <MiniStat
                  label="Volume"
                  value={`${(
                    Number(item.reps || 0) * Number(item.weight_kg || 0)
                  ).toLocaleString()} kg`}
                />
                <MiniStat label="Rest" value={formatRest(item.rest_seconds)} />
              </View>
            </View>
          )}
        />

        {themedAlert}
      </View>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
        {label}
      </Text>

      <Text style={{ fontWeight: "900", color: theme.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

function ExportStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
        {label}
      </Text>

      <Text
        style={{
          fontWeight: "900",
          color: theme.colors.text,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

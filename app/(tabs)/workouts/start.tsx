import ExerciseSessionModal from "@/components/ExerciseSessionModal";
import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Audio } from "expo-av";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

type WorkoutType = "push" | "pull" | "legs" | "upper" | "lower" | "rest";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  movement_type: WorkoutType | null;
  is_compound: boolean;
};

type Workout = {
  id: string;
  workout_date: string;
  workout_type: WorkoutType;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
};

type LocalSet = {
  local_id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
};

const WEEK_SPLIT = [
  { day: "Sunday", type: "rest" as WorkoutType, label: "Rest" },
  { day: "Monday", type: "push" as WorkoutType, label: "Push" },
  { day: "Tuesday", type: "pull" as WorkoutType, label: "Pull" },
  { day: "Wednesday", type: "legs" as WorkoutType, label: "Legs / Core" },
  { day: "Thursday", type: "rest" as WorkoutType, label: "Rest" },
  { day: "Friday", type: "upper" as WorkoutType, label: "Upper Body" },
  {
    day: "Saturday",
    type: "lower" as WorkoutType,
    label: "Lower / Arms / Core",
  },
];

function getTodaySplit() {
  return WEEK_SPLIT[new Date().getDay()];
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRest(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
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

export default function StartWorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const todaySplit = useMemo(() => getTodaySplit(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closeAlertVisible, setCloseAlertVisible] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

  const [sessionStarted, setSessionStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [sets, setSets] = useState<LocalSet[]>([]);
  const [notes, setNotes] = useState("");

  const [isResting, setIsResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null);

  const totalVolume = sets.reduce((sum, set) => {
    const reps = Number(set.reps) || 0;
    const weight = Number(set.weight_kg) || 0;
    return sum + reps * weight;
  }, 0);

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

  async function playRestCompleteAlert() {
    try {
      Vibration.vibrate([0, 500, 250, 500, 250, 700]);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/timer-complete.mp3"),
      );

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log("Timer sound error:", error);
      Vibration.vibrate([0, 500, 250, 500]);
    }
  }

  async function loadInitialData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const today = getTodayDateString();

    const [{ data: exerciseData, error: exerciseError }, { data: todayData }] =
      await Promise.all([
        supabase
          .from("exercises")
          .select("*")
          .eq("user_id", user.id)
          .eq("movement_type", todaySplit.type)
          .order("is_compound", { ascending: false })
          .order("name", { ascending: true }),

        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", user.id)
          .eq("workout_date", today)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    if (exerciseError) {
      console.log("Load exercises error:", exerciseError);
      showAlert({
        title: "Error",
        message: "Could not load exercises.",
        danger: true,
      });
    }

    setExercises((exerciseData || []) as Exercise[]);
    setTodayWorkout(((todayData || [])[0] as Workout) || null);

    setLoading(false);
  }

  function actuallyStartSession() {
    if (exercises.length === 0) {
      showAlert({
        title: "No exercises",
        message: "Add exercises for this workout day first.",
      });
      return;
    }

    setElapsedSeconds(0);
    setIsPaused(false);
    setSessionStarted(true);
  }

  function startSession() {
    if (todayWorkout) {
      showAlert({
        title: "Already logged today",
        message: `You already completed ${formatWorkoutType(
          todayWorkout.workout_type,
        )} today${
          todayWorkout.duration_minutes
            ? ` for ${todayWorkout.duration_minutes} minutes`
            : ""
        }. Do you still want to go? Remember, rest and recovery are also important.`,
        cancelText: "Cancel",
        confirmText: "Start Anyway",
        danger: true,
        onConfirm: actuallyStartSession,
      });

      return;
    }

    actuallyStartSession();
  }

  function togglePauseWorkout() {
    if (!sessionStarted || saving) return;

    setIsPaused((current) => !current);
  }

  function openExercise(exercise: Exercise) {
    if (!sessionStarted) {
      showAlert({
        title: "Start workout",
        message: "Tap Start Workout first.",
      });
      return;
    }

    if (isPaused) {
      showAlert({
        title: "Workout paused",
        message: "Resume the workout before logging sets.",
      });
      return;
    }

    if (isResting && restExerciseId !== exercise.id) {
      showAlert({
        title: "Rest timer active",
        message: `Please wait ${formatRest(
          restRemaining,
        )} before starting another set.`,
      });
      return;
    }

    setActiveExercise(exercise);
    setModalVisible(true);
  }

  function getNextSetNumber(exerciseId: string) {
    return sets.filter((set) => set.exercise_id === exerciseId).length + 1;
  }

  function completeSetFromModal(set: {
    exercise_id: string;
    exercise_name: string;
    set_number: number;
    reps: string;
    weight_kg: string;
    rest_seconds: string;
  }) {
    setSets((current) => [
      ...current,
      {
        local_id: `${set.exercise_id}-${set.set_number}-${Date.now()}`,
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        set_number: set.set_number,
        reps: set.reps,
        weight_kg: set.weight_kg,
        rest_seconds: set.rest_seconds,
      },
    ]);

    const rest = Number(set.rest_seconds) || 90;

    setRestExerciseId(set.exercise_id);
    setRestRemaining(rest);
    setIsResting(true);
  }

  function finishRest() {
    setIsResting(false);
    setRestRemaining(0);
    setRestExerciseId(null);
  }

  function removeSet(localId: string) {
    setSets((current) => {
      const target = current.find((set) => set.local_id === localId);
      const filtered = current.filter((set) => set.local_id !== localId);

      if (!target) return filtered;

      const sameExerciseSets = filtered.filter(
        (set) => set.exercise_id === target.exercise_id,
      );

      return filtered.map((set) => {
        if (set.exercise_id !== target.exercise_id) return set;

        const index = sameExerciseSets.findIndex(
          (item) => item.local_id === set.local_id,
        );

        return {
          ...set,
          set_number: index + 1,
        };
      });
    });
  }

  async function endAndSaveWorkout() {
    if (sets.length === 0) {
      showAlert({
        title: "No sets",
        message: "Log at least one set before ending workout.",
      });
      return;
    }

    const exercisesWithoutSets = exercises.filter((exercise) => {
      return !sets.some((set) => set.exercise_id === exercise.id);
    });

    if (exercisesWithoutSets.length > 0) {
      const exerciseNames = exercisesWithoutSets
        .map((exercise) => exercise.name)
        .join(", ");

      showAlert({
        title: "Some exercises have no sets",
        message: `You don't have any sets for ${exerciseNames} exercise${
          exercisesWithoutSets.length > 1 ? "s" : ""
        }. Are you sure you want to end the session?`,
        cancelText: "Cancel",
        confirmText: "End Session",
        danger: true,
        onConfirm: saveWorkout,
      });

      return;
    }

    showAlert({
      title: "End workout?",
      message: "This will stop the timer and save your workout.",
      cancelText: "Cancel",
      confirmText: "End & Save",
      onConfirm: saveWorkout,
    });
  }

  async function saveWorkout() {
    setSaving(true);
    setSessionStarted(false);
    setIsPaused(false);
    finishRest();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        workout_type: todaySplit.type,
        duration_minutes: durationMinutes,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (workoutError || !workout) {
      console.log("Create workout error:", workoutError);
      showAlert({
        title: "Error",
        message: "Could not create workout.",
        danger: true,
      });
      setSaving(false);
      return;
    }

    const rows = sets.map((set) => ({
      user_id: user.id,
      workout_id: workout.id,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      reps: Number(set.reps),
      weight_kg: Number(set.weight_kg),
      rest_seconds: Number(set.rest_seconds) || null,
    }));

    const { error: setsError } = await supabase
      .from("workout_sets")
      .insert(rows);

    if (setsError) {
      console.log("Save sets error:", setsError);
      showAlert({
        title: "Error",
        message: "Workout created but sets failed to save.",
        danger: true,
      });
      setSaving(false);
      return;
    }

    setSaving(false);

    showAlert({
      title: "Workout saved",
      message: "Your workout was logged successfully.",
      confirmText: "OK",
      onConfirm: () => router.back(),
    });
  }

  function handleClosePress() {
    if (sessionStarted || isPaused) {
      setCloseAlertVisible(true);
      return;
    }

    router.back();
  }

  function confirmCloseSession() {
    setCloseAlertVisible(false);
    setModalVisible(false);
    setSessionStarted(false);
    setIsPaused(false);
    finishRest();
    router.back();
  }

  useFocusEffect(
    useCallback(() => {
      theme.setSessionTheme(todaySplit.type);

      return () => {
        theme.setSessionTheme("default");
      };
    }, [todaySplit.type]),
  );

  useEffect(() => {
    if (todaySplit.type !== "rest") {
      loadInitialData();
    }
  }, []);

  useEffect(() => {
    if (!sessionStarted || isPaused) return;

    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStarted, isPaused]);

  useEffect(() => {
    if (!isResting || isPaused) return;

    if (restRemaining <= 0) {
      finishRest();
      playRestCompleteAlert();
      return;
    }

    const timer = setTimeout(() => {
      setRestRemaining((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isResting, restRemaining, isPaused]);

  if (todaySplit.type === "rest") {
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
                onPress={() => router.back()}
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

        <Text style={{ fontSize: 64 }}>😴</Text>

        <Text
          style={{
            color: theme.colors.primary,
            fontSize: 30,
            fontWeight: "800",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Rest Day
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 16,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Today is your rest day.
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          Recover, hydrate, eat well, and come back stronger tomorrow 💪
        </Text>

        <Text
          style={{
            color: theme.colors.textFaint,
            fontSize: 13,
            marginTop: 22,
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {"Growth happens during recovery."}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 30,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontWeight: "800", color: theme.colors.textInverse }}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {todayWorkout ? (
          <View
            style={{
              backgroundColor: theme.colors.primarySoft,
              borderRadius: 16,
              padding: 16,
              marginTop: 18,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ fontWeight: "900", color: theme.colors.primary }}>
              ⚠️ Already logged today
            </Text>

            <Text
              style={{
                color: theme.colors.primary,
                marginTop: 6,
                fontWeight: "700",
              }}
            >
              {formatWorkoutType(todayWorkout.workout_type)}
              {todayWorkout.duration_minutes
                ? ` • ${todayWorkout.duration_minutes} min`
                : ""}
            </Text>

            <Text style={{ color: theme.colors.primary, marginTop: 6 }}>
              You can still start another session, but recovery is part of
              progress.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: isPaused
              ? theme.colors.warning
              : theme.colors.primary,
            borderRadius: 20,
            padding: 18,
            marginTop: 20,
          }}
        >
          <Text style={{ color: theme.colors.textInverse }}>
            Current Session {isPaused ? "• Paused" : ""}
          </Text>

          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: 34,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            {formatDuration(elapsedSeconds)}
          </Text>

          <Text style={{ color: theme.colors.textInverse, marginTop: 8 }}>
            {todaySplit.label} • {sets.length} sets •{" "}
            {totalVolume.toLocaleString()} kg volume
          </Text>

          {isPaused ? (
            <Text
              style={{
                color: theme.colors.text,
                marginTop: 10,
                fontWeight: "700",
              }}
            >
              Workout is paused. Timer and rest countdown are frozen.
            </Text>
          ) : null}
        </View>

        {isResting ? (
          <View
            style={{
              backgroundColor: theme.colors.primarySoft,
              borderRadius: 16,
              padding: 16,
              marginTop: 14,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ fontWeight: "900", color: theme.colors.primary }}>
              ⏱️ Rest timer active {isPaused ? "• Paused" : ""}
            </Text>

            <Text
              style={{
                color: theme.colors.primary,
                marginTop: 6,
                fontSize: 28,
                fontWeight: "900",
              }}
            >
              {formatRest(restRemaining)}
            </Text>

            <Text style={{ color: theme.colors.primary, marginTop: 6 }}>
              Another set cannot start until the timer is finished.
            </Text>
          </View>
        ) : null}

        {!sessionStarted ? (
          <Pressable
            onPress={startSession}
            disabled={loading || exercises.length === 0}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: 18,
              padding: 18,
              alignItems: "center",
              marginTop: 18,
              opacity: loading || exercises.length === 0 ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                color: theme.colors.textInverse,
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              Start Workout
            </Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={togglePauseWorkout}
              disabled={saving}
              style={{
                flex: 1,
                backgroundColor: isPaused
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderRadius: 18,
                padding: 18,
                alignItems: "center",
                borderWidth: 1,
                borderColor: isPaused
                  ? theme.colors.primary
                  : theme.colors.border,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: isPaused
                    ? theme.colors.textInverse
                    : theme.colors.text,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </Pressable>

            <Pressable
              onPress={endAndSaveWorkout}
              disabled={saving}
              style={{
                flex: 1,
                backgroundColor: theme.colors.danger,
                borderRadius: 18,
                padding: 18,
                alignItems: "center",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: theme.colors.textInverse,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                {saving ? "Saving..." : "End Workout"}
              </Text>
            </Pressable>
          </View>
        )}

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            marginTop: 24,
            color: theme.colors.text,
          }}
        >
          Today&apos;s Exercises
        </Text>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 20 }}
          />
        ) : exercises.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginTop: 10,
            }}
          >
            <Text style={{ fontWeight: "800", color: theme.colors.text }}>
              No exercises found
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Go to setup and add exercises for this workout day.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={exercises}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => {
              const exerciseSets = sets.filter(
                (set) => set.exercise_id === item.id,
              );

              const volume = exerciseSets.reduce((sum, set) => {
                return (
                  sum + (Number(set.reps) || 0) * (Number(set.weight_kg) || 0)
                );
              }, 0);

              const isDisabledByRest = isResting && restExerciseId !== item.id;
              const isDisabled = isDisabledByRest || isPaused;

              return (
                <Pressable
                  onPress={() => openExercise(item)}
                  style={{
                    width: 200,
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isDisabledByRest
                      ? theme.colors.primary
                      : theme.colors.border,
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: theme.colors.text,
                    }}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      marginTop: 6,
                      textTransform: "capitalize",
                    }}
                  >
                    {item.muscle_group}
                  </Text>

                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      marginTop: 6,
                      fontSize: 12,
                    }}
                  >
                    {item.is_compound ? "Compound" : "Isolation"}
                  </Text>

                  <View
                    style={{
                      marginTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                      paddingTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: theme.colors.text,
                      }}
                    >
                      {exerciseSets.length} sets
                    </Text>

                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 12,
                      }}
                    >
                      {volume.toLocaleString()} kg
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            marginTop: 18,
            color: theme.colors.text,
          }}
        >
          Logged Sets
        </Text>

        {sets.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginTop: 10,
            }}
          >
            <Text style={{ fontWeight: "800", color: theme.colors.text }}>
              No sets yet
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Start the workout, tap an exercise, then complete Set 1.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            {sets.map((set) => (
              <View
                key={set.local_id}
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
                        fontWeight: "800",
                        color: theme.colors.text,
                      }}
                    >
                      {set.exercise_name}
                    </Text>

                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      Set {set.set_number} • {set.reps} reps × {set.weight_kg}{" "}
                      kg
                    </Text>
                  </View>

                  <Pressable onPress={() => removeSet(set.local_id)}>
                    <Text
                      style={{
                        color: theme.colors.danger,
                        fontWeight: "800",
                      }}
                    >
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            marginTop: 14,
            color: theme.colors.text,
          }}
        >
          Notes
        </Text>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Energy, fatigue, form notes..."
          placeholderTextColor={theme.colors.textFaint}
          multiline
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginTop: 10,
            minHeight: 90,
            textAlignVertical: "top",
            color: theme.colors.text,
          }}
        />
      </ScrollView>

      <ExerciseSessionModal
        visible={modalVisible}
        exercise={activeExercise}
        startingSetNumber={
          activeExercise ? getNextSetNumber(activeExercise.id) : 1
        }
        isResting={isResting}
        restRemaining={restRemaining}
        nextSetNumber={activeExercise ? getNextSetNumber(activeExercise.id) : 1}
        onClose={() => setModalVisible(false)}
        onCompleteSet={completeSetFromModal}
        onSkipRest={finishRest}
      />

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

      <ThemedAlert
        visible={closeAlertVisible}
        title={isPaused ? "Workout is paused" : "Workout in progress"}
        message={
          isPaused
            ? "You have a paused workout session. Closing this screen will discard the current session and unsaved sets."
            : "You have an active workout session. Closing this screen will discard the current session and unsaved sets."
        }
        cancelText="Stay"
        confirmText="Discard"
        danger
        onClose={() => setCloseAlertVisible(false)}
        onConfirm={confirmCloseSession}
      />
    </View>
  );
}
import ExerciseSessionModal from "@/components/ExerciseSessionModal";
import ThemedAlert from "@/components/ThemedAlert";
import { toLocalDateKey } from "@/lib/dates";
import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  createRecoveryCheckIn,
  RECOVERY_METRICS,
  type RecoveryCheckIn,
} from "@/lib/recoveryCheckIn";
import {
  cacheWorkoutExercises,
  getCachedWorkouts,
  createOfflineWorkout,
  getCachedWorkoutExercises,
  getOfflineWorkouts,
  syncOfflineWorkouts,
} from "@/lib/offlineWorkouts";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  WORKOUT_PLANS,
  dedupeExercisesByMuscleGroup,
  formatMuscleGroup,
  formatWorkoutType,
  groupExercisesByMuscleGroup,
  isExerciseRecommendedForWorkout,
  type WorkoutType,
  type WorkoutPlan,
} from "@/lib/workoutPlans";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Check, Plus, Trash2, X } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

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

type WorkoutSession = {
  sessionStarted: boolean;
  workoutType: WorkoutType | null;
  isPaused: boolean;
  startedAtMs: number | null;
  activeMs: number;
  elapsedSeconds: number;
  sets: LocalSet[];
  notes: string;
  isResting: boolean;
  restRemaining: number;
  restExerciseId: string | null;
  restEndsAtMs: number | null;
};

const initialWorkoutSession: WorkoutSession = {
  sessionStarted: false,
  workoutType: null,
  isPaused: false,
  startedAtMs: null,
  activeMs: 0,
  elapsedSeconds: 0,
  sets: [],
  notes: "",
  isResting: false,
  restRemaining: 0,
  restExerciseId: null,
  restEndsAtMs: null,
};

let workoutSession: WorkoutSession = initialWorkoutSession;
const workoutSubscribers = new Set<() => void>();
let workoutTimerRef: ReturnType<typeof setInterval> | null = null;
let restAlertPlayedForEndAt: number | null = null;

function getWorkoutSession() {
  return workoutSession;
}

function subscribeWorkoutSession(callback: () => void) {
  workoutSubscribers.add(callback);
  return () => workoutSubscribers.delete(callback);
}

function setWorkoutSession(
  updater:
    | Partial<WorkoutSession>
    | ((current: WorkoutSession) => WorkoutSession),
) {
  workoutSession =
    typeof updater === "function"
      ? updater(workoutSession)
      : { ...workoutSession, ...updater };

  workoutSubscribers.forEach((callback) => callback());
}

function useWorkoutSession() {
  return useSyncExternalStore(
    subscribeWorkoutSession,
    getWorkoutSession,
    getWorkoutSession,
  );
}

function getTodayDateString() {
  return toLocalDateKey();
}

function getElapsedSeconds(session = workoutSession) {
  if (!session.sessionStarted) return session.elapsedSeconds;

  if (session.isPaused || !session.startedAtMs) {
    return Math.floor(session.activeMs / 1000);
  }

  return Math.floor(
    (session.activeMs + Date.now() - session.startedAtMs) / 1000,
  );
}

function getRestRemaining(session = workoutSession) {
  if (!session.isResting) return 0;
  if (session.isPaused || !session.restEndsAtMs) return session.restRemaining;

  return Math.max(0, Math.ceil((session.restEndsAtMs - Date.now()) / 1000));
}

function startWorkoutTicker(onRestComplete?: () => void) {
  if (workoutTimerRef) clearInterval(workoutTimerRef);

  workoutTimerRef = setInterval(() => {
    const current = getWorkoutSession();

    if (!current.sessionStarted) return;

    const elapsedSeconds = getElapsedSeconds(current);
    const restRemaining = getRestRemaining(current);

    if (
      current.isResting &&
      !current.isPaused &&
      restRemaining <= 0 &&
      current.restEndsAtMs &&
      restAlertPlayedForEndAt !== current.restEndsAtMs
    ) {
      restAlertPlayedForEndAt = current.restEndsAtMs;

      setWorkoutSession({
        elapsedSeconds,
        isResting: false,
        restRemaining: 0,
        restExerciseId: null,
        restEndsAtMs: null,
      });

      onRestComplete?.();
      return;
    }

    setWorkoutSession({
      elapsedSeconds,
      restRemaining,
    });
  }, 1000);
}

function stopWorkoutTicker() {
  if (workoutTimerRef) {
    clearInterval(workoutTimerRef);
    workoutTimerRef = null;
  }
}

function resetWorkoutSession() {
  stopWorkoutTicker();
  restAlertPlayedForEndAt = null;
  setWorkoutSession(initialWorkoutSession);
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

export default function StartWorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setSessionTheme } = theme;
  const session = useWorkoutSession();
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan>(WORKOUT_PLANS[0]);
  const [splitChosen, setSplitChosen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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

  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryCheckIn>(() =>
    createRecoveryCheckIn(3),
  );

  const recommendedExercises = useMemo(() => {
    if (!splitChosen) return [];

    return exercises.filter((exercise) =>
      isExerciseRecommendedForWorkout(exercise, selectedPlan.type),
    );
  }, [exercises, selectedPlan.type, splitChosen]);

  const selectedExercises = useMemo(() => {
    return exercises.filter((exercise) => selectedExerciseIds.has(exercise.id));
  }, [exercises, selectedExerciseIds]);

  const visibleExercises = session.sessionStarted
    ? selectedExercises
    : recommendedExercises;

  const exerciseSections = useMemo(() => {
    return groupExercisesByMuscleGroup(visibleExercises);
  }, [visibleExercises]);

  const availableExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();

    return exercises.filter((exercise) => {
      if (selectedExerciseIds.has(exercise.id)) return false;
      if (!query) return true;

      return (
        exercise.name.toLowerCase().includes(query) ||
        formatMuscleGroup(exercise.muscle_group).toLowerCase().includes(query)
      );
    });
  }, [exerciseSearch, exercises, selectedExerciseIds]);

  const availableExerciseSections = useMemo(() => {
    return groupExercisesByMuscleGroup(availableExercises);
  }, [availableExercises]);
  const unselectedExerciseCount = exercises.filter(
    (exercise) => !selectedExerciseIds.has(exercise.id),
  ).length;

  const totalVolume = session.sets.reduce((sum, set) => {
    const reps = Number(set.reps) || 0;
    const weight = Number(set.weight_kg) || 0;
    return sum + reps * weight;
  }, 0);

  const showAlert = useCallback(({
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
  }) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertConfirmText(confirmText);
    setAlertCancelText(cancelText);
    setAlertDanger(danger);
    setAlertOnConfirm(() => onConfirm);
    setAlertOpen(true);
  }, []);

  async function playRestCompleteAlert() {
    let player: ReturnType<typeof createAudioPlayer> | undefined;
    try {
      Vibration.vibrate([0, 500, 250, 500, 250, 700]);

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
      });

      const sound = createAudioPlayer(require("@/assets/sounds/timer-complete.mp3"));
      player = sound;
      const subscription = sound.addListener("playbackStatusUpdate", (status) => {
        if (!status.didJustFinish) return;
        subscription.remove();
        sound.remove();
      });
      sound.play();
    } catch (error) {
      player?.remove();
      console.log("Timer sound error:", error);
      Vibration.vibrate([0, 500, 250, 500]);
    }
  }

  const loadInitialData = useCallback(async () => {
    setLoading(true);

    const online = await isOnline();
    const userId = await resolveOfflineUserId();

    if (!userId) {
      setLoading(false);
      return;
    }

    const today = getTodayDateString();
    const offlineWorkouts = await getOfflineWorkouts();
    const offlineTodayWorkout = offlineWorkouts.find(
      (workout) => workout.workout_date === today,
    );
    const cachedTodayWorkout = (await getCachedWorkouts()).find(
      (workout) => workout.workout_date === today,
    );

    if (!online) {
      const cachedExercises = await getCachedWorkoutExercises();
      setExercises(cachedExercises as Exercise[]);
      setTodayWorkout(
        cachedTodayWorkout
          ? (cachedTodayWorkout as Workout)
          : offlineTodayWorkout
          ? {
              id: offlineTodayWorkout.temp_id,
              workout_date: offlineTodayWorkout.workout_date,
              workout_type: offlineTodayWorkout.workout_type,
              notes: offlineTodayWorkout.notes,
              duration_minutes: offlineTodayWorkout.duration_minutes,
              created_at: offlineTodayWorkout.created_at,
            }
          : null,
      );
      setLoading(false);
      return;
    }

    await syncOfflineWorkouts();

    const [{ data: exerciseData, error: exerciseError }, { data: todayData }] =
      await Promise.all([
        supabase
          .from("exercises")
          .select("*")
          .eq("user_id", userId)
          .order("muscle_group", { ascending: true })
          .order("is_compound", { ascending: false })
          .order("name", { ascending: true }),

        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", userId)
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

    const cached = await getCachedWorkoutExercises();
    const fetchedExercises = (exerciseData || []) as Exercise[];
    const fetchedIds = new Set(fetchedExercises.map((exercise) => exercise.id));
    const nextExercises = dedupeExercisesByMuscleGroup(fetchedExercises);
    await cacheWorkoutExercises([
      ...cached.filter((exercise) => !fetchedIds.has(exercise.id)),
      ...fetchedExercises,
    ]);

    setExercises(nextExercises);
    setTodayWorkout(
      ((todayData || [])[0] as Workout) ||
        (offlineTodayWorkout
          ? {
              id: offlineTodayWorkout.temp_id,
              workout_date: offlineTodayWorkout.workout_date,
              workout_type: offlineTodayWorkout.workout_type,
              notes: offlineTodayWorkout.notes,
              duration_minutes: offlineTodayWorkout.duration_minutes,
              created_at: offlineTodayWorkout.created_at,
            }
          : null),
    );

    setLoading(false);
  }, [showAlert]);

  function actuallyStartSession() {
    if (!splitChosen) {
      showAlert({
        title: "Choose workout split",
        message: "Select a workout split before starting your session.",
      });
      return;
    }

    if (selectedExercises.length === 0) {
      showAlert({
        title: "No exercises",
        message: "Select at least one exercise for this workout.",
      });
      return;
    }

    restAlertPlayedForEndAt = null;

    setWorkoutSession({
      sessionStarted: true,
      workoutType: selectedPlan.type,
      isPaused: false,
      startedAtMs: Date.now(),
      activeMs: 0,
      elapsedSeconds: 0,
      sets: [],
      notes: "",
      isResting: false,
      restRemaining: 0,
      restExerciseId: null,
      restEndsAtMs: null,
    });

    startWorkoutTicker(playRestCompleteAlert);
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
    const current = getWorkoutSession();

    if (!current.sessionStarted || saving) return;

    if (current.isPaused) {
      setWorkoutSession({
        isPaused: false,
        startedAtMs: Date.now(),
        restEndsAtMs: current.isResting
          ? Date.now() + current.restRemaining * 1000
          : null,
      });
      return;
    }

    const activeMs =
      current.activeMs +
      (current.startedAtMs ? Date.now() - current.startedAtMs : 0);

    setWorkoutSession({
      isPaused: true,
      startedAtMs: null,
      activeMs,
      elapsedSeconds: Math.floor(activeMs / 1000),
      restRemaining: getRestRemaining(current),
      restEndsAtMs: null,
    });
  }

  function openExercise(exercise: Exercise) {
    const current = getWorkoutSession();

    if (!current.sessionStarted) {
      showAlert({
        title: "Start workout",
        message: "Tap Start Workout first.",
      });
      return;
    }

    if (current.isPaused) {
      showAlert({
        title: "Workout paused",
        message: "Resume the workout before logging sets.",
      });
      return;
    }

    if (current.isResting && current.restExerciseId !== exercise.id) {
      showAlert({
        title: "Rest timer active",
        message: `Please wait ${formatRest(
          current.restRemaining,
        )} before starting another set.`,
      });
      return;
    }

    setActiveExercise(exercise);
    setModalVisible(true);
  }

  function getNextSetNumber(exerciseId: string) {
    return (
      getWorkoutSession().sets.filter((set) => set.exercise_id === exerciseId)
        .length + 1
    );
  }

  function completeSetFromModal(set: {
    exercise_id: string;
    exercise_name: string;
    set_number: number;
    reps: string;
    weight_kg: string;
    rest_seconds: string;
  }) {
    const rest = Number(set.rest_seconds) || 90;
    const restEndsAtMs = Date.now() + rest * 1000;

    restAlertPlayedForEndAt = null;

    setWorkoutSession((current) => ({
      ...current,
      sets: [
        ...current.sets,
        {
          local_id: `${set.exercise_id}-${set.set_number}-${Date.now()}`,
          exercise_id: set.exercise_id,
          exercise_name: set.exercise_name,
          set_number: set.set_number,
          reps: set.reps,
          weight_kg: set.weight_kg,
          rest_seconds: set.rest_seconds,
        },
      ],
      restExerciseId: set.exercise_id,
      restRemaining: rest,
      isResting: true,
      restEndsAtMs,
    }));
  }

  function finishRest() {
    setWorkoutSession({
      isResting: false,
      restRemaining: 0,
      restExerciseId: null,
      restEndsAtMs: null,
    });
  }

  function toggleExerciseSelection(exerciseId: string) {
    setSelectedExerciseIds((current) => {
      const next = new Set(current);

      if (next.has(exerciseId) && !session.sessionStarted) {
        next.delete(exerciseId);
      } else if (!next.has(exerciseId)) {
        next.add(exerciseId);
      }

      return next;
    });
  }

  function handleExercisePress(exercise: Exercise) {
    if (!session.sessionStarted) {
      toggleExerciseSelection(exercise.id);
      return;
    }

    if (!selectedExerciseIds.has(exercise.id)) {
      toggleExerciseSelection(exercise.id);
      return;
    }

    openExercise(exercise);
  }

  function addExerciseToSession(exercise: Exercise) {
    if (!session.sessionStarted || selectedExerciseIds.has(exercise.id)) return;

    toggleExerciseSelection(exercise.id);
    closeAddExercisePicker();
  }

  function closeAddExercisePicker() {
    setExerciseSearch("");
    setAddExerciseVisible(false);
  }

  function requestRemoveExercise(exercise: Exercise) {
    if (!session.sessionStarted || !selectedExerciseIds.has(exercise.id)) return;

    const exerciseSetCount = getWorkoutSession().sets.filter(
      (set) => set.exercise_id === exercise.id,
    ).length;

    showAlert({
      title: "Remove Exercise?",
      message:
        exerciseSetCount > 0
          ? `This removes ${exercise.name} and its ${exerciseSetCount} logged set${exerciseSetCount === 1 ? "" : "s"} from this session.`
          : `This removes ${exercise.name} from this session.`,
      cancelText: "Cancel",
      confirmText: "Remove Exercise",
      danger: true,
      onConfirm: () => {
        setSelectedExerciseIds((current) => {
          const next = new Set(current);
          next.delete(exercise.id);
          return next;
        });
        setWorkoutSession((current) => {
          const removingRestExercise = current.restExerciseId === exercise.id;

          return {
            ...current,
            sets: current.sets.filter(
              (set) => set.exercise_id !== exercise.id,
            ),
            isResting: removingRestExercise ? false : current.isResting,
            restRemaining: removingRestExercise ? 0 : current.restRemaining,
            restExerciseId: removingRestExercise
              ? null
              : current.restExerciseId,
            restEndsAtMs: removingRestExercise ? null : current.restEndsAtMs,
          };
        });

        if (activeExercise?.id === exercise.id) {
          setModalVisible(false);
          setActiveExercise(null);
        }
      },
    });
  }

  function openRecoveryCheckIn() {
    setRecovery(createRecoveryCheckIn(3));
    setRecoveryVisible(true);
  }

  function removeSet(localId: string) {
    setWorkoutSession((current) => {
      const target = current.sets.find((set) => set.local_id === localId);
      const filtered = current.sets.filter((set) => set.local_id !== localId);

      if (!target) {
        return {
          ...current,
          sets: filtered,
        };
      }

      const sameExerciseSets = filtered.filter(
        (set) => set.exercise_id === target.exercise_id,
      );

      return {
        ...current,
        sets: filtered.map((set) => {
          if (set.exercise_id !== target.exercise_id) return set;

          const index = sameExerciseSets.findIndex(
            (item) => item.local_id === set.local_id,
          );

          return {
            ...set,
            set_number: index + 1,
          };
        }),
      };
    });
  }

  async function endAndSaveWorkout() {
    const current = getWorkoutSession();

    if (current.sets.length === 0) {
      showAlert({
        title: "No sets",
        message: "Log at least one set before ending workout.",
      });
      return;
    }

    const exercisesWithoutSets = selectedExercises.filter((exercise) => {
      return !current.sets.some((set) => set.exercise_id === exercise.id);
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
        onConfirm: openRecoveryCheckIn,
      });

      return;
    }

    showAlert({
      title: "End workout?",
      message: "This will stop the timer and save your workout.",
      cancelText: "Cancel",
      confirmText: "End & Save",
      onConfirm: openRecoveryCheckIn,
    });
  }

  async function saveWorkout(recoveryCheckIn: RecoveryCheckIn) {
    if (savingRef.current) return;

    setRecoveryVisible(false);

    const current = getWorkoutSession();
    const finalElapsedSeconds = getElapsedSeconds(current);

    savingRef.current = true;
    setSaving(true);

    function finishSaving() {
      savingRef.current = false;
      setSaving(false);
    }

    setWorkoutSession({
      sessionStarted: false,
      isPaused: false,
      startedAtMs: null,
      activeMs: finalElapsedSeconds * 1000,
      elapsedSeconds: finalElapsedSeconds,
      isResting: false,
      restRemaining: 0,
      restExerciseId: null,
      restEndsAtMs: null,
    });

    stopWorkoutTicker();

    const userId = await resolveOfflineUserId();

    if (!userId) {
      finishSaving();
      return;
    }

    const durationMinutes = Math.max(1, Math.round(finalElapsedSeconds / 60));
    const offlineSets = current.sets.map((set) => ({
      exercise_id: set.exercise_id,
      exercise_name: set.exercise_name,
      set_number: set.set_number,
      reps: Number(set.reps),
      weight_kg: Number(set.weight_kg),
      rest_seconds: Number(set.rest_seconds) || null,
    }));

    async function saveOfflineCopy() {
      await createOfflineWorkout({
        workout_date: getTodayDateString(),
        workout_type: current.workoutType || selectedPlan.type,
        duration_minutes: durationMinutes,
        notes: current.notes.trim() || null,
        recovery: recoveryCheckIn,
        sets: offlineSets,
      });

      finishSaving();
      resetWorkoutSession();
      showAlert({
        title: "Workout saved offline",
        message: "It will sync to Supabase when you are online.",
        confirmText: "OK",
        onConfirm: () => router.back(),
      });
    }

    if (!(await isOnline())) {
      await saveOfflineCopy();
      return;
    }

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        workout_date: getTodayDateString(),
        workout_type: current.workoutType || selectedPlan.type,
        duration_minutes: durationMinutes,
        notes: current.notes.trim() || null,
        ...recoveryCheckIn,
      })
      .select("id")
      .single();

    if (workoutError || !workout) {
      console.log("Create workout error:", workoutError);
      await saveOfflineCopy();
      return;
    }

    const rows = offlineSets.map((set) => ({
      user_id: userId,
      workout_id: workout.id,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      reps: set.reps,
      weight_kg: set.weight_kg,
      rest_seconds: set.rest_seconds,
    }));

    const { error: setsError } = await supabase
      .from("workout_sets")
      .insert(rows);

    if (setsError) {
      console.log("Save sets error:", setsError);
      await supabase.from("workouts").delete().eq("id", workout.id);
      await saveOfflineCopy();
      return;
    }

    finishSaving();
    resetWorkoutSession();

    showAlert({
      title: "Workout saved",
      message: "Your workout was logged successfully.",
      confirmText: "OK",
      onConfirm: () => router.back(),
    });
  }

  function handleClosePress() {
    if (session.sessionStarted || session.isPaused) {
      setCloseAlertVisible(true);
      return;
    }

    router.back();
  }

  function confirmCloseSession() {
    setCloseAlertVisible(false);
    setModalVisible(false);
    resetWorkoutSession();
    router.back();
  }

  useFocusEffect(
    useCallback(() => {
      setSessionTheme(splitChosen ? selectedPlan.type : "default");

      return () => {
        setSessionTheme("default");
      };
    }, [selectedPlan.type, setSessionTheme, splitChosen]),
  );

  useEffect(() => {
    if (!session.sessionStarted || !session.workoutType) return;

    const activePlan = WORKOUT_PLANS.find(
      (plan) => plan.type === session.workoutType,
    );
    if (!activePlan) return;

    setSelectedPlan(activePlan);
    setSplitChosen(true);
  }, [session.sessionStarted, session.workoutType]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const availableExercises = session.sessionStarted
      ? exercises
      : recommendedExercises;
    const availableIds = new Set(
      availableExercises.map((exercise) => exercise.id),
    );

    setSelectedExerciseIds((current) => {
      const next = new Set(
        Array.from(current).filter((exerciseId) => availableIds.has(exerciseId)),
      );

      return next.size === current.size ? current : next;
    });
  }, [exercises, recommendedExercises, session.sessionStarted]);

  useEffect(() => {
    if (session.sessionStarted && !workoutTimerRef) {
      startWorkoutTicker(playRestCompleteAlert);
    }
  }, [session.sessionStarted]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;

      const current = getWorkoutSession();

      if (!current.sessionStarted) return;

      const restRemaining = getRestRemaining(current);

      if (
        current.isResting &&
        !current.isPaused &&
        restRemaining <= 0 &&
        current.restEndsAtMs &&
        restAlertPlayedForEndAt !== current.restEndsAtMs
      ) {
        restAlertPlayedForEndAt = current.restEndsAtMs;
        finishRest();
        void playRestCompleteAlert();
      } else {
        setWorkoutSession({
          elapsedSeconds: getElapsedSeconds(current),
          restRemaining,
        });
      }

      startWorkoutTicker(playRestCompleteAlert);
    });

    return () => subscription.remove();
  }, []);

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

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            marginTop: 20,
            color: theme.colors.text,
          }}
        >
          Workout Focus
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ gap: 10, paddingRight: 2 }}
        >
          {WORKOUT_PLANS.map((plan) => {
            const active = splitChosen && selectedPlan.type === plan.type;

            return (
              <Pressable
                key={plan.type}
                disabled={session.sessionStarted}
                onPress={() => {
                  setSelectedPlan(plan);
                  setSplitChosen(true);
                  setSelectedExerciseIds(new Set());
                }}
                style={{
                  minWidth: 132,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surface,
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: active
                    ? theme.colors.primary
                    : theme.colors.border,
                  opacity: session.sessionStarted && !active ? 0.45 : 1,
                }}
              >
                <Text
                  style={{
                    color: active
                      ? theme.colors.textInverse
                      : theme.colors.text,
                    fontWeight: "900",
                  }}
                >
                  {plan.emoji} {plan.label}
                </Text>

                <Text
                  style={{
                    color: active
                      ? theme.colors.textInverse
                      : theme.colors.textMuted,
                    marginTop: 6,
                    fontSize: 12,
                  }}
                >
                  Workout type
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          style={{
            backgroundColor: session.isPaused
              ? theme.colors.warning
              : theme.colors.primary,
            borderRadius: 20,
            padding: 18,
            marginTop: 20,
          }}
        >
          <Text style={{ color: theme.colors.textInverse }}>
            Current Session {session.isPaused ? "• Paused" : ""}
          </Text>

          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: 34,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            {formatDuration(session.elapsedSeconds)}
          </Text>

          <Text style={{ color: theme.colors.textInverse, marginTop: 8 }}>
            {splitChosen ? selectedPlan.label : "Choose a workout split"} •{" "}
            {session.sets.length} sets •{" "}
            {totalVolume.toLocaleString()} kg volume
          </Text>

          {session.isPaused ? (
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

        {session.isResting ? (
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
              ⏱️ Rest timer active {session.isPaused ? "• Paused" : ""}
            </Text>

            <Text
              style={{
                color: theme.colors.primary,
                marginTop: 6,
                fontSize: 28,
                fontWeight: "900",
              }}
            >
              {formatRest(session.restRemaining)}
            </Text>

            <Text style={{ color: theme.colors.primary, marginTop: 6 }}>
              Another set cannot start until the timer is finished.
            </Text>
          </View>
        ) : null}

        {!session.sessionStarted ? (
          <Pressable
            onPress={startSession}
            disabled={loading || selectedExercises.length === 0}
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: 18,
              padding: 18,
              alignItems: "center",
              marginTop: 18,
              opacity: loading || selectedExercises.length === 0 ? 0.5 : 1,
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
                backgroundColor: session.isPaused
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderRadius: 18,
                padding: 18,
                alignItems: "center",
                borderWidth: 1,
                borderColor: session.isPaused
                  ? theme.colors.primary
                  : theme.colors.border,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: session.isPaused
                    ? theme.colors.textInverse
                    : theme.colors.text,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                {session.isPaused ? "Resume" : "Pause"}
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
          {session.sessionStarted ? "Session Exercises" : "Select Exercises"}
        </Text>

        {session.sessionStarted ? (
          <>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              {selectedExercises.length} exercises in this session.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercise to session"
              disabled={unselectedExerciseCount === 0}
              onPress={() => setAddExerciseVisible(true)}
              style={{
                minHeight: 50,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                marginTop: 12,
                opacity: unselectedExerciseCount === 0 ? 0.5 : 1,
              }}
            >
              <Plus size={20} color={theme.colors.primary} />
              <Text
                style={{ color: theme.colors.primary, fontWeight: "900" }}
              >
                {unselectedExerciseCount === 0
                  ? "All Exercises Added"
                  : "Add Exercise"}
              </Text>
            </Pressable>
          </>
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 20 }}
          />
        ) : visibleExercises.length === 0 ? (
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
              {splitChosen ? "No exercises found" : "Choose a workout split"}
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              {splitChosen
                ? "Go to setup and add exercises for these muscle groups."
                : "Select Push, Pull, Legs, Upper Body, Lower, or Arms above."}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            {!session.sessionStarted ? (
              <Text style={{ color: theme.colors.textMuted, marginBottom: 10 }}>
                {selectedExercises.length} selected
              </Text>
            ) : null}

            {exerciseSections.map(([group, groupExercises]) => (
              <View key={group} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontWeight: "900",
                    marginBottom: 8,
                  }}
                >
                  {formatMuscleGroup(group)} ({groupExercises.length})
                </Text>

                {groupExercises.map((item) => {
                  const exerciseSets = session.sets.filter(
                    (set) => set.exercise_id === item.id,
                  );

                  const volume = exerciseSets.reduce((sum, set) => {
                    return (
                      sum +
                      (Number(set.reps) || 0) * (Number(set.weight_kg) || 0)
                    );
                  }, 0);

                  const isSelected = selectedExerciseIds.has(item.id);
                  const isDisabledByRest =
                    session.isResting && session.restExerciseId !== item.id;
                  const isDisabled =
                    isSelected && (isDisabledByRest || session.isPaused);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleExercisePress(item)}
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor:
                          isSelected || isDisabledByRest
                            ? theme.colors.primary
                            : theme.colors.border,
                        opacity: isDisabled ? 0.5 : 1,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        {!session.sessionStarted ? (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.border,
                              backgroundColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.surfaceAlt,
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: 1,
                            }}
                          >
                            {isSelected ? (
                              <Check size={16} color={theme.colors.textInverse} />
                            ) : null}
                          </View>
                        ) : null}

                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <Text
                              style={{
                                flex: 1,
                                fontSize: 16,
                                fontWeight: "800",
                                color: theme.colors.text,
                              }}
                            >
                              {item.name}
                            </Text>
                            {session.sessionStarted ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${item.name} from session`}
                                hitSlop={10}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  requestRemoveExercise(item);
                                }}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 18,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: theme.colors.surfaceAlt,
                                }}
                              >
                                <Trash2
                                  size={18}
                                  color={theme.colors.danger ?? "#ef4444"}
                                />
                              </Pressable>
                            ) : null}
                          </View>

                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              marginTop: 6,
                            }}
                          >
                            {item.is_compound ? "Compound" : "Isolation"}
                          </Text>

                          {session.sessionStarted ? (
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
                                  color: isSelected
                                    ? theme.colors.text
                                    : theme.colors.primary,
                                }}
                              >
                                {isSelected
                                  ? `${exerciseSets.length} sets`
                                  : "+ Add to session"}
                              </Text>

                              {isSelected ? (
                                <Text
                                  style={{
                                    color: theme.colors.textMuted,
                                    fontSize: 12,
                                  }}
                                >
                                  {volume.toLocaleString()} kg
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
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

        {session.sets.length === 0 ? (
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
            {session.sets.map((set) => (
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
          value={session.notes}
          onChangeText={(notes) => setWorkoutSession({ notes })}
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

      <Modal
        visible={addExerciseVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddExercisePicker}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <Pressable
            accessibilityLabel="Close exercise picker"
            onPress={closeAddExercisePicker}
            style={{ flex: 1 }}
          />
          <View
            style={{
              maxHeight: "78%",
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 18,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  Add Exercise
                </Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  Choose one exercise to add to this session.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close exercise picker"
                onPress={closeAddExercisePicker}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <X size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Search exercises"
              autoCapitalize="none"
              onChangeText={setExerciseSearch}
              placeholder="Search exercises..."
              placeholderTextColor={theme.colors.textFaint}
              value={exerciseSearch}
              style={{
                minHeight: 48,
                marginTop: 16,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceAlt,
                color: theme.colors.text,
              }}
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ marginTop: 14 }}
            >
              {availableExercises.length === 0 ? (
                <View
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Text
                    style={{ color: theme.colors.textMuted, textAlign: "center" }}
                  >
                    {unselectedExerciseCount === 0
                      ? "All exercises are already in this session."
                      : "No exercises match your search."}
                  </Text>
                </View>
              ) : (
                availableExerciseSections.map(([group, groupExercises]) => (
                  <View key={group} style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 12,
                        fontWeight: "900",
                        textTransform: "uppercase",
                        marginBottom: 7,
                      }}
                    >
                      {formatMuscleGroup(group)}
                    </Text>
                    {groupExercises.map((exercise) => (
                      <Pressable
                        accessibilityRole="button"
                        key={exercise.id}
                        onPress={() => addExerciseToSession(exercise)}
                        style={{
                          minHeight: 54,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          marginBottom: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontWeight: "800",
                            }}
                          >
                            {exercise.name}
                          </Text>
                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            {exercise.is_compound ? "Compound" : "Isolation"}
                          </Text>
                        </View>
                        <Plus size={20} color={theme.colors.primary} />
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={recoveryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRecoveryVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 20,
              padding: 18,
              maxHeight: "90%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                Recovery Check-in
              </Text>
              <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
                Rate how you feel before saving this workout.
              </Text>

              {RECOVERY_METRICS.map((metric) => (
                <View key={metric.key} style={{ marginTop: 18 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{ color: theme.colors.text, fontWeight: "800" }}
                    >
                      {metric.label}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted }}>
                      {metric.hint}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}>
                    {[1, 2, 3, 4, 5].map((score) => {
                      const active = recovery[metric.key] === score;
                      return (
                        <Pressable
                          key={score}
                          onPress={() =>
                            setRecovery((current) => ({
                              ...current,
                              [metric.key]: score,
                            }))
                          }
                          style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 11,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: active
                              ? theme.colors.primary
                              : theme.colors.border,
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surfaceAlt,
                          }}
                        >
                          <Text
                            style={{
                              color: active
                                ? theme.colors.textInverse
                                : theme.colors.text,
                              fontWeight: "900",
                            }}
                          >
                            {score}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
                <Pressable
                  disabled={saving}
                  onPress={() => void saveWorkout(createRecoveryCheckIn())}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: "800" }}>
                    Skip
                  </Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => void saveWorkout(recovery)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: theme.colors.primary,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.textInverse,
                      fontWeight: "900",
                    }}
                  >
                    Save Workout
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ExerciseSessionModal
        visible={modalVisible}
        exercise={activeExercise}
        startingSetNumber={
          activeExercise ? getNextSetNumber(activeExercise.id) : 1
        }
        isResting={session.isResting}
        restRemaining={session.restRemaining}
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
        title={session.isPaused ? "Workout is paused" : "Workout in progress"}
        message={
          session.isPaused
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

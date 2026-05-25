import AddExerciseModal from "@/components/AddExerciseModal";
import ThemedAlert from "@/components/ThemedAlert";
import { isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  cacheWorkoutExercises,
  getCachedWorkoutExercises,
} from "@/lib/offlineWorkouts";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  dedupeExercisesByMuscleGroup,
  formatMuscleGroup,
  groupExercisesByMuscleGroup,
  isWorkoutType,
  sortExercisesByMuscleGroup,
  type MuscleGroup,
  type WorkoutType,
} from "@/lib/workoutPlans";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Plus, SquarePen, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type SetupThemeType = WorkoutType;

type Exercise = {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string | null;
  movement_type: WorkoutType | null;
  is_compound: boolean;
  created_at: string;
};

type ExerciseForm = {
  id?: string;
  name: string;
  muscle_group: string;
  movement_type: WorkoutType | null;
  is_compound: boolean;
};

const FILTERS: ("all" | MuscleGroup)[] = [
  "all",
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
];

const EMPTY_FORM: ExerciseForm = {
  name: "",
  muscle_group: "chest",
  movement_type: null,
  is_compound: false,
};

function isSetupThemeType(value: unknown): value is SetupThemeType {
  return typeof value === "string" && isWorkoutType(value);
}

export default function WorkoutSetupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ExerciseForm>(EMPTY_FORM);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

  const params = useLocalSearchParams<{ split?: SetupThemeType }>();

  const routeSplit: SetupThemeType = isSetupThemeType(params.split)
    ? params.split
    : "push";

  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");

  const filteredExercises = useMemo(() => {
    let nextExercises = exercises;

    if (filter !== "all") {
      nextExercises = nextExercises.filter(
        (exercise) => exercise.muscle_group === filter,
      );
    }

    return filter === "all"
      ? sortExercisesByMuscleGroup(nextExercises)
      : nextExercises.sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, filter]);

  const exerciseSections = useMemo(() => {
    return groupExercisesByMuscleGroup(filteredExercises);
  }, [filteredExercises]);

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

  async function loadExercises() {
    setLoading(true);

    const online = await isOnline();
    const userId = await resolveOfflineUserId();

    if (!userId) {
      setLoading(false);
      return;
    }

    if (!online) {
      setExercises((await getCachedWorkoutExercises()) as Exercise[]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("muscle_group", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.log("Load exercises error:", error);
      showAlert({
        title: "Error",
        message: "Could not load exercises.",
        danger: true,
      });
    }

    const nextExercises = dedupeExercisesByMuscleGroup((data || []) as Exercise[]);
    setExercises(nextExercises);
    await cacheWorkoutExercises(nextExercises);
    setLoading(false);
  }
  function openAddModal() {
    setForm({
      ...EMPTY_FORM,
      muscle_group: filter === "all" ? "chest" : filter,
    });
    setModalVisible(true);
  }

  function openEditModal(exercise: Exercise) {
    setForm({
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group || "chest",
      movement_type: null,
      is_compound: exercise.is_compound,
    });
    setModalVisible(true);
  }

  async function saveExercise(nextForm: ExerciseForm) {
    if (savingRef.current) return;

    if (!nextForm.name.trim()) {
      showAlert({
        title: "Missing name",
        message: "Please enter an exercise name.",
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);

    function finishSaving() {
      savingRef.current = false;
      setSaving(false);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      finishSaving();
      return;
    }

    if (nextForm.id) {
      const { error } = await supabase
        .from("exercises")
        .update({
          name: nextForm.name.trim(),
          muscle_group: nextForm.muscle_group,
          movement_type: null,
          is_compound: nextForm.is_compound,
        })
        .eq("id", nextForm.id)
        .eq("user_id", user.id);

      if (error) {
        console.log("Update exercise error:", error);
        showAlert({
          title: "Error",
          message: "Could not update exercise.",
          danger: true,
        });
        finishSaving();
        return;
      }
    } else {
      const { error } = await supabase.from("exercises").insert({
        user_id: user.id,
        name: nextForm.name.trim(),
        muscle_group: nextForm.muscle_group,
        movement_type: null,
        is_compound: nextForm.is_compound,
      });

      if (error) {
        console.log("Create exercise error:", error);
        showAlert({
          title: "Error",
          message: "Could not add exercise.",
          danger: true,
        });
        finishSaving();
        return;
      }
    }

    setModalVisible(false);
    await loadExercises();
    finishSaving();
  }

  async function confirmDeleteExercise(exercise: Exercise) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", exercise.id)
      .eq("user_id", user.id);

    if (error) {
      console.log("Delete exercise error:", error);
      showAlert({
        title: "Cannot delete",
        message:
          "This exercise is already used in a workout. Rename it instead.",
        danger: true,
      });
      return;
    }

    await loadExercises();
  }

  async function deleteExercise(exercise: Exercise) {
    showAlert({
      title: "Delete exercise?",
      message: `Delete ${exercise.name}? This cannot be undone.`,
      cancelText: "Cancel",
      confirmText: "Delete",
      danger: true,
      onConfirm: () => confirmDeleteExercise(exercise),
    });
  }

  useFocusEffect(
    useCallback(() => {
      theme.setSessionTheme(routeSplit);

      return () => {
        theme.setSessionTheme("default");
      };
    }, [routeSplit, theme.setSessionTheme]),
  );

  useEffect(() => {
    loadExercises();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "",
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerLeft: () => (
            <View
              style={{
                width: screenWidth - 18,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
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

              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              />

              <Pressable
                onPress={openAddModal}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={24} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ),
          headerRight: () => null,
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ color: theme.colors.textMuted }}>
            Exercise Library by Muscle Group
          </Text>

          <Text
            style={{
              color: theme.colors.text,
              fontSize: 26,
              fontWeight: "800",
              marginTop: 6,
            }}
          >
            {exercises.length} exercises
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 16 }}
        >
          {FILTERS.map((item) => {
            const active = filter === item;

            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: active
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: active
                      ? theme.colors.textInverse
                      : theme.colors.text,
                    fontWeight: "800",
                  }}
                >
                  {item === "all" ? "All" : formatMuscleGroup(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            marginTop: 22,
            marginBottom: 10,
            color: theme.colors.text,
          }}
        >
          Exercises ({filteredExercises.length})
        </Text>

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 24 }}
          />
        ) : filteredExercises.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text style={{ fontWeight: "800", color: theme.colors.text }}>
              No exercises yet
            </Text>

            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Add exercises to your muscle-group library.
            </Text>
          </View>
        ) : (
          exerciseSections.map(([group, groupExercises]) => (
            <View key={group} style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: "900",
                  marginBottom: 8,
                }}
              >
                {formatMuscleGroup(group)} ({groupExercises.length})
              </Text>

              {groupExercises.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor:
                      filter !== "all" && item.muscle_group === filter
                        ? theme.colors.primary
                        : theme.colors.border,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
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
                          marginTop: 4,
                        }}
                      >
                        {formatMuscleGroup(item.muscle_group)}
                      </Text>

                      <Text
                        style={{
                          marginTop: 8,
                          color: item.is_compound
                            ? theme.colors.success
                            : theme.colors.textMuted,
                          fontWeight: "700",
                        }}
                      >
                        {item.is_compound ? "Compound" : "Isolation"}
                      </Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => openEditModal(item)}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          backgroundColor: theme.colors.info + "15",
                          borderWidth: 1,
                          borderColor: theme.colors.info + "30",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <SquarePen size={18} color={theme.colors.info} />
                      </Pressable>

                      <Pressable
                        onPress={() => deleteExercise(item)}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          backgroundColor: theme.colors.danger + "15",
                          borderWidth: 1,
                          borderColor: theme.colors.danger + "30",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Trash2 size={18} color={theme.colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <AddExerciseModal
        visible={modalVisible}
        form={form}
        saving={saving}
        onClose={() => setModalVisible(false)}
        onSave={saveExercise}
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
    </View>
  );
}

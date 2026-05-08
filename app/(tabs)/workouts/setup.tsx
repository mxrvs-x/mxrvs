import AddExerciseModal from "@/components/AddExerciseModal";
import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Plus, SquarePen, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type MovementType = "push" | "pull" | "legs" | "upper" | "lower";

type Exercise = {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string | null;
  movement_type: MovementType | null;
  is_compound: boolean;
  created_at: string;
};

type ExerciseForm = {
  id?: string;
  name: string;
  muscle_group: string;
  movement_type: MovementType;
  is_compound: boolean;
};

const FILTERS: ("all" | MovementType)[] = [
  "all",
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
];

const EMPTY_FORM: ExerciseForm = {
  name: "",
  muscle_group: "chest",
  movement_type: "push",
  is_compound: false,
};

export default function WorkoutSetupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [search, setSearch] = useState("");

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

  const params = useLocalSearchParams<{ split?: MovementType }>();

  const initialSplit: MovementType =
    params.split === "push" ||
    params.split === "pull" ||
    params.split === "legs" ||
    params.split === "upper" ||
    params.split === "lower"
      ? params.split
      : "push";
  const [filter, setFilter] = useState<"all" | MovementType>(initialSplit);

  const filteredExercises = useMemo(() => {
    let nextExercises = exercises;

    if (filter !== "all") {
      nextExercises = nextExercises.filter(
        (exercise) => exercise.movement_type === filter,
      );
    }

    const query = search.trim().toLowerCase();

    if (query.length > 0) {
      nextExercises = nextExercises.filter((exercise) => {
        return (
          exercise.name.toLowerCase().includes(query) ||
          (exercise.muscle_group || "").toLowerCase().includes(query) ||
          (exercise.movement_type || "").toLowerCase().includes(query)
        );
      });
    }

    return nextExercises;
  }, [exercises, filter, search]);

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("user_id", user.id)
      .order("movement_type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.log("Load exercises error:", error);
      showAlert({
        title: "Error",
        message: "Could not load exercises.",
        danger: true,
      });
    }

    setExercises((data || []) as Exercise[]);
    setLoading(false);
  }
  function openAddModal() {
    setForm({
      ...EMPTY_FORM,
      movement_type: filter === "all" ? "push" : filter,
    });
    setModalVisible(true);
  }

  function openEditModal(exercise: Exercise) {
    setForm({
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group || "chest",
      movement_type: (exercise.movement_type || "push") as MovementType,
      is_compound: exercise.is_compound,
    });
    setModalVisible(true);
  }

  async function saveExercise(nextForm: ExerciseForm) {
    if (!nextForm.name.trim()) {
      showAlert({
        title: "Missing name",
        message: "Please enter an exercise name.",
      });
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    if (nextForm.id) {
      const { error } = await supabase
        .from("exercises")
        .update({
          name: nextForm.name.trim(),
          muscle_group: nextForm.muscle_group,
          movement_type: nextForm.movement_type,
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
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("exercises").insert({
        user_id: user.id,
        name: nextForm.name.trim(),
        muscle_group: nextForm.muscle_group,
        movement_type: nextForm.movement_type,
        is_compound: nextForm.is_compound,
      });

      if (error) {
        console.log("Create exercise error:", error);
        showAlert({
          title: "Error",
          message: "Could not add exercise.",
          danger: true,
        });
        setSaving(false);
        return;
      }
    }

    setModalVisible(false);
    await loadExercises();
    setSaving(false);
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
      theme.setSessionTheme(filter === "all" ? initialSplit : filter);

      return () => {
        theme.setSessionTheme("default");
      };
    }, [filter, initialSplit]),
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
            Exercise Library
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
                    textTransform: "capitalize",
                  }}
                >
                  {item}
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
              Add exercises for this workout day.
            </Text>
          </View>
        ) : (
          filteredExercises.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor:
                  filter !== "all" && item.movement_type === filter
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
                      textTransform: "capitalize",
                    }}
                  >
                    {item.movement_type} • {item.muscle_group}
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

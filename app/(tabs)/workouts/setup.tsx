import AddExerciseModal from "@/components/AddExerciseModal";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filter, setFilter] = useState<"all" | MovementType>("all");

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ExerciseForm>(EMPTY_FORM);

  const filteredExercises = useMemo(() => {
    if (filter === "all") return exercises;
    return exercises.filter((exercise) => exercise.movement_type === filter);
  }, [exercises, filter]);

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
      Alert.alert("Error", "Could not load exercises.");
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
      Alert.alert("Missing name", "Please enter an exercise name.");
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
        Alert.alert("Error", "Could not update exercise.");
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
        Alert.alert("Error", "Could not add exercise.");
        setSaving(false);
        return;
      }
    }

    setModalVisible(false);
    await loadExercises();
    setSaving(false);
  }

  async function deleteExercise(exercise: Exercise) {
    Alert.alert(
      "Delete exercise?",
      `Delete ${exercise.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
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
              Alert.alert(
                "Cannot delete",
                "This exercise is already used in a workout. Rename it instead.",
              );
              return;
            }

            await loadExercises();
          },
        },
      ],
    );
  }

  useEffect(() => {
    loadExercises();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F7F7" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            marginTop: 48,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={{ fontSize: 28, fontWeight: "800" }}>
              Workout Setup
            </Text>
            <Text style={{ color: "#666", marginTop: 4 }}>
              Manage your exercises
            </Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: "#fff",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Done</Text>
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: "#111",
            borderRadius: 20,
            padding: 18,
            marginTop: 20,
          }}
        >
          <Text style={{ color: "#aaa" }}>Exercise Library</Text>

          <Text
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: "800",
              marginTop: 6,
            }}
          >
            {exercises.length} exercises
          </Text>

          <Text style={{ color: "#bbb", marginTop: 8 }}>
            Push, Pull, Legs/Core, Upper, and Lower/Arms.
          </Text>
        </View>

        <Pressable
          onPress={openAddModal}
          style={{
            backgroundColor: "#111",
            borderRadius: 16,
            padding: 16,
            marginTop: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Add Exercise</Text>
        </Pressable>

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
                  backgroundColor: active ? "#111" : "#fff",
                  borderWidth: 1,
                  borderColor: active ? "#111" : "#ddd",
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : "#111",
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
          }}
        >
          Exercises ({filteredExercises.length})
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : filteredExercises.length === 0 ? (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "800" }}>No exercises yet</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>
              Add exercises for this workout day.
            </Text>
          </View>
        ) : (
          filteredExercises.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: "#eee",
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800" }}>
                    {item.name}
                  </Text>

                  <Text
                    style={{
                      color: "#666",
                      marginTop: 4,
                      textTransform: "capitalize",
                    }}
                  >
                    {item.movement_type} • {item.muscle_group}
                  </Text>

                  <Text
                    style={{
                      marginTop: 8,
                      color: item.is_compound ? "#167A2F" : "#666",
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
                      backgroundColor: "#F1F1F1",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "800" }}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteExercise(item)}
                    style={{
                      backgroundColor: "#FFECEC",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#C00", fontWeight: "800" }}>
                      Delete
                    </Text>
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
    </View>
  );
}

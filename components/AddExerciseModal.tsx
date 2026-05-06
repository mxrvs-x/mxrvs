import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

type MovementType = "push" | "pull" | "legs" | "upper" | "lower";

type ExerciseForm = {
  id?: string;
  name: string;
  muscle_group: string;
  movement_type: MovementType;
  is_compound: boolean;
};

type Props = {
  visible: boolean;
  form: ExerciseForm;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ExerciseForm) => void | Promise<void>;
};

const WORKOUT_TYPES: MovementType[] = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
];

const MUSCLE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core"];

export default function AddExerciseModal({
  visible,
  form,
  saving,
  onClose,
  onSave,
}: Props) {
  const [localForm, setLocalForm] = useState(form);

  useEffect(() => {
    if (visible) setLocalForm(form);
  }, [visible, form]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          alignItems: "center",
          padding: 18,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            maxHeight: "90%",
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 20,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* HEADER */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "900" }}>
                {localForm.id ? "Edit Exercise" : "Add Exercise"}
              </Text>

              <Pressable onPress={onClose}>
                <Text style={{ fontWeight: "800" }}>Close</Text>
              </Pressable>
            </View>

            {/* NAME */}
            <Text style={{ fontWeight: "700", marginTop: 18 }}>
              Exercise Name
            </Text>

            <TextInput
              value={localForm.name}
              onChangeText={(v) => setLocalForm({ ...localForm, name: v })}
              placeholder="Bench Press"
              style={{
                backgroundColor: "#F7F7F7",
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
              }}
            />

            {/* WORKOUT TYPE */}
            <Text style={{ fontWeight: "700", marginTop: 18 }}>
              Workout Type
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {WORKOUT_TYPES.map((type) => {
                const active = localForm.movement_type === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() =>
                      setLocalForm({ ...localForm, movement_type: type })
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? "#111" : "#F1F1F1",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#fff" : "#111",
                        fontWeight: "800",
                        textTransform: "capitalize",
                      }}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* MUSCLE GROUP */}
            <Text style={{ fontWeight: "700", marginTop: 18 }}>
              Muscle Group
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {MUSCLE_GROUPS.map((group) => {
                const active = localForm.muscle_group === group;

                return (
                  <Pressable
                    key={group}
                    onPress={() =>
                      setLocalForm({ ...localForm, muscle_group: group })
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? "#111" : "#F1F1F1",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#fff" : "#111",
                        fontWeight: "800",
                        textTransform: "capitalize",
                      }}
                    >
                      {group}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* TYPE */}
            <Text style={{ fontWeight: "700", marginTop: 18 }}>
              Exercise Type
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() =>
                  setLocalForm({ ...localForm, is_compound: true })
                }
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: localForm.is_compound ? "#111" : "#F1F1F1",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: localForm.is_compound ? "#fff" : "#111",
                    fontWeight: "800",
                  }}
                >
                  Compound
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setLocalForm({ ...localForm, is_compound: false })
                }
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: !localForm.is_compound ? "#111" : "#F1F1F1",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: !localForm.is_compound ? "#fff" : "#111",
                    fontWeight: "800",
                  }}
                >
                  Isolation
                </Text>
              </Pressable>
            </View>

            {/* ACTIONS */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  backgroundColor: "#F1F1F1",
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "800" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => onSave(localForm)}
                disabled={saving}
                style={{
                  flex: 1,
                  backgroundColor: "#111",
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

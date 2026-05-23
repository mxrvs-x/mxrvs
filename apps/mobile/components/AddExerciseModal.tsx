import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/lib/theme";

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
  const theme = useTheme();
  const [localForm, setLocalForm] = useState(form);

  useEffect(() => {
    if (visible) setLocalForm(form);
  }, [visible, form]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor:
            theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15,23,42,0.35)",
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
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadow.card,
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
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {localForm.id ? "Edit Exercise" : "Add Exercise"}
              </Text>
            </View>

            {/* NAME */}
            <Text
              style={{
                fontWeight: "700",
                marginTop: 18,
                color: theme.colors.text,
              }}
            >
              Exercise Name
            </Text>

            <TextInput
              value={localForm.name}
              onChangeText={(v) => setLocalForm({ ...localForm, name: v })}
              placeholder="Bench Press"
              placeholderTextColor={theme.colors.textFaint}
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: theme.radius.lg,
                padding: 14,
                marginTop: 8,
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            />

            {/* WORKOUT TYPE */}
            <Text
              style={{
                fontWeight: "700",
                marginTop: 18,
                color: theme.colors.text,
              }}
            >
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
                      borderRadius: theme.radius.pill,
                      backgroundColor: active
                        ? theme.colors[type]
                        : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active
                        ? theme.colors[type]
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
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* MUSCLE GROUP */}
            <Text
              style={{
                fontWeight: "700",
                marginTop: 18,
                color: theme.colors.text,
              }}
            >
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
                      borderRadius: theme.radius.pill,
                      backgroundColor: active
                        ? theme.colors.primary
                        : theme.colors.surfaceAlt,
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
                      {group}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* TYPE */}
            <Text
              style={{
                fontWeight: "700",
                marginTop: 18,
                color: theme.colors.text,
              }}
            >
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
                  borderRadius: theme.radius.lg,
                  backgroundColor: localForm.is_compound
                    ? theme.colors.primary
                    : theme.colors.surfaceAlt,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: localForm.is_compound
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: localForm.is_compound
                      ? theme.colors.textInverse
                      : theme.colors.text,
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
                  borderRadius: theme.radius.lg,
                  backgroundColor: !localForm.is_compound
                    ? theme.colors.primary
                    : theme.colors.surfaceAlt,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: !localForm.is_compound
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: !localForm.is_compound
                      ? theme.colors.textInverse
                      : theme.colors.text,
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
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    color: theme.colors.text,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onSave(localForm)}
                disabled={saving}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  alignItems: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "800",
                  }}
                >
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

import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  movement_type: string | null;
  is_compound: boolean;
};

type CompletedSet = {
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
};

type Props = {
  visible: boolean;
  exercise: Exercise | null;
  startingSetNumber: number;
  isResting: boolean;
  restRemaining: number;
  nextSetNumber: number;
  onClose: () => void;
  onCompleteSet: (set: CompletedSet) => void;
  onSkipRest: () => void;
};

function formatRest(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function ExerciseSessionModal({
  visible,
  exercise,
  startingSetNumber,
  isResting,
  restRemaining,
  nextSetNumber,
  onClose,
  onCompleteSet,
  onSkipRest,
}: Props) {
  const theme = useTheme();

  const [setNumber, setSetNumber] = useState(startingSetNumber);
  const [reps, setReps] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [restSeconds, setRestSeconds] = useState("90");

  useEffect(() => {
    if (!visible) return;

    setSetNumber(startingSetNumber);
    setReps("");
    setWeightKg("");
    setRestSeconds("90");
  }, [visible, startingSetNumber]);

  function completeSet() {
    if (!exercise) return;

    if (!reps || Number(reps) <= 0) {
      alert("Enter valid reps.");
      return;
    }

    if (!weightKg || Number(weightKg) < 0) {
      alert("Enter valid weight.");
      return;
    }

    const rest = Number(restSeconds) || 90;

    onCompleteSet({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      set_number: setNumber,
      reps,
      weight_kg: weightKg,
      rest_seconds: String(rest),
    });

    setReps("");
    setWeightKg("");
  }

  if (!exercise) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor:
            theme.mode === "dark"
              ? "rgba(0,0,0,0.65)"
              : "rgba(15,23,42,0.35)",
          justifyContent: "center",
          alignItems: "center",
          padding: 18,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: 20,
            minHeight: 440,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadow.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {exercise.name}
              </Text>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  marginTop: 4,
                  textTransform: "capitalize",
                }}
              >
                {exercise.muscle_group} •{" "}
                {exercise.is_compound ? "Compound" : "Isolation"}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ fontWeight: "800", color: theme.colors.text }}>
                Close
              </Text>
            </Pressable>
          </View>

          {isResting ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 32,
              }}
            >
              <Text style={{ fontSize: 48 }}>⏱️</Text>

              <Text
                style={{
                  fontSize: 44,
                  fontWeight: "900",
                  marginTop: 12,
                  color: theme.colors.text,
                }}
              >
                {formatRest(restRemaining)}
              </Text>

              <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
                Rest before Set {nextSetNumber}
              </Text>

              <Text
                style={{
                  color: theme.colors.textFaint,
                  marginTop: 8,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                Another set cannot start until the rest timer is done.
              </Text>

              <Pressable
                onPress={onSkipRest}
                style={{
                  marginTop: 24,
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: theme.radius.pill,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "800",
                  }}
                >
                  Skip Rest
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 20,
                  padding: 18,
                  marginTop: 20,
                }}
              >
                <Text style={{ color: theme.colors.textInverse }}>
                  Current Set
                </Text>

                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontSize: 34,
                    fontWeight: "900",
                    marginTop: 6,
                  }}
                >
                  Set {setNumber}
                </Text>

                <Text style={{ color: theme.colors.textInverse, marginTop: 8 }}>
                  Log reps and weight, then start rest.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      marginBottom: 8,
                      color: theme.colors.text,
                    }}
                  >
                    Reps
                  </Text>

                  <TextInput
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                    placeholder="8"
                    placeholderTextColor={theme.colors.textFaint}
                    style={{
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radius.lg,
                      padding: 14,
                      color: theme.colors.text,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      marginBottom: 8,
                      color: theme.colors.text,
                    }}
                  >
                    Weight kg
                  </Text>

                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                    placeholder="80"
                    placeholderTextColor={theme.colors.textFaint}
                    style={{
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radius.lg,
                      padding: 14,
                      color: theme.colors.text,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  />
                </View>
              </View>

              <Text
                style={{
                  fontWeight: "700",
                  marginTop: 18,
                  color: theme.colors.text,
                }}
              >
                Rest Seconds
              </Text>

              <TextInput
                value={restSeconds}
                onChangeText={setRestSeconds}
                keyboardType="numeric"
                placeholder="90"
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

              <Pressable
                onPress={completeSet}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.lg,
                  padding: 18,
                  alignItems: "center",
                  marginTop: 24,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "900",
                  }}
                >
                  Complete Set & Start Rest
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  alignItems: "center",
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={{ fontWeight: "800", color: theme.colors.text }}>
                  End Exercise
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

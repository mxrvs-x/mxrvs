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
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 20,
            minHeight: 440,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 10,
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
              <Text style={{ fontSize: 22, fontWeight: "900" }}>
                {exercise.name}
              </Text>

              <Text
                style={{
                  color: "#666",
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
                backgroundColor: "#F1F1F1",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontWeight: "800" }}>Close</Text>
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
                }}
              >
                {formatRest(restRemaining)}
              </Text>

              <Text style={{ color: "#666", marginTop: 8 }}>
                Rest before Set {nextSetNumber}
              </Text>

              <Text
                style={{
                  color: "#888",
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
                  backgroundColor: "#111",
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  Skip Rest
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={{
                  backgroundColor: "#111",
                  borderRadius: 20,
                  padding: 18,
                  marginTop: 20,
                }}
              >
                <Text style={{ color: "#aaa" }}>Current Set</Text>

                <Text
                  style={{
                    color: "#fff",
                    fontSize: 34,
                    fontWeight: "900",
                    marginTop: 6,
                  }}
                >
                  Set {setNumber}
                </Text>

                <Text style={{ color: "#bbb", marginTop: 8 }}>
                  Log reps and weight, then start rest.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                    Reps
                  </Text>
                  <TextInput
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                    placeholder="8"
                    style={{
                      backgroundColor: "#F7F7F7",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                    Weight kg
                  </Text>
                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                    placeholder="80"
                    style={{
                      backgroundColor: "#F7F7F7",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  />
                </View>
              </View>

              <Text style={{ fontWeight: "700", marginTop: 18 }}>
                Rest Seconds
              </Text>

              <TextInput
                value={restSeconds}
                onChangeText={setRestSeconds}
                keyboardType="numeric"
                placeholder="90"
                style={{
                  backgroundColor: "#F7F7F7",
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 8,
                }}
              />

              <Pressable
                onPress={completeSet}
                style={{
                  backgroundColor: "#111",
                  borderRadius: 18,
                  padding: 18,
                  alignItems: "center",
                  marginTop: 24,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  Complete Set & Start Rest
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: "#F1F1F1",
                  borderRadius: 18,
                  padding: 16,
                  alignItems: "center",
                  marginTop: 10,
                }}
              >
                <Text style={{ fontWeight: "800" }}>End Exercise</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

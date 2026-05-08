import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

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

  const params = useLocalSearchParams<{
    id: string;
    split?: WorkoutType;
  }>();

  const { id } = params;

  const currentSplit: WorkoutType = isWorkoutType(params.split)
    ? params.split
    : "push";

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<DisplaySet[]>([]);

  const totalVolume = sets.reduce((sum, set) => {
    return sum + (Number(set.reps) || 0) * (Number(set.weight_kg) || 0);
  }, 0);

  function handleClosePress() {
    router.back();
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

    const mappedSets = workoutSets.map((set) => {
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
      theme.setSessionTheme(currentSplit);
      loadWorkoutDetails();

      return () => {
        theme.setSessionTheme("default");
      };
    }, [id, currentSplit]),
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
        }}
      />

      <FlatList
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        data={sets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                marginTop: 24,
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

                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                  {formatDate(workout.workout_date)}
                </Text>
              </View>
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

              <Text style={{ color: theme.colors.textInverse, marginTop: 8 }}>
                {sets.length} sets • {workout.duration_minutes || 0} min
              </Text>
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

                <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
                  {workout.notes}
                </Text>
              </View>
            ) : null}

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
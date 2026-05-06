import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<DisplaySet[]>([]);

  const totalVolume = sets.reduce((sum, set) => {
    return sum + (Number(set.reps) || 0) * (Number(set.weight_kg) || 0);
  }, 0);

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

    setWorkout(workoutData as Workout);
    setSets(mappedSets);
    setLoading(false);
  }

  useEffect(() => {
    loadWorkoutDetails();
  }, [id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F7F7F7",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!workout) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F7F7F7",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900" }}>
          Workout not found
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 18,
            backgroundColor: "#111",
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: "#F7F7F7" }}
      data={sets}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      ListHeaderComponent={
        <View>
          <View
            style={{
              marginTop: 48,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: "900" }}>
                {formatWorkoutType(workout.workout_type)}
              </Text>

              <Text style={{ color: "#666", marginTop: 4 }}>
                {formatDate(workout.workout_date)}
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
              <Text style={{ fontWeight: "900" }}>Back</Text>
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
            <Text style={{ color: "#aaa" }}>Session Summary</Text>

            <Text
              style={{
                color: "#fff",
                fontSize: 34,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {(totalVolume || 0).toLocaleString()} kg
            </Text>

            <Text style={{ color: "#bbb", marginTop: 8 }}>
              {sets.length} sets • {workout.duration_minutes || 0} min
            </Text>
          </View>

          {workout.notes ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 16,
                marginTop: 14,
                borderWidth: 1,
                borderColor: "#eee",
              }}
            >
              <Text style={{ fontWeight: "900" }}>Notes</Text>
              <Text style={{ color: "#555", marginTop: 6 }}>
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
            }}
          >
            Sets
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#777" }}>No sets found.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#eee",
            marginBottom: 10,
          }}
        >
          <Text style={{ fontWeight: "900", fontSize: 16 }}>
            {item.exercise_name}
          </Text>

          <Text
            style={{
              color: "#666",
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
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: "#f4f4f4",
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: "#777" }}>{label}</Text>
      <Text style={{ fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

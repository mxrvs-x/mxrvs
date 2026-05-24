import { Stack } from "expo-router";

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Workout",
        }}
      />

      <Stack.Screen
        name="setup"
        options={{
          title: "PPL / UL Setup",
          headerShown: false,
        }}
      />
      <Stack.Screen name="start" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

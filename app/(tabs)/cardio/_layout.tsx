import { Stack } from "expo-router";

export default function CardioLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Cardio",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="walk"
        options={{
          title: "Walk",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="run"
        options={{
          title: "Run",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="history"
        options={{
          title: "All Activities",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="[id]"
        options={{
          title: "Activity Details",
          headerShown: false,
        }}
      />
    </Stack>
  );
}

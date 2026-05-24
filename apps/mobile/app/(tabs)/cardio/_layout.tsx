import { useTheme } from "@/lib/theme";
import { Stack } from "expo-router";

export default function CardioLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Cardio",
        }}
      />

      <Stack.Screen
        name="walk"
        options={{
          title: "Walk",
        }}
      />

      <Stack.Screen
        name="run"
        options={{
          title: "Run",
        }}
      />

      <Stack.Screen
        name="history"
        options={{
          title: "All Activities",
        }}
      />

      <Stack.Screen
        name="reports"
        options={{
          title: "Cardio Reports",
        }}
      />

      <Stack.Screen
        name="[id]"
        options={{
          title: "Activity Details",
          headerShown: true,
        }}
      />
    </Stack>
  );
}

import { useTheme } from "@/lib/theme";
import { Stack } from "expo-router";

export default function DiaryLayout() {
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
          title: "Diary",
        }}
      />

      <Stack.Screen
        name="add-food"
        options={{
          title: "Add Food",
        }}
      />

      <Stack.Screen
        name="search-food-detail"
        options={{
          title: "Food Details",
        }}
      />

      <Stack.Screen
        name="edit-log"
        options={{
          title: "Edit Food Log",
        }}
      />
    </Stack>
  );
}

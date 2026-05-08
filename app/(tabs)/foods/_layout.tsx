import { useTheme } from "@/lib/theme";
import { Stack } from "expo-router";

export default function FoodsLayout() {
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
      <Stack.Screen name="index" options={{ title: "Foods" }} />

      <Stack.Screen
        name="create-custom-foods"
        options={{ title: "Create Food" }}
      />

      <Stack.Screen
        name="custom-detail/[id]"
        options={{ title: "Food Details" }}
      />

      <Stack.Screen
        name="usda-detail/[fdcId]"
        options={{ title: "Nutrition Details" }}
      />
    </Stack>
  );
}
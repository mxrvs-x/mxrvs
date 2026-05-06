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

      {/* Custom Foods */}
      <Stack.Screen name="custom" options={{ title: "Custom Foods" }} />
      <Stack.Screen
        name="create-custom-foods"
        options={{ title: "Create Food" }}
      />
      <Stack.Screen
        name="custom-detail/[id]"
        options={{ title: "Food Details" }}
      />

      {/* USDA */}
      <Stack.Screen name="usda" options={{ title: "USDA Foods" }} />
      <Stack.Screen
        name="usda-detail/[fdcId]"
        options={{ title: "Nutrition Details" }}
      />

      {/* AU Food Standards */}
      <Stack.Screen name="au" options={{ title: "AU Foods" }} />
      <Stack.Screen
        name="au-detail/[pfk]"
        options={{ title: "Nutrition Details" }}
      />
    </Stack>
  );
}

import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function FoodsTab() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={{ color: theme.colors.textMuted }}>
        Create and manage your food database.
      </Text>

      {/* Custom Foods */}
      <Pressable
        onPress={() => router.push("/foods/custom" as any)}
        style={{
          marginTop: 24,
          padding: 18,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.colors.text,
          }}
        >
          Custom Foods
        </Text>

        <Text style={{ marginTop: 6, color: theme.colors.textMuted }}>
          View and manage your custom foods. Add, edit, and reuse them daily.
        </Text>
      </Pressable>

      {/* USDA */}
      <Pressable
        onPress={() => router.push("/foods/usda" as any)}
        style={{
          marginTop: 16,
          padding: 18,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.colors.text,
          }}
        >
          USDA Foods
        </Text>

        <Text style={{ marginTop: 6, color: theme.colors.textMuted }}>
          Search FoodData Central and save foods to your database.
        </Text>
      </Pressable>

      {/* AU Food Standards */}
      <Pressable
        onPress={() => router.push("/foods/au" as any)}
        style={{
          marginTop: 16,
          padding: 18,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.colors.text,
          }}
        >
          AU Food Standards
        </Text>

        <Text style={{ marginTop: 6, color: theme.colors.textMuted }}>
          Browse Australian Food Composition Database (AFCD) foods.
        </Text>
      </Pressable>
    </View>
  );
}

import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

type CustomFood = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
};

export default function CustomFoodsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function loadFoods() {
    try {
      setLoading(true);
      setStatus("Loading your custom foods...");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("You need to be logged in.");
        return;
      }

      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("user_id", user.id)
        .eq("source", "custom")
        .order("created_at", { ascending: false });

      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }

      setFoods(data || []);
      setStatus(`Found ${data?.length ?? 0} custom foods`);
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      setStatus(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFoods();
  }, []);

  const filteredFoods = useMemo(() => {
    const cleanedSearch = search.trim().toLowerCase();

    if (!cleanedSearch) return foods;

    return foods.filter((food) =>
      food.name.toLowerCase().includes(cleanedSearch),
    );
  }, [foods, search]);

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "900",
          marginBottom: 16,
          color: theme.colors.text,
        }}
      >
        Custom Foods
      </Text>

      <TextInput
        placeholder="Search your foods..."
        placeholderTextColor={theme.colors.textFaint}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 14,
          padding: 14,
          backgroundColor: theme.colors.surface,
          fontSize: 16,
          color: theme.colors.text,
        }}
      />

      <Pressable
        onPress={() => router.push("/foods/create-custom-foods" as any)}
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 14,
          backgroundColor: theme.colors.primary,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.colors.textInverse,
            fontWeight: "900",
            fontSize: 15,
          }}
        >
          + Add Custom Food
        </Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: 16 }}
        />
      ) : status ? (
        <Text style={{ marginTop: 12, color: theme.colors.textMuted }}>
          {status}
        </Text>
      ) : null}

      <FlatList
        data={filteredFoods}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 32,
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: theme.colors.textFaint, marginTop: 20 }}>
              No custom foods found.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/foods/custom-detail/${item.id}` as any)
            }
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: 12,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text
              style={{
                fontWeight: "900",
                fontSize: 16,
                color: theme.colors.text,
              }}
            >
              {item.name}
            </Text>

            <Text style={{ marginTop: 6, color: theme.colors.textMuted }}>
              {Math.round(item.calories)} kcal • {Math.round(item.protein_g)}P •{" "}
              {Math.round(item.carbs_g)}C • {Math.round(item.fat_g)}F
            </Text>

            <Text
              style={{
                marginTop: 6,
                color: theme.colors.textFaint,
                fontSize: 12,
              }}
            >
              Per {item.serving_size} {item.serving_unit}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

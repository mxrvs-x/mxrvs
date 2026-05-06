import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
};

export default function UsdaFoodsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<UsdaFood[]>([]);
  const [loading, setLoading] = useState(false);

  async function searchFoods() {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(
          query,
        )}&pageSize=25`,
      );

      const json = await res.json();

      setFoods(json.foods || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        backgroundColor: theme.colors.background,
      }}
    >
      {/* SEARCH */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search USDA foods..."
        placeholderTextColor={theme.colors.textFaint}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 12,
          padding: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        }}
      />

      <Pressable
        onPress={searchFoods}
        style={{
          marginTop: 10,
          backgroundColor: theme.colors.primary,
          padding: 12,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.colors.textInverse,
            fontWeight: "800",
          }}
        >
          Search
        </Text>
      </Pressable>

      {/* LOADING */}
      {loading && (
        <ActivityIndicator
          style={{ marginTop: 20 }}
          color={theme.colors.primary}
        />
      )}

      {/* RESULTS */}
      <FlatList
        data={foods}
        keyExtractor={(item) => String(item.fdcId)}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/foods/usda-detail/${item.fdcId}` as any)
            }
            style={{
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                color: theme.colors.text,
              }}
            >
              {item.description}
            </Text>

            {(item.brandOwner || item.brandName) && (
              <Text
                style={{
                  marginTop: 4,
                  color: theme.colors.textMuted,
                }}
              >
                {item.brandOwner || item.brandName}
              </Text>
            )}

            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                color: theme.colors.textFaint,
              }}
            >
              {item.dataType}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text
              style={{
                textAlign: "center",
                marginTop: 30,
                color: theme.colors.textFaint,
              }}
            >
              No results
            </Text>
          ) : null
        }
      />
    </View>
  );
}

import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

type AuFood = {
  pfk: string;
  name: string;
  classification_id: number;
  derivation?: string | null;
  food_group?: string | null;
  food_group_id?: number | null;
  sub_food_group?: string | null;
  sub_food_group_id?: number | null;
  inclusions?: string | null;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const BASE_URL =
  "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/search/api/foods";

const DEFAULT_AU_SEARCHES = [
  "chicken",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tuna",
  "egg",
  "milk",
  "cheese",
  "yoghurt",
  "rice",
  "bread",
  "pasta",
  "noodle",
  "potato",
  "sweet potato",
  "oats",
  "banana",
  "apple",
  "orange",
  "mango",
  "broccoli",
  "carrot",
  "spinach",
  "tomato",
  "lettuce",
  "butter",
  "olive oil",
  "peanut butter",
  "almond",
  "fried chicken",
  "burger",
  "pizza",
  "sandwich",
  "coffee",
  "tea",
  "chocolate",
];

export default function AuFoodsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [query, setQuery] = useState("");
  const [allFoods, setAllFoods] = useState<AuFood[]>([]);
  const [foods, setFoods] = useState<AuFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const hasLoadedDefault = useRef(false);

  async function fetchAllAuFoods() {
    const results = await Promise.all(
      LETTERS.map(async (letter) => {
        const response = await fetch(`${BASE_URL}/alphabetical/${letter}`);
        const json = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(json));
        }

        return json ?? [];
      }),
    );

    return results.flat() as AuFood[];
  }

  function filterAuFoods(sourceFoods: AuFood[], searchText: string) {
    const cleanedSearch = searchText.trim().toLowerCase();

    return sourceFoods.filter((food) => {
      const name = food.name?.toLowerCase() ?? "";
      const group = food.food_group?.toLowerCase() ?? "";
      const subGroup = food.sub_food_group?.toLowerCase() ?? "";
      const derivation = food.derivation?.toLowerCase() ?? "";

      return (
        name.includes(cleanedSearch) ||
        group.includes(cleanedSearch) ||
        subGroup.includes(cleanedSearch) ||
        derivation.includes(cleanedSearch)
      );
    });
  }

  async function searchAuFoods(searchText: string, isDefaultLoad = false) {
    const cleanedQuery = searchText.trim();

    if (!cleanedQuery) {
      setFoods([]);
      setStatus("");
      return;
    }

    try {
      setLoading(true);

      if (isDefaultLoad) {
        setStatus("Loading random Australian foods...");
      } else {
        setStatus("Searching Australian foods...");
      }

      let sourceFoods = allFoods;

      if (sourceFoods.length === 0) {
        sourceFoods = await fetchAllAuFoods();
        setAllFoods(sourceFoods);
      }

      const filtered = filterAuFoods(sourceFoods, cleanedQuery);

      setFoods(filtered.slice(0, 50));

      if (isDefaultLoad) {
        setStatus(`Showing random foods for "${cleanedQuery}"`);
      } else {
        setStatus(`Found ${filtered.length} foods`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      setStatus(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasLoadedDefault.current) return;

    hasLoadedDefault.current = true;

    const randomQuery =
      DEFAULT_AU_SEARCHES[
        Math.floor(Math.random() * DEFAULT_AU_SEARCHES.length)
      ];

    searchAuFoods(randomQuery, true);
  }, []);

  useEffect(() => {
    const cleanedQuery = query.trim();

    if (!cleanedQuery) return;

    const timeout = setTimeout(() => {
      searchAuFoods(cleanedQuery);
    }, 500);

    return () => clearTimeout(timeout);
  }, [query]);

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
        Australian Foods
      </Text>

      <TextInput
        placeholder="Search AU food, e.g. bacon, chicken, rice"
        placeholderTextColor={theme.colors.textFaint}
        value={query}
        onChangeText={setQuery}
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
        data={foods}
        keyExtractor={(item) => item.pfk}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 32,
        }}
        ListEmptyComponent={
          query.trim() && !loading ? (
            <Text style={{ color: theme.colors.textFaint, marginTop: 20 }}>
              No foods found.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/foods/au-detail/[pfk]" as any,
                params: {
                  pfk: item.pfk,
                },
              })
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
              {item.derivation ?? "Food Standards Australia"}
              {item.food_group ? ` • ${item.food_group}` : ""}
            </Text>

            {item.sub_food_group ? (
              <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
                {item.sub_food_group}
              </Text>
            ) : null}

            <Text
              style={{
                marginTop: 6,
                color: theme.colors.textFaint,
                fontSize: 12,
              }}
            >
              PFK: {item.pfk}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

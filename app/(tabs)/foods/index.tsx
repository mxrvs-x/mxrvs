import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useRouter } from "expo-router";
import { CircleX, Plus, Search } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";

type SavedFood = {
  id: string;
  name: string;
  brand: string | null;
  source: "custom" | "usda_fdc";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_name?: string | null;
  serving_size: number;
  serving_unit: string;
  created_at: string;
};

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
};

type FoodResult =
  | {
      type: "saved";
      food: SavedFood;
    }
  | {
      type: "usda";
      food: UsdaFood;
    };

function sourceLabel(source: string) {
  if (source === "usda_fdc") return "USDA";
  return "CUSTOM";
}

export default function FoodsTab() {
  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  async function loadCustomFoods() {
    try {
      setLoading(true);
      setStatus("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("You need to be logged in.");
        setResults([]);
        return;
      }

      const { data, error } = await supabase
        .from("foods")
        .select(
          `
          id,
          name,
          brand,
          source,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          serving_name,
          serving_size,
          serving_unit,
          created_at
        `,
        )
        .eq("user_id", user.id)
        .eq("source", "custom")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setResults(
        (data ?? []).map((food) => ({
          type: "saved",
          food: food as SavedFood,
        })),
      );

      setStatus("");
    } catch (error: any) {
      setStatus(error.message ?? "Failed to load custom foods.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function searchFoods(queryValue: string) {
    const query = queryValue.trim();
    const requestId = ++searchRequestRef.current;

    if (!query) {
      await loadCustomFoods();
      return;
    }

    try {
      setLoading(true);
      setStatus("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (requestId === searchRequestRef.current) {
          setStatus("You need to be logged in.");
          setResults([]);
        }
        return;
      }

      const savedFoodsPromise = supabase
        .from("foods")
        .select(
          `
          id,
          name,
          brand,
          source,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          serving_name,
          serving_size,
          serving_unit,
          created_at
        `,
        )
        .eq("user_id", user.id)
        .in("source", ["custom", "usda_fdc"])
        .ilike("name", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

      const usdaPromise = apiKey
        ? fetch(
            `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(
              query,
            )}&pageSize=25`,
          ).then((res) => res.json())
        : Promise.resolve(null);

      const [savedResponse, usdaResponse] = await Promise.all([
        savedFoodsPromise,
        usdaPromise,
      ]);

      if (requestId !== searchRequestRef.current) return;

      if (savedResponse.error) throw savedResponse.error;

      const savedResults: FoodResult[] = (savedResponse.data ?? []).map(
        (food) => ({
          type: "saved",
          food: food as SavedFood,
        }),
      );

      const usdaResults: FoodResult[] = (usdaResponse?.foods ?? []).map(
        (food: UsdaFood) => ({
          type: "usda",
          food,
        }),
      );

      setResults([...savedResults, ...usdaResults]);

      if (!apiKey) {
        setStatus("Missing EXPO_PUBLIC_USDA_API_KEY in .env");
      } else {
        setStatus("");
      }
    } catch (error: any) {
      if (requestId === searchRequestRef.current) {
        setStatus(error.message ?? "Failed to search foods.");
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  function handleSearch(text: string) {
    setSearch(text);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchFoods(text);
    }, 450);
  }

  async function handleClearSearch() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    searchRequestRef.current += 1;

    setSearch("");
    setStatus("");
    setResults([]);
    setRefreshing(false);

    await loadCustomFoods();
  }

  async function onRefresh() {
    setRefreshing(true);

    if (search.trim()) {
      await searchFoods(search);
    } else {
      await loadCustomFoods();
    }
  }

  useEffect(() => {
    loadCustomFoods();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      searchRequestRef.current += 1;
    };
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "",
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerLeft: () => (
            <View
              style={{
                width: screenWidth - 18,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 24,
                  backgroundColor: theme.colors.background,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              >
                <Search size={22} color={theme.colors.textMuted} />

                <TextInput
                  value={search}
                  onChangeText={handleSearch}
                  onSubmitEditing={() => searchFoods(search)}
                  placeholder="Search foods..."
                  placeholderTextColor={theme.colors.textFaint}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: theme.colors.text,
                    paddingVertical: 0,
                  }}
                />

                {search.trim().length > 0 && (
                  <Pressable
                    onPress={handleClearSearch}
                    hitSlop={10}
                    style={{
                      width: 26,
                      height: 26,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CircleX size={20} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => router.push("/foods/create-custom-foods" as any)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={24} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ),
          headerRight: () => null,
        }}
      />

      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingHorizontal: 20,
        }}
      >
        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginVertical: 14 }}
          />
        ) : null}

        {!!status && !loading && (
          <Text
            style={{
              paddingVertical: 12,
              color: theme.colors.textMuted,
            }}
          >
            {status}
          </Text>
        )}

        <FlatList
          data={results}
          keyExtractor={(item, index) =>
            item.type === "saved"
              ? `saved-${item.food.id}`
              : `usda-${item.food.fdcId}-${index}`
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <Text
                style={{
                  color: theme.colors.textFaint,
                  marginTop: 20,
                }}
              >
                No foods found.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === "saved") {
              return (
                <Pressable
                  onPress={() =>
                    router.push(`/foods/custom-detail/${item.food.id}` as any)
                  }
                  style={{
                    minHeight: 64,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontWeight: "900",
                        fontSize: 16,
                        color: theme.colors.text,
                      }}
                    >
                      {item.food.name}
                    </Text>

                    {!!item.food.brand && (
                      <Text
                        numberOfLines={1}
                        style={{
                          marginTop: 3,
                          color: theme.colors.textMuted,
                          fontSize: 13,
                        }}
                      >
                        {item.food.brand}
                      </Text>
                    )}

                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 3,
                        color: theme.colors.textFaint,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {sourceLabel(item.food.source)} •{" "}
                      {item.food.serving_name
                        ? `${item.food.serving_name} • `
                        : ""}
                      Per {item.food.serving_size} {item.food.serving_unit}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: theme.colors.text,
                      fontWeight: "900",
                      fontSize: 15,
                    }}
                  >
                    {Math.round(item.food.calories)} kcal
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                onPress={() =>
                  router.push(`/foods/usda-detail/${item.food.fdcId}` as any)
                }
                style={{
                  minHeight: 64,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontWeight: "900",
                      fontSize: 16,
                      color: theme.colors.text,
                    }}
                  >
                    {item.food.description}
                  </Text>

                  {!!(item.food.brandOwner || item.food.brandName) && (
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 3,
                        color: theme.colors.textMuted,
                        fontSize: 13,
                      }}
                    >
                      {item.food.brandOwner || item.food.brandName}
                    </Text>
                  )}

                  <Text
                    style={{
                      marginTop: 3,
                      color: theme.colors.textFaint,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    USDA • {item.food.dataType ?? "FoodData Central"}
                  </Text>
                </View>

                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  USDA
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </>
  );
}
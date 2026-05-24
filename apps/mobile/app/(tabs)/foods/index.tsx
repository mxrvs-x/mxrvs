import { supabase } from "@/lib/supabase";
import {
  compactFatSecretFoodPayload,
  getFatSecretCredentialIssue,
  getFatSecretDefaultServing,
  hasFatSecretCredentials,
  searchFatSecretFoodsWithDetails,
  type FatSecretFood,
  type FatSecretSearchFood,
} from "@/lib/fatsecret";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  type TextInput as TextInputType,
} from "react-native";

type SavedFood = {
  id: string;
  name: string;
  brand: string | null;
  source: "custom" | "fatsecret";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_name?: string | null;
  serving_size: number;
  serving_unit: string;
  created_at: string;
};

type FoodResult =
  | {
      type: "saved";
      food: SavedFood;
    }
  | {
      type: "fatsecret";
      food: FatSecretFood | FatSecretSearchFood;
    };

function sourceLabel(source: string) {
  if (source === "fatsecret") return "FatSecret";
  return "CUSTOM";
}

function fatSecretCalories(food: FatSecretFood | FatSecretSearchFood) {
  const serving = getFatSecretDefaultServing(food);
  const calories = Number(serving?.calories ?? 0);

  if (Number.isFinite(calories) && calories > 0) {
    return `${Math.round(calories)} kcal`;
  }

  const descriptionCalories = food.food_description?.match(
    /Calories:\s*([0-9.]+)/i,
  )?.[1];

  return descriptionCalories
    ? `${Math.round(Number(descriptionCalories))} kcal`
    : "FatSecret";
}

export default function FoodsTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [search, setSearch] = useState("");
  const [hasSearchText, setHasSearchText] = useState(false);
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const searchInputRef = useRef<TextInputType>(null);
  const searchTextRef = useRef("");

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
        .eq("source", "custom")
        .ilike("name", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      let fatSecretError: string | null = null;

      const fatSecretPromise = hasFatSecretCredentials()
        ? Promise.all([
            searchFatSecretFoodsWithDetails(query),
            Promise.resolve([] as FatSecretFood[]),
          ])
            .then(([searchResults, barcodeResults]) => {
              const seen = new Set<string>();

              return [...barcodeResults, ...searchResults].filter((food) => {
                if (!food.food_id || seen.has(food.food_id)) return false;

                seen.add(food.food_id);
                return true;
              });
            })
            .catch((error) => {
              fatSecretError =
                error instanceof Error
                  ? error.message
                  : JSON.stringify(error);
              console.log("FatSecret search error:", error);
              return [];
            })
        : Promise.resolve([]);

      const [savedResponse, fatSecretResponse] = await Promise.all([
        savedFoodsPromise,
        fatSecretPromise,
      ]);

      if (requestId !== searchRequestRef.current) return;

      if (savedResponse.error) throw savedResponse.error;

      const savedResults: FoodResult[] = (savedResponse.data ?? []).map(
        (food) => ({
          type: "saved",
          food: food as SavedFood,
        }),
      );

      const fatSecretResults: FoodResult[] = fatSecretResponse.map((food) => ({
        type: "fatsecret",
        food,
      }));

      setResults([...savedResults, ...fatSecretResults]);

      const fatSecretCredentialIssue = getFatSecretCredentialIssue();

      if (fatSecretCredentialIssue) {
        setStatus(`${fatSecretCredentialIssue}; showing custom foods only.`);
      } else if (fatSecretError) {
        setStatus(
          `FatSecret search unavailable: ${fatSecretError}. Showing custom foods only.`,
        );
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
    searchTextRef.current = text;
    setHasSearchText(text.trim().length > 0);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearch(text);
      searchFoods(text);
    }, 450);
  }

  async function handleClearSearch() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    searchRequestRef.current += 1;
    searchTextRef.current = "";
    searchInputRef.current?.clear();

    setSearch("");
    setHasSearchText(false);
    setStatus("");
    setResults([]);
    setRefreshing(false);

    await loadCustomFoods();
  }

  async function onRefresh() {
    setRefreshing(true);

    const currentSearch = searchTextRef.current.trim() || search.trim();

    if (currentSearch) {
      await searchFoods(currentSearch);
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

  useEffect(() => {
    if (!params.refresh) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    searchRequestRef.current += 1;
    searchTextRef.current = "";
    searchInputRef.current?.clear();
    setSearch("");
    setHasSearchText(false);
    setStatus("");
    setRefreshing(false);
    loadCustomFoods();
  }, [params.refresh]);

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
                  ref={searchInputRef}
                  defaultValue={searchTextRef.current}
                  onChangeText={handleSearch}
                  onSubmitEditing={() => {
                    const currentSearch = searchTextRef.current;

                    if (debounceRef.current) {
                      clearTimeout(debounceRef.current);
                    }

                    setSearch(currentSearch);
                    searchFoods(currentSearch);
                  }}
                  placeholder="Search foods..."
                  placeholderTextColor={theme.colors.textFaint}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  spellCheck={false}
                  textContentType="none"
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: theme.colors.text,
                    paddingVertical: 0,
                  }}
                />

                {hasSearchText && (
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
              : `fatsecret-${item.food.food_id}-${index}`
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          
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

            if (item.type === "fatsecret") {
              const serving = getFatSecretDefaultServing(item.food);

              return (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/foods/fatsecret-detail/[foodId]" as any,
                      params: {
                        foodId: String(item.food.food_id),
                        payload: encodeURIComponent(
                          JSON.stringify(compactFatSecretFoodPayload(item.food)),
                        ),
                      },
                    })
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
                      {item.food.food_name}
                    </Text>

                    {!!item.food.brand_name && (
                      <Text
                        numberOfLines={1}
                        style={{
                          marginTop: 3,
                          color: theme.colors.textMuted,
                          fontSize: 13,
                        }}
                      >
                        {item.food.brand_name}
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
                      FatSecret
                      {serving?.serving_description
                        ? ` • ${serving.serving_description}`
                        : ""}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: theme.colors.text,
                      fontWeight: "900",
                      fontSize: 15,
                    }}
                  >
                    {fatSecretCalories(item.food)}
                  </Text>
                </Pressable>
              );
            }
            return null;
          }}
        />
      </View>
    </>
  );
}

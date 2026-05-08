import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type SortOption = "recent" | "az" | "za";
type DatabaseFilter = "all" | "custom" | "usda";
type FoodSource = "custom" | "usda_fdc";

type LocalFoodResult = {
  resultType: "local";
  id: string;
  user_id?: string | null;
  source: FoodSource;
  external_id?: string | null;
  name: string;
  brand?: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  created_at?: string | null;
  last_logged_at?: string | null;
};

type UsdaFoodResult = {
  resultType: "usda";
  fdcId: number;
  name: string;
  brand?: string | null;
  dataType: string;
  foodCategory?: string | null;
};

type FoodResult = LocalFoodResult | UsdaFoodResult;

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
};

const USDA_RANDOM_QUERIES = [
  "chicken",
  "rice",
  "egg",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tuna",
  "milk",
  "cheese",
  "yogurt",
  "banana",
  "apple",
  "orange",
  "bread",
  "potato",
  "sweet potato",
  "oats",
  "pasta",
  "beans",
  "corn",
  "broccoli",
  "spinach",
  "carrot",
  "peanut butter",
];

function n(value: any) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  return "Custom Food";
}

function sortLabel(sort: SortOption) {
  if (sort === "recent") return "Most Recent";
  if (sort === "az") return "A to Z";
  return "Z to A";
}

function nextSort(sort: SortOption): SortOption {
  if (sort === "recent") return "az";
  if (sort === "az") return "za";
  return "recent";
}

function mapDbFood(food: any, lastLoggedAt?: string | null): LocalFoodResult {
  return {
    resultType: "local",
    id: food.id,
    user_id: food.user_id ?? null,
    source: food.source,
    external_id: food.external_id ?? null,
    name: food.name,
    brand: food.brand ?? null,
    serving_size: n(food.serving_size) || 100,
    serving_unit: food.serving_unit ?? "g",
    calories: n(food.calories),
    protein_g: n(food.protein_g),
    carbs_g: n(food.carbs_g),
    fat_g: n(food.fat_g),
    fiber_g: n(food.fiber_g),
    sugar_g: n(food.sugar_g),
    sodium_mg: n(food.sodium_mg),
    cholesterol_mg: n(food.cholesterol_mg),
    created_at: food.created_at ?? null,
    last_logged_at: lastLoggedAt ?? null,
  };
}

function mapLogSnapshot(log: any): LocalFoodResult {
  return {
    resultType: "local",
    id: `log-${log.id}`,
    user_id: log.user_id ?? null,
    source: log.food_source ?? "custom",
    external_id: log.external_id ?? null,
    name: log.food_name ?? "Unknown food",
    brand: log.food_brand ?? null,
    serving_size: n(log.serving_size) || 100,
    serving_unit: log.serving_unit ?? "g",
    calories: n(log.calories),
    protein_g: n(log.protein_g),
    carbs_g: n(log.carbs_g),
    fat_g: n(log.fat_g),
    fiber_g: n(log.fiber_g),
    sugar_g: n(log.sugar_g),
    sodium_mg: n(log.sodium_mg),
    cholesterol_mg: n(log.cholesterol_mg),
    created_at: log.created_at ?? null,
    last_logged_at: log.created_at ?? null,
  };
}

function mapUsdaFood(food: UsdaFood): UsdaFoodResult {
  return {
    resultType: "usda",
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    dataType: food.dataType,
    foodCategory: food.foodCategory ?? null,
  };
}

function filterToSource(value: DatabaseFilter): FoodSource | null {
  if (value === "custom") return "custom";
  if (value === "usda") return "usda_fdc";
  return null;
}

export default function AddFoodScreen() {
  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const { mealType, date } = useLocalSearchParams<{
    mealType: string;
    date: string;
  }>();

  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"recent" | "search">("recent");

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [databaseFilter, setDatabaseFilter] = useState<DatabaseFilter>("all");
  const [multiAddEnabled, setMultiAddEnabled] = useState(false);
  const [categoryTabsEnabled, setCategoryTabsEnabled] = useState(true);

  const searchRequestRef = useRef(0);

  const filteredAndSortedFoods = useMemo(() => {
    const items = [...foods];

    items.sort((a, b) => {
      if (sortBy === "az") return a.name.localeCompare(b.name);
      if (sortBy === "za") return b.name.localeCompare(a.name);

      const aDate =
        a.resultType === "local" && a.last_logged_at
          ? new Date(a.last_logged_at).getTime()
          : 0;

      const bDate =
        b.resultType === "local" && b.last_logged_at
          ? new Date(b.last_logged_at).getTime()
          : 0;

      return bDate - aDate;
    });

    return items;
  }, [foods, sortBy]);

  async function fetchLatestLoggedFoods() {
    const { data, error } = await supabase
      .from("food_logs")
      .select(
        `
        id,
        user_id,
        food_id,
        food_name,
        food_brand,
        food_source,
        external_id,
        serving_size,
        serving_unit,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sugar_g,
        sodium_mg,
        cholesterol_mg,
        created_at,
        foods (
          id,
          user_id,
          source,
          external_id,
          name,
          brand,
          serving_size,
          serving_unit,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          sugar_g,
          sodium_mg,
          cholesterol_mg,
          created_at
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.log("Latest logged foods error:", error);
      return [];
    }

    const seen = new Set<string>();
    const latestFoods: FoodResult[] = [];

    for (const log of data ?? []) {
      const food = Array.isArray(log.foods) ? log.foods[0] : log.foods;

      if (food?.id) {
        if (seen.has(food.id)) continue;
        seen.add(food.id);
        latestFoods.push(mapDbFood(food, log.created_at));
        continue;
      }

      const snapshotKey = `${log.food_source}-${log.external_id ?? log.food_name}`;

      if (!log.food_name || seen.has(snapshotKey)) continue;

      seen.add(snapshotKey);
      latestFoods.push(mapLogSnapshot(log));
    }

    return latestFoods;
  }

  async function searchLocalFoods(searchText: string) {
    if (databaseFilter === "usda") return [];

    const source = filterToSource(databaseFilter);

    const { data, error } = await supabase.rpc("search_foods", {
      search_query: searchText.trim(),
      food_source: source,
      result_limit: 50,
      result_offset: 0,
    });

    if (error) {
      console.log("Local foods search error:", error);
      return [];
    }

    return (data ?? []).map(mapDbFood) as FoodResult[];
  }

  async function searchUsdaFoods(searchText: string) {
    if (databaseFilter === "custom") return [];
    if (searchText.trim().length < 2) return [];

    const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

    if (!apiKey) {
      console.log("Missing EXPO_PUBLIC_USDA_API_KEY");
      return [];
    }

    const url =
      "https://api.nal.usda.gov/fdc/v1/foods/search" +
      `?api_key=${apiKey}` +
      `&query=${encodeURIComponent(searchText.trim())}` +
      `&pageSize=50` +
      `&pageNumber=1`;

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      console.log("USDA error:", json);
      return [];
    }

    return ((json.foods ?? []) as UsdaFood[]).map(mapUsdaFood);
  }

  async function fetchRandomUsdaFoods() {
    const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

    if (!apiKey) {
      console.log("Missing EXPO_PUBLIC_USDA_API_KEY");
      return [];
    }

    const randomQuery =
      USDA_RANDOM_QUERIES[
        Math.floor(Math.random() * USDA_RANDOM_QUERIES.length)
      ];

    const randomPage = Math.floor(Math.random() * 8) + 1;

    const url =
      "https://api.nal.usda.gov/fdc/v1/foods/search" +
      `?api_key=${apiKey}` +
      `&query=${encodeURIComponent(randomQuery)}` +
      `&pageSize=50` +
      `&pageNumber=${randomPage}`;

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      console.log("Random USDA error:", json);
      return [];
    }

    return ((json.foods ?? []) as UsdaFood[]).map(mapUsdaFood);
  }

  const searchFoodsAjax = useCallback(
    async (searchText: string) => {
      const value = searchText.trim();
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      try {
        setLoading(true);

        const shouldShowLatestLoggedFoods =
          databaseFilter === "all" && value.length < 2;

        const shouldShowRandomUsdaFoods =
          databaseFilter === "usda" && value.length < 2;

        setMode(shouldShowLatestLoggedFoods ? "recent" : "search");

        setStatus(
          shouldShowLatestLoggedFoods
            ? "Loading latest logged foods..."
            : shouldShowRandomUsdaFoods
              ? "Loading 50 random USDA foods..."
              : value.length >= 2
                ? "Searching foods..."
                : "Loading foods...",
        );

        if (shouldShowLatestLoggedFoods) {
          const latestLoggedFoods = await fetchLatestLoggedFoods();

          if (requestId !== searchRequestRef.current) return;

          setFoods(latestLoggedFoods);
          setStatus(`Found ${latestLoggedFoods.length} latest logged foods`);
          return;
        }

        if (shouldShowRandomUsdaFoods) {
          const randomUsdaFoods = await fetchRandomUsdaFoods();

          if (requestId !== searchRequestRef.current) return;

          setFoods(randomUsdaFoods);
          setStatus(`Found ${randomUsdaFoods.length} random USDA foods`);
          return;
        }

        const [localResults, usdaResults] = await Promise.all([
          searchLocalFoods(value),
          searchUsdaFoods(value),
        ]);

        if (requestId !== searchRequestRef.current) return;

        const combined = [...localResults, ...usdaResults];

        setFoods(combined);
        setStatus(`Found ${combined.length} foods`);
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;

        const message =
          err instanceof Error ? err.message : JSON.stringify(err);

        setStatus(`Error: ${message}`);
        setFoods([]);
      } finally {
        if (requestId === searchRequestRef.current) setLoading(false);
      }
    },
    [databaseFilter],
  );

  useEffect(() => {
    const timeout = setTimeout(() => searchFoodsAjax(query.trim()), 450);
    return () => clearTimeout(timeout);
  }, [query, databaseFilter, searchFoodsAjax]);

  function updateDatabaseFilter(value: DatabaseFilter) {
    if (databaseFilter === value) return;
    setDatabaseFilter(value);
  }

  function openFood(item: FoodResult) {
    router.push({
      pathname: "/(tabs)/diary/search-food-detail" as any,
      params: {
        resultType: item.resultType,
        payload: encodeURIComponent(JSON.stringify(item)),
        mealType: String(mealType),
        date: String(date),
      },
    });
  }

  function getKey(item: FoodResult) {
    if (item.resultType === "local") return `local-${item.id}`;
    return `usda-${item.fdcId}`;
  }

  function renderOption(label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          minHeight: 58,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: active ? theme.colors.primary : theme.colors.text,
          }}
        >
          {label}
        </Text>

        {active ? <Check size={26} color={theme.colors.primary} /> : null}
      </Pressable>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackVisible: false,
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
              <Pressable
                onPress={() => router.back()}
                style={{
                  width: 42,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={30} color={theme.colors.text} />
              </Pressable>

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
                <Search size={25} color={theme.colors.text} />

                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods..."
                  placeholderTextColor={theme.colors.textFaint}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontSize: 17,
                    color: theme.colors.text,
                    paddingVertical: 0,
                  }}
                />

                <Pressable
                  onPress={() => setOptionsOpen(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingLeft: 4,
                  }}
                >
                  <SlidersHorizontal size={23} color={theme.colors.primary} />
                </Pressable>
              </View>
            </View>
          ),
          headerRight: () => null,
        }}
      />

      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {categoryTabsEnabled ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
              }}
            >
              {[
                ["all", "All"],
                ["custom", "Custom"],
                ["usda", "USDA"],
              ].map(([value, label]) => {
                const active = databaseFilter === value;

                return (
                  <Pressable
                    key={value}
                    onPress={() =>
                      updateDatabaseFilter(value as DatabaseFilter)
                    }
                    style={{
                      paddingHorizontal: 10,
                      paddingTop: 14,
                      paddingBottom: 13,
                      borderBottomWidth: active ? 3 : 0,
                      borderBottomColor: theme.colors.primary,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "900",
                        color: active
                          ? theme.colors.primary
                          : theme.colors.textMuted,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 18, color: theme.colors.text }}>
            {mode === "recent" ? "Latest Logged Foods" : "Search Results"}
          </Text>

          <Pressable onPress={() => setSortBy((current) => nextSort(current))}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: theme.colors.primary,
              }}
            >
              ↕ {sortLabel(sortBy)}
            </Text>
          </Pressable>
        </View>

        {!!status ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              marginHorizontal: 16,
              marginBottom: 8,
            }}
          >
            {status} · Showing {filteredAndSortedFoods.length}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 28 }}
          />
        ) : (
          <FlatList
            data={filteredAndSortedFoods}
            keyExtractor={getKey}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: 28,
            }}
            renderItem={({ item }) => {
              const isLocal = item.resultType === "local";
              const badge = isLocal ? sourceLabel(item.source) : "USDA";

              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => openFood(item)}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    {multiAddEnabled ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderWidth: 2,
                          borderRadius: 6,
                          borderColor: theme.colors.primary,
                          marginTop: 2,
                        }}
                      />
                    ) : null}

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: "900",
                          fontSize: 16,
                          color: theme.colors.text,
                        }}
                      >
                        {item.name}
                      </Text>

                      {item.brand ? (
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {item.brand}
                        </Text>
                      ) : null}

                      <Text
                        style={{
                          color: theme.colors.textFaint,
                          marginTop: 4,
                        }}
                      >
                        {badge}
                      </Text>
                    </View>

                    {isLocal ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontWeight: "900",
                            color: theme.colors.text,
                          }}
                        >
                          {Math.round(item.calories)} kcal
                        </Text>

                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: 12,
                          }}
                        >
                          P {Math.round(item.protein_g)} · C{" "}
                          {Math.round(item.carbs_g)} · F{" "}
                          {Math.round(item.fat_g)}
                        </Text>

                        <Text
                          style={{
                            color: theme.colors.textFaint,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          per {item.serving_size}
                          {item.serving_unit}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: theme.colors.textFaint,
                          fontSize: 12,
                        }}
                      >
                        FDC {item.fdcId}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text
                style={{
                  color: theme.colors.textFaint,
                  textAlign: "center",
                  marginTop: 40,
                }}
              >
                {mode === "recent"
                  ? "No logged foods yet."
                  : "No foods found in this category."}
              </Text>
            }
          />
        )}

        {optionsOpen ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 99,
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={() => setOptionsOpen(false)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
            />

            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                paddingHorizontal: 22,
                paddingTop: 12,
                paddingBottom: 34,
                maxHeight: "82%",
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: theme.colors.border,
                  alignSelf: "center",
                  marginBottom: 18,
                }}
              />

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "900",
                    color: theme.colors.text,
                    marginBottom: 16,
                  }}
                >
                  Search Options
                </Text>

                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontWeight: "900",
                    marginBottom: 4,
                  }}
                >
                  Database
                </Text>

                {renderOption("All", databaseFilter === "all", () =>
                  updateDatabaseFilter("all"),
                )}
                {renderOption("Custom", databaseFilter === "custom", () =>
                  updateDatabaseFilter("custom"),
                )}
                {renderOption("USDA", databaseFilter === "usda", () =>
                  updateDatabaseFilter("usda"),
                )}

                <View
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.border,
                    marginVertical: 12,
                  }}
                />

                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontWeight: "900",
                    marginBottom: 4,
                  }}
                >
                  Sort
                </Text>

                {renderOption("Most Recent", sortBy === "recent", () =>
                  setSortBy("recent"),
                )}
                {renderOption("A to Z", sortBy === "az", () => setSortBy("az"))}
                {renderOption("Z to A", sortBy === "za", () => setSortBy("za"))}

                <View
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.border,
                    marginVertical: 12,
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 58,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "900",
                      color: theme.colors.text,
                    }}
                  >
                    Category Tabs
                  </Text>

                  <Switch
                    value={categoryTabsEnabled}
                    onValueChange={(value) => {
                      setCategoryTabsEnabled(value);

                      // revert back to ALL when tabs are hidden
                      if (!value) {
                        setDatabaseFilter("all");
                      }
                    }}
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 58,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "900",
                      color: theme.colors.text,
                    }}
                  >
                    Multi Add
                  </Text>

                  <Switch
                    value={multiAddEnabled}
                    onValueChange={setMultiAddEnabled}
                  />
                </View>

                <Pressable
                  onPress={() => setOptionsOpen(false)}
                  style={{
                    marginTop: 24,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: theme.colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.surface,
                      fontSize: 17,
                      fontWeight: "900",
                    }}
                  >
                    Done
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

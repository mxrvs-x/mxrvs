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
  type TextInput as TextInputType,
} from "react-native";

type SortOption = "recent" | "az" | "za";
type DatabaseFilter = "all" | "custom" | "fatsecret";
type FoodSource = "custom" | "fatsecret";
type FatSecretRegion = "all" | "US" | "AU" | "GB" | "CA" | "PH" | "MY" | "SG";

const FATSECRET_REGIONS: { code: FatSecretRegion; label: string }[] = [
  { code: "all", label: "All Regions" },
  { code: "US", label: "United States" },
  { code: "AU", label: "Australia" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "PH", label: "Philippines" },
  { code: "MY", label: "Malaysia" },
  { code: "SG", label: "Singapore" },
];

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

type FatSecretFoodResult = {
  resultType: "fatsecret";
  foodId: string;
  name: string;
  brand?: string | null;
  foodType?: string | null;
  raw?: FatSecretFood | FatSecretSearchFood;
};

type FoodResult = LocalFoodResult | FatSecretFoodResult;

function n(value: any) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "fatsecret") return "FatSecret";
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

function mapFatSecretFood(
  food: FatSecretFood | FatSecretSearchFood,
): FatSecretFoodResult {
  return {
    resultType: "fatsecret",
    foodId: food.food_id,
    name: food.food_name,
    brand: food.brand_name ?? null,
    foodType: food.food_type ?? null,
    raw: food,
  };
}

function filterToSource(value: DatabaseFilter): FoodSource | null {
  if (value === "custom") return "custom";
  if (value === "fatsecret") return "fatsecret";
  return null;
}

function compactFatSecretPayload(food: FatSecretFoodResult) {
  if (food.raw) return compactFatSecretFoodPayload(food.raw);

  return {
    resultType: "fatsecret",
    food_id: food.foodId,
    food_name: food.name,
    food_type: food.foodType ?? undefined,
    brand_name: food.brand ?? undefined,
  };
}

function getFatSecretSearchCalories(food?: FatSecretSearchFood) {
  const serving = getFatSecretDefaultServing(food);
  const servingCalories = Number(serving?.calories ?? 0);

  if (Number.isFinite(servingCalories) && servingCalories > 0) {
    return Math.round(servingCalories);
  }

  const descriptionCalories = food?.food_description?.match(
    /Calories:\s*([0-9.]+)/i,
  )?.[1];

  return descriptionCalories ? Math.round(Number(descriptionCalories)) : null;
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
  const [fatSecretRegion, setFatSecretRegion] =
    useState<FatSecretRegion>("PH");
  const [multiAddEnabled, setMultiAddEnabled] = useState(false);
  const [categoryTabsEnabled, setCategoryTabsEnabled] = useState(true);

  const searchRequestRef = useRef(0);
  const fatSecretStatusRef = useRef("");
  const queryInputRef = useRef<TextInputType>(null);
  const queryTextRef = useRef("");
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchLatestLoggedFoods = useCallback(async () => {
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
  }, []);

  const searchLocalFoods = useCallback(async (searchText: string) => {
    if (databaseFilter === "fatsecret") return [];

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
  }, [databaseFilter]);

  const searchFatSecret = useCallback(async (searchText: string) => {
    if (databaseFilter === "custom") return [];

    fatSecretStatusRef.current = "";

    if (!hasFatSecretCredentials()) {
      const message =
        getFatSecretCredentialIssue() ?? "Missing FatSecret OAuth1 credentials";

      fatSecretStatusRef.current = message;
      console.log(message);
      return [];
    }

    try {
      const [searchResults, barcodeResults] = await Promise.all([
        searchFatSecretFoodsWithDetails(
          searchText,
          20,
          fatSecretRegion === "all"
            ? undefined
            : { region: fatSecretRegion, language: "en" },
        ),
        Promise.resolve([] as FatSecretFood[]),
      ]);
      const seen = new Set<string>();

      return [...barcodeResults, ...searchResults]
        .filter((food) => {
          if (!food.food_id || seen.has(food.food_id)) return false;

          seen.add(food.food_id);
          return true;
        })
        .map(mapFatSecretFood);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);

      fatSecretStatusRef.current = `FatSecret search unavailable: ${message}`;
      console.log("FatSecret search error:", error);
      return [];
    }
  }, [databaseFilter, fatSecretRegion]);

  const searchFoodsAjax = useCallback(
    async (searchText: string) => {
      const value = searchText.trim();
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      try {
        setLoading(true);

        const shouldShowLatestLoggedFoods =
          databaseFilter === "all" && value.length < 2;

        setMode(shouldShowLatestLoggedFoods ? "recent" : "search");

        setStatus(
          shouldShowLatestLoggedFoods
            ? "Loading latest logged foods..."
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

        const [localResults, fatSecretResults] = await Promise.all([
          searchLocalFoods(value),
          searchFatSecret(value),
        ]);

        if (requestId !== searchRequestRef.current) return;

        const combined = [...localResults, ...fatSecretResults];

        setFoods(combined);
        setStatus(
          fatSecretStatusRef.current
            ? `${fatSecretStatusRef.current}. Found ${combined.length} custom foods.`
            : `Found ${combined.length} foods`,
        );
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
    [
      databaseFilter,
      fetchLatestLoggedFoods,
      searchFatSecret,
      searchLocalFoods,
    ],
  );

  useEffect(() => {
    searchFoodsAjax(query.trim());
  }, [query, databaseFilter, searchFoodsAjax]);

  function handleQueryChange(text: string) {
    queryTextRef.current = text;

    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current);
    }

    queryDebounceRef.current = setTimeout(() => {
      setQuery(queryTextRef.current);
    }, 450);
  }

  function submitQuery() {
    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current);
    }

    setQuery(queryTextRef.current);
  }

  function updateDatabaseFilter(value: DatabaseFilter) {
    if (databaseFilter === value) return;
    setDatabaseFilter(value);
  }

  useEffect(() => {
    return () => {
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current);
      }
    };
  }, []);

  function openFood(item: FoodResult) {
    const payload =
      item.resultType === "fatsecret"
          ? compactFatSecretPayload(item)
          : item;

    router.push({
      pathname: "/(tabs)/diary/search-food-detail" as any,
      params: {
        resultType: item.resultType,
        payload: encodeURIComponent(JSON.stringify(payload)),
        mealType: String(mealType),
        date: String(date),
      },
    });
  }

  function getKey(item: FoodResult) {
    if (item.resultType === "local") return `local-${item.id}`;
    return `fatsecret-${item.foodId}`;
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
                  ref={queryInputRef}
                  defaultValue={queryTextRef.current}
                  onChangeText={handleQueryChange}
                  onSubmitEditing={submitQuery}
                  placeholder="Search foods or brands..."
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
                ["fatsecret", "FatSecret"],
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
              const isFatSecret = item.resultType === "fatsecret";
              const badge = isLocal
                ? sourceLabel(item.source)
                : isFatSecret
                  ? "FatSecret"
                  : "FatSecret";
              const fatSecretServing = isFatSecret
                ? getFatSecretDefaultServing(item.raw)
                : null;
              const fatSecretCalories = isFatSecret
                ? getFatSecretSearchCalories(item.raw)
                : null;

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
                    ) : isFatSecret ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontWeight: "900",
                            color: theme.colors.text,
                          }}
                        >
                          {fatSecretCalories
                            ? `${fatSecretCalories} kcal`
                            : "FS"}
                        </Text>

                        {fatSecretServing?.serving_description ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              color: theme.colors.textMuted,
                              fontSize: 12,
                              maxWidth: 94,
                            }}
                          >
                            {fatSecretServing.serving_description}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
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
                {renderOption("FatSecret", databaseFilter === "fatsecret", () =>
                  updateDatabaseFilter("fatsecret"),
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
                  FatSecret Region
                </Text>

                {FATSECRET_REGIONS.map((region) => (
                  <View key={region.code}>
                    {renderOption(
                      region.label,
                      fatSecretRegion === region.code,
                      () => setFatSecretRegion(region.code),
                    )}
                  </View>
                ))}

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

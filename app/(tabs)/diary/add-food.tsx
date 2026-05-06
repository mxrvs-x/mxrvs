import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type FoodResult =
  | {
      resultType: "local";
      id: string;
      name: string;
      brand?: string | null;
      description?: string | null;
      source: "custom" | "usda_fdc" | "nccdb";
      serving_size: number;
      serving_unit: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g?: number;
      sugar_g?: number;
      sodium_mg?: number;
      cholesterol_mg?: number;
      potassium_mg?: number;
      calcium_mg?: number;
      iron_mg?: number;
      magnesium_mg?: number;
      zinc_mg?: number;
      vitamin_a_mcg?: number;
      vitamin_c_mg?: number;
      vitamin_d_mcg?: number;
      vitamin_b12_mcg?: number;
    }
  | {
      resultType: "usda";
      fdcId: number;
      name: string;
      brand?: string | null;
      dataType: string;
      foodCategory?: string | null;
    }
  | {
      resultType: "au";
      pfk: string;
      name: string;
      derivation?: string | null;
      food_group?: string | null;
      sub_food_group?: string | null;
    };

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
};

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

const AU_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const AU_BASE_URL =
  "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/search/api/foods";

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

export default function AddFoodScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { mealType, date } = useLocalSearchParams<{
    mealType: string;
    date: string;
  }>();

  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<FoodResult[]>([]);
  const [allAuFoods, setAllAuFoods] = useState<AuFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"recent" | "search">("recent");

  const searchRequestRef = useRef(0);

  const loadRecentFoods = useCallback(async () => {
    setLoading(true);
    setMode("recent");
    setStatus("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setFoods([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("food_logs")
      .select(
        `
        food_id,
        foods (
          id,
          name,
          brand,
          description,
          source,
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
          potassium_mg,
          calcium_mg,
          iron_mg,
          magnesium_mg,
          zinc_mg,
          vitamin_a_mcg,
          vitamin_c_mg,
          vitamin_d_mcg,
          vitamin_b12_mcg
        )
      `,
      )
      .eq("user_id", user.id)
      .not("food_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.log("Recent foods error:", error);
      setFoods([]);
      setLoading(false);
      return;
    }

    const uniqueFoods: FoodResult[] = [];
    const seen = new Set<string>();

    for (const row of data ?? []) {
      const food = (row as any).foods;

      if (food?.id && !seen.has(food.id)) {
        seen.add(food.id);

        uniqueFoods.push({
          resultType: "local",
          id: food.id,
          name: food.name,
          brand: food.brand,
          description: food.description,
          source: food.source,
          serving_size: Number(food.serving_size ?? 100),
          serving_unit: food.serving_unit ?? "g",
          calories: Number(food.calories ?? 0),
          protein_g: Number(food.protein_g ?? 0),
          carbs_g: Number(food.carbs_g ?? 0),
          fat_g: Number(food.fat_g ?? 0),
          fiber_g: Number(food.fiber_g ?? 0),
          sugar_g: Number(food.sugar_g ?? 0),
          sodium_mg: Number(food.sodium_mg ?? 0),
          cholesterol_mg: Number(food.cholesterol_mg ?? 0),
          potassium_mg: Number(food.potassium_mg ?? 0),
          calcium_mg: Number(food.calcium_mg ?? 0),
          iron_mg: Number(food.iron_mg ?? 0),
          magnesium_mg: Number(food.magnesium_mg ?? 0),
          zinc_mg: Number(food.zinc_mg ?? 0),
          vitamin_a_mcg: Number(food.vitamin_a_mcg ?? 0),
          vitamin_c_mg: Number(food.vitamin_c_mg ?? 0),
          vitamin_d_mcg: Number(food.vitamin_d_mcg ?? 0),
          vitamin_b12_mcg: Number(food.vitamin_b12_mcg ?? 0),
        });
      }
    }

    setFoods(uniqueFoods);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentFoods();
    }, [loadRecentFoods]),
  );

  async function searchLocalFoods(searchText: string) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    const safeQuery = searchText.replace(/[%_]/g, "");

    let queryBuilder = supabase
      .from("foods")
      .select(
        `
        id,
        user_id,
        name,
        brand,
        description,
        source,
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
        potassium_mg,
        calcium_mg,
        iron_mg,
        magnesium_mg,
        zinc_mg,
        vitamin_a_mcg,
        vitamin_c_mg,
        vitamin_d_mcg,
        vitamin_b12_mcg
      `,
      )
      .or(
        `name.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`,
      )
      .limit(30);

    if (user) {
      queryBuilder = queryBuilder.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.log("Local foods search error:", error);
      return [];
    }

    return (data ?? []).map(
      (food: any): FoodResult => ({
        resultType: "local",
        id: food.id,
        name: food.name,
        brand: food.brand,
        description: food.description,
        source: food.source,
        serving_size: Number(food.serving_size ?? 100),
        serving_unit: food.serving_unit ?? "g",
        calories: Number(food.calories ?? 0),
        protein_g: Number(food.protein_g ?? 0),
        carbs_g: Number(food.carbs_g ?? 0),
        fat_g: Number(food.fat_g ?? 0),
        fiber_g: Number(food.fiber_g ?? 0),
        sugar_g: Number(food.sugar_g ?? 0),
        sodium_mg: Number(food.sodium_mg ?? 0),
        cholesterol_mg: Number(food.cholesterol_mg ?? 0),
        potassium_mg: Number(food.potassium_mg ?? 0),
        calcium_mg: Number(food.calcium_mg ?? 0),
        iron_mg: Number(food.iron_mg ?? 0),
        magnesium_mg: Number(food.magnesium_mg ?? 0),
        zinc_mg: Number(food.zinc_mg ?? 0),
        vitamin_a_mcg: Number(food.vitamin_a_mcg ?? 0),
        vitamin_c_mg: Number(food.vitamin_c_mg ?? 0),
        vitamin_d_mcg: Number(food.vitamin_d_mcg ?? 0),
        vitamin_b12_mcg: Number(food.vitamin_b12_mcg ?? 0),
      }),
    );
  }

  async function searchUsdaFoods(searchText: string) {
    const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

    if (!apiKey) {
      console.log("Missing EXPO_PUBLIC_USDA_API_KEY");
      return [];
    }

    const url =
      "https://api.nal.usda.gov/fdc/v1/foods/search" +
      `?api_key=${apiKey}` +
      `&query=${encodeURIComponent(searchText)}` +
      `&pageSize=25`;

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      console.log("USDA error:", json);
      return [];
    }

    return ((json.foods ?? []) as UsdaFood[]).map(
      (food): FoodResult => ({
        resultType: "usda",
        fdcId: food.fdcId,
        name: food.description,
        brand: food.brandOwner ?? food.brandName ?? null,
        dataType: food.dataType,
        foodCategory: food.foodCategory ?? null,
      }),
    );
  }

  async function fetchAllAuFoods() {
    const results = await Promise.all(
      AU_LETTERS.map(async (letter) => {
        const response = await fetch(`${AU_BASE_URL}/alphabetical/${letter}`);
        const json = await response.json();

        if (!response.ok) {
          throw new Error(JSON.stringify(json));
        }

        return json ?? [];
      }),
    );

    return results.flat() as AuFood[];
  }

  async function searchAuFoods(searchText: string) {
    let sourceFoods = allAuFoods;

    if (sourceFoods.length === 0) {
      sourceFoods = await fetchAllAuFoods();
      setAllAuFoods(sourceFoods);
    }

    const value = searchText.toLowerCase();

    return sourceFoods
      .filter((food) => {
        const name = food.name?.toLowerCase() ?? "";
        const group = food.food_group?.toLowerCase() ?? "";
        const subGroup = food.sub_food_group?.toLowerCase() ?? "";

        return (
          name.includes(value) ||
          group.includes(value) ||
          subGroup.includes(value)
        );
      })
      .slice(0, 30)
      .map(
        (food): FoodResult => ({
          resultType: "au",
          pfk: food.pfk,
          name: food.name,
          derivation: food.derivation,
          food_group: food.food_group,
          sub_food_group: food.sub_food_group,
        }),
      );
  }

  const searchFoodsAjax = useCallback(
    async (searchText: string) => {
      const value = searchText.trim();

      if (value.length < 2) {
        loadRecentFoods();
        return;
      }

      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      try {
        setLoading(true);
        setMode("search");
        setStatus("Searching custom, USDA, and AU foods...");

        const [localResults, usdaResults, auResults] = await Promise.all([
          searchLocalFoods(value),
          searchUsdaFoods(value),
          searchAuFoods(value),
        ]);

        if (requestId !== searchRequestRef.current) return;

        const combined = [...localResults, ...usdaResults, ...auResults];

        setFoods(combined);
        setStatus(`Found ${combined.length} foods`);
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;

        const message =
          err instanceof Error ? err.message : JSON.stringify(err);

        setStatus(`Error: ${message}`);
        setFoods([]);
      } finally {
        if (requestId === searchRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [allAuFoods, loadRecentFoods],
  );

  useEffect(() => {
    const value = query.trim();

    const timeout = setTimeout(() => {
      searchFoodsAjax(value);
    }, 450);

    return () => clearTimeout(timeout);
  }, [query, searchFoodsAjax]);

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
    if (item.resultType === "usda") return `usda-${item.fdcId}`;
    return `au-${item.pfk}`;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: 20,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: theme.colors.primary,
            }}
          >
            Cancel
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          Add Food
        </Text>

        <View style={{ width: 60 }} />
      </View>

      <Text style={{ color: theme.colors.textMuted, marginBottom: 16 }}>
        Logging to {mealType} · {date}
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search custom, USDA, or AU foods"
        placeholderTextColor={theme.colors.textFaint}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 14,
          color: theme.colors.text,
        }}
      />

      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          marginBottom: 8,
          color: theme.colors.text,
        }}
      >
        {mode === "recent" ? "Recently Added Foods" : "Search Results"}
      </Text>

      {!!status && (
        <Text style={{ color: theme.colors.textMuted, marginBottom: 12 }}>
          {status}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={foods}
          keyExtractor={getKey}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const isLocal = item.resultType === "local";

            const badge = isLocal
              ? sourceLabel(item.source)
              : item.resultType === "usda"
                ? "USDA LIVE"
                : "AU LIVE";

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
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
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

                    {isLocal && item.brand ? (
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {item.brand}
                      </Text>
                    ) : null}

                    {!isLocal && item.resultType === "usda" && item.brand ? (
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {item.brand}
                      </Text>
                    ) : null}

                    {!isLocal && item.resultType === "au" && item.food_group ? (
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {item.food_group}
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
                        {Math.round(Number(item.calories ?? 0))} kcal
                      </Text>

                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: 12,
                        }}
                      >
                        P {Math.round(Number(item.protein_g ?? 0))} · C{" "}
                        {Math.round(Number(item.carbs_g ?? 0))} · F{" "}
                        {Math.round(Number(item.fat_g ?? 0))}
                      </Text>

                      <Text
                        style={{
                          color: theme.colors.textFaint,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        per {Number(item.serving_size)} {item.serving_unit}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: theme.colors.textFaint,
                        fontSize: 12,
                      }}
                    >
                      {item.resultType === "usda"
                        ? `FDC ${item.fdcId}`
                        : `PFK ${item.pfk}`}
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
                ? "No previously added foods yet."
                : "No foods found."}
            </Text>
          }
        />
      )}
    </View>
  );
}

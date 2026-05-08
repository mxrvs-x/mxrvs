import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

type Nutrient = {
  nutrient?: {
    id?: number;
    name?: string;
    unitName?: string;
  };
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  amount?: number;
  value?: number;
};

type FoodDetail = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Nutrient[];
};

type NormalizedNutrient = {
  id?: number;
  name: string;
  unit: string;
  value: number;
};

type NutrientTarget = {
  label: string;
  ids: number[];
  aliases: string[];
};

const ENERGY_IDS = [1008];

const STRUCTURED_MACRO_IDS = new Set([
  1008, 1003, 1004, 1005, 1079, 2000, 1258, 1257, 1292, 1293, 1210, 1211, 1212,
  1213, 1214, 1215, 1216, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224, 1225,
  1226, 1227,
]);

const MACROS: NutrientTarget[] = [
  { label: "Calories", ids: [1008], aliases: ["Energy"] },
  { label: "Protein", ids: [1003], aliases: ["Protein"] },
  {
    label: "Carbs",
    ids: [1005],
    aliases: ["Carbohydrate, by difference", "Carbohydrate"],
  },
  { label: "Fat", ids: [1004], aliases: ["Total lipid", "Fat"] },
];

const EXTRA_NUTRITION: NutrientTarget[] = [
  {
    label: "Fiber",
    ids: [1079],
    aliases: ["Fiber, total dietary", "Dietary fiber"],
  },
  {
    label: "Sugar",
    ids: [2000],
    aliases: ["Total Sugars", "Sugars"],
  },
  {
    label: "Saturated Fat",
    ids: [1258],
    aliases: ["Fatty acids, total saturated"],
  },
  {
    label: "Trans Fat",
    ids: [1257],
    aliases: ["Fatty acids, total trans"],
  },
];

const FAT_BREAKDOWN: NutrientTarget[] = [
  {
    label: "Monounsaturated Fat",
    ids: [1292],
    aliases: ["Fatty acids, total monounsaturated"],
  },
  {
    label: "Polyunsaturated Fat",
    ids: [1293],
    aliases: ["Fatty acids, total polyunsaturated"],
  },
];

const PROTEIN_BREAKDOWN: NutrientTarget[] = [
  { label: "Leucine", ids: [1213], aliases: ["Leucine"] },
  { label: "Isoleucine", ids: [1212], aliases: ["Isoleucine"] },
  { label: "Valine", ids: [1219], aliases: ["Valine"] },
  { label: "Lysine", ids: [1214], aliases: ["Lysine"] },
  { label: "Methionine", ids: [1215], aliases: ["Methionine"] },
  { label: "Phenylalanine", ids: [1217], aliases: ["Phenylalanine"] },
  { label: "Threonine", ids: [1211], aliases: ["Threonine"] },
  { label: "Tryptophan", ids: [1210], aliases: ["Tryptophan"] },
  { label: "Histidine", ids: [1221], aliases: ["Histidine"] },
  { label: "Arginine", ids: [1220], aliases: ["Arginine"] },
  { label: "Alanine", ids: [1222], aliases: ["Alanine"] },
  { label: "Aspartic Acid", ids: [1223], aliases: ["Aspartic acid"] },
  { label: "Glutamic Acid", ids: [1224], aliases: ["Glutamic acid"] },
  { label: "Glycine", ids: [1225], aliases: ["Glycine"] },
  { label: "Proline", ids: [1226], aliases: ["Proline"] },
  { label: "Serine", ids: [1227], aliases: ["Serine"] },
  { label: "Tyrosine", ids: [1218], aliases: ["Tyrosine"] },
  { label: "Cystine", ids: [1216], aliases: ["Cystine"] },
];

function normalizeNutrient(item: Nutrient): NormalizedNutrient {
  return {
    id: item.nutrient?.id ?? item.nutrientId,
    name: item.nutrient?.name ?? item.nutrientName ?? "Unknown nutrient",
    unit: item.nutrient?.unitName ?? item.unitName ?? "",
    value: item.amount ?? item.value ?? 0,
  };
}

function getNutrientValue(
  food: FoodDetail | null,
  target: NutrientTarget,
): NormalizedNutrient {
  const nutrients = food?.foodNutrients ?? [];

  const found = nutrients.find((item) => {
    const id = item.nutrient?.id ?? item.nutrientId;
    const name = item.nutrient?.name ?? item.nutrientName ?? "";

    return (
      target.ids.includes(id ?? -1) ||
      target.aliases.some((alias) =>
        name.toLowerCase().includes(alias.toLowerCase()),
      )
    );
  });

  return {
    id: found?.nutrient?.id ?? found?.nutrientId ?? target.ids[0],
    name: target.label,
    unit:
      found?.nutrient?.unitName ?? found?.unitName ?? getDefaultUnit(target),
    value: found?.amount ?? found?.value ?? 0,
  };
}

function getDefaultUnit(target: NutrientTarget) {
  if (target.ids.some((id) => ENERGY_IDS.includes(id))) return "kcal";
  return "g";
}

function cleanNutrientName(name: string) {
  return name.split(",")[0].trim();
}

function formatNumber(value?: number | null) {
  const safeValue = value ?? 0;

  if (safeValue === 0) return "0";
  if (safeValue < 1) return safeValue.toFixed(2);
  if (safeValue < 10) return safeValue.toFixed(1);

  return Math.round(safeValue).toString();
}

export default function UsdaFoodDetailScreen() {
  const { fdcId } = useLocalSearchParams<{ fdcId: string }>();

  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [food, setFood] = useState<FoodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  useEffect(() => {
    async function fetchFoodDetail() {
      try {
        const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;

        if (!apiKey) {
          setStatus("Missing EXPO_PUBLIC_USDA_API_KEY in .env");
          return;
        }

        const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`;

        const response = await fetch(url);
        const json = await response.json();

        if (!response.ok) {
          setStatus(`USDA error: ${JSON.stringify(json)}`);
          return;
        }

        setFood(json);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : JSON.stringify(err);
        setStatus(`Error: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchFoodDetail();
  }, [fdcId]);

  const sections = useMemo(() => {
    const macros = MACROS.map((target) => getNutrientValue(food, target));
    const extraNutrition = EXTRA_NUTRITION.map((target) =>
      getNutrientValue(food, target),
    );
    const fats = FAT_BREAKDOWN.map((target) => getNutrientValue(food, target));
    const protein = PROTEIN_BREAKDOWN.map((target) =>
      getNutrientValue(food, target),
    );

    const micros = (food?.foodNutrients ?? [])
      .map(normalizeNutrient)
      .filter((item) => !STRUCTURED_MACRO_IDS.has(item.id ?? -1))
      .map((item) => ({
        ...item,
        name: cleanNutrientName(item.name),
      }));

    return {
      macros,
      extraNutrition,
      fats,
      protein,
      micros,
    };
  }, [food]);

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerTitle: "",
            headerBackVisible: false,
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerLeft: () => (
              <View
                style={{
                  width: screenWidth - 18,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: 20,
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
              </View>
            ),
            headerRight: () => null,
          }}
        />

        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textMuted }}>
            Loading food...
          </Text>
        </View>
      </>
    );
  }

  if (!food) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerTitle: "",
            headerBackVisible: false,
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerLeft: () => (
              <View
                style={{
                  width: screenWidth - 18,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: 20,
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
              </View>
            ),
            headerRight: () => null,
          }}
        />

        <View
          style={{
            flex: 1,
            padding: 24,
            backgroundColor: theme.colors.background,
          }}
        >
          <Text style={{ color: theme.colors.text }}>
            {status || "Food not found."}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "",
          headerBackVisible: false,
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
            </View>
          ),

          headerRight: () => null,
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          {food.description}
        </Text>

        <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
          {food.dataType}
        </Text>

        {!!food.brandOwner && (
          <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
            {food.brandOwner}
          </Text>
        )}

        {!!food.brandName && (
          <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
            {food.brandName}
          </Text>
        )}

        {food.servingSize ? (
          <Text style={{ marginTop: 12, color: theme.colors.textFaint }}>
            Serving: {food.servingSize} {food.servingSizeUnit}
          </Text>
        ) : (
          <Text style={{ marginTop: 12, color: theme.colors.textFaint }}>
            Nutrition values are usually per 100g
          </Text>
        )}

        <MacroDistributionChart macros={sections.macros} theme={theme} />

        <NutritionCard title="Macros" theme={theme}>
          {sections.macros.map((item) => (
            <NutritionRow
              key={`${item.id}-${item.name}`}
              label={item.name}
              value={item.value}
              unit={item.unit}
              theme={theme}
            />
          ))}
        </NutritionCard>

        <NutritionCard title="Extra Nutrition" theme={theme}>
          {sections.extraNutrition.map((item) => (
            <NutritionRow
              key={`${item.id}-${item.name}`}
              label={item.name}
              value={item.value}
              unit={item.unit}
              theme={theme}
            />
          ))}
        </NutritionCard>

        <Pressable
          onPress={() => setShowFullNutrition((prev) => !prev)}
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: theme.colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {showFullNutrition ? (
            <ChevronUp size={18} color={theme.colors.textInverse} />
          ) : (
            <ChevronDown size={18} color={theme.colors.textInverse} />
          )}

          <Text
            style={{
              color: theme.colors.textInverse,
              textAlign: "center",
              fontWeight: "900",
            }}
          >
            {showFullNutrition ? "Hide Full Nutrition" : "Show Full Nutrition"}
          </Text>
        </Pressable>

        {showFullNutrition ? (
          <>
            <NutritionCard title="Fat Breakdown" theme={theme}>
              {sections.fats.map((item) => (
                <NutritionRow
                  key={`${item.id}-${item.name}`}
                  label={item.name}
                  value={item.value}
                  unit={item.unit}
                  theme={theme}
                />
              ))}
            </NutritionCard>

            <NutritionCard title="Protein / Amino Acids" theme={theme}>
              {sections.protein.map((item) => (
                <NutritionRow
                  key={`${item.id}-${item.name}`}
                  label={item.name}
                  value={item.value}
                  unit={item.unit}
                  theme={theme}
                />
              ))}
            </NutritionCard>

            <NutritionCard title="Micros / Other Nutrients" theme={theme}>
              {sections.micros.map((item, index) => (
                <NutritionRow
                  key={`${item.id ?? item.name}-${index}`}
                  label={item.name}
                  value={item.value}
                  unit={item.unit}
                  theme={theme}
                />
              ))}
            </NutritionCard>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function MacroDistributionChart({
  macros,
  theme,
}: {
  macros: NormalizedNutrient[];
  theme: ReturnType<typeof useTheme>;
}) {
  const calories = macros.find((item) => item.name === "Calories")?.value ?? 0;
  const proteinG = macros.find((item) => item.name === "Protein")?.value ?? 0;
  const carbsG = macros.find((item) => item.name === "Carbs")?.value ?? 0;
  const fatG = macros.find((item) => item.name === "Fat")?.value ?? 0;

  const proteinCalories = proteinG * 4;
  const carbsCalories = carbsG * 4;
  const fatCalories = fatG * 9;

  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

  const proteinPercent =
    totalMacroCalories > 0 ? (proteinCalories / totalMacroCalories) * 100 : 0;
  const carbsPercent =
    totalMacroCalories > 0 ? (carbsCalories / totalMacroCalories) * 100 : 0;
  const fatPercent =
    totalMacroCalories > 0 ? (fatCalories / totalMacroCalories) * 100 : 0;

  const size = 120;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  const segments = [
    {
      label: "Protein",
      grams: proteinG,
      percent: proteinPercent,
      color: theme.colors.protein,
    },
    {
      label: "Net Carbs",
      grams: carbsG,
      percent: carbsPercent,
      color: theme.colors.carbs,
    },
    {
      label: "Fat",
      grams: fatG,
      percent: fatPercent,
      color: theme.colors.fat,
    },
  ];

  return (
    <View
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {segments.map((segment) => {
            const dashLength = (circumference * segment.percent) / 100;
            const dashOffset = -currentOffset;

            currentOffset += dashLength;

            return (
              <Circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                rotation="-90"
                originX={size / 2}
                originY={size / 2}
              />
            );
          })}
        </Svg>

        <View
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 20,
              fontWeight: "900",
            }}
          >
            {formatNumber(calories)}
          </Text>

          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            kcal
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, gap: 12 }}>
        {segments.map((segment) => (
          <Text
            key={segment.label}
            style={{
              color: segment.color,
              fontSize: 14,
              fontWeight: "900",
            }}
          >
            {segment.label} ({formatNumber(segment.percent)}%) -{" "}
            <Text style={{ color: theme.colors.text }}>
              {formatNumber(segment.grams)}g
            </Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

function NutritionCard({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          marginBottom: 12,
          color: theme.colors.text,
        }}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

function NutritionRow({
  label,
  value,
  unit,
  theme,
}: {
  label: string;
  value?: number | null;
  unit: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        paddingVertical: 9,
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
      }}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          flex: 1,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          fontWeight: "900",
          color: theme.colors.text,
        }}
      >
        {formatNumber(value)} {unit}
      </Text>
    </View>
  );
}
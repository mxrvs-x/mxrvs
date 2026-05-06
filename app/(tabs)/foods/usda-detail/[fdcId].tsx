import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: "#666" }}>Loading food...</Text>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Text>{status || "Food not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 26, fontWeight: "800" }}>
        {food.description}
      </Text>

      <Text style={{ marginTop: 4, color: "#666" }}>{food.dataType}</Text>

      {!!food.brandOwner && (
        <Text style={{ marginTop: 4, color: "#666" }}>{food.brandOwner}</Text>
      )}

      {!!food.brandName && (
        <Text style={{ marginTop: 4, color: "#666" }}>{food.brandName}</Text>
      )}

      {food.servingSize ? (
        <Text style={{ marginTop: 12, color: "#999" }}>
          Serving: {food.servingSize} {food.servingSizeUnit}
        </Text>
      ) : (
        <Text style={{ marginTop: 12, color: "#999" }}>
          Nutrition values are usually per 100g
        </Text>
      )}

      <NutritionCard title="Macros">
        {sections.macros.map((item) => (
          <NutritionRow
            key={`${item.id}-${item.name}`}
            label={item.name}
            value={item.value}
            unit={item.unit}
          />
        ))}
      </NutritionCard>

      <NutritionCard title="Extra Nutrition">
        {sections.extraNutrition.map((item) => (
          <NutritionRow
            key={`${item.id}-${item.name}`}
            label={item.name}
            value={item.value}
            unit={item.unit}
          />
        ))}
      </NutritionCard>

      <Pressable
        onPress={() => setShowFullNutrition((prev) => !prev)}
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          backgroundColor: "#000",
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>
          {showFullNutrition ? "Hide Full Nutrition" : "Show Full Nutrition"}
        </Text>
      </Pressable>

      {showFullNutrition ? (
        <>
          <NutritionCard title="Fat Breakdown">
            {sections.fats.map((item) => (
              <NutritionRow
                key={`${item.id}-${item.name}`}
                label={item.name}
                value={item.value}
                unit={item.unit}
              />
            ))}
          </NutritionCard>

          <NutritionCard title="Protein / Amino Acids">
            {sections.protein.map((item) => (
              <NutritionRow
                key={`${item.id}-${item.name}`}
                label={item.name}
                value={item.value}
                unit={item.unit}
              />
            ))}
          </NutritionCard>

          <NutritionCard title="Micros / Other Nutrients">
            {sections.micros.map((item, index) => (
              <NutritionRow
                key={`${item.id ?? item.name}-${index}`}
                label={item.name}
                value={item.value}
                unit={item.unit}
              />
            ))}
          </NutritionCard>
        </>
      ) : null}
    </ScrollView>
  );
}

function NutritionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
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
}: {
  label: string;
  value?: number | null;
  unit: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: "#eee",
        gap: 12,
      }}
    >
      <Text style={{ color: "#666", flex: 1 }}>{label}</Text>
      <Text style={{ fontWeight: "700" }}>
        {formatNumber(value)} {unit}
      </Text>
    </View>
  );
}

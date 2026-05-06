import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

const BASE_URL =
  "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/search/api/foods";

type AuNutrient = {
  nutrient_id: string;
  name: string;
  value_per_100: number | null;
  units: string;
};

type AuNutrientGroup = {
  category: string;
  nutrients: AuNutrient[];
};

type AuFoodDetail = {
  pfk: string;
  name: string;
  description?: string | null;
  food_group?: string | null;
  sub_food_group?: string | null;
  derivation?: string | null;
  analysed_portion?: string | null;
  unanalysed_portion?: string | null;
  nutrients?: AuNutrientGroup[];
};

type NormalizedNutrient = {
  id: string;
  name: string;
  unit: string;
  value: number;
};

type NutrientTarget = {
  label: string;
  ids: string[];
};

const MACROS: NutrientTarget[] = [
  { label: "Calories", ids: ["ENERGY - AHS", "ENERGY-04"] },
  { label: "Protein", ids: ["PROT"] },
  { label: "Carbs", ids: ["AVAILCHOCNS", "AVAILCHO"] },
  { label: "Fat", ids: ["FAT"] },
];

const EXTRA_NUTRITION: NutrientTarget[] = [
  { label: "Sugar", ids: ["TOTALSUGARS"] },
  { label: "Fiber", ids: ["AOACDFTOTW"] },
  { label: "Starch", ids: ["STARCH"] },
  { label: "Sodium", ids: ["NA"] },
];

const FATS: NutrientTarget[] = [
  { label: "Saturated Fat", ids: ["TOTAL SATURATED FAT - AHS (FD)"] },
  { label: "Trans Fat", ids: ["TOTTRANSFD"] },
  {
    label: "Monounsaturated Fat",
    ids: ["TOTAL MONOUNSATURATED FAT - AHS (FD)"],
  },
  {
    label: "Polyunsaturated Fat",
    ids: ["TOTAL POLYUNSATURATED FAT - AHS (FD)"],
  },
  { label: "Omega 3", ids: ["LCW3TOTALFD"] },
];

const PROTEIN: NutrientTarget[] = [{ label: "Tryptophan", ids: ["TRYPFD"] }];

const EXCLUDED_FULL_NUTRITION_IDS = new Set([
  "ENERGY - AHS",
  "ENERGY-04",
  "PROT",
  "AVAILCHOCNS",
  "AVAILCHO",
  "FAT",
  "TOTALSUGARS",
  "AOACDFTOTW",
  "STARCH",
  "NA",
  "TOTAL SATURATED FAT - AHS (FD)",
  "TOTTRANSFD",
  "TOTAL MONOUNSATURATED FAT - AHS (FD)",
  "TOTAL POLYUNSATURATED FAT - AHS (FD)",
  "LCW3TOTALFD",
  "TRYPFD",
]);

function flattenNutrients(food: AuFoodDetail | null) {
  return (food?.nutrients ?? []).flatMap((group) =>
    group.nutrients.map((nutrient) => ({
      category: group.category,
      ...nutrient,
    })),
  );
}

function getNutrientValue(
  food: AuFoodDetail | null,
  target: NutrientTarget,
): NormalizedNutrient {
  const nutrients = flattenNutrients(food);

  const found = nutrients.find((item) => target.ids.includes(item.nutrient_id));

  let value = found?.value_per_100 ?? 0;
  let unit = found?.units ?? getDefaultUnit(target);

  if (target.label === "Calories" && unit === "kJ") {
    value = value * 0.239006;
    unit = "kcal";
  }

  return {
    id: found?.nutrient_id ?? target.ids[0],
    name: target.label,
    unit,
    value,
  };
}

function getDefaultUnit(target: NutrientTarget) {
  if (target.ids.some((id) => id.includes("ENERGY"))) return "kcal";
  if (target.label === "Sodium") return "mg";
  return "g";
}

function cleanNutrientName(name: string) {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

function formatNumber(value?: number | null) {
  const safeValue = value ?? 0;

  if (safeValue === 0) return "0";
  if (safeValue < 1) return safeValue.toFixed(2);
  if (safeValue < 10) return safeValue.toFixed(1);

  return Math.round(safeValue).toString();
}

export default function AuFoodDetailScreen() {
  const { pfk } = useLocalSearchParams<{ pfk: string }>();

  const [food, setFood] = useState<AuFoodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  useEffect(() => {
    async function fetchFoodDetail() {
      try {
        const response = await fetch(`${BASE_URL}/${pfk}`);
        const json = await response.json();

        if (!response.ok) {
          setStatus(`AU Food Standards error: ${JSON.stringify(json)}`);
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
  }, [pfk]);

  const sections = useMemo(() => {
    const macros = MACROS.map((target) => getNutrientValue(food, target));
    const extraNutrition = EXTRA_NUTRITION.map((target) =>
      getNutrientValue(food, target),
    );
    const fats = FATS.map((target) => getNutrientValue(food, target));
    const protein = PROTEIN.map((target) => getNutrientValue(food, target));

    const micros = flattenNutrients(food)
      .filter((item) => !EXCLUDED_FULL_NUTRITION_IDS.has(item.nutrient_id))
      .map((item) => {
        let value = item.value_per_100 ?? 0;
        let unit = item.units;

        if (item.nutrient_id.includes("ENERGY") && unit === "kJ") {
          value = value * 0.239006;
          unit = "kcal";
        }

        return {
          id: item.nutrient_id,
          name: cleanNutrientName(item.name),
          unit,
          value,
        };
      });

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
      <Text style={{ fontSize: 26, fontWeight: "800" }}>{food.name}</Text>

      {!!food.food_group && (
        <Text style={{ marginTop: 4, color: "#666" }}>{food.food_group}</Text>
      )}

      {!!food.sub_food_group && (
        <Text style={{ marginTop: 4, color: "#666" }}>
          {food.sub_food_group}
        </Text>
      )}

      {!!food.description && (
        <Text style={{ marginTop: 8, color: "#666" }}>{food.description}</Text>
      )}

      {!!food.derivation && (
        <Text style={{ marginTop: 8, color: "#999" }}>
          Derivation: {food.derivation}
        </Text>
      )}

      <Text style={{ marginTop: 12, color: "#999" }}>
        Nutrition values per 100g
      </Text>

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

      {(food.analysed_portion || food.unanalysed_portion) && (
        <NutritionCard title="Portion Notes">
          {!!food.analysed_portion && (
            <InfoRow label="Analysed Portion" value={food.analysed_portion} />
          )}
          {!!food.unanalysed_portion && (
            <InfoRow
              label="Unanalysed Portion"
              value={food.unanalysed_portion}
            />
          )}
        </NutritionCard>
      )}

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
                key={`${item.id}-${index}`}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: "#eee",
      }}
    >
      <Text style={{ color: "#666" }}>{label}</Text>
      <Text style={{ fontWeight: "700", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

import {
  getFatSecretDefaultServing,
  getFatSecretFood,
  getFatSecretServings,
  type FatSecretFood,
  type FatSecretServing,
} from "@/lib/fatsecret";
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

function n(value?: string | number | null) {
  return Number(value ?? 0);
}

function formatNumber(value?: string | number | null) {
  const safeValue = n(value);

  if (safeValue === 0) return "0";
  if (safeValue < 1) return safeValue.toFixed(2);
  if (safeValue < 10) return safeValue.toFixed(1);

  return Math.round(safeValue).toString();
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePayload(value?: string | string[]) {
  const raw = getParamValue(value);

  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw)) as FatSecretFood;
  } catch {
    return null;
  }
}

function minimalFood(foodId?: string | string[]): FatSecretFood | null {
  const id = getParamValue(foodId);

  if (!id) return null;

  return {
    food_id: id,
    food_name: `FatSecret Food ${id}`,
  };
}

export default function FatSecretFoodDetailScreen() {
  const { foodId, payload } = useLocalSearchParams<{
    foodId: string;
    payload?: string | string[];
  }>();
  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const fallbackFood = useMemo(() => parsePayload(payload), [payload]);
  const minimalFallbackFood = useMemo(() => minimalFood(foodId), [foodId]);

  const [food, setFood] = useState<FatSecretFood | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchFoodDetail() {
      try {
        const initialFood = fallbackFood ?? minimalFallbackFood;

        if (initialFood) {
          setFood(initialFood);
          setLoading(false);
          setStatus("");
        } else {
          setLoading(true);
        }

        const id = getParamValue(foodId);

        if (!id) {
          setStatus("Missing FatSecret food id.");
          return;
        }

        const fullFood = await getFatSecretFood(id);

        if (!isMounted) return;

        setFood(fullFood);
        setStatus("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);

        console.log("FatSecret food detail error:", message);

        setStatus(
          fallbackFood
            ? "Full FatSecret details are temporarily unavailable. Showing the food data from search results."
            : "FatSecret food details are temporarily unavailable. Please try this food again later.",
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFoodDetail();

    return () => {
      isMounted = false;
    };
  }, [fallbackFood, foodId, minimalFallbackFood]);

  const defaultServing = getFatSecretDefaultServing(food ?? undefined);
  const servings = getFatSecretServings(food ?? undefined);

  if (loading) {
    return (
      <>
        <DetailHeader router={router} screenWidth={screenWidth} theme={theme} />

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
        <DetailHeader router={router} screenWidth={screenWidth} theme={theme} />

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
      <DetailHeader router={router} screenWidth={screenWidth} theme={theme} />

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
          {food.food_name}
        </Text>

        <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
          FatSecret{food.food_type ? ` - ${food.food_type}` : ""}
        </Text>

        {!!food.brand_name && (
          <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
            {food.brand_name}
          </Text>
        )}

        {defaultServing?.serving_description ? (
          <Text style={{ marginTop: 12, color: theme.colors.textFaint }}>
            Serving: {defaultServing.serving_description}
          </Text>
        ) : (
          <Text style={{ marginTop: 12, color: theme.colors.textFaint }}>
            Nutrition values depend on the selected serving
          </Text>
        )}

        {status ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              padding: 12,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              style={{
                color: theme.colors.textMuted,
                lineHeight: 18,
                fontWeight: "700",
              }}
            >
              {status}
            </Text>
          </View>
        ) : null}

        <MacroDistributionChart serving={defaultServing} theme={theme} />

        <NutritionCard title="Macros" theme={theme}>
          <NutritionRow
            label="Calories"
            value={defaultServing?.calories}
            unit="kcal"
            theme={theme}
          />
          <NutritionRow
            label="Protein"
            value={defaultServing?.protein}
            unit="g"
            theme={theme}
          />
          <NutritionRow
            label="Carbs"
            value={defaultServing?.carbohydrate}
            unit="g"
            theme={theme}
          />
          <NutritionRow
            label="Fat"
            value={defaultServing?.fat}
            unit="g"
            theme={theme}
          />
        </NutritionCard>

        <NutritionCard title="Extra Nutrition" theme={theme}>
          <NutritionRow
            label="Fiber"
            value={defaultServing?.fiber}
            unit="g"
            theme={theme}
          />
          <NutritionRow
            label="Sugar"
            value={defaultServing?.sugar}
            unit="g"
            theme={theme}
          />
          <NutritionRow
            label="Sodium"
            value={defaultServing?.sodium}
            unit="mg"
            theme={theme}
          />
          <NutritionRow
            label="Cholesterol"
            value={defaultServing?.cholesterol}
            unit="mg"
            theme={theme}
          />
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
            {showFullNutrition ? "Hide Servings" : "Show Servings"}
          </Text>
        </Pressable>

        {showFullNutrition ? (
          <NutritionCard title="Available Servings" theme={theme}>
            {servings.map((serving, index) => (
              <ServingRow
                key={`${serving.serving_id ?? index}-${serving.serving_description}`}
                serving={serving}
                theme={theme}
              />
            ))}
          </NutritionCard>
        ) : null}
      </ScrollView>
    </>
  );
}

function DetailHeader({
  router,
  screenWidth,
  theme,
}: {
  router: ReturnType<typeof useRouter>;
  screenWidth: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
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
  );
}

function MacroDistributionChart({
  serving,
  theme,
}: {
  serving: FatSecretServing | null;
  theme: ReturnType<typeof useTheme>;
}) {
  const calories = n(serving?.calories);
  const proteinG = n(serving?.protein);
  const carbsG = n(serving?.carbohydrate);
  const fatG = n(serving?.fat);

  const proteinCalories = proteinG * 4;
  const carbsCalories = carbsG * 4;
  const fatCalories = fatG * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

  const segments = [
    {
      label: "Protein",
      grams: proteinG,
      percent:
        totalMacroCalories > 0
          ? (proteinCalories / totalMacroCalories) * 100
          : 0,
      color: theme.colors.protein,
    },
    {
      label: "Net Carbs",
      grams: carbsG,
      percent:
        totalMacroCalories > 0 ? (carbsCalories / totalMacroCalories) * 100 : 0,
      color: theme.colors.carbs,
    },
    {
      label: "Fat",
      grams: fatG,
      percent:
        totalMacroCalories > 0 ? (fatCalories / totalMacroCalories) * 100 : 0,
      color: theme.colors.fat,
    },
  ];

  const size = 120;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

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
  value?: string | number | null;
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

function ServingRow({
  serving,
  theme,
}: {
  serving: FatSecretServing;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {serving.serving_description ?? "Serving"}
      </Text>

      <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
        {formatNumber(serving.calories)} kcal - P{" "}
        {formatNumber(serving.protein)}g - C{" "}
        {formatNumber(serving.carbohydrate)}g - F{" "}
        {formatNumber(serving.fat)}g
      </Text>
    </View>
  );
}

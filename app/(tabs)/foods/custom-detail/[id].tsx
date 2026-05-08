import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp, Pencil, Save, X } from "lucide-react-native";
import { ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

type FoodNutrient = {
  amount: number;
  nutrients: {
    key: string;
    name: string;
    unit: string;
    sort_order: number;
  } | null;
};

type Food = {
  id: string;
  name: string;
  brand: string | null;
  serving_name: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
  created_at: string;
  food_nutrients?: FoodNutrient[];
};

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
};

function formatNumber(value?: number | null) {
  const safeValue = Number(value ?? 0);
  if (safeValue === 0) return "0";
  if (safeValue < 1) return safeValue.toFixed(2);
  if (safeValue < 10) return safeValue.toFixed(1);
  return Math.round(safeValue).toString();
}

function toNumber(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameNumber(a?: number | null, b?: number | null) {
  return Number(a ?? 0) === Number(b ?? 0);
}

export default function CustomFoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
  });

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingName, setServingName] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [servingUnit, setServingUnit] = useState("");

  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [cholesterol, setCholesterol] = useState("");

  function closeAlert() {
    setAlert({
      visible: false,
      title: "",
      message: "",
    });
  }

  function syncFormFromFood(currentFood: Food) {
    setName(currentFood.name ?? "");
    setBrand(currentFood.brand ?? "");
    setServingName(currentFood.serving_name ?? "1 serving");
    setServingSize(String(currentFood.serving_size ?? 100));
    setServingUnit(currentFood.serving_unit ?? "g");

    setCalories(String(currentFood.calories ?? 0));
    setProtein(String(currentFood.protein_g ?? 0));
    setCarbs(String(currentFood.carbs_g ?? 0));
    setFat(String(currentFood.fat_g ?? 0));

    setFiber(String(currentFood.fiber_g ?? 0));
    setSugar(String(currentFood.sugar_g ?? 0));
    setSodium(String(currentFood.sodium_mg ?? 0));
    setCholesterol(String(currentFood.cholesterol_mg ?? 0));
  }

  function cancelEdit() {
    if (!food) return;
    syncFormFromFood(food);
    setEditing(false);
  }

  function hasChanges(updatedFood: {
    name: string;
    brand: string | null;
    serving_name: string | null;
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
  }) {
    if (!food) return false;

    return (
      food.name !== updatedFood.name ||
      (food.brand ?? null) !== updatedFood.brand ||
      (food.serving_name ?? null) !== updatedFood.serving_name ||
      !sameNumber(food.serving_size, updatedFood.serving_size) ||
      food.serving_unit !== updatedFood.serving_unit ||
      !sameNumber(food.calories, updatedFood.calories) ||
      !sameNumber(food.protein_g, updatedFood.protein_g) ||
      !sameNumber(food.carbs_g, updatedFood.carbs_g) ||
      !sameNumber(food.fat_g, updatedFood.fat_g) ||
      !sameNumber(food.fiber_g, updatedFood.fiber_g) ||
      !sameNumber(food.sugar_g, updatedFood.sugar_g) ||
      !sameNumber(food.sodium_mg, updatedFood.sodium_mg) ||
      !sameNumber(food.cholesterol_mg, updatedFood.cholesterol_mg)
    );
  }

  async function updateFoodLogs(updatedFood: {
    name: string;
    brand: string | null;
    serving_name: string | null;
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
  }) {
    if (!food) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: logs, error: logsError } = await supabase
      .from("food_logs")
      .select("id, quantity, serving_size")
      .eq("food_id", food.id)
      .eq("user_id", user.id);

    if (logsError) throw logsError;

    if (!logs || logs.length === 0) return;

    const safeServingSize =
      Number(updatedFood.serving_size) > 0
        ? Number(updatedFood.serving_size)
        : 1;

    await Promise.all(
      logs.map((log) => {
        const quantity = Number(log.quantity ?? 1);
        const loggedServingSize = Number(log.serving_size ?? safeServingSize);
        const multiplier = (quantity * loggedServingSize) / safeServingSize;

        return supabase
          .from("food_logs")
          .update({
            food_name: updatedFood.name,
            food_brand: updatedFood.brand,
            food_source: "custom",

            calories: updatedFood.calories * multiplier,
            protein_g: updatedFood.protein_g * multiplier,
            carbs_g: updatedFood.carbs_g * multiplier,
            fat_g: updatedFood.fat_g * multiplier,
            fiber_g: updatedFood.fiber_g * multiplier,
            sugar_g: updatedFood.sugar_g * multiplier,
            sodium_mg: updatedFood.sodium_mg * multiplier,
            cholesterol_mg: updatedFood.cholesterol_mg * multiplier,

            updated_at: new Date().toISOString(),
          })
          .eq("id", log.id)
          .eq("user_id", user.id);
      }),
    );
  }

  async function loadFood() {
    if (!id) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("foods")
      .select(
        `
        *,
        food_nutrients (
          amount,
          nutrients (
            key,
            name,
            unit,
            sort_order
          )
        )
      `,
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("source", "custom")
      .single();

    if (error) {
      setLoading(false);
      return;
    }

    const loadedFood = data as Food;

    setFood(loadedFood);
    syncFormFromFood(loadedFood);

    setLoading(false);
  }

  async function saveFood() {
    if (!food || saving) return;

    try {
      setSaving(true);

      const updatedFood = {
        name: name.trim(),
        brand: brand.trim() || null,
        serving_name: servingName.trim() || null,
        serving_size: toNumber(servingSize),
        serving_unit: servingUnit.trim() || "g",

        calories: toNumber(calories),
        protein_g: toNumber(protein),
        carbs_g: toNumber(carbs),
        fat_g: toNumber(fat),

        fiber_g: toNumber(fiber),
        sugar_g: toNumber(sugar),
        sodium_mg: toNumber(sodium),
        cholesterol_mg: toNumber(cholesterol),
      };

      if (!hasChanges(updatedFood)) {
        setAlert({
          visible: true,
          title: "No Changes Found",
          message: "You did not make any changes to this food.",
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("foods")
        .update(updatedFood)
        .eq("id", food.id);

      if (error) throw error;

      await updateFoodLogs(updatedFood);

      setFood({
        ...food,
        ...updatedFood,
      });

      setEditing(false);

      setAlert({
        visible: true,
        title: "Food Updated",
        message:
          "Your custom food was updated. Existing food logs using this food were also updated.",
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadFood();
  }, [id]);

  const sortedNutrients =
    food?.food_nutrients
      ?.filter((item) => item.nutrients)
      .sort(
        (a, b) =>
          (a.nutrients?.sort_order ?? 999) - (b.nutrients?.sort_order ?? 999),
      ) ?? [];

  if (loading) {
    return (
      <>
        <DetailHeader
          theme={theme}
          router={router}
          screenWidth={screenWidth}
          title="Food Details"
          editing={false}
          saving={false}
          onEditPress={() => {}}
          onCancelEdit={() => {}}
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
        <DetailHeader
          theme={theme}
          router={router}
          screenWidth={screenWidth}
          title="Food Details"
          editing={false}
          saving={false}
          onEditPress={() => {}}
          onCancelEdit={() => {}}
        />

        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            padding: 24,
          }}
        >
          <Text style={{ color: theme.colors.text }}>Food not found.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <DetailHeader
        theme={theme}
        router={router}
        screenWidth={screenWidth}
        title={food.name}
        editing={editing}
        saving={saving}
        onCancelEdit={cancelEdit}
        onEditPress={() => {
          if (editing) {
            saveFood();
          } else {
            setEditing(true);
          }
        }}
      />

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
        }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            padding: 20,
            borderRadius: 24,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          {editing ? (
            <>
              <EditInput
                label="Food name"
                value={name}
                onChangeText={setName}
                theme={theme}
              />

              <EditInput
                label="Brand"
                value={brand}
                onChangeText={setBrand}
                theme={theme}
                placeholder="Optional"
              />

              <EditInput
                label="Serving name"
                value={servingName}
                onChangeText={setServingName}
                theme={theme}
                placeholder="e.g. 1 serving"
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <EditInput
                  label="Serving size"
                  value={servingSize}
                  onChangeText={setServingSize}
                  theme={theme}
                  keyboardType="decimal-pad"
                />

                <EditInput
                  label="Unit"
                  value={servingUnit}
                  onChangeText={setServingUnit}
                  theme={theme}
                  placeholder="g"
                />
              </View>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {food.name}
              </Text>

              {!!food.brand && (
                <Text
                  style={{
                    marginTop: 6,
                    color: theme.colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {food.brand}
                </Text>
              )}

              {!!food.serving_name && (
                <Text
                  style={{
                    marginTop: 10,
                    color: theme.colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {food.serving_name}
                </Text>
              )}

              <Text
                style={{
                  marginTop: 14,
                  color: theme.colors.textFaint,
                  fontWeight: "800",
                }}
              >
                Serving: {food.serving_size} {food.serving_unit}
              </Text>
            </>
          )}
        </View>

        <MacroDistributionChart food={food} theme={theme} />

        <NutritionCard title="Macros" theme={theme}>
          <NutritionRow
            label="Calories"
            value={editing ? calories : food.calories}
            unit="kcal"
            editing={editing}
            onChangeText={setCalories}
            keyboardType="decimal-pad"
            theme={theme}
          />

          <NutritionRow
            label="Protein"
            value={editing ? protein : food.protein_g}
            unit="g"
            editing={editing}
            onChangeText={setProtein}
            keyboardType="decimal-pad"
            theme={theme}
          />

          <NutritionRow
            label="Carbs"
            value={editing ? carbs : food.carbs_g}
            unit="g"
            editing={editing}
            onChangeText={setCarbs}
            keyboardType="decimal-pad"
            theme={theme}
          />

          <NutritionRow
            label="Fat"
            value={editing ? fat : food.fat_g}
            unit="g"
            editing={editing}
            onChangeText={setFat}
            keyboardType="decimal-pad"
            theme={theme}
          />
        </NutritionCard>

        <Pressable
          onPress={() => setShowFullNutrition((prev) => !prev)}
          style={{
            marginTop: 18,
            height: 54,
            borderRadius: 18,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
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
              fontWeight: "900",
            }}
          >
            {showFullNutrition ? "Hide Full Nutrition" : "Show Full Nutrition"}
          </Text>
        </Pressable>

        {showFullNutrition && (
          <>
            <NutritionCard title="Extra Nutrition" theme={theme}>
              <NutritionRow
                label="Fiber"
                value={editing ? fiber : food.fiber_g}
                unit="g"
                editing={editing}
                onChangeText={setFiber}
                keyboardType="decimal-pad"
                theme={theme}
              />

              <NutritionRow
                label="Sugar"
                value={editing ? sugar : food.sugar_g}
                unit="g"
                editing={editing}
                onChangeText={setSugar}
                keyboardType="decimal-pad"
                theme={theme}
              />

              <NutritionRow
                label="Sodium"
                value={editing ? sodium : food.sodium_mg}
                unit="mg"
                editing={editing}
                onChangeText={setSodium}
                keyboardType="decimal-pad"
                theme={theme}
              />

              <NutritionRow
                label="Cholesterol"
                value={editing ? cholesterol : food.cholesterol_mg}
                unit="mg"
                editing={editing}
                onChangeText={setCholesterol}
                keyboardType="decimal-pad"
                theme={theme}
              />
            </NutritionCard>

            {sortedNutrients.length > 0 && (
              <NutritionCard title="Micronutrients" theme={theme}>
                {sortedNutrients.map((item) => (
                  <NutritionStaticRow
                    key={item.nutrients?.key}
                    label={item.nutrients?.name ?? "Nutrient"}
                    value={item.amount}
                    unit={item.nutrients?.unit ?? ""}
                    theme={theme}
                  />
                ))}
              </NutritionCard>
            )}
          </>
        )}
      </ScrollView>

      <ThemedAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        confirmText="OK"
        onClose={closeAlert}
      />
    </>
  );
}

function DetailHeader({
  theme,
  router,
  screenWidth,
  editing,
  saving,
  onEditPress,
  onCancelEdit,
}: {
  theme: ReturnType<typeof useTheme>;
  router: ReturnType<typeof useRouter>;
  screenWidth: number;
  title: string;
  editing: boolean;
  saving: boolean;
  onEditPress: () => void;
  onCancelEdit: () => void;
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
              onPress={() => {
                if (editing) {
                  onCancelEdit();
                } else {
                  router.back();
                }
              }}
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
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 18,
              }}
            />

            {editing && (
              <Pressable
                onPress={onCancelEdit}
                disabled={saving}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: theme.colors.danger ?? "#ef4444",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} color={theme.colors.textInverse} />
              </Pressable>
            )}

            <Pressable
              onPress={onEditPress}
              disabled={saving}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: editing
                  ? theme.colors.primary
                  : theme.colors.background,
                borderWidth: editing ? 0 : 1,
                borderColor: theme.colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {editing ? (
                <Save size={21} color={theme.colors.textInverse} />
              ) : (
                <Pencil size={20} color={theme.colors.text} />
              )}
            </Pressable>
          </View>
        ),
        headerRight: () => null,
      }}
    />
  );
}

function MacroDistributionChart({
  food,
  theme,
}: {
  food: Food;
  theme: ReturnType<typeof useTheme>;
}) {
  const proteinG = Number(food.protein_g ?? 0);
  const carbsG = Number(food.carbs_g ?? 0);
  const fatG = Number(food.fat_g ?? 0);

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
            {formatNumber(food.calories)}
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
  children: ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          marginBottom: 14,
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
  editing,
  onChangeText,
  keyboardType,
  theme,
}: {
  label: string;
  value?: number | string | null;
  unit: string;
  editing: boolean;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>
        {label}
      </Text>

      {editing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TextInput
            value={String(value ?? "")}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            style={{
              minWidth: 72,
              height: 38,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontWeight: "900",
              textAlign: "right",
              paddingHorizontal: 10,
            }}
          />

          <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>
            {unit}
          </Text>
        </View>
      ) : (
        <Text style={{ fontWeight: "900", color: theme.colors.text }}>
          {formatNumber(Number(value ?? 0))} {unit}
        </Text>
      )}
    </View>
  );
}

function NutritionStaticRow({
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
        paddingVertical: 10,
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
          fontWeight: "700",
          flex: 1,
        }}
      >
        {label}
      </Text>

      <Text style={{ fontWeight: "900", color: theme.colors.text }}>
        {formatNumber(value)} {unit}
      </Text>
    </View>
  );
}

function EditInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flex: 1, marginBottom: 14 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          marginBottom: 8,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType={keyboardType}
        style={{
          minHeight: 48,
          backgroundColor: theme.colors.background,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 16,
          paddingHorizontal: 14,
          color: theme.colors.text,
          fontSize: 15,
          fontWeight: "700",
        }}
      />
    </View>
  );
}

function ThemedAlert({
  visible,
  title,
  message,
  confirmText = "OK",
  cancelText,
  danger = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />

      <View
        style={{
          width: "88%",
          backgroundColor: theme.colors.surface,
          borderRadius: 28,
          padding: 22,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 24,
            fontWeight: "900",
            marginBottom: 12,
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {message}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 24,
          }}
        >
          {cancelText ? (
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                {cancelText}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                onClose();
              }
            }}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 18,
              backgroundColor: danger
                ? (theme.colors.danger ?? "#ef4444")
                : theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.background,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {confirmText}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

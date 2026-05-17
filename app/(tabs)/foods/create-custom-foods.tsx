import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useRouter } from "expo-router";
import { Save, X } from "lucide-react-native";
import { useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

const SERVING_UNITS = ["g", "ml", "serving", "piece", "cup", "tbsp", "tsp"];

type NutrientInput = {
  key: string;
  amount: number;
};

export default function CreateCustomFoodScreen() {
  const router = useRouter();
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  const [servingName, setServingName] = useState("1 serving");
  const [servingSize, setServingSize] = useState("100");
  const [servingUnit, setServingUnit] = useState("g");

  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [cholesterol, setCholesterol] = useState("");

  const [potassium, setPotassium] = useState("");
  const [calcium, setCalcium] = useState("");
  const [iron, setIron] = useState("");
  const [magnesium, setMagnesium] = useState("");
  const [zinc, setZinc] = useState("");

  const [vitaminA, setVitaminA] = useState("");
  const [vitaminC, setVitaminC] = useState("");
  const [vitaminD, setVitaminD] = useState("");
  const [vitaminB12, setVitaminB12] = useState("");

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  function toNumber(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return 0;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function saveFood() {
    if (!name.trim()) {
      showAlert("Missing name", "Please enter a food name.");
      return;
    }

    if (!servingName.trim()) {
      showAlert("Missing serving name", "Please enter serving name.");
      return;
    }

    if (!servingSize.trim() || Number(servingSize) <= 0) {
      showAlert("Invalid serving size", "Serving size must be greater than 0.");
      return;
    }

    if (!calories.trim()) {
      showAlert("Missing calories", "Please enter calories.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showAlert("Not signed in", "Please sign in first.");
        return;
      }

      const { data: insertedFood, error: foodError } = await supabase
        .from("foods")
        .insert({
          user_id: user.id,
          source: "custom",

          name: name.trim(),
          brand: brand.trim() || null,

          serving_name: servingName.trim(),
          serving_size: toNumber(servingSize),
          serving_unit: servingUnit,

          calories: toNumber(calories),
          protein_g: toNumber(protein),
          carbs_g: toNumber(carbs),
          fat_g: toNumber(fat),

          fiber_g: toNumber(fiber),
          sugar_g: toNumber(sugar),
          sodium_mg: toNumber(sodium),
          cholesterol_mg: toNumber(cholesterol),
        })
        .select("id")
        .single();

      if (foodError) throw foodError;

      const nutrientInputs: NutrientInput[] = [
        { key: "potassium_mg", amount: toNumber(potassium) },
        { key: "calcium_mg", amount: toNumber(calcium) },
        { key: "iron_mg", amount: toNumber(iron) },
        { key: "magnesium_mg", amount: toNumber(magnesium) },
        { key: "zinc_mg", amount: toNumber(zinc) },
        { key: "vitamin_a_mcg", amount: toNumber(vitaminA) },
        { key: "vitamin_c_mg", amount: toNumber(vitaminC) },
        { key: "vitamin_d_mcg", amount: toNumber(vitaminD) },
        { key: "vitamin_b12_mcg", amount: toNumber(vitaminB12) },
      ].filter((item) => item.amount > 0);

      if (nutrientInputs.length > 0) {
        const nutrientKeys = nutrientInputs.map((item) => item.key);

        const { data: nutrientsData, error: nutrientsError } = await supabase
          .from("nutrients")
          .select("id, key")
          .in("key", nutrientKeys);

        if (nutrientsError) throw nutrientsError;

        const nutrientRows = nutrientInputs
          .map((input) => {
            const nutrient = nutrientsData?.find(
              (item) => item.key === input.key,
            );

            if (!nutrient) return null;

            return {
              food_id: insertedFood.id,
              nutrient_id: nutrient.id,
              amount: input.amount,
            };
          })
          .filter(
            (
              row,
            ): row is {
              food_id: string;
              nutrient_id: string;
              amount: number;
            } => row !== null,
          );

        if (nutrientRows.length > 0) {
          const { error: foodNutrientsError } = await supabase
            .from("food_nutrients")
            .insert(nutrientRows);

          if (foodNutrientsError) throw foodNutrientsError;
        }
      }

      showAlert("Food created", "Custom food has been added.");

      setTimeout(() => {
        router.dismissTo({
          pathname: "/foods" as any,
          params: { refresh: Date.now().toString() },
        });
      }, 700);
    } catch (error: any) {
      showAlert("Error", error.message ?? "Failed to create food.");
    } finally {
      setSaving(false);
    }
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
                  justifyContent: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 18,
                  marginLeft: 25,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 20,
                    fontWeight: "900",
                    color: theme.colors.text,
                  }}
                >
                  Create Custom Food
                </Text>
              </View>
            </View>
          ),
          headerRight: () => null,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ThemedAlert
          visible={alertOpen}
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertOpen(false)}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section title="Food Details" theme={theme}>
            <Input
              theme={theme}
              label="Food name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken Breast Cooked"
            />

            <Input
              theme={theme}
              label="Brand optional"
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Magnolia"
            />
          </Section>

          <Section title="Serving Size" theme={theme}>
            <Input
              theme={theme}
              label="Serving name"
              value={servingName}
              onChangeText={setServingName}
              placeholder="e.g. 1 serving"
            />

            <Input
              theme={theme}
              label="Serving size"
              value={servingSize}
              onChangeText={setServingSize}
              keyboardType="decimal-pad"
              placeholder="100"
            />

            <Text
              style={{
                color: theme.colors.text,
                fontWeight: "800",
                marginBottom: 10,
              }}
            >
              Serving unit
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SERVING_UNITS.map((unit) => {
                const selected = servingUnit === unit;

                return (
                  <Pressable
                    key={unit}
                    onPress={() => setServingUnit(unit)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.border,
                      backgroundColor: selected
                        ? theme.colors.primary
                        : theme.colors.background,
                    }}
                  >
                    <Text
                      style={{
                        color: selected
                          ? theme.colors.textInverse
                          : theme.colors.textMuted,
                        fontWeight: "900",
                      }}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title="Macros" theme={theme}>
            <Row>
              <Input
                theme={theme}
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Protein g"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
              />
            </Row>

            <Row>
              <Input
                theme={theme}
                label="Carbs g"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Fat g"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
              />
            </Row>
          </Section>

          <Section title="Extra Nutrition" theme={theme}>
            <Row>
              <Input
                theme={theme}
                label="Fiber g"
                value={fiber}
                onChangeText={setFiber}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Sugar g"
                value={sugar}
                onChangeText={setSugar}
                keyboardType="decimal-pad"
              />
            </Row>

            <Row>
              <Input
                theme={theme}
                label="Sodium mg"
                value={sodium}
                onChangeText={setSodium}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Cholesterol mg"
                value={cholesterol}
                onChangeText={setCholesterol}
                keyboardType="decimal-pad"
              />
            </Row>
          </Section>

          <Section title="Micronutrients" theme={theme}>
            <Row>
              <Input
                theme={theme}
                label="Potassium mg"
                value={potassium}
                onChangeText={setPotassium}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Calcium mg"
                value={calcium}
                onChangeText={setCalcium}
                keyboardType="decimal-pad"
              />
            </Row>

            <Row>
              <Input
                theme={theme}
                label="Iron mg"
                value={iron}
                onChangeText={setIron}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Magnesium mg"
                value={magnesium}
                onChangeText={setMagnesium}
                keyboardType="decimal-pad"
              />
            </Row>

            <Input
              theme={theme}
              label="Zinc mg"
              value={zinc}
              onChangeText={setZinc}
              keyboardType="decimal-pad"
            />
          </Section>

          <Section title="Vitamins" theme={theme}>
            <Row>
              <Input
                theme={theme}
                label="Vitamin A mcg"
                value={vitaminA}
                onChangeText={setVitaminA}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Vitamin C mg"
                value={vitaminC}
                onChangeText={setVitaminC}
                keyboardType="decimal-pad"
              />
            </Row>

            <Row>
              <Input
                theme={theme}
                label="Vitamin D mcg"
                value={vitaminD}
                onChangeText={setVitaminD}
                keyboardType="decimal-pad"
              />
              <Input
                theme={theme}
                label="Vitamin B12 mcg"
                value={vitaminB12}
                onChangeText={setVitaminB12}
                keyboardType="decimal-pad"
              />
            </Row>
          </Section>

          <Pressable
            onPress={saveFood}
            disabled={saving}
            style={{
              marginTop: 4,
              borderRadius: 18,
              paddingVertical: 16,
              backgroundColor: saving
                ? theme.colors.textMuted
                : theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={18} color={theme.colors.textInverse} />

            <Text
              style={{
                color: theme.colors.textInverse,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {saving ? "Saving..." : "Save Custom Food"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Section({
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
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 22,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: "900",
          marginBottom: 14,
        }}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;
}

function Input({
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

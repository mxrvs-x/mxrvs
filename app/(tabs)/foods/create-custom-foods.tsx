import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

const SERVING_UNITS = ["g", "ml", "serving", "piece", "cup", "tbsp", "tsp"];

export default function CreateCustomFoodScreen() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingName, setservingName] = useState("");

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

  function toNumber(value: string) {
    if (!value.trim()) return 0;
    return Number(value);
  }

  async function saveFood() {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a food name.");
      return;
    }

    if (!servingSize.trim() || Number(servingSize) <= 0) {
      Alert.alert(
        "Invalid serving size",
        "Serving size must be greater than 0.",
      );
      return;
    }

    if (!calories.trim()) {
      Alert.alert("Missing calories", "Please enter calories.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Not signed in", "Please sign in first.");
        return;
      }

      const { error } = await supabase.from("foods").insert({
        user_id: user.id,
        source: "custom",

        name: name.trim(),
        brand: brand.trim() || null,
        serving_name: servingName.trim() || null,

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

        potassium_mg: toNumber(potassium),
        calcium_mg: toNumber(calcium),
        iron_mg: toNumber(iron),
        magnesium_mg: toNumber(magnesium),
        zinc_mg: toNumber(zinc),

        vitamin_a_mcg: toNumber(vitaminA),
        vitamin_c_mg: toNumber(vitaminC),
        vitamin_d_mcg: toNumber(vitaminD),
        vitamin_b12_mcg: toNumber(vitaminB12),
      });

      if (error) throw error;

      Alert.alert("Food created", "Custom food has been added.");
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message ?? "Failed to create food.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-white text-2xl font-bold mb-1">
          Create Custom Food
        </Text>

        <Text className="text-zinc-400 mb-5">
          Add your own food with editable serving size and nutrition values.
        </Text>

        <Section title="Food Details">
          <Input
            label="Food name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken Breast Cooked"
          />
          <Input
            label="Brand optional"
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Magnolia"
          />
          <Input
            label="Serving Name optional"
            value={servingName}
            onChangeText={setservingName}
            placeholder="Notes, cooked/raw, etc."
          />
        </Section>

        <Section title="Serving Size">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Serving size"
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="decimal-pad"
                placeholder="100"
              />
            </View>
          </View>

          <Text className="text-zinc-300 mb-2">Serving unit</Text>

          <View className="flex-row flex-wrap gap-2">
            {SERVING_UNITS.map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setServingUnit(unit)}
                className={`px-4 py-2 rounded-full border ${
                  servingUnit === unit
                    ? "bg-white border-white"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              >
                <Text
                  className={
                    servingUnit === unit
                      ? "text-black font-semibold"
                      : "text-zinc-300"
                  }
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Macros">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Protein g"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Carbs g"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Fat g"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Section>

        <Section title="Extra Nutrition">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Fiber g"
                value={fiber}
                onChangeText={setFiber}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Sugar g"
                value={sugar}
                onChangeText={setSugar}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Sodium mg"
                value={sodium}
                onChangeText={setSodium}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Cholesterol mg"
                value={cholesterol}
                onChangeText={setCholesterol}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Section>

        <Section title="Micronutrients">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Potassium mg"
                value={potassium}
                onChangeText={setPotassium}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Calcium mg"
                value={calcium}
                onChangeText={setCalcium}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Iron mg"
                value={iron}
                onChangeText={setIron}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Magnesium mg"
                value={magnesium}
                onChangeText={setMagnesium}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Input
            label="Zinc mg"
            value={zinc}
            onChangeText={setZinc}
            keyboardType="decimal-pad"
          />
        </Section>

        <Section title="Vitamins">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Vitamin A mcg"
                value={vitaminA}
                onChangeText={setVitaminA}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Vitamin C mg"
                value={vitaminC}
                onChangeText={setVitaminC}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Vitamin D mcg"
                value={vitaminD}
                onChangeText={setVitaminD}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Vitamin B12 mcg"
                value={vitaminB12}
                onChangeText={setVitaminB12}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Section>

        <Pressable
          onPress={saveFood}
          disabled={saving}
          className={`mt-4 rounded-2xl py-4 items-center ${
            saving ? "bg-zinc-700" : "bg-white"
          }`}
        >
          <Text className="text-black font-bold text-base">
            {saving ? "Saving..." : "Save Custom Food"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4">
      <Text className="text-white text-lg font-bold mb-4">{title}</Text>
      {children}
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="text-zinc-300 mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        keyboardType={keyboardType}
        className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white"
      />
    </View>
  );
}

import { Modal, Pressable, ScrollView, Text, View } from "react-native";

export type NutritionTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  potassium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  zinc_mg: number;
};

export default function FullNutritionDetails({
  visible,
  onClose,
  totals,
}: {
  visible: boolean;
  onClose: () => void;
  totals: NutritionTotals;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />

        <View
          style={{
            width: "100%",
            maxWidth: 420,
            maxHeight: "75%",
            backgroundColor: "#fff",
            borderRadius: 24,
            overflow: "hidden",
            elevation: 12,
            zIndex: 10,
          }}
        >
          <View
            style={{
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900" }}>
              Full Nutrition
            </Text>

            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 16, fontWeight: "900" }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              padding: 20,
              paddingBottom: 20,
            }}
            showsVerticalScrollIndicator
          >
            <SectionTitle title="Calories & Macros" />

            <NutrientRow
              label="Calories"
              value={`${Math.round(totals.calories)} kcal`}
            />
            <NutrientRow
              label="Protein"
              value={`${Math.round(totals.protein_g)} g`}
            />
            <NutrientRow
              label="Carbs"
              value={`${Math.round(totals.carbs_g)} g`}
            />
            <NutrientRow label="Fat" value={`${Math.round(totals.fat_g)} g`} />

            <SectionTitle title="Nutrition Details" />

            <NutrientRow
              label="Fiber"
              value={`${Math.round(totals.fiber_g)} g`}
            />
            <NutrientRow
              label="Sugar"
              value={`${Math.round(totals.sugar_g)} g`}
            />
            <NutrientRow
              label="Sodium"
              value={`${Math.round(totals.sodium_mg)} mg`}
            />
            <NutrientRow
              label="Cholesterol"
              value={`${Math.round(totals.cholesterol_mg)} mg`}
            />

            <SectionTitle title="Micronutrients" />

            <NutrientRow
              label="Potassium"
              value={`${Math.round(totals.potassium_mg)} mg`}
            />
            <NutrientRow
              label="Calcium"
              value={`${Math.round(totals.calcium_mg)} mg`}
            />
            <NutrientRow
              label="Iron"
              value={`${totals.iron_mg.toFixed(1)} mg`}
            />
            <NutrientRow
              label="Magnesium"
              value={`${Math.round(totals.magnesium_mg)} mg`}
            />
            <NutrientRow
              label="Zinc"
              value={`${totals.zinc_mg.toFixed(1)} mg`}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        color: "#888",
        fontWeight: "900",
        marginTop: 16,
        marginBottom: 8,
        textTransform: "uppercase",
      }}
    >
      {title}
    </Text>
  );
}

function NutrientRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
      }}
    >
      <Text style={{ color: "#555", fontSize: 16 }}>{label}</Text>
      <Text style={{ fontWeight: "900", fontSize: 16 }}>{value}</Text>
    </View>
  );
}

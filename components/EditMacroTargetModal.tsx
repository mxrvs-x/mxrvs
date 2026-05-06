import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

type Goal = "cut" | "maintain" | "bulk";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type MacroTargetForm = {
  date: string;
  weight_kg: string;
  height_cm: string;
  goal: Goal;
  activity_level: ActivityLevel;
  calories_target: string;
  protein_target_g: string;
  carbs_target_g: string;
  fat_target_g: string;
};

type Props = {
  visible: boolean;
  saving: boolean;
  initialTarget: MacroTargetForm;
  onClose: () => void;
  onSave: (form: MacroTargetForm) => void | Promise<void>;
};

export default function EditMacroTargetModal({
  visible,
  saving,
  initialTarget,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<MacroTargetForm>(initialTarget);

  useEffect(() => {
    if (visible) {
      setForm(initialTarget);
    }
  }, [visible, initialTarget]);

  function updateField<K extends keyof MacroTargetForm>(
    key: K,
    value: MacroTargetForm[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            maxHeight: "88%",
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>
            Edit Targets
          </Text>

          <Text style={{ marginTop: 6, color: "#6B7280", lineHeight: 20 }}>
            Update your goal, body stats, calories, and macros.
          </Text>

          <ScrollView
            style={{ marginTop: 4 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FormInput
              label="Effective Date"
              value={form.date}
              onChangeText={(value) => updateField("date", value)}
              placeholder="YYYY-MM-DD"
            />

            <Text style={{ marginTop: 18, color: "#6B7280", fontSize: 12 }}>
              Goal
            </Text>

            <View style={{ flexDirection: "row", marginTop: 8 }}>
              {(["cut", "maintain", "bulk"] as Goal[]).map((goal) => (
                <OptionButton
                  key={goal}
                  label={goal}
                  selected={form.goal === goal}
                  onPress={() => updateField("goal", goal)}
                />
              ))}
            </View>

            <Text style={{ marginTop: 18, color: "#6B7280", fontSize: 12 }}>
              Activity Level
            </Text>

            <View
              style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}
            >
              {(
                ["sedentary", "light", "moderate", "active"] as ActivityLevel[]
              ).map((level) => (
                <OptionButton
                  key={level}
                  label={level}
                  selected={form.activity_level === level}
                  onPress={() => updateField("activity_level", level)}
                />
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <FormInput
                label="Weight kg"
                value={form.weight_kg}
                onChangeText={(value) => updateField("weight_kg", value)}
                keyboardType="numeric"
              />

              <FormInput
                label="Height cm"
                value={form.height_cm}
                onChangeText={(value) => updateField("height_cm", value)}
                keyboardType="numeric"
              />
            </View>

            <FormInput
              label="Calories Target"
              value={form.calories_target}
              onChangeText={(value) => updateField("calories_target", value)}
              keyboardType="numeric"
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <FormInput
                label="Protein g"
                value={form.protein_target_g}
                onChangeText={(value) => updateField("protein_target_g", value)}
                keyboardType="numeric"
              />

              <FormInput
                label="Carbs g"
                value={form.carbs_target_g}
                onChangeText={(value) => updateField("carbs_target_g", value)}
                keyboardType="numeric"
              />
            </View>

            <FormInput
              label="Fat g"
              value={form.fat_target_g}
              onChangeText={(value) => updateField("fat_target_g", value)}
              keyboardType="numeric"
            />
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: 20 }}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 16,
                backgroundColor: "#F3F4F6",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 10,
              }}
            >
              <Text style={{ color: "#111827", fontWeight: "800" }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onSave(form)}
              disabled={saving}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 16,
                backgroundColor: saving ? "#9CA3AF" : "#111827",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ flex: 1, marginTop: 16 }}>
      <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 8 }}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType || "default"}
        placeholderTextColor="#9CA3AF"
        style={{
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: "#F3F4F6",
          color: "#111827",
          fontSize: 15,
          fontWeight: "700",
        }}
      />
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        height: 38,
        borderRadius: 14,
        backgroundColor: selected ? "#111827" : "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: selected ? "#fff" : "#111827",
          fontSize: 13,
          fontWeight: "800",
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

import { useTheme } from "@/lib/theme";
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
  const theme = useTheme();
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
          backgroundColor:
            theme.mode === "dark"
              ? "rgba(0,0,0,0.65)"
              : "rgba(15,23,42,0.35)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            maxHeight: "88%",
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadow.card,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            Edit Targets
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              lineHeight: 20,
            }}
          >
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

            <Text
              style={{
                marginTop: 18,
                color: theme.colors.textMuted,
                fontSize: 12,
              }}
            >
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

            <Text
              style={{
                marginTop: 18,
                color: theme.colors.textMuted,
                fontSize: 12,
              }}
            >
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
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surfaceAlt,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 10,
                borderWidth: 1,
                borderColor: theme.colors.border,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "800" }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onSave(form)}
              disabled={saving}
              style={{
                flex: 1,
                height: 50,
                borderRadius: theme.radius.lg,
                backgroundColor: saving
                  ? theme.colors.textFaint
                  : theme.colors.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.textInverse} />
              ) : (
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "800",
                  }}
                >
                  Save
                </Text>
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
  const theme = useTheme();

  return (
    <View style={{ flex: 1, marginTop: 16 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType || "default"}
        placeholderTextColor={theme.colors.textFaint}
        style={{
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceAlt,
          color: theme.colors.text,
          fontSize: 15,
          fontWeight: "700",
          borderWidth: 1,
          borderColor: theme.colors.border,
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
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        height: 38,
        borderRadius: theme.radius.lg,
        backgroundColor: selected
          ? theme.colors.primary
          : theme.colors.surfaceAlt,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.textInverse : theme.colors.text,
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

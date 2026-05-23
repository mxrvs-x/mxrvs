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
  type KeyboardTypeOptions,
} from "react-native";

export type BodyWeightLogForm = {
  date: string;
  logged_at: string;
  weight_kg: string;
  body_fat_percent: string;
};

type Props = {
  visible: boolean;
  saving: boolean;
  initialLog: BodyWeightLogForm;
  onClose: () => void;
  onSave: (form: BodyWeightLogForm) => void | Promise<void>;
};

export default function LogBodyWeightModal({
  visible,
  saving,
  initialLog,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const [form, setForm] = useState<BodyWeightLogForm>(initialLog);

  useEffect(() => {
    if (visible) {
      setForm(initialLog);
    }
  }, [visible, initialLog]);

  function updateField<K extends keyof BodyWeightLogForm>(
    key: K,
    value: BodyWeightLogForm[K],
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
            width: "100%",
            maxHeight: "86%",
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
            Log Body Weight
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            Track your daily weight. Each save creates a new timestamped log.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 2 }}
          >
            <FormInput
              label="Weight"
              value={form.weight_kg}
              onChangeText={(value) => updateField("weight_kg", value)}
              keyboardType="decimal-pad"
              suffix="kg"
            />

            <FormInput
              label="Body Fat"
              value={form.body_fat_percent}
              onChangeText={(value) => updateField("body_fat_percent", value)}
              keyboardType="decimal-pad"
              placeholder="Optional"
              suffix="%"
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
                  Save Log
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
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          minHeight: 50,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType || "default"}
          placeholderTextColor={theme.colors.textFaint}
          returnKeyType="done"
          style={{
            flex: 1,
            minHeight: 50,
            paddingLeft: 14,
            paddingRight: suffix ? 8 : 14,
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: "700",
          }}
        />

        {suffix ? (
          <Text
            style={{
              paddingRight: 14,
              color: theme.colors.textMuted,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

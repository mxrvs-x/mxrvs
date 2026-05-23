import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export type HeightForm = {
  height_cm: string;
};

type Props = {
  visible: boolean;
  saving: boolean;
  initialHeight: HeightForm;
  onClose: () => void;
  onSave: (form: HeightForm) => void | Promise<void>;
};

export default function EditHeightModal({
  visible,
  saving,
  initialHeight,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const [form, setForm] = useState<HeightForm>(initialHeight);

  useEffect(() => {
    if (visible) {
      setForm(initialHeight);
    }
  }, [visible, initialHeight]);

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
            Edit Height
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            Height is kept as a stable body stat, separate from daily weight
            logs.
          </Text>

          <Text
            style={{
              marginTop: 16,
              color: theme.colors.textMuted,
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Height
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
              value={form.height_cm}
              onChangeText={(height_cm) => setForm({ height_cm })}
              keyboardType="decimal-pad"
              placeholder="Height"
              placeholderTextColor={theme.colors.textFaint}
              returnKeyType="done"
              style={{
                flex: 1,
                minHeight: 50,
                paddingLeft: 14,
                paddingRight: 8,
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: "700",
              }}
            />

            <Text
              style={{
                paddingRight: 14,
                color: theme.colors.textMuted,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              cm
            </Text>
          </View>

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

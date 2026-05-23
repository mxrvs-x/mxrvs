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

type Props = {
  visible: boolean;
  saving: boolean;
  initialDisplayName: string;
  initialEmail: string;
  onClose: () => void;
  onSave: (data: {
    displayName: string;
    email: string;
    password: string;
  }) => void | Promise<void>;
};

export default function EditProfileModal({
  visible,
  saving,
  initialDisplayName,
  initialEmail,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (visible) {
      setDisplayName(initialDisplayName);
      setEmail(initialEmail);
      setPassword("");
    }
  }, [visible, initialDisplayName, initialEmail]);

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
            Edit Profile
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              lineHeight: 20,
            }}
          >
            Update your display name, email, or password.
          </Text>

          <FormInput
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter display name"
          />

          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="New Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Leave blank to keep current password"
            secureTextEntry
          />

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
              onPress={() =>
                onSave({
                  displayName,
                  email,
                  password,
                })
              }
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

          <Text
            style={{
              marginTop: 12,
              color: theme.colors.textMuted,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            Changing your email may require confirmation from your new email
            address.
          </Text>
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
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
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

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "sentences"}
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

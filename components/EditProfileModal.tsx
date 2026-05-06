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
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>
            Edit Profile
          </Text>

          <Text style={{ marginTop: 6, color: "#6B7280", lineHeight: 20 }}>
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

          <Text
            style={{
              marginTop: 12,
              color: "#6B7280",
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
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 8 }}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "sentences"}
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

import { KeyboardFormScrollView } from "@/components/KeyboardForm";
import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CardioFinishSheet({ children, onClose, saving }: {
  children: ReactNode;
  onClose: () => void;
  saving: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { backgroundColor: theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.35)" }]}>
      <Pressable importantForAccessibility="no" style={StyleSheet.absoluteFill} disabled={saving} onPress={onClose} />
      <KeyboardFormScrollView
        style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={[styles.fields, { paddingBottom: insets.bottom + 20 }]}
      >
        {children}
      </KeyboardFormScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { flexGrow: 0, flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  fields: { paddingHorizontal: 20, paddingTop: 20 },
});

import { KeyboardFormInput as TextInput } from "@/components/KeyboardForm";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useAccountSettings } from "@/lib/useAccountSettings";
import { Pressable, StyleSheet, Text, View, type TextInputProps } from "react-native";

export default function AccountSettings({ email, onEmailChanged }: {
  email: string; onEmailChanged: (email: string) => void;
}) {
  const { colors } = useTheme();
  const account = useAccountSettings(supabase.auth, email, onEmailChanged);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Account</Text>
      {account.mode === "email" && (
        <Field label="New email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          autoComplete="email" editable={!account.busy} value={account.fields.email}
          onChangeText={(value) => account.change("email", value)} />
      )}
      {account.mode === "password" && (
        <>
          <Field label="Current password (if required)" secureTextEntry autoComplete="current-password"
            editable={!account.busy} value={account.fields.currentPassword} onChangeText={(value) => account.change("currentPassword", value)} />
          <Field label="New password" secureTextEntry autoComplete="new-password"
            editable={!account.busy} value={account.fields.password} onChangeText={(value) => account.change("password", value)} />
          <Field label="Confirm new password" secureTextEntry autoComplete="new-password"
            editable={!account.busy} value={account.fields.confirmation} onChangeText={(value) => account.change("confirmation", value)} />
          {account.needsCode && (
            <>
              <Button label="Send verification code" disabled={account.busy} onPress={() => void account.sendCode()} />
              <Field label="Verification code" keyboardType="number-pad" autoComplete="one-time-code"
                editable={!account.busy} value={account.fields.code} onChangeText={(value) => account.change("code", value)} />
            </>
          )}
        </>
      )}
      {account.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{account.error}</Text> : null}
      <View style={styles.actions}>
        {account.mode ? (
          <>
            <Button label={account.busy ? "Working…" : "Save change"} primary disabled={account.busy} onPress={() => void account.submit()} />
            <Button label="Cancel" disabled={account.busy} onPress={() => account.choose(null)} />
          </>
        ) : (
          <>
            <Button label="Change email" onPress={() => account.choose("email")} />
            <Button label="Change password" onPress={() => account.choose("password")} />
          </>
        )}
      </View>
      {account.notice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted }}>{account.notice}</Text> : null}
    </View>
  );
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[styles.input, {
        backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border,
      }]} autoCapitalize="none" autoCorrect={false} {...props} />
    </View>
  );
}

function Button({ label, primary, disabled, onPress }: {
  label: string; primary?: boolean; disabled?: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, { backgroundColor: primary ? colors.primaryFill : colors.surfaceAlt, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={{ fontWeight: "800", color: primary ? colors.textInverse : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: "900" },
  field: { gap: 6 },
  label: { fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 12 },
});

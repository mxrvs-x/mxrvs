// app/index.tsx
import { useTheme } from "@/lib/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Index() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    async function routeUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // ❌ No session → go to auth
      if (!session) {
        router.replace("/auth");
        return;
      }

      // ✅ Check biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // ❌ No biometrics → go straight in
      if (!hasHardware || !isEnrolled) {
        router.replace("/(tabs)/home" as any);
        return;
      }

      // ✅ Ask for fingerprint
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock mxrvs",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
      });

      if (result.success) {
        router.replace("/(tabs)/home" as any);
      } else {
        // ❗ DO NOT sign out here
        // Just send back to auth so user can retry
        router.replace("/auth");
      }
    }

    routeUser();
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />

      <Text
        style={{
          marginTop: 12,
          color: theme.colors.textMuted,
          fontSize: theme.fontSize.sm,
          fontWeight: "600",
        }}
      >
        Loading mxrvs...
      </Text>
    </View>
  );
}
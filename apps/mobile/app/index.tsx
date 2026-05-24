// app/index.tsx
import { useTheme } from "@/lib/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { cacheOfflineCardioUserId } from "../lib/offlineCardio";
import { cacheOfflineUser } from "../lib/offlineUser";
import { supabase, supabaseConfigError } from "../lib/supabase";

export default function Index() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    async function routeUser() {
      try {
        if (supabaseConfigError) {
          router.replace("/auth");
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/auth");
          return;
        }

        await cacheOfflineCardioUserId(session.user.id);
        await cacheOfflineUser(session.user);

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          router.replace("/(tabs)/workouts" as any);
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock mxrvs",
          fallbackLabel: "Use passcode",
          cancelLabel: "Cancel",
        });

        if (result.success) {
          router.replace("/(tabs)/workouts" as any);
        } else {
          router.replace("/auth");
        }
      } catch (error) {
        console.error("Failed to route user", error);
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

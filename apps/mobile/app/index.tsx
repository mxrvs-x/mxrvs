// app/index.tsx
import { useTheme } from "@/lib/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { resolveInitialAuthRoute } from "../lib/authRecovery";
import { cacheOfflineCardioUserId } from "../lib/offlineCardio";
import { cacheOfflineUser } from "../lib/offlineUser";
import { supabase, supabaseConfigError } from "../lib/supabase";

export default function Index() {
  const router = useRouter();
  const { sleepWidget } = useLocalSearchParams<{ sleepWidget?: string }>();
  const theme = useTheme();

  useEffect(() => {
    async function routeUser() {
      const route = await resolveInitialAuthRoute({
        configError: supabaseConfigError,
        getSession: async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          return session;
        },
        cacheSessionUser: async (user) => {
          await cacheOfflineCardioUserId(user.id);
          await cacheOfflineUser(user);
        },
        hasHardware: LocalAuthentication.hasHardwareAsync,
        isEnrolled: LocalAuthentication.isEnrolledAsync,
        authenticate: () =>
          LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock mxrvs",
          fallbackLabel: "Use passcode",
          cancelLabel: "Cancel",
          }),
        onError: (error) => console.error("Failed to route user", error),
      });

      router.replace(sleepWidget === "1"
        ? route === "/auth"
          ? { pathname: "/auth", params: { sleepWidget: "1" } }
          : { pathname: "/(tabs)/sleep", params: { review: "widget" } }
        : route);
    }

    routeUser();
  }, [router, sleepWidget]);

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

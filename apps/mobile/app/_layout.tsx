import AppUpdateGate from "@/components/AppUpdateGate";
import CreatineReminderGate from "@/components/CreatineReminderGate";
import DailyActivityGate from "@/components/DailyActivityGate";
import OfflineSyncGate from "@/components/OfflineSyncGate";
import PostLoginPermissionGate from "@/components/PostLoginPermissionGate";
import WeightReminderGate from "@/components/WeightReminderGate";
import "@/lib/backgroundCardioLocation";
import { setSleepWidgetOwner } from "@/lib/sleepRecordingStorage";
import { supabase } from "@/lib/supabase";
import { AppThemeProvider, useTheme } from "@/lib/theme";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

function RootStack() {
  const theme = useTheme();
  const navigationTheme = useMemo(() => {
    const base = theme.mode === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [theme]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSleepWidgetOwner(session?.user.id ?? null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <AppUpdateGate />
      <OfflineSyncGate />
      <PostLoginPermissionGate />
      <DailyActivityGate />
      <CreatineReminderGate />
      <WeightReminderGate />
      <ThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.colors.background,
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <RootStack />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

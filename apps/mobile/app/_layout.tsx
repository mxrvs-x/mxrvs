import AppUpdateGate from "@/components/AppUpdateGate";
import CreatineReminderGate from "@/components/CreatineReminderGate";
import { AppThemeProvider, useTheme } from "@/lib/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <AppUpdateGate />
      <CreatineReminderGate />

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

        {/* ✅ IMPORTANT: use drawer instead of tabs */}
        <Stack.Screen name="(tabs)" />
      </Stack>
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

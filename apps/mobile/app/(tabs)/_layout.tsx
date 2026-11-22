import { useTheme } from "@/lib/theme";
import { Tabs } from "expo-router";
import { Activity, Dumbbell, FlaskConical, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          height: 64 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          elevation: 12,
          shadowColor: "#000000",
          shadowOpacity: theme.mode === "dark" ? 0.3 : 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
        tabBarItemStyle: {
          borderRadius: 16,
        },
      }}
    >
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cardio"
        options={{
          title: "Cardio",
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="creatine"
        options={{
          title: "Creatine",
          tabBarIcon: ({ color, size }) => (
            <FlaskConical color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="weight-reports"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="creatine-history"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

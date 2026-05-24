import { useTheme } from "@/lib/theme";
import { Tabs } from "expo-router";
import { Activity, Dumbbell, FlaskConical, UserRound } from "lucide-react-native";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
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
    </Tabs>
  );
}

import { useTheme } from "@/lib/theme";
import { Tabs } from "expo-router";
import {
  Activity,
  SaladIcon,
  ListTodo,
  Dumbbell,
  LayoutDashboard,
} from "lucide-react-native";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 👈 IMPORTANT (Drawer handles header)

        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="diary"
        options={{
          title: "Logs",
          tabBarIcon: ({ color, size }) => (
            <ListTodo color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="foods"
        options={{
          title: "Foods",
          tabBarIcon: ({ color, size }) => (
            <SaladIcon color={color} size={size} />
          ),
        }}
      />

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
    </Tabs>
  );
}

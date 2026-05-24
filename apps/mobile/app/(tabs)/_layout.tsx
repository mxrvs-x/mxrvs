import { useTheme } from "@/lib/theme";
import NetInfo from "@react-native-community/netinfo";
import { Tabs, usePathname, useRouter } from "expo-router";
import {
  Activity,
  SaladIcon,
  ListTodo,
  Dumbbell,
  LayoutDashboard,
} from "lucide-react-native";
import { useEffect, useState } from "react";

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected || state.isInternetReachable === false);
    });

    return () => subscription();
  }, []);

  useEffect(() => {
    if (offline && !pathname.startsWith("/cardio")) {
      router.replace("/(tabs)/cardio" as any);
    }
  }, [offline, pathname, router]);

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
          href: offline ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="diary"
        options={{
          title: "Logs",
          href: offline ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <ListTodo color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="foods"
        options={{
          title: "Foods",
          href: offline ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <SaladIcon color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          href: offline ? null : undefined,
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

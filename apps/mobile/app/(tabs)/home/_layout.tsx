import { useTheme } from "@/lib/theme";

import { Drawer } from "expo-router/drawer";
import { Astroid, ChartNoAxesCombined, Home, User2 } from "lucide-react-native";

export default function HomeDrawerLayout() {
  const theme = useTheme();

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerTitle: "mxrvs",
        headerTintColor: theme.colors.text,

        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: "900",
        },

        drawerStyle: {
          backgroundColor: theme.colors.surface,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Home",
          drawerIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Drawer.Screen
        name="profile"
        options={{
          title: "Profile",
          drawerIcon: ({ color, size }) => <User2 color={color} size={size} />,
        }}
      />

      <Drawer.Screen
        name="reports"
        options={{
          title: "Reports",
          drawerIcon: ({ color, size }) => (
            <ChartNoAxesCombined color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name="body-weight-report"
        options={{
          title: "Body Weight Report",
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name="gemini-nutrition"
        options={{
          title: "Macro Intelligence",
          drawerIcon: ({ color, size }) => (
            <Astroid color={color} size={size} />
          ),
        }}
      />
    </Drawer>
  );
}

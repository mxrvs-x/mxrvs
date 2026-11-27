import { useTheme } from "@/lib/theme";
import { Tabs } from "expo-router";
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "expo-router/js-tabs";
import { Activity, Dumbbell, FlaskConical, Menu, Moon, UserRound, Utensils, X } from "lucide-react-native";
import { useContext, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const mainTabs = [
  { name: "workouts", label: "Workouts", Icon: Dumbbell },
  { name: "cardio", label: "Cardio", Icon: Activity },
  { name: "macros", label: "Macros", Icon: Utensils },
] as const;

const drawerTabs = [
  { name: "sleep", history: null, label: "Sleep", Icon: Moon },
  { name: "creatine", history: "creatine-history", label: "Creatine", Icon: FlaskConical },
  { name: "profile", history: "weight-reports", label: "Profile", Icon: UserRound },
] as const;

function CompactTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const { colors } = theme;
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRoute = state.routes[state.index]?.name;
  const menuActive = menuOpen || drawerTabs.some(({ name, history }) =>
    activeRoute === name || activeRoute === history,
  );

  function selectTab(name: string) {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return;
    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (activeRoute !== name && !event.defaultPrevented) {
      navigateToTab(route.key);
    }
  }

  return (
    <>
      <View onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height)} style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingLeft: insets.left,
        paddingRight: insets.right,
        elevation: 12,
        shadowColor: "#000",
        shadowOpacity: theme.mode === "dark" ? 0.3 : 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -4 },
      }}>
        {mainTabs.map(({ name, label, Icon }) => {
          const selected = activeRoute === name;
          const color = selected ? colors.primary : colors.textMuted;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => selectTab(name)}
              style={styles.tab}
            >
              <Icon color={color} size={24} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen(true)}
          style={styles.tab}
        >
          <Menu color={menuActive ? colors.primary : colors.textMuted} size={24} />
          <Text style={[styles.label, { color: menuActive ? colors.primary : colors.textMuted }]}>Menu</Text>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            importantForAccessibility="no"
            onPress={() => setMenuOpen(false)}
          />
          <SafeAreaView
            accessibilityViewIsModal
            edges={["top", "right", "bottom"]}
            style={[styles.drawer, { backgroundColor: colors.surface, borderLeftColor: colors.border }]}
          >
            <ScrollView contentContainerStyle={styles.drawerContent}>
              <View style={styles.drawerHeader}>
                <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
                  Menu
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                  onPress={() => setMenuOpen(false)}
                  style={styles.close}
                >
                  <X color={colors.text} size={22} />
                </Pressable>
              </View>
              {drawerTabs.map(({ name, history, label, Icon }) => {
                const selected = activeRoute === name || activeRoute === history;
                const color = selected ? colors.primary : colors.text;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setMenuOpen(false);
                      selectTab(name);
                    }}
                    style={[styles.drawerItem, selected && { backgroundColor: colors.surfaceAlt }]}
                  >
                    <Icon color={color} size={20} />
                    <Text style={{ color, fontSize: 16, fontWeight: "800" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CompactTabBar {...props} />}>
      {mainTabs.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
      {/* The custom bar controls what it displays. Expo Router redirects away from hidden screens. */}
      {drawerTabs.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
      <Tabs.Screen name="weight-reports" />
      <Tabs.Screen name="creatine-history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: 56, gap: 4, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  overlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: "rgba(3,8,6,0.62)" },
  drawer: { width: "85%", maxWidth: 320, borderLeftWidth: 1 },
  drawerContent: { padding: 16, gap: 8 },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  drawerItem: { minHeight: 52, paddingHorizontal: 12, borderRadius: 14, gap: 12, flexDirection: "row", alignItems: "center" },
});

import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

const shared = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  layout: {
    screenPadding: 16,
    cardPadding: 16,
  },
};

export const darkTheme = {
  ...shared,
  mode: "dark",
  colors: {
    primary: "#16A34A",
    primaryDark: "#052E16",
    primarySoft: "#DCFCE7",

    accent: "#F97316",
    accentSoft: "#FFEDD5",

    background: "#0B0F0C",
    surface: "#111827",
    surfaceAlt: "#1F2937",
    border: "#263238",

    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    textFaint: "#6B7280",
    textInverse: "#FFFFFF",

    success: "#22C55E",
    warning: "#FACC15",
    danger: "#EF4444",
    info: "#38BDF8",

    calories: "#38BDF8",
    protein: "#22C55E",
    carbs: "#F97316",
    fat: "#FACC15",
    fiber: "#A855F7",

    push: "#EF4444",
    pull: "#3B82F6",
    legs: "#A855F7",
    upper: "#F97316",
    lower: "#22C55E",
    rest: "#6B7280",

    walking: "#22C55E",
    running: "#F97316",
    pace: "#38BDF8",
    heartRate: "#EF4444",

    activeDay: "#F97316",
    selectedDay: "#16A34A",
    today: "#38BDF8",
  },

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
} as const;

export const lightTheme = {
  ...shared,
  mode: "light",
  colors: {
    primary: "#16A34A",
    primaryDark: "#052E16",
    primarySoft: "#DCFCE7",

    accent: "#F97316",
    accentSoft: "#FFEDD5",

    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#E2E8F0",

    text: "#0F172A",
    textMuted: "#475569",
    textFaint: "#94A3B8",
    textInverse: "#FFFFFF",

    success: "#16A34A",
    warning: "#EAB308",
    danger: "#DC2626",
    info: "#0284C7",

    calories: "#0284C7",
    protein: "#16A34A",
    carbs: "#EA580C",
    fat: "#CA8A04",
    fiber: "#9333EA",

    push: "#DC2626",
    pull: "#2563EB",
    legs: "#9333EA",
    upper: "#EA580C",
    lower: "#16A34A",
    rest: "#64748B",

    walking: "#16A34A",
    running: "#EA580C",
    pace: "#0284C7",
    heartRate: "#DC2626",

    activeDay: "#EA580C",
    selectedDay: "#16A34A",
    today: "#0284C7",
  },

  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },
} as const;

export type AppTheme = typeof lightTheme | typeof darkTheme;

const ThemeContext = createContext<AppTheme>(lightTheme);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme: AppTheme = scheme === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

import * as SystemUI from "expo-system-ui";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { readSystemAppearance, subscribeSystemAppearance } from "./systemAppearance";

export type SessionThemeKey =
  | "default"
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "arms"
  | "rest";

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

const primaryFill = "#0369A1";
const workoutColors = {
  push: primaryFill,
  pull: primaryFill,
  legs: primaryFill,
  upper: primaryFill,
  lower: primaryFill,
  arms: primaryFill,
  rest: primaryFill,
};

export const darkTheme = {
  ...shared,
  mode: "dark" as const,
  colors: {
    primary: "#22D3EE",
    primaryFill,
    primaryDark: "#0C3046",
    primarySoft: "#0C3046",

    accent: "#F97316",
    accentSoft: "#431407",

    background: "#090F17",
    surface: "#111B27",
    surfaceAlt: "#182636",
    border: "#2B3C50",

    text: "#F4F7FB",
    textMuted: "#A5B5C8",
    textFaint: "#8498AF",
    textInverse: "#FFFFFF",

    success: "#22C55E",
    warning: "#FACC15",
    danger: "#EF4444",
    info: "#38BDF8",

    calories: "#9DA0AD",
    protein: "#4ADE80",
    carbs: "#22D3EE",
    fat: "#FB923C",
    fiber: "#A78BFA",

    ...workoutColors,

    walking: "#22D3EE",
    running: "#F97316",
    pace: "#38BDF8",
    heartRate: "#EF4444",

    activeDay: "#F97316",
    selectedDay: primaryFill,
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
};

export const lightTheme = {
  ...shared,
  mode: "light" as const,
  colors: {
    primary: "#075985",
    primaryFill,
    primaryDark: "#0C3046",
    primarySoft: "#E0F2FE",

    accent: "#F97316",
    accentSoft: "#FFEDD5",

    background: "#F3F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EAF1F8",
    border: "#D6E2EF",

    text: "#0F172A",
    textMuted: "#475569",
    textFaint: "#64748B",
    textInverse: "#FFFFFF",

    success: "#16A34A",
    warning: "#EAB308",
    danger: "#DC2626",
    info: "#0284C7",

    calories: "#9DA0AD",
    protein: "#22C55E",
    carbs: "#06B6D4",
    fat: "#F97316",
    fiber: "#8B5CF6",

    ...workoutColors,

    walking: "#0369A1",
    running: "#EA580C",
    pace: "#0284C7",
    heartRate: "#DC2626",

    activeDay: "#EA580C",
    selectedDay: primaryFill,
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
};

type ThemeColors = Record<keyof typeof lightTheme.colors, string>;

export type BaseTheme = Omit<typeof lightTheme, "colors" | "mode"> & {
  mode: "light" | "dark";
  colors: ThemeColors;
};

export type AppTheme = BaseTheme & {
  sessionTheme: SessionThemeKey;
  setSessionTheme: (session: SessionThemeKey) => void;
};

const ThemeContext = createContext<AppTheme>({
  ...lightTheme,
  colors: lightTheme.colors,
  sessionTheme: "default",
  setSessionTheme: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState(() => readSystemAppearance() ?? "light");
  useEffect(() => subscribeSystemAppearance(setScheme), []);

  const baseTheme = scheme === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    // The React screen has its own background if the native window is unavailable.
    void SystemUI.setBackgroundColorAsync(baseTheme.colors.background).catch(() => {});
  }, [baseTheme.colors.background]);

  const theme = useMemo<AppTheme>(() => {
    return {
      ...baseTheme,
      sessionTheme: "default",
      setSessionTheme: () => {},
    };
  }, [baseTheme]);

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

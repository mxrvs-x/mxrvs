import * as SystemUI from "expo-system-ui";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, type ColorSchemeName } from "react-native";

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

export const darkTheme = {
  ...shared,
  mode: "dark" as const,
  colors: {
    primary: "#16A34A",
    primaryDark: "#052E16",
    primarySoft: "#052E16",

    accent: "#F97316",
    accentSoft: "#431407",

    background: "#070B0A",
    surface: "#101614",
    surfaceAlt: "#18211E",
    border: "#26332E",

    text: "#F4F7F5",
    textMuted: "#A4B0AA",
    textFaint: "#718079",
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

    push: "#16A34A",
    pull: "#16A34A",
    legs: "#16A34A",
    upper: "#16A34A",
    lower: "#16A34A",
    arms: "#16A34A",
    rest: "#16A34A",

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
};

export const lightTheme = {
  ...shared,
  mode: "light" as const,
  colors: {
    primary: "#16A34A",
    primaryDark: "#052E16",
    primarySoft: "#DCFCE7",

    accent: "#F97316",
    accentSoft: "#FFEDD5",

    background: "#F4F7F5",
    surface: "#FFFFFF",
    surfaceAlt: "#EDF2EF",
    border: "#DCE5E0",

    text: "#0F172A",
    textMuted: "#475569",
    textFaint: "#94A3B8",
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

    push: "#16A34A",
    pull: "#16A34A",
    legs: "#16A34A",
    upper: "#16A34A",
    lower: "#16A34A",
    arms: "#16A34A",
    rest: "#16A34A",

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
  const [scheme, setScheme] = useState<ColorSchemeName>(() =>
    Appearance.getColorScheme(),
  );
  useEffect(() => {
    Appearance.setColorScheme(null);
    setScheme(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const baseTheme = useMemo<BaseTheme>(
    () =>
      scheme === "dark"
        ? { ...darkTheme, colors: darkTheme.colors }
        : { ...lightTheme, colors: lightTheme.colors },
    [scheme],
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(baseTheme.colors.background);
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

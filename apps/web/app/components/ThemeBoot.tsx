"use client";

import { useEffect } from "react";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem("mxrvs-web-theme");
  return stored === "light" || stored === "dark" ? stored : "dark";
}

export function setStoredTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;

  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("mxrvs-web-theme", theme);
}

export default function ThemeBoot() {
  useEffect(() => {
    setStoredTheme(getStoredTheme());
  }, []);

  return null;
}

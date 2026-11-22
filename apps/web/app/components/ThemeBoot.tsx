"use client";

import { useEffect } from "react";

export type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent("mxrvs-theme-change"));
}

export default function ThemeBoot() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(media.matches ? "dark" : "light");

    syncTheme();
    media.addEventListener("change", syncTheme);

    return () => media.removeEventListener("change", syncTheme);
  }, []);

  return null;
}

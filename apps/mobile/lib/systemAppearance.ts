import { Appearance, AppState, Platform, TurboModuleRegistry, type TurboModule } from "react-native";

type SystemScheme = "light" | "dark";
type NativeAppearance = TurboModule & { getColorScheme(): string };

export function readSystemAppearance(): SystemScheme | null {
  if (Platform.OS === "android") {
    try {
      // React Native's JS Appearance value is cached until the next native event.
      const scheme = TurboModuleRegistry.get<NativeAppearance>("Appearance")?.getColorScheme();
      if (scheme === "light" || scheme === "dark") return scheme;
    } catch {
      // Fall back to the public Appearance value if the native read is unavailable.
    }
  }
  try {
    return Appearance.getColorScheme();
  } catch {
    return null;
  }
}

export function subscribeSystemAppearance(onChange: (scheme: SystemScheme) => void) {
  const refresh = () => {
    const scheme = readSystemAppearance();
    if (scheme) onChange(scheme);
  };
  const appearance = Appearance.addChangeListener(({ colorScheme }) => {
    if (colorScheme === "light" || colorScheme === "dark") onChange(colorScheme);
    else refresh();
  });
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") refresh();
  });
  refresh();

  return () => {
    appearance.remove();
    appState.remove();
  };
}

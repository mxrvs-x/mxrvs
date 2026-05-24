import { Text, View } from "react-native";

type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp?: number;
};

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function SafeRouteMap({
  region,
  fallbackRegion,
  route,
  fallbackTitle = "GPS tracking active",
  fallbackMessage = "Map preview is unavailable in this build.",
  textColor = "#111827",
  mutedTextColor = "#6B7280",
}: {
  region: MapRegion | null;
  fallbackRegion: MapRegion;
  route: RoutePoint[];
  showUserLocation: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  fitRouteToBounds?: boolean;
  routeFitPadding?: { top: number; right: number; bottom: number; left: number };
  showStartMarker?: boolean;
  showFinishMarker?: boolean;
  fallbackTitle?: string;
  fallbackMessage?: string;
  textColor?: string;
  mutedTextColor?: string;
}) {
  const current = route[route.length - 1] || region || fallbackRegion;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "900",
          textAlign: "center",
          color: textColor,
        }}
      >
        {fallbackTitle}
      </Text>

      <Text
        style={{
          marginTop: 8,
          fontSize: 12,
          textAlign: "center",
          color: mutedTextColor,
        }}
      >
        {fallbackMessage}
      </Text>

      <Text
        style={{
          marginTop: 10,
          fontSize: 12,
          textAlign: "center",
          color: mutedTextColor,
        }}
      >
        {current.latitude.toFixed(5)}, {current.longitude.toFixed(5)}
      </Text>
    </View>
  );
}

export type { MapRegion, RoutePoint };

import { useEffect, useMemo, useRef } from "react";
import { Platform, Text, View } from "react-native";

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

type MapsModule = typeof import("react-native-maps");

let mapsModule: MapsModule | null | undefined;
const DEFAULT_ROUTE_FIT_PADDING = { top: 54, right: 54, bottom: 54, left: 54 };

function getMapsModule() {
  if (mapsModule !== undefined) return mapsModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mapsModule = require("react-native-maps") as MapsModule;
  } catch (error) {
    console.log("Load native map error:", error);
    mapsModule = null;
  }

  return mapsModule;
}

export function SafeRouteMap({
  region,
  fallbackRegion,
  route,
  showUserLocation,
  strokeWidth = 5,
  strokeColor = "#2563EB",
  fitRouteToBounds = false,
  routeFitPadding = DEFAULT_ROUTE_FIT_PADDING,
  showStartMarker = true,
  showFinishMarker = false,
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
  const maps = getMapsModule();
  const mapRef = useRef<any>(null);
  const coordinates = useMemo(
    () =>
      route.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [route],
  );

  useEffect(() => {
    if (!fitRouteToBounds || coordinates.length < 2) return;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: routeFitPadding,
        animated: false,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [coordinates, fitRouteToBounds, routeFitPadding]);

  if (!maps) {
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

  const MapView = maps.default;
  const { Marker, Polyline, PROVIDER_GOOGLE } = maps;
  const regionProps = fitRouteToBounds
    ? { initialRegion: region || fallbackRegion }
    : { region: region || fallbackRegion };

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      {...regionProps}
      showsUserLocation={showUserLocation}
      followsUserLocation={showUserLocation && !fitRouteToBounds}
    >
      {showStartMarker && route.length > 0 && (
        <Marker
          coordinate={{
            latitude: route[0].latitude,
            longitude: route[0].longitude,
          }}
          title="Start"
        />
      )}

      {showFinishMarker && route.length > 1 && (
        <Marker
          coordinate={{
            latitude: route[route.length - 1].latitude,
            longitude: route[route.length - 1].longitude,
          }}
          title="Finish"
        />
      )}

      {route.length > 1 && (
        <Polyline
          coordinates={coordinates}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
    </MapView>
  );
}

export type { MapRegion, RoutePoint };

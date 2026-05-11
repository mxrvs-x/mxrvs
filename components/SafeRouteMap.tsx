import Constants from "expo-constants";
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

function hasAndroidGoogleMapsKey() {
  const expoConfig = Constants.expoConfig as
    | {
        android?: {
          config?: {
            googleMaps?: {
              apiKey?: string;
            };
          };
        };
      }
    | null
    | undefined;

  return Boolean(expoConfig?.android?.config?.googleMaps?.apiKey);
}

function canUseNativeMap() {
  if (Platform.OS !== "android") return true;
  if (Constants.appOwnership === "expo") return true;

  return hasAndroidGoogleMapsKey();
}

function getMapsModule() {
  if (!canUseNativeMap()) return null;

  if (mapsModule !== undefined) return mapsModule;

  try {
    // Keep react-native-maps out of Android builds that have no Maps API key.
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
  showFinishMarker?: boolean;
  fallbackTitle?: string;
  fallbackMessage?: string;
  textColor?: string;
  mutedTextColor?: string;
}) {
  const maps = getMapsModule();

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
  const { Marker, Polyline } = maps;

  return (
    <MapView
      style={{ flex: 1 }}
      region={region || fallbackRegion}
      showsUserLocation={showUserLocation}
      followsUserLocation={showUserLocation}
    >
      {route.length > 0 && (
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
          coordinates={route.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }))}
          strokeWidth={strokeWidth}
        />
      )}
    </MapView>
  );
}

export type { MapRegion, RoutePoint };

import ExportBackgroundPicker from "@/components/ExportBackgroundPicker";
import ThemedAlert from "@/components/ThemedAlert";
import { SafeRouteMap, type MapRegion } from "@/components/SafeRouteMap";
import { AppTheme, useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Copy, Download, Share2, X } from "lucide-react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp?: number;
};

type CardioSession = {
  id: string;
  user_id: string;
  session_date: string;
  cardio_type: "walking" | "running";
  cardio_source: "outdoor" | "treadmill" | "manual";
  distance_km: number;
  duration_seconds: number;
  steps: number | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  notes: string | null;
  route: RoutePoint[] | null;
  is_mock: boolean;
  created_at: string;
  updated_at?: string | null;
};

export default function CardioDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const exportRef = useRef<any>(null);

  const Text = (props: any) => (
    <RNText {...props} style={[{ color: theme.colors.text }, props.style]} />
  );

  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [session, setSession] = useState<CardioSession | null>(null);
  const [exportBackgroundUri, setExportBackgroundUri] = useState<string | null>(
    null,
  );
  const [exportAction, setExportAction] = useState<"save" | "share" | null>(
    null,
  );
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertDanger, setAlertDanger] = useState(false);

  useEffect(() => {
    loadSession();
  }, [id]);

  async function loadSession() {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("cardio_sessions")
      .select("*")
      .eq("id", String(id))
      .single();

    if (error) {
      console.log("Load cardio session error:", error);
      setSession(null);
      setLoading(false);
      return;
    }

    setSession(data);
    setLoading(false);
  }

  function formatTime(totalSeconds?: number | null) {
    if (!totalSeconds) return "0:00";

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function paceText() {
    if (!session?.distance_km || !session?.duration_seconds) return "—";

    const pace = session.duration_seconds / 60 / session.distance_km;

    const min = Math.floor(pace);

    const sec = Math.round((pace - min) * 60);

    return `${min}:${String(sec).padStart(2, "0")}/km`;
  }

  function speedKmh() {
    if (!session?.distance_km || !session?.duration_seconds) return "0.0";

    return (session.distance_km / (session.duration_seconds / 3600)).toFixed(1);
  }

  function titleText() {
    if (!session) return "Cardio";

    return session.cardio_type === "running" ? "Run" : "Walk";
  }

  function sourceText() {
    if (!session) return "";

    if (session.cardio_source === "outdoor") return "Outdoor";

    if (session.cardio_source === "treadmill") return "Treadmill";

    return "Manual";
  }

  function formatDate(date?: string | null) {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function routeRegion(points: RoutePoint[]): MapRegion | null {
    if (!points.length) return null;

    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.45, 0.004),
      longitudeDelta: Math.max((maxLng - minLng) * 1.45, 0.004),
    };
  }

  function showAlert({
    title,
    message,
    confirmText = "OK",
    danger = false,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
  }) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertConfirmText(confirmText);
    setAlertDanger(danger);
    setAlertOpen(true);
  }

  function openExportCustomizer(type: "save" | "share") {
    if (exporting) return;
    setExportAction(type);
  }

  function buildCardioClipboardText() {
    if (!session) return "";

    return [
      `${titleText()} Cardio`,
      formatDate(session.session_date),
      `Distance: ${Number(session.distance_km || 0).toFixed(2)} km`,
      `Steps: ${session.steps || 0}`,
      `Calories: ${session.calories_burned || 0} kcal`,
      `Duration: ${formatTime(session.duration_seconds)}`,
    ].join("\n");
  }

  async function copyCardioDetails() {
    try {
      const { requireOptionalNativeModule } = await import("expo-modules-core");
      const nativeClipboard = requireOptionalNativeModule("ExpoClipboard");

      if (!nativeClipboard) {
        showAlert({
          title: "Update Required",
          message:
            "Install the latest preview build to copy cardio details. EAS Update cannot add this native clipboard module to an older app build.",
          danger: true,
        });

        return;
      }

      const Clipboard = await import("expo-clipboard");

      await Clipboard.setStringAsync(buildCardioClipboardText());

      showAlert({
        title: "Copied",
        message: "Cardio details copied to clipboard.",
      });
    } catch (error) {
      console.log("Copy cardio details error:", error);

      showAlert({
        title: "Copy Failed",
        message: "Something went wrong while copying cardio details.",
        danger: true,
      });
    }
  }

  async function confirmExport() {
    if (!exportAction) return;

    const action = exportAction;
    setExportAction(null);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await exportCardioImage(action);
  }

  async function exportCardioImage(type: "save" | "share") {
    try {
      if (!exportRef.current || exporting) return;

      setExporting(true);

      const uri = await captureRef(exportRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      if (type === "save") {
        const permission = await MediaLibrary.requestPermissionsAsync(false, [
          "photo",
        ]);

        if (!permission.granted) {
          setExporting(false);

          showAlert({
            title: "Permission Required",
            message:
              "Please allow photo library access to save your cardio summary.",
            danger: true,
          });

          return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);

        showAlert({
          title: "Saved",
          message: "Cardio summary saved to gallery.",
        });
      } else {
        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          setExporting(false);

          showAlert({
            title: "Sharing Unavailable",
            message: "Sharing is not available here.",
            danger: true,
          });

          return;
        }

        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share Cardio Summary",
        });
      }

      setExporting(false);
    } catch (error) {
      console.log("Export cardio image error:", error);
      setExporting(false);

      showAlert({
        title: "Export Failed",
        message: "Something went wrong while exporting cardio summary.",
        danger: true,
      });
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: theme.colors.background,
          padding: 24,
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontSize: 18,
            fontWeight: "900",
          }}
        >
          Session not found
        </Text>
      </View>
    );
  }

  const route = session.route || [];
  const savedRouteRegion = routeRegion(route);

  const hasRoute =
    session.cardio_source === "outdoor" &&
    Array.isArray(route) &&
    route.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "",
          headerBackVisible: false,

          headerStyle: {
            backgroundColor: theme.colors.surface,
          },

          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 46,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={30} color={theme.colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={copyCardioDetails}
                disabled={exporting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Copy size={20} color={theme.colors.text} />
              </Pressable>

              <Pressable
                onPress={() => openExportCustomizer("share")}
                disabled={exporting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Share2 size={20} color={theme.colors.text} />
              </Pressable>

              <Pressable
                onPress={() => openExportCustomizer("save")}
                disabled={exporting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Download size={20} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
        }}
      >
        <View
          style={{
            padding: 16,
            paddingBottom: 20,
            backgroundColor: theme.colors.background,
          }}
        >
          <ImageBackground
            ref={exportRef}
            source={exportBackgroundUri ? { uri: exportBackgroundUri } : undefined}
            resizeMode="cover"
            style={{
              minHeight: 560,
              borderRadius: 24,
              overflow: "hidden",
              padding: 22,
              justifyContent: "space-between",
              backgroundColor: theme.mode === "dark" ? "#111827" : "#F8FAFC",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: exportBackgroundUri
                  ? "rgba(0,0,0,0.45)"
                  : theme.colors.background,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: exportBackgroundUri ? "#FFFFFF" : theme.colors.text,
                    fontSize: 34,
                    fontWeight: "900",
                  }}
                >
                  {titleText()}
                </Text>
                <Text
                  style={{
                    color: exportBackgroundUri
                      ? "rgba(255,255,255,0.78)"
                      : theme.colors.textMuted,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  {formatDate(session.session_date)}
                </Text>
              </View>

              <Text
                style={{
                  color: exportBackgroundUri ? "#FFFFFF" : theme.colors.primary,
                  fontSize: 13,
                  fontWeight: "900",
                }}
              >
                mxrvs
              </Text>
            </View>

            <View style={{ alignItems: "center", justifyContent: "center" }}>
              {hasRoute ? (
                <RouteTrace
                  points={route}
                  color={exportBackgroundUri ? "#FFFFFF" : theme.colors.primary}
                />
              ) : (
                <View
                  style={{
                    width: 260,
                    height: 260,
                    borderRadius: 130,
                    borderWidth: 2,
                    borderColor: exportBackgroundUri
                      ? "rgba(255,255,255,0.45)"
                      : theme.colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: exportBackgroundUri
                        ? "rgba(255,255,255,0.78)"
                        : theme.colors.textMuted,
                      fontWeight: "900",
                    }}
                  >
                    No route saved
                  </Text>
                </View>
              )}
            </View>

            <View>
              <Text
                style={{
                  color: exportBackgroundUri
                    ? "rgba(255,255,255,0.78)"
                    : theme.colors.textMuted,
                  fontWeight: "900",
                  textTransform: "uppercase",
                }}
              >
                Distance
              </Text>
              <Text
                style={{
                  color: exportBackgroundUri ? "#FFFFFF" : theme.colors.text,
                  fontSize: 48,
                  fontWeight: "900",
                  marginTop: 4,
                }}
              >
                {Number(session.distance_km || 0).toFixed(2)} km
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <ExportMetric
                  label="Steps"
                  value={`${session.steps || 0}`}
                  dark={Boolean(exportBackgroundUri)}
                />
                <ExportMetric
                  label="Duration"
                  value={formatTime(session.duration_seconds)}
                  dark={Boolean(exportBackgroundUri)}
                />
                <ExportMetric
                  label="Calories"
                  value={`${session.calories_burned || 0}`}
                  dark={Boolean(exportBackgroundUri)}
                />
              </View>
            </View>
          </ImageBackground>

          <ExportBackgroundPicker
            action={exportAction}
            exporting={exporting}
            selectedUri={exportBackgroundUri}
            visible={Boolean(exportAction)}
            onClose={() => setExportAction(null)}
            onExport={confirmExport}
            onSelect={setExportBackgroundUri}
          />

          <Text style={{ fontSize: 30, fontWeight: "900", marginTop: 24 }}>
            {titleText()}
          </Text>

          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            {sourceText()} • {formatDate(session.session_date)}
          </Text>

          {session.is_mock && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: theme.mode === "dark" ? "#422006" : "#FEF3C7",
                padding: 14,
                borderRadius: 14,
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color: theme.mode === "dark" ? "#FACC15" : "#92400E",
                }}
              >
                Mock Session
              </Text>

              <Text
                style={{
                  color: theme.mode === "dark" ? "#FACC15" : "#92400E",
                  marginTop: 4,
                }}
              >
                This was saved using simulated cardio data.
              </Text>
            </View>
          )}

          {hasRoute && (
            <View
              style={{
                marginTop: 18,
                marginHorizontal: -16,
                backgroundColor: theme.colors.surfaceAlt,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 330,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <SafeRouteMap
                  region={savedRouteRegion}
                  fallbackRegion={
                    savedRouteRegion || {
                      latitude: route[0].latitude,
                      longitude: route[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  }
                  route={route}
                  showUserLocation={false}
                  fitRouteToBounds
                  routeFitPadding={{ top: 58, right: 58, bottom: 58, left: 58 }}
                  strokeColor={theme.colors.primary}
                  strokeWidth={6}
                  showStartMarker={false}
                  showFinishMarker={false}
                  fallbackTitle="Route saved"
                  fallbackMessage="Set a Google Maps API key to show saved routes in Android builds."
                  textColor={theme.colors.text}
                  mutedTextColor={theme.colors.textMuted}
                />
              </View>
            </View>
          )}

          <View
            style={{
              marginTop: 20,
              backgroundColor: theme.colors.surface,
              borderRadius: 24,
              padding: 18,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                marginBottom: 10,
              }}
            >
              Summary
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatBox
                theme={theme}
                label="Distance"
                value={`${session.distance_km} km`}
              />

              <StatBox
                theme={theme}
                label="Duration"
                value={formatTime(session.duration_seconds)}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 12,
              }}
            >
              <StatBox theme={theme} label="Pace" value={paceText()} />

              <StatBox
                theme={theme}
                label="Speed"
                value={`${speedKmh()} km/h`}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 12,
              }}
            >
              <StatBox
                theme={theme}
                label="Steps"
                value={`${session.steps || 0}`}
              />

              <StatBox
                theme={theme}
                label="Calories"
                value={`${session.calories_burned || 0} kcal`}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 12,
              }}
            >
              <StatBox
                theme={theme}
                label="Avg HR"
                value={
                  session.avg_heart_rate ? `${session.avg_heart_rate} bpm` : "—"
                }
              />

              <StatBox theme={theme} label="Source" value={sourceText()} />
            </View>
          </View>

          {session.notes && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: 24,
                padding: 18,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "900" }}>Notes</Text>

              <Text
                style={{
                  marginTop: 8,
                  color: theme.colors.textMuted,
                  lineHeight: 22,
                }}
              >
                {session.notes}
              </Text>
            </View>
          )}

          {!hasRoute && session.cardio_source === "outdoor" && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: 24,
                padding: 18,
              }}
            >
              <Text style={{ fontWeight: "900" }}>No route saved</Text>

              <Text
                style={{
                  marginTop: 6,
                  color: theme.colors.textMuted,
                  lineHeight: 22,
                }}
              >
                This outdoor session has no GPS route data.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        confirmText={alertConfirmText}
        danger={alertDanger}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}

function StatBox({
  theme,
  label,
  value,
}: {
  theme: AppTheme;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <RNText
        style={{
          color: theme.colors.textFaint,
          fontSize: 12,
        }}
      >
        {label}
      </RNText>

      <RNText
        style={{
          color: theme.colors.text,
          fontSize: 17,
          fontWeight: "900",
          marginTop: 6,
        }}
      >
        {value}
      </RNText>
    </View>
  );
}

function RouteTrace({
  points,
  color,
}: {
  points: RoutePoint[];
  color: string;
}) {
  const size = 280;
  const padding = 22;

  if (points.length < 2) {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    );
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);
  const drawable = size - padding * 2;

  const projected = points.map((point) => ({
    x: padding + ((point.longitude - minLng) / lngRange) * drawable,
    y: padding + ((maxLat - point.latitude) / latRange) * drawable,
  }));

  const path = projected
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const start = projected[0];
  const finish = projected[projected.length - 1];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={start.x} cy={start.y} r={7} fill={color} />
      <Circle
        cx={finish.x}
        cy={finish.y}
        r={7}
        fill={color}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={3}
      />
    </Svg>
  );
}

function ExportMetric({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: "30%",
        borderRadius: 16,
        padding: 12,
        backgroundColor: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
        borderWidth: 1,
        borderColor: dark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.08)",
      }}
    >
      <RNText
        style={{
          color: dark ? "rgba(255,255,255,0.72)" : "#64748B",
          fontSize: 11,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {label}
      </RNText>

      <RNText
        style={{
          color: dark ? "#FFFFFF" : "#0F172A",
          fontSize: 18,
          fontWeight: "900",
          marginTop: 5,
        }}
      >
        {value}
      </RNText>
    </View>
  );
}

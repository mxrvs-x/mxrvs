import { SafeRouteMap } from "@/components/SafeRouteMap";
import { AppTheme, useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
} from "react-native";

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

  const Text = (props: any) => (
    <RNText {...props} style={[{ color: theme.colors.text }, props.style]} />
  );

  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CardioSession | null>(null);

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
        }}
      />

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
        }}
      >
        <View style={{ padding: 16, paddingBottom: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: "900" }}>{titleText()}</Text>

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
                backgroundColor: theme.colors.surface,
                borderRadius: 24,
                padding: 12,
              }}
            >
              <View
                style={{
                  height: 280,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <SafeRouteMap
                  region={{
                    latitude: route[0].latitude,
                    longitude: route[0].longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  fallbackRegion={{
                    latitude: route[0].latitude,
                    longitude: route[0].longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  route={route}
                  showUserLocation={false}
                  showFinishMarker
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

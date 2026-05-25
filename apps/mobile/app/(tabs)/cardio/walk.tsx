import ThemedAlert from "@/components/ThemedAlert";
import { SafeRouteMap, type MapRegion } from "@/components/SafeRouteMap";
import { requestFitnessPermissions } from "@/lib/appPermissions";
import { toLocalDateKey } from "@/lib/dates";
import {
  drainBackgroundCardioRoutePoints,
  type BackgroundCardioRoutePoint,
  startBackgroundCardioLocation,
  stopBackgroundCardioLocation,
} from "@/lib/backgroundCardioLocation";
import {
  cacheOfflineBodyWeightKg,
  getOfflineBodyWeightKg,
  isOnline,
  resolveCardioUserId,
  saveOfflineCardioSession,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";
import { Stack, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type WalkSource = "outdoor" | "treadmill";

type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

type WalkSession = {
  walkSource: WalkSource;
  tracking: boolean;
  isPaused: boolean;
  startedAtMs: number | null;
  activeMs: number;
  seconds: number;
  steps: number;
  gpsDistanceKm: number;
  route: RoutePoint[];
  region: MapRegion | null;
  gpsAccuracy: number | null;
  gpsReady: boolean;
};

const WALKING_STRIDE_HEIGHT_RATIO = 0.415;

const initialWalkSession: WalkSession = {
  walkSource: "outdoor",
  tracking: false,
  isPaused: false,
  startedAtMs: null,
  activeMs: 0,
  seconds: 0,
  steps: 0,
  gpsDistanceKm: 0,
  route: [],
  region: null,
  gpsAccuracy: null,
  gpsReady: false,
};

let walkSession: WalkSession = initialWalkSession;
const walkSubscribers = new Set<() => void>();

let timerRef: ReturnType<typeof setInterval> | null = null;
let watchRef: Location.LocationSubscription | null = null;
let pedometerRef: Pedometer.Subscription | null = null;

let lastPointRef: RoutePoint | null = null;
let lastRawStepsRef = 0;

function getWalkSession() {
  return walkSession;
}

function subscribeWalkSession(callback: () => void) {
  walkSubscribers.add(callback);
  return () => walkSubscribers.delete(callback);
}

function setWalkSession(
  updater: Partial<WalkSession> | ((current: WalkSession) => WalkSession),
) {
  walkSession =
    typeof updater === "function"
      ? updater(walkSession)
      : { ...walkSession, ...updater };

  walkSubscribers.forEach((callback) => callback());
}

function useWalkSession() {
  return useSyncExternalStore(
    subscribeWalkSession,
    getWalkSession,
    getWalkSession,
  );
}

function elapsedSeconds(session = walkSession) {
  if (!session.tracking) return session.seconds;

  if (session.isPaused || !session.startedAtMs) {
    return Math.floor(session.activeMs / 1000);
  }

  return Math.floor(
    (session.activeMs + Date.now() - session.startedAtMs) / 1000,
  );
}

function calculateDistanceKm(a: RoutePoint, b: RoutePoint) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;

  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

function isGpsReliable(accuracy: number | null) {
  if (!accuracy) return false;
  return accuracy <= 30;
}

function estimateStepDistanceKm(steps: number, heightCm: number | null) {
  if (!heightCm || heightCm <= 0) return 0;

  const strideM = (heightCm / 100) * WALKING_STRIDE_HEIGHT_RATIO;

  return (steps * strideM) / 1000;
}

function handleLocationUpdate(location: Location.LocationObject) {
  const current = getWalkSession();

  if (!current.tracking || current.walkSource !== "outdoor") return;

  const accuracy = location.coords.accuracy ?? null;

  const point: RoutePoint = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
  };

  if (lastPointRef && point.timestamp <= lastPointRef.timestamp) {
    return;
  }

  const region: MapRegion = {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  if (current.isPaused) {
    lastPointRef = point;

    setWalkSession({
      gpsAccuracy: accuracy,
      gpsReady: isGpsReliable(accuracy),
      region,
      seconds: elapsedSeconds(),
    });

    return;
  }

  const lastPoint = lastPointRef;
  let addedKm = 0;

  if (lastPoint && isGpsReliable(accuracy)) {
    const distance = calculateDistanceKm(lastPoint, point);

    if (distance > 0.001 && distance < 0.05) {
      addedKm = distance;
    }
  }

  lastPointRef = point;

  setWalkSession((prev) => ({
    ...prev,
    gpsAccuracy: accuracy,
    gpsReady: isGpsReliable(accuracy),
    region,
    route: [...prev.route, point],
    gpsDistanceKm: prev.gpsDistanceKm + addedKm,
    seconds: elapsedSeconds(prev),
  }));
}

function backgroundPointToLocation(
  point: BackgroundCardioRoutePoint,
): Location.LocationObject {
  return {
    timestamp: point.timestamp,
    coords: {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  };
}

async function syncBackgroundWalkRoutePoints() {
  const points = await drainBackgroundCardioRoutePoints();

  points.forEach((point) => {
    handleLocationUpdate(backgroundPointToLocation(point));
  });
}

async function getUserBodyStats() {
  const cachedWeightKg = await getOfflineBodyWeightKg();
  let user = null;

  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    user = currentUser;
  } catch (error) {
    console.log("Load walk user for body stats error:", error);
  }

  if (!user) {
    return {
      heightCm: null,
      weightKg: cachedWeightKg,
    };
  }

  const [latestBodyStats, latestWeightLog] = await Promise.all([
    supabase
      .from("body_stats")
      .select("height_cm")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_weight_logs")
      .select("weight_kg")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (latestBodyStats.error) {
    console.log("Load walk body stats error:", latestBodyStats.error);
  }
  if (latestWeightLog.error) {
    console.log("Load walk weight log error:", latestWeightLog.error);
  }
  const weightKg = latestWeightLog.data?.weight_kg
    ? Number(latestWeightLog.data.weight_kg)
    : cachedWeightKg;

  await cacheOfflineBodyWeightKg(weightKg);

  return {
    heightCm: latestBodyStats.data?.height_cm
      ? Number(latestBodyStats.data.height_cm)
      : null,
    weightKg,
  };
}

function startTimer() {
  if (timerRef) clearInterval(timerRef);

  timerRef = setInterval(() => {
    const current = getWalkSession();

    if (!current.tracking) return;

    setWalkSession({
      seconds: elapsedSeconds(current),
    });
  }, 1000);
}

function stopWatchers() {
  watchRef?.remove();
  watchRef = null;

  pedometerRef?.remove();
  pedometerRef = null;

  void stopBackgroundCardioLocation();

  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}

function resetSession() {
  const currentSource = getWalkSession().walkSource;

  setWalkSession({
    ...initialWalkSession,
    walkSource: currentSource,
  });

  lastRawStepsRef = 0;
  lastPointRef = null;
}

export default function WalkScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const Text = (props: any) => (
    <RNText {...props} style={[{ color: theme.colors.text }, props.style]} />
  );

  const router = useRouter();
  const session = useWalkSession();

  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [manualDistanceKm, setManualDistanceKm] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [discardAlertVisible, setDiscardAlertVisible] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

  const stepDistanceKm = estimateStepDistanceKm(session.steps, heightCm);

  const displayDistanceKm =
    session.walkSource === "outdoor" ? session.gpsDistanceKm : stepDistanceKm;

  const hasUnsavedSession =
    session.tracking ||
    finishModalVisible ||
    session.seconds > 0 ||
    session.steps > 0 ||
    session.gpsDistanceKm > 0 ||
    session.route.length > 0;

  useEffect(() => {
    async function loadBodyStats() {
      const stats = await getUserBodyStats();
      setBodyWeight(stats.weightKg);
      setHeightCm(stats.heightCm);
    }

    loadBodyStats();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && getWalkSession().tracking) {
        void syncBackgroundWalkRoutePoints();
        setWalkSession({
          seconds: elapsedSeconds(),
        });
        startTimer();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (session.tracking && !timerRef) {
      startTimer();
    }
  }, [session.tracking]);

  useEffect(() => {
    if (session.walkSource !== "outdoor" || session.tracking) return;

    async function initLocation() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        const granted = permission.status === "granted";

        setLocationPermissionGranted(granted);

        if (!granted) return;

        const current =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));

        if (!current) return;

        setWalkSession({
          region: {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
        });
      } catch (error) {
        console.log("Initial walk location error:", error);
        setLocationPermissionGranted(false);
      }
    }

    initLocation();
  }, [session.walkSource, session.tracking]);

  useEffect(() => {
    return () => {
      stopWatchers(); // Make sure this actually clears everything
    };
  }, []);

  function showAlert({
    title,
    message,
    confirmText = "OK",
    cancelText,
    danger = false,
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm?: () => void;
  }) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertConfirmText(confirmText);
    setAlertCancelText(cancelText);
    setAlertDanger(danger);
    setAlertOnConfirm(() => () => onConfirm?.());
    setAlertOpen(true);
  }

  function handleClosePress() {
    if (hasUnsavedSession) {
      setDiscardAlertVisible(true);
      return;
    }

    router.back();
  }

  function confirmDiscardWalk() {
    stopWatchers();
    setDiscardAlertVisible(false);
    setFinishModalVisible(false);
    setManualDistanceKm("");
    setNotes("");
    resetSession();
    router.back();
  }

  function dismissFinishModal() {
    setFinishModalVisible(false);
  }

  function formatTime(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function gpsStatusText() {
    if (session.isPaused) return "Walk paused";
    if (session.walkSource !== "outdoor") return "GPS disabled";
    if (!session.gpsAccuracy) return "Waiting for GPS...";
    if (session.gpsAccuracy <= 15) {
      return `GPS good • ±${Math.round(session.gpsAccuracy)}m`;
    }
    if (session.gpsAccuracy <= 30) {
      return `GPS okay • ±${Math.round(session.gpsAccuracy)}m`;
    }
    return `GPS weak • ±${Math.round(session.gpsAccuracy)}m`;
  }

  function paceText(distanceKm = displayDistanceKm) {
    if (distanceKm <= 0 || session.seconds <= 0) return "—";
    if (session.seconds < 10 || distanceKm < 0.005) return "—";

    const pace = session.seconds / 60 / distanceKm;
    const min = Math.floor(pace);
    const sec = Math.round((pace - min) * 60);

    return `${min}:${String(sec).padStart(2, "0")}/km`;
  }

  function speedKmh(distanceKm = displayDistanceKm) {
    if (!distanceKm || session.seconds <= 0) return "0.0";
    return (distanceKm / (session.seconds / 3600)).toFixed(1);
  }

  function estimateCalories(distanceKm = displayDistanceKm) {
    if (!bodyWeight) return 0;

    return Math.round(bodyWeight * distanceKm * 0.55);
  }

  function distanceQualityText() {
    if (session.isPaused) {
      return "Paused. Duration, distance, pace, steps, and route are currently frozen.";
    }

    if (session.walkSource === "treadmill") {
      if (!heightCm) {
        return "Add a saved height to estimate treadmill/home distance from sensor steps.";
      }

      return "Distance estimated from sensor steps and your height. You can correct it before saving.";
    }

    if (!session.gpsReady) {
      return "GPS is weak. Distance may be inaccurate.";
    }

    return "GPS distance is active.";
  }

  function togglePauseWalk() {
    const current = getWalkSession();

    if (!current.tracking) return;

    if (current.isPaused) {
      setFinishModalVisible(false);
      setWalkSession({
        isPaused: false,
        startedAtMs: Date.now(),
      });
      startTimer();
      return;
    }

    const activeMs =
      current.activeMs +
      (current.startedAtMs ? Date.now() - current.startedAtMs : 0);

    setWalkSession({
      isPaused: true,
      activeMs,
      startedAtMs: null,
      seconds: Math.floor(activeMs / 1000),
    });
  }

  async function startWalking() {
    const permissions = await requestFitnessPermissions();
    setLocationPermissionGranted(permissions.locationGranted);

    if (!permissions.allGranted) {
      return;
    }

    const currentSource = getWalkSession().walkSource;

    resetSession();

    setWalkSession({
      walkSource: currentSource,
      tracking: true,
      startedAtMs: Date.now(),
      activeMs: 0,
      seconds: 0,
    });

    startTimer();

    try {
      const pedometerAvailable = await Pedometer.isAvailableAsync().catch(
        () => false,
      );

      if (pedometerAvailable) {
        pedometerRef = Pedometer.watchStepCount((result) => {
          const rawSteps = result.steps;
          const previousRawSteps = lastRawStepsRef;
          const delta = Math.max(0, rawSteps - previousRawSteps);

          lastRawStepsRef = rawSteps;

          if (getWalkSession().isPaused) return;

          setWalkSession((prev) => ({
            ...prev,
            steps: prev.steps + delta,
          }));
        });
      }
    } catch (error) {
      console.log("Start walk pedometer error:", error);
    }

    if (currentSource === "treadmill") return;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const firstPoint: RoutePoint = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        timestamp: current.timestamp,
      };

      const accuracy = current.coords.accuracy ?? null;

      lastPointRef = firstPoint;

      setWalkSession({
        gpsAccuracy: accuracy,
        gpsReady: isGpsReliable(accuracy),
        route: [firstPoint],
        region: {
          latitude: firstPoint.latitude,
          longitude: firstPoint.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
      });

      watchRef = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        handleLocationUpdate,
      );

      const backgroundLocation = await startBackgroundCardioLocation();

      if (!backgroundLocation.started) {
        showAlert({
          title: "Background GPS Limited",
          message:
            "Distance may pause while the app is locked or minimized until background location is enabled in a new build and allowed in settings.",
        });
      }
    } catch (error) {
      console.log("Start walk location error:", error);
      stopWatchers();
      resetSession();

      showAlert({
        title: "Location unavailable",
        message:
          "Could not start GPS tracking. Please check location services and try again.",
        danger: true,
      });
    }
  }

  async function stopWalking() {
    await syncBackgroundWalkRoutePoints();

    const current = getWalkSession();

    const activeMs =
      current.isPaused || !current.startedAtMs
        ? current.activeMs
        : current.activeMs + Date.now() - current.startedAtMs;

    const finalSeconds = Math.floor(activeMs / 1000);

    setWalkSession({
      tracking: true,
      isPaused: true,
      startedAtMs: null,
      activeMs,
      seconds: finalSeconds,
    });

    if (!timerRef) {
      startTimer();
    }

    const finalDistance =
      current.walkSource === "treadmill"
        ? estimateStepDistanceKm(current.steps, heightCm)
        : current.gpsDistanceKm;

    setManualDistanceKm(finalDistance.toFixed(2));
    setFinishModalVisible(true);
  }

  async function saveWalk() {
    if (savingRef.current) return;

    const current = getWalkSession();
    const finalDistanceKm = Number(manualDistanceKm || displayDistanceKm);

    if (current.seconds < 10) {
      showAlert({
        title: "Too short",
        message: "Walk must be at least 10 seconds.",
        danger: true,
      });
      return;
    }

    if (!finalDistanceKm || finalDistanceKm <= 0) {
      showAlert({
        title: "Missing distance",
        message: "Enter or confirm your walking distance.",
        danger: true,
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const userId = await resolveCardioUserId();

      if (!userId) {
        showAlert({
          title: "Offline setup needed",
          message:
            "Open the app once while online before saving cardio sessions offline.",
          danger: true,
        });
        return;
      }

      stopWatchers();

      const payload = {
        user_id: userId,
        session_date: toLocalDateKey(),
        cardio_type: "walking" as const,
        cardio_source: current.walkSource,
        distance_km: Number(finalDistanceKm.toFixed(3)),
        duration_seconds: current.seconds,
        steps: current.steps,
        calories_burned: estimateCalories(finalDistanceKm),
        avg_heart_rate: null,
        notes: notes || null,
        route: current.walkSource === "outdoor" ? current.route : null,
        is_mock: false,
        created_at: new Date().toISOString(),
      };

      const online = await isOnline();

      if (!online) {
        await saveOfflineCardioSession({
          temp_id: `offline_walk_${Date.now()}`,
          ...payload,
        });

        setFinishModalVisible(false);
        setManualDistanceKm("");
        setNotes("");
        resetSession();

        showAlert({
          title: "Saved Offline",
          message: "Your walk will sync when internet is back.",
          onConfirm: () => router.back(),
        });

        return;
      }

      const { error } = await supabase.from("cardio_sessions").insert(payload);

      if (error) {
        console.log("Save walk error:", error);

        await saveOfflineCardioSession({
          temp_id: `offline_walk_${Date.now()}`,
          ...payload,
        });

        setFinishModalVisible(false);
        setManualDistanceKm("");
        setNotes("");
        resetSession();

        showAlert({
          title: "Saved Offline",
          message: "Could not upload now, so your walk was saved offline.",
          onConfirm: () => router.back(),
        });

        return;
      }

      setFinishModalVisible(false);
      setManualDistanceKm("");
      setNotes("");
      resetSession();

      showAlert({
        title: "Saved",
        message: "Walk saved successfully.",
        onConfirm: () => router.back(),
      });
    } catch (error) {
      console.log("Save walk error:", error);
      showAlert({
        title: "Error",
        message: "Could not save your walk. Please try again.",
        danger: true,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const themedAlert = (
    <ThemedAlert
      visible={alertOpen}
      title={alertTitle}
      message={alertMessage}
      confirmText={alertConfirmText}
      cancelText={alertCancelText}
      danger={alertDanger}
      onClose={() => setAlertOpen(false)}
      onConfirm={() => {
        setAlertOpen(false);

        if (alertOnConfirm) {
          alertOnConfirm();
        }
      }}
    />
  );

  const discardAlert = (
    <ThemedAlert
      visible={discardAlertVisible}
      title="Discard walk?"
      message={
        session.tracking
          ? "You have an active walk session. Leaving now will stop tracking and discard this walk."
          : "You have an unsaved walk session. Leaving now will discard it."
      }
      cancelText="Stay"
      confirmText="Discard"
      danger
      onClose={() => setDiscardAlertVisible(false)}
      onConfirm={confirmDiscardWalk}
    />
  );

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
              onPress={handleClosePress}
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

      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: "900" }}>Walk</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Outdoor GPS walk or treadmill/home walk.
          </Text>

          {!session.tracking ? (
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <SourceButton
                theme={theme}
                label="Outdoor"
                active={session.walkSource === "outdoor"}
                onPress={() => setWalkSession({ walkSource: "outdoor" })}
              />
              <SourceButton
                theme={theme}
                label="Treadmill/Home"
                active={session.walkSource === "treadmill"}
                onPress={() => setWalkSession({ walkSource: "treadmill" })}
              />
            </View>
          ) : null}

          {session.walkSource === "outdoor" ? (
            <View
              style={{
                marginTop: 20,
                backgroundColor: theme.colors.surface,
                borderRadius: 24,
                padding: 12,
              }}
            >
              <View
                style={{
                  height: 260,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                {session.walkSource === "outdoor" && (
                  <SafeRouteMap
                    region={session.region}
                    fallbackRegion={{
                      latitude: 14.5995,
                      longitude: 120.9842,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    route={session.route}
                    showUserLocation={locationPermissionGranted}
                    strokeColor={theme.colors.primary}
                    fallbackTitle="Walk GPS ready"
                    fallbackMessage="Set a Google Maps API key to show the native map in Android builds."
                    textColor={theme.colors.text}
                    mutedTextColor={theme.colors.textMuted}
                  />
                )}
              </View>

              <Text
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  color:
                    session.gpsReady || session.isPaused
                      ? theme.colors.text
                      : theme.colors.textFaint,
                  fontWeight: "800",
                }}
              >
                {gpsStatusText()}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              marginTop: 24,
              backgroundColor: theme.colors.surface,
              borderRadius: 28,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.colors.textFaint, fontWeight: "800" }}>
              {session.walkSource === "outdoor"
                ? "OUTDOOR WALK"
                : "TREADMILL / HOME WALK"}
            </Text>

            {session.isPaused && (
              <Text
                style={{
                  marginTop: 12,
                  backgroundColor: theme.colors.text,
                  color: theme.colors.surface,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  fontWeight: "900",
                }}
              >
                PAUSED
              </Text>
            )}

            <Text style={{ fontSize: 64, fontWeight: "900", marginTop: 16 }}>
              {formatTime(session.seconds)}
            </Text>

            <Text style={{ color: theme.colors.textFaint }}>Duration</Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
              <StatBox
                theme={theme}
                label="Distance"
                value={`${displayDistanceKm.toFixed(3)} km`}
              />
              <StatBox theme={theme} label="Pace" value={paceText()} />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <StatBox theme={theme} label="Steps" value={`${session.steps}`} />
              <StatBox
                theme={theme}
                label="Speed"
                value={`${speedKmh()} km/h`}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <StatBox
                theme={theme}
                label="Calories"
                value={`${estimateCalories()} kcal`}
              />
              <StatBox
                theme={theme}
                label="Sensor Estimate"
                value={`${stepDistanceKm.toFixed(3)} km`}
              />
            </View>

            <Text
              style={{
                marginTop: 16,
                color: theme.colors.textFaint,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {distanceQualityText()}
            </Text>
          </View>

          {!session.tracking ? (
            <Pressable
              onPress={startWalking}
              style={{
                marginTop: 24,
                backgroundColor: theme.colors.text,
                padding: 18,
                borderRadius: 18,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: theme.colors.surface,
                  fontSize: 17,
                  fontWeight: "900",
                }}
              >
                Start Walk
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: 24, gap: 12 }}>
              <Pressable
                onPress={togglePauseWalk}
                style={{
                  backgroundColor: session.isPaused
                    ? theme.colors.text
                    : theme.colors.surface,
                  padding: 18,
                  borderRadius: 18,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.colors.text,
                }}
              >
                <Text
                  style={{
                    color: session.isPaused
                      ? theme.colors.surface
                      : theme.colors.text,
                    fontSize: 17,
                    fontWeight: "900",
                  }}
                >
                  {session.isPaused ? "Resume Walk" : "Pause Walk"}
                </Text>
              </Pressable>

              <Pressable
                onPress={stopWalking}
                style={{
                  backgroundColor: theme.colors.text,
                  padding: 18,
                  borderRadius: 18,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: theme.colors.surface,
                    fontSize: 17,
                    fontWeight: "900",
                  }}
                >
                  Stop
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={finishModalVisible}
          animationType="slide"
          transparent
          allowSwipeDismissal={!saving}
          onRequestClose={() => {
            if (!saving) dismissFinishModal();
          }}
          onDismiss={dismissFinishModal}
        >
          <Pressable
            onPress={() => {
              if (!saving) dismissFinishModal();
            }}
            style={{
              flex: 1,
              backgroundColor:
                theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.35)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: Math.max(20, insets.bottom + 20),
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "900" }}>
                Finish Walk
              </Text>

              <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
                Confirm distance before saving.
              </Text>

              <View style={{ marginTop: 18 }}>
                <Text style={{ fontWeight: "800" }}>Final Distance (km)</Text>

                <TextInput
                  value={manualDistanceKm}
                  onChangeText={setManualDistanceKm}
                  editable={!saving}
                  placeholder="e.g. 1.25"
                  placeholderTextColor={theme.colors.textFaint}
                  keyboardType="numeric"
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: 14,
                    padding: 14,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                />

                <Text style={{ color: theme.colors.textFaint, marginTop: 8 }}>
                  Outdoor uses GPS estimate. Treadmill/home uses sensor steps
                  and your height. You can edit it.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
                <StatBox
                  theme={theme}
                  label="Time"
                  value={formatTime(session.seconds)}
                />
                <StatBox
                  theme={theme}
                  label="Steps"
                  value={`${session.steps}`}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <StatBox
                  theme={theme}
                  label="Calories"
                  value={`${estimateCalories(
                    Number(manualDistanceKm || displayDistanceKm),
                  )} kcal`}
                />
                <StatBox
                  theme={theme}
                  label="Pace"
                  value={paceText(
                    Number(manualDistanceKm || displayDistanceKm),
                  )}
                />
              </View>

              <View style={{ marginTop: 18 }}>
                <Text style={{ fontWeight: "800" }}>Notes</Text>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  editable={!saving}
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.textFaint}
                  multiline
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: 14,
                    padding: 14,
                    minHeight: 80,
                    textAlignVertical: "top",
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                />
              </View>

              <Pressable
                onPress={saveWalk}
                disabled={saving}
                style={{
                  marginTop: 18,
                  backgroundColor: theme.colors.text,
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  opacity: saving ? 0.65 : 1,
                }}
              >
                <Text
                  style={{ color: theme.colors.surface, fontWeight: "900" }}
                >
                  {saving ? "Saving..." : "Save Walk"}
                </Text>
              </Pressable>
            </Pressable>

            {themedAlert}
            {discardAlert}
          </Pressable>
        </Modal>

        {!finishModalVisible ? themedAlert : null}
        {!finishModalVisible ? discardAlert : null}
      </View>
    </>
  );
}

function SourceButton({
  theme,
  label,
  active,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: active ? theme.colors.text : theme.colors.surfaceAlt,
        padding: 16,
        borderRadius: 16,
        alignItems: "center",
      }}
    >
      <RNText
        style={{
          color: active ? theme.colors.surface : theme.colors.text,
          fontWeight: "900",
        }}
      >
        {label}
      </RNText>
    </Pressable>
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
        alignItems: "center",
      }}
    >
      <RNText style={{ color: theme.colors.textFaint, fontSize: 12 }}>
        {label}
      </RNText>

      <RNText
        style={{
          color: theme.colors.text,
          fontSize: 17,
          fontWeight: "900",
          marginTop: 6,
          textAlign: "center",
        }}
      >
        {value}
      </RNText>
    </View>
  );
}

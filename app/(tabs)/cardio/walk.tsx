import { requestFitnessPermissions } from "@/lib/appPermissions";
import { isOnline, saveOfflineCardioSession } from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Pedometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";

type WalkSource = "outdoor" | "treadmill";

type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

const MALE_WALK_STRIDE_M = 0.78;
const USE_MOCK_WHEN_PERMISSION_DENIED = true;

async function getUserWeight() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 70;

  const { data, error } = await supabase
    .from("profiles")
    .select("weight_kg")
    .eq("user_id", user.id)
    .single();

  if (error || !data?.weight_kg) return 70;

  return Number(data.weight_kg);
}

export default function WalkScreen() {
  const router = useRouter();

  const [walkSource, setWalkSource] = useState<WalkSource>("outdoor");
  const [tracking, setTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  const [seconds, setSeconds] = useState(0);
  const [steps, setSteps] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(70);
  const [gpsDistanceKm, setGpsDistanceKm] = useState(0);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [region, setRegion] = useState<Region | null>(null);

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsReady, setGpsReady] = useState(false);

  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [manualDistanceKm, setManualDistanceKm] = useState("");
  const [notes, setNotes] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const pedometerRef = useRef<Pedometer.Subscription | null>(null);

  const lastPointRef = useRef<RoutePoint | null>(null);
  const pausedRef = useRef(false);
  const lastRawStepsRef = useRef(0);

  const stepDistanceKm = (steps * MALE_WALK_STRIDE_M) / 1000;

  const displayDistanceKm =
    walkSource === "outdoor" ? gpsDistanceKm : stepDistanceKm;

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    return () => stopWatchers();
  }, []);

  useEffect(() => {
    async function loadWeight() {
      const weight = await getUserWeight();
      setBodyWeight(weight);
    }

    loadWeight();
  }, []);

  useEffect(() => {
    if (walkSource !== "outdoor") return;

    async function initLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }

    initLocation();
  }, [walkSource]);

  function stopWatchers() {
    watchRef.current?.remove();
    watchRef.current = null;

    pedometerRef.current?.remove();
    pedometerRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mockRef.current) {
      clearInterval(mockRef.current);
      mockRef.current = null;
    }
  }

  function resetSession() {
    setSeconds(0);
    setSteps(0);
    setGpsDistanceKm(0);
    setRoute([]);
    setGpsAccuracy(null);
    setGpsReady(false);
    setManualDistanceKm("");
    setNotes("");
    setMockMode(false);
    setIsPaused(false);

    pausedRef.current = false;
    lastRawStepsRef.current = 0;
    lastPointRef.current = null;
  }

  function togglePauseWalk() {
    if (!tracking) return;
    setIsPaused((current) => !current);
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setSeconds((prev) => prev + 1);
    }, 1000);
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

  function gpsStatusText() {
    if (isPaused) return "Walk paused";
    if (mockMode) return "Mock GPS active";
    if (walkSource !== "outdoor") return "GPS disabled";
    if (!gpsAccuracy) return "Waiting for GPS...";
    if (gpsAccuracy <= 15) return `GPS good • ±${Math.round(gpsAccuracy)}m`;
    if (gpsAccuracy <= 30) return `GPS okay • ±${Math.round(gpsAccuracy)}m`;
    return `GPS weak • ±${Math.round(gpsAccuracy)}m`;
  }

  function paceText(distanceKm = displayDistanceKm) {
    if (distanceKm <= 0 || seconds <= 0) return "—";
    if (seconds < 10 || distanceKm < 0.005) return "—";

    const pace = seconds / 60 / distanceKm;
    const min = Math.floor(pace);
    const sec = Math.round((pace - min) * 60);

    return `${min}:${String(sec).padStart(2, "0")}/km`;
  }

  function speedKmh(distanceKm = displayDistanceKm) {
    if (!distanceKm || seconds <= 0) return "0.0";
    return (distanceKm / (seconds / 3600)).toFixed(1);
  }

  function estimateCalories(distanceKm = displayDistanceKm) {
    return Math.round(bodyWeight * distanceKm * 0.55);
  }

  function distanceQualityText() {
    if (isPaused) {
      return "Paused. Duration, distance, pace, steps, and route are currently frozen.";
    }

    if (mockMode) {
      return "Mock mode is active. Good for testing UI, Supabase saving, and analytics.";
    }

    if (walkSource === "treadmill") {
      return "Distance estimated from steps. You can correct it before saving.";
    }

    if (!gpsReady) {
      return "GPS is weak. Distance may be inaccurate.";
    }

    return "GPS distance is active.";
  }

  function startMockWalk() {
    resetSession();
    setTracking(true);
    setMockMode(true);

    let mockSteps = 0;
    let mockDistance = 0;

    const startPoint: RoutePoint = {
      latitude: 14.5995,
      longitude: 120.9842,
      timestamp: Date.now(),
    };

    setRoute([startPoint]);
    lastPointRef.current = startPoint;

    setRegion({
      latitude: startPoint.latitude,
      longitude: startPoint.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });

    startTimer();

    mockRef.current = setInterval(() => {
      if (pausedRef.current) return;

      mockSteps += Math.floor(2 + Math.random() * 2);
      mockDistance = (mockSteps * MALE_WALK_STRIDE_M) / 1000;

      setSteps(mockSteps);

      if (walkSource === "outdoor") {
        setGpsDistanceKm(mockDistance);

        const newPoint: RoutePoint = {
          latitude: startPoint.latitude + mockDistance / 111,
          longitude: startPoint.longitude,
          timestamp: Date.now(),
        };

        setRoute((prev) => [...prev, newPoint]);

        setRegion({
          latitude: newPoint.latitude,
          longitude: newPoint.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });

        setGpsAccuracy(10);
        setGpsReady(true);
      }
    }, 1000);
  }

  async function startWalking() {
    const permissions = await requestFitnessPermissions();

    if (!permissions.allGranted) {
      if (USE_MOCK_WHEN_PERMISSION_DENIED) {
        startMockWalk();
        return;
      }

      return;
    }

    resetSession();
    setTracking(true);

    startTimer();

    pedometerRef.current = Pedometer.watchStepCount((result) => {
      const rawSteps = result.steps;
      const previousRawSteps = lastRawStepsRef.current;
      const delta = Math.max(0, rawSteps - previousRawSteps);

      lastRawStepsRef.current = rawSteps;

      if (pausedRef.current) return;

      setSteps((prev) => prev + delta);
    });

    if (walkSource === "treadmill") return;

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    const firstPoint: RoutePoint = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      timestamp: current.timestamp,
    };

    const accuracy = current.coords.accuracy ?? null;

    setGpsAccuracy(accuracy);
    setGpsReady(isGpsReliable(accuracy));
    setRoute([firstPoint]);
    lastPointRef.current = firstPoint;

    setRegion({
      latitude: firstPoint.latitude,
      longitude: firstPoint.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const accuracy = location.coords.accuracy ?? null;

        const point: RoutePoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
        };

        setGpsAccuracy(accuracy);
        setGpsReady(isGpsReliable(accuracy));

        setRegion({
          latitude: point.latitude,
          longitude: point.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });

        if (pausedRef.current) {
          lastPointRef.current = point;
          return;
        }

        setRoute((prev) => [...prev, point]);

        const lastPoint = lastPointRef.current;

        if (lastPoint && isGpsReliable(accuracy)) {
          const addedKm = calculateDistanceKm(lastPoint, point);

          if (addedKm > 0.001 && addedKm < 0.05) {
            setGpsDistanceKm((prev) => prev + addedKm);
          }
        }

        lastPointRef.current = point;
      },
    );
  }

  function stopWalking() {
    stopWatchers();
    setTracking(false);
    setIsPaused(false);
    pausedRef.current = false;

    const finalDistance =
      walkSource === "treadmill" ? stepDistanceKm : gpsDistanceKm;

    setManualDistanceKm(finalDistance.toFixed(2));
    setFinishModalVisible(true);
  }

  function discardWalk() {
    stopWatchers();
    setTracking(false);
    setFinishModalVisible(false);
    resetSession();
  }

  async function saveWalk() {
    const finalDistanceKm = Number(manualDistanceKm || displayDistanceKm);

    if (seconds < 10) {
      Alert.alert("Too short", "Walk must be at least 10 seconds.");
      return;
    }

    if (!finalDistanceKm || finalDistanceKm <= 0) {
      Alert.alert(
        "Missing distance",
        "Enter or confirm your walking distance.",
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const payload = {
      user_id: user.id,
      session_date: new Date().toISOString().split("T")[0],
      cardio_type: "walking" as const,
      cardio_source: walkSource,
      distance_km: Number(finalDistanceKm.toFixed(3)),
      duration_seconds: seconds,
      steps,
      calories_burned: estimateCalories(finalDistanceKm),
      avg_heart_rate: null,
      notes: notes || null,
      route: walkSource === "outdoor" ? route : null,
      is_mock: mockMode,
      created_at: new Date().toISOString(),
    };

    const online = await isOnline();

    if (!online) {
      await saveOfflineCardioSession({
        temp_id: `offline_walk_${Date.now()}`,
        ...payload,
      });

      setFinishModalVisible(false);
      resetSession();

      Alert.alert(
        "Saved Offline",
        "Your walk will sync when internet is back.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );

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
      resetSession();

      Alert.alert(
        "Saved Offline",
        "Could not upload now, so your walk was saved offline.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );

      return;
    }

    setFinishModalVisible(false);
    resetSession();

    Alert.alert("Saved", "Walk saved successfully.", [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f7f7" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={{ fontSize: 30, fontWeight: "900" }}>Walk</Text>
        <Text style={{ color: "#666", marginTop: 4 }}>
          Outdoor GPS walk or treadmill/home walk.
        </Text>

        {mockMode && (
          <View
            style={{
              marginTop: 16,
              backgroundColor: "#fff3cd",
              padding: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#7a5b00" }}>
              Dev Mock Mode Active
            </Text>
            <Text style={{ color: "#7a5b00", marginTop: 4 }}>
              Permissions were denied, so this session is using simulated steps
              and distance.
            </Text>
          </View>
        )}

        {!tracking ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <SourceButton
              label="Outdoor"
              active={walkSource === "outdoor"}
              onPress={() => setWalkSource("outdoor")}
            />
            <SourceButton
              label="Treadmill/Home"
              active={walkSource === "treadmill"}
              onPress={() => setWalkSource("treadmill")}
            />
          </View>
        ) : null}

        {walkSource === "outdoor" ? (
          <View
            style={{
              marginTop: 20,
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 12,
            }}
          >
            <View
              style={{
                height: 260,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: "#eee",
              }}
            >
              <MapView
                style={{ flex: 1 }}
                region={
                  region || {
                    latitude: 14.5995,
                    longitude: 120.9842,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }
                }
                showsUserLocation={!mockMode}
                followsUserLocation={!mockMode}
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

                {route.length > 1 && (
                  <Polyline
                    coordinates={route.map((p) => ({
                      latitude: p.latitude,
                      longitude: p.longitude,
                    }))}
                    strokeWidth={5}
                  />
                )}
              </MapView>
            </View>

            <Text
              style={{
                marginTop: 10,
                textAlign: "center",
                color: gpsReady || mockMode || isPaused ? "#111" : "#777",
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
            backgroundColor: "#fff",
            borderRadius: 28,
            padding: 24,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#777", fontWeight: "800" }}>
            {walkSource === "outdoor"
              ? "OUTDOOR WALK"
              : "TREADMILL / HOME WALK"}
          </Text>

          {isPaused && (
            <Text
              style={{
                marginTop: 12,
                backgroundColor: "#111",
                color: "#fff",
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
            {formatTime(seconds)}
          </Text>

          <Text style={{ color: "#777" }}>Duration</Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
            <StatBox
              label="Distance"
              value={`${displayDistanceKm.toFixed(3)} km`}
            />
            <StatBox label="Pace" value={paceText()} />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <StatBox label="Steps" value={`${steps}`} />
            <StatBox label="Speed" value={`${speedKmh()} km/h`} />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <StatBox label="Calories" value={`${estimateCalories()} kcal`} />
            <StatBox
              label="Step Distance"
              value={`${stepDistanceKm.toFixed(3)} km`}
            />
          </View>

          <Text
            style={{
              marginTop: 16,
              color: "#777",
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {distanceQualityText()}
          </Text>
        </View>

        {!tracking ? (
          <Pressable
            onPress={startWalking}
            style={{
              marginTop: 24,
              backgroundColor: "#111",
              padding: 18,
              borderRadius: 18,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
              Start Walk
            </Text>
          </Pressable>
        ) : (
          <View style={{ marginTop: 24, gap: 12 }}>
            <Pressable
              onPress={togglePauseWalk}
              style={{
                backgroundColor: isPaused ? "#111" : "#fff",
                padding: 18,
                borderRadius: 18,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#111",
              }}
            >
              <Text
                style={{
                  color: isPaused ? "#fff" : "#111",
                  fontSize: 17,
                  fontWeight: "900",
                }}
              >
                {isPaused ? "Resume Walk" : "Pause Walk"}
              </Text>
            </Pressable>

            <Pressable
              onPress={stopWalking}
              style={{
                backgroundColor: "#111",
                padding: 18,
                borderRadius: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
                Stop
              </Text>
            </Pressable>

            <Pressable
              onPress={discardWalk}
              style={{
                backgroundColor: "#eee",
                padding: 18,
                borderRadius: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#111", fontSize: 17, fontWeight: "900" }}>
                Discard
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={finishModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900" }}>Finish Walk</Text>

            <Text style={{ color: "#666", marginTop: 6 }}>
              Confirm distance before saving.
            </Text>

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontWeight: "800" }}>Final Distance (km)</Text>
              <TextInput
                value={manualDistanceKm}
                onChangeText={setManualDistanceKm}
                placeholder="e.g. 1.25"
                keyboardType="numeric"
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 14,
                  padding: 14,
                }}
              />
              <Text style={{ color: "#777", marginTop: 8 }}>
                Outdoor uses GPS estimate. Treadmill/home uses step estimate.
                You can edit it.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
              <StatBox label="Time" value={formatTime(seconds)} />
              <StatBox label="Steps" value={`${steps}`} />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <StatBox
                label="Calories"
                value={`${estimateCalories(
                  Number(manualDistanceKm || displayDistanceKm),
                )} kcal`}
              />
              <StatBox
                label="Pace"
                value={paceText(Number(manualDistanceKm || displayDistanceKm))}
              />
            </View>

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontWeight: "800" }}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                multiline
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 14,
                  padding: 14,
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <Pressable
              onPress={saveWalk}
              style={{
                marginTop: 18,
                backgroundColor: "#111",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                Save Walk
              </Text>
            </Pressable>

            <Pressable
              onPress={discardWalk}
              style={{
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#666", fontWeight: "800" }}>Discard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SourceButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: active ? "#111" : "#eaeaea",
        padding: 16,
        borderRadius: 16,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : "#111",
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f4f4f4",
        borderRadius: 18,
        padding: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#777", fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "900",
          marginTop: 6,
          textAlign: "center",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

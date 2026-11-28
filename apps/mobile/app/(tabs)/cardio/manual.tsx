import ThemedAlert from "@/components/ThemedAlert";
import { toLocalDateKey } from "@/lib/dates";
import {
  parseManualCardioEntry,
  type ManualCardioType,
} from "@/lib/manualCardio";
import {
  getOfflineBodyWeightKg,
  isOnline,
  resolveCardioUserId,
  saveOfflineCardioSession,
} from "@/lib/offlineCardio";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ManualCardioScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cardioType, setCardioType] =
    useState<ManualCardioType>("walking");
  const [sessionDate, setSessionDate] = useState(toLocalDateKey());
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [steps, setSteps] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [notes, setNotes] = useState("");
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    goBack?: boolean;
    danger?: boolean;
  }>({ visible: false, title: "", message: "" });

  useEffect(() => {
    void getOfflineBodyWeightKg().then(setWeightKg);
  }, []);

  const inputStyle = {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: 16,
    fontSize: 16,
  } as const;

  function showError(message: string) {
    setAlert({
      visible: true,
      title: "Check entry",
      message,
      danger: true,
    });
  }

  async function saveEntry() {
    if (saving) return;

    const parsed = parseManualCardioEntry({
      sessionDate,
      cardioType,
      distanceKm,
      durationMinutes,
      steps,
      caloriesBurned,
      weightKg,
    });

    if (parsed.error || !parsed.entry) {
      showError(parsed.error || "Check the cardio details and try again.");
      return;
    }
    if (parsed.entry.sessionDate > toLocalDateKey()) {
      showError("The cardio date cannot be in the future.");
      return;
    }

    setSaving(true);
    try {
      const userId = await resolveCardioUserId();
      if (!userId) {
        showError("Open the app once while online before saving entries offline.");
        return;
      }

      const entry = parsed.entry;
      const payload = {
        user_id: userId,
        session_date: entry.sessionDate,
        cardio_type: entry.cardioType,
        cardio_source: "manual" as const,
        distance_km: entry.distanceKm,
        duration_seconds: entry.durationSeconds,
        steps: entry.steps,
        calories_burned: entry.caloriesBurned,
        avg_heart_rate: null,
        notes: notes.trim() || null,
        route: null,
        is_mock: false,
        created_at: new Date().toISOString(),
      };

      const online = await isOnline();
      if (online) {
        const { error } = await supabase.from("cardio_sessions").insert(payload);
        if (!error) {
          setAlert({
            visible: true,
            title: "Saved",
            message: "Manual cardio entry saved successfully.",
            goBack: true,
          });
          return;
        }
        console.log("Save manual cardio error:", error);
      }

      await saveOfflineCardioSession({
        temp_id: `offline_manual_cardio_${Date.now()}`,
        ...payload,
      });
      setAlert({
        visible: true,
        title: "Saved Offline",
        message: online
          ? "The upload failed, so the entry was saved offline and will sync later."
          : "The entry was saved offline and will sync when internet returns.",
        goBack: true,
      });
    } catch (error) {
      console.log("Save manual cardio error:", error);
      showError("Could not save this cardio entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <X color={theme.colors.text} size={30} />
          </Pressable>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: "900" }}>
              Add Cardio
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
              Log a completed walk or run manually.
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          <FieldLabel label="Activity" color={theme.colors.text} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["walking", "running"] as const).map((type) => {
              const selected = cardioType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setCardioType(type)}
                  style={{
                    flex: 1,
                    minHeight: 50,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected
                      ? theme.colors.primaryFill
                      : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: selected
                      ? theme.colors.primary
                      : theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: selected
                        ? theme.colors.textInverse
                        : theme.colors.text,
                      fontWeight: "900",
                    }}
                  >
                    {type === "walking" ? "Walk" : "Run"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel label="Date (YYYY-MM-DD)" color={theme.colors.text} />
          <TextInput
            value={sessionDate}
            onChangeText={setSessionDate}
            autoCapitalize="none"
            placeholder="2026-11-24"
            placeholderTextColor={theme.colors.textFaint}
            style={inputStyle}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Distance (km)" color={theme.colors.text} />
              <TextInput
                value={distanceKm}
                onChangeText={setDistanceKm}
                keyboardType="decimal-pad"
                placeholder="3.25"
                placeholderTextColor={theme.colors.textFaint}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Duration (minutes)" color={theme.colors.text} />
              <TextInput
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="decimal-pad"
                placeholder="40"
                placeholderTextColor={theme.colors.textFaint}
                style={inputStyle}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Steps (optional)" color={theme.colors.text} />
              <TextInput
                value={steps}
                onChangeText={setSteps}
                keyboardType="number-pad"
                placeholder="4200"
                placeholderTextColor={theme.colors.textFaint}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Calories (optional)" color={theme.colors.text} />
              <TextInput
                value={caloriesBurned}
                onChangeText={setCaloriesBurned}
                keyboardType="decimal-pad"
                placeholder={weightKg ? "Auto" : "0"}
                placeholderTextColor={theme.colors.textFaint}
                style={inputStyle}
              />
            </View>
          </View>

          <FieldLabel label="Notes (optional)" color={theme.colors.text} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Anything you want to remember"
            placeholderTextColor={theme.colors.textFaint}
            style={[inputStyle, { minHeight: 100, paddingTop: 14 }]}
          />

          <Text style={{ color: theme.colors.textMuted, marginTop: 12, lineHeight: 20 }}>
            {weightKg
              ? `Leave calories blank to estimate them using your latest ${weightKg.toFixed(1)} kg weight log.`
              : "Add calories manually, or log your weight first to enable an estimate."}
          </Text>

          <Pressable
            onPress={() => void saveEntry()}
            disabled={saving}
            style={{
              minHeight: 54,
              borderRadius: 18,
              backgroundColor: theme.colors.primaryFill,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 24,
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.textInverse} />
            ) : (
              <Text style={{ color: theme.colors.textInverse, fontSize: 16, fontWeight: "900" }}>
                Save Cardio Entry
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ThemedAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        danger={alert.danger}
        onClose={() => {
          const goBack = alert.goBack;
          setAlert((current) => ({ ...current, visible: false }));
          if (goBack) router.back();
        }}
        onConfirm={() => {
          const goBack = alert.goBack;
          setAlert((current) => ({ ...current, visible: false }));
          if (goBack) router.back();
        }}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ color, fontWeight: "800", marginTop: 18, marginBottom: 8 }}>
      {label}
    </Text>
  );
}

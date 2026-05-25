import EditHeightModal, { HeightForm } from "@/components/EditHeightModal";
import LogBodyWeightModal, {
  BodyWeightLogForm,
} from "@/components/LogBodyWeightModal";
import ThemedAlert from "@/components/ThemedAlert";
import { cacheOfflineBodyWeightKg, isOnline } from "@/lib/offlineCardio";
import { resolveOfflineUserId } from "@/lib/offlineUser";
import {
  cacheBodyStats,
  loadBodyWeightLogs,
  loadOfflineProfileFallback,
  logBodyWeightOffline,
  syncOfflineBodyWeightLogs,
} from "@/lib/offlineWeight";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { syncWeightReminderState } from "@/lib/weightNotifications";
import { useFocusEffect, useRouter } from "expo-router";
import { BarChart3, Ruler, Scale, UserRound } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BodyStats = {
  id: string;
  user_id: string;
  height_cm: number;
  created_at: string;
  updated_at?: string | null;
};

type BodyWeightLog = {
  id: string;
  user_id: string;
  date: string;
  logged_at: string | null;
  weight_kg: number;
  body_fat_percent: number | null;
  created_at: string;
};

type UserDetails = {
  id: string;
  email: string;
  display_name: string;
};

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLogDate(value?: string | null) {
  if (!value) return "No log yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(value?: number | null, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--";
  }

  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}${unit}`;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingWeightLog, setSavingWeightLog] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);
  const savingWeightLogRef = useRef(false);
  const savingHeightRef = useRef(false);
  const [logWeightVisible, setLogWeightVisible] = useState(false);
  const [editHeightVisible, setEditHeightVisible] = useState(false);
  const [bodyStats, setBodyStats] = useState<BodyStats | null>(null);
  const [bodyWeightLog, setBodyWeightLog] = useState<BodyWeightLog | null>(
    null,
  );
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDanger, setAlertDanger] = useState(false);

  function showAlert(title: string, message: string, danger = false) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertDanger(danger);
    setAlertOpen(true);
  }

  async function loadProfile() {
    const online = await isOnline();
    const userId = await resolveOfflineUserId();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const fallback = await loadOfflineProfileFallback();

    if (!userId) {
      setUserDetails(null);
      setBodyStats(null);
      setBodyWeightLog(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setUserDetails({
      id: userId,
      email: session?.user.email || fallback.email || "",
      display_name:
        session?.user.user_metadata?.display_name ||
        session?.user.user_metadata?.full_name ||
        "mxrvs athlete",
    });

    if (!online) {
      const logs = await loadBodyWeightLogs();
      setBodyStats(fallback.stats as BodyStats | null);
      setBodyWeightLog(
        ((logs[0] || fallback.latestWeightLog) as BodyWeightLog | null) || null,
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    await syncOfflineBodyWeightLogs();

    const [latestBodyStats, latestWeightLog] = await Promise.all([
      supabase
        .from("body_stats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_weight_logs")
        .select("*")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (latestBodyStats.error) {
      console.log("Load body stats error:", latestBodyStats.error);
    }
    if (latestWeightLog.error) {
      console.log("Load body weight log error:", latestWeightLog.error);
    }

    const weightLog = (latestWeightLog.data || null) as BodyWeightLog | null;
    const stats = (latestBodyStats.data || null) as BodyStats | null;
    setBodyStats(stats);
    setBodyWeightLog(weightLog);
    await cacheBodyStats(stats);

    if (weightLog?.weight_kg) {
      await cacheOfflineBodyWeightKg(Number(weightLog.weight_kg));
    }

    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadProfile();
  }

  function getInitialWeightLogForm(): BodyWeightLogForm {
    const now = new Date();

    return {
      date: localDateString(now),
      logged_at: now.toISOString(),
      weight_kg: bodyWeightLog?.weight_kg
        ? String(bodyWeightLog.weight_kg)
        : "",
      body_fat_percent: bodyWeightLog?.body_fat_percent != null
        ? String(bodyWeightLog.body_fat_percent)
        : "",
    };
  }

  function getInitialHeightForm(): HeightForm {
    return {
      height_cm: bodyStats?.height_cm ? String(bodyStats.height_cm) : "",
    };
  }

  async function logBodyWeight(form: BodyWeightLogForm) {
    if (savingWeightLogRef.current) return;

    savingWeightLogRef.current = true;
    const userId = await resolveOfflineUserId();

    if (!userId) {
      savingWeightLogRef.current = false;
      showAlert("Error", "No authenticated user found.", true);
      return;
    }

    const weightKg = Number(form.weight_kg);
    const bodyFatPercent = form.body_fat_percent.trim()
      ? Number(form.body_fat_percent)
      : null;

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      savingWeightLogRef.current = false;
      showAlert("Required", "Please enter a valid body weight.");
      return;
    }

    if (
      bodyFatPercent !== null &&
      (!Number.isFinite(bodyFatPercent) ||
        bodyFatPercent < 0 ||
        bodyFatPercent > 100)
    ) {
      savingWeightLogRef.current = false;
      showAlert("Invalid Body Fat", "Body fat must be between 0 and 100.", true);
      return;
    }

    try {
      setSavingWeightLog(true);
      const loggedAt = form.logged_at ? new Date(form.logged_at) : new Date();

      const payload = {
        user_id: userId,
        date: localDateString(loggedAt),
        logged_at: loggedAt.toISOString(),
        weight_kg: weightKg,
        body_fat_percent: bodyFatPercent,
      };

      if (!(await isOnline())) {
        const nextLog = await logBodyWeightOffline(payload);
        setBodyWeightLog(nextLog as BodyWeightLog);
        await cacheOfflineBodyWeightKg(Number(nextLog.weight_kg));
        await syncWeightReminderState({ allowImmediate: false });
        setLogWeightVisible(false);
        showAlert("Saved Offline", "Your weight will sync when you are online.");
        return;
      }

      const { data, error } = await supabase
        .from("body_weight_logs")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.log("Log body weight upload error:", error);
        const nextLog = await logBodyWeightOffline(payload);
        setBodyWeightLog(nextLog as BodyWeightLog);
        await cacheOfflineBodyWeightKg(Number(nextLog.weight_kg));
        setLogWeightVisible(false);
        showAlert("Saved Offline", "Your weight will sync when you are online.");
        return;
      }

      const nextLog = data as BodyWeightLog;
      setBodyWeightLog(nextLog);
      await cacheOfflineBodyWeightKg(Number(nextLog.weight_kg));
      await syncWeightReminderState({ allowImmediate: false });
      setLogWeightVisible(false);
      showAlert("Logged", "Your weight is saved for cardio estimates.");
    } catch (error) {
      console.log("Log body weight error:", error);
      showAlert("Error", "Something went wrong while logging weight.", true);
    } finally {
      savingWeightLogRef.current = false;
      setSavingWeightLog(false);
    }
  }

  async function updateHeight(form: HeightForm) {
    if (savingHeightRef.current) return;

    savingHeightRef.current = true;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      savingHeightRef.current = false;
      showAlert("Error", "No authenticated user found.", true);
      return;
    }

    const heightCm = Number(form.height_cm);

    if (!Number.isFinite(heightCm) || heightCm <= 0) {
      savingHeightRef.current = false;
      showAlert("Required", "Please enter a valid height.");
      return;
    }

    try {
      setSavingHeight(true);

      const payload = {
        user_id: user.id,
        height_cm: heightCm,
        updated_at: new Date().toISOString(),
      };

      const query = bodyStats?.id
        ? supabase
            .from("body_stats")
            .update(payload)
            .eq("id", bodyStats.id)
            .select("*")
        : supabase.from("body_stats").insert(payload).select("*");

      const { data, error } = await query.single();

      if (error) {
        showAlert("Update Failed", error.message, true);
        return;
      }

      setBodyStats(data as BodyStats);
      setEditHeightVisible(false);
      showAlert("Updated", "Your height is saved for step distance estimates.");
    } catch (error) {
      console.log("Update height error:", error);
      showAlert("Error", "Something went wrong while updating height.", true);
    } finally {
      savingHeightRef.current = false;
      setSavingHeight(false);
    }
  }

  const alert = (
    <ThemedAlert
      visible={alertOpen}
      title={alertTitle}
      message={alertMessage}
      danger={alertDanger}
      onClose={() => setAlertOpen(false)}
      onConfirm={() => setAlertOpen(false)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ marginTop: 10, color: theme.colors.textMuted }}>
            Loading profile...
          </Text>
        </View>
        {alert}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <LogBodyWeightModal
        visible={logWeightVisible}
        saving={savingWeightLog}
        initialLog={getInitialWeightLogForm()}
        onClose={() => setLogWeightVisible(false)}
        onSave={logBodyWeight}
      />

      <EditHeightModal
        visible={editHeightVisible}
        saving={savingHeight}
        initialHeight={getInitialHeightForm()}
        onClose={() => setEditHeightVisible(false)}
        onSave={updateHeight}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.border,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <UserRound size={28} color={theme.colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "900",
                color: theme.colors.text,
              }}
            >
              Profile
            </Text>
            <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
              {userDetails?.email || "Not signed in"}
            </Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: 12,
            color: theme.colors.textMuted,
            lineHeight: 20,
            fontSize: 13,
          }}
        >
          Weight drives cardio calorie estimates. Height improves treadmill and
          indoor distance estimates from step count.
        </Text>

        <View style={cardStyle(theme, 18)}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              Body Stats
            </Text>

            <Pressable
              onPress={() => router.push("/(tabs)/weight-reports" as any)}
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart3 size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatBox
              theme={theme}
              icon={<Scale size={18} color={theme.colors.primary} />}
              label="Current Weight"
              value={formatNumber(bodyWeightLog?.weight_kg, " kg")}
              featured
              detail={formatLogDate(
                bodyWeightLog?.logged_at ||
                  bodyWeightLog?.created_at ||
                  bodyWeightLog?.date,
              )}
            />
            <StatBox
              theme={theme}
              icon={<Ruler size={18} color={theme.colors.primary} />}
              label="Height"
              value={formatNumber(bodyStats?.height_cm, " cm")}
              detail="Used for indoor distance"
            />
            <StatBox
              theme={theme}
              label="Body Fat"
              value={formatNumber(bodyWeightLog?.body_fat_percent, "%")}
              detail="Optional"
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <ActionButton
              theme={theme}
              icon={<Scale size={17} color={theme.colors.textInverse} />}
              label="Log Weight"
              primary
              onPress={() => setLogWeightVisible(true)}
            />
            <ActionButton
              theme={theme}
              icon={<Ruler size={17} color={theme.colors.text} />}
              label="Edit Height"
              onPress={() => setEditHeightVisible(true)}
            />
          </View>
        </View>
      </ScrollView>

      {alert}
    </SafeAreaView>
  );
}

function cardStyle(theme: AppTheme, marginTop: number) {
  return {
    marginTop,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  };
}

function StatBox({
  theme,
  icon,
  label,
  value,
  detail,
  featured,
}: {
  theme: AppTheme;
  icon?: ReactNode;
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <View
      style={{
        marginTop: 12,
        flexGrow: 1,
        flexBasis: featured ? "100%" : "47%",
        minWidth: featured ? "100%" : 132,
        padding: 12,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ minHeight: 22 }}>{icon}</View>
      <Text style={{ marginTop: 8, color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          color: theme.colors.text,
          fontSize: featured ? 24 : 18,
          fontWeight: "900",
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={{ marginTop: 4, color: theme.colors.textFaint, fontSize: 11 }}>
        {detail}
      </Text>
    </View>
  );
}

function ActionButton({
  theme,
  icon,
  label,
  primary,
  onPress,
}: {
  theme: AppTheme;
  icon?: ReactNode;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 46,
        borderRadius: theme.radius.md,
        backgroundColor: primary ? theme.colors.primary : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: primary ? theme.colors.primary : theme.colors.border,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 6,
      }}
    >
      {icon}
      <Text
        style={{
          color: primary ? theme.colors.textInverse : theme.colors.text,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

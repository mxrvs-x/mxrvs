import BodyStatsCard from "@/components/BodyStatsCard";
import EditHeightModal, { HeightForm } from "@/components/EditHeightModal";
import EditMacroTargetModal, {
  MacroTargetForm,
} from "@/components/EditMacroTargetModal";
import EditProfileModal from "@/components/EditProfileModal";
import LogBodyWeightModal, {
  BodyWeightLogForm,
} from "@/components/LogBodyWeightModal";
import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MacroTarget = {
  id: string;
  user_id: string;
  date: string;
  goal: "cut" | "maintain" | "bulk";
  activity_level: "sedentary" | "light" | "moderate" | "active";
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  created_at: string;
};

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

function formatGoal(goal?: string) {
  if (!goal) return "—";
  return goal.charAt(0).toUpperCase() + goal.slice(1);
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLogDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingWeightLog, setSavingWeightLog] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editTargetVisible, setEditTargetVisible] = useState(false);
  const [logWeightVisible, setLogWeightVisible] = useState(false);
  const [editHeightVisible, setEditHeightVisible] = useState(false);

  const [target, setTarget] = useState<MacroTarget | null>(null);
  const [bodyStats, setBodyStats] = useState<BodyStats | null>(null);
  const [bodyWeightLog, setBodyWeightLog] = useState<BodyWeightLog | null>(
    null,
  );
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

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
    setAlertOnConfirm(() => onConfirm);
    setAlertOpen(true);
  }

  async function loadProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) console.log("Load user error:", userError);

    if (!user) {
      setTarget(null);
      setBodyStats(null);
      setBodyWeightLog(null);
      setUserDetails(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      "Marviquint Bahio";

    setUserDetails({
      id: user.id,
      email: user.email || "",
      display_name: displayName,
    });

    const [macroTarget, latestBodyStats, latestWeightLog] = await Promise.all([
      supabase
        .from("macro_targets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_stats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_weight_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (macroTarget.error) {
      console.log("Load macro target error:", macroTarget.error);
    }
    if (latestBodyStats.error) {
      console.log("Load body stats error:", latestBodyStats.error);
    }
    if (latestWeightLog.error) {
      console.log("Load body weight log error:", latestWeightLog.error);
    }

    setTarget((macroTarget.data || null) as MacroTarget | null);
    setBodyStats((latestBodyStats.data || null) as BodyStats | null);
    setBodyWeightLog((latestWeightLog.data || null) as BodyWeightLog | null);
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

  async function updateProfile(data: {
    displayName: string;
    email: string;
    password: string;
  }) {
    if (!data.displayName.trim()) {
      showAlert({
        title: "Required",
        message: "Display name is required.",
      });
      return;
    }

    if (!data.email.trim()) {
      showAlert({
        title: "Required",
        message: "Email is required.",
      });
      return;
    }

    if (data.password.trim() && data.password.trim().length < 6) {
      showAlert({
        title: "Invalid Password",
        message: "Password must be at least 6 characters.",
        danger: true,
      });
      return;
    }

    try {
      setSavingProfile(true);

      const updates: {
        email?: string;
        password?: string;
        data?: {
          display_name?: string;
          full_name?: string;
        };
      } = {
        data: {
          display_name: data.displayName.trim(),
          full_name: data.displayName.trim(),
        },
      };

      if (data.email.trim() !== userDetails?.email) {
        updates.email = data.email.trim();
      }

      if (data.password.trim()) {
        updates.password = data.password.trim();
      }

      const { data: updatedData, error } =
        await supabase.auth.updateUser(updates);

      if (error) {
        showAlert({
          title: "Update Failed",
          message: error.message,
          danger: true,
        });
        return;
      }

      setUserDetails({
        id: updatedData.user.id,
        email: updatedData.user.email || data.email.trim(),
        display_name:
          updatedData.user.user_metadata?.display_name ||
          data.displayName.trim(),
      });

      setEditVisible(false);

      showAlert({
        title: "Profile Updated",
        message: updates.email
          ? "Profile updated. Please check your new email for confirmation."
          : "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.log("Update profile error:", error);
      showAlert({
        title: "Error",
        message: "Something went wrong while updating your profile.",
        danger: true,
      });
    } finally {
      setSavingProfile(false);
    }
  }

  function getInitialTargetForm(): MacroTargetForm {
    return {
      date: target?.date || new Date().toISOString().split("T")[0],
      goal: target?.goal || "maintain",
      activity_level: target?.activity_level || "moderate",
      calories_target: target?.calories_target
        ? String(Math.round(Number(target.calories_target)))
        : "",
      protein_target_g: target?.protein_target_g
        ? String(Math.round(Number(target.protein_target_g)))
        : "",
      carbs_target_g: target?.carbs_target_g
        ? String(Math.round(Number(target.carbs_target_g)))
        : "",
      fat_target_g: target?.fat_target_g
        ? String(Math.round(Number(target.fat_target_g)))
        : "",
    };
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

  async function updateMacroTarget(form: MacroTargetForm) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showAlert({
        title: "Error",
        message: "No authenticated user found.",
        danger: true,
      });
      return;
    }

    if (
      !form.date.trim() ||
      !form.calories_target.trim() ||
      !form.protein_target_g.trim() ||
      !form.carbs_target_g.trim() ||
      !form.fat_target_g.trim()
    ) {
      showAlert({
        title: "Required",
        message: "Please complete all target fields.",
      });
      return;
    }

    try {
      setSavingTarget(true);

      const payload = {
        user_id: user.id,
        date: form.date.trim(),
        goal: form.goal,
        activity_level: form.activity_level,
        calories_target: Number(form.calories_target),
        protein_target_g: Number(form.protein_target_g),
        carbs_target_g: Number(form.carbs_target_g),
        fat_target_g: Number(form.fat_target_g),
      };

      const query = target?.id
        ? supabase
            .from("macro_targets")
            .update(payload)
            .eq("id", target.id)
            .select("*")
        : supabase.from("macro_targets").insert(payload).select("*");

      const { data, error } = await query.single();

      if (error) {
        showAlert({
          title: "Update Failed",
          message: error.message,
          danger: true,
        });
        return;
      }

      setTarget(data);
      setEditTargetVisible(false);

      showAlert({
        title: "Updated",
        message: "Your macro target has been updated.",
      });
    } catch (error) {
      console.log("Update macro target error:", error);
      showAlert({
        title: "Error",
        message: "Something went wrong while updating your target.",
        danger: true,
      });
    } finally {
      setSavingTarget(false);
    }
  }

  async function logBodyWeight(form: BodyWeightLogForm) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showAlert({
        title: "Error",
        message: "No authenticated user found.",
        danger: true,
      });
      return;
    }

    if (!form.weight_kg.trim()) {
      showAlert({
        title: "Required",
        message: "Please enter your body weight.",
      });
      return;
    }

    const bodyFatPercent = form.body_fat_percent.trim()
      ? Number(form.body_fat_percent)
      : null;

    if (
      bodyFatPercent !== null &&
      (bodyFatPercent < 0 || bodyFatPercent > 100)
    ) {
      showAlert({
        title: "Invalid Body Fat",
        message: "Body fat percentage must be between 0 and 100.",
        danger: true,
      });
      return;
    }

    try {
      setSavingWeightLog(true);
      const loggedAt = form.logged_at ? new Date(form.logged_at) : new Date();

      const payload = {
        user_id: user.id,
        date: localDateString(loggedAt),
        logged_at: loggedAt.toISOString(),
        weight_kg: Number(form.weight_kg),
        body_fat_percent: bodyFatPercent,
      };

      const { data, error } = await supabase
        .from("body_weight_logs")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        showAlert({
          title: "Log Failed",
          message: error.message,
          danger: true,
        });
        return;
      }

      setBodyWeightLog(data as BodyWeightLog);
      setLogWeightVisible(false);

      showAlert({
        title: "Logged",
        message: "Your body weight has been logged.",
      });
    } catch (error) {
      console.log("Log body weight error:", error);
      showAlert({
        title: "Error",
        message: "Something went wrong while logging your body weight.",
        danger: true,
      });
    } finally {
      setSavingWeightLog(false);
    }
  }

  async function updateHeight(form: HeightForm) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showAlert({
        title: "Error",
        message: "No authenticated user found.",
        danger: true,
      });
      return;
    }

    if (!form.height_cm.trim()) {
      showAlert({
        title: "Required",
        message: "Please enter your height.",
      });
      return;
    }

    try {
      setSavingHeight(true);

      const payload = {
        user_id: user.id,
        height_cm: Number(form.height_cm),
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
        showAlert({
          title: "Update Failed",
          message: error.message,
          danger: true,
        });
        return;
      }

      setBodyStats(data as BodyStats);
      setEditHeightVisible(false);

      showAlert({
        title: "Updated",
        message: "Your height has been updated.",
      });
    } catch (error) {
      console.log("Update height error:", error);
      showAlert({
        title: "Error",
        message: "Something went wrong while updating your height.",
        danger: true,
      });
    } finally {
      setSavingHeight(false);
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

        {themedAlert}
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <EditProfileModal
        visible={editVisible}
        saving={savingProfile}
        initialDisplayName={userDetails?.display_name || "Marviquint Bahio"}
        initialEmail={userDetails?.email || ""}
        onClose={() => setEditVisible(false)}
        onSave={updateProfile}
      />

      <EditMacroTargetModal
        visible={editTargetVisible}
        saving={savingTarget}
        initialTarget={getInitialTargetForm()}
        onClose={() => setEditTargetVisible(false)}
        onSave={updateMacroTarget}
      />

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
        style={{ flex: 1, backgroundColor: theme.colors.background }}
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
        {/* Compact header with avatar */}
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
            <Text style={{ color: theme.colors.textMuted, fontWeight: "900" }}>
              {userDetails?.display_name
                ? userDetails.display_name.slice(0, 1).toUpperCase()
                : "U"}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: theme.colors.text,
              }}
            >
              {userDetails?.display_name || "Marviquint Bahio"}
            </Text>
            <Text style={{ marginTop: 4, color: theme.colors.textMuted }}>
              {userDetails?.email || "—"}
            </Text>
          </View>

          <Pressable
            onPress={() => setEditVisible(true)}
            style={{
              paddingHorizontal: 12,
              height: 40,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accent,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.textInverse,
                fontWeight: "900",
              }}
            >
              Edit
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            marginTop: 12,
            color: theme.colors.textMuted,
            lineHeight: 20,
            fontSize: 13,
          }}
        >
          Your account details, body stats, and macro targets.
        </Text>

        <View style={cardStyle(theme, 18)}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            Account
          </Text>

          <View style={{ marginTop: 12 }}>
            <DetailRow
              theme={theme}
              label="Display Name"
              value={userDetails?.display_name || "Marviquint Bahio"}
            />
            <DetailRow
              theme={theme}
              label="Email"
              value={userDetails?.email || "—"}
              isLast
            />
          </View>
        </View>

        <BodyStatsCard
          weightKg={bodyWeightLog?.weight_kg}
          weightDate={formatLogDate(
            bodyWeightLog?.logged_at ||
              bodyWeightLog?.created_at ||
              bodyWeightLog?.date,
          )}
          heightCm={bodyStats?.height_cm}
          bodyFatPercent={bodyWeightLog?.body_fat_percent}
          onLogWeight={() => setLogWeightVisible(true)}
          onEditHeight={() => setEditHeightVisible(true)}
          onOpenReport={() =>
            router.push("/(tabs)/home/body-weight-report" as any)
          }
        />

        {!target ? (
          <View style={cardStyle(theme, 14)}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: theme.colors.text,
              }}
            >
              No macro target yet
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: theme.colors.textMuted,
                lineHeight: 20,
                fontSize: 13,
              }}
            >
              Add your goal, activity level, calories, and macro targets.
            </Text>

            <PrimaryButton
              theme={theme}
              label="Create Target"
              onPress={() => setEditTargetVisible(true)}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: theme.radius.xl,
                backgroundColor: theme.colors.primaryDark,
                borderWidth: 1,
                borderColor: theme.colors.primary,
                ...theme.shadow.card,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text style={{ color: "#D1FAE5", fontWeight: "700" }}>
                    Current Goal
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 22,
                      fontWeight: "900",
                      color: theme.colors.textInverse,
                    }}
                  >
                    {formatGoal(target.goal)}
                  </Text>
                  <Text
                    style={{ marginTop: 6, color: "#D1FAE5", fontSize: 13 }}
                  >
                    Activity: {formatGoal(target.activity_level)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setEditTargetVisible(true)}
                  style={{
                    paddingHorizontal: 12,
                    height: 36,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surfaceAlt,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 13,
                      fontWeight: "900",
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={cardStyle(theme, 14)}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    color: theme.colors.text,
                  }}
                >
                  Daily Macro Targets
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
                  Last updated:{" "}
                  {new Date(target.created_at).toLocaleDateString()}
                </Text>
              </View>

              <Text
                style={{
                  marginTop: 12,
                  fontSize: 28,
                  fontWeight: "900",
                  color: theme.colors.calories,
                }}
              >
                {Math.round(Number(target.calories_target))} kcal
              </Text>

              <View style={{ flexDirection: "row", marginTop: 14, gap: 8 }}>
                <MacroBox
                  theme={theme}
                  label="Protein"
                  value={`${Math.round(Number(target.protein_target_g))}g`}
                  color={theme.colors.protein}
                />
                <MacroBox
                  theme={theme}
                  label="Carbs"
                  value={`${Math.round(Number(target.carbs_target_g))}g`}
                  color={theme.colors.carbs}
                />
                <MacroBox
                  theme={theme}
                  label="Fat"
                  value={`${Math.round(Number(target.fat_target_g))}g`}
                  color={theme.colors.fat}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {themedAlert}
    </View>
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

function DetailRow({
  theme,
  label,
  value,
  isLast,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 15,
          fontWeight: "800",
          color: theme.colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function MacroBox({
  theme,
  label,
  value,
  color,
}: {
  theme: AppTheme;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: `${color}55`,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 15,
          fontWeight: "900",
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({
  theme,
  label,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 12,
        height: 44,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.accent,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: theme.colors.textInverse,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

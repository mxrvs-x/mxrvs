import EditMacroTargetModal, {
  MacroTargetForm,
} from "@/components/EditMacroTargetModal";
import EditProfileModal from "@/components/EditProfileModal";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  weight_kg: number;
  height_cm: number;
  goal: "cut" | "maintain" | "bulk";
  activity_level: "sedentary" | "light" | "moderate" | "active";
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
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

export default function ProfileScreen() {
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editTargetVisible, setEditTargetVisible] = useState(false);

  const [target, setTarget] = useState<MacroTarget | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  async function loadProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) console.log("Load user error:", userError);

    if (!user) {
      setTarget(null);
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

    const { data, error } = await supabase
      .from("macro_targets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.log("Load macro target error:", error);

    setTarget(data || null);
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
      Alert.alert("Required", "Display name is required.");
      return;
    }

    if (!data.email.trim()) {
      Alert.alert("Required", "Email is required.");
      return;
    }

    if (data.password.trim() && data.password.trim().length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 6 characters.",
      );
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
        Alert.alert("Update Failed", error.message);
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

      Alert.alert(
        "Profile Updated",
        updates.email
          ? "Profile updated. Please check your new email for confirmation."
          : "Your profile has been updated successfully.",
      );
    } catch (error) {
      console.log("Update profile error:", error);
      Alert.alert("Error", "Something went wrong while updating your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  function getInitialTargetForm(): MacroTargetForm {
    return {
      date: target?.date || new Date().toISOString().split("T")[0],
      weight_kg: target?.weight_kg ? String(target.weight_kg) : "",
      height_cm: target?.height_cm ? String(target.height_cm) : "",
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

  async function updateMacroTarget(form: MacroTargetForm) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "No authenticated user found.");
      return;
    }

    if (
      !form.date.trim() ||
      !form.weight_kg.trim() ||
      !form.height_cm.trim() ||
      !form.calories_target.trim() ||
      !form.protein_target_g.trim() ||
      !form.carbs_target_g.trim() ||
      !form.fat_target_g.trim()
    ) {
      Alert.alert("Required", "Please complete all target fields.");
      return;
    }

    try {
      setSavingTarget(true);

      const payload = {
        user_id: user.id,
        date: form.date.trim(),
        weight_kg: Number(form.weight_kg),
        height_cm: Number(form.height_cm),
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
        Alert.alert("Update Failed", error.message);
        return;
      }

      setTarget(data);
      setEditTargetVisible(false);
      Alert.alert("Updated", "Your macro target has been updated.");
    } catch (error) {
      console.log("Update macro target error:", error);
      Alert.alert("Error", "Something went wrong while updating your target.");
    } finally {
      setSavingTarget(false);
    }
  }

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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
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
        <Text
          style={{
            fontSize: 30,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          Profile
        </Text>

        <Text
          style={{
            marginTop: 6,
            color: theme.colors.textMuted,
            lineHeight: 20,
          }}
        >
          Your account details, body stats, and macro targets.
        </Text>

        <View style={cardStyle(theme, 24)}>
          <CardHeader
            theme={theme}
            title="User Details"
            onEdit={() => setEditVisible(true)}
          />

          <View style={{ marginTop: 16 }}>
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

        {!target ? (
          <View style={cardStyle(theme, 18)}>
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
              }}
            >
              Add your body stats, goal, calories, and macro targets.
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
                marginTop: 18,
                padding: 18,
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
                <Text style={{ color: "#D1FAE5", fontWeight: "700" }}>
                  Current Goal
                </Text>

                <Pressable
                  onPress={() => setEditTargetVisible(true)}
                  style={{
                    paddingHorizontal: 14,
                    height: 34,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.accent,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.textInverse,
                      fontSize: 13,
                      fontWeight: "900",
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>

              <Text
                style={{
                  marginTop: 8,
                  fontSize: 30,
                  fontWeight: "900",
                  color: theme.colors.textInverse,
                }}
              >
                {formatGoal(target.goal)}
              </Text>

              <Text style={{ marginTop: 8, color: "#D1FAE5" }}>
                Activity Level: {formatGoal(target.activity_level)}
              </Text>
            </View>

            <View style={cardStyle(theme, 18)}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                Body Stats
              </Text>

              <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
                <StatBox
                  theme={theme}
                  label="Weight"
                  value={`${target.weight_kg} kg`}
                />
                <StatBox
                  theme={theme}
                  label="Height"
                  value={`${target.height_cm} cm`}
                />
              </View>
            </View>

            <View style={cardStyle(theme, 18)}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                Daily Macro Targets
              </Text>

              <Text
                style={{
                  marginTop: 14,
                  fontSize: 36,
                  fontWeight: "900",
                  color: theme.colors.calories,
                }}
              >
                {Math.round(Number(target.calories_target))} kcal
              </Text>

              <View style={{ flexDirection: "row", marginTop: 18, gap: 8 }}>
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
    </SafeAreaView>
  );
}

function cardStyle(theme: AppTheme, marginTop: number) {
  return {
    marginTop,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  };
}

function CardHeader({
  theme,
  title,
  onEdit,
}: {
  theme: AppTheme;
  title: string;
  onEdit: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "900",
          color: theme.colors.text,
        }}
      >
        {title}
      </Text>

      <Pressable
        onPress={onEdit}
        style={{
          paddingHorizontal: 14,
          height: 36,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.colors.textInverse,
            fontSize: 13,
            fontWeight: "900",
          }}
        >
          Edit
        </Text>
      </Pressable>
    </View>
  );
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
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 4,
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
        padding: 14,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 5,
          fontSize: 18,
          fontWeight: "900",
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
        padding: 12,
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
          marginTop: 5,
          fontSize: 17,
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
        marginTop: 16,
        height: 46,
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

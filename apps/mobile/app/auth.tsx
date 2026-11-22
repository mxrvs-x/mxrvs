import ThemedAlert from "@/components/ThemedAlert";
import {
  authenticateBiometricSession,
  persistBiometricPreference,
  readBiometricReadiness,
} from "@/lib/authRecovery";
import { cacheOfflineUser } from "@/lib/offlineUser";
import { useTheme } from "@/lib/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigError } from "../lib/supabase";

const SAVED_EMAIL_KEY = "mxrvs_saved_email";
const BIOMETRIC_ENABLED_KEY = "mxrvs_biometric_enabled";

export default function AuthScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [biometricReady, setBiometricReady] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertConfirmText, setAlertConfirmText] = useState("OK");
  const [alertCancelText, setAlertCancelText] = useState<string | undefined>();
  const [alertDanger, setAlertDanger] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState<
    (() => void) | undefined
  >();

  useEffect(() => {
    initAuth();
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
    setAlertOnConfirm(() => onConfirm);
    setAlertOpen(true);
  }

  async function initAuth() {
    if (supabaseConfigError) {
      setChecking(false);
      return;
    }

    try {
      const readiness = await readBiometricReadiness({
        getSavedEmail: () => SecureStore.getItemAsync(SAVED_EMAIL_KEY),
        getBiometricEnabled: () =>
          SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
        getSession: async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          return session;
        },
        hasHardware: LocalAuthentication.hasHardwareAsync,
        isEnrolled: LocalAuthentication.isEnrolledAsync,
        onError: (error) => console.error("Failed to initialize auth", error),
      });

      if (readiness.savedEmail) {
        setEmail(readiness.savedEmail);
      }
      setBiometricReady(readiness.biometricReady);
    } catch (error) {
      console.error("Failed to initialize auth", error);
      setBiometricReady(false);
    } finally {
      setChecking(false);
    }
  }

  async function signIn() {
    if (supabaseConfigError) {
      showAlert({
        title: "Configuration Issue",
        message: supabaseConfigError,
        danger: true,
      });
      return;
    }

    if (!email || !password) {
      showAlert({
        title: "Missing Fields",
        message: "Enter your email and password.",
      });
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      showAlert({
        title: "Login Failed",
        message: error.message,
        danger: true,
      });
      return;
    }

    await persistBiometricPreference({
      saveEmail: () =>
        SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.trim()),
      enableBiometrics: () =>
        SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true"),
      onError: (storageError) =>
        console.error("Failed to save biometric preference", storageError),
    });
    if (data.user) {
      await cacheOfflineUser(data.user).catch((cacheError) => {
        console.error("Failed to cache signed-in user", cacheError);
      });
    }

    router.replace("/(tabs)/workouts" as any);
  }

  async function loginWithFingerprint() {
    if (supabaseConfigError) {
      showAlert({
        title: "Configuration Issue",
        message: supabaseConfigError,
        danger: true,
      });
      return;
    }

    setLoading(true);

    const result = await authenticateBiometricSession({
      authenticate: () =>
        LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock mxrvs",
          fallbackLabel: "Use passcode",
          cancelLabel: "Cancel",
        }),
      getSession: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return session;
      },
      clearBiometricPreference: () =>
        SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      onError: (biometricError) =>
        console.error("Biometric login recovery error", biometricError),
    });

    setLoading(false);

    if (result.status === "authenticated") {
      await cacheOfflineUser(result.user).catch((cacheError) => {
        console.error("Failed to cache biometric user", cacheError);
      });
      router.replace("/(tabs)/workouts" as any);
    } else if (result.status === "expired") {
      showAlert({
        title: "Session Expired",
        message: "Please login again with your email and password.",
        danger: true,
      });

      setBiometricReady(false);
    } else if (result.status === "error") {
      showAlert({
        title: "Biometric Login Failed",
        message: "Please try again or login with your email and password.",
        danger: true,
      });
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

  if (checking) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
        {themedAlert}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.xl,
                padding: 22,
                borderWidth: 1,
                borderColor: theme.colors.border,
                ...theme.shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: theme.fontSize.xxl,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                mxrvs
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  marginBottom: 24,
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSize.md,
                }}
              >
                Login to track your workouts and cardio.
              </Text>

              {supabaseConfigError ? (
                <View
                  style={{
                    padding: 14,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.danger,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.danger,
                      fontWeight: "900",
                      fontSize: theme.fontSize.md,
                    }}
                  >
                    Configuration Issue
                  </Text>

                  <Text
                    style={{
                      marginTop: 8,
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSize.sm,
                      lineHeight: 20,
                    }}
                  >
                    {supabaseConfigError}
                  </Text>
                </View>
              ) : biometricReady ? (
                loading ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Pressable
                    onPress={loginWithFingerprint}
                    style={{
                      backgroundColor: theme.colors.primary,
                      padding: 15,
                      borderRadius: theme.radius.md,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.textInverse,
                        fontWeight: "900",
                        fontSize: theme.fontSize.md,
                      }}
                    >
                      Login
                    </Text>
                  </Pressable>
                )
              ) : (
                <>
                  <Text
                    style={{
                      marginBottom: 6,
                      color: theme.colors.textMuted,
                      fontWeight: "700",
                    }}
                  >
                    Email
                  </Text>

                  <TextInput
                    placeholder="Email"
                    placeholderTextColor={theme.colors.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    value={email}
                    onChangeText={setEmail}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                      padding: 14,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.surfaceAlt,
                      marginBottom: 14,
                    }}
                  />

                  <Text
                    style={{
                      marginBottom: 6,
                      color: theme.colors.textMuted,
                      fontWeight: "700",
                    }}
                  >
                    Password
                  </Text>

                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={theme.colors.textFaint}
                    secureTextEntry
                    returnKeyType="done"
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={signIn}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                      padding: 14,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.surfaceAlt,
                      marginBottom: 18,
                    }}
                  />

                  {loading ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Pressable
                      onPress={signIn}
                      style={{
                        backgroundColor: theme.colors.primary,
                        padding: 15,
                        borderRadius: theme.radius.md,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.textInverse,
                          fontWeight: "900",
                          fontSize: theme.fontSize.md,
                        }}
                      >
                        Login with Email
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {themedAlert}
    </SafeAreaView>
  );
}

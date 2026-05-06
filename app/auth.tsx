import { useTheme } from "@/lib/theme";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "../lib/supabase";

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

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);
    const biometricEnabled = await SecureStore.getItemAsync(
      BIOMETRIC_ENABLED_KEY
    );

    if (savedEmail) {
      setEmail(savedEmail);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    setBiometricReady(
      Boolean(
        session &&
          savedEmail &&
          biometricEnabled === "true" &&
          hasHardware &&
          isEnrolled
      )
    );

    setChecking(false);
  }

  async function signIn() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
      return;
    }

    await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.trim());
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");

    router.replace("/(tabs)" as any);
  }

  async function loginWithFingerprint() {
    setLoading(true);

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock mxrvs",
      fallbackLabel: "Use passcode",
      cancelLabel: "Cancel",
    });

    if (!result.success) {
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setLoading(false);

    if (session) {
      router.replace("/(tabs)" as any);
    } else {
      Alert.alert(
        "Session expired",
        "Please login again with your email and password."
      );

      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      setBiometricReady(false);
    }
  }

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
                Login to track your fitness, food, and progress.
              </Text>

              {biometricReady ? (
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
    </SafeAreaView>
  );
}
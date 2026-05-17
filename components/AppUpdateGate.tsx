import { useTheme } from "@/lib/theme";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

type UpdateStatus = "checking" | "downloading" | "restarting" | "error";

const CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export default function AppUpdateGate() {
  const theme = useTheme();
  const lastCheckRef = useRef(0);
  const runningRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  const installUpdate = useCallback(async () => {
    setVisible(true);
    setStatus("downloading");
    setErrorMessage("");

    try {
      const fetchResult = await Updates.fetchUpdateAsync();

      if (!fetchResult.isNew && !fetchResult.isRollBackToEmbedded) {
        setVisible(false);
        return;
      }

      setStatus("restarting");
      await Updates.reloadAsync({
        reloadScreenOptions: {
          backgroundColor: theme.colors.background,
          spinner: {
            color: theme.colors.primary,
          },
        },
      });
    } catch (error) {
      console.log("OTA update download error:", error);
      setStatus("error");
      setErrorMessage("The update could not be installed. Check your connection and try again.");
    }
  }, [theme.colors.background, theme.colors.primary]);

  const checkForUpdates = useCallback(
    async (force = false) => {
      if (!Updates.isEnabled || runningRef.current) return;

      const now = Date.now();

      if (!force && now - lastCheckRef.current < CHECK_COOLDOWN_MS) {
        return;
      }

      runningRef.current = true;
      lastCheckRef.current = now;

      try {
        const checkResult = await Updates.checkForUpdateAsync();

        if (checkResult.isAvailable || checkResult.isRollBackToEmbedded) {
          await installUpdate();
        }
      } catch (error) {
        console.log("OTA update check error:", error);
      } finally {
        runningRef.current = false;
      }
    },
    [installUpdate],
  );

  useEffect(() => {
    checkForUpdates(true);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkForUpdates();
      }
    });

    return () => subscription.remove();
  }, [checkForUpdates]);

  function titleText() {
    if (status === "downloading") return "Update available";
    if (status === "restarting") return "Installing update";
    if (status === "error") return "Update failed";
    return "Checking for updates";
  }

  function messageText() {
    if (status === "downloading") {
      return "Downloading the latest preview update. The app will restart automatically.";
    }

    if (status === "restarting") {
      return "Applying the update now.";
    }

    if (status === "error") {
      return errorMessage || "The update could not be installed.";
    }

    return "Looking for a newer app update.";
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor:
            theme.mode === "dark" ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.42)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: theme.colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 22,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: theme.colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {status === "error" ? (
              <Text
                style={{
                  color: theme.colors.danger,
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                !
              </Text>
            ) : (
              <ActivityIndicator color={theme.colors.primary} />
            )}
          </View>

          <Text
            style={{
              marginTop: 18,
              color: theme.colors.text,
              fontSize: 22,
              fontWeight: "900",
            }}
          >
            {titleText()}
          </Text>

          <Text
            style={{
              marginTop: 8,
              color: theme.colors.textMuted,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {messageText()}
          </Text>

          {status === "error" ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => setVisible(false)}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 15,
                    fontWeight: "900",
                  }}
                >
                  Later
                </Text>
              </Pressable>

              <Pressable
                onPress={installUpdate}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontSize: 15,
                    fontWeight: "900",
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

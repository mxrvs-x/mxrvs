import { requestAllAppPermissions } from "@/lib/appPermissions";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

const PERMISSION_ONBOARDING_VERSION = "v1";

function permissionStorageKey(userId: string) {
  return `mxrvs_permission_onboarding_${PERMISSION_ONBOARDING_VERSION}:${userId}`;
}

export default function PostLoginPermissionGate() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const requestingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    const isAuthenticatedScreen = pathname !== "/auth" && pathname !== "/";

    if (!userId || !isAuthenticatedScreen || requestingRef.current) return;

    let cancelled = false;
    requestingRef.current = true;

    void (async () => {
      const storageKey = permissionStorageKey(userId);

      try {
        const alreadyRequested = await AsyncStorage.getItem(storageKey);
        if (alreadyRequested || cancelled) return;

        const results = await requestAllAppPermissions();
        if (cancelled) return;

        await AsyncStorage.setItem(storageKey, new Date().toISOString());

        const denied = [
          !results.activityGranted && "Physical Activity",
          !results.locationGranted && "Location",
          !results.backgroundLocationGranted && "Background Location",
          !results.notificationsGranted && "Notifications",
          !results.photosGranted && "Photos",
          !results.cameraGranted && "Camera",
        ].filter(Boolean) as string[];

        if (denied.length > 0) {
          Alert.alert(
            "Permissions need attention",
            `To use every mxrvs feature, enable ${denied.join(", ")} in your device settings.`,
            [
              { text: "Later", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        }
      } catch (error) {
        console.error("Post-login permission request error:", error);
      } finally {
        requestingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, session?.user.id]);

  return null;
}

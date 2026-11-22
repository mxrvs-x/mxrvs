export type AuthRoute = "/auth" | "/(tabs)/workouts";

type AuthUser = {
  id: string;
  email?: string | null;
};

type AuthSession = {
  user: AuthUser;
};

export async function resolveInitialAuthRoute({
  configError,
  getSession,
  cacheSessionUser,
  hasHardware,
  isEnrolled,
  authenticate,
  onError,
}: {
  configError: string | null;
  getSession: () => Promise<AuthSession | null>;
  cacheSessionUser: (user: AuthUser) => Promise<void>;
  hasHardware: () => Promise<boolean>;
  isEnrolled: () => Promise<boolean>;
  authenticate: () => Promise<{ success: boolean }>;
  onError?: (error: unknown) => void;
}): Promise<AuthRoute> {
  if (configError) return "/auth";

  try {
    const session = await getSession();
    if (!session) return "/auth";

    await cacheSessionUser(session.user);
    const [hardware, enrolled] = await Promise.all([
      hasHardware(),
      isEnrolled(),
    ]);

    if (!hardware || !enrolled) return "/(tabs)/workouts";
    return (await authenticate()).success ? "/(tabs)/workouts" : "/auth";
  } catch (error) {
    onError?.(error);
    return "/auth";
  }
}

export async function readBiometricReadiness({
  getSavedEmail,
  getBiometricEnabled,
  getSession,
  hasHardware,
  isEnrolled,
  onError,
}: {
  getSavedEmail: () => Promise<string | null>;
  getBiometricEnabled: () => Promise<string | null>;
  getSession: () => Promise<AuthSession | null>;
  hasHardware: () => Promise<boolean>;
  isEnrolled: () => Promise<boolean>;
  onError?: (error: unknown) => void;
}) {
  try {
    const [savedEmail, biometricEnabled, session, hardware, enrolled] =
      await Promise.all([
        getSavedEmail(),
        getBiometricEnabled(),
        getSession(),
        hasHardware(),
        isEnrolled(),
      ]);

    return {
      savedEmail,
      biometricReady: Boolean(
        session &&
          savedEmail &&
          biometricEnabled === "true" &&
          hardware &&
          enrolled,
      ),
    };
  } catch (error) {
    onError?.(error);
    return { savedEmail: null, biometricReady: false };
  }
}

export type BiometricLoginResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "cancelled" }
  | { status: "expired" }
  | { status: "error" };

export async function authenticateBiometricSession({
  authenticate,
  getSession,
  clearBiometricPreference,
  onError,
}: {
  authenticate: () => Promise<{ success: boolean }>;
  getSession: () => Promise<AuthSession | null>;
  clearBiometricPreference: () => Promise<void>;
  onError?: (error: unknown) => void;
}): Promise<BiometricLoginResult> {
  try {
    if (!(await authenticate()).success) return { status: "cancelled" };

    const session = await getSession();
    if (session) return { status: "authenticated", user: session.user };

    try {
      await clearBiometricPreference();
    } catch (error) {
      onError?.(error);
    }
    return { status: "expired" };
  } catch (error) {
    onError?.(error);
    return { status: "error" };
  }
}

export async function persistBiometricPreference({
  saveEmail,
  enableBiometrics,
  onError,
}: {
  saveEmail: () => Promise<void>;
  enableBiometrics: () => Promise<void>;
  onError?: (error: unknown) => void;
}) {
  try {
    await Promise.all([saveEmail(), enableBiometrics()]);
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}

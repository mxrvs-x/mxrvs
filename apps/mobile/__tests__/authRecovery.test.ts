import {
  authenticateBiometricSession,
  persistBiometricPreference,
  readBiometricReadiness,
  resolveInitialAuthRoute,
} from "../lib/authRecovery";

const user = { id: "user-1", email: "athlete@example.com" };
const session = { user };

describe("initial authentication routing", () => {
  function dependencies() {
    return {
      configError: null as string | null,
      getSession: jest.fn().mockResolvedValue(session),
      cacheSessionUser: jest.fn().mockResolvedValue(undefined),
      hasHardware: jest.fn().mockResolvedValue(true),
      isEnrolled: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue({ success: true }),
      onError: jest.fn(),
    };
  }

  it("routes configuration and missing-session states to login", async () => {
    const configured = dependencies();
    configured.configError = "Missing Supabase configuration";
    await expect(resolveInitialAuthRoute(configured)).resolves.toBe("/auth");
    expect(configured.getSession).not.toHaveBeenCalled();

    const expired = dependencies();
    expired.getSession.mockResolvedValue(null);
    await expect(resolveInitialAuthRoute(expired)).resolves.toBe("/auth");
    expect(expired.authenticate).not.toHaveBeenCalled();
  });

  it("caches a valid user and bypasses biometrics when unavailable", async () => {
    const deps = dependencies();
    deps.hasHardware.mockResolvedValue(false);

    await expect(resolveInitialAuthRoute(deps)).resolves.toBe(
      "/(tabs)/workouts",
    );
    expect(deps.cacheSessionUser).toHaveBeenCalledWith(user);
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("routes successful biometrics to workouts and cancellation to login", async () => {
    const success = dependencies();
    await expect(resolveInitialAuthRoute(success)).resolves.toBe(
      "/(tabs)/workouts",
    );

    const cancelled = dependencies();
    cancelled.authenticate.mockResolvedValue({ success: false });
    await expect(resolveInitialAuthRoute(cancelled)).resolves.toBe("/auth");
  });

  it("recovers route lookup failures by returning to login", async () => {
    const deps = dependencies();
    deps.getSession.mockRejectedValue(new Error("session failed"));

    await expect(resolveInitialAuthRoute(deps)).resolves.toBe("/auth");
    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("biometric readiness", () => {
  function dependencies() {
    return {
      getSavedEmail: jest.fn().mockResolvedValue("athlete@example.com"),
      getBiometricEnabled: jest.fn().mockResolvedValue("true"),
      getSession: jest.fn().mockResolvedValue(session),
      hasHardware: jest.fn().mockResolvedValue(true),
      isEnrolled: jest.fn().mockResolvedValue(true),
      onError: jest.fn(),
    };
  }

  it("enables biometrics only when every prerequisite exists", async () => {
    await expect(readBiometricReadiness(dependencies())).resolves.toEqual({
      savedEmail: "athlete@example.com",
      biometricReady: true,
    });

    const missingSession = dependencies();
    missingSession.getSession.mockResolvedValue(null);
    await expect(readBiometricReadiness(missingSession)).resolves.toEqual({
      savedEmail: "athlete@example.com",
      biometricReady: false,
    });
  });

  it("returns a safe disabled state when SecureStore fails", async () => {
    const deps = dependencies();
    deps.getSavedEmail.mockRejectedValue(new Error("secure storage failed"));

    await expect(readBiometricReadiness(deps)).resolves.toEqual({
      savedEmail: null,
      biometricReady: false,
    });
    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("biometric session recovery", () => {
  function dependencies() {
    return {
      authenticate: jest.fn().mockResolvedValue({ success: true }),
      getSession: jest.fn().mockResolvedValue(session),
      clearBiometricPreference: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(),
    };
  }

  it("distinguishes cancellation from an authenticated session", async () => {
    const cancelled = dependencies();
    cancelled.authenticate.mockResolvedValue({ success: false });
    await expect(authenticateBiometricSession(cancelled)).resolves.toEqual({
      status: "cancelled",
    });
    expect(cancelled.getSession).not.toHaveBeenCalled();

    await expect(
      authenticateBiometricSession(dependencies()),
    ).resolves.toEqual({ status: "authenticated", user });
  });

  it("clears biometric preference for an expired session", async () => {
    const deps = dependencies();
    deps.getSession.mockResolvedValue(null);

    await expect(authenticateBiometricSession(deps)).resolves.toEqual({
      status: "expired",
    });
    expect(deps.clearBiometricPreference).toHaveBeenCalledTimes(1);
  });

  it("still reports expiration when SecureStore cleanup fails", async () => {
    const deps = dependencies();
    deps.getSession.mockResolvedValue(null);
    deps.clearBiometricPreference.mockRejectedValue(
      new Error("secure storage failed"),
    );

    await expect(authenticateBiometricSession(deps)).resolves.toEqual({
      status: "expired",
    });
    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns a recoverable error when authentication APIs throw", async () => {
    const deps = dependencies();
    deps.authenticate.mockRejectedValue(new Error("biometric failure"));

    await expect(authenticateBiometricSession(deps)).resolves.toEqual({
      status: "error",
    });
    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("biometric preference persistence", () => {
  it("does not reject a valid login when SecureStore writing fails", async () => {
    const onError = jest.fn();

    await expect(
      persistBiometricPreference({
        saveEmail: jest.fn().mockRejectedValue(new Error("write failed")),
        enableBiometrics: jest.fn().mockResolvedValue(undefined),
        onError,
      }),
    ).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

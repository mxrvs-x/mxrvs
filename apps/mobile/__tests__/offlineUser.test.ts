import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));

jest.mock("@/lib/androidStepTracker", () => ({
  setNativeAndroidBodyMetrics: jest.fn(),
}));

import {
  cacheOfflineUser,
  getOfflineUserEmail,
  getOfflineUserId,
  resolveOfflineUserId,
} from "../lib/offlineUser";
import { setNativeAndroidBodyMetrics } from "../lib/androidStepTracker";
import { supabase } from "../lib/supabase";

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockSetNativeAndroidBodyMetrics =
  setNativeAndroidBodyMetrics as jest.MockedFunction<
    typeof setNativeAndroidBodyMetrics
  >;

describe("offline user identity resolution", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSetNativeAndroidBodyMetrics.mockResolvedValue(null);
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it("caches a user ID and email for offline access", async () => {
    await cacheOfflineUser({ id: "user-1", email: "athlete@example.com" });

    await expect(getOfflineUserId()).resolves.toBe("user-1");
    await expect(getOfflineUserEmail()).resolves.toBe("athlete@example.com");
  });

  it("clears a previous email when the replacement user has none", async () => {
    await cacheOfflineUser({ id: "user-1", email: "first@example.com" });
    await cacheOfflineUser({ id: "user-2", email: null });

    await expect(getOfflineUserId()).resolves.toBe("user-2");
    await expect(getOfflineUserEmail()).resolves.toBeNull();
  });

  it("clears user-scoped caches but preserves pending queues on account change", async () => {
    await cacheOfflineUser({ id: "user-1", email: "first@example.com" });
    await AsyncStorage.multiSet([
      ["cached_workouts", "cached workout data"],
      ["cached_body_weight_logs", "cached weight data"],
      ["offline_cardio_weight_kg", "70"],
      ["offline_workouts", "pending workouts"],
      ["offline_creatine_logs", "pending creatine"],
    ]);

    await cacheOfflineUser({ id: "user-2", email: "second@example.com" });

    await expect(AsyncStorage.getItem("cached_workouts")).resolves.toBeNull();
    await expect(
      AsyncStorage.getItem("cached_body_weight_logs"),
    ).resolves.toBeNull();
    await expect(
      AsyncStorage.getItem("offline_cardio_weight_kg"),
    ).resolves.toBeNull();
    await expect(AsyncStorage.getItem("offline_workouts")).resolves.toBe(
      "pending workouts",
    );
    await expect(AsyncStorage.getItem("offline_creatine_logs")).resolves.toBe(
      "pending creatine",
    );
    expect(mockSetNativeAndroidBodyMetrics).toHaveBeenCalledWith(null, null);
  });

  it("resolves and caches the active session user first", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "session-user", email: "session@example.com" },
        },
      },
      error: null,
    });

    await expect(resolveOfflineUserId()).resolves.toBe("session-user");
    await expect(getOfflineUserEmail()).resolves.toBe("session@example.com");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("falls back to the network user when there is no session", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "network-user", email: "network@example.com" },
      },
      error: null,
    });

    await expect(resolveOfflineUserId()).resolves.toBe("network-user");
    await expect(getOfflineUserId()).resolves.toBe("network-user");
    await expect(getOfflineUserEmail()).resolves.toBe("network@example.com");
  });

  it("tries the network user when session lookup throws", async () => {
    mockGetSession.mockRejectedValue(new Error("session unavailable"));
    mockGetUser.mockResolvedValue({
      data: { user: { id: "network-user", email: null } },
      error: null,
    });

    await expect(resolveOfflineUserId()).resolves.toBe("network-user");
    expect(consoleLog).toHaveBeenCalledWith(
      "Resolve session user error:",
      expect.any(Error),
    );
  });

  it("uses the cached user when both online lookups are unavailable", async () => {
    await cacheOfflineUser({ id: "cached-user", email: "cached@example.com" });
    mockGetSession.mockRejectedValue(new Error("session unavailable"));
    mockGetUser.mockRejectedValue(new Error("network unavailable"));

    await expect(resolveOfflineUserId()).resolves.toBe("cached-user");
    await expect(getOfflineUserEmail()).resolves.toBe("cached@example.com");
  });

  it("returns null when no online or cached identity exists", async () => {
    await expect(resolveOfflineUserId()).resolves.toBeNull();
  });
});

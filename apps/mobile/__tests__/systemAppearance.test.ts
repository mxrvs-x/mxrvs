import { Appearance, AppState } from "react-native";
import { readSystemAppearance, subscribeSystemAppearance } from "../lib/systemAppearance";

jest.mock("react-native", () => ({
  Appearance: { addChangeListener: jest.fn(), getColorScheme: jest.fn() },
  AppState: { addEventListener: jest.fn() },
  Platform: { OS: "android" },
  TurboModuleRegistry: { get: () => ({ getColorScheme: mockReadNativeScheme }) },
}));

const mockReadNativeScheme = jest.fn();
const removeAppearance = jest.fn();
const removeAppState = jest.fn();

beforeEach(() => {
  jest.mocked(Appearance.getColorScheme).mockReturnValue("dark");
  mockReadNativeScheme.mockReset().mockReturnValue("dark");
  jest.mocked(Appearance.addChangeListener).mockReturnValue({ remove: removeAppearance });
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: removeAppState });
});

it("picks up a missed overnight theme change when the app returns to the foreground", () => {
  const onChange = jest.fn();
  const stop = subscribeSystemAppearance(onChange);
  const onAppState = jest.mocked(AppState.addEventListener).mock.calls[0][1];

  onAppState("background");
  mockReadNativeScheme.mockReturnValue("light");
  expect(onChange.mock.calls).toEqual([["dark"]]);
  onAppState("active");
  expect(onChange.mock.calls).toEqual([["dark"], ["light"]]);

  stop();
  expect(removeAppearance).toHaveBeenCalledTimes(1);
  expect(removeAppState).toHaveBeenCalledTimes(1);
});

it("responds to system theme events while the app is open", () => {
  const onChange = jest.fn();
  const stop = subscribeSystemAppearance(onChange);
  const onAppearance = jest.mocked(Appearance.addChangeListener).mock.calls[0][0];

  onAppearance({ colorScheme: "light" });
  onAppearance({ colorScheme: "dark" });

  expect(onChange.mock.calls).toEqual([["dark"], ["light"], ["dark"]]);
  stop();
});

it("falls back to the public appearance when the native read fails", () => {
  mockReadNativeScheme.mockImplementation(() => { throw new Error("Activity unavailable"); });
  expect(readSystemAppearance()).toBe("dark");
  jest.mocked(Appearance.getColorScheme).mockImplementation(() => { throw new Error("Appearance unavailable"); });
  expect(readSystemAppearance()).toBeNull();
});

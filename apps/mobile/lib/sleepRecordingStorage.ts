import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type NativeSleepStorage = {
  setSleepWidgetOwnerAsync?: (owner: string | null, legacy: string | null) => Promise<void>;
  getSleepRecordingAsync?: (owner: string) => Promise<string | null>;
  replaceSleepRecordingAsync?: (owner: string, expected: string | null, next: string | null) => Promise<boolean>;
};

const native = Platform.OS === "android"
  ? requireOptionalNativeModule<NativeSleepStorage>("MxrvsStepTracker")
  : null;
const storageKey = (owner: string) => `sleep-recording:v1:${owner}`;
let ownerUpdate = Promise.resolve();

export function setSleepWidgetOwner(owner: string | null) {
  if (!native?.setSleepWidgetOwnerAsync) return;
  ownerUpdate = ownerUpdate.then(async () => {
    const legacy = owner ? await AsyncStorage.getItem(storageKey(owner)) : null;
    await native.setSleepWidgetOwnerAsync!(owner, legacy);
    if (owner && legacy !== null) await AsyncStorage.removeItem(storageKey(owner));
  }).catch((error) => console.warn("Could not update the sleep widget", error));
}

export async function loadSleepRecording(owner: string) {
  await ownerUpdate;
  return native?.getSleepRecordingAsync
    ? native.getSleepRecordingAsync(owner)
    : AsyncStorage.getItem(storageKey(owner));
}

export async function storeSleepRecording(owner: string, expected: string | null, next: string | null) {
  await ownerUpdate;
  if (native?.replaceSleepRecordingAsync) return native.replaceSleepRecordingAsync(owner, expected, next);
  if (next === null) await AsyncStorage.removeItem(storageKey(owner));
  else await AsyncStorage.setItem(storageKey(owner), next);
  return true;
}

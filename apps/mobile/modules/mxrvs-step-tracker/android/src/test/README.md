# Native step-tracker unit tests

`StepTrackerStoreTest.kt` uses Robolectric to verify sensor baselines, reboot
counter resets, body metrics, activity archives, vehicle state, and widget
refresh throttling without requiring a physical device.

This repository does not commit Expo's generated `apps/mobile/android` project
or Gradle wrapper. Generate it and run the module tests with:

```sh
npm run mobile:android
cd apps/mobile/android
./gradlew :mxrvs-step-tracker:testDebugUnitTest
```

On Windows, use `gradlew.bat` for the final command. Dependency resolution for
Robolectric and AndroidX also requires network access on the first run.

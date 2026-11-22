# End-to-end smoke tests

The repository includes lightweight Maestro flows for the Android development
build. They deliberately avoid adding a test runner to the npm dependency tree.

## Prerequisites

1. Configure Supabase in the normal project `.env` file.
2. Create or select a non-production test account with no sensitive data.
3. Install the [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro).
4. Build and install the Android development app:

   ```bash
   npm run mobile:android
   ```

The flows target the Android application ID `com.anonymous.mxrvs` from
`apps/mobile/app.json`.

## Run the unauthenticated smoke test

This clears application state and verifies the login screen without requiring
credentials:

```bash
maestro test .maestro/login-screen.yaml
```

## Run authenticated navigation

Provide the dedicated test account through environment variables. Do not put
credentials in YAML or commit them to the repository.

PowerShell:

```powershell
$env:E2E_EMAIL = "test-account@example.com"
$env:E2E_PASSWORD = "replace-with-test-password"
maestro test .maestro/authenticated-navigation.yaml
```

Bash:

```bash
E2E_EMAIL="test-account@example.com" \
E2E_PASSWORD="replace-with-test-password" \
maestro test .maestro/authenticated-navigation.yaml
```

The authenticated flow verifies login and navigation across Workouts, Cardio,
Creatine, and Profile. It clears app state at startup, so it must not be run
against an account whose local-only queued data needs to be preserved.

## Current execution boundary

These flows require an emulator or physical Android device and cannot run as
part of the repository's Node/Jest suite. Native permission prompts can differ
by Android version; grant the app's notification/activity permissions during
device setup so the navigation smoke test remains deterministic.

The web workspace currently has unit coverage but no browser runner dependency.
Authenticated web browser smoke coverage should be added only when a CI browser
environment and disposable Supabase credentials are available.

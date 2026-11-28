# mxrvs

This repository is split into separate mobile and web apps using npm workspaces.

- `apps/mobile` contains the Expo Router mobile app.
- `apps/web` contains the Next.js web app.

## Get Started

Install dependencies:

```bash
npm install
```

Start the mobile app:

```bash
npm run mobile
```

Start the web app:

```bash
npm run web
```

The mobile app keeps its Expo file-based routes in `apps/mobile/app`. The web app uses the Next.js app router in `apps/web/app`.

## Useful Scripts

- `npm run mobile` starts Expo.
- `npm run mobile:android` runs the Android development build.
- `npm run mobile:ios` runs the iOS development build.
- `npm run mobile:web` starts Expo web for the mobile project.
- `npm run web` starts the Next.js development server.
- `npm run web:build` builds the Next.js web app.
- `npm run lint` runs linting across workspaces.

## Environment

The Expo config in `apps/mobile/app.config.js` reads `.env` from either `apps/mobile/.env` or the repository root `.env`.

### HERA

Set `GROQ_API_KEY` and `AI_ASSISTANT_USER_ID` in the Next.js server environment. For local development, use `apps/web/.env.local`. For deployment, set them in the web host's environment settings. The user ID is your UUID in Supabase under **Authentication → Users**.

Set `EXPO_PUBLIC_AI_API_URL` in the mobile environment to the web deployment's assistant endpoint, such as `https://your-web-app.example/api/assistant`, then restart Expo or include it in your next build.

Open **HERA** (Health, Exercise and Recovery Assistant) with the floating sparkles button on web or mobile. Ask about workout sets, cardio, activity, macros, sleep, weight, or creatine. The latest chat is saved on the current browser or phone for your account, up to 101 messages. Select **New chat** to clear it and get different suggested questions. The assistant sends recent conversation turns and relevant fitness records to Groq when you ask a question. Only the configured account can send messages, and the assistant reads records through that account's Supabase permissions.

The assistant combines permanent coaching rules, the current user profile, relevant Supabase records, and recent conversation turns. To set your profile, add optional JSON to `AI_ASSISTANT_PROFILE` in the web server environment. Both apps use the same profile.

```dotenv
AI_ASSISTANT_PROFILE='{"timeZone":"Asia/Manila","weekStartsOn":"sunday"}'
```

Add any current text fields that apply, such as `goal`, `phase`, `trainingExperience`, `equipment`, `trainingPreferences`, `foodPreferences`, `foodBudget`, or `schedule`. The optional `nutritionTargets` object accepts daily numbers for `calories`, `proteinGrams`, `carbGrams`, and `fatGrams`. The profile is sent to Groq with the chat. Update it when your goals or targets change. If you leave the profile empty, the assistant uses the device time zone, Sunday-start calendar weeks, and whatever relevant facts you share or have logged.

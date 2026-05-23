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

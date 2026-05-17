const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (!key || process.env[key]) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnv();

if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
}

module.exports = ({ config }) => {
  const mapsApiKey = process.env.MAPS_API_KEY;
  const geminiApiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    ...config,
    extra: {
      ...config.extra,
      geminiApiKey,
    },
    android: {
      ...config.android,
      config: mapsApiKey
        ? {
            ...config.android?.config,
            googleMaps: {
              ...config.android?.config?.googleMaps,
              apiKey: mapsApiKey,
            },
          }
        : config.android?.config,
    },
  };
};

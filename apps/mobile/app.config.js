const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const envPaths = [
    path.join(__dirname, ".env"),
    path.resolve(__dirname, "../../.env"),
  ];
  const envPath = envPaths.find((candidate) => fs.existsSync(candidate));

  if (!envPath) return;

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

module.exports = ({ config }) => {
  const mapsApiKey = process.env.MAPS_API_KEY;

  return {
    ...config,
    extra: config.extra,
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

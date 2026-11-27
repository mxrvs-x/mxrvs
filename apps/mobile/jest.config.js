// Use the React Native fetch mock rather than Expo's native fetch in Jest.
process.env.EXPO_PUBLIC_USE_RN_FETCH = "1";

module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.[jt]s?(x)"],
};

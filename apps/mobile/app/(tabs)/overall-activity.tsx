import { Redirect } from "expo-router";

export default function OverallActivityRedirect() {
  return <Redirect href={{ pathname: "/cardio", params: { view: "daily" } }} />;
}

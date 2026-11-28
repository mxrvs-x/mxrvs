import { redirect } from "next/navigation";

export default function OverallActivityPage() {
  redirect("/pages/cardio?view=daily");
}

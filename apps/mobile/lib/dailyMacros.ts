export const macroFields = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
] as const;

type MacroKey = (typeof macroFields)[number]["key"];
export type MacroDraft = Record<MacroKey, string>;
export type DailyMacroLog = Record<MacroKey, number> & { log_date: string };

export function formatMacroDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const emptyMacros: MacroDraft = {
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
};

export function macroToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isMacroDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseMacros(draft: MacroDraft) {
  const values = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const { key, label } of macroFields) {
    const input = draft[key].trim().replace(",", ".");
    const number = Number(input);
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(input) || number > 9_999_999_999.99) {
      return { error: `Enter a valid ${label.toLowerCase()} amount with up to two decimal places.` } as const;
    }
    values[key] = number;
  }
  return { values } as const;
}

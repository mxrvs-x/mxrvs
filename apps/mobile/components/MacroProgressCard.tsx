import { AppTheme } from "@/lib/theme";
import { Pressable, Text, View } from "react-native";
import type { DimensionValue } from "react-native";

type NutritionTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type NutritionTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function percent(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 999);
}

function progressWidth(current: number, target: number): DimensionValue {
  if (!target || target <= 0) return "0%";
  return `${Math.min((current / target) * 100, 100)}%` as DimensionValue;
}

function MacroProgressRow({
  theme,
  label,
  current,
  target,
  unit,
  color,
}: {
  theme: AppTheme;
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const percentage = percent(current, target);

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 5,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 16,
            fontWeight: "900",
          }}
        >
          {label}{" "}
          <Text style={{ fontWeight: "400" }}>
            - {Math.round(current)} / {Math.round(target)} {unit}
          </Text>
        </Text>

        <Text
          style={{
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {percentage}%
        </Text>
      </View>

      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: progressWidth(current, target),
            height: "100%",
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export default function MacroProgressCard({
  theme,
  totals,
  targets,
  goalLabel,
  activityLevel,
  hasMacroTarget,
  onPress,
}: {
  theme: AppTheme;
  totals: NutritionTotals;
  targets: NutritionTargets;
  goalLabel: string;
  activityLevel: string;
  hasMacroTarget: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.surface,

        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 18,

        marginBottom: 10,

        borderTopWidth: 1,
        borderBottomWidth: 1,

        borderColor: theme.colors.border,

        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,

        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          Goal: {goalLabel}
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          Activity: {activityLevel}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 18,
            color: theme.colors.text,
            fontWeight: "900",
          }}
        >
          Targets
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          Consumed
        </Text>
      </View>

      {!hasMacroTarget && (
        <Text
          style={{
            color: theme.colors.warning,
            marginBottom: 4,
            fontSize: 12,
          }}
        >
          No Supabase macro target found. Using fallback targets.
        </Text>
      )}

      <MacroProgressRow
        theme={theme}
        label="Energy"
        current={totals.calories}
        target={targets.calories}
        unit="kcal"
        color={theme.colors.calories}
      />

      <MacroProgressRow
        theme={theme}
        label="Protein"
        current={totals.protein_g}
        target={targets.protein_g}
        unit="g"
        color={theme.colors.protein}
      />

      <MacroProgressRow
        theme={theme}
        label="Carbs"
        current={totals.carbs_g}
        target={targets.carbs_g}
        unit="g"
        color={theme.colors.carbs}
      />

      <MacroProgressRow
        theme={theme}
        label="Fat"
        current={totals.fat_g}
        target={targets.fat_g}
        unit="g"
        color={theme.colors.fat}
      />
    </Pressable>
  );
}

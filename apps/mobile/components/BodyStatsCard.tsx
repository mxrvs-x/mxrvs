import { AppTheme, useTheme } from "@/lib/theme";
import { Pressable, Text, View } from "react-native";

type Props = {
  weightKg?: number | null;
  weightDate?: string | null;
  heightCm?: number | null;
  bodyFatPercent?: number | null;
  onLogWeight: () => void;
  onEditHeight: () => void;
  onOpenReport: () => void;
};

function formatValue(value?: number | null, unit?: string) {
  if (value === null || value === undefined) return "--";
  return unit ? `${value} ${unit}` : String(value);
}

export default function BodyStatsCard({
  weightKg,
  weightDate,
  heightCm,
  bodyFatPercent,
  onLogWeight,
  onEditHeight,
  onOpenReport,
}: Props) {
  const theme = useTheme();
  const hasWeightLog = weightKg !== null && weightKg !== undefined;

  return (
    <View
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            Body Stats
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            {hasWeightLog
              ? weightDate
                ? `Latest weight log: ${weightDate}`
                : "Latest weight log"
              : "Log your current weight to start daily tracking."}
          </Text>
        </View>

        <Pressable
          onPress={onLogWeight}
          style={{
            paddingHorizontal: 12,
            height: 36,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.accent,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.accent,
          }}
        >
          <Text
            style={{
              color: theme.colors.textInverse,
              fontSize: 13,
              fontWeight: "900",
            }}
          >
            Log Weight
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginTop: 12,
          gap: 8,
        }}
      >
        <StatBox
          theme={theme}
          label="Current Weight"
          value={formatValue(weightKg, "kg")}
        />
        <StatBox
          theme={theme}
          label="Height"
          value={formatValue(heightCm, "cm")}
        />
        <StatBox
          theme={theme}
          label="Body Fat"
          value={
            bodyFatPercent === null || bodyFatPercent === undefined
              ? "--"
              : `${bodyFatPercent}%`
          }
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        }}
      >
        <Pressable
          onPress={onEditHeight}
          style={{
            alignSelf: "flex-start",
            marginTop: 12,
            paddingHorizontal: 12,
            height: 34,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            Edit Height
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenReport}
          style={{
            alignSelf: "flex-start",
            marginTop: 12,
            paddingHorizontal: 12,
            height: 34,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            View Weight Report
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatBox({
  theme,
  label,
  value,
}: {
  theme: AppTheme;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "31%",
        minWidth: 96,
        padding: 12,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 16,
          fontWeight: "900",
          color: theme.colors.text,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

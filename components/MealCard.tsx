import { AppTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, SaladIcon, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealFoodLog = {
  id: string;
  meal_type: MealType;
  quantity: number;
  unit: string;

  food_name?: string | null;
  food_brand?: string | null;
  food_source?: string | null;
  external_id?: string | null;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  foods?: {
    name: string;
    brand: string | null;
    source: "custom" | "usda_fdc" | "nccdb";
  } | null;
};

function n(value?: number | null) {
  return Number(value ?? 0);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

export default function MealCard({
  theme,
  title,
  mealType,
  date,
  logs,
}: {
  theme: AppTheme;
  title: string;
  mealType: MealType;
  date: string;
  logs: MealFoodLog[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const mealTotals = logs.reduce(
    (acc, item) => {
      acc.calories += n(item.calories);
      acc.protein_g += n(item.protein_g);
      acc.carbs_g += n(item.carbs_g);
      acc.fat_g += n(item.fat_g);
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        marginBottom: 10,

        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 20,

        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: isOpen
            ? theme.colors.surfaceAlt
            : theme.colors.surface,
        }}
      >
        <View
          style={{
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/diary/add-food" as never,
                params: { mealType, date },
              })
            }
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Plus size={20} color={theme.colors.primary} />
          </Pressable>

          <Pressable
            onPress={() => setIsOpen((value) => !value)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {title}
              </Text>

              <Text
                style={{
                  marginTop: 4,
                  color: theme.colors.textMuted,
                  fontSize: 13,
                }}
              >
                {logs.length} item{logs.length === 1 ? "" : "s"} ·{" "}
                {Math.round(mealTotals.calories)} kcal
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              {isOpen ? (
                <ChevronUp size={20} color={theme.colors.text} />
              ) : (
                <ChevronDown size={22} color={theme.colors.text} />
              )}

              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                P {Math.round(mealTotals.protein_g)} · C{" "}
                {Math.round(mealTotals.carbs_g)} · F{" "}
                {Math.round(mealTotals.fat_g)}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {isOpen && (
        <View
          style={{
            backgroundColor: theme.colors.surface,
          }}
        >
          {logs.length === 0 ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 18,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <Text
                style={{
                  color: theme.colors.textFaint,
                  fontSize: 14,
                }}
              >
                No foods logged yet.
              </Text>
            </View>
          ) : (
            logs.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/diary/food-log-detail" as never,
                    params: { logId: item.id },
                  })
                }
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",

                    marginRight: 12,
                  }}
                >
                  <SaladIcon size={30} color={theme.colors.primary} />
                </View>

                <View
                  style={{
                    flex: 1,
                    paddingRight: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "900",
                      color: theme.colors.text,
                    }}
                  >
                    {item.foods?.name ?? item.food_name ?? "Unknown food"}
                  </Text>

                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 13,
                      marginTop: 3,
                    }}
                  >
                    {Number(item.quantity)} {item.unit}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: theme.colors.text,
                    }}
                  >
                    {Math.round(item.calories)}
                  </Text>

                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.colors.textMuted,
                    }}
                  >
                    kcal
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}
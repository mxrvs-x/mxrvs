import ThemedAlert from "@/components/ThemedAlert";
import { AppTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  ImageDown,
  Plus,
  SaladIcon,
  Share2,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import Svg, { Circle } from "react-native-svg";

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

function macroPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function sourceLabel(source?: string | null) {
  if (source === "usda_fdc") return "USDA";
  if (source === "nccdb") return "AU";
  return "CUSTOM";
}

function MacroDonutChart({
  theme,
  calories,
  protein,
  carbs,
  fat,
  size = 118,
  strokeWidth = 14,
}: {
  theme: AppTheme;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
  strokeWidth?: number;
}) {
  const proteinCalories = protein * 4;
  const carbsCalories = carbs * 4;
  const fatCalories = fat * 9;

  const macroCaloriesTotal = proteinCalories + carbsCalories + fatCalories;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    {
      key: "Protein",
      value: proteinCalories,
      color: theme.colors.protein,
    },
    {
      key: "Carbs",
      value: carbsCalories,
      color: theme.colors.carbs,
    },
    {
      key: "Fat",
      value: fatCalories,
      color: theme.colors.fat,
    },
  ];

  let offset = 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {macroCaloriesTotal > 0 &&
          segments.map((segment) => {
            const dash = (segment.value / macroCaloriesTotal) * circumference;
            const strokeDasharray = `${dash} ${circumference - dash}`;
            const strokeDashoffset = -offset;

            offset += dash;

            return (
              <Circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })}
      </Svg>

      <View
        style={{
          position: "absolute",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: theme.colors.text,
          }}
        >
          {Math.round(calories)}
        </Text>

        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: theme.colors.textMuted,
          }}
        >
          kcal
        </Text>
      </View>
    </View>
  );
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
  const [exporting, setExporting] = useState(false);
  const [exportCardReady, setExportCardReady] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const exportCardRef = useRef<View>(null);

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

  const proteinCalories = mealTotals.protein_g * 4;
  const carbsCalories = mealTotals.carbs_g * 4;
  const fatCalories = mealTotals.fat_g * 9;
  const macroCaloriesTotal = proteinCalories + carbsCalories + fatCalories;

  const proteinPercent = macroPercent(proteinCalories, macroCaloriesTotal);
  const carbsPercent = macroPercent(carbsCalories, macroCaloriesTotal);
  const fatPercent = macroPercent(fatCalories, macroCaloriesTotal);

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  function waitForExportCard() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, exportCardReady ? 50 : 150);
      });
    });
  }

  async function captureMealImage() {
    if (!exportCardRef.current) return null;

    await waitForExportCard();

    const uri = await captureRef(exportCardRef.current, {
      format: "png",
      quality: 1,
      fileName: `mxrvs-${mealType}-meal`,
      result: "tmpfile",
    });

    return uri;
  }

  async function exportMealImage() {
    if (exporting) return;

    try {
      setExporting(true);

      const uri = await captureMealImage();

      if (!uri) {
        showAlert("Export Failed", "Meal image is not ready yet.");
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
      ]);

      if (!permission.granted) {
        showAlert(
          "Permission Required",
          "Please allow photo access so mxrvs can save meal images.",
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);

      showAlert("Saved", "Meal image saved to your gallery.");
    } catch (error) {
      console.log("Export meal image error:", error);
      showAlert(
        "Export Failed",
        "Something went wrong while saving the meal image.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function shareMealImage() {
    if (exporting) return;

    try {
      setExporting(true);

      const uri = await captureMealImage();

      if (!uri) {
        showAlert("Share Failed", "Meal image is not ready yet.");
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        showAlert("Sharing Unavailable", "Sharing is not available here.");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `${title} Meal Share`,
        UTI: "public.png",
      });
    } catch (error) {
      console.log("Share meal image error:", error);
      showAlert(
        "Share Failed",
        "Something went wrong while sharing the meal image.",
      );
    } finally {
      setExporting(false);
    }
  }

  function renderLeftActions() {
    return (
      <View
        style={{
          width: 92,
          marginBottom: 10,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          onPress={shareMealImage}
          disabled={exporting}
          style={{
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
            opacity: exporting ? 0.55 : 1,
          }}
        >
          <Share2 size={24} color={theme.colors.background} />

          <Text
            style={{
              marginTop: 6,
              fontSize: 11,
              fontWeight: "900",
              color: theme.colors.background,
              textAlign: "center",
            }}
          >
            Share
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderRightActions() {
    return (
      <View
        style={{
          width: 92,
          marginBottom: 10,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          onPress={exportMealImage}
          disabled={exporting}
          style={{
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
            opacity: exporting ? 0.55 : 1,
          }}
        >
          <ImageDown size={24} color={theme.colors.background} />
          <Text
            style={{
              marginTop: 6,
              fontSize: 11,
              fontWeight: "900",
              color: theme.colors.background,
              textAlign: "center",
            }}
          >
            Export
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
      >
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
      </Swipeable>

      <View
        ref={exportCardRef}
        collapsable={false}
        onLayout={() => setExportCardReady(true)}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 380,
          transform: [{ translateX: -10000 }],
          backgroundColor: theme.colors.background,
          padding: 18,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 18,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: theme.colors.text,
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "700",
              color: theme.colors.textMuted,
            }}
          >
            {date} · {logs.length} item{logs.length === 1 ? "" : "s"}
          </Text>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 18,
            }}
          >
            <MacroDonutChart
              theme={theme}
              calories={mealTotals.calories}
              protein={mealTotals.protein_g}
              carbs={mealTotals.carbs_g}
              fat={mealTotals.fat_g}
            />

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "900",
                  color: theme.colors.text,
                }}
              >
                {Math.round(mealTotals.calories)}
              </Text>

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: theme.colors.textMuted,
                  marginBottom: 12,
                }}
              >
                total calories
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: theme.colors.protein,
                }}
              >
                Protein ({proteinPercent}%) -{" "}
                {Math.round(mealTotals.protein_g)}g
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: theme.colors.carbs,
                  marginTop: 6,
                }}
              >
                Carbs ({carbsPercent}%) - {Math.round(mealTotals.carbs_g)}g
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: theme.colors.fat,
                  marginTop: 6,
                }}
              >
                Fat ({fatPercent}%) - {Math.round(mealTotals.fat_g)}g
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 18,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              paddingTop: 14,
            }}
          >
            {logs.length === 0 ? (
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textMuted,
                }}
              >
                No foods logged yet.
              </Text>
            ) : (
              logs.map((item) => {
                const foodName =
                  item.foods?.name ?? item.food_name ?? "Unknown food";
                const brand = item.foods?.brand ?? item.food_brand;
                const source = item.foods?.source ?? item.food_source;

                return (
                  <View
                    key={`export-${item.id}`}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "900",
                            color: theme.colors.text,
                          }}
                        >
                          {foodName}
                        </Text>

                        <Text
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            fontWeight: "700",
                            color: theme.colors.textMuted,
                          }}
                        >
                          {brand ? `${brand} · ` : ""}
                          {sourceLabel(source)}
                        </Text>

                        <Text
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            color: theme.colors.textMuted,
                          }}
                        >
                          {Number(item.quantity)} {item.unit}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "900",
                            color: theme.colors.text,
                          }}
                        >
                          {Math.round(item.calories)}
                        </Text>

                        <Text
                          style={{
                            fontSize: 11,
                            color: theme.colors.textMuted,
                          }}
                        >
                          kcal
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: "800",
                        color: theme.colors.textMuted,
                      }}
                    >
                      P {Math.round(item.protein_g)}g · C{" "}
                      {Math.round(item.carbs_g)}g · F {Math.round(item.fat_g)}g
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}

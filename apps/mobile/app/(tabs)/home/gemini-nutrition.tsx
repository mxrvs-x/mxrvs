import ThemedAlert from "@/components/ThemedAlert";
import {
  askGeminiNutrition,
  NutritionAnalysis,
  type GeminiNutritionResponse,
} from "@/lib/geminiNutrition";
import { supabase } from "@/lib/supabase";
import { AppTheme, useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Astroid, Plus, SendHorizonal, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  analysis?: NutritionAnalysis | null;
};

type MealType = "breakfast" | "snack" | "lunch" | "dinner";

const MEAL_OPTIONS: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "snack", label: "Snack" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

const EXAMPLE_PROMPT =
  "Analyze this recipe: 200g chicken breast, 150g cooked rice, 1 tbsp olive oil, 80g broccoli. 1 serving.";

const BRAND_EXAMPLE_PROMPT =
  "Find macros per serving for Gardenia Classic White Bread.";

function n(value?: number | null) {
  return Number(value ?? 0);
}

function hasCoreMacros(analysis?: NutritionAnalysis | null) {
  const macros = analysis?.macro_breakdown;

  return Boolean(
    macros &&
      macros.calories !== null &&
      macros.protein_g !== null &&
      macros.carbohydrates_g !== null &&
      macros.fat_g !== null,
  );
}

function parseServingGrams(value?: string | null) {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return match ? Number(match[1]) : 100;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMacro(value?: number | null, unit = "g") {
  if (value === null || value === undefined) return "Missing";
  if (unit === "kcal" || unit === "mg") return `${Math.round(value)} ${unit}`;
  return `${n(value).toFixed(1)}${unit}`;
}

function analysisKey(analysis?: NutritionAnalysis | null) {
  if (!analysis) return "";

  const macros = analysis.macro_breakdown;

  return [
    analysis.food_summary.name.trim().toLowerCase(),
    analysis.food_summary.estimated_serving_size.trim().toLowerCase(),
    Math.round(n(macros.calories)),
    n(macros.protein_g).toFixed(1),
    n(macros.carbohydrates_g).toFixed(1),
    n(macros.fat_g).toFixed(1),
  ].join("|");
}

export default function GeminiNutritionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingMealType, setLoggingMealType] = useState<MealType | null>(null);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [savedAnalysisKeys, setSavedAnalysisKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const latestAnalysis = useMemo(
    () => [...messages].reverse().find((message) => message.analysis)?.analysis,
    [messages],
  );
  const latestAnalysisKey = analysisKey(latestAnalysis);
  const latestAnalysisSaved =
    Boolean(latestAnalysisKey) && savedAnalysisKeys.has(latestAnalysisKey);
  const canUseLatestAnalysis =
    Boolean(latestAnalysis) && hasCoreMacros(latestAnalysis);

  function showAlert(title: string, message: string) {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }

  useEffect(() => {
    let active = true;

    async function checkExistingFood() {
      if (
        !latestAnalysis ||
        !latestAnalysisKey ||
        !hasCoreMacros(latestAnalysis)
      ) {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const { data, error } = await supabase
        .from("foods")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "custom")
        .eq("brand", "Gemini estimate")
        .eq("name", latestAnalysis.food_summary.name.trim() || "Gemini Recipe")
        .eq(
          "serving_name",
          latestAnalysis.food_summary.estimated_serving_size || "Serving",
        )
        .maybeSingle();

      if (!active || error || !data?.id) return;

      setSavedAnalysisKeys((current) => {
        const next = new Set(current);
        next.add(latestAnalysisKey);
        return next;
      });
    }

    checkExistingFood();

    return () => {
      active = false;
    };
  }, [latestAnalysis, latestAnalysisKey]);

  async function askGemini() {
    const prompt = input.trim();

    if (!prompt || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: prompt,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const result = await askGeminiNutrition(prompt);
      const assistantMessage = buildAssistantMessage(result);

      setMessages((current) => [...current, assistantMessage]);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gemini could not respond.";

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          text: `Gemini error: ${message}`,
          analysis: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function buildAssistantMessage(
    result: GeminiNutritionResponse,
  ): ChatMessage {
    return {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      text: result.answer,
      analysis: result.analysis,
    };
  }

  async function addLatestToCustomFoods() {
    if (!hasCoreMacros(latestAnalysis) || saving || latestAnalysisSaved) return;

    const analysis = latestAnalysis!;
    const macros = analysis.macro_breakdown;
    const servingSize = parseServingGrams(
      analysis.food_summary.estimated_serving_size,
    );

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showAlert("Not signed in", "Please sign in first.");
        return;
      }

      const { error } = await supabase.from("foods").insert({
        user_id: user.id,
        source: "custom",
        name: analysis.food_summary.name.trim() || "Gemini Recipe",
        brand: "Gemini estimate",
        serving_name: analysis.food_summary.estimated_serving_size || "Serving",
        serving_size: servingSize,
        serving_unit: "g",
        calories: Math.round(n(macros.calories)),
        protein_g: n(macros.protein_g),
        carbs_g: n(macros.carbohydrates_g),
        fat_g: n(macros.fat_g),
        fiber_g: n(macros.fiber_g),
        sugar_g: n(macros.sugar_g),
        sodium_mg: Math.round(n(macros.sodium_mg)),
        cholesterol_mg: 0,
      });

      if (error) throw error;

      setSavedAnalysisKeys((current) => {
        const next = new Set(current);
        next.add(latestAnalysisKey);
        return next;
      });
      showAlert("Added", "Gemini estimate was added to your custom foods.");
    } catch (error: any) {
      showAlert("Could not add food", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function addLatestToDiary(mealType: MealType) {
    if (!hasCoreMacros(latestAnalysis) || loggingMealType) return;

    const analysis = latestAnalysis!;
    const macros = analysis.macro_breakdown;
    const servingSize = parseServingGrams(
      analysis.food_summary.estimated_serving_size,
    );

    try {
      setLoggingMealType(mealType);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        showAlert("Not signed in", "Please sign in first.");
        return;
      }

      const { error } = await supabase.from("food_logs").insert({
        user_id: user.id,
        food_id: null,
        food_name: analysis.food_summary.name.trim() || "Gemini Recipe",
        food_brand: "Gemini estimate",
        food_source: "custom",
        external_id: null,
        date: formatDateKey(new Date()),
        meal_type: mealType,
        quantity: 1,
        unit: "serving",
        serving_size: servingSize,
        serving_unit: "g",
        calories: Math.round(n(macros.calories)),
        protein_g: n(macros.protein_g),
        carbs_g: n(macros.carbohydrates_g),
        fat_g: n(macros.fat_g),
        fiber_g: n(macros.fiber_g),
        sugar_g: n(macros.sugar_g),
        sodium_mg: Math.round(n(macros.sodium_mg)),
        cholesterol_mg: 0,
      });

      if (error) throw error;

      setMealPickerOpen(false);
      showAlert("Added to diary", `Gemini estimate was added to ${mealType}.`);
      router.push("/(tabs)/diary");
    } catch (error: any) {
      showAlert("Could not add to diary", error?.message ?? "Please try again.");
    } finally {
      setLoggingMealType(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === "android" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
        }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Astroid size={22} color={theme.colors.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 24,
                fontWeight: "900",
              }}
            >
              Gemini Nutrition
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
              Ask for recipe macros, then save estimates as custom foods.
            </Text>
          </View>
        </View>

        {messages.length === 0 ? (
          <EmptyState
            theme={theme}
            onUseExample={() => setInput(EXAMPLE_PROMPT)}
            onUseBrandExample={() => setInput(BRAND_EXAMPLE_PROMPT)}
          />
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} theme={theme} />
        ))}

        {loading ? (
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>
              Gemini is analyzing nutrition...
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          padding: 14,
          paddingBottom: insets.bottom + 14,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          gap: 10,
        }}
      >
        {canUseLatestAnalysis ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={addLatestToCustomFoods}
                disabled={saving || latestAnalysisSaved}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: latestAnalysisSaved
                    ? theme.colors.surfaceAlt
                    : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 10,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color={theme.colors.textInverse} />
                ) : (
                  <Plus
                    size={18}
                    color={
                      latestAnalysisSaved
                        ? theme.colors.textMuted
                        : theme.colors.textInverse
                    }
                  />
                )}
                <Text
                  numberOfLines={2}
                  style={{
                    color: latestAnalysisSaved
                      ? theme.colors.textMuted
                      : theme.colors.textInverse,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  {latestAnalysisSaved ? "Saved to Custom" : "Custom Foods"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMealPickerOpen((value) => !value)}
                disabled={!!loggingMealType}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: mealPickerOpen
                    ? theme.colors.primaryDark
                    : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 10,
                  opacity: loggingMealType ? 0.7 : 1,
                }}
              >
                <Plus size={18} color={theme.colors.textInverse} />
                <Text
                  style={{
                    color: theme.colors.textInverse,
                    fontWeight: "900",
                  }}
                >
                  Diary
                </Text>
              </Pressable>
            </View>

            {mealPickerOpen ? (
              <View
                style={{
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                  padding: 10,
                  gap: 8,
                }}
              >
                <Text
                  style={{ color: theme.colors.text, fontWeight: "900" }}
                >
                  Choose meal
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {MEAL_OPTIONS.map((meal) => {
                    const logging = loggingMealType === meal.key;

                    return (
                      <Pressable
                        key={meal.key}
                        onPress={() => addLatestToDiary(meal.key)}
                        disabled={!!loggingMealType}
                        style={{
                          minHeight: 38,
                          borderRadius: theme.radius.pill,
                          paddingHorizontal: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: theme.colors.surface,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          opacity: loggingMealType && !logging ? 0.5 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontWeight: "900",
                          }}
                        >
                          {logging ? "Adding..." : meal.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={{
            minHeight: 52,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            gap: 10,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Paste a recipe or ask for food macros..."
            placeholderTextColor={theme.colors.textFaint}
            multiline
            style={{
              flex: 1,
              maxHeight: 96,
              paddingVertical: 10,
              color: theme.colors.text,
              fontWeight: "700",
            }}
          />
          <Pressable
            onPress={askGemini}
            disabled={loading || !input.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.pill,
              backgroundColor:
                loading || !input.trim()
                  ? theme.colors.surfaceAlt
                  : theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SendHorizonal
              size={19}
              color={
                loading || !input.trim()
                  ? theme.colors.textMuted
                  : theme.colors.textInverse
              }
            />
          </Pressable>
        </View>
      </View>
      <ThemedAlert
        visible={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function EmptyState({
  theme,
  onUseExample,
  onUseBrandExample,
}: {
  theme: AppTheme;
  onUseExample: () => void;
  onUseBrandExample: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Sparkles size={22} color={theme.colors.primary} />
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: "900",
          marginTop: 10,
        }}
      >
        Recipe macro assistant
      </Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 20, marginTop: 6 }}>
        Include ingredient amounts for recipes, or enter a brand and product
        name to search macros per official serving.
      </Text>
      <View
        style={{
          marginTop: 14,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <ExampleButton theme={theme} label="Recipe Example" onPress={onUseExample} />
        <ExampleButton
          theme={theme}
          label="Brand Example"
          onPress={onUseBrandExample}
        />
      </View>
    </View>
  );
}

function ExampleButton({
  theme,
  label,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MessageBubble({
  message,
  theme,
}: {
  message: ChatMessage;
  theme: AppTheme;
}) {
  const isUser = message.role === "user";

  return (
    <View
      style={{
        marginTop: 12,
        alignSelf: isUser ? "flex-end" : "stretch",
        maxWidth: isUser ? "86%" : "100%",
        borderRadius: theme.radius.lg,
        padding: 14,
        backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
        borderWidth: isUser ? 0 : 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: isUser ? theme.colors.textInverse : theme.colors.text,
          lineHeight: 20,
          fontWeight: isUser ? "800" : "700",
        }}
      >
        {message.text}
      </Text>

      {message.analysis ? (
        <AnalysisCard analysis={message.analysis} theme={theme} />
      ) : null}
    </View>
  );
}

function AnalysisCard({
  analysis,
  theme,
}: {
  analysis: NutritionAnalysis;
  theme: AppTheme;
}) {
  const macros = analysis.macro_breakdown;

  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        padding: 12,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {analysis.food_summary.name}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>
        Serving: {analysis.food_summary.estimated_serving_size}
      </Text>

      <MacroRow theme={theme} label="Calories" value={formatMacro(macros.calories, "kcal")} />
      <MacroRow theme={theme} label="Protein" value={formatMacro(macros.protein_g)} />
      <MacroRow
        theme={theme}
        label="Carbs"
        value={formatMacro(macros.carbohydrates_g)}
      />
      <MacroRow theme={theme} label="Fat" value={formatMacro(macros.fat_g)} />
      <MacroRow theme={theme} label="Fiber" value={formatMacro(macros.fiber_g)} />
      <MacroRow theme={theme} label="Sugar" value={formatMacro(macros.sugar_g)} />
      <MacroRow
        theme={theme}
        label="Sodium"
        value={formatMacro(macros.sodium_mg, "mg")}
      />

      <ReviewList
        theme={theme}
        title="Potential health concerns"
        items={analysis.ingredient_quality_review.potential_health_concerns}
      />
      <ReviewList
        theme={theme}
        title="Allergen warnings"
        items={analysis.ingredient_quality_review.allergen_warnings}
      />

      <Text
        style={{
          color: theme.colors.text,
          fontWeight: "900",
          marginTop: 12,
        }}
      >
        Confidence: {analysis.confidence_level}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>
        {analysis.confidence_explanation}
      </Text>
    </View>
  );
}

function MacroRow({
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
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 10,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function ReviewList({
  theme,
  title,
  items,
}: {
  theme: AppTheme;
  title: string;
  items: string[];
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {title}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: 4, lineHeight: 19 }}>
        {items.length ? items.join("; ") : "None flagged."}
      </Text>
    </View>
  );
}

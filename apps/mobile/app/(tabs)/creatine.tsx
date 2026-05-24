import ActivityCalendar from "@/components/ActivityCalendar";
import {
  type CreatineLog,
  deleteCreatineLog,
  loadCreatineLogs,
  logCreatineForDate,
  toDateKey,
} from "@/lib/creatine";
import { syncCreatineReminderState } from "@/lib/creatineNotifications";
import { useTheme } from "@/lib/theme";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { CalendarCheck2, Check, Minus, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function CreatineScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const today = useMemo(() => toDateKey(new Date()), []);
  const now = new Date();

  const [logs, setLogs] = useState<CreatineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today);

  const selectedLog = useMemo(
    () => logs.find((log) => log.date === selectedDate) ?? null,
    [logs, selectedDate],
  );

  async function loadLogs(showLoader = false) {
    if (showLoader) setLoading(true);

    const net = await NetInfo.fetch();
    setOffline(!net.isConnected || net.isInternetReachable === false);

    const data = await loadCreatineLogs();

    setLogs(data);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadLogs(true);
      syncCreatineReminderState({ allowImmediate: false });
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadLogs(false);
    await syncCreatineReminderState({ allowImmediate: false });
  }

  async function handleLogCreatine() {
    try {
      setSaving(true);
      await logCreatineForDate({ date: selectedDate, grams: 5 });
      await loadLogs(false);
      await syncCreatineReminderState({ allowImmediate: false });
    } catch (error) {
      Alert.alert(
        "Could not log creatine",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLog() {
    if (!selectedLog) return;

    try {
      setSaving(true);
      await deleteCreatineLog(selectedLog);
      await loadLogs(false);
      await syncCreatineReminderState({ allowImmediate: false });
    } finally {
      setSaving(false);
    }
  }

  const activeDates = useMemo(() => {
    const map: Record<string, CreatineLog> = {};

    logs.forEach((log) => {
      map[log.date] = log;
    });

    return map;
  }, [logs]);

  const currentMonthLogs = useMemo(
    () =>
      logs.filter((log) => {
        const date = new Date(`${log.date}T00:00:00`);
        return (
          date.getFullYear() === calendarYear &&
          date.getMonth() === calendarMonth
        );
      }),
    [calendarMonth, calendarYear, logs],
  );

  const handleVisibleMonthChange = useCallback((month: number, year: number) => {
    setCalendarMonth(month);
    setCalendarYear(year);
  }, []);

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  Daily supplement
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 30,
                    fontWeight: "900",
                    marginTop: 2,
                  }}
                >
                  Creatine
                </Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 18,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 16,
                ...theme.shadow.card,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 22,
                      fontWeight: "900",
                    }}
                  >
                    {selectedLog ? "Logged" : "Not logged"}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      marginTop: 4,
                      fontWeight: "700",
                    }}
                  >
                    {formatDate(selectedDate)}
                    {selectedLog?.offline ? " - waiting to sync" : ""}
                  </Text>
                </View>

                <View
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: theme.radius.pill,
                    backgroundColor: selectedLog
                      ? theme.colors.primarySoft
                      : theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: selectedLog
                      ? theme.colors.primary
                      : theme.colors.border,
                  }}
                >
                  {selectedLog ? (
                    <Check size={30} color={theme.colors.primary} />
                  ) : (
                    <Minus size={30} color={theme.colors.textFaint} />
                  )}
                </View>
              </View>

              <Pressable
                disabled={saving}
                onPress={selectedLog ? handleDeleteLog : handleLogCreatine}
                style={{
                  marginTop: 16,
                  minHeight: 48,
                  borderRadius: theme.radius.md,
                  backgroundColor: selectedLog
                    ? theme.colors.surfaceAlt
                    : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {selectedLog ? (
                  <X size={18} color={theme.colors.text} />
                ) : (
                  <Check size={18} color={theme.colors.textInverse} />
                )}
                <Text
                  style={{
                    color: selectedLog
                      ? theme.colors.text
                      : theme.colors.textInverse,
                    fontWeight: "900",
                  }}
                >
                  {selectedLog ? "Remove Log" : "Log 5g"}
                </Text>
              </Pressable>

              {offline ? (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Offline logs are saved on this device and sync when you are
                  online.
                </Text>
              ) : null}
            </View>

            <ActivityCalendar
              activeDates={activeDates}
              marker="💊"
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onVisibleMonthChange={handleVisibleMonthChange}
              cardStyle={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            />
            <View
              style={{
                marginTop: 18,
                marginBottom: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <CalendarCheck2 size={18} color={theme.colors.primary} />
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 20,
                    fontWeight: "900",
                  }}
                >
                  Attendance
                </Text>
              </View>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontWeight: "900",
                }}
              >
                {currentMonthLogs.length} this month
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              No creatine logs yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 16,
              marginBottom: 12,
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
                    color: theme.colors.text,
                    fontSize: 17,
                    fontWeight: "900",
                  }}
                >
                  {formatDate(item.date)}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    marginTop: 3,
                    fontWeight: "700",
                  }}
                >
                  {item.grams}g creatine
                  {item.offline ? " - waiting to sync" : ""}
                </Text>
              </View>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={18} color={theme.colors.primary} />
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}


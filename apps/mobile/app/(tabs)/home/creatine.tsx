import {
  type CreatineLog,
  deleteCreatineLog,
  loadCreatineLogs,
  logCreatineForDate,
  toDateKey,
} from "@/lib/creatine";
import { syncCreatineReminderState } from "@/lib/creatineNotifications";
import { AppTheme, useTheme } from "@/lib/theme";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import {
  Bell,
  CalendarCheck2,
  Check,
  ExpandIcon,
  Minus,
  X,
} from "lucide-react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  const selectedLog = useMemo(
    () => logs.find((log) => log.date === selectedDate) ?? null,
    [logs, selectedDate],
  );

  const todayLog = useMemo(
    () => logs.find((log) => log.date === today) ?? null,
    [logs, today],
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

  const weekDays = useMemo(() => {
    const date = new Date();
    const dayOfWeek = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);

      return {
        day: d.getDate(),
        date: toDateKey(d),
        label: ["S", "M", "T", "W", "T", "F", "S"][index],
      };
    });
  }, []);

  const monthDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const firstWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: string | null; day: number | null }[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push({ date: null, day: null });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(calendarYear, calendarMonth, day);
      days.push({ date: toDateKey(date), day });
    }

    return days;
  }, [calendarMonth, calendarYear]);

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

  function changeMonth(direction: "prev" | "next") {
    const nextDate = new Date(calendarYear, calendarMonth, 1);

    if (direction === "prev") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    setCalendarMonth(nextDate.getMonth());
    setCalendarYear(nextDate.getFullYear());
  }

  function monthTitle() {
    return new Date(calendarYear, calendarMonth, 1).toLocaleDateString(
      "en-PH",
      {
        month: "long",
        year: "numeric",
      },
    );
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 14,
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

              <View
                style={{
                  borderRadius: theme.radius.pill,
                  backgroundColor: todayLog
                    ? theme.colors.primarySoft
                    : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: todayLog
                    ? theme.colors.primary
                    : theme.colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                {todayLog ? (
                  <Check size={16} color={theme.colors.primary} />
                ) : (
                  <Bell size={16} color={theme.colors.warning} />
                )}
                <Text
                  style={{
                    color: theme.colors.text,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  {todayLog ? "Done" : "Due"}
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

            <View
              style={{
                marginTop: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 14,
              }}
            >
              {!calendarExpanded ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 16,
                        fontWeight: "900",
                      }}
                    >
                      This Week
                    </Text>

                    <Pressable
                      onPress={() => setCalendarExpanded(true)}
                      style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: theme.radius.md,
                      }}
                    >
                      <ExpandIcon size={18} color={theme.colors.primary} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {weekDays.map((item) => {
                      const isSelected = selectedDate === item.date;
                      const isToday = item.date === today;
                      const hasLog = Boolean(activeDates[item.date]);

                      return (
                        <CalendarDay
                          key={item.date}
                          theme={theme}
                          label={item.label}
                          day={item.day}
                          selected={isSelected}
                          today={isToday}
                          logged={hasLog}
                          onPress={() => setSelectedDate(item.date)}
                        />
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => changeMonth("prev")}
                      style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: "900" }}>‹</Text>
                    </Pressable>

                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 16,
                        fontWeight: "900",
                      }}
                    >
                      {monthTitle()}
                    </Text>
                    <Pressable
                      onPress={() => changeMonth("next")}
                      style={{
                        backgroundColor: theme.colors.surfaceAlt,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: "900" }}>›</Text>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", marginBottom: 6 }}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                      <Text
                        key={`${day}-${index}`}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          color: theme.colors.textMuted,
                          fontWeight: "800",
                          fontSize: 11,
                        }}
                      >
                        {day}
                      </Text>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {monthDays.map((item, index) => {
                      const isSelected = item.date === selectedDate;
                      const isToday = item.date === today;
                      const hasLog = item.date
                        ? Boolean(activeDates[item.date])
                        : false;

                      return (
                        <Pressable
                          key={`${item.date || "empty"}-${index}`}
                          disabled={!item.date}
                          onPress={() => {
                            if (item.date) setSelectedDate(item.date);
                          }}
                          style={{
                            width: `${100 / 7}%`,
                            paddingVertical: 4,
                            alignItems: "center",
                          }}
                        >
                          {item.day ? (
                            <View
                              style={{
                                width: 36,
                                height: 42,
                                borderRadius: theme.radius.md,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isSelected
                                  ? theme.colors.primary
                                  : isToday
                                    ? theme.colors.primarySoft
                                    : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  color: isSelected
                                    ? theme.colors.textInverse
                                    : theme.colors.text,
                                  fontSize: 13,
                                  fontWeight: "900",
                                }}
                              >
                                {item.day}
                              </Text>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  marginTop: 4,
                                  backgroundColor: hasLog
                                    ? isSelected
                                      ? theme.colors.textInverse
                                      : theme.colors.primary
                                    : "transparent",
                                }}
                              />
                            </View>
                          ) : (
                            <View style={{ width: 36, height: 42 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    onPress={() => setCalendarExpanded(false)}
                    style={{ padding: 10, alignItems: "center" }}
                  >
                    <X size={24} color={theme.colors.primary} />
                  </Pressable>
                </>
              )}
            </View>

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
    </View>
  );
}

function CalendarDay({
  theme,
  label,
  day,
  selected,
  today,
  logged,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  day: number;
  selected: boolean;
  today: boolean;
  logged: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 76,
        backgroundColor: selected
          ? theme.colors.primary
          : today
            ? theme.colors.primarySoft
            : theme.colors.background,
        borderRadius: theme.radius.md,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: selected ? theme.colors.textInverse : theme.colors.textMuted,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: "900",
          color: selected ? theme.colors.textInverse : theme.colors.text,
        }}
      >
        {day}
      </Text>

      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          marginTop: 8,
          backgroundColor: logged
            ? selected
              ? theme.colors.textInverse
              : theme.colors.primary
            : "transparent",
        }}
      />
    </Pressable>
  );
}

function MonthButton({
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
        backgroundColor: theme.colors.surfaceAlt,
        width: 34,
        height: 34,
        borderRadius: theme.radius.pill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: theme.colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

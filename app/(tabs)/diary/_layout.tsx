import { DiaryContext } from "@/contexts/DiaryContext";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DiaryLayout() {
  const theme = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(selectedDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(selectedDate.getFullYear());
  const [loggedDates, setLoggedDates] = useState<Record<string, number>>({});

  const calendarOpenRef = useRef(calendarOpen);

  useEffect(() => {
    calendarOpenRef.current = calendarOpen;
  }, [calendarOpen]);

  const selectedDateString = localDateString(selectedDate);

  const monthDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const firstWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: {
      date: string | null;
      day: number | null;
    }[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push({
        date: null,
        day: null,
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      days.push({
        date: localDateString(new Date(calendarYear, calendarMonth, day)),
        day,
      });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  const loadLoggedDates = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoggedDates({});
      return;
    }

    const startDate = localDateString(new Date(calendarYear, calendarMonth, 1));
    const endDate = localDateString(new Date(calendarYear, calendarMonth + 1, 0));

    const { data, error } = await supabase
      .from("food_logs")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) {
      console.log("Logged dates error:", error);
      setLoggedDates({});
      return;
    }

    const counts: Record<string, number> = {};

    (data ?? []).forEach((item) => {
      const key = String(item.date);
      counts[key] = (counts[key] ?? 0) + 1;
    });

    setLoggedDates(counts);
  }, [calendarMonth, calendarYear]);

  useEffect(() => {
    loadLoggedDates();
  }, [loadLoggedDates]);

  useFocusEffect(
    useCallback(() => {
      loadLoggedDates();
    }, [loadLoggedDates]),
  );

  useEffect(() => {
    if (calendarOpen) {
      loadLoggedDates();
    }
  }, [calendarOpen, loadLoggedDates]);

  useEffect(() => {
    router.setParams({
      date: selectedDateString,
    } as any);
  }, [router, selectedDateString]);

  function changeDate(days: number) {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);

      setCalendarMonth(next.getMonth());
      setCalendarYear(next.getFullYear());

      return next;
    });
  }

  function goToToday() {
    const today = new Date();

    setSelectedDate(today);
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
    setCalendarOpen(false);
  }

  function toggleCalendar() {
    setCalendarMonth(selectedDate.getMonth());
    setCalendarYear(selectedDate.getFullYear());
    setCalendarOpen((value) => !value);
  }

  function selectCalendarDate(date: string) {
    const next = dateFromKey(date);

    setSelectedDate(next);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
    setCalendarOpen(false);
  }

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

  const monthTitle = new Date(calendarYear, calendarMonth, 1).toLocaleDateString(
    "en-PH",
    {
      month: "long",
      year: "numeric",
    },
  );

  const dateSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (calendarOpenRef.current) return false;

        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);

        return horizontal > 20 && horizontal > vertical * 1.5;
      },

      onPanResponderRelease: (_, gestureState) => {
        if (calendarOpenRef.current) return;

        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);

        if (horizontal < 50 || horizontal < vertical * 1.5) {
          return;
        }

        if (gestureState.dx > 0) {
          changeDate(-1);
        } else {
          changeDate(1);
        }
      },
    }),
  ).current;

  return (
    <DiaryContext.Provider
      value={{
        selectedDate,
        selectedDateString,

        calendarOpen,
        setCalendarOpen,

        calendarMonth,
        calendarYear,

        monthTitle,
        monthDays,

        loggedDates,

        changeMonth,
        selectCalendarDate,
        goToToday,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
        }}
      >
        <Stack
          screenOptions={{
            headerShown: true,
            headerTitleAlign: "center",
            headerShadowVisible: false,

            headerStyle: {
              backgroundColor: theme.colors.background,
            },

            contentStyle: {
              backgroundColor: theme.colors.background,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerTitle: () => (
                <View
                  {...dateSwipeResponder.panHandlers}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 285,
                    gap: 12,
                  }}
                >
                  <Pressable onPress={() => changeDate(-1)}>
                    <ChevronLeft size={20} color={theme.colors.text} />
                  </Pressable>

                  <Pressable
                    onPress={toggleCalendar}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Calendar size={20} color={theme.colors.primary} />

                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 20,
                        fontWeight: "900",
                      }}
                    >
                      {formatHeaderDate(selectedDate)}
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => changeDate(1)}>
                    <ChevronRight size={20} color={theme.colors.text} />
                  </Pressable>
                </View>
              ),
            }}
          />

          <Stack.Screen
            name="add-food"
            options={{
              title: "Add Food",
            }}
          />

          <Stack.Screen
            name="search-food-detail"
            options={{
              title: "Food Details",
            }}
          />

          <Stack.Screen
            name="food-log-detail"
            options={{
              title: "Food Details",
            }}
          />

          <Stack.Screen
            name="edit-food-log"
            options={{
              title: "Edit Food Log",
            }}
          />
        </Stack>
      </View>
    </DiaryContext.Provider>
  );
}
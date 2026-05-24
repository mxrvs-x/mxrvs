import { AppTheme, useTheme } from "@/lib/theme";
import { ExpandIcon, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type CalendarDay = {
  date: string;
  day: number;
  label: string;
};

type MonthDay = {
  date: string | null;
  day: number | null;
};

type Props = {
  activeDates: Record<string, unknown>;
  marker: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  clearSelectionOnMonthChange?: () => void;
  onVisibleMonthChange?: (month: number, year: number) => void;
  cardStyle?: StyleProp<ViewStyle>;
  title?: string;
  children?: ReactNode;
};

const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function toCalendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function hasDateValue(activeDates: Record<string, unknown>, date: string) {
  return Boolean(activeDates[date]);
}

export default function ActivityCalendar({
  activeDates,
  marker,
  selectedDate,
  onSelectDate,
  clearSelectionOnMonthChange,
  onVisibleMonthChange,
  cardStyle,
  title = "This Week",
  children,
}: Props) {
  const theme = useTheme();
  const now = new Date();
  const today = toCalendarDateKey(now);
  const [expanded, setExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());

  useEffect(() => {
    onVisibleMonthChange?.(calendarMonth, calendarYear);
  }, [calendarMonth, calendarYear, onVisibleMonthChange]);

  const weekDays = useMemo<CalendarDay[]>(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      return {
        day: date.getDate(),
        date: toCalendarDateKey(date),
        label: WEEK_LABELS[index],
      };
    });
  }, []);

  const monthDays = useMemo<MonthDay[]>(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const days: MonthDay[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null, day: null });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(calendarYear, calendarMonth, day);
      days.push({ date: toCalendarDateKey(date), day });
    }

    return days;
  }, [calendarMonth, calendarYear]);

  function changeMonth(direction: "prev" | "next") {
    const nextDate = new Date(calendarYear, calendarMonth, 1);
    nextDate.setMonth(nextDate.getMonth() + (direction === "next" ? 1 : -1));
    setCalendarMonth(nextDate.getMonth());
    setCalendarYear(nextDate.getFullYear());
    clearSelectionOnMonthChange?.();
  }

  const monthTitle = new Date(calendarYear, calendarMonth, 1).toLocaleDateString(
    "en-PH",
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <View
      style={[
        {
          marginTop: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 20,
          padding: 14,
        },
        cardStyle,
      ]}
    >
      {!expanded ? (
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
              {title}
            </Text>

            <Pressable
              onPress={() => setExpanded(true)}
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
              }}
            >
              <ExpandIcon size={18} color={theme.colors.primary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {weekDays.map((item) => (
              <WeekDay
                key={item.date}
                theme={theme}
                item={item}
                selected={selectedDate === item.date}
                today={item.date === today}
                active={hasDateValue(activeDates, item.date)}
                marker={marker}
                onPress={() => onSelectDate(item.date)}
              />
            ))}
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
            <MonthButton
              theme={theme}
              label="<"
              onPress={() => changeMonth("prev")}
            />
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              {monthTitle}
            </Text>
            <MonthButton
              theme={theme}
              label=">"
              onPress={() => changeMonth("next")}
            />
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {WEEK_LABELS.map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: theme.colors.textFaint,
                  fontWeight: "800",
                  fontSize: 11,
                }}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {monthDays.map((item, index) => (
              <MonthDayCell
                key={`${item.date || "empty"}-${index}`}
                theme={theme}
                item={item}
                selected={item.date === selectedDate}
                today={item.date === today}
                active={item.date ? hasDateValue(activeDates, item.date) : false}
                marker={marker}
                onPress={() => {
                  if (item.date) onSelectDate(item.date);
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => setExpanded(false)}
            style={{ padding: 10, alignItems: "center" }}
          >
            <X size={24} color={theme.colors.primary} />
          </Pressable>
        </>
      )}

      {children}
    </View>
  );
}

function WeekDay({
  theme,
  item,
  selected,
  today,
  active,
  marker,
  onPress,
}: {
  theme: AppTheme;
  item: CalendarDay;
  selected: boolean;
  today: boolean;
  active: boolean;
  marker: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: selected
          ? theme.colors.text
          : today
            ? theme.colors.surfaceAlt
            : theme.colors.background,
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: selected ? theme.colors.surface : theme.colors.textFaint,
          fontWeight: "800",
        }}
      >
        {item.label}
      </Text>

      <Text
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: "900",
          color: selected ? theme.colors.surface : theme.colors.text,
        }}
      >
        {item.day}
      </Text>

      <Text style={{ fontSize: 12, marginTop: 2 }}>
        {active ? marker : ""}
      </Text>
    </Pressable>
  );
}

function MonthDayCell({
  theme,
  item,
  selected,
  today,
  active,
  marker,
  onPress,
}: {
  theme: AppTheme;
  item: MonthDay;
  selected: boolean;
  today: boolean;
  active: boolean;
  marker: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!item.date}
      onPress={onPress}
      style={{
        width: `${100 / 7}%`,
        paddingVertical: 4,
        alignItems: "center",
      }}
    >
      {item.day ? (
        <View
          style={{
            width: 34,
            height: 40,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected
              ? theme.colors.text
              : today
                ? theme.colors.surfaceAlt
                : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "900",
              color: selected ? theme.colors.surface : theme.colors.text,
            }}
          >
            {item.day}
          </Text>

          <Text style={{ fontSize: 10 }}>{active ? marker : ""}</Text>
        </View>
      ) : (
        <View style={{ width: 34, height: 40 }} />
      )}
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
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 18,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

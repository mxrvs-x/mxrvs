import { createContext, useContext } from "react";

export type DiaryDay = {
  date: string | null;
  day: number | null;
};

export type DiaryContextValue = {
  selectedDate: Date;
  selectedDateString: string;

  calendarOpen: boolean;
  setCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;

  calendarMonth: number;
  calendarYear: number;
  monthTitle: string;
  monthDays: DiaryDay[];

  loggedDates: Record<string, number>;

  changeMonth: (direction: "prev" | "next") => void;
  selectCalendarDate: (date: string) => void;
  goToToday: () => void;
};

export const DiaryContext = createContext<DiaryContextValue | null>(null);

export function useDiary() {
  const context = useContext(DiaryContext);

  if (!context) {
    throw new Error("useDiary must be used inside DiaryContext.Provider");
  }

  return context;
}
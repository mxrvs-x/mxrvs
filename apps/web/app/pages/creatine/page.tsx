"use client";

import { Check, Minus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityCalendar,
  CreatineChart,
  CreatineLog,
  emptyCreatine,
  formatDate,
  toDateKey,
  useLocalState,
} from "@/app/components/shared";
import {
  deleteWebCreatine,
  loadWebCreatine,
  logWebCreatine,
  type SyncState,
} from "@/lib/webData";
import { appAlert, appConfirm, appToast } from "@/lib/sweetAlert";

export default function CreatinePage() {
  const today = useMemo(() => toDateKey(), []);
  const [logs, setLogs] = useLocalState<CreatineLog[]>("mxrvs-web-creatine", emptyCreatine);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [syncState, setSyncState] = useState<SyncState>("local");

  useEffect(() => {
    let active = true;

    loadWebCreatine().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Creatine Load Failed",
          "Could not load creatine history from Supabase.",
          "error",
        );
        return;
      }
      setLogs(data);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, [setLogs]);

  const activeDates = useMemo(() => {
    return logs.reduce<Record<string, CreatineLog>>((acc, log) => {
      acc[log.date] = log;
      return acc;
    }, {});
  }, [logs]);

  const selectedLog = logs.find((log) => log.date === selectedDate) || null;
  const currentMonthLogs = logs.filter((log) => {
    const date = new Date(`${log.date}T00:00:00`);
    return date.getMonth() === calendarMonth && date.getFullYear() === calendarYear;
  });

  async function toggleLog() {
    if (selectedLog) {
      const confirmed = await appConfirm({
        title: "Remove Creatine Log?",
        text: `This will remove the 5g log for ${formatDate(selectedDate)}.`,
        confirmButtonText: "Remove",
      });

      if (!confirmed) return;

      const deleted = await deleteWebCreatine(selectedDate);
      if (!deleted) {
        await appAlert(
          "Remove Failed",
          "Could not remove this creatine log. Please try again.",
          "error",
        );
        return;
      }

      setLogs((current) => current.filter((log) => log.date !== selectedDate));
      await appToast("Creatine log removed");
      return;
    }

    const savedLog = await logWebCreatine(selectedDate);
    if (!savedLog) {
      await appAlert(
        "Log Failed",
        "Could not save this creatine log. Please try again.",
        "error",
      );
      return;
    }

    setLogs((current) => [
      savedLog,
      ...current,
    ].sort((a, b) => b.date.localeCompare(a.date)));
    await appToast("Creatine logged");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily supplement</p>
          <h1>Creatine</h1>
          <p className="muted">Data source: {syncState === "supabase" ? "Supabase" : "Waiting for session"}</p>
        </div>
      </header>

      <section className="grid two-col">
        <div className="stack">
          <div className="card stack">
            <div className="row between">
              <div>
                <h2>{selectedLog ? "Logged" : "Not logged"}</h2>
                <p className="muted">{formatDate(selectedDate)}</p>
              </div>
              <div className={selectedLog ? "check-dot active" : "check-dot"} style={{ height: 66, width: 66 }}>
                {selectedLog ? <Check size={30} /> : <Minus size={30} />}
              </div>
            </div>
            <button className={selectedLog ? "button" : "button primary"} onClick={toggleLog} type="button">
              {selectedLog ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
              {selectedLog ? "Remove Log" : "Log 5g"}
            </button>
          </div>

          <ActivityCalendar
            activeDates={activeDates}
            marker="5"
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onVisibleMonthChange={(month, year) => {
              setCalendarMonth(month);
              setCalendarYear(year);
            }}
          />

          <div className="card">
            <div className="row between">
              <h2>Attendance</h2>
              <strong className="muted">{currentMonthLogs.length} this month</strong>
            </div>
            <div className="chart-wrap">
              <CreatineChart logs={logs} />
            </div>
          </div>
        </div>

        <div className="stack log-panel">
          <div className="row between">
            <h2>History</h2>
            <strong className="muted">{logs.length}</strong>
          </div>
          <div className="stack log-scroll">
            {logs.length === 0 ? (
              <div className="card">
                <p className="muted">No creatine logs yet.</p>
              </div>
            ) : null}
            {logs.map((log) => (
              <article className="list-item row between" key={log.id}>
                <div>
                  <h3>{formatDate(log.date)}</h3>
                  <p className="muted">{log.grams}g creatine</p>
                </div>
                <span className="check-dot active"><Check size={17} /></span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

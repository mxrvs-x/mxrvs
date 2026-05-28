"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActivityCalendar,
  CardioReportChart,
  CardioSession,
  emptyCardio,
  formatDate,
  MiniStat,
  paceText,
  useLocalState,
} from "../_components/shared";
import { loadWebCardio, type SyncState } from "@/lib/webData";

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sourceText(source: CardioSession["cardio_source"]) {
  if (source === "outdoor") return "Outdoor";
  if (source === "treadmill") return "Treadmill";
  return "Manual";
}

export default function CardioPage() {
  const [sessions, setSessions] = useLocalState("mxrvs-web-cardio", emptyCardio);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | "running" | "walking">("all");
  const [syncState, setSyncState] = useState<SyncState>("local");

  useEffect(() => {
    let active = true;

    loadWebCardio().then((data) => {
      if (!active || !data) return;
      setSessions(data);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, [setSessions]);

  const activeDates = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.session_date] = (acc[session.session_date] || 0) + 1;
      return acc;
    }, {});
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => (selectedDate ? session.session_date === selectedDate : true))
      .filter((session) => (selectedType === "all" ? true : session.cardio_type === selectedType))
      .sort((a, b) => b.session_date.localeCompare(a.session_date));
  }, [selectedDate, selectedType, sessions]);

  const totalDistance = visibleSessions.reduce((sum, session) => sum + session.distance_km, 0);
  const totalTime = visibleSessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalCalories = visibleSessions.reduce((sum, session) => sum + session.calories_burned, 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cardio</p>
          <h1>History</h1>
          <p className="muted">Data source: {syncState === "supabase" ? "Supabase" : "Waiting for session"}</p>
        </div>
        <p className="muted">View-only on web. Start cardio sessions from mobile.</p>
      </header>

      <section className="grid two-col">
        <div className="stack">
          <ActivityCalendar
            activeDates={activeDates}
            marker="C"
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate((current) => current === date ? null : date)}
          >
            {selectedDate ? <p className="muted">{activeDates[selectedDate] || 0} records on {formatDate(selectedDate)}</p> : null}
          </ActivityCalendar>

          <div className="card stack">
            <div className="row between responsive">
              <div>
                <h2>Cardio Reports</h2>
                <p className="muted">Distance and time from logged activities.</p>
              </div>
              <div className="chips">
                {(["all", "running", "walking"] as const).map((type) => (
                  <button className={selectedType === type ? "chip active" : "chip"} key={type} onClick={() => setSelectedType(type)} type="button">
                    {type === "all" ? "All" : type === "running" ? "Run" : "Walk"}
                  </button>
                ))}
              </div>
            </div>
            <div className="row wrap">
              <MiniStat label="Distance" value={`${totalDistance.toFixed(2)} km`} />
              <MiniStat label="Time" value={formatTime(totalTime)} />
              <MiniStat label="Calories" value={`${Math.round(totalCalories)} kcal`} />
            </div>
            <div className="chart-wrap">
              <CardioReportChart sessions={visibleSessions} />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="row between">
            <h2>{selectedDate ? "Selected Date" : "Activities"}</h2>
            <strong className="muted">{visibleSessions.length}</strong>
          </div>

          {visibleSessions.length === 0 ? (
            <div className="card">
              <p className="muted">No cardio records for this filter.</p>
            </div>
          ) : null}

          {visibleSessions.map((session) => (
            <article className="list-item stack" key={session.id}>
              <div className="row between">
                <div>
                  <h3>{session.cardio_type === "running" ? "Run" : "Walk"}</h3>
                  <p className="muted">{sourceText(session.cardio_source)}</p>
                </div>
                <span className="faint">{formatDate(session.session_date)}</span>
              </div>
              <div className="row wrap">
                <MiniStat label="Distance" value={`${session.distance_km.toFixed(2)} km`} />
                <MiniStat label="Time" value={formatTime(session.duration_seconds)} />
                <MiniStat label="Pace" value={paceText(session.distance_km, session.duration_seconds)} />
                <MiniStat label="Calories" value={`${session.calories_burned} kcal`} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

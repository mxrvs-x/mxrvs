"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DailyActivityHistory from "@/app/components/DailyActivityHistory";
import Pagination from "@/app/components/Pagination";
import {
  CardioReportChart,
  CardioSession,
  emptyCardio,
  formatDate,
  MiniStat,
  paceText,
  useLocalState,
} from "@/app/components/shared";
import { loadWebCardio } from "@/lib/webData";
import { getCardioPersonalRecords } from "@/lib/personalRecords";
import { appAlert } from "@/lib/sweetAlert";

const PAGE_SIZE = 8;

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
  return (
    <Suspense fallback={<div className="page"><h1>Cardio</h1></div>}>
      <CardioOverview />
    </Suspense>
  );
}

function CardioOverview() {
  const daily = useSearchParams().get("view") === "daily";

  return (
    <div className="page stack cardio-overview">
      <header className="page-header"><h1>Cardio</h1></header>
      <nav className="view-switcher" aria-label="Cardio views">
        <Link href="/pages/cardio" aria-current={!daily ? "page" : undefined} scroll={false}>Sessions</Link>
        <Link href="/pages/cardio?view=daily" aria-current={daily ? "page" : undefined} scroll={false}>Daily Activity</Link>
      </nav>
      {daily ? <DailyActivityHistory /> : <CardioSessions />}
    </div>
  );
}

function CardioSessions() {
  const [sessions, setSessions] = useLocalState("mxrvs-web-cardio", emptyCardio);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | "running" | "walking">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    loadWebCardio().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Cardio Load Failed",
          "Could not load cardio history from Supabase.",
          "error",
        );
        return;
      }
      setSessions(data);
    });

    return () => {
      active = false;
    };
  }, [setSessions]);

  const visibleSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => (selectedDate ? session.session_date === selectedDate : true))
      .filter((session) => (selectedType === "all" ? true : session.cardio_type === selectedType))
      .sort((a, b) => b.session_date.localeCompare(a.session_date));
  }, [selectedDate, selectedType, sessions]);
  const totalPages = Math.max(
    1,
    Math.ceil(visibleSessions.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedSessions = visibleSessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const totalDistance = visibleSessions.reduce((sum, session) => sum + session.distance_km, 0);
  const totalTime = visibleSessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalCalories = visibleSessions.reduce((sum, session) => sum + session.calories_burned, 0);
  const runningRecords = useMemo(
    () =>
      getCardioPersonalRecords(
        sessions.filter((session) => session.cardio_type === "running"),
      ),
    [sessions],
  );
  const walkingRecords = useMemo(
    () =>
      getCardioPersonalRecords(
        sessions.filter((session) => session.cardio_type === "walking"),
      ),
    [sessions],
  );

  return (
    <>
      <section className="card stack" aria-labelledby="cardio-sessions-title">
        <div className="row between wrap">
          <h2 id="cardio-sessions-title">Logged sessions <span className="muted record-count">({visibleSessions.length})</span></h2>
          <div className="chips">
            {(["all", "running", "walking"] as const).map((type) => (
              <button className={selectedType === type ? "chip active" : "chip"} aria-pressed={selectedType === type} key={type} onClick={() => { setSelectedType(type); setPage(1); }} type="button">
                {type === "all" ? "All" : type === "running" ? "Run" : "Walk"}
              </button>
            ))}
          </div>
        </div>
        <div className="records-table-scroll" tabIndex={0} role="region" aria-label="Session records">
          <table className="records-table" aria-labelledby="cardio-sessions-title">
            <thead>
              <tr>
                <th scope="col">
                  <label className="table-date-filter">
                    Date
                    <input
                      aria-label="Filter sessions by date"
                      type="date"
                      value={selectedDate ?? ""}
                      onChange={(event) => {
                        setSelectedDate(event.target.value || null);
                        setPage(1);
                      }}
                    />
                  </label>
                  {selectedDate && (
                    <button className="chip table-clear-date" type="button" onClick={() => { setSelectedDate(null); setPage(1); }}>
                      Clear date
                    </button>
                  )}
                </th>
                <th scope="col">Session</th>
                <th scope="col">Distance</th>
                <th scope="col">Time</th>
                <th scope="col">Pace</th>
                <th scope="col">Calories</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.length === 0 && (
                <tr><td className="muted" colSpan={6}>No cardio records for this filter.</td></tr>
              )}
              {paginatedSessions.map((session) => (
                <tr key={session.id}>
                  <td><time dateTime={session.session_date}>{formatDate(session.session_date)}</time></td>
                  <th scope="row">
                    <Link href={`/pages/cardio/${session.id}`}>
                      {session.cardio_type === "running" ? "Run" : "Walk"}
                    </Link>
                    <small className="muted">{sourceText(session.cardio_source)}</small>
                  </th>
                  <td>{session.distance_km.toFixed(2)} km</td>
                  <td>{formatTime(session.duration_seconds)}</td>
                  <td>{paceText(session.distance_km, session.duration_seconds)}</td>
                  <td>{session.calories_burned} kcal</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
      </section>

      <section className="card stack" aria-labelledby="cardio-reports-title">
        <h2 id="cardio-reports-title">Cardio reports</h2>
        <div className="row wrap">
          <MiniStat label="Distance" value={`${totalDistance.toFixed(2)} km`} />
          <MiniStat label="Time" value={formatTime(totalTime)} />
          <MiniStat label="Calories" value={`${Math.round(totalCalories)} kcal`} />
        </div>
        <div className="row wrap">
          <MiniStat
            label="Run Distance PR"
            value={
              runningRecords.distance
                ? `${Number(runningRecords.distance.distance_km).toFixed(2)} km`
                : "--"
            }
          />
          <MiniStat
            label="Run Step PR"
            value={runningRecords.steps?.steps?.toLocaleString() || "--"}
          />
          <MiniStat
            label="Walk Distance PR"
            value={
              walkingRecords.distance
                ? `${Number(walkingRecords.distance.distance_km).toFixed(2)} km`
                : "--"
            }
          />
          <MiniStat
            label="Walk Step PR"
            value={walkingRecords.steps?.steps?.toLocaleString() || "--"}
          />
        </div>
        <div className="chart-wrap">
          <CardioReportChart sessions={visibleSessions} />
        </div>
      </section>
    </>
  );
}

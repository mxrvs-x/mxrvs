"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Pagination from "@/app/components/Pagination";
import { MiniStat } from "@/app/components/shared";
import { supabase } from "@/lib/supabase";
import { formatMinutes, sleepLocalTime, summarizeSleep, type SleepLog } from "../../../../mobile/lib/sleep";
import { useSleepLogs } from "../../../../mobile/lib/useSleepLogs";

const PAGE_SIZE = 10;

export default function SleepPage() {
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SleepLog | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement>(null);
  const logs = useSleepLogs(supabase, page, PAGE_SIZE, date);

  return (
    <div className="page stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Sleep</p>
          <h1>Sleep History</h1>
        </div>
        <span className="muted">Log sleep in the mobile app.</span>
      </header>
      <section className="grid two-col">
        <div className="card stack log-panel">
          <div className="field">
            <label htmlFor="sleep-date">Filter by log date</label>
            <input id="sleep-date" className="input" type="date" value={date} onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }} />
          </div>
          {date && <button className="button" type="button" onClick={() => { setDate(""); setPage(1); }}>Show all dates</button>}
        </div>
        <div className="stack log-panel">
          <div className="row between">
            <h2>Sleep Logs</h2>
            <strong className="muted">{logs.loading ? "" : logs.count}</strong>
          </div>
          {logs.loading && <p className="muted" role="status">Loading sleep logs…</p>}
          {logs.error && <div className="card stack">
            <p className="auth-error" role="alert">{logs.error}</p>
            <button className="button" type="button" onClick={() => { setPage(1); logs.refresh(); }}>Retry</button>
          </div>}
          {!logs.loading && !logs.error && logs.rows.length === 0 && (
            <div className="card muted">No sleep logs for this selection.</div>
          )}
          {logs.rows.map((row) => (
            <SleepRecord key={row.id} row={row} onOpen={(trigger) => {
              detailsTrigger.current = trigger;
              setSelectedLog(row);
            }} />
          ))}
          <Pagination page={page} totalPages={Math.ceil(logs.count / PAGE_SIZE)} onPageChange={setPage} />
        </div>
      </section>
      {selectedLog && <SleepDetails row={selectedLog} onClose={() => {
        setSelectedLog(null);
        detailsTrigger.current?.focus();
      }} />}
    </div>
  );
}

function displayLogDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function SleepRecord({ row, onOpen }: { row: SleepLog; onOpen: (trigger: HTMLButtonElement) => void }) {
  const summary = summarizeSleep(row);
  const date = displayLogDate(row.log_date);
  return (
    <button className="list-item stack sleep-log" type="button" aria-haspopup="dialog"
      aria-label={`Sleep log for ${date}`} onClick={(event) => onOpen(event.currentTarget)}>
      <strong>{date}</strong>
      <span className="row wrap">
        <span className="stat"><span>{summary.totalLabel}</span><strong>{formatMinutes(summary.total)}</strong></span>
        <span className="stat"><span>Awakenings</span><strong>{summary.awakenings}</strong></span>
        <span className="stat"><span>Naps</span><strong>{formatMinutes(summary.naps)}</strong></span>
      </span>
    </button>
  );
}

function SleepDetails({ row, onClose }: { row: SleepLog; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const summary = summarizeSleep(row);
  const time = (value: string | null, approximate = false) =>
    value ? `${approximate ? "≈ " : ""}${sleepLocalTime(value, row.time_zone)}` : "Unknown";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal sleep-dialog" aria-labelledby="sleep-dialog-date"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <div className="stack">
        <div className="row between">
          <h2 id="sleep-dialog-date">{displayLogDate(row.log_date)}</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="row wrap">
          <MiniStat label={summary.totalLabel} value={formatMinutes(summary.total)} />
          <MiniStat label="Awakenings" value={summary.awakenings} />
          <MiniStat label="Naps" value={formatMinutes(summary.naps)} />
        </div>
        <div className="stack">
          <p className="muted">{row.time_zone}</p>
          {row.bedtime_at && <p>Bedtime · {time(row.bedtime_at)}</p>}
          <p>Fell asleep · {time(row.sleep_onset_at, row.onset_approximate)}</p>
          <p>Final wake-up · {time(row.final_wake_at)}</p>
          <p>Overnight · {formatMinutes(summary.overnight)} · Deducted awake time · {formatMinutes(summary.awake)}</p>
          {row.sleep_awakenings.length > 0 && (
            <ul className="notes-list">
              {row.sleep_awakenings.map((a) => <li key={a.position}>
                Woke · {time(a.woke_at, a.woke_approximate)}. Fell back asleep · {
                  a.resume_type === "immediate" ? "Immediately" : time(a.resumed_at, a.resumed_approximate)
                }. {a.deduct_from_sleep ? "Deducted from sleep" : "Counted only"}.
              </li>)}
            </ul>
          )}
          {row.sleep_naps.map((nap) => <p key={nap.started_at}>Nap · {time(nap.started_at)} to {time(nap.ended_at)}</p>)}
          {row.notes && <p className="muted" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{row.notes}</p>}
        </div>
      </div>
    </dialog>
  );
}

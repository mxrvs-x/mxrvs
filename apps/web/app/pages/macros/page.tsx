"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Pagination from "@/app/components/Pagination";
import { supabase } from "@/lib/supabase";
import { appToast } from "@/lib/sweetAlert";
import { formatMacroDate, isMacroDate, macroFields, macroToday, type DailyMacroLog } from "../../../../mobile/lib/dailyMacros";
import { useDailyMacroHistory, useDailyMacros, useMacroLogEditor } from "../../../../mobile/lib/useDailyMacros";

export default function MacrosPage() {
  const [date, setDate] = useState(macroToday);
  const today = macroToday();
  const validDate = isMacroDate(date) && date <= today;
  const history = useDailyMacroHistory(supabase, 10);
  const [selectedLog, setSelectedLog] = useState<DailyMacroLog | null>(null);
  const [formRevision, setFormRevision] = useState(0);

  return (
    <div className="page">
      <header className="page-header">
        <div><h1>Daily Macros</h1></div>
      </header>
      <div className="grid two-col" style={{ alignItems: "start" }}>
        <section className="card stack" aria-label="Log daily macros">
          <div className="field">
            <div className="row between">
              <label htmlFor="macro-date">Date</label>
              <button className="button ghost" type="button" onClick={() => setDate(today)}>Today</button>
            </div>
            <input
              className="input"
              id="macro-date"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {validDate ? <MacroForm key={`${date}:${formRevision}`} date={date} onSaved={() => {
            history.refresh();
            void appToast("Macros logged");
          }} /> : (
            <p className="muted">Choose today or an earlier date.</p>
          )}
        </section>
        <section className="card stack" aria-labelledby="macro-history-heading">
          <div className="row between">
            <h2 id="macro-history-heading">Macro History</h2>
            <button className="button ghost" type="button" disabled={history.loading} onClick={history.refresh}>
              {history.error ? "Retry" : "Refresh"}
            </button>
          </div>
          {history.loading && <p className="muted" role="status">Loading history…</p>}
          {history.error && <p className="auth-error" role="alert">{history.error}</p>}
          {!history.loading && !history.error && history.rows.length === 0 && (
            <p className="muted">No macro logs yet.</p>
          )}
          {history.rows.map((row) => (
            <button
              className="list-item stack macro-log"
              type="button"
              aria-label={`View macros for ${formatMacroDate(row.log_date)}`}
              key={row.log_date}
              onClick={() => setSelectedLog(row)}
            >
              <strong>{formatMacroDate(row.log_date)}</strong>
              <MacroValues row={row} />
            </button>
          ))}
          <Pagination page={history.page} totalPages={history.totalPages} onPageChange={history.setPage} />
        </section>
      </div>
      {selectedLog && (
        <MacroLogDialog
          row={selectedLog}
          onClose={() => setSelectedLog(null)}
          onSaved={history.refreshPage}
          onDeleted={() => {
            if (date === selectedLog.log_date) setFormRevision((value) => value + 1);
            setSelectedLog(null);
            history.refresh();
            void appToast("Macro log deleted");
          }}
        />
      )}
    </div>
  );
}

function MacroForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const log = useDailyMacros(supabase, date, onSaved);

  if (log.loading) return <p className="muted" role="status">Loading macros…</p>;
  if (!log.ready) return (
    <>
      <p className="auth-error" role="alert">{log.error}</p>
      <button className="button" type="button" onClick={log.reload}>Retry</button>
    </>
  );

  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      void log.save();
    }}>
      <div className="grid macro-grid">
        {macroFields.map(({ key, label, unit }) => (
          <div className="field" key={key}>
            <label htmlFor={`macro-${key}`}>{label} ({unit})</label>
            <input
              className="input"
              id={`macro-${key}`}
              inputMode="decimal"
              placeholder="0"
              required
              value={log.draft[key]}
              disabled={log.saving || log.existing}
              onChange={(event) => log.edit(key, event.target.value)}
            />
          </div>
        ))}
      </div>
      {log.error && <p className="auth-error" role="alert">{log.error}</p>}
      {log.existing && !log.error && <p className="muted">Already logged. Open the entry in Macro History to edit it.</p>}
      <button className="button primary" type="submit" disabled={log.saving || !log.canSave}>
        {log.saving ? "Saving…" : "Save macros"}
      </button>
    </form>
  );
}

function MacroValues({ row }: { row: DailyMacroLog }) {
  return (
    <span className="grid macro-grid">
      {macroFields.map(({ key, label, unit }) => (
        <span className="muted" key={key}>{label} <strong>{row[key]} {unit}</strong></span>
      ))}
    </span>
  );
}

function MacroLogDialog({ row, onClose, onSaved, onDeleted }: {
  row: DailyMacroLog;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useMacroLogEditor(supabase, row, onSaved, onDeleted);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="modal macro-dialog"
      aria-labelledby="macro-log-date"
      onCancel={(event) => {
        event.preventDefault();
        if (editor.saving || editor.deleting) return;
        if (editor.confirmingDelete) editor.setDeleteConfirmation(false);
        else if (editor.editing) editor.cancel();
        else onClose();
      }}
    >
      <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}>
        <div className="row between">
          <h2 id="macro-log-date">{formatMacroDate(row.log_date)}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            title="Close"
            disabled={editor.saving || editor.deleting}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {editor.editing ? (
          <div className="grid macro-grid">
            {macroFields.map(({ key, label, unit }) => (
              <div className="field" key={key}>
                <label htmlFor={`edit-macro-${key}`}>{label} ({unit})</label>
                <input
                  className="input"
                  id={`edit-macro-${key}`}
                  inputMode="decimal"
                  value={editor.draft[key]}
                  disabled={editor.saving}
                  onChange={(event) => editor.edit(key, event.target.value)}
                />
              </div>
            ))}
          </div>
        ) : <MacroValues row={editor.row} />}
        {editor.confirmingDelete && <p>Delete this day’s macro log? This can’t be undone.</p>}
        {editor.error && <p className="auth-error" role="alert">{editor.error}</p>}
        <div className="grid macro-grid">
          {editor.confirmingDelete ? (
            <>
              <button className="button danger" type="button" disabled={editor.deleting} onClick={() => void editor.remove()}>
                {editor.deleting ? "Deleting…" : "Delete log"}
              </button>
              <button className="button" type="button" disabled={editor.deleting} onClick={() => editor.setDeleteConfirmation(false)}>Cancel</button>
            </>
          ) : editor.editing ? (
            <>
              <button className="button primary" type="submit" disabled={editor.saving}>{editor.saving ? "Saving…" : "Save"}</button>
              <button className="button" type="button" disabled={editor.saving} onClick={editor.cancel}>Cancel</button>
            </>
          ) : (
            <>
              <button className="button primary" type="button" aria-label="Update" title="Update" onClick={(event) => {
                event.preventDefault();
                editor.startEditing();
              }}><Pencil size={20} aria-hidden="true" /></button>
              <button className="button danger" type="button" aria-label="Delete" title="Delete" onClick={() => editor.setDeleteConfirmation(true)}>
                <Trash2 size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}

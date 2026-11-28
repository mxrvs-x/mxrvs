"use client";

import { useState } from "react";
import Pagination from "@/app/components/Pagination";
import { MiniStat } from "@/app/components/shared";
import { supabase } from "@/lib/supabase";
import { formatOverallActivity, useOverallActivityHistory } from "../../../../mobile/lib/useOverallActivityHistory";

export default function OverallActivityPage() {
  const [page, setPage] = useState(1);
  const history = useOverallActivityHistory(supabase, page);

  return (
    <div className="page stack">
      <header className="page-header">
        <div>
          <h1>Overall Activity</h1>
          <p className="muted">Daily totals synced from the mobile app.</p>
        </div>
        <button className="button" type="button" disabled={history.loading} onClick={history.refresh}>
          {history.error ? "Retry" : "Refresh"}
        </button>
      </header>
      <section className="stack log-panel" aria-label="Daily activity records">
        {history.loading && <p className="muted" role="status">Loading activity records…</p>}
        {history.error && <p className="auth-error" role="alert">{history.error}</p>}
        {!history.loading && !history.error && history.rows.length === 0 && (
          <div className="card muted">{page === 1 ? "No daily activity has synced yet." : "No records on this page."}</div>
        )}
        {history.rows.map((record) => {
          const activity = formatOverallActivity(record);
          return (
            <article className="card stack" key={record.id}>
              <h2><time dateTime={record.activity_date}>{activity.date}</time></h2>
              <div className="row wrap">
                <MiniStat label="Steps" value={activity.steps} />
                <MiniStat label="Moving time" value={activity.movingTime} />
                <MiniStat label="Est. calories" value={activity.calories} />
              </div>
            </article>
          );
        })}
        <Pagination page={page} totalPages={Math.max(page, history.totalPages)} onPageChange={setPage} />
      </section>
    </div>
  );
}

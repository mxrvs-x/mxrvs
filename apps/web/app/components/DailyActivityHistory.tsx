"use client";

import { useState } from "react";
import Pagination from "@/app/components/Pagination";
import { supabase } from "@/lib/supabase";
import { formatOverallActivity, useOverallActivityHistory } from "../../../mobile/lib/useOverallActivityHistory";

export default function DailyActivityHistory() {
  const [page, setPage] = useState(1);
  const history = useOverallActivityHistory(supabase, page);

  return (
    <section className="card stack" aria-labelledby="daily-activity-title">
      <div className="row between wrap">
        <h2 id="daily-activity-title">Daily totals</h2>
        <button className="button" type="button" disabled={history.loading} onClick={history.refresh}>
          {history.error ? "Retry" : "Refresh"}
        </button>
      </div>
      {history.loading && <p className="muted" role="status">Loading activity records…</p>}
      {history.error && <p className="auth-error" role="alert">{history.error}</p>}
      {!history.loading && !history.error && history.rows.length === 0 && (
        <p className="muted">{page === 1 ? "No daily activity has synced yet." : "No records on this page."}</p>
      )}
      {history.rows.length > 0 && (
        <div className="records-table-scroll">
          <table className="records-table daily-records" aria-labelledby="daily-activity-title">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Steps</th>
                <th scope="col">Moving time</th>
                <th scope="col">Est. calories</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((record) => {
                const activity = formatOverallActivity(record);
                return (
                  <tr key={record.id}>
                    <th scope="row"><time dateTime={record.activity_date}>{activity.date}</time></th>
                    <td>{activity.steps}</td>
                    <td>{activity.movingTime}</td>
                    <td>{activity.calories}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.max(page, history.totalPages)} onPageChange={setPage} />
    </section>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import {
  emptyCardio,
  FormattedNotes,
  formatDate,
  formatDuration,
  MiniStat,
  paceText,
  type CardioSession,
} from "@/app/components/shared";
import { loadWebCardio, type SyncState } from "@/lib/webData";
import { appAlert, appToast } from "@/lib/sweetAlert";

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sourceText(source: CardioSession["cardio_source"]) {
  if (source === "outdoor") return "Outdoor";
  if (source === "treadmill") return "Treadmill";
  return "Manual";
}

function titleText(type: CardioSession["cardio_type"]) {
  return type === "running" ? "Run" : "Walk";
}

function buildCardioClipboardText(session: CardioSession) {
  const lines = [
    `${titleText(session.cardio_type)} Cardio`,
    formatDate(session.session_date),
    "",
    `Distance: ${session.distance_km.toFixed(2)} km`,
    `Steps: ${session.steps}`,
    `Calories Burned: ${session.calories_burned} kcal`,
    `Duration: ${formatDuration(session.duration_seconds)}`,
  ];

  if (session.notes.trim()) {
    lines.push("", "Notes:", session.notes.trim());
  }

  return lines.join("\n");
}

export default function CardioDetailsPage() {
  const params = useParams();
  const sessionId = routeParam(params.id);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [sessions, setSessions] = useState<CardioSession[]>(emptyCardio);

  useEffect(() => {
    let active = true;

    loadWebCardio().then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Cardio Load Failed",
          "Could not load this cardio session from Supabase.",
          "error",
        );
        return;
      }

      setSessions(data);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, []);

  const session = sessions.find((item) => item.id === sessionId) || null;

  async function copyCardioDetails() {
    if (!session) return;

    try {
      await navigator.clipboard.writeText(buildCardioClipboardText(session));
      await appToast("Cardio details copied");
    } catch {
      await appAlert(
        "Copy Failed",
        "Could not copy cardio details to clipboard.",
        "error",
      );
    }
  }

  if (!session) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Cardio</p>
            <h1>Session Details</h1>
            <p className="muted">
              Data source:{" "}
              {syncState === "supabase" ? "Supabase" : "Waiting for session"}
            </p>
          </div>
          <Link className="button" href="/pages/cardio">
            <ArrowLeft size={18} aria-hidden="true" />
            History
          </Link>
        </header>
        <div className="card">
          <p className="muted">Cardio session not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cardio</p>
          <h1>{titleText(session.cardio_type)}</h1>
          <p className="muted">
            {sourceText(session.cardio_source)} -{" "}
            {formatDate(session.session_date)}
          </p>
        </div>
        <div className="row responsive">
          <button className="button" onClick={copyCardioDetails} type="button">
            <Copy size={18} aria-hidden="true" />
            Copy
          </button>
          <Link className="button" href="/pages/cardio">
            <ArrowLeft size={18} aria-hidden="true" />
            History
          </Link>
        </div>
      </header>

      <section className="grid two-col">
        <div className="card stack">
          <h2>Summary</h2>
          <div className="row wrap">
            <MiniStat
              label="Distance"
              value={`${session.distance_km.toFixed(2)} km`}
            />
            <MiniStat
              label="Time"
              value={formatDuration(session.duration_seconds)}
            />
            <MiniStat
              label="Pace"
              value={paceText(session.distance_km, session.duration_seconds)}
            />
            <MiniStat label="Steps" value={`${session.steps}`} />
            <MiniStat label="Calories" value={`${session.calories_burned} kcal`} />
          </div>
        </div>

        <div className="card stack">
          <h2>Notes</h2>
          <FormattedNotes notes={session.notes} fallback="No notes saved." />
        </div>
      </section>
    </div>
  );
}

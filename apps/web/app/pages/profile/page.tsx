"use client";

import { BarChart3, Ruler, Scale, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BodyWeightLog,
  emptyProfile,
  formatDate,
  MiniStat,
  Modal,
  toDateKey,
  useLocalState,
  WeightChart,
} from "@/app/components/shared";
import {
  loadWebProfile,
  saveWebHeight,
  saveWebWeightLog,
  signOutWeb,
  type SyncState,
} from "@/lib/webData";
import { appAlert, appConfirm, appToast } from "@/lib/sweetAlert";

function formatNumber(value?: number | null, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}${unit}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useLocalState("mxrvs-web-profile", emptyProfile);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [heightModalOpen, setHeightModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("local");

  useEffect(() => {
    let active = true;

    loadWebProfile(emptyProfile).then((data) => {
      if (!active) return;
      if (!data) {
        void appAlert(
          "Profile Load Failed",
          "Could not load your profile from Supabase.",
          "error",
        );
        return;
      }
      setProfile(data);
      setSyncState("supabase");
    });

    return () => {
      active = false;
    };
  }, [setProfile]);

  const latestLog = useMemo(() => {
    return [...profile.weightLogs].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0] || null;
  }, [profile.weightLogs]);

  async function logWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weight = Number(form.get("weight_kg"));
    const bodyFatValue = String(form.get("body_fat_percent") || "").trim();
    const bodyFat = bodyFatValue ? Number(bodyFatValue) : null;
    const date = String(form.get("date") || toDateKey());

    if (!Number.isFinite(weight) || weight <= 0) {
      await appAlert("Invalid Weight", "Please enter a valid body weight.", "warning");
      return;
    }
    if (bodyFat !== null && (!Number.isFinite(bodyFat) || bodyFat < 0 || bodyFat > 100)) {
      await appAlert(
        "Invalid Body Fat",
        "Body fat must be between 0 and 100.",
        "warning",
      );
      return;
    }

    const draftLog: Omit<BodyWeightLog, "id"> = {
      date,
      logged_at: new Date(`${date}T12:00:00`).toISOString(),
      weight_kg: weight,
      body_fat_percent: bodyFat,
    };
    const savedLog = await saveWebWeightLog(draftLog);
    if (!savedLog) {
      await appAlert(
        "Save Failed",
        "Could not save your weight log. Please try again.",
        "error",
      );
      return;
    }

    const nextLog: BodyWeightLog = {
      id: savedLog.id,
      ...draftLog,
    };

    setProfile((current) => ({
      ...current,
      weightLogs: [nextLog, ...current.weightLogs].sort((a, b) => b.date.localeCompare(a.date)),
    }));
    setWeightModalOpen(false);
    await appToast("Weight logged");
  }

  async function updateHeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const height = Number(form.get("height_cm"));
    if (!Number.isFinite(height) || height <= 0) {
      await appAlert("Invalid Height", "Please enter a valid height.", "warning");
      return;
    }

    const savedHeight = await saveWebHeight(height);
    if (!savedHeight) {
      await appAlert(
        "Update Failed",
        "Could not save your height. Please try again.",
        "error",
      );
      return;
    }

    setProfile((current) => ({ ...current, height_cm: savedHeight }));
    setHeightModalOpen(false);
    await appToast("Height updated");
  }

  async function signOut() {
    const confirmed = await appConfirm({
      title: "Sign Out?",
      text: "You will need to sign back in to sync with Supabase.",
      confirmButtonText: "Sign Out",
      icon: "info",
    });

    if (!confirmed) return;

    await signOutWeb();
    setSyncState("local");
    await appToast("Signed out");
    router.replace("/login");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="row">
          <span className="check-dot" style={{ height: 64, width: 64 }}>
            <UserRound size={28} />
          </span>
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{profile.display_name}</h1>
            <p className="muted">{profile.email}</p>
            <p className="muted">Data source: {syncState === "supabase" ? "Supabase" : "Waiting for session"}</p>
          </div>
        </div>
      </header>

      <section className="grid two-col">
        <div className="stack">
          <div className="card stack">
            <div className="row between responsive">
              <div>
                <h2>Supabase Session</h2>
                <p className="muted">{syncState === "supabase" ? "Signed in and syncing with the mobile database." : "Sign in with the same account used on mobile."}</p>
              </div>
              {syncState === "supabase" ? (
                <button className="button" onClick={signOut} type="button">Sign Out</button>
              ) : null}
            </div>
          </div>

          <div className="card stack">
            <div className="row between">
              <h2>Body Stats</h2>
              <BarChart3 size={20} aria-hidden="true" />
            </div>
            <div className="grid three-col">
              <div className="stat">
                <Scale size={18} color="var(--primary)" />
                <span>Current Weight</span>
                <strong>{formatNumber(latestLog?.weight_kg, " kg")}</strong>
                <small className="faint">{latestLog ? formatDate(latestLog.date) : "No log yet"}</small>
              </div>
              <div className="stat">
                <Ruler size={18} color="var(--primary)" />
                <span>Height</span>
                <strong>{formatNumber(profile.height_cm, " cm")}</strong>
                <small className="faint">Used for indoor distance</small>
              </div>
              <div className="stat">
                <span>Body Fat</span>
                <strong>{formatNumber(latestLog?.body_fat_percent, "%")}</strong>
                <small className="faint">Optional</small>
              </div>
            </div>
            <div className="row responsive">
              <button className="button primary" onClick={() => setWeightModalOpen(true)} type="button">
                <Scale size={17} aria-hidden="true" />
                Log Weight
              </button>
              <button className="button" onClick={() => setHeightModalOpen(true)} type="button">
                <Ruler size={17} aria-hidden="true" />
                Edit Height
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Weight Reports</h2>
            <div className="chart-wrap">
              <WeightChart logs={profile.weightLogs} />
            </div>
          </div>
        </div>

        <div className="stack log-panel">
          <div className="row between">
            <h2>Weight History</h2>
            <strong className="muted">{profile.weightLogs.length}</strong>
          </div>
          <div className="stack log-scroll">
            {profile.weightLogs.map((log) => (
              <article className="list-item stack" key={log.id}>
                <div className="row between">
                  <div>
                    <h3>{formatDate(log.date)}</h3>
                    <p className="muted">Body measurement</p>
                  </div>
                </div>
                <div className="row wrap">
                  <MiniStat label="Weight" value={`${log.weight_kg} kg`} />
                  <MiniStat label="Body Fat" value={log.body_fat_percent == null ? "--" : `${log.body_fat_percent}%`} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {weightModalOpen ? (
        <Modal title="Log Weight" onClose={() => setWeightModalOpen(false)}>
          <form className="stack" onSubmit={logWeight}>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input className="input" defaultValue={toDateKey()} id="date" name="date" required type="date" />
            </div>
            <div className="field">
              <label htmlFor="weight_kg">Weight kg</label>
              <input className="input" defaultValue={latestLog?.weight_kg || ""} id="weight_kg" min="1" name="weight_kg" required step="0.1" type="number" />
            </div>
            <div className="field">
              <label htmlFor="body_fat_percent">Body fat %</label>
              <input className="input" defaultValue={latestLog?.body_fat_percent || ""} id="body_fat_percent" min="0" max="100" name="body_fat_percent" step="0.1" type="number" />
            </div>
            <button className="button primary" type="submit">Save Weight</button>
          </form>
        </Modal>
      ) : null}

      {heightModalOpen ? (
        <Modal title="Edit Height" onClose={() => setHeightModalOpen(false)}>
          <form className="stack" onSubmit={updateHeight}>
            <div className="field">
              <label htmlFor="height_cm">Height cm</label>
              <input className="input" defaultValue={profile.height_cm || ""} id="height_cm" min="1" name="height_cm" required step="0.1" type="number" />
            </div>
            <button className="button primary" type="submit">Save Height</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

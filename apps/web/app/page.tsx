import Image from "next/image";

const metrics = [
  { label: "Weekly volume", value: "18.4k", detail: "lbs lifted" },
  { label: "Calories logged", value: "12.8k", detail: "this week" },
  { label: "Cardio distance", value: "24.6", detail: "km tracked" },
];

const sessions = [
  "Push hypertrophy",
  "Zone 2 run",
  "Leg strength",
  "Meal prep review",
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary">
        <div className="brand">
          <Image src="/mxrvs.png" alt="" width={36} height={36} priority />
          <span>mxrvs</span>
        </div>
        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#training">Training</a>
          <a href="#nutrition">Nutrition</a>
        </div>
      </nav>

      <section className="hero" id="overview">
        <div className="hero-copy">
          <p className="eyebrow">Web workspace</p>
          <h1>Training, nutrition, and cardio in one calm dashboard.</h1>
          <p>
            A Next.js home for the mxrvs web app, ready to grow beside the Expo
            mobile experience without sharing a route tree.
          </p>
          <div className="actions">
            <a className="primary" href="#training">
              View plan
            </a>
            <a className="secondary" href="#nutrition">
              Review macros
            </a>
          </div>
        </div>

        <div className="panel" aria-label="Today snapshot">
          <div className="panel-header">
            <span>Today</span>
            <strong>72%</strong>
          </div>
          <div className="progress">
            <span />
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session" key={session}>
                <span>{session}</span>
                <small>Planned</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Weekly metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="split">
        <article id="training">
          <p className="eyebrow">Training</p>
          <h2>Keep the mobile app focused, let the web app breathe.</h2>
          <p>
            The web surface can become the place for reporting, planning, and
            deeper analysis while the mobile app stays tuned for logging in the
            moment.
          </p>
        </article>
        <article id="nutrition">
          <p className="eyebrow">Nutrition</p>
          <h2>Macro and meal views are ready for expansion.</h2>
          <p>
            Start with static dashboard structure, then connect Supabase and the
            existing nutrition services when the web product direction is clear.
          </p>
        </article>
      </section>
    </main>
  );
}

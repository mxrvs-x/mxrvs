"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Dumbbell,
  FlaskConical,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getWebUser } from "@/lib/webData";
import { hasActiveStoredWorkoutSession } from "@/lib/workoutSessionStore";

type ThemeMode = "light" | "dark";

const links = [
  { href: "/pages/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/pages/cardio", label: "Cardio", icon: Activity },
  { href: "/pages/creatine", label: "Creatine", icon: FlaskConical },
  { href: "/pages/profile", label: "Profile", icon: UserRound },
];

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    getWebUser().then((user) => {
      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setAuthReady(true);
    });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const stored = window.localStorage.getItem("mxrvs-web-theme");
    const initial =
      stored === "light" || stored === "dark"
        ? stored
        : "dark";

    setThemeMode(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("mxrvs-web-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasActiveStoredWorkoutSession()) return;

      event.preventDefault();
      event.returnValue = "Session is active, are you sure to close the tab?";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, []);

  const currentLabel = useMemo(() => {
    return (
      links.find((link) => pathname.startsWith(link.href))?.label || "mxrvs"
    );
  }, [pathname]);

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="card auth-card">
          <div className="brand-mark">
            <Image src="/mxrvs.png" alt="" width={40} height={40} priority />
            <div>
              <strong>mxrvs</strong>
              <span>Checking session</span>
            </div>
          </div>
          <p className="muted">Loading your Supabase session...</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidenav" aria-label="Primary">
        <div className="brand-mark">
          <Image src="/mxrvs.png" alt="" width={36} height={36} priority />
          <div>
            <strong>mxrvs</strong>
            <span>{currentLabel}</span>
          </div>
        </div>

        <nav className="side-links">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "side-link active" : "side-link"}
                href={link.href}
                key={link.href}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="theme-toggle" aria-label="Theme">
          <button
            aria-pressed={themeMode === "light"}
            className={themeMode === "light" ? "active" : ""}
            onClick={() => setThemeMode("light")}
            title="Light mode"
            type="button"
          >
            <Sun size={18} aria-hidden="true" />
          </button>
          <button
            aria-pressed={themeMode === "dark"}
            className={themeMode === "dark" ? "active" : ""}
            onClick={() => setThemeMode("dark")}
            title="Dark mode"
            type="button"
          >
            <Moon size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="page-frame">{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "active" : ""}
              href={link.href}
              key={link.href}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

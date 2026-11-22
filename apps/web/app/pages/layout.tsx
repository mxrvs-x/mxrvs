"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Dumbbell,
  FlaskConical,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getWebUser } from "@/lib/webData";
import { hasActiveStoredWorkoutSession } from "@/lib/workoutSessionStore";

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

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="card auth-card">
          <div className="brand-mark">
            <Image src="/mxrvs.png" alt="" width={40} height={40} priority />
            <div>
              <strong>mxrvs</strong>
              <span>Train. Track. Progress.</span>
            </div>
          </div>
          <p className="muted">Loading your training space...</p>
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

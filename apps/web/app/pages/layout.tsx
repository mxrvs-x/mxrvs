"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Dumbbell,
  FlaskConical,
  Footprints,
  Menu,
  Moon,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getWebUser } from "@/lib/webData";
import { hasActiveStoredWorkoutSession } from "@/lib/workoutSessionStore";

const links = [
  { href: "/pages/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/pages/cardio", label: "Cardio", icon: Activity },
  { href: "/pages/overall-activity", label: "Overall Activity", icon: Footprints, inDrawer: true },
  { href: "/pages/creatine", label: "Creatine", icon: FlaskConical, inDrawer: true },
  { href: "/pages/macros", label: "Macros", icon: Utensils },
  { href: "/pages/sleep", label: "Sleep", icon: Moon, inDrawer: true },
  { href: "/pages/profile", label: "Profile", icon: UserRound, inDrawer: true },
];

const bottomLinks = links.filter((link) => !link.inDrawer);
const drawerLinks = links.filter((link) => link.inDrawer);

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDialog = useRef<HTMLDialogElement>(null);
  const drawerActive = drawerLinks.some((link) => pathname.startsWith(link.href));

  useEffect(() => {
    menuDialog.current?.close();
  }, [pathname]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1199px)");
    function closeOnDesktop() {
      if (!compact.matches) menuDialog.current?.close();
    }
    compact.addEventListener("change", closeOnDesktop);
    return () => compact.removeEventListener("change", closeOnDesktop);
  }, []);

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
        {bottomLinks.map((link) => {
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
        <button
          type="button"
          className={menuOpen || drawerActive ? "active" : undefined}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="compact-menu"
          onClick={() => {
            menuDialog.current?.showModal();
            setMenuOpen(true);
          }}
        >
          <Menu size={19} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>

      <dialog
        ref={menuDialog}
        id="compact-menu"
        className="compact-menu"
        aria-labelledby="compact-menu-title"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) menuDialog.current?.close();
        }}
      >
        <div className="compact-menu-content stack">
          <div className="row between">
            <h2 id="compact-menu-title">Menu</h2>
            <button className="icon-button" type="button" aria-label="Close menu" onClick={() => menuDialog.current?.close()}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav className="side-links" aria-label="More pages">
            {drawerLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={active ? "side-link active" : "side-link"}
                  href={href}
                  key={href}
                  onClick={() => menuDialog.current?.close()}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </dialog>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getWebUser, signInWeb } from "@/lib/webData";
import { supabaseConfigError } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    getWebUser().then((user) => {
      if (active && user) {
        router.replace("/pages/workouts");
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const result = await signInWeb(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.replace("/pages/workouts");
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <div className="brand-mark">
          <Image src="/mxrvs.png" alt="" width={44} height={44} priority />
          <div>
            <strong>mxrvs</strong>
            <span>Supabase login</span>
          </div>
        </div>

        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
          <p className="muted">Use the same account as the mobile app.</p>
        </div>

        <form className="stack" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              autoComplete="email"
              className="input"
              disabled={Boolean(supabaseConfigError) || loading}
              id="email"
              name="email"
              required
              type="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              className="input"
              disabled={Boolean(supabaseConfigError) || loading}
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          <button
            className="button primary"
            disabled={Boolean(supabaseConfigError) || loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {error ? <p className="auth-error">{error}</p> : null}
      </section>
    </main>
  );
}

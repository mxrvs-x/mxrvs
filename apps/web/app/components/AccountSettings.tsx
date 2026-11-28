"use client";

import { supabase } from "@/lib/supabase";
import { useAccountSettings } from "../../../mobile/lib/useAccountSettings";

export default function AccountSettings({ email, onEmailChanged }: {
  email: string; onEmailChanged: (email: string) => void;
}) {
  const account = useAccountSettings(supabase.auth, email, onEmailChanged);
  return (
    <section className="card stack" aria-labelledby="account-settings-title">
      <h2 id="account-settings-title">Account</h2>
      <p className="muted">{email || "No email on file"}</p>
      {account.mode ? (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void account.submit(); }}>
          {account.mode === "email" ? (
            <label className="field">New email
              <input className="input" type="email" autoComplete="email" required value={account.fields.email}
                disabled={account.busy} onChange={(event) => account.change("email", event.target.value)} />
            </label>
          ) : (
            <>
              <label className="field">Current password (if required)
                <input className="input" type="password" autoComplete="current-password" value={account.fields.currentPassword}
                  disabled={account.busy} onChange={(event) => account.change("currentPassword", event.target.value)} />
              </label>
              <label className="field">New password
                <input className="input" type="password" autoComplete="new-password" required value={account.fields.password}
                  disabled={account.busy} onChange={(event) => account.change("password", event.target.value)} />
              </label>
              <label className="field">Confirm new password
                <input className="input" type="password" autoComplete="new-password" required value={account.fields.confirmation}
                  disabled={account.busy} onChange={(event) => account.change("confirmation", event.target.value)} />
              </label>
              {account.needsCode && (
                <>
                  <button className="button" type="button" disabled={account.busy} onClick={() => void account.sendCode()}>Send verification code</button>
                  <label className="field">Verification code
                    <input className="input" autoComplete="one-time-code" inputMode="numeric" value={account.fields.code}
                      disabled={account.busy} onChange={(event) => account.change("code", event.target.value)} />
                  </label>
                </>
              )}
            </>
          )}
          {account.error && <p className="auth-error" role="alert">{account.error}</p>}
          <div className="row wrap">
            <button className="button primary" type="submit" disabled={account.busy}>{account.busy ? "Working…" : "Save change"}</button>
            <button className="button" type="button" disabled={account.busy} onClick={() => account.choose(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="row wrap">
          <button className="button" type="button" onClick={() => account.choose("email")}>Change email</button>
          <button className="button" type="button" onClick={() => account.choose("password")}>Change password</button>
        </div>
      )}
      {account.notice && <p className="muted" role="status">{account.notice}</p>}
    </section>
  );
}

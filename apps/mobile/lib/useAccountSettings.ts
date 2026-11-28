import type { SupabaseClient } from "@supabase/supabase-js";
import { useRef, useState } from "react";

type Mode = "email" | "password";
const emptyFields = { email: "", password: "", confirmation: "", currentPassword: "", code: "" };

export function useAccountSettings(
  auth: SupabaseClient["auth"],
  currentEmail: string,
  onEmailChanged: (email: string) => void,
) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const pending = useRef(false);

  function choose(next: Mode | null) {
    if (pending.current) return;
    setMode(next);
    setFields(emptyFields);
    setError("");
    setNotice("");
    setNeedsCode(false);
  }

  function change(field: keyof typeof emptyFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch {
      setError("Could not reach Supabase. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function submit() {
    if (!mode || pending.current) return;
    const email = fields.email.trim();
    const nonce = fields.code.trim();
    if (mode === "email") {
      if (!/^[^\s@]+@[^\s@]+$/.test(email)) return setError("Enter a valid new email address.");
      if (email.toLowerCase() === currentEmail.toLowerCase()) return setError("Enter a different email address.");
    } else {
      if (!fields.password) return setError("Enter a new password.");
      if (fields.password !== fields.confirmation) return setError("The new passwords don’t match.");
      if (needsCode && !nonce) return setError("Enter the verification code.");
    }

    await perform(async () => {
      const { data, error: problem } = await auth.updateUser(mode === "email" ? { email } : {
        password: fields.password,
        ...(fields.currentPassword ? { current_password: fields.currentPassword } : {}),
        ...(nonce ? { nonce } : {}),
      });
      if (problem) {
        if (mode === "password" && (problem.code === "reauthentication_needed" || problem.code === "reauthentication_not_valid")) {
          setNeedsCode(true);
        }
        setError(problem.message);
        return;
      }
      if (mode === "email") {
        if (data.user?.email?.toLowerCase() === email.toLowerCase()) {
          onEmailChanged(data.user.email);
          setNotice("Email updated.");
        } else {
          setNotice("Follow the confirmation links from Supabase to finish changing your email. Check both inboxes.");
        }
      } else {
        setNotice("Password updated.");
      }
      setFields(emptyFields);
      setNeedsCode(false);
      setMode(null);
    });
  }

  async function sendCode() {
    await perform(async () => {
      const { error: problem } = await auth.reauthenticate();
      if (problem) setError(problem.message);
      else setNotice("Verification code sent. Enter it below.");
    });
  }

  return { mode, choose, fields, change, busy, error, notice, needsCode, submit, sendCode };
}

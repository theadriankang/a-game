"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally ignored - see the neutral-response note below. A
      // network hiccup here shouldn't surface differently than any other
      // outcome, since this form never reveals whether anything worked.
    } finally {
      setLoading(false);
      // Always show the same confirmation, whether the request succeeded,
      // the email doesn't exist, or it failed outright - this page must
      // not become a way to check which emails are registered.
      setSent(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text0">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-text2">
          Remembered it after all?{" "}
          <Link href="/sign-in" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </div>

      {sent ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text1">
          If that email has an account, we&apos;ve sent a link to reset your
          password. It expires in 30 minutes.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text1">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </main>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";

type TokenStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary around it in the app router -
  // the fallback barely shows (the check is fast), but avoids a build error.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the token as soon as the page loads, so an expired/used/missing
  // link shows a clear message right away instead of only failing on submit.
  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid");
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setTokenStatus(data.valid ? "valid" : "invalid"))
      .catch(() => setTokenStatus("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        // The token may have just expired or been used elsewhere between
        // page-load and submit - reflect that in the page state too.
        if (res.status === 400) setTokenStatus("invalid");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (tokenStatus === "checking") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
        <p className="text-sm text-text2">Checking your reset link…</p>
      </main>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
        <h1 className="text-xl font-bold tracking-tight text-text0">
          This link has expired
        </h1>
        <p className="text-sm text-text2">
          Reset links are only valid for 30 minutes and can only be used
          once.{" "}
          <Link href="/forgot-password" className="font-medium text-accent">
            Request a new one
          </Link>
          .
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
        <h1 className="text-xl font-bold tracking-tight text-text0">
          Password updated
        </h1>
        <p className="text-sm text-text2">Taking you to sign in…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text0">
          Choose a new password
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text1">
            New password
          </span>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
          />
          <span className="text-[12px] text-text3">At least 8 characters.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text1">
            Confirm new password
          </span>
          <PasswordInput
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
          />
        </label>

        {error && <p className="text-[13px] text-red">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SettingsPanel() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    const res = await fetch("/api/telegram/status");
    if (res.ok) {
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) setAwaitingConfirm(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/telegram/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the connection.");
        return;
      }
      window.open(data.deepLink, "_blank");
      setAwaitingConfirm(true);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/telegram/status", { method: "DELETE" });
    setConnected(false);
    setAwaitingConfirm(false);
  }

  return (
    <div className="min-h-screen bg-page text-text0">
      <header className="flex items-center justify-between border-b border-border bg-surface px-7 py-4">
        <div className="text-lg font-bold tracking-tight">Settings</div>
        <Link
          href="/planner"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
        >
          Back to planner
        </Link>
      </header>

      <div className="mx-auto max-w-lg p-7">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[14px] font-semibold text-text1">Telegram notifications</div>
          <p className="mt-1 text-[12.5px] text-text3">
            Get a message when a module analysis you requested is ready, instead of having to
            check back.
          </p>

          <div className="mt-3">
            {connected === null ? (
              <div className="text-[12.5px] text-text3">Checking…</div>
            ) : connected ? (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full border border-green-border bg-green-bg px-2.5 py-1 text-[12px] font-semibold text-green">
                  Connected
                </span>
                <button
                  onClick={disconnect}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors duration-150 hover:bg-seg-bg"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
                >
                  {connecting ? "Opening Telegram…" : "Connect Telegram"}
                </button>
                {awaitingConfirm ? (
                  <div className="mt-2.5 rounded-lg bg-seg-bg p-2.5 text-[12px] text-text2">
                    Tap <span className="font-semibold">Start</span> in the chat that opened, then
                    come back here.
                    <button
                      onClick={refreshStatus}
                      className="ml-2 font-semibold text-accent hover:underline"
                    >
                      I&rsquo;ve done that - refresh
                    </button>
                  </div>
                ) : null}
                {error ? <div className="mt-2 text-[12px] text-red">{error}</div> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

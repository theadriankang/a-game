"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LlmProvider = "ANTHROPIC" | "SOCLAAS";

type Props = {
  initialLlmProvider: LlmProvider;
};

export function SettingsPanel({ initialLlmProvider }: Props) {
  const [provider, setProvider] = useState<LlmProvider>(initialLlmProvider);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);

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

  // Optimistic: flip the toggle immediately, roll back if the save fails.
  async function updateProvider(next: LlmProvider) {
    if (next === provider || savingProvider) return;
    const previous = provider;
    setProviderError(null);
    setSavingProvider(true);
    setProvider(next);
    try {
      const res = await fetch("/api/settings/llm-provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      if (!res.ok) {
        setProvider(previous);
        const data = await res.json().catch(() => null);
        setProviderError(data?.error ?? "Couldn't save that - try again.");
      }
    } catch {
      setProvider(previous);
      setProviderError("Request failed.");
    } finally {
      setSavingProvider(false);
    }
  }

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

  async function runWebhookSetup() {
    setSettingUpWebhook(true);
    setWebhookResult(null);
    try {
      const res = await fetch("/api/telegram/setup-webhook", { method: "POST" });
      const data = await res.json();
      setWebhookResult(
        res.ok ? "Done - Telegram is now pointed at this deployment." : data.error ?? "Failed."
      );
    } catch {
      setWebhookResult("Request failed.");
    } finally {
      setSettingUpWebhook(false);
    }
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
          <div className="text-[14px] font-semibold text-text1">Module analysis</div>
          <p className="mt-1 text-[12.5px] text-text3">
            Which LLM runs your own &ldquo;Request analysis&rdquo; clicks on a module page.
            Doesn&rsquo;t change reports already cached for everyone, or modules added
            automatically from your plan - those always use the deployment&rsquo;s default.
          </p>

          <div className="mt-3 inline-flex rounded-lg border border-border bg-seg-bg p-1">
            <button
              onClick={() => updateProvider("ANTHROPIC")}
              disabled={savingProvider}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 disabled:opacity-50 ${
                provider === "ANTHROPIC"
                  ? "bg-surface text-text1 shadow-sm"
                  : "text-text3 hover:text-text2"
              }`}
            >
              Claude
            </button>
            <button
              onClick={() => updateProvider("SOCLAAS")}
              disabled={savingProvider}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 disabled:opacity-50 ${
                provider === "SOCLAAS"
                  ? "bg-surface text-text1 shadow-sm"
                  : "text-text3 hover:text-text2"
              }`}
            >
              SoCLaaS
            </button>
          </div>

          <p className="mt-2.5 text-[11.5px] text-text3">
            {provider === "SOCLAAS"
              ? "SoCLaaS (NUS SoC's free LLM gateway) has no live web search, so its summaries are the model's own best guess from training data, not a fresh read of current discussion."
              : "Claude has live web search, so its summaries reflect what students are currently saying - this is the default."}
          </p>
          {providerError ? <div className="mt-2 text-[12px] text-red">{providerError}</div> : null}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
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

        <div className="mt-4 rounded-xl border border-dashed border-border p-4">
          <div className="text-[13px] font-semibold text-text1">One-time deployment setup</div>
          <p className="mt-1 text-[12px] text-text3">
            Run this once after setting the Telegram env vars in Vercel (and again if the app&rsquo;s
            domain ever changes) - it just tells Telegram where to send bot messages. Anyone signed
            in can run it; it doesn&rsquo;t touch any account data.
          </p>
          <button
            onClick={runWebhookSetup}
            disabled={settingUpWebhook}
            className="mt-2.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg disabled:opacity-50"
          >
            {settingUpWebhook ? "Setting up…" : "Set up Telegram webhook"}
          </button>
          {webhookResult ? <div className="mt-2 text-[12px] text-text2">{webhookResult}</div> : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [programme, setProgramme] = useState("BComp (Computer Science)");
  const [priorDiploma, setPriorDiploma] = useState("");
  const [suBudgetTotalMc, setSuBudgetTotalMc] = useState(32);
  const [exemptionsText, setExemptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const exemptions = exemptionsText
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programme,
        priorDiploma,
        suBudgetTotalMc,
        exemptions,
      }),
    });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/planner");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Programme</span>
        <input
          required
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">
          Prior diploma (optional)
        </span>
        <input
          value={priorDiploma}
          onChange={(e) => setPriorDiploma(e.target.value)}
          placeholder="e.g. Engineering with Business, Singapore Polytechnic"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">
          S/U budget (MC)
        </span>
        <input
          type="number"
          min={0}
          max={60}
          value={suBudgetTotalMc}
          onChange={(e) => setSuBudgetTotalMc(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">
          Confirmed exemptions (optional)
        </span>
        <input
          value={exemptionsText}
          onChange={(e) => setExemptionsText(e.target.value)}
          placeholder="e.g. CS2101, IS1108"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        />
        <span className="text-[12px] text-text3">
          Comma-separated module codes from your Transfer Credit Report.
          Leave blank if you don&apos;t have any yet — you can add these
          later.
        </span>
      </label>

      {error && <p className="text-[13px] text-red">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { nusFaculties } from "@/lib/education-data/nus-programmes";
import { polytechnics } from "@/lib/education-data/polytechnic-diplomas";

// Modules are credited in multiples of 4 MC, so a free-typed number field
// just invited typos (and had its own "0" display bug) for no benefit over
// a short list of the values that are actually valid.
const SU_BUDGET_OPTIONS = Array.from({ length: 16 }, (_, i) => i * 4); // 0, 4, ..., 60

const DEFAULT_FACULTY = "School of Computing";
const DEFAULT_PROGRAMME = "Bachelor of Computing in Computer Science";

export function OnboardingForm() {
  const router = useRouter();
  const [faculty, setFaculty] = useState(DEFAULT_FACULTY);
  const [programme, setProgramme] = useState(DEFAULT_PROGRAMME);

  const [hasDiploma, setHasDiploma] = useState(false);
  const [polytechnic, setPolytechnic] = useState(polytechnics[0].name);
  const [diploma, setDiploma] = useState(polytechnics[0].schools[0].diplomas[0]);

  const [suBudgetTotalMc, setSuBudgetTotalMc] = useState(32);
  const [exemptionsText, setExemptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const programmesForFaculty = useMemo(
    () => nusFaculties.find((f) => f.name === faculty)?.programmes ?? [],
    [faculty]
  );

  const schoolsForPolytechnic = useMemo(
    () => polytechnics.find((p) => p.name === polytechnic)?.schools ?? [],
    [polytechnic]
  );

  function handleFacultyChange(name: string) {
    setFaculty(name);
    const first = nusFaculties.find((f) => f.name === name)?.programmes[0];
    if (first) setProgramme(first);
  }

  function handlePolytechnicChange(name: string) {
    setPolytechnic(name);
    const first = polytechnics.find((p) => p.name === name)?.schools[0]?.diplomas[0];
    if (first) setDiploma(first);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const exemptions = exemptionsText
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme: `${programme} (${faculty})`,
          priorDiploma: hasDiploma ? `${diploma}, ${polytechnic}` : "",
          suBudgetTotalMc,
          exemptions,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/planner");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Faculty</span>
        <select
          value={faculty}
          onChange={(e) => handleFacultyChange(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {nusFaculties.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Programme</span>
        <select
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {programmesForFaculty.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hasDiploma}
          onChange={(e) => setHasDiploma(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-[13px] font-medium text-text1">
          I have a diploma from a Polytechnic
        </span>
      </label>

      {hasDiploma && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-page p-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text1">
              Polytechnic
            </span>
            <select
              value={polytechnic}
              onChange={(e) => handlePolytechnicChange(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
            >
              {polytechnics.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text1">
              Diploma course
            </span>
            <select
              value={diploma}
              onChange={(e) => setDiploma(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
            >
              {schoolsForPolytechnic.map((s) => (
                <optgroup key={s.school} label={s.school}>
                  {s.diplomas.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">
          S/U budget (MC)
        </span>
        <select
          value={suBudgetTotalMc}
          onChange={(e) => setSuBudgetTotalMc(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {SU_BUDGET_OPTIONS.map((mc) => (
            <option key={mc} value={mc}>
              {mc} MC
            </option>
          ))}
        </select>
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

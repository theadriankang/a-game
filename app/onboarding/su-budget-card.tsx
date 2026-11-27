"use client";

import { useState } from "react";
import { APC_OPTION_EXTRA_UNITS, type PriorUniversity, type SuBudget } from "@/lib/su-budget";

const MANUAL_OPTIONS = Array.from({ length: 31 }, (_, i) => i * 2); // 0, 2, ..., 60

function breakdown(b: SuBudget): string {
  if (!b.applies) return "";
  const parts: string[] = [];
  if (b.firstYearUnits > 0) parts.push(`${b.firstYearUnits} MC for courses you finish in your ${b.firstYearWindow}`);
  parts.push(`${b.anytimeUnits} MC at any time`);
  return `${parts.join(", plus ")}.`;
}

function reason(b: SuBudget, polytechnic: boolean): string {
  switch (b.basis) {
    case "not-applicable":
      return "NUS's S/U scheme doesn't cover Law, Dentistry or Medicine (except Nursing).";
    case "degree":
      return "Students who already hold a degree aren't eligible for the S/U scheme.";
    case "prior-credits":
      return "With prior university credits recognised toward your degree, you get 12 MC to use at any time.";
    case "apc":
      return polytechnic
        ? "Polytechnic diploma holders get 20 elective APC units automatically, and with 20 or more APCs the scheme gives you 20 MC instead of the standard 32."
        : "With 20 or more APCs, the scheme gives you 20 MC instead of the standard 32.";
    default:
      return "Without a polytechnic diploma or 20+ APCs (JC, IB and other routes), you get the standard scheme: 32 MC.";
  }
}

/**
 * The S/U budget, worked out from the programme, intake year and exemptions already on the form, with the
 * reasoning shown. "Adjust" (next to the total) covers the cases the form can't know (prior university study, the APC option)
 * and a manual override for anything NUS has told the student differently.
 */
export function SuBudgetCard({
  budget,
  apcUnits,
  override,
  onOverride,
  priorUniversity,
  onPriorUniversity,
  takesApcOption,
  onTakesApcOption,
  polytechnic,
}: {
  budget: SuBudget;
  apcUnits: number;
  override: number | null;
  onOverride: (total: number | null) => void;
  priorUniversity: PriorUniversity;
  onPriorUniversity: (v: PriorUniversity) => void;
  takesApcOption: boolean;
  onTakesApcOption: (v: boolean) => void;
  /** whether the student ticked a polytechnic diploma (changes how the reason is worded) */
  polytechnic: boolean;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const total = override ?? budget.total;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-text1">S/U budget</span>
        <span className="flex items-center gap-2">
          {override !== null && (
            <span className="inline-flex items-center rounded-full border border-amber-border bg-amber-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-amber">
              set by you
            </span>
          )}
          <button
            type="button"
            onClick={() => setAdjusting((v) => !v)}
            aria-expanded={adjusting}
            className="text-[12px] font-medium text-accent underline"
          >
            {adjusting ? "Done" : "Adjust"}
          </button>
          <span className="text-[13px] font-semibold text-text0">{total} MC</span>
        </span>
      </div>

      <p className="text-[12.5px] leading-snug text-text2">
        {reason(budget, polytechnic)}
        {budget.apcOptionApplied && ` Giving up your 20 elective APC units adds ${APC_OPTION_EXTRA_UNITS} MC.`}
      </p>
      {budget.applies && override === null && <p className="text-[12px] leading-snug text-text3">{breakdown(budget)}</p>}
      {budget.applies && (
        <p className="text-[11.5px] leading-snug text-text3">
          S/U covers Level 1000 modules, and Level 2000 modules with no NUS prerequisites, unless your faculty says
          otherwise. You choose which modules after results are released, and it can&apos;t be undone.
        </p>
      )}

      {adjusting && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-text1">Studied at a university before?</span>
            <select
              value={priorUniversity}
              onChange={(e) => onPriorUniversity(e.target.value as PriorUniversity)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
            >
              <option value="none">No</option>
              <option value="credits">Yes, and credits were recognised toward my NUS degree</option>
              <option value="degree">I already hold a degree</option>
            </select>
          </label>

          {budget.apcOptionEligible && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={takesApcOption}
                onChange={(e) => onTakesApcOption(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span className="text-[12.5px] leading-snug text-text1">
                I&apos;m giving up my 20 elective APC units for {APC_OPTION_EXTRA_UNITS} extra S/U MC
                <span className="block text-[11.5px] text-text3">
                  Offered to students with {apcUnits} APCs in all (20 to 39), once, around mid Semester 2 of Year 1. Leave
                  this off if you haven&apos;t decided.
                </span>
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-text1">Set the total yourself</span>
            <select
              value={override ?? ""}
              onChange={(e) => onOverride(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
            >
              <option value="">Automatic ({budget.total} MC)</option>
              {MANUAL_OPTIONS.map((mc) => (
                <option key={mc} value={mc}>
                  {mc} MC
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-text3">Only if NUS has told you a different number.</span>
          </label>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ANYTIME_UNITS, suFits, suUsage } from "@/lib/su-budget";

export type SuDialogEntry = {
  id: string;
  moduleCode: string;
  label: string;
  mc: number;
  academicYear: number;
  semester: number;
};

// Shown when marking a module S/U (or moving one) would go over the S/U budget. Lists every module that would
// be on S/U, with the one being changed ticked along with the rest, so it starts over budget and "Done" stays
// greyed out until enough are unticked to fit. The student decides what to give up instead of being refused.
export function SuBudgetDialog({
  action,
  entries,
  highlightId,
  highlightTag,
  totalMc,
  windowYears,
  saving,
  onCancel,
  onDone,
}: {
  /** What was being attempted, e.g. "Using S/U on CS1010S". */
  action: string;
  entries: SuDialogEntry[];
  /** The entry being changed, marked so it's easy to spot among the others. */
  highlightId: string;
  highlightTag: string;
  totalMc: number;
  windowYears: number;
  saving: boolean;
  onCancel: () => void;
  /** The ids still ticked. */
  onDone: (selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));
  const panelRef = useRef<HTMLDivElement>(null);

  const sorted = [...entries].sort(
    (a, b) =>
      a.academicYear - b.academicYear ||
      a.semester - b.semester ||
      a.moduleCode.localeCompare(b.moduleCode)
  );
  const usage = suUsage(
    entries.filter((e) => selected.has(e.id)),
    windowYears
  );
  const fits = suFits(usage, totalMc);
  const anytime = Math.min(ANYTIME_UNITS, totalMc);
  const overTotal = usage.usedMc - totalMc;
  const overLater = usage.laterMc > anytime;

  // Which limit tripped, fixed at the moment the dialog opens (the live counter above covers what changes as
  // modules are unticked). Going past the total is the usual case; the other is S/U in later years, which only
  // the any-time units can cover.
  const [startedOverTotal] = useState(() => suUsage(entries, windowYears).usedMc > totalMc);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="su-dialog-title"
        aria-describedby="su-dialog-desc"
        className="flex max-h-[85vh] w-full max-w-md animate-fade-slide-in flex-col rounded-2xl border border-border bg-surface text-text0 shadow-xl outline-none"
      >
        <div className="px-5 pb-3 pt-5">
          <h2 id="su-dialog-title" className="text-[15px] font-bold tracking-tight">
            You&rsquo;re over your S/U budget
          </h2>
          <p id="su-dialog-desc" className="mt-1 text-[12.5px] leading-snug text-text2">
            {action}{" "}
            {startedOverTotal
              ? `goes over your ${totalMc} MC.`
              : `uses more than the ${anytime} MC of S/U you can have after year ${windowYears}.`}{" "}
            Untick the modules you want to give up S/U on until you&rsquo;re back within budget.
          </p>
        </div>

        <div className="mx-5 mb-2 rounded-lg bg-seg-bg px-3 py-2">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-text1">Selected for S/U</span>
            <span
              className={`font-semibold tabular-nums ${fits ? "text-green" : "text-red"}`}
              aria-live="polite"
            >
              {usage.usedMc} / {totalMc} MC
            </span>
          </div>
          {overTotal > 0 ? (
            <div className="mt-0.5 text-[11.5px] text-red">{overTotal} MC over - untick at least that much.</div>
          ) : null}
          {overLater ? (
            <div className="mt-0.5 text-[11.5px] text-red">
              After year {windowYears} only {anytime} MC can be S/U ({usage.laterMc} MC selected there).
            </div>
          ) : null}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {sorted.map((e) => {
            const checked = selected.has(e.id);
            return (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-100 hover:bg-seg-bg">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(e.id)}
                    disabled={saving}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--surface)] ${
                      checked ? "border-accent bg-accent text-white" : "border-border-strong bg-surface"
                    }`}
                  >
                    {checked ? (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.5 6.5l2.5 2.5 4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold">{e.moduleCode}</span>
                      {e.id === highlightId ? (
                        <span className="rounded-full border border-accent px-1.5 text-[10px] font-semibold text-accent">
                          {highlightTag}
                        </span>
                      ) : null}
                    </span>
                    {e.label && e.label !== e.moduleCode ? (
                      <span className="block truncate text-[11.5px] text-text3">{e.label}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right text-[11.5px] tabular-nums text-text2">
                    <span className="block">{e.mc} MC</span>
                    <span className="block text-text3">
                      Y{e.academicYear} · S{e.semester}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDone([...selected])}
            disabled={!fits || saving}
            title={fits ? undefined : "Untick modules until you're within your S/U budget"}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
              fits && !saving
                ? "bg-accent text-white hover:opacity-90"
                : "cursor-not-allowed bg-seg-bg text-text3"
            }`}
          >
            {saving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

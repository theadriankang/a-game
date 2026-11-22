import Link from "next/link";
import type { MinorFit } from "@/lib/minors/fit";

function Bar({ completed, planned, required }: { completed: number; planned: number; required: number }) {
  const completedPct = required > 0 ? Math.min(100, (completed / required) * 100) : 0;
  const plannedPct = required > 0 ? Math.min(100 - completedPct, (planned / required) * 100) : 0;
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-seg-bg">
      <div className="flex h-full">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${completedPct}%` }} />
        <div className="h-full bg-accent/40 transition-all duration-300" style={{ width: `${plannedPct}%` }} />
      </div>
    </div>
  );
}

export function MinorsPanel({ fits }: { fits: MinorFit[] }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-text1">Minor fit</h1>
          <p className="mt-0.5 max-w-xl text-[13px] text-text3">
            How close your planned and completed modules already get you to
            each modeled minor. A module that counts toward your degree can
            count toward a minor too - shown here automatically, no extra
            tagging needed.
          </p>
        </div>
        <Link
          href="/planner"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
        >
          Back to planner
        </Link>
      </header>

      <main className="animate-fade-in grid gap-4 p-6 md:grid-cols-2">
        {fits.map((fit) => {
          const done = fit.totalCompletedMc;
          const planned = fit.totalPlannedMc;
          const required = fit.totalRequiredMc;
          return (
            <div
              key={fit.minor.id}
              className="animate-fade-slide-in rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold text-text1">{fit.minor.label}</div>
                  <div className="text-[12px] text-text3">{fit.minor.department}</div>
                </div>
                <div className="shrink-0 text-right text-[12px] text-text3">
                  {done + planned}/{required} MC
                </div>
              </div>

              {!fit.eligible ? (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
                  Not open to {fit.excludedBy} students.
                </div>
              ) : null}

              <Bar completed={done} planned={planned} required={required} />

              <div className="mt-3 flex flex-col gap-2">
                {fit.groups.map((g) => {
                  const total = g.completedMc + g.plannedMc;
                  const met = total >= g.requiredMc;
                  return (
                    <div key={g.groupId} className="text-[12px]">
                      <div className="flex items-baseline justify-between">
                        <span className={met ? "text-text1" : "text-text2"}>{g.label}</span>
                        <span className={met ? "font-semibold text-accent" : "text-text3"}>
                          {total}/{g.requiredMc} MC
                        </span>
                      </div>
                      {g.matchedCodes.length > 0 ? (
                        <div className="mt-0.5 text-[11px] text-text3">
                          {g.matchedCodes.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-border pt-2">
                <a
                  href={fit.minor.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-text3 hover:text-accent hover:underline"
                >
                  Source (checked {fit.minor.sourceCheckedDate})
                </a>
                {fit.minor.caveats && fit.minor.caveats.length > 0 ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-amber-700">
                      {fit.minor.caveats.length} thing{fit.minor.caveats.length > 1 ? "s" : ""} to double-check
                    </summary>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-text3">
                      {fit.minor.caveats.map((c) => (
                        <li key={c} className="mt-0.5">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

"use client";

type FeatureRow = { feature: string; label: string; reach: number; intensity: number };
type Cohort = { label: string; cohortSize: number; retainedPct: number | null };

type Props = {
  featureRows: FeatureRow[];
  cohorts: Cohort[];
};

export function EngagementPanel({ featureRows, cohorts }: Props) {
  const maxReach = Math.max(1, ...featureRows.map((r) => r.reach));
  const maxIntensity = Math.max(1, ...featureRows.map((r) => r.intensity));

  return (
    <div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="text-[13px] font-semibold text-text1">Feature usage — last 30 days</div>
        <div className="mb-4 text-[11px] text-text3">
          Reach = distinct users who touched it at least once. Intensity = total times it was touched —
          reported separately so one heavy user doesn&rsquo;t read as broad popularity.
        </div>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text3">
              <th className="py-2 font-semibold">Feature</th>
              <th className="py-2 font-semibold">Reach</th>
              <th className="py-2 font-semibold">Intensity</th>
            </tr>
          </thead>
          <tbody>
            {featureRows.map((r) => (
              <tr key={r.feature} className="border-b border-border last:border-0">
                <td className="py-2.5 font-medium text-text0">{r.label}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-seg-bg">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(r.reach / maxReach) * 100}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-text2">{r.reach}</span>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-seg-bg">
                      <div
                        className="h-full rounded-full bg-text3"
                        style={{ width: `${(r.intensity / maxIntensity) * 100}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-text2">{r.intensity}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="text-[13px] font-semibold text-text1">Retention — signup cohorts</div>
        <div className="mb-4 text-[11px] text-text3">
          Of everyone who signed up in that week, the share with any tracked activity in the last 7 days.
          A lightweight first cut — a full week-by-week cohort matrix is a natural next step if this is worth
          watching closely.
        </div>
        <div className="flex items-end gap-3">
          {cohorts.map((c) => (
            <div key={c.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-28 w-full items-end rounded-md bg-seg-bg">
                <div
                  className="w-full rounded-md bg-accent"
                  style={{ height: c.retainedPct === null ? 0 : `${c.retainedPct * 100}%` }}
                />
              </div>
              <div className="text-[11px] font-semibold text-text1">
                {c.retainedPct === null ? "—" : `${Math.round(c.retainedPct * 100)}%`}
              </div>
              <div className="text-[10.5px] text-text3">{c.label}</div>
              <div className="text-[10px] text-text3">n={c.cohortSize}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

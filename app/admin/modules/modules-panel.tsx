"use client";

type Row = { moduleCode: string; title: string | null; count: number };
type GapRow = { moduleCode: string; title: string | null; researched: number; planned: number };

type Props = {
  mostPlanned: Row[];
  mostResearched: Row[];
  gap: GapRow[];
};

function Leaderboard({ title, caption, rows, unit }: { title: string; caption: string; rows: Row[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-[13px] font-semibold text-text1">{title}</div>
      <div className="mb-3 text-[11px] text-text3">{caption}</div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.moduleCode} className="flex items-center gap-2 text-[13px]">
            <span className="w-5 shrink-0 text-right text-text3">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium text-text0">
                  {r.moduleCode}
                  {r.title && <span className="font-normal text-text2"> · {r.title}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-text2">
                  {r.count} {unit}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-seg-bg">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-[13px] text-text3">No data yet.</div>}
      </div>
    </div>
  );
}

export function ModulesPanel({ mostPlanned, mostResearched, gap }: Props) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Leaderboard
          title="Most planned"
          caption="Distinct users with this module somewhere in their plan"
          rows={mostPlanned}
          unit="users"
        />
        <Leaderboard
          title="Most researched"
          caption="Distinct users who requested an on-demand community-signal report"
          rows={mostResearched}
          unit="users"
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="text-[13px] font-semibold text-text1">Researched more than planned</div>
        <div className="mb-3 text-[11px] text-text3">
          Curiosity without commitment — modules people look into but rarely actually add. Could mean the
          report talked them out of it, or that it&rsquo;s a module people are undecided on.
        </div>
        {gap.length === 0 ? (
          <div className="text-[13px] text-text3">No modules currently show this pattern.</div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text3">
                <th className="py-2 font-semibold">Module</th>
                <th className="py-2 font-semibold">Researched by</th>
                <th className="py-2 font-semibold">Planned by</th>
              </tr>
            </thead>
            <tbody>
              {gap.map((r) => (
                <tr key={r.moduleCode} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium text-text0">
                    {r.moduleCode}
                    {r.title && <span className="font-normal text-text2"> · {r.title}</span>}
                  </td>
                  <td className="py-2 tabular-nums text-text2">{r.researched}</td>
                  <td className="py-2 tabular-nums text-text2">{r.planned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

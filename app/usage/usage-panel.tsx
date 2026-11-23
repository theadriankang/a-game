import Link from "next/link";
import { Odometer } from "@/components/odometer";

type Totals = {
  count: number;
  tokens: number;
  costUsd: number;
  autoCount: number;
  onDemandCount: number;
  byStatus: Record<string, number>;
};

type RecentRequest = {
  id: string;
  moduleCode: string;
  trigger: string;
  status: string;
  tokensUsed: number | null;
  costUsd: number | null;
  createdAt: string;
};

function formatUsd(value: number): string {
  return value < 0.01 && value > 0
    ? `<${"$"}0.01`
    : `${"$"}${value.toFixed(2)}`;
}

function StatPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[12px] text-text3">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-text1">{children}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-green-50 text-green-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  THIN_DATA: "bg-slate-100 text-slate-600",
};

export function UsagePanel({
  totals,
  recent,
}: {
  totals: Totals;
  recent: RecentRequest[];
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-text1">Usage &amp; cost</h1>
          <p className="mt-0.5 text-[13px] text-text3">
            What this app itself has spent on module analysis — not your
            Anthropic account&rsquo;s own balance or plan.
          </p>
        </div>
        <Link
          href="/planner"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
        >
          Back to planner
        </Link>
      </header>

      <main className="animate-fade-in p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Odometer gives each tile a rolling-digit animation when
              AutoRefresh (see page.tsx) pulls in a changed value, instead
              of the number just jump-cutting to the new figure. */}
          <StatPill label="Analysis requests logged">
            <Odometer value={totals.count} />
          </StatPill>
          <StatPill label="Tokens used">
            <Odometer value={totals.tokens} />
          </StatPill>
          <StatPill label="Estimated cost">
            <Odometer value={totals.costUsd} variant="usd" />
          </StatPill>
          <StatPill label="Auto vs on-demand">
            <Odometer value={totals.autoCount} /> <span className="text-text3">/</span>{" "}
            <Odometer value={totals.onDemandCount} />
          </StatPill>
        </div>

        <div className="mt-8">
          <h2 className="text-[14px] font-semibold text-text1">Recent requests</h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-[13px] text-text3">
              No module analysis has been requested yet.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-seg-bg text-text3">
                  <tr>
                    <th className="px-4 py-2 font-medium">Module</th>
                    <th className="px-4 py-2 font-medium">Trigger</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Tokens</th>
                    <th className="px-4 py-2 font-medium">Cost</th>
                    <th className="px-4 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 font-semibold text-text1">
                        {r.moduleCode}
                      </td>
                      <td className="px-4 py-2 text-text2">
                        {r.trigger === "ON_DEMAND" ? "On-demand" : "Auto"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_STYLES[r.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-text2">
                        {r.tokensUsed?.toLocaleString() ?? "-"}
                      </td>
                      <td className="px-4 py-2 text-text2">
                        {r.costUsd != null ? formatUsd(r.costUsd) : "-"}
                      </td>
                      <td className="px-4 py-2 text-text3">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

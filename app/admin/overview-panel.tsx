"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Odometer } from "@/components/odometer";
import { StatPill } from "@/components/stat-pill";
import { AutoRefresh } from "@/components/auto-refresh";

type DailyPoint = { date: string; dau: number };
type CumulativePoint = { date: string; total: number };
type Breakdown = { label: string; count: number };
type ModuleRow = { code: string; title: string | null; count: number };
type FeatureRow = { feature: string; label: string; reach: number };
type ScatterPoint = { x: number; y: number };
type AdoptionRow = { label: string; count: number; pct: number };
type CrosstabRow = Record<string, number | string>;

type Props = {
  totalUsers: number;
  newSignups7d: number;
  newSignupsPrior7d: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  dailySeries: DailyPoint[];
  cumulativeSeries: CumulativePoint[];
  programmeBreakdown: Breakdown[];
  topModules: ModuleRow[];
  featureReach: FeatureRow[];
  depthDistribution: Breakdown[];
  scatterData: ScatterPoint[];
  adoption: AdoptionRow[];
  recencyDistribution: Breakdown[];
  analysisStatusBreakdown: Breakdown[];
  featureProgrammeCrosstab: CrosstabRow[];
  crosstabProgrammes: string[];
};

const DONUT_COLORS = [
  "var(--accent)",
  "var(--green)",
  "var(--amber)",
  "var(--red)",
  "#8b5cf6",
  "var(--text3)",
];

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function InsightCard({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="text-[18px] leading-none">{icon}</div>
      <div className="text-[13px] leading-snug text-text1">{children}</div>
    </div>
  );
}

export function OverviewPanel({
  totalUsers,
  newSignups7d,
  newSignupsPrior7d,
  dau,
  wau,
  mau,
  stickiness,
  dailySeries,
  cumulativeSeries,
  programmeBreakdown,
  topModules,
  featureReach,
  depthDistribution,
  scatterData,
  adoption,
  recencyDistribution,
  analysisStatusBreakdown,
  featureProgrammeCrosstab,
  crosstabProgrammes,
}: Props) {
  const dauChartData = dailySeries.map((p) => ({ ...p, label: formatDay(p.date) }));
  const growthChartData = cumulativeSeries.map((p) => ({ ...p, label: formatDay(p.date) }));

  const signupDelta = newSignups7d - newSignupsPrior7d;
  const signupTrend =
    newSignupsPrior7d === 0
      ? null
      : Math.round((signupDelta / Math.max(1, newSignupsPrior7d)) * 100);

  const topProgramme = programmeBreakdown[0];
  const topProgrammePct = topProgramme && totalUsers > 0 ? Math.round((topProgramme.count / totalUsers) * 100) : null;

  const topModule = topModules[0];
  const topFeature = featureReach[0];

  const donutData = programmeBreakdown.slice(0, 5);
  const donutOther = programmeBreakdown.slice(5).reduce((sum, p) => sum + p.count, 0);
  const donutChartData = donutOther > 0 ? [...donutData, { label: "Other", count: donutOther }] : donutData;

  const maxModuleCount = Math.max(1, ...topModules.map((m) => m.count));
  const maxFeatureReach = Math.max(1, ...featureReach.map((f) => f.reach));

  return (
    <div>
      <AutoRefresh intervalMs={10000} />

      <div className="mb-5 flex items-center justify-between">
        <div className="text-[13px] text-text3">
          Live — updates automatically as new activity comes in.
        </div>
        <Link href="/admin/users" className="text-[12px] font-semibold text-accent hover:underline">
          View raw data &amp; tables →
        </Link>
      </div>

      {/* Insight callouts — the "what does this mean to me" layer, not just numbers. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard icon="👥">
          <span className="font-semibold text-text0">{totalUsers} users</span> total
          {signupTrend !== null ? (
            <>
              {" "}
              — signups {signupTrend >= 0 ? "up" : "down"}{" "}
              <span className={signupTrend >= 0 ? "text-green" : "text-red"}>
                {Math.abs(signupTrend)}%
              </span>{" "}
              vs. the previous 7 days
            </>
          ) : (
            <> — {newSignups7d} new in the last 7 days</>
          )}
        </InsightCard>
        <InsightCard icon="🔁">
          <span className="font-semibold text-text0">{Math.round(stickiness * 100)}% stickiness</span>{" "}
          — {dau} of {mau} monthly actives came back today
        </InsightCard>
        {topProgramme && (
          <InsightCard icon="🎓">
            <span className="font-semibold text-text0">{topProgramme.label}</span> is the most common
            programme{topProgrammePct !== null && <> — {topProgrammePct}% of users</>}
          </InsightCard>
        )}
        {topModule && (
          <InsightCard icon="🔥">
            <span className="font-semibold text-text0">{topModule.code}</span> is the most-planned module —{" "}
            {topModule.count} {topModule.count === 1 ? "student has" : "students have"} it in their plan
          </InsightCard>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="mb-1 text-[13px] font-semibold text-text1">Daily active users</div>
          <div className="mb-4 text-[11px] text-text3">Last 30 days</div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dauChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--text3)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  interval={Math.ceil(dauChartData.length / 8)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--text1)" }}
                />
                <Area type="monotone" dataKey="dau" name="DAU" stroke="var(--accent)" strokeWidth={2} fill="url(#dauFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Users by programme</div>
          <div className="mb-2 text-[11px] text-text3">Who&rsquo;s actually using this</div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutChartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {donutChartData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {donutChartData.map((d, i) => (
              <div key={d.label} className="flex items-center gap-2 text-[11.5px] text-text1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="truncate">{d.label}</span>
                <span className="ml-auto tabular-nums text-text3">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Growth</div>
          <div className="mb-4 text-[11px] text-text3">Cumulative signups, last 30 days</div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--text3)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  interval={Math.ceil(growthChartData.length / 6)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--text1)" }}
                />
                <Area type="monotone" dataKey="total" name="Total users" stroke="var(--green)" strokeWidth={2} fill="url(#growthFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Top modules</div>
          <div className="mb-3 text-[11px] text-text3">By how many people planned it</div>
          <div className="flex flex-col gap-2">
            {topModules.map((m) => (
              <div key={m.code} className="text-[12.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-text0">{m.code}</span>
                  <span className="shrink-0 tabular-nums text-text3">{m.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-seg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(m.count / maxModuleCount) * 100}%` }} />
                </div>
              </div>
            ))}
            {topModules.length === 0 && <div className="text-[12.5px] text-text3">No modules planned yet.</div>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Feature reach</div>
          <div className="mb-3 text-[11px] text-text3">
            Distinct users in the last 30 days{topFeature && <> — led by {topFeature.label}</>}
          </div>
          <div className="flex flex-col gap-2">
            {featureReach.map((f) => (
              <div key={f.feature} className="text-[12.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-text0">{f.label}</span>
                  <span className="shrink-0 tabular-nums text-text3">{f.reach}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-seg-bg">
                  <div className="h-full rounded-full bg-text3" style={{ width: `${(f.reach / maxFeatureReach) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
        {/* Compact numeric fallback for small screens where the charts above stack tightly. */}
        <StatPill label="DAU"><Odometer value={dau} /></StatPill>
        <StatPill label="WAU"><Odometer value={wau} /></StatPill>
        <StatPill label="MAU"><Odometer value={mau} /></StatPill>
        <StatPill label="Total"><Odometer value={totalUsers} /></StatPill>
      </div>

      <div className="mt-10 mb-4 border-t border-border pt-6">
        <div className="text-[15px] font-bold tracking-tight text-text0">Deeper exploration</div>
        <div className="text-[12px] text-text3">
          Past &ldquo;what are the numbers&rdquo; into &ldquo;what should change&rdquo; — adoption vs. page
          views, who&rsquo;s going quiet, and how usage relates across features.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Real adoption, not just page views</div>
          <div className="mb-3 text-[11px] text-text3">
            Share of all {totalUsers} users who have actually done this at least once — vs. just
            visited the page. Module browser and Minors have no action beyond viewing, so they&rsquo;re
            left out here rather than shown with a misleadingly-high number.
          </div>
          <div className="flex flex-col gap-2.5">
            {adoption.map((a) => (
              <div key={a.label} className="text-[12.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-text0">{a.label}</span>
                  <span className="shrink-0 tabular-nums text-text2">
                    {a.count} · {a.pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-seg-bg">
                  <div className="h-full rounded-full bg-green" style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">On-demand research quality</div>
          <div className="mb-2 text-[11px] text-text3">
            Every analysis request ever made, by outcome — a growing &ldquo;failed&rdquo; or
            &ldquo;thin data&rdquo; share means the feature needs attention, not just more usage.
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysisStatusBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                >
                  {analysisStatusBreakdown.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {analysisStatusBreakdown.map((d, i) => (
              <div key={d.label} className="flex items-center gap-1.5 text-[11.5px] text-text1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                {d.label} <span className="tabular-nums text-text3">({d.count})</span>
              </div>
            ))}
            {analysisStatusBreakdown.length === 0 && <div className="text-[11.5px] text-text3">No requests yet.</div>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Engagement depth</div>
          <div className="mb-3 text-[11px] text-text3">
            Modules planned per user, all-time — a pile-up at &ldquo;0&rdquo; means lots of signups
            never really engage with the core feature.
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depthDistribution} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "var(--seg-bg)" }}
                />
                <Bar dataKey="count" name="Users" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Recency — churn risk</div>
          <div className="mb-3 text-[11px] text-text3">
            Days since each user was last seen doing anything tracked. A growing &ldquo;30d+&rdquo; or
            &ldquo;Never&rdquo; bar is the clearest early warning this product gives.
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recencyDistribution} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "var(--seg-bg)" }}
                />
                <Bar dataKey="count" name="Users" fill="var(--amber)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Planning vs. researching</div>
          <div className="mb-3 text-[11px] text-text3">
            Each dot is one user: modules planned (x) against on-demand analysis requests (y). Clustered
            near the x-axis means planning and researching are mostly separate behaviors; a rising diagonal
            means heavy planners are also the ones who dig into research.
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Modules planned"
                  tick={{ fontSize: 11, fill: "var(--text3)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Analyses requested"
                  tick={{ fontSize: 11, fill: "var(--text3)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Scatter data={scatterData} fill="var(--accent)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {scatterData.length === 0 && (
            <div className="mt-2 text-[11.5px] text-text3">
              No users with planning or research activity yet — this fills in as usage grows.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-1 text-[13px] font-semibold text-text1">Feature usage by programme</div>
          <div className="mb-3 text-[11px] text-text3">
            Last 30 days, split by the user&rsquo;s programme (top 3 + Other) — shows whether a
            feature is broadly used or really a one-programme niche.
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureProgrammeCrosstab} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10.5, fill: "var(--text1)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "var(--seg-bg)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {crosstabProgrammes.map((p, i) => (
                  <Bar key={p} dataKey={p} stackId="a" name={p} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

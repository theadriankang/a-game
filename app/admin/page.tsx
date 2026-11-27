import { prisma } from "@/lib/prisma";
import { FEATURES } from "@/lib/track";
import { OverviewPanel } from "./overview-panel";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const FEATURE_LABEL: Record<string, string> = {
  planner: "Planner",
  simulator: "What-if simulator",
  timetable: "Timetable",
  modules: "Module browser",
  minors: "Minors & second majors",
  analysis_request: "On-demand analysis",
};

export default async function AdminOverviewPage() {
  const today = startOfUTCDay(new Date());
  const sevenDaysAgo = new Date(today.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(today.getTime() - 14 * DAY_MS);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * DAY_MS);

  // Run in small sequential batches rather than one big Promise.all — the
  // DB here is Prisma's hosted Postgres (db.prisma.io), whose connection
  // pool is small enough that ~19 queries fired at once (this page's
  // original count) intermittently exhausted it ("Can't reach database
  // server" / "Server has closed the connection"). A handful of queries
  // per batch stays well under that ceiling; the extra round-trips cost a
  // little latency, which is the right trade on an admin-only page nobody
  // is staring at a stopwatch for.
  const [totalUsers, newSignups7d, newSignupsPrior7d, dauToday, wauRows, mauRows] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.dailyActive.count({ where: { date: today } }),
    prisma.dailyActive.groupBy({ by: ["userId"], where: { date: { gte: sevenDaysAgo } } }),
    prisma.dailyActive.groupBy({ by: ["userId"], where: { date: { gte: thirtyDaysAgo } } }),
  ]);

  const [dauSeries, allSignupDates, programmeGroups] = await Promise.all([
    prisma.dailyActive.groupBy({
      by: ["date"],
      where: { date: { gte: thirtyDaysAgo } },
      _count: { userId: true },
      orderBy: { date: "asc" },
    }),
    // Every signup date, oldest first — small table at this project's scale,
    // so a plain in-memory cumulative count is simpler and cheaper than a
    // SQL window function here.
    prisma.user.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.groupBy({ by: ["programme"], _count: { _all: true } }),
  ]);

  const [plannerRows, catalogTitles, reachRows] = await Promise.all([
    // Top planned modules — same distinct-(module,user) approach as
    // /admin/modules, just capped to the top 6 for a chart-sized slice.
    prisma.plannerEntry.findMany({
      where: { moduleCode: { not: null } },
      select: { moduleCode: true, userId: true },
      distinct: ["moduleCode", "userId"],
    }),
    prisma.catalogModule.findMany({ select: { code: true, title: true } }),
    prisma.featureUsage.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { feature: true, userId: true },
      distinct: ["feature", "userId"],
    }),
  ]);

  const wau = wauRows.length;
  const mau = mauRows.length;
  const stickiness = mau > 0 ? dauToday / mau : 0;

  const seriesByDate = new Map(
    dauSeries.map((row) => [row.date.toISOString().slice(0, 10), row._count.userId])
  );
  const dailySeries = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo.getTime() + i * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    return { date: key, dau: seriesByDate.get(key) ?? 0 };
  });

  // Cumulative signups over the last 30 days — "how fast is this growing",
  // distinct from "how many were active today" above.
  const cumulativeSeries = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo.getTime() + i * DAY_MS);
    const cutoff = new Date(date.getTime() + DAY_MS); // end of that day
    const count = allSignupDates.filter((u) => u.createdAt < cutoff).length;
    return { date: date.toISOString().slice(0, 10), total: count };
  });

  const programmeBreakdown = programmeGroups
    .map((g) => ({ label: g.programme ?? "Not set", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const titleByCode = new Map(catalogTitles.map((c) => [c.code, c.title]));
  const plannedCounts = new Map<string, number>();
  for (const r of plannerRows) {
    if (!r.moduleCode) continue;
    plannedCounts.set(r.moduleCode, (plannedCounts.get(r.moduleCode) ?? 0) + 1);
  }
  const topModules = Array.from(plannedCounts.entries())
    .map(([code, count]) => ({ code, title: titleByCode.get(code) ?? null, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reachByFeature = new Map<string, number>();
  for (const row of reachRows) {
    reachByFeature.set(row.feature, (reachByFeature.get(row.feature) ?? 0) + 1);
  }
  const featureReach = FEATURES.map((f) => ({
    feature: f,
    label: FEATURE_LABEL[f] ?? f,
    reach: reachByFeature.get(f) ?? 0,
  })).sort((a, b) => b.reach - a.reach);

  // --- Deeper EDA below — everything above this line is unchanged. ---

  const [plannerCountRows, onDemandCountRows, savedTimetableRows, telegramLinkCount] = await Promise.all([
    prisma.plannerEntry.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.analysisRequest.groupBy({
      by: ["userId"],
      where: { trigger: "ON_DEMAND" },
      _count: { _all: true },
    }),
    prisma.savedTimetable.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.telegramLink.count(),
  ]);

  const [lastActiveRows, analysisStatusGroups, allUsersForCrosstab] = await Promise.all([
    prisma.dailyActive.groupBy({ by: ["userId"], _max: { date: true } }),
    prisma.analysisRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.findMany({ select: { id: true, programme: true } }),
  ]);

  const allUserIds = allUsersForCrosstab.map((u) => u.id);
  const plannerCountByUser = new Map(plannerCountRows.map((r) => [r.userId, r._count._all]));
  const onDemandCountByUser = new Map(
    onDemandCountRows.filter((r) => r.userId).map((r) => [r.userId as string, r._count._all])
  );

  // Engagement depth: how many modules has each user actually planned —
  // a feature can have wide reach (lots of page views) but shallow use.
  const DEPTH_BUCKETS: { label: string; test: (n: number) => boolean }[] = [
    { label: "0", test: (n) => n === 0 },
    { label: "1–5", test: (n) => n >= 1 && n <= 5 },
    { label: "6–10", test: (n) => n >= 6 && n <= 10 },
    { label: "11–20", test: (n) => n >= 11 && n <= 20 },
    { label: "21+", test: (n) => n >= 21 },
  ];
  const depthDistribution = DEPTH_BUCKETS.map((b) => ({
    label: b.label,
    count: allUserIds.filter((id) => b.test(plannerCountByUser.get(id) ?? 0)).length,
  }));

  // Relationship between two variables per user: do people who plan more
  // modules also research more of them, or are planning and researching
  // done by different kinds of users?
  const scatterData = allUserIds
    .map((id) => ({ x: plannerCountByUser.get(id) ?? 0, y: onDemandCountByUser.get(id) ?? 0 }))
    .filter((p) => p.x > 0 || p.y > 0);

  // All-time real-action adoption — distinct from the 30-day page-view
  // "reach" chart above. A feature can be visited often but rarely acted
  // on; only the features with a real action table are shown here
  // (modules/minors have no action beyond viewing, so they're left out
  // rather than shown with a misleading 100%-of-views number).
  const plannerUserCount = plannerCountRows.length;
  const savedTimetableUserCount = new Set(savedTimetableRows.map((r) => r.userId)).size;
  const onDemandUserCount = onDemandCountRows.filter((r) => r.userId).length;
  const adoption = [
    { label: "Planner — added a module", count: plannerUserCount },
    { label: "Timetable — saved a link", count: savedTimetableUserCount },
    { label: "On-demand analysis — requested", count: onDemandUserCount },
    { label: "Telegram — linked account", count: telegramLinkCount },
  ].map((a) => ({ ...a, pct: totalUsers > 0 ? Math.round((a.count / totalUsers) * 100) : 0 }));

  // Recency / churn risk: how long since each user was last seen at all,
  // not just whether they ever signed up.
  const lastActiveByUser = new Map(lastActiveRows.map((r) => [r.userId, r._max.date]));
  function daysSince(d: Date | null | undefined): number | null {
    if (!d) return null;
    return Math.floor((today.getTime() - startOfUTCDay(d).getTime()) / DAY_MS);
  }
  const RECENCY_BUCKETS: { label: string; test: (n: number | null) => boolean }[] = [
    { label: "Today", test: (n) => n === 0 },
    { label: "1–2d", test: (n) => n !== null && n >= 1 && n <= 2 },
    { label: "3–7d", test: (n) => n !== null && n >= 3 && n <= 7 },
    { label: "8–14d", test: (n) => n !== null && n >= 8 && n <= 14 },
    { label: "15–30d", test: (n) => n !== null && n >= 15 && n <= 30 },
    { label: "30d+", test: (n) => n !== null && n > 30 },
    { label: "Never", test: (n) => n === null },
  ];
  const recencyDistribution = RECENCY_BUCKETS.map((b) => ({
    label: b.label,
    count: allUserIds.filter((id) => b.test(daysSince(lastActiveByUser.get(id)))).length,
  }));

  // Research quality — across every analysis request, not just on-demand
  // ones, since AUTO_* failures/thin-data are just as much a signal that
  // the feature needs attention.
  const STATUS_LABEL: Record<string, string> = {
    COMPLETED: "Completed",
    FAILED: "Failed",
    THIN_DATA: "Thin data",
    PENDING: "Pending",
  };
  const analysisStatusBreakdown = analysisStatusGroups.map((g) => ({
    label: STATUS_LABEL[g.status] ?? g.status,
    count: g._count._all,
  }));

  // Feature usage by programme: does one programme lean on a feature more
  // than others (e.g. do CS students use Minors more)? Built from the same
  // 30-day reach pairs as the Feature reach chart above, just pivoted by
  // programme instead of summed across everyone.
  const programmeByUser = new Map(allUsersForCrosstab.map((u) => [u.id, u.programme ?? "Not set"]));
  const topProgrammeLabels = programmeBreakdown.slice(0, 3).map((p) => p.label);
  function programmeBucket(p: string): string {
    return topProgrammeLabels.includes(p) ? p : "Other";
  }
  const crosstabProgrammes = Array.from(new Set([...topProgrammeLabels, "Other"]));
  const crosstabCounts = new Map<string, Record<string, number>>();
  for (const row of reachRows) {
    const prog = programmeBucket(programmeByUser.get(row.userId) ?? "Not set");
    const entry = crosstabCounts.get(row.feature) ?? {};
    entry[prog] = (entry[prog] ?? 0) + 1;
    crosstabCounts.set(row.feature, entry);
  }
  const featureProgrammeCrosstab = FEATURES.map((f) => {
    const entry = crosstabCounts.get(f) ?? {};
    const row: Record<string, number | string> = { label: FEATURE_LABEL[f] ?? f };
    for (const p of crosstabProgrammes) row[p] = entry[p] ?? 0;
    return row;
  });

  return (
    <OverviewPanel
      totalUsers={totalUsers}
      newSignups7d={newSignups7d}
      newSignupsPrior7d={newSignupsPrior7d}
      dau={dauToday}
      wau={wau}
      mau={mau}
      stickiness={stickiness}
      dailySeries={dailySeries}
      cumulativeSeries={cumulativeSeries}
      programmeBreakdown={programmeBreakdown}
      topModules={topModules}
      featureReach={featureReach}
      depthDistribution={depthDistribution}
      scatterData={scatterData}
      adoption={adoption}
      recencyDistribution={recencyDistribution}
      analysisStatusBreakdown={analysisStatusBreakdown}
      featureProgrammeCrosstab={featureProgrammeCrosstab}
      crosstabProgrammes={crosstabProgrammes}
    />
  );
}

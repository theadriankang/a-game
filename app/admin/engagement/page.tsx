import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/auto-refresh";
import { AdminSubnav } from "@/components/admin-subnav";
import { FEATURES } from "@/lib/track";
import { EngagementPanel } from "./engagement-panel";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

export default async function AdminEngagementPage() {
  const today = startOfUTCDay(new Date());
  const thirtyDaysAgo = new Date(today.getTime() - 30 * DAY_MS);
  const sevenDaysAgo = new Date(today.getTime() - 7 * DAY_MS);

  const [intensityRows, reachRows, usersWithSignup, activeLastWeek] = await Promise.all([
    prisma.featureUsage.groupBy({
      by: ["feature"],
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { count: true },
    }),
    prisma.featureUsage.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { feature: true, userId: true },
      distinct: ["feature", "userId"],
    }),
    prisma.user.findMany({ select: { id: true, createdAt: true } }),
    prisma.dailyActive.findMany({
      where: { date: { gte: sevenDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const intensityByFeature = new Map(intensityRows.map((r) => [r.feature, r._sum.count ?? 0]));
  const reachByFeature = new Map<string, number>();
  for (const row of reachRows) {
    reachByFeature.set(row.feature, (reachByFeature.get(row.feature) ?? 0) + 1);
  }

  const featureRows = FEATURES.map((feature) => ({
    feature,
    label: FEATURE_LABEL[feature] ?? feature,
    reach: reachByFeature.get(feature) ?? 0,
    intensity: intensityByFeature.get(feature) ?? 0,
  })).sort((a, b) => b.reach - a.reach);

  // Retention-lite: for each of the last 6 signup weeks, what share of
  // that cohort has any tracked activity in the last 7 days. A full
  // week-by-week cohort matrix is the natural next step if this view
  // turns out to be worth watching closely — this is the cheap first cut.
  const activeUserIds = new Set(activeLastWeek.map((r) => r.userId));
  const cohorts = Array.from({ length: 6 }, (_, i) => {
    const weeksAgo = 5 - i;
    const start = new Date(today.getTime() - (weeksAgo + 1) * WEEK_MS);
    const end = new Date(today.getTime() - weeksAgo * WEEK_MS);
    const members = usersWithSignup.filter((u) => u.createdAt >= start && u.createdAt < end);
    const retained = members.filter((u) => activeUserIds.has(u.id)).length;
    return {
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }),
      cohortSize: members.length,
      retainedPct: members.length > 0 ? retained / members.length : null,
    };
  });

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <AdminSubnav />
      <EngagementPanel featureRows={featureRows} cohorts={cohorts} />
    </>
  );
}

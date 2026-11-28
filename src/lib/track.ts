import { prisma } from "@/lib/prisma";

// Canonical list of tracked feature slugs, so a typo'd string in a call
// site doesn't silently create a new, uncounted feature bucket in
// FeatureUsage. Add to this list (and FeatureUsage's comment stays
// accurate) whenever a new page gets instrumented.
export const FEATURES = [
  "planner",
  "simulator",
  "timetable",
  "modules",
  "minors",
  "residential_colleges",
  "analysis_request",
] as const;

export type Feature = (typeof FEATURES)[number];

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Records that `userId` touched `feature` today. Fire-and-forget by
// convention at call sites (see usage below) — a tracking write failing
// should never break the page it's called from, so every call site wraps
// this in its own try/catch rather than awaiting it inline in a way that
// could throw into the page render.
export async function track(userId: string, feature: Feature): Promise<void> {
  const date = startOfUTCDay(new Date());
  await Promise.all([
    prisma.dailyActive.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
    }),
    prisma.featureUsage.upsert({
      where: { userId_feature_date: { userId, feature, date } },
      create: { userId, feature, date },
      update: { count: { increment: 1 } },
    }),
  ]);
}

// Call from a Server Component page body: never throws into the render,
// since a dashboard-tracking failure shouldn't take down the actual page a
// user is trying to use.
export async function trackSilently(userId: string, feature: Feature): Promise<void> {
  try {
    await track(userId, feature);
  } catch (err) {
    console.error(`[track] failed to record ${feature} for ${userId}`, err);
  }
}

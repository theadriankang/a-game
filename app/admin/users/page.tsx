import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/auto-refresh";
import { AdminSubnav } from "@/components/admin-subnav";
import { UsersPanel } from "./users-panel";

export default async function AdminUsersPage() {
  const [users, programmeGroups, matricGroups, mathGroups, lastActiveRows, entryCountRows] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, programme: true, createdAt: true },
      }),
      prisma.user.groupBy({ by: ["programme"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["matriculationYear"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["mathBackground"], _count: { _all: true } }),
      // "Last active" per user — DailyActive's own max date, not User rows
      // (createdAt is signup, not activity).
      prisma.dailyActive.groupBy({ by: ["userId"], _max: { date: true } }),
      prisma.plannerEntry.groupBy({ by: ["userId"], _count: { _all: true } }),
    ]);

  const lastActiveByUser = new Map(lastActiveRows.map((r) => [r.userId, r._max.date]));
  const entryCountByUser = new Map(entryCountRows.map((r) => [r.userId, r._count._all]));

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    programme: u.programme,
    createdAt: u.createdAt.toISOString(),
    lastActive: lastActiveByUser.get(u.id)?.toISOString() ?? null,
    plannerEntryCount: entryCountByUser.get(u.id) ?? 0,
  }));

  const programmeBreakdown = programmeGroups
    .map((g) => ({ label: g.programme ?? "Not set (onboarding incomplete)", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const matricBreakdown = matricGroups
    .map((g) => ({ label: g.matriculationYear ? `AY${g.matriculationYear}` : "Not set", count: g._count._all }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const mathBackgroundBreakdown = mathGroups
    .map((g) => ({ label: g.mathBackground ?? "Not set", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <AdminSubnav />
      <UsersPanel
        rows={rows}
        programmeBreakdown={programmeBreakdown}
        matricBreakdown={matricBreakdown}
        mathBackgroundBreakdown={mathBackgroundBreakdown}
      />
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/auto-refresh";
import { AdminSubnav } from "@/components/admin-subnav";
import { ModulesPanel } from "./modules-panel";

const TOP_N = 15;

export default async function AdminModulesPage() {
  const [plannerRows, analysisRows] = await Promise.all([
    // Distinct (moduleCode, userId) pairs — counts how many different
    // people have a module in their plan, not how many entries exist (a
    // module could in principle appear more than once for the same user
    // across different semesters, e.g. a retake, and that shouldn't
    // double the "how many people want this" signal).
    prisma.plannerEntry.findMany({
      where: { moduleCode: { not: null } },
      select: { moduleCode: true, userId: true },
      distinct: ["moduleCode", "userId"],
    }),
    // Only ON_DEMAND: this is the user-initiated "I'm curious about this
    // module" click, not the AUTO_* background research the cron queues
    // for compulsory/planned modules (which reflects the plan, not
    // curiosity) — see schema.prisma's AnalysisTrigger.
    prisma.analysisRequest.findMany({
      where: { trigger: "ON_DEMAND" },
      select: { moduleCode: true, userId: true },
      distinct: ["moduleCode", "userId"],
    }),
  ]);

  function countByModule(rows: { moduleCode: string | null; userId: string | null }[]) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.moduleCode) continue;
      counts.set(r.moduleCode, (counts.get(r.moduleCode) ?? 0) + 1);
    }
    return counts;
  }

  const plannedCounts = countByModule(plannerRows);
  const researchedCounts = countByModule(analysisRows);

  const allCodes = Array.from(new Set([...plannedCounts.keys(), ...researchedCounts.keys()]));
  const catalog = await prisma.catalogModule.findMany({
    where: { code: { in: allCodes } },
    select: { code: true, title: true },
  });
  const titleByCode = new Map(catalog.map((c) => [c.code, c.title]));

  function toRows(counts: Map<string, number>) {
    return Array.from(counts.entries())
      .map(([moduleCode, count]) => ({ moduleCode, title: titleByCode.get(moduleCode) ?? null, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N);
  }

  const mostPlanned = toRows(plannedCounts);
  const mostResearched = toRows(researchedCounts);

  // Interest-vs-commitment gap: modules people research more than they
  // actually plan — genuinely different information than either
  // leaderboard alone (a module can be widely discussed/researched while
  // staying unpopular to actually take, or vice versa).
  const gap = allCodes
    .map((code) => ({
      moduleCode: code,
      title: titleByCode.get(code) ?? null,
      researched: researchedCounts.get(code) ?? 0,
      planned: plannedCounts.get(code) ?? 0,
    }))
    .filter((r) => r.researched > 0 && r.researched > r.planned)
    .sort((a, b) => b.researched - a.researched - (b.planned - a.planned))
    .slice(0, 10);

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <AdminSubnav />
      <ModulesPanel mostPlanned={mostPlanned} mostResearched={mostResearched} gap={gap} />
    </>
  );
}

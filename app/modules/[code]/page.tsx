import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getModuleInfo,
  flattenPrereqTree,
  formatPrereqTree,
  NUSMODS_ACAD_YEAR,
} from "@/lib/nusmods";
import { getCachedAnalysis, hasPendingRequest } from "@/lib/module-analysis";
import { ModuleDetailView } from "./module-detail-view";
import { MATH_BRIDGING_CODES, coversMath } from "@/lib/qualifications";

type RouteParams = { params: Promise<{ code: string }> };

// A dedicated "whole module" page - everything we know about one module in
// one place (NUSMods data + the AI community-signal synthesis), reached by
// clicking into a module from the planner card. Kept server-rendered for
// the real NUSMods data (no client-side loading flash on first open); the
// "Request analysis" interaction lives in the client child component.
export default async function ModulePage({ params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { code } = await params;
  const moduleCode = code.toUpperCase();

  let info;
  try {
    info = await getModuleInfo(NUSMODS_ACAD_YEAR, moduleCode);
  } catch {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page text-text0">
        <div className="text-lg font-bold">Couldn&rsquo;t find {moduleCode}</div>
        <p className="text-[13px] text-text2">
          NUSMods doesn&rsquo;t have data for this module in {NUSMODS_ACAD_YEAR}.
        </p>
        <a href="/planner" className="text-[13px] font-semibold text-accent hover:underline">
          Back to planner
        </a>
      </div>
    );
  }

  const [analysis, pending] = await Promise.all([
    getCachedAnalysis(moduleCode),
    getCachedAnalysis(moduleCode).then((a) => (a ? false : hasPendingRequest(moduleCode))),
  ]);

  const prereqCodes = flattenPrereqTree(info.prereqTree);

  // NUSMods' tree keeps only the MA1301 branch of "H2 Math OR MA1301"; tell the student where they stand.
  const mathBackground = (await prisma.user.findUnique({ where: { id: userId }, select: { mathBackground: true } }))
    ?.mathBackground;
  const needsBridging = prereqCodes.some((c) => MATH_BRIDGING_CODES.includes(c.toUpperCase()));
  const prereqNote = !needsBridging
    ? null
    : coversMath(mathBackground)
      ? "Your maths background counts as H2 Math (or equivalent), so you don't need MA1301 first."
      : mathBackground === "NONE"
        ? "You said you have no H2-equivalent maths, so you'll need MA1301 (or MA1301X) first."
        : null;

  // The prereq-path diagram is scoped to the signed-in user's own plan -
  // same reasoning as the planner grid's hover connector lines: showing
  // every module that could ever unlock this one would mean fetching
  // NUSMods data for the entire module catalogue, which isn't feasible on
  // a single page load. Scoped to one person's plan (tens of modules,
  // not thousands), it's cheap and the only "unlocks" that actually
  // matter to them anyway.
  const planEntries = await prisma.plannerEntry.findMany({ where: { userId } });
  const planCodes = new Set(
    planEntries
      .filter((e) => e.moduleCode)
      .map((e) => e.moduleCode!.toUpperCase())
  );

  const inPlanPrereqCodes = prereqCodes.filter((c) => planCodes.has(c));

  const otherPlanCodes = Array.from(planCodes).filter((c) => c !== moduleCode);
  const unlocksChecks = await Promise.all(
    otherPlanCodes.map(async (otherCode) => {
      try {
        const otherInfo = await getModuleInfo(NUSMODS_ACAD_YEAR, otherCode);
        return flattenPrereqTree(otherInfo.prereqTree).includes(moduleCode) ? otherCode : null;
      } catch {
        return null;
      }
    })
  );
  const unlocks = unlocksChecks
    .filter((c): c is string => c !== null)
    .map((unlockCode) => ({
      moduleCode: unlockCode,
      label: planEntries.find((e) => e.moduleCode?.toUpperCase() === unlockCode)?.label ?? unlockCode,
    }));

  return (
    <ModuleDetailView
      moduleCode={info.moduleCode}
      title={info.title}
      mc={Number(info.moduleCredit) || 4}
      department={info.department ?? null}
      faculty={info.faculty ?? null}
      description={info.description ?? null}
      workload={Array.isArray(info.workload) ? info.workload : null}
      semesterData={(info.semesterData ?? []).map((s) => ({
        semester: s.semester,
        examDate: s.examDate ?? null,
        examDuration: s.examDuration ?? null,
      }))}
      prereqCodes={prereqCodes}
      inPlanPrereqCodes={inPlanPrereqCodes}
      unlocks={unlocks}
      prereqSummary={formatPrereqTree(info.prereqTree)}
      prereqNote={prereqNote}
      preclusion={info.preclusion ?? null}
      corequisite={info.corequisite ?? null}
      analysis={
        analysis
          ? {
              summary: analysis.summary,
              tags: analysis.tags,
              sources: analysis.sources,
              status: analysis.status,
            }
          : null
      }
      pending={pending}
    />
  );
}

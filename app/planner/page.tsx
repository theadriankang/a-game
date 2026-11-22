import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bucketPlannerEntries } from "@/lib/degree-requirements/bucket";
import { bcompCs } from "@/lib/degree-requirements/bcomp-cs";
import { getModuleInfo, type ModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { checkPlan } from "@/lib/prereq-check";
import { hasPendingRequest } from "@/lib/module-analysis";
import { PlannerBoard } from "./planner-board";

// The onboarding placeholder slot for exemptions (see app/api/onboarding) —
// kept out of the semester grid and shown separately instead.
const EXEMPTION_YEAR = 0;
const EXEMPTION_SEMESTER = 0;

export default async function PlannerPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  if (!user.programme) {
    redirect("/onboarding");
  }

  const entries = await prisma.plannerEntry.findMany({
    where: { userId },
    orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
  });

  const semesterEntries = entries.filter(
    (e) => !(e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER)
  );
  const exemptionEntries = entries.filter(
    (e) => e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER
  );

  const buckets = bucketPlannerEntries(entries, bcompCs);

  // Best-effort: fetch NUSMods data for every distinct module code in the
  // plan, so prereq/preclusion checking has something to check against. A
  // module that fails to fetch (typo'd code, NUSMods hiccup) is simply
  // skipped — it shows no violation rather than breaking the whole page.
  const distinctCodes = Array.from(
    new Set(entries.map((e) => e.moduleCode).filter((c): c is string => !!c))
  );
  const moduleInfoEntries = await Promise.all(
    distinctCodes.map(async (code) => {
      try {
        const info = await getModuleInfo(NUSMODS_ACAD_YEAR, code);
        return [code, info] as const;
      } catch {
        return [code, undefined] as const;
      }
    })
  );
  const moduleInfoByCode: Record<string, ModuleInfo | undefined> = Object.fromEntries(
    moduleInfoEntries
  );

  const violationsByEntryId = checkPlan(semesterEntries, moduleInfoByCode);

  // Community-signal reports: pull whatever's already cached for the
  // modules in this plan, plus which ones (if any) are still queued, so
  // the board can show a report, a "queued" state, or a request button.
  const analysisRows = await prisma.moduleAnalysis.findMany({
    where: { moduleCode: { in: distinctCodes }, academicYear: NUSMODS_ACAD_YEAR },
  });
  const analysisByCode = Object.fromEntries(analysisRows.map((a) => [a.moduleCode, a]));
  const pendingFlags = await Promise.all(
    distinctCodes
      .filter((code) => !analysisByCode[code])
      .map(async (code) => [code, await hasPendingRequest(code)] as const)
  );
  const pendingCodes = pendingFlags.filter(([, pending]) => pending).map(([code]) => code);

  return (
    <PlannerBoard
      userName={user.name}
      suBudgetTotalMc={user.suBudgetTotalMc}
      suBudgetUsedMc={user.suBudgetUsedMc}
      semesterEntries={semesterEntries}
      exemptionEntries={exemptionEntries}
      buckets={buckets}
      degreeLabel={bcompCs.label}
      degreeTotalMc={bcompCs.totalMc}
      violationsByEntryId={Object.fromEntries(violationsByEntryId)}
      analysisByCode={analysisByCode}
      pendingAnalysisCodes={pendingCodes}
    />
  );
}

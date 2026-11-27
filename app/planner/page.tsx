import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bucketPlannerEntries } from "@/lib/degree-requirements/bucket";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { getModuleInfo, type ModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { checkPlan } from "@/lib/prereq-check";
import { currentTerm, withDerivedStatus } from "@/lib/plan-status";
import { firstYearWindowYears, isSuEligible } from "@/lib/su-budget";
import { hasPendingRequest } from "@/lib/module-analysis";
import { trackSilently } from "@/lib/track";
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

  await trackSilently(userId, "planner");

  const storedEntries = await prisma.plannerEntry.findMany({
    where: { userId },
    orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
  });

  // Done / in progress / planned isn't stored: it follows from which semester a module sits in and today's date
  // (see src/lib/plan-status.ts). Only the Reserved bin is a real, stored state.
  const term = currentTerm(user.matriculationYear);
  const entries = withDerivedStatus(storedEntries, term);

  // The Reserved bin has no semester, so it's told apart by status; the 0/0 slot it's stored in is shared with
  // exemptions.
  const reservedEntries = entries.filter((e) => e.status === "RESERVED");
  const placedEntries = entries.filter((e) => e.status !== "RESERVED");
  const semesterEntries = placedEntries.filter(
    (e) => !(e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER)
  );
  const exemptionEntries = placedEntries.filter(
    (e) => e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER
  );

  const degreeStructure = getDegreeStructureForProgramme(user.programme);
  const buckets = bucketPlannerEntries(entries, degreeStructure);

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

  // placedEntries, not semesterEntries: exempted modules sit outside the grid but still count as taken, so they
  // have to reach the checker or a prerequisite the student is exempt from gets flagged as unmet.
  const violationsByEntryId = checkPlan(placedEntries, moduleInfoByCode, { mathBackground: user.mathBackground });

  // Modules NUS allows the S/U option on. The planner only offers the S/U button for these (a module whose
  // NUSMods data couldn't be fetched is left out, so it never offers S/U on a guess).
  const suEligibleCodes = distinctCodes.filter((code) => isSuEligible(moduleInfoByCode[code]));

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
      suWindowYears={firstYearWindowYears(user.matriculationYear)}
      suEligibleCodes={suEligibleCodes}
      currentTerm={term}
      semesterEntries={semesterEntries}
      reservedEntries={reservedEntries}
      exemptionEntries={exemptionEntries}
      exemptionYear={EXEMPTION_YEAR}
      exemptionSemester={EXEMPTION_SEMESTER}
      buckets={buckets}
      bucketDefs={degreeStructure.buckets}
      degreeLabel={degreeStructure.label}
      degreeTotalMc={degreeStructure.totalMc}
      violationsByEntryId={Object.fromEntries(violationsByEntryId)}
      analysisByCode={analysisByCode}
      pendingAnalysisCodes={pendingCodes}
      isAdmin={user.isAdmin}
    />
  );
}

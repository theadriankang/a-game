import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { MATH_BRIDGING_CODES, assumedModulesFor } from "@/lib/qualifications";
import { getModuleInfo, flattenPrereqTree, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { currentTerm } from "@/lib/plan-status";
import {
  buildAutoPlan,
  type AutoPlanCandidateModule,
  type AutoPlanExistingEntry,
} from "@/lib/degree-requirements/auto-plan";

// The onboarding placeholder slot for exemptions (see app/api/onboarding,
// app/planner/page.tsx) - kept out of the semester grid the client sends
// us, so we fetch it ourselves rather than relying on the client to
// remember to include it. Without this, exemption credit (e.g. an APC
// exemption from CS2101) was invisible to the draft: its MC never counted
// toward that bucket's progress, so the draft could try to (re-)schedule
// a module the student is already exempted from.
const EXEMPTION_YEAR = 0;
const EXEMPTION_SEMESTER = 0;

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    entries?: AutoPlanExistingEntry[];
    targetTotalSemesters?: number;
    // 0-based, matching auto-plan.ts's own SLOTS (Y1S1 = 0 .. Y4S2 = 7) - the sandbox's "What can still be
    // changed?" control (app/simulator/simulator-panel.tsx). -1 means nothing's locked. Optional and falls back
    // to the calendar-derived default below, so an older client that doesn't send it still works.
    lockedThroughIndex?: number;
  } | null;

  if (!body?.entries || !body.targetTotalSemesters) {
    return NextResponse.json({ error: "Missing entries or targetTotalSemesters." }, { status: 400 });
  }
  if (
    body.lockedThroughIndex !== undefined &&
    (!Number.isInteger(body.lockedThroughIndex) || body.lockedThroughIndex < -1 || body.lockedThroughIndex > 7)
  ) {
    return NextResponse.json({ error: "Invalid lockedThroughIndex." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const structure = getDegreeStructureForProgramme(user?.programme);

  const assumed = new Set(assumedModulesFor(user?.mathBackground));

  // Exemption credit (status COMPLETED at the 0/0 slot) - excludes the
  // Reserved bin, which shares that slot but isn't completed credit and
  // shouldn't count toward a bucket's progress. The client's own entries
  // (body.entries) never include this slot at all (app/simulator/page.tsx
  // filters it out before it ever reaches the browser), so without this
  // query the draft would have no way to know about it.
  const exemptionRows = await prisma.plannerEntry.findMany({
    where: { userId, academicYear: EXEMPTION_YEAR, semester: EXEMPTION_SEMESTER, status: { not: "RESERVED" } },
  });
  const existingEntries: AutoPlanExistingEntry[] = [
    ...body.entries,
    ...exemptionRows.map((e) => ({
      moduleCode: e.moduleCode,
      mc: e.mc,
      status: e.status,
      requirementTag: e.requirementTag,
      academicYear: e.academicYear,
      semester: e.semester,
    })),
  ];

  const existingCodes = new Set(
    existingEntries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
  );

  // Only fetch NUSMods data for the fixed-list codes this structure
  // actually names that aren't already in the plan - a small, bounded
  // set (a few dozen at most), not the whole module catalogue.
  const codesToFetch = Array.from(
    new Set(
      structure.buckets.flatMap((b) => b.moduleCodes ?? []).filter((c) => !existingCodes.has(c.toUpperCase()))
    )
  );

  const fetched = await Promise.all(
    codesToFetch.map(async (code) => {
      try {
        const info = await getModuleInfo(NUSMODS_ACAD_YEAR, code);
        return { code, info };
      } catch {
        return { code, info: null };
      }
    })
  );

  const candidateModules: AutoPlanCandidateModule[] = [];
  for (const bucket of structure.buckets) {
    for (const code of bucket.moduleCodes ?? []) {
      if (existingCodes.has(code.toUpperCase())) continue;
      const found = fetched.find((f) => f.code === code)?.info;
      if (!found) continue;
      candidateModules.push({
        moduleCode: found.moduleCode,
        label: found.title,
        mc: Number(found.moduleCredit) || 4,
        bucketId: bucket.id,
        // A student whose maths background NUS treats as H2-equivalent doesn't need the bridging module,
        // so it isn't a prerequisite for them (and shouldn't raise an "assumed you'll have it" warning).
        prereqCodes: flattenPrereqTree(found.prereqTree).filter((c) => !assumed.has(c.toUpperCase())),
        // The real and/or tree - see auto-plan.ts's isReady()/isTreeSatisfied for why this (not just
        // prereqCodes) decides whether a module is actually ready to schedule.
        prereqTree: found.prereqTree,
      });
    }
  }

  // Where the student actually is right now, independent of how far
  // ahead they've forward-planned - termIndex is 1-based (Y1S1 = 1),
  // auto-plan's own SLOTS indexing is 0-based, hence the -1. Null when
  // matriculationYear was never collected (older accounts); buildAutoPlan
  // falls back to its old behaviour (lock through the furthest existing
  // entry) in that case rather than guessing a boundary from no data.
  const term = currentTerm(user?.matriculationYear);
  const lockedThroughIndex = body.lockedThroughIndex ?? (term ? term.index - 1 : undefined);

  const result = buildAutoPlan({
    existingEntries,
    structure,
    candidateModules,
    targetTotalSemesters: body.targetTotalSemesters,
    lockedThroughIndex,
  });

  // No H2-equivalent maths: the bridging module really is a prerequisite, but it isn't in the degree's list, so the
  // draft can't place it. Say so rather than silently "assuming you'll have it".
  if (user?.mathBackground === "NONE") {
    const needing = candidateModules.filter((m) => m.prereqCodes.some((c) => MATH_BRIDGING_CODES.includes(c.toUpperCase())));
    if (needing.length > 0) {
      result.warnings.unshift(
        `You said you have no H2-equivalent maths, so add MA1301 (or MA1301X) in your first semester: ${needing
          .map((m) => m.moduleCode)
          .join(", ")} need it first.`
      );
    }
  }

  return NextResponse.json(result);
}

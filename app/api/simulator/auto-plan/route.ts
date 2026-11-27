import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { MATH_BRIDGING_CODES, assumedModulesFor } from "@/lib/qualifications";
import { getModuleInfo, flattenPrereqTree, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import {
  buildAutoPlan,
  type AutoPlanCandidateModule,
  type AutoPlanExistingEntry,
} from "@/lib/degree-requirements/auto-plan";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    entries?: AutoPlanExistingEntry[];
    targetTotalSemesters?: number;
  } | null;

  if (!body?.entries || !body.targetTotalSemesters) {
    return NextResponse.json({ error: "Missing entries or targetTotalSemesters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const structure = getDegreeStructureForProgramme(user?.programme);

  const assumed = new Set(assumedModulesFor(user?.mathBackground));

  const existingCodes = new Set(
    body.entries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
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
      });
    }
  }

  const result = buildAutoPlan({
    existingEntries: body.entries,
    structure,
    candidateModules,
    targetTotalSemesters: body.targetTotalSemesters,
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

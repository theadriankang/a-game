import { NextResponse } from "next/server";
import { getModuleInfo, flattenPrereqTree, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";

type RouteContext = { params: Promise<{ code: string }> };

// Real NUSMods data for the "At a glance" panel on a planner card —
// workload breakdown, department, which semesters it's offered, and a
// plain-language prereq/preclusion summary. Deliberately only real,
// structured NUSMods fields - no CORS/bidding-point data, since NUS no
// longer publishes that (CORS was retired; the current bidding system
// doesn't expose historical points via any public API).
export async function GET(_request: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const info = await getModuleInfo(NUSMODS_ACAD_YEAR, code);
    const prereqCodes = flattenPrereqTree(info.prereqTree);

    return NextResponse.json({
      moduleCode: info.moduleCode,
      title: info.title,
      mc: Number(info.moduleCredit) || 4,
      department: info.department ?? null,
      faculty: info.faculty ?? null,
      workload: Array.isArray(info.workload) ? info.workload : null,
      semestersOffered: (info.semesterData ?? []).map((s) => s.semester).sort(),
      prereqCodes,
      preclusion: info.preclusion ?? null,
      description: info.description ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
}

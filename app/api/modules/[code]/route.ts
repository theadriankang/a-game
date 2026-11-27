import { NextResponse } from "next/server";
import { getModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";

type RouteContext = { params: Promise<{ code: string }> };

// Used right after someone picks a module from the autocomplete dropdown,
// to pull its real title and MC so the "Add module" form can autofill
// both instead of just the code.
export async function GET(_request: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const info = await getModuleInfo(NUSMODS_ACAD_YEAR, code);
    // The add-module forms show this as read-only, so a real 0-MC module must
    // come through as 0 (`|| 4` used to turn it into 4); only a missing or
    // unparseable value falls back to the usual 4.
    const mc = Number(info.moduleCredit);
    return NextResponse.json({
      moduleCode: info.moduleCode,
      title: info.title,
      mc: Number.isFinite(mc) ? mc : 4,
    });
  } catch {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
}

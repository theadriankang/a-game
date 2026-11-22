import { NextResponse } from "next/server";
import { getModuleList, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { dbErrorResponse } from "@/lib/api-error";

const MAX_RESULTS = 8;

// Backs the module-code autocomplete in the planner's "Add module" form.
// NUSMods' condensed module list (~8000 modules) is fetched once and
// reused across requests via Next's fetch cache (see getModuleList's
// revalidate window) - this route just filters it in memory, so it's
// cheap even though the dataset is large.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const modules = await getModuleList(NUSMODS_ACAD_YEAR);
    const query = q.toUpperCase();
    const queryLower = q.toLowerCase();

    // Code-prefix matches first (what someone typing "CS21" almost always
    // wants), then title-substring matches, so the most likely pick is
    // always at the top rather than wherever it falls in NUSMods' list.
    const codeMatches = modules.filter((m) => m.moduleCode.toUpperCase().startsWith(query));
    const titleMatches = modules.filter(
      (m) =>
        !m.moduleCode.toUpperCase().startsWith(query) &&
        m.title.toLowerCase().includes(queryLower)
    );

    const results = [...codeMatches, ...titleMatches]
      .slice(0, MAX_RESULTS)
      .map((m) => ({ moduleCode: m.moduleCode, title: m.title }));

    return NextResponse.json({ results });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

import { getModuleList, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";

// Titles for the module codes NUSMods lists for the current academic year (the same cached list the planner's "Add
// module" box reads). A code missing from the result isn't offered this year - retired, renamed or not yet listed - which
// callers use to avoid linking to a module page that would only say it couldn't find it. Never throws: if NUSMods is
// unreachable there are simply no titles.
export async function getCurrentModuleTitles(codes: Iterable<string>): Promise<Record<string, string>> {
  const wanted = new Set(codes);
  try {
    const list = await getModuleList(NUSMODS_ACAD_YEAR);
    return Object.fromEntries(list.filter((m) => wanted.has(m.moduleCode)).map((m) => [m.moduleCode, m.title]));
  } catch {
    return {};
  }
}

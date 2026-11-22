// Thin typed client for the public NUSMods API (api.nusmods.com/v2), used
// for module data: prerequisites, MC, workload, timetable. No API key
// required. See https://api.nusmods.com/v2/ for the full schema — these
// types only cover the fields this app actually reads.

const NUSMODS_BASE = "https://api.nusmods.com/v2";

// A day's worth of cache is fine: module data for a given academic year
// essentially never changes mid-day, and this keeps us well clear of
// hammering a public API on every page load.
const REVALIDATE_SECONDS = 60 * 60 * 24;

export type ModuleCondensed = {
  moduleCode: string;
  title: string;
  semesters: number[];
};

// A prereq tree node: either a leaf module code, or an "and"/"or" group of
// further nodes. NUSMods' actual shape is a loosely-typed recursive JSON
// object — this mirrors that rather than forcing it into a stricter shape
// the real data won't always match.
export type PrereqTree =
  | string
  | { and: PrereqTree[] }
  | { or: PrereqTree[] };

export type SemesterData = {
  semester: number;
  examDate?: string;
  examDuration?: number;
};

export type ModuleInfo = {
  moduleCode: string;
  title: string;
  description?: string;
  moduleCredit: string; // NUSMods returns this as a string, e.g. "4"
  department?: string;
  faculty?: string;
  workload?: number[] | string;
  prereqTree?: PrereqTree;
  preclusion?: string;
  corequisite?: string;
  semesterData?: SemesterData[];
};

function academicYearPath(acadYear: string): string {
  // NUSMods expects "2026-2027"; accept "2026/2027" too and normalize.
  return acadYear.replace("/", "-");
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${NUSMODS_BASE}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(
      `NUSMods request failed (${res.status}) for ${path}`
    );
  }
  return res.json() as Promise<T>;
}

export async function getModuleList(
  acadYear: string
): Promise<ModuleCondensed[]> {
  return fetchJson<ModuleCondensed[]>(
    `/${academicYearPath(acadYear)}/moduleList.json`
  );
}

export async function getModuleInfo(
  acadYear: string,
  moduleCode: string
): Promise<ModuleInfo> {
  return fetchJson<ModuleInfo>(
    `/${academicYearPath(acadYear)}/modules/${moduleCode.toUpperCase()}.json`
  );
}

// Flattens a prereq tree into the plain list of module codes it references,
// for simple "do you have all of these" checks before a real tree-evaluator
// (task: a later pass can replace this with proper and/or satisfaction logic
// once the planner needs to show *which* branch is unmet, not just whether
// any prerequisite exists at all).
export function flattenPrereqTree(tree: PrereqTree | undefined): string[] {
  if (!tree) return [];
  if (typeof tree === "string") return [tree];
  if ("and" in tree) return tree.and.flatMap(flattenPrereqTree);
  if ("or" in tree) return tree.or.flatMap(flattenPrereqTree);
  return [];
}

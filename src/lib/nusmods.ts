// Thin typed client for the public NUSMods API (api.nusmods.com/v2), used
// for module data: prerequisites, MC, workload, timetable. No API key
// required. See https://api.nusmods.com/v2/ for the full schema — these
// types only cover the fields this app actually reads.

const NUSMODS_BASE = "https://api.nusmods.com/v2";

// Shared default academic year for prereq/preclusion checking, matching the
// degree structure in lib/degree-requirements/bcomp-cs.ts. Not yet derived
// per-user (no matriculation year is stored on User today) — a reasonable
// single default until that's tracked.
export const NUSMODS_ACAD_YEAR = "2026-2027";

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

// A single scheduled class for one lesson type/class number — e.g. one
// specific Tuesday 10am lecture slot. "weeks" is usually a flat list of
// teaching-week numbers (1-13); a few modules instead describe it as a
// {start,end,weekInterval} range (e.g. odd/even-week alternating classes),
// so both shapes are modeled here rather than assuming the simple one.
export type WeekRange = {
  start: string;
  end: string;
  weekInterval?: number;
  weeks?: number[];
};

export type Lesson = {
  classNo: string;
  lessonType: string; // "Lecture", "Tutorial", "Laboratory", etc.
  day: string; // "Monday".."Sunday"
  startTime: string; // "0900"
  endTime: string; // "1200"
  weeks: number[] | WeekRange;
  venue: string;
};

export type SemesterData = {
  semester: number;
  examDate?: string;
  examDuration?: number;
  timetable?: Lesson[];
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

// In-process cache on top of Next's own fetch cache. Next's fetch cache
// (the `next: { revalidate }` below) already avoids re-hitting NUSMods for
// a repeat request, but every cache read still re-enters the fetch
// pipeline and re-parses the JSON; for the module-code autocomplete,
// which can re-resolve the same handful of popular codes many times a
// minute, that overhead is the dominant cause of a slow "feels laggy"
// autofill. This Map short-circuits an exact repeat within the same
// server process straight to the already-parsed value - cheap, and
// never used for anything that needs to be fresh within a request.
const inProcessCache = new Map<string, unknown>();

async function fetchJson<T>(path: string): Promise<T> {
  const cached = inProcessCache.get(path);
  if (cached !== undefined) return cached as T;

  const res = await fetch(`${NUSMODS_BASE}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(
      `NUSMods request failed (${res.status}) for ${path}`
    );
  }
  const data = (await res.json()) as T;
  inProcessCache.set(path, data);
  return data;
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
  // NUSMods encodes a minimum-grade requirement as "CODE:GRADE" (e.g.
  // "MA1301:D") - strip that suffix so every caller compares against a
  // plain module code. Without this, every single leaf in a prereq tree
  // carried its ":D"/":CS" suffix, which never matched a real moduleCode
  // string anywhere else in the app - so auto-plan.ts (the only consumer
  // that compares these against other codes) warned that it "couldn't
  // verify" essentially every prerequisite, even ones already completed,
  // and its prereq-ordering check silently never actually gated anything.
  if (typeof tree === "string") return [tree.split(":")[0]];
  if ("and" in tree) return [...new Set(tree.and.flatMap(flattenPrereqTree))];
  if ("or" in tree) return [...new Set(tree.or.flatMap(flattenPrereqTree))];
  return [];
}

import type { MinorStructure, MinorRequirementGroup } from "./types";

export type MinorFitEntry = {
  moduleCode: string | null;
  mc: number;
  status: "COMPLETED" | "PLANNED" | "RESERVED";
};

export type GroupFit = {
  groupId: string;
  label: string;
  requiredMc: number;
  completedMc: number;
  plannedMc: number;
  matchedCodes: string[];
};

export type MinorFit = {
  minor: MinorStructure;
  eligible: boolean;
  excludedBy: string | null;
  // Set when the programme is open only to certain programmes and the student isn't in one (or their programme
  // isn't known): the programmes it is open to.
  onlyFor: string[] | null;
  // Set when the student's intake is outside the intakes that can take it: a sentence saying which ones can.
  cohortClosed: string | null;
  groups: GroupFit[];
  totalRequiredMc: number;
  totalCompletedMc: number;
  totalPlannedMc: number;
};

// "2026" -> "AY2026/27".
const academicYear = (year: number) => `AY${year}/${String((year + 1) % 100).padStart(2, "0")}`;

// A programme with cohort limits is closed to a student outside them, and to a student whose intake we don't know
// (no nudge is better than a wrong one). Returns why, or null when they're in range or the programme has no limit.
function cohortClosure(minor: MinorStructure, matriculationYear: number | null | undefined): string | null {
  const from = minor.cohortFrom ?? null;
  const to = minor.cohortTo ?? null;
  if (from === null && to === null) return null;
  const who =
    from !== null && to !== null
      ? `students admitted ${academicYear(from)} to ${academicYear(to)}`
      : from !== null
        ? `students admitted ${academicYear(from)} onwards`
        : `students admitted ${academicYear(to!)} and earlier (it is closed to newer intakes)`;
  if (matriculationYear == null) return `Only open to ${who}, and your intake year isn't set.`;
  if ((from !== null && matriculationYear < from) || (to !== null && matriculationYear > to)) return `Only open to ${who}.`;
  return null;
}

function matchesGroup(code: string, group: MinorRequirementGroup): boolean {
  const upper = code.toUpperCase();
  if (group.excludeCodes?.includes(upper)) return false;
  if (group.moduleCodes?.includes(upper)) return true;
  if (group.codePrefixes?.some((prefix) => upper.startsWith(prefix))) return true;
  return false;
}

// Splits a student's modules across ONE programme's groups so that no module
// is counted twice inside that programme. Groups overlap in real data (e.g.
// the Mathematics second major lists MA22xx under both its "Level 1000/2000"
// and "Multivariable calculus or MA22xx" groups), and matching each group
// independently would let a single 4 MC module satisfy both and report 8 MC.
//
// Greedy, not optimal: groups with the fewest candidate modules fill first so
// a module that only fits one group isn't taken by a group that has options,
// and within a group completed modules are used before planned ones. A group
// stops taking modules once its requiredMc is reached, leaving the rest for
// other groups. Good enough for programmes this small; swap for a proper
// assignment if a programme ever needs it.
function allocateEntries(
  entries: MinorFitEntry[],
  groups: MinorRequirementGroup[]
): Map<string, MinorFitEntry[]> {
  const coded = entries.filter((e): e is MinorFitEntry & { moduleCode: string } => !!e.moduleCode);
  const candidates = new Map(groups.map((g) => [g.id, coded.filter((e) => matchesGroup(e.moduleCode, g))]));
  const fillOrder = [...groups].sort((a, b) => candidates.get(a.id)!.length - candidates.get(b.id)!.length);

  const taken = new Set<MinorFitEntry>();
  const allocated = new Map<string, MinorFitEntry[]>(groups.map((g) => [g.id, []]));
  for (const group of fillOrder) {
    const pool = candidates
      .get(group.id)!
      .filter((e) => !taken.has(e))
      .sort((a, b) => Number(b.status === "COMPLETED") - Number(a.status === "COMPLETED"));
    let mc = 0;
    for (const entry of pool) {
      if (mc >= group.requiredMc) break;
      allocated.get(group.id)!.push(entry);
      taken.add(entry);
      mc += entry.mc;
    }
  }
  return allocated;
}

// Deliberately independent of the degree-requirement bucket system
// (src/lib/degree-requirements) - a module that already counts toward a
// Common Curriculum pillar or CS Foundation still gets checked against a
// minor's own groups here, so a module like ST2334 or MA1521 that's
// compulsory for the degree AND listed in a minor's requirements shows up
// as satisfying both, automatically. The two checks run independently;
// whether NUS actually lets a module count twice across a degree and a
// minor is a per-programme rule, not something this function decides.
export function computeMinorFit(
  entries: MinorFitEntry[],
  minor: MinorStructure,
  userProgramme: string | null | undefined,
  // The student's intake year (User.matriculationYear), for programmes limited to some intakes.
  matriculationYear?: number | null
): MinorFit {
  const cohortClosed = cohortClosure(minor, matriculationYear);
  const excludedBy =
    userProgramme &&
    minor.excludedProgrammePrefixes.find((prefix) => userProgramme.startsWith(prefix));

  // A programme open only to some degrees (a focus area) is closed to everyone else, including a student whose
  // programme we don't know: better no nudge than a wrong one.
  const only = minor.eligibleProgrammePrefixes ?? [];
  const notOpen = only.length > 0 && !(userProgramme && only.some((prefix) => userProgramme.startsWith(prefix)));

  const allocated = allocateEntries(entries, minor.groups);

  const groups: GroupFit[] = minor.groups.map((group) => {
    const matched = allocated.get(group.id) ?? [];
    return {
      groupId: group.id,
      label: group.label,
      requiredMc: group.requiredMc,
      completedMc: matched.filter((e) => e.status === "COMPLETED").reduce((s, e) => s + e.mc, 0),
      plannedMc: matched
        .filter((e) => e.status === "PLANNED" || e.status === "RESERVED")
        .reduce((s, e) => s + e.mc, 0),
      matchedCodes: matched.map((e) => e.moduleCode!).sort(),
    };
  });

  return {
    minor,
    eligible: !excludedBy && !notOpen && !cohortClosed,
    excludedBy: excludedBy ?? null,
    onlyFor: notOpen ? only : null,
    cohortClosed,
    groups,
    totalRequiredMc: minor.totalMcMin,
    totalCompletedMc: groups.reduce((s, g) => s + Math.min(g.completedMc, g.requiredMc), 0),
    totalPlannedMc: groups.reduce(
      (s, g) => s + Math.min(g.completedMc + g.plannedMc, g.requiredMc) - Math.min(g.completedMc, g.requiredMc),
      0
    ),
  };
}

// Why a programme isn't open to this student, in a sentence; null when it is open. `excludedBy` and `onlyFor`
// and `cohortClosed` are the three ways it can be closed (see computeMinorFit).
export function closedReason(fit: MinorFit): string | null {
  if (fit.eligible) return null;
  if (fit.onlyFor) return `Only open to ${fit.onlyFor.join(" or ")} students.`;
  if (fit.excludedBy) return `Not open to ${fit.excludedBy} students.`;
  return fit.cohortClosed ?? "Not open to your programme.";
}

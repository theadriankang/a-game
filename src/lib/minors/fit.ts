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
  groups: GroupFit[];
  totalRequiredMc: number;
  totalCompletedMc: number;
  totalPlannedMc: number;
};

function matchesGroup(code: string, group: MinorRequirementGroup): boolean {
  const upper = code.toUpperCase();
  if (group.excludeCodes?.includes(upper)) return false;
  if (group.moduleCodes?.includes(upper)) return true;
  if (group.codePrefixes?.some((prefix) => upper.startsWith(prefix))) return true;
  return false;
}

// Deliberately independent of the degree-requirement bucket system
// (src/lib/degree-requirements) - a module that already counts toward a
// Common Curriculum pillar or CS Foundation still gets checked against a
// minor's own groups here, so a module like ST2334 or MA1521 that's
// compulsory for the degree AND listed in a minor's requirements shows up
// as satisfying both, automatically. No special-cased double-counting
// logic needed - it falls out of running the two checks independently.
export function computeMinorFit(
  entries: MinorFitEntry[],
  minor: MinorStructure,
  userProgramme: string | null | undefined
): MinorFit {
  const excludedBy =
    userProgramme &&
    minor.excludedProgrammePrefixes.find((prefix) => userProgramme.startsWith(prefix));

  const groups: GroupFit[] = minor.groups.map((group) => {
    const matched = entries.filter((e) => e.moduleCode && matchesGroup(e.moduleCode, group));
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
    eligible: !excludedBy,
    excludedBy: excludedBy ?? null,
    groups,
    totalRequiredMc: minor.totalMcMin,
    totalCompletedMc: groups.reduce((s, g) => s + Math.min(g.completedMc, g.requiredMc), 0),
    totalPlannedMc: groups.reduce(
      (s, g) => s + Math.min(g.completedMc + g.plannedMc, g.requiredMc) - Math.min(g.completedMc, g.requiredMc),
      0
    ),
  };
}

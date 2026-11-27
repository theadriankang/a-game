// Checks a user's plan against NUSMods prerequisite trees and preclusion
// lists. This is deliberately conservative: a missing/unparseable prereq
// tree or preclusion string is treated as "no constraint" rather than
// guessed at, so a gap in NUSMods' own data never produces a false
// violation.

import { flattenPrereqTree, formatPrereqTree } from "./nusmods";
import type { ModuleInfo, PrereqTree } from "./nusmods";
import { MATH_BRIDGING_CODES, assumedModulesFor } from "./qualifications";

export type PrereqViolation = {
  moduleCode: string;
  kind: "prereq" | "preclusion" | "duplicate";
  message: string;
};

type CheckableEntry = {
  id: string;
  moduleCode: string | null;
  academicYear: number;
  semester: number;
  status: "COMPLETED" | "PLANNED" | "RESERVED";
};

// A prereq tree is satisfied if every leaf in an "and" group is satisfied,
// and at least one leaf in an "or" group is. A bare string leaf is
// satisfied if its code is in the set already taken.
export function evaluatePrereqTree(
  tree: PrereqTree | undefined,
  satisfied: Set<string>
): boolean {
  if (!tree) return true;
  // NUSMods encodes a minimum-grade requirement as "CODE:GRADE" (e.g.
  // "MA1301:D") - strip that suffix before comparing, or every leaf with a
  // grade requirement would never match a plain moduleCode anywhere in
  // the plan, flagging an already-completed prereq as unmet. (Same root
  // cause as the fix in nusmods.ts's flattenPrereqTree - this is a
  // separate function with its own copy of the same unstripped compare.)
  if (typeof tree === "string") return satisfied.has(tree.split(":")[0].toUpperCase());
  if ("and" in tree) return tree.and.every((node) => evaluatePrereqTree(node, satisfied));
  if ("or" in tree) return tree.or.some((node) => evaluatePrereqTree(node, satisfied));
  return true;
}

// What's left of a prereq tree once everything already satisfied is dropped, or null when the whole tree is
// satisfied. An "and" keeps only its unmet branches; an "or" with any satisfied branch is met outright, and
// otherwise keeps every branch (the student could still pick any one of them). Mirrors evaluatePrereqTree, so
// it returns null exactly when that returns true.
export function unmetPrereqs(
  tree: PrereqTree | undefined,
  satisfied: Set<string>
): PrereqTree | null {
  if (!tree) return null;
  if (typeof tree === "string") return satisfied.has(tree.split(":")[0].toUpperCase()) ? null : tree;
  if ("and" in tree) {
    const unmet = tree.and.map((node) => unmetPrereqs(node, satisfied)).filter((n): n is PrereqTree => n !== null);
    return unmet.length > 0 ? { and: unmet } : null;
  }
  if ("or" in tree) {
    const unmet = tree.or.map((node) => unmetPrereqs(node, satisfied));
    return unmet.every((n) => n !== null) ? { or: unmet as PrereqTree[] } : null;
  }
  return null;
}

// NUSMods' preclusion field is free text ("CS2040, CS2040S or CS2040C"),
// not a structured tree — this pulls out anything that looks like a module
// code rather than trying to parse the sentence. Good enough to flag the
// common case (another listed module already taken); it can over- or
// under-match on unusual phrasing, which is why this is surfaced as a
// warning for the user to double check, not a hard block.
const MODULE_CODE_PATTERN = /\b[A-Z]{2,4}\d{4}[A-Z]{0,2}\b/g;

export function extractModuleCodes(text: string | undefined | null): string[] {
  if (!text) return [];
  return Array.from(new Set(text.toUpperCase().match(MODULE_CODE_PATTERN) ?? []));
}

function termKey(entry: { academicYear: number; semester: number }): number {
  return entry.academicYear * 10 + entry.semester;
}

/**
 * Checks every module-backed entry in a plan against the supplied NUSMods
 * module info, and returns any violations keyed by planner-entry id.
 *
 * - Prereqs must come from a strictly earlier year/semester than the entry
 *   itself (same-semester "prereqs" aren't treated as satisfied — this
 *   doesn't yet model corequisites, which NUSMods tracks separately).
 * - Preclusions are checked against the rest of the plan regardless of
 *   term, since taking a precluded pair in either order is still a clash.
 * - RESERVED placeholder slots have no module code and are skipped.
 * - The same module appearing more than once is flagged on every copy. The planner no longer lets that happen,
 *   but plans made before then can still hold duplicates, and this is how they get noticed and cleaned up.
 */
export function checkPlan(
  entries: CheckableEntry[],
  moduleInfoByCode: Record<string, ModuleInfo | undefined>,
  /**
   * What the student told us about their maths background (see qualifications.ts). Many prerequisites read
   * "H2 Math OR MA1301", but NUSMods' tree keeps only the MA1301 branch, so a student NUS treats as covered
   * would otherwise be flagged for a module they were never meant to take.
   */
  options: { mathBackground?: string | null } = {}
): Map<string, PrereqViolation[]> {
  const violations = new Map<string, PrereqViolation[]>();
  const assumed = assumedModulesFor(options.mathBackground);

  const takenAnywhere = new Set(
    entries
      .filter((e) => e.moduleCode && e.status !== "RESERVED")
      .map((e) => e.moduleCode!.toUpperCase())
  );

  const timesInPlan = new Map<string, number>();
  for (const e of entries) {
    if (!e.moduleCode || e.status === "RESERVED") continue;
    const code = e.moduleCode.toUpperCase();
    timesInPlan.set(code, (timesInPlan.get(code) ?? 0) + 1);
  }

  for (const entry of entries) {
    if (!entry.moduleCode || entry.status === "RESERVED") continue;

    const entryViolations: PrereqViolation[] = [];

    const copies = timesInPlan.get(entry.moduleCode.toUpperCase()) ?? 1;
    if (copies > 1) {
      entryViolations.push({
        moduleCode: entry.moduleCode,
        kind: "duplicate",
        message: `${entry.moduleCode} is in your plan ${copies} times. Remove the extra copies.`,
      });
    }

    const info = moduleInfoByCode[entry.moduleCode.toUpperCase()];
    // Couldn't fetch this module's data: no prereq/preclusion constraint assumed.
    if (info?.prereqTree) {
      const takenBefore = new Set(
        entries
          .filter(
            (e) =>
              e.moduleCode &&
              e.status !== "RESERVED" &&
              termKey(e) < termKey(entry)
          )
          .map((e) => e.moduleCode!.toUpperCase())
      );
      const unmet = unmetPrereqs(info.prereqTree, new Set([...takenBefore, ...assumed]));
      if (unmet) {
        // Name what's actually missing. If some of it is already in the plan, just not early enough, say so:
        // the fix is then to reorder, not to add a module.
        const needs = formatPrereqTree(unmet);
        const tooLate = flattenPrereqTree(unmet).filter((code) => takenAnywhere.has(code.toUpperCase()));
        const message = needs
          ? `${entry.moduleCode} needs ${needs} in an earlier semester.` +
            (tooLate.length > 0
              ? ` ${tooLate.join(", ")} ${tooLate.length > 1 ? "are" : "is"} in your plan, but not before it.`
              : "")
          : `Prerequisites for ${entry.moduleCode} aren't met by an earlier semester yet.`;
        entryViolations.push({ moduleCode: entry.moduleCode, kind: "prereq", message });
      }
    }

    // NUS precludes the bridging module for anyone with A-level Math (certificate and test holders are "deemed"
    // covered rather than precluded, so they aren't flagged here).
    if (options.mathBackground === "H2" && MATH_BRIDGING_CODES.includes(entry.moduleCode.toUpperCase())) {
      entryViolations.push({
        moduleCode: entry.moduleCode,
        kind: "preclusion",
        message: `${entry.moduleCode} is a bridging module for students without H2 Math; NUS doesn't let you take it with your maths background.`,
      });
    }

    const precludedBy = extractModuleCodes(info?.preclusion).filter(
      (code) => code !== entry.moduleCode!.toUpperCase() && takenAnywhere.has(code)
    );
    if (precludedBy.length > 0) {
      entryViolations.push({
        moduleCode: entry.moduleCode,
        kind: "preclusion",
        message: `${entry.moduleCode} is precluded by ${precludedBy.join(", ")} elsewhere in your plan.`,
      });
    }

    if (entryViolations.length > 0) {
      violations.set(entry.id, entryViolations);
    }
  }

  return violations;
}

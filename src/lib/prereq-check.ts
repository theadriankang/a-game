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

// Past this many alternatives in an "or" group, show the first few and count the rest. A prerequisite like
// "CS1010 or CS1010E or CS1010X or ... or UTC2851" is accurate but buries the answer.
const MAX_ALTERNATIVES = 3;

function rawLeaves(node: PrereqTree): string[] {
  if (typeof node === "string") return [node];
  return "and" in node ? node.and.flatMap(rawLeaves) : node.or.flatMap(rawLeaves);
}

/**
 * The popover text for an unmet prerequisite, written for this student's plan:
 *
 * - An alternative that's already in the plan stands in for the whole "or" group. If CS2030S accepts any of nine
 *   CS1010 variants and the student has CS1101S in the same semester, the problem is the order, so say that
 *   rather than listing the other eight.
 * - Otherwise, nothing relevant is in the plan: show the first few alternatives and count the rest.
 * - A minimum grade shared by everything listed is said once instead of after every module.
 *
 * `termOfCode` maps module codes in the plan to their termKey; `entryTerm` is the checked module's own.
 */
function describeUnmetPrereqs(
  moduleCode: string,
  unmet: PrereqTree,
  termOfCode: Map<string, number>,
  entryTerm: number
): string {
  const inPlan = (node: PrereqTree) => flattenPrereqTree(node).some((c) => termOfCode.has(c.toUpperCase()));

  const narrow = (node: PrereqTree): PrereqTree => {
    if (typeof node === "string") return node;
    if ("and" in node) return { and: node.and.map(narrow) };
    const planned = node.or.filter(inPlan);
    const kept = (planned.length > 0 ? planned : node.or).map(narrow);
    return kept.length === 1 ? kept[0] : { or: kept };
  };
  const narrowed = narrow(unmet);

  const where = (code: string) => (termOfCode.get(code.toUpperCase()) === entryTerm ? "the same" : "a later");

  // The usual case: the one module that would do is already planned, just not early enough.
  if (typeof narrowed === "string") {
    const code = narrowed.split(":")[0];
    if (termOfCode.has(code.toUpperCase())) {
      return `${moduleCode} needs ${code} in an earlier semester, but it's in ${where(code)} semester.`;
    }
  }

  const grades = new Set(rawLeaves(narrowed).map((leaf) => leaf.split(":")[1] ?? ""));
  const sharedGrade = grades.size === 1 ? [...grades][0] : "";
  const tidy = (node: PrereqTree): PrereqTree => {
    if (typeof node === "string") return sharedGrade ? node.split(":")[0] : node;
    if ("and" in node) return { and: node.and.map(tidy) };
    const options = node.or.map(tidy);
    return options.length > MAX_ALTERNATIVES
      ? { or: [...options.slice(0, MAX_ALTERNATIVES), `${options.length - MAX_ALTERNATIVES} others`] }
      : { or: options };
  };

  const needs = formatPrereqTree(tidy(narrowed)) ?? "its prerequisites";
  let message = `${moduleCode} needs ${needs} in an earlier semester${sharedGrade ? `, with at least a ${sharedGrade}` : ""}.`;

  // Whatever part of that is already planned, but not early enough.
  const late = flattenPrereqTree(narrowed).filter((c) => termOfCode.has(c.toUpperCase()));
  for (const group of [late.filter((c) => where(c) === "the same"), late.filter((c) => where(c) === "a later")]) {
    if (group.length > 0) {
      message += ` ${group.join(", ")} ${group.length > 1 ? "are" : "is"} in ${where(group[0])} semester.`;
    }
  }
  return message;
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
 * - Exempted modules (academicYear 0) must be included in `entries`: they satisfy prerequisites for anything in a
 *   real semester, but are not themselves checked.
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
  // Where each module sits in the plan (its earliest copy), so a prerequisite message can speak about the
  // student's own plan rather than listing modules they've no intention of taking.
  const termOfCode = new Map<string, number>();
  for (const e of entries) {
    if (!e.moduleCode || e.status === "RESERVED") continue;
    const code = e.moduleCode.toUpperCase();
    timesInPlan.set(code, (timesInPlan.get(code) ?? 0) + 1);
    termOfCode.set(code, Math.min(termOfCode.get(code) ?? Infinity, termKey(e)));
  }

  for (const entry of entries) {
    if (!entry.moduleCode || entry.status === "RESERVED") continue;
    // Exempted modules (year 0) are credit already granted: they count towards everyone else's prerequisites,
    // preclusions and duplicates above, but there's no semester to check them against.
    if (entry.academicYear < 1) continue;

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
        entryViolations.push({
          moduleCode: entry.moduleCode,
          kind: "prereq",
          message: describeUnmetPrereqs(entry.moduleCode, unmet, termOfCode, termKey(entry)),
        });
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

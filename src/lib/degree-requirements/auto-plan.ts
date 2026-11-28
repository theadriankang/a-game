import type { DegreeStructure } from "./types";
import { bucketPlannerEntries, type PlannableEntry } from "./bucket";
// Type-only import - auto-plan.ts stays pure/network-free, this just
// borrows the and/or tree shape NUSMods uses.
import type { PrereqTree } from "../nusmods";

export type AutoPlanExistingEntry = PlannableEntry & {
  academicYear: number;
  semester: number;
};

// A real, concrete module the planner could add - fetched from NUSMods by
// the caller (this file stays pure/testable, no network calls of its own).
export type AutoPlanCandidateModule = {
  moduleCode: string;
  label: string;
  mc: number;
  bucketId: string;
  // Flattened prereq codes (see flattenPrereqTree) - kept for the
  // "couldn't verify this prereq" warning text. NOT used for the
  // ready-to-schedule check below anymore (see prereqTree and
  // isTreeSatisfied) - flattening an and/or tree into one list loses which
  // codes are alternatives vs. true co-requirements, which used to make
  // isReady() treat every leaf as mandatory. In practice that meant any
  // module whose prereq tree listed an unchosen pick-one alternative (e.g.
  // UTC2851, the alternative to CS1101S for Digital Literacy) as one leaf
  // of an "or" group got treated as permanently blocked, since that
  // alternative is a real candidate module that's intentionally never
  // scheduled. This silently dropped CS2030S, CS2040S, CS2100 and
  // everything depending on them out of every real draft.
  prereqCodes: string[];
  // The real and/or structure, when the caller has it (NUSMods returns
  // this directly as prereqTree). Preferred over prereqCodes for deciding
  // whether a module is ready to schedule.
  prereqTree?: PrereqTree;
};

// Evaluates a real and/or prereq tree against what's scheduled so far,
// instead of flattening it into a list and requiring every leaf (see
// AutoPlanCandidateModule.prereqCodes doc above for why that broke). A
// leaf is satisfied if it's already scheduled, or if it's not a module
// this app tracks at all (an external/legacy code like "CS1010" that
// isn't one of this degree's own candidate/existing modules - assumed
// satisfied rather than blocking on data we don't have).
function isTreeSatisfied(tree: PrereqTree, scheduledCodes: Set<string>, knownCodes: Set<string>): boolean {
  if (typeof tree === "string") {
    const code = tree.split(":")[0].toUpperCase();
    return scheduledCodes.has(code) || !knownCodes.has(code);
  }
  if ("and" in tree) return tree.and.every((t) => isTreeSatisfied(t, scheduledCodes, knownCodes));
  if ("or" in tree) return tree.or.some((t) => isTreeSatisfied(t, scheduledCodes, knownCodes));
  return true;
}

export type AutoPlanAddedEntry = {
  moduleCode: string | null;
  label: string;
  mc: number;
  academicYear: number;
  semester: number;
  requirementTag: string | null;
};

export type AutoPlanResult = {
  addedEntries: AutoPlanAddedEntry[];
  warnings: string[];
};

const SLOTS: { academicYear: number; semester: number }[] = [1, 2, 3, 4].flatMap((year) =>
  [1, 2].map((sem) => ({ academicYear: year, semester: sem }))
);

const SEMESTER_MC_CAP = 23;
// A semester drafted below this is "underloaded" - not an error, but worth
// a warning, since it usually means something that would otherwise fit got
// pushed out by prerequisite ordering rather than genuine lack of content.
const SEMESTER_MC_FLOOR = 15;
const PLACEHOLDER_CHUNK_MC = 8;

type QueueItem =
  | { kind: "concrete"; module: AutoPlanCandidateModule; level: number; order: number }
  | { kind: "placeholder"; bucketId: string; label: string; mc: number; order: number };

function slotIndexOf(academicYear: number, semester: number): number {
  return SLOTS.findIndex((s) => s.academicYear === academicYear && s.semester === semester);
}

// Pulls the NUS module level (the first digit after the faculty-code
// letters - CS1231S -> 1, MA1521 -> 1, CS2030S -> 2, CS3230 -> 3) so
// foundational modules get first claim on early semesters the way NUS's
// own sample study plans (and real students) sequence them: clear 1000s
// first, occasional 3000s show up in Year 2, Breadth & Depth / 4000s land
// in Years 3-4. Unparseable codes fall back to the lowest priority (9)
// rather than jumping the queue.
function moduleLevel(code: string): number {
  const match = code.match(/\d/);
  return match ? Number(match[0]) : 9;
}

// Builds a draft plan for every semester after the furthest one that
// already has something in it, filling fixed-list requirements first (in
// a best-effort prereq + level order) and generic placeholders for
// buckets that have no single right module (GE pillars, CS Breadth &
// Depth, ID/CD, Unrestricted Electives) - this is a draft to react to,
// not a guarantee; it only resolves prereqs it has data for.
export function buildAutoPlan(params: {
  existingEntries: AutoPlanExistingEntry[];
  structure: DegreeStructure;
  candidateModules: AutoPlanCandidateModule[];
  targetTotalSemesters: number;
}): AutoPlanResult {
  const { existingEntries, structure, candidateModules, targetTotalSemesters } = params;
  const warnings: string[] = [];

  const existingCodes = new Set(
    existingEntries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
  );
  const knownCodes = new Set([...existingCodes, ...candidateModules.map((m) => m.moduleCode.toUpperCase())]);

  // Where the draft should start: the semester right after the furthest
  // one that already has anything planned, not from the beginning -
  // existing semesters are left exactly as they are.
  const furthestIndex = existingEntries.reduce((max, e) => {
    const idx = slotIndexOf(e.academicYear, e.semester);
    return idx > max ? idx : max;
  }, -1);
  const startIndex = furthestIndex + 1;

  if (startIndex >= targetTotalSemesters) {
    warnings.push("Your plan already fills or exceeds the target number of semesters.");
    return { addedEntries: [], warnings };
  }

  const progress = bucketPlannerEntries(existingEntries, structure);
  const progressById = new Map(progress.map((p) => [p.bucketId, p]));
  const candidatesByCode = new Map(candidateModules.map((m) => [m.moduleCode.toUpperCase(), m]));

  const queue: QueueItem[] = [];
  let order = 0;

  for (const bucket of structure.buckets) {
    const prog = progressById.get(bucket.id);
    const satisfiedMc = (prog?.completedMc ?? 0) + (prog?.plannedMc ?? 0);
    let remainingMc = Math.max(bucket.requiredMc - satisfiedMc, 0);
    if (remainingMc <= 0) continue;

    if (bucket.moduleCodes && bucket.moduleCodes.length > 0) {
      // Fixed-list buckets: walk the list in order, skipping modules
      // already in the plan, stopping once the required MC is met - this
      // naturally handles both "take all of these" buckets (CS
      // Foundation) and "pick one of these" buckets (Data Literacy),
      // since a pick-one bucket's requiredMc is met after the first one.
      for (const code of bucket.moduleCodes) {
        if (remainingMc <= 0) break;
        const upper = code.toUpperCase();
        if (existingCodes.has(upper)) continue;
        const candidate = candidatesByCode.get(upper);
        if (!candidate) {
          warnings.push(`Couldn't fetch NUSMods data for ${code} (${bucket.label}) - left it out of the draft.`);
          continue;
        }
        queue.push({
          kind: "concrete",
          module: candidate,
          level: moduleLevel(candidate.moduleCode),
          order: order++,
        });
        remainingMc -= candidate.mc;
      }
      if (remainingMc > 0) {
        // The fixed list didn't cover the full requirement - fall back to
        // a placeholder for the rest rather than silently under-planning.
        queue.push({
          kind: "placeholder",
          bucketId: bucket.id,
          label: `${bucket.label} (choose any - fixed list exhausted)`,
          mc: remainingMc,
          order: order++,
        });
      }
      continue;
    }

    // No fixed list at all (code-prefix only, manual-only, or the
    // Unrestricted Electives fallback) - there's no single right module
    // to recommend, so this is a labeled placeholder, not a real pick.
    while (remainingMc > 0) {
      const chunk = Math.min(PLACEHOLDER_CHUNK_MC, remainingMc);
      queue.push({ kind: "placeholder", bucketId: bucket.id, label: bucket.label, mc: chunk, order: order++ });
      remainingMc -= chunk;
    }
  }

  const scheduledCodes = new Set(existingCodes);
  const addedEntries: AutoPlanAddedEntry[] = [];
  const flaggedUnresolved = new Set<string>();

  let slotIndex = startIndex;
  let slotMc = 0;
  const remaining: QueueItem[] = [...queue];

  const isReady = (item: QueueItem): boolean => {
    if (item.kind === "placeholder") return true;
    if (item.module.prereqTree) {
      return isTreeSatisfied(item.module.prereqTree, scheduledCodes, knownCodes);
    }
    // Fallback for a caller that only has the flattened list (no tree
    // available) - treats it as a strict AND, same as the original
    // behaviour. Prefer passing prereqTree through wherever possible.
    return item.module.prereqCodes.every(
      (code) => scheduledCodes.has(code.toUpperCase()) || !knownCodes.has(code.toUpperCase())
    );
  };

  // Picks the best item to add next: the lowest-level ready concrete
  // module that still fits the semester's remaining capacity, falling
  // back to a placeholder. Unlike a plain first-fit scan (the previous
  // version of this function), this keeps looking past an item that's
  // ready but too big for the remaining gap, instead of abandoning the
  // semester - which is what used to leave semesters at 12 MC while a
  // later one landed at 20. Placeholders (no inherent level) are always
  // ranked after a same-capacity concrete module, since NUS students
  // commonly use GE/UE credits as buffer to round out whichever semester
  // needs it, not as a fixed-position requirement.
  function pickNext(capacity: number): { idx: number; mc: number; level: number; splitRemainder?: boolean } | null {
    let best: { idx: number; mc: number; level: number } | null = null;
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (!isReady(item)) continue;
      const mc = item.kind === "concrete" ? item.module.mc : item.mc;
      if (mc > capacity) continue;
      const level = item.kind === "concrete" ? item.level : 10;
      const current = best ? remaining[best.idx] : null;
      if (!best || level < best.level || (level === best.level && current && item.order < (current.order ?? Infinity))) {
        best = { idx: i, mc, level };
      }
    }
    if (best) return best;

    // Nothing left fits whole - but a flexible placeholder (GE pillar, CS
    // Breadth & Depth, Unrestricted Electives) can be split to use up
    // exactly what's left, rather than leaving real capacity idle just
    // because PLACEHOLDER_CHUNK_MC doesn't happen to divide it evenly.
    // Concrete modules are never split - a real module's MC is fixed.
    if (capacity <= 0) return null;
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (item.kind !== "placeholder") continue;
      if (!isReady(item)) continue;
      if (item.mc > capacity) {
        return { idx: i, mc: capacity, level: 10, splitRemainder: true };
      }
    }
    return null;
  }

  while (remaining.length > 0 && slotIndex < targetTotalSemesters) {
    const capacity = SEMESTER_MC_CAP - slotMc;
    const pick = pickNext(capacity);

    if (!pick) {
      // Nothing ready fits what's left of this semester.
      const anyReady = remaining.some(isReady);
      if (!anyReady) {
        warnings.push(
          "Couldn't resolve a prerequisite order for the remaining modules - stopped the draft early rather than guess."
        );
        break;
      }
      if (slotMc > 0 && slotMc < SEMESTER_MC_FLOOR) {
        const slot = SLOTS[slotIndex];
        warnings.push(
          `Year ${slot.academicYear} Sem ${slot.semester} only reached ${slotMc} MC - nothing left fit without ` +
            `breaking a prerequisite or the ${SEMESTER_MC_CAP} MC cap.`
        );
      }
      slotIndex += 1;
      slotMc = 0;
      continue;
    }

    const item = remaining[pick.idx];
    const slot = SLOTS[slotIndex];

    if (pick.splitRemainder && item.kind === "placeholder") {
      // Take only what fits; leave the rest of this placeholder in the
      // queue (smaller now) for a later semester instead of removing it.
      addedEntries.push({
        moduleCode: null,
        label: item.label,
        mc: pick.mc,
        academicYear: slot.academicYear,
        semester: slot.semester,
        requirementTag: item.bucketId,
      });
      item.mc -= pick.mc;
      slotMc += pick.mc;
      if (slotMc >= SEMESTER_MC_CAP) {
        slotIndex += 1;
        slotMc = 0;
      }
      continue;
    }

    remaining.splice(pick.idx, 1);

    if (item.kind === "concrete") {
      addedEntries.push({
        moduleCode: item.module.moduleCode,
        label: item.module.label,
        mc: item.module.mc,
        academicYear: slot.academicYear,
        semester: slot.semester,
        requirementTag: null,
      });
      scheduledCodes.add(item.module.moduleCode.toUpperCase());
      for (const code of item.module.prereqCodes) {
        const upper = code.toUpperCase();
        if (!knownCodes.has(upper) && !flaggedUnresolved.has(upper)) {
          flaggedUnresolved.add(upper);
          warnings.push(
            `Couldn't verify prerequisite ${code} (needed for ${item.module.moduleCode}) against the rest of your plan - assumed you'll have it.`
          );
        }
      }
    } else {
      addedEntries.push({
        moduleCode: null,
        label: item.label,
        mc: item.mc,
        academicYear: slot.academicYear,
        semester: slot.semester,
        requirementTag: item.bucketId,
      });
    }

    slotMc += pick.mc;

    if (slotMc >= SEMESTER_MC_CAP) {
      slotIndex += 1;
      slotMc = 0;
    }
  }

  if (remaining.length > 0) {
    const leftoverMc = remaining.reduce((s, i) => s + (i.kind === "concrete" ? i.module.mc : i.mc), 0);
    warnings.push(
      `About ${leftoverMc} MC doesn't fit within your chosen timeline - consider a longer one, or a heavier semester load.`
    );
  }

  return { addedEntries, warnings };
}

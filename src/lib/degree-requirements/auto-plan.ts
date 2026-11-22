import type { DegreeStructure } from "./types";
import { bucketPlannerEntries, type PlannableEntry } from "./bucket";

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
  // Flattened prereq codes (see flattenPrereqTree) - a best-effort list,
  // not a full and/or evaluation. Good enough to order "take this before
  // that", not a guarantee every real prerequisite rule is satisfied.
  prereqCodes: string[];
};

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
const PLACEHOLDER_CHUNK_MC = 8;

type QueueItem =
  | { kind: "concrete"; module: AutoPlanCandidateModule }
  | { kind: "placeholder"; bucketId: string; label: string; mc: number };

function slotIndexOf(academicYear: number, semester: number): number {
  return SLOTS.findIndex((s) => s.academicYear === academicYear && s.semester === semester);
}

// Builds a draft plan for every semester after the furthest one that
// already has something in it, filling fixed-list requirements first (in
// a best-effort prereq order) and generic placeholders for buckets that
// have no single right module (GE pillars, CS Breadth & Depth, ID/CD,
// Unrestricted Electives) - this is a draft to react to, not a guarantee;
// it only resolves prereqs it has data for.
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
        queue.push({ kind: "concrete", module: candidate });
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
        });
      }
      continue;
    }

    // No fixed list at all (code-prefix only, manual-only, or the
    // Unrestricted Electives fallback) - there's no single right module
    // to recommend, so this is a labeled placeholder, not a real pick.
    while (remainingMc > 0) {
      const chunk = Math.min(PLACEHOLDER_CHUNK_MC, remainingMc);
      queue.push({ kind: "placeholder", bucketId: bucket.id, label: bucket.label, mc: chunk });
      remainingMc -= chunk;
    }
  }

  const scheduledCodes = new Set(existingCodes);
  const addedEntries: AutoPlanAddedEntry[] = [];
  const flaggedUnresolved = new Set<string>();

  let slotIndex = startIndex;
  let slotMc = 0;
  let remaining = [...queue];

  while (remaining.length > 0 && slotIndex < targetTotalSemesters) {
    const readyIdx = remaining.findIndex((item) => {
      if (item.kind === "placeholder") return true;
      return item.module.prereqCodes.every(
        (code) => scheduledCodes.has(code.toUpperCase()) || !knownCodes.has(code.toUpperCase())
      );
    });

    if (readyIdx === -1) {
      warnings.push(
        "Couldn't resolve a prerequisite order for the remaining modules - stopped the draft early rather than guess."
      );
      break;
    }

    const item = remaining[readyIdx];
    const mc = item.kind === "concrete" ? item.module.mc : item.mc;

    if (slotMc > 0 && slotMc + mc > SEMESTER_MC_CAP) {
      slotIndex += 1;
      slotMc = 0;
      if (slotIndex >= targetTotalSemesters) break;
      continue;
    }

    remaining.splice(readyIdx, 1);
    const slot = SLOTS[slotIndex];

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

    slotMc += mc;
  }

  if (remaining.length > 0) {
    const leftoverMc = remaining.reduce((s, i) => s + (i.kind === "concrete" ? i.module.mc : i.mc), 0);
    warnings.push(
      `About ${leftoverMc} MC doesn't fit within your chosen timeline - consider a longer one, or a heavier semester load.`
    );
  }

  return { addedEntries, warnings };
}

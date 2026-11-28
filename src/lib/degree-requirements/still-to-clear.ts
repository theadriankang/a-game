import type { DegreeStructure } from "./types";
import { bucketPlannerEntries, type PlannableEntry } from "./bucket";

// A single compulsory module the student hasn't put in their plan yet,
// specific enough to drag straight into a semester - as opposed to the
// buckets this doesn't cover (code-prefix pools like "any GEC module",
// manual-only buckets like CS Breadth & Depth, and Unrestricted Electives),
// which have no one right module to name, so the "Still to clear" rail
// simply has nothing to show for them. This is the forward-looking
// counterpart to the prereq-hover feature: that one tells you what a
// module needs behind it, this tells you what the degree still needs
// ahead of you.
export type StillToClearItem = {
  bucketId: string;
  bucketLabel: string;
  group: string;
  moduleCode: string;
};

// Walks each fixed-list bucket's module codes in the order the degree
// structure declares them, skipping whatever's already in the plan,
// stopping once the bucket's requiredMc is met - the same rule
// buildAutoPlan uses for fixed-list buckets, just without the scheduling
// half (no slots, no prereq ordering): this only answers "what's left",
// not "when to take it". That keeps a pick-one bucket (e.g. Digital
// Literacy: CS1101S or UTC2851) from listing both once either one is
// already planned, while a take-all bucket (CS Foundation) lists every
// code not yet in the plan.
export function computeStillToClear<T extends PlannableEntry>(
  entries: T[],
  structure: DegreeStructure
): StillToClearItem[] {
  const progress = bucketPlannerEntries(entries, structure);
  const progressById = new Map(progress.map((p) => [p.bucketId, p]));
  const existingCodes = new Set(
    entries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
  );

  const items: StillToClearItem[] = [];

  for (const bucket of structure.buckets) {
    if (!bucket.moduleCodes || bucket.moduleCodes.length === 0) continue;

    const prog = progressById.get(bucket.id);
    const satisfiedMc = (prog?.completedMc ?? 0) + (prog?.plannedMc ?? 0);
    let remainingMc = Math.max(bucket.requiredMc - satisfiedMc, 0);
    if (remainingMc <= 0) continue;

    for (const code of bucket.moduleCodes) {
      if (remainingMc <= 0) break;
      const upper = code.toUpperCase();
      if (existingCodes.has(upper)) continue;
      items.push({ bucketId: bucket.id, bucketLabel: bucket.label, group: bucket.group, moduleCode: upper });
      // A fixed list's own MC isn't known here (that's NUSMods data, fetched by the
      // caller) - assume a standard 4 MC module for the purpose of deciding how many
      // more codes this bucket still has room for. Good enough for every bucket this
      // app currently has (CS Foundation and Math & Sciences are both all-4MC lists);
      // worth revisiting if a future bucket mixes in a non-4MC fixed module.
      remainingMc -= 4;
    }
  }

  return items;
}

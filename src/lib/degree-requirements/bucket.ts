import type { DegreeStructure, RequirementBucketDef } from "./types";

// Shape of what we need from a PlannerEntry — kept minimal and structural
// (rather than importing the Prisma model type) so this stays testable
// without a database.
export type PlannableEntry = {
  moduleCode: string | null;
  mc: number;
  status: "COMPLETED" | "PLANNED" | "RESERVED";
  requirementTag: string | null;
};

export type BucketProgress = {
  bucketId: string;
  label: string;
  group: string;
  requiredMc: number;
  completedMc: number;
  plannedMc: number;
  reservedMc: number;
  entries: PlannableEntry[];
};

function findBucketForEntry(
  entry: PlannableEntry,
  buckets: RequirementBucketDef[],
  fallbackBucketId: string
): string {
  // A manually-set requirementTag always wins, as long as it names a real
  // bucket — this is how modules in a manual-only bucket (CS Breadth &
  // Depth, ID/CD) get counted at all.
  if (entry.requirementTag && buckets.some((b) => b.id === entry.requirementTag)) {
    return entry.requirementTag;
  }

  const code = entry.moduleCode?.toUpperCase();
  if (code) {
    for (const bucket of buckets) {
      if (bucket.manualOnly) continue;
      if (bucket.moduleCodes?.includes(code)) return bucket.id;
      if (bucket.codePrefixes?.some((prefix) => code.startsWith(prefix))) {
        return bucket.id;
      }
    }
  }

  return fallbackBucketId;
}

export function bucketPlannerEntries(
  entries: PlannableEntry[],
  structure: DegreeStructure
): BucketProgress[] {
  const progress = new Map<string, BucketProgress>(
    structure.buckets.map((bucket) => [
      bucket.id,
      {
        bucketId: bucket.id,
        label: bucket.label,
        group: bucket.group,
        requiredMc: bucket.requiredMc,
        completedMc: 0,
        plannedMc: 0,
        reservedMc: 0,
        entries: [],
      },
    ])
  );

  for (const entry of entries) {
    const bucketId = findBucketForEntry(
      entry,
      structure.buckets,
      structure.fallbackBucketId
    );
    const bucket = progress.get(bucketId);
    if (!bucket) continue; // requirementTag pointed at a bucket that no longer exists

    bucket.entries.push(entry);
    if (entry.status === "COMPLETED") bucket.completedMc += entry.mc;
    else if (entry.status === "PLANNED") bucket.plannedMc += entry.mc;
    else bucket.reservedMc += entry.mc;
  }

  return Array.from(progress.values());
}

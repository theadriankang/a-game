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

export type BucketProgress<T extends PlannableEntry = PlannableEntry> = {
  bucketId: string;
  label: string;
  group: string;
  requiredMc: number;
  completedMc: number;
  plannedMc: number;
  reservedMc: number;
  entries: T[];
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

export function bucketPlannerEntries<T extends PlannableEntry>(
  entries: T[],
  structure: DegreeStructure
): BucketProgress<T>[] {
  const progress = new Map<string, BucketProgress<T>>(
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
        entries: [] as T[],
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

// Used by the community-signal feature to decide whether a module should
// be auto-queued for analysis as AUTO_COMPULSORY (it's one of the degree's
// specifically-named required modules) vs AUTO_PLANNED (anything else a
// user adds to their plan). Deliberately only matches a bucket's fixed
// `moduleCodes` list, not `codePrefixes` — a prefix match (e.g. any
// GEC-coded module) is an elective pool, not a specifically compulsory
// module, so it doesn't count as "compulsory" here.
export function isCompulsoryModuleCode(
  moduleCode: string,
  structure: DegreeStructure
): boolean {
  const code = moduleCode.toUpperCase();
  return structure.buckets.some(
    (bucket) => !bucket.manualOnly && bucket.moduleCodes?.includes(code)
  );
}

// A short, human-readable description of what counts toward a bucket -
// shown in the sidebar so a student can tell at a glance which module
// codes to look out for, without having to guess from the bucket name.
export function describeBucketMatch(bucket: RequirementBucketDef): string {
  if (bucket.manualOnly) return "Set manually - no fixed code list";

  const parts: string[] = [];
  if (bucket.moduleCodes?.length) parts.push(bucket.moduleCodes.join(", "));
  if (bucket.codePrefixes?.length) {
    parts.push(bucket.codePrefixes.map((prefix) => `${prefix}-prefixed`).join(" or "));
  }
  return parts.length > 0 ? parts.join(" · ") : "Any module not counted elsewhere";
}

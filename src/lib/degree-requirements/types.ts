// A degree's requirement structure, broken into leaf "buckets" a module can
// count toward. Grouped for display (Common Curriculum / Programme
// Requirements / Unrestricted Electives), but matching works at the leaf
// level — a module belongs to exactly one leaf bucket.
export type RequirementBucketDef = {
  id: string;
  label: string;
  group: string;
  requiredMc: number;
  // Fixed, enumerable module codes for this bucket (e.g. the CS Foundation
  // list). Matched case-insensitively against a planner entry's moduleCode.
  moduleCodes?: string[];
  // Prefixes for bucket families that aren't a fixed list (e.g. any
  // GEC-prefixed module satisfies Cultures & Connections).
  codePrefixes?: string[];
  // True for buckets that can't be matched automatically from a module
  // code at all (e.g. CS Breadth & Depth depends on a student's chosen
  // focus area) — these rely entirely on a manually-set requirementTag.
  manualOnly?: boolean;
};

export type DegreeStructure = {
  id: string;
  label: string;
  totalMc: number;
  buckets: RequirementBucketDef[];
  // The bucket id anything unmatched falls into.
  fallbackBucketId: string;
};

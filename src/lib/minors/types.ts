// A minor's requirements, broken into groups a module can count toward.
// Deliberately simpler than the degree-requirement bucket model: each
// group just needs a total MC sum from its listed codes/prefixes, rather
// than an exact "pick N courses" count - the two are usually equivalent
// since most NUS modules in these lists are 4 MC each, and a simple MC
// sum is easier to show progress against.
export type MinorRequirementGroup = {
  id: string;
  label: string;
  requiredMc: number;
  moduleCodes?: string[];
  codePrefixes?: string[];
  // Codes to exclude even though they'd otherwise match a codePrefix
  // (e.g. MA1301/MA1301X are MA1xxx-coded but excluded from the
  // Mathematics minor's Level 1000 group).
  excludeCodes?: string[];
};

// How a student goes about getting the programme (see ApplicationSchema in src/lib/programmes/schema.ts).
export type ProgrammeApplication = {
  type: "apply" | "declare";
  steps: string[];
  deadline?: string | null;
  url?: string | null;
};

export type MinorStructure = {
  id: string;
  label: string;
  // "second-major" structures are modeled with the same shape (groups of
  // MC requirements) but represent a much larger commitment - kept
  // visually separate in the UI rather than mixed in with minors. A
  // "specialisation" (e.g. a CS focus area) sits inside a primary
  // programme rather than adding to it.
  kind?: "minor" | "second-major" | "specialisation";
  department: string;
  totalMcMin: number;
  totalMcMax?: number;
  groups: MinorRequirementGroup[];
  // NUS official programme names (without the "(Faculty)" suffix the
  // onboarding form appends) that are barred from this minor. Matched as
  // a prefix against the user's stored programme string, so it still
  // matches regardless of the faculty suffix.
  excludedProgrammePrefixes: string[];
  // When non-empty, only students whose programme starts with one of these
  // can take it (a focus area open to one degree only).
  eligibleProgrammePrefixes?: string[];
  application?: ProgrammeApplication | null;
  sourceUrl: string;
  sourceCheckedDate: string;
  // Which intake the source applies to, as it states it (e.g. "Cohorts 2021/22 onwards").
  cohortNote?: string | null;
  // Intakes that can take it (matriculation years; AY2026/27 = 2026). null/absent = no limit on that side.
  cohortFrom?: number | null;
  cohortTo?: number | null;
  // Anything found while reading the source that was ambiguous,
  // inconsistent, or not fully confirmed - shown in the UI rather than
  // silently assumed correct. This data hasn't been double-checked by a
  // second pass yet (see architecture doc) - treat it as a strong
  // starting point, not a substitute for confirming with the department
  // before declaring a minor.
  caveats?: string[];
};

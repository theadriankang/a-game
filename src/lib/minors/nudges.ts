import { assessCloseness, rankNudges } from "./closeness";
import { computeMinorFit, type MinorFitEntry } from "./fit";
import type { MinorStructure, ProgrammeApplication } from "./types";

// Modules listed per requirement before "+N more": enough to act on, short enough to read.
const MAX_OPTIONS = 6;

// One requirement the student still has to meet, in terms they can act on.
export type UnmetRequirement = {
  label: string;
  remainingMc: number;
  // Modules that would count and aren't already in the plan, in the order the source lists them.
  options: string[];
  // How many more such modules there are beyond `options`.
  moreOptions: number;
  // Code patterns that count, for requirements the source gives as a pattern rather than a list ("CS3xxx").
  patterns: string[];
};

// What the planner needs to raise a programme with the student: plain data
// only, so it can cross the server -> client component boundary as a prop.
export type ProgrammeNudge = {
  id: string;
  label: string;
  kind: "minor" | "second-major" | "specialisation";
  department: string;
  tier: "qualifies" | "close";
  countedMc: number;
  requiredMc: number;
  remainingMc: number;
  modulesAway: number;
  dependsOnPlanned: boolean;
  // What's left to take; empty when the plan already covers it.
  requirements: UnmetRequirement[];
  // How to apply or declare, as the source states it; null when it doesn't say.
  application: ProgrammeApplication | null;
  sourceUrl: string;
  // How many things the source left ambiguous (shown on the Minors page).
  caveatCount: number;
};

// "ST32" -> "ST32xx", "CS3" -> "CS3xxx": a 2-4 letter prefix plus four digits.
export function prefixPattern(prefix: string): string {
  const letters = prefix.match(/^[A-Z]+/)?.[0].length ?? prefix.length;
  return prefix.padEnd(letters + 4, "x");
}

function unmetRequirements(
  programme: MinorStructure,
  unmet: { groupId: string; label: string; remainingMc: number }[],
  inPlan: Set<string>
): UnmetRequirement[] {
  return unmet.map((u) => {
    const group = programme.groups.find((g) => g.id === u.groupId);
    const excluded = new Set(group?.excludeCodes ?? []);
    const candidates = (group?.moduleCodes ?? []).filter((c) => !inPlan.has(c) && !excluded.has(c));
    return {
      label: u.label,
      remainingMc: u.remainingMc,
      options: candidates.slice(0, MAX_OPTIONS),
      moreOptions: Math.max(0, candidates.length - MAX_OPTIONS),
      patterns: (group?.codePrefixes ?? []).map(prefixPattern),
    };
  });
}

// A source can ask for more MC than it breaks into modules we can list (an elective list we couldn't read, "approved
// courses"). That gap still has to be taken, so it's shown as its own line rather than leaving the student told that
// nothing is left.
function withUnlistedMc(requirements: UnmetRequirement[], remainingMc: number): UnmetRequirement[] {
  const unlisted = remainingMc - requirements.reduce((sum, r) => sum + r.remainingMc, 0);
  if (unlisted <= 0) return requirements;
  return [
    ...requirements,
    { label: "More the source asks for but doesn't list as modules (see the official page)", remainingMc: unlisted, options: [], moreOptions: 0, patterns: [] },
  ];
}

// Takes the programmes as an argument (rather than importing the registry)
// so the same code can run over a database-loaded list later.
export function computeProgrammeNudges(
  entries: MinorFitEntry[],
  programmes: MinorStructure[],
  userProgramme: string | null | undefined,
  matriculationYear?: number | null
): ProgrammeNudge[] {
  const inPlan = new Set(entries.flatMap((e) => (e.moduleCode ? [e.moduleCode.toUpperCase()] : [])));

  const assessed = programmes.map((programme) => {
    const fit = computeMinorFit(entries, programme, userProgramme, matriculationYear);
    return { fit, closeness: assessCloseness(fit) };
  });

  return rankNudges(assessed).map(({ fit, closeness }) => ({
    id: fit.minor.id,
    label: fit.minor.label,
    kind: fit.minor.kind ?? "minor",
    department: fit.minor.department,
    tier: closeness.tier as "qualifies" | "close",
    countedMc: closeness.countedMc,
    requiredMc: closeness.requiredMc,
    remainingMc: closeness.remainingMc,
    modulesAway: closeness.modulesAway,
    dependsOnPlanned: closeness.dependsOnPlanned,
    requirements: withUnlistedMc(unmetRequirements(fit.minor, closeness.unmetGroups, inPlan), closeness.remainingMc),
    application: fit.minor.application ?? null,
    sourceUrl: fit.minor.sourceUrl,
    caveatCount: fit.minor.caveats?.length ?? 0,
  }));
}

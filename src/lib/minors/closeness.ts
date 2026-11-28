import type { MinorFit } from "./fit";

// How near a student is to finishing a minor / second major, and whether
// that's near enough to nudge them about it.
//
// "Close" is judged on MC still missing, not on percent complete: 80% of a
// 20 MC minor is one module away, 80% of a 40 MC second major is two, and a
// percentage can't tell those apart from "80% of a degree" (eight modules).
// A minimum fraction on top stops a tiny programme from counting as "close"
// when the student has barely started it.
export const CLOSENESS_THRESHOLDS = {
  minor: { maxRemainingMc: 8, minFraction: 0.5 },
  "second-major": { maxRemainingMc: 12, minFraction: 0.5 },
  // A focus area is about the size of a minor (3 courses), so it's judged the same way.
  specialisation: { maxRemainingMc: 8, minFraction: 0.5 },
} as const;

// Most NUS modules are 4 MC; used only to turn "MC left" into a rough
// "about N modules" for display.
const TYPICAL_MODULE_MC = 4;

export type ClosenessTier =
  // Every requirement is already met by completed + planned modules.
  | "qualifies"
  // Within the threshold above, so worth raising with the student.
  | "close"
  // Real progress is possible but not near enough to nudge about.
  | "far"
  // The student's own programme bars them from it.
  | "ineligible";

export type UnmetGroup = { groupId: string; label: string; remainingMc: number };

export type Closeness = {
  tier: ClosenessTier;
  // Completed + planned MC that count toward the programme (each group
  // capped at what it asks for, so surplus modules don't inflate this).
  countedMc: number;
  requiredMc: number;
  remainingMc: number;
  fraction: number;
  // True when the requirements are covered only because of modules still
  // planned - nothing is guaranteed until they're actually taken.
  dependsOnPlanned: boolean;
  unmetGroups: UnmetGroup[];
  // Rough count, assuming 4 MC modules.
  modulesAway: number;
};

export function assessCloseness(fit: MinorFit): Closeness {
  const requiredMc = fit.totalRequiredMc;
  const countedMc = fit.totalCompletedMc + fit.totalPlannedMc;

  const unmetGroups: UnmetGroup[] = fit.groups
    .map((g) => ({
      groupId: g.groupId,
      label: g.label,
      remainingMc: Math.max(0, g.requiredMc - (g.completedMc + g.plannedMc)),
    }))
    .filter((g) => g.remainingMc > 0);

  // Group requirements can add up to more than the programme's headline
  // minimum (or less, if a source was ambiguous), so take whichever view says
  // more is still missing rather than trusting one of them.
  const remainingMc = Math.max(
    unmetGroups.reduce((sum, g) => sum + g.remainingMc, 0),
    Math.max(0, requiredMc - countedMc)
  );
  const fraction = requiredMc > 0 ? Math.min(1, (requiredMc - remainingMc) / requiredMc) : 0;
  const modulesAway = unmetGroups.reduce((sum, g) => sum + Math.ceil(g.remainingMc / TYPICAL_MODULE_MC), 0);

  const completedRemaining = Math.max(
    fit.groups.reduce((sum, g) => sum + Math.max(0, g.requiredMc - g.completedMc), 0),
    Math.max(0, requiredMc - fit.totalCompletedMc)
  );

  const threshold = CLOSENESS_THRESHOLDS[fit.minor.kind ?? "minor"];
  let tier: ClosenessTier;
  if (!fit.eligible) tier = "ineligible";
  else if (remainingMc === 0) tier = "qualifies";
  else if (remainingMc <= threshold.maxRemainingMc && fraction >= threshold.minFraction) tier = "close";
  else tier = "far";

  return {
    tier,
    countedMc,
    requiredMc,
    remainingMc,
    fraction,
    dependsOnPlanned: remainingMc === 0 && completedRemaining > 0,
    unmetGroups,
    modulesAway,
  };
}

const TIER_ORDER: Record<ClosenessTier, number> = { qualifies: 0, close: 1, far: 2, ineligible: 3 };

// For listing every programme (the Minors page): nearest first, programmes
// the student can't take last. Stable, so equally-near ones keep their
// registry order.
export function sortByCloseness(fits: MinorFit[]): MinorFit[] {
  return fits
    .map((fit) => ({ fit, closeness: assessCloseness(fit) }))
    .sort(
      (a, b) =>
        TIER_ORDER[a.closeness.tier] - TIER_ORDER[b.closeness.tier] ||
        a.closeness.remainingMc - b.closeness.remainingMc
    )
    .map(({ fit }) => fit);
}

// Programmes worth raising with the student, best first: ones their plan
// already covers, then the fewest MC away.
export function rankNudges<T extends { fit: MinorFit; closeness: Closeness }>(items: T[]): T[] {
  return items
    .filter((i) => i.closeness.tier === "qualifies" || i.closeness.tier === "close")
    .sort((a, b) => {
      const aQ = a.closeness.tier === "qualifies" ? 0 : 1;
      const bQ = b.closeness.tier === "qualifies" ? 0 : 1;
      return aQ - bQ || a.closeness.remainingMc - b.closeness.remainingMc;
    });
}

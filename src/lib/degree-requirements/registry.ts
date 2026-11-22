import type { DegreeStructure } from "./types";
import { bcompCs } from "./bcomp-cs";

// Keyed by the exact "<programme> (<faculty>)" string the onboarding form
// saves on User.programme (see app/onboarding/onboarding-form.tsx). Only
// programmes with a real, bucketed requirement breakdown modeled from the
// NUS Bulletin go here — see the architecture doc's open item on this:
// everything else falls back to a generic "track total MC only" structure
// below until someone builds out that programme's own bucket list.
const DEGREE_STRUCTURES: Record<string, DegreeStructure> = {
  "Bachelor of Computing in Computer Science (School of Computing)": bcompCs,
};

// Conservative default for NUS undergraduate programmes without a modeled
// structure yet — most 4-year programmes total 160 MC, so this is a
// reasonable placeholder, not a precise per-programme figure. Flagged
// clearly in the label so it reads as "not yet modeled", not as real data.
const GENERIC_TOTAL_MC = 160;

function genericStructure(programme: string): DegreeStructure {
  return {
    id: "generic",
    label: `${programme} (requirement breakdown not yet modeled)`,
    totalMc: GENERIC_TOTAL_MC,
    fallbackBucketId: "all-modules",
    buckets: [
      {
        id: "all-modules",
        label: "All modules (not yet broken down by requirement)",
        group: "Programme Requirements",
        requiredMc: GENERIC_TOTAL_MC,
      },
    ],
  };
}

// Resolves a user's stored `programme` string to its requirement
// structure. Only BComp CS has a real bucketed breakdown so far - anyone
// else gets a generic structure that still tracks total MC progress
// correctly, rather than silently being shown someone else's degree's
// requirements (the bug this replaces: everything used to be hardcoded to
// bcompCs regardless of what a user picked at onboarding).
export function getDegreeStructureForProgramme(
  programme: string | null | undefined
): DegreeStructure {
  if (programme && DEGREE_STRUCTURES[programme]) {
    return DEGREE_STRUCTURES[programme];
  }
  return genericStructure(programme ?? "Your programme");
}

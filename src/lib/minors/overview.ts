import { sortByCloseness } from "./closeness";
import { computeMinorFit, type MinorFit, type MinorFitEntry } from "./fit";
import type { MinorStructure } from "./types";

// What the Minors page shows a student: the programmes open to them, by kind and nearest first, and separately
// everything that isn't open to them, so the page can say so (and why) instead of silently leaving them out.
export type ProgrammeOverview = {
  minors: MinorFit[];
  secondMajors: MinorFit[];
  specialisations: MinorFit[];
  closed: MinorFit[];
};

export function buildOverview(
  entries: MinorFitEntry[],
  programmes: MinorStructure[],
  userProgramme: string | null | undefined,
  matriculationYear?: number | null
): ProgrammeOverview {
  const fits = programmes.map((programme) => computeMinorFit(entries, programme, userProgramme, matriculationYear));
  const open = fits.filter((fit) => fit.eligible);
  const ofKind = (kind: "minor" | "second-major" | "specialisation") =>
    sortByCloseness(open.filter((fit) => (fit.minor.kind ?? "minor") === kind));

  return {
    minors: ofKind("minor"),
    secondMajors: ofKind("second-major"),
    specialisations: ofKind("specialisation"),
    closed: fits.filter((fit) => !fit.eligible),
  };
}

// How many S/U ("grade-free scheme") units a student gets, from NUS's published rules:
//  - Registrar, "Continuation and Graduation Requirements" -> Satisfactory/Unsatisfactory (S/U) Option
//  - Faculty APC pages (Science, FASS, CDE) -> the "APC option exercise"
// Only the total is stored on the user; the split below is for explaining it.

export type PriorUniversity = "none" | "credits" | "degree";

export type SuInputs = {
  faculty: string;
  programme: string;
  /** Start year of the intake academic year (2026 for AY2026/27). */
  matriculationYear: number;
  /** All advanced placement credits granted at admission, in units. */
  apcUnits: number;
  /** Of those, the unrestricted-elective credits (the 20 every polytechnic diploma holder gets). */
  ueApcUnits: number;
  priorUniversity: PriorUniversity;
  /** Whether the student chooses to give up their 20 elective APC units for 12 more S/U units. */
  takesApcOption: boolean;
};

export type SuBasis = "not-applicable" | "degree" | "prior-credits" | "apc" | "standard";

export type SuBudget = {
  basis: SuBasis;
  /** False when the scheme doesn't cover the programme or student at all. */
  applies: boolean;
  total: number;
  /** Units that can only be used on courses finished in the first year / first two years. */
  firstYearUnits: number;
  /** Units usable on courses finished at any time. */
  anytimeUnits: number;
  firstYearWindow: "first year" | "first two years";
  apcOptionEligible: boolean;
  apcOptionApplied: boolean;
};

export const APC_OPTION_EXTRA_UNITS = 12;

/**
 * Every polytechnic diploma holder is granted 20 units of unrestricted-elective APCs automatically (stated by
 * Computing, Science, FASS, Business and CDE alike), whether or not we hold their faculty's exemption list.
 */
export const POLYTECHNIC_AUTOMATIC_UE_UNITS = 20;

export type CreditedModule = { mc: number | null; kind: "PROGRAMME" | "UNRESTRICTED_ELECTIVE" | null };

/**
 * Total APC units, and how many of them are elective credit, for a student.
 * A polytechnic diploma always counts for the automatic 20 elective units; any elective credit we do know about
 * (a generic "20 units" line, or module-coded elective credit like Science's POY codes) is the same credit, not
 * extra, so the elective total is the larger of the two. Everything else is programme-requirement credit.
 */
export function totalApcUnits(opts: {
  polytechnicDiploma: boolean;
  /** generic elective credit from a faculty list (no module code) */
  genericUeUnits: number;
  /** every module in the student's confirmed exemptions */
  modules: CreditedModule[];
}): { apcUnits: number; ueApcUnits: number } {
  const known = (m: CreditedModule) => m.mc ?? 0;
  const ueFromData =
    opts.genericUeUnits + opts.modules.filter((m) => m.kind === "UNRESTRICTED_ELECTIVE").reduce((n, m) => n + known(m), 0);
  const ueApcUnits = opts.polytechnicDiploma ? Math.max(POLYTECHNIC_AUTOMATIC_UE_UNITS, ueFromData) : ueFromData;
  const otherUnits = opts.modules.filter((m) => m.kind !== "UNRESTRICTED_ELECTIVE").reduce((n, m) => n + known(m), 0);
  return { apcUnits: ueApcUnits + otherUnits, ueApcUnits };
}

/** "Not applicable to undergraduate students from Dentistry, Law, Medicine (except Nursing)". */
export function schemeCoversProgramme(faculty: string, programme: string): boolean {
  if (faculty === "Faculty of Dentistry" || faculty === "Faculty of Law") return false;
  if (faculty === "Yong Loo Lin School of Medicine" && !/nursing/i.test(programme)) return false;
  return true;
}

export function computeSuBudget(i: SuInputs): SuBudget {
  // From the AY2025/26 intake the first-year units can be used across the first two years.
  const firstYearWindow = i.matriculationYear >= 2025 ? "first two years" : "first year";
  const none = (basis: SuBasis): SuBudget => ({
    basis,
    applies: false,
    total: 0,
    firstYearUnits: 0,
    anytimeUnits: 0,
    firstYearWindow,
    apcOptionEligible: false,
    apcOptionApplied: false,
  });

  if (!schemeCoversProgramme(i.faculty, i.programme)) return none("not-applicable");
  if (i.priorUniversity === "degree") return none("degree");

  let basis: SuBasis;
  let firstYearUnits: number;
  let anytimeUnits: number;
  if (i.priorUniversity === "credits") {
    basis = "prior-credits"; // "up to 12 units ... anytime during their candidature"
    firstYearUnits = 0;
    anytimeUnits = 12;
  } else if (i.apcUnits >= 20) {
    basis = "apc"; // 20 or more APCs: 20 units, 8 of them first-year units
    firstYearUnits = 8;
    anytimeUnits = 12;
  } else {
    basis = "standard"; // 32 units, 20 of them first-year units
    firstYearUnits = 20;
    anytimeUnits = 12;
  }

  // APC option: 20 elective APC units AND 20-39 APC units in all, from the AY2021/22 cohort; the extra 12 are first-year units.
  const apcOptionEligible =
    i.priorUniversity === "none" &&
    i.matriculationYear >= 2021 &&
    i.ueApcUnits >= 20 &&
    i.apcUnits >= 20 &&
    i.apcUnits <= 39;
  const apcOptionApplied = apcOptionEligible && i.takesApcOption;
  if (apcOptionApplied) firstYearUnits += APC_OPTION_EXTRA_UNITS;

  return {
    basis,
    applies: true,
    total: firstYearUnits + anytimeUnits,
    firstYearUnits,
    anytimeUnits,
    firstYearWindow,
    apcOptionEligible,
    apcOptionApplied,
  };
}

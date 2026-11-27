// How many S/U ("grade-free scheme") units a student gets, from NUS's published rules:
//  - Registrar, "Continuation and Graduation Requirements" -> Satisfactory/Unsatisfactory (S/U) Option
//  - Faculty APC pages (Science, FASS, CDE) -> the "APC option exercise"
// Only the total is stored on the user; the split below is for explaining it.

import type { ModuleInfo } from "./nusmods";

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

// --- using the budget on specific modules ---

/**
 * Whether NUS lets a module be S/U'd. NUSMods publishes the Registrar's per-module flag as `attributes.su`
 * (set on Level 1000 modules, Level 2000 modules with no NUS-module prerequisites, and a few language modules),
 * so we read it rather than guessing from the module level. Unknown or unfetched modules count as not eligible.
 */
export function isSuEligible(info: Pick<ModuleInfo, "attributes"> | null | undefined): boolean {
  return info?.attributes?.su === true;
}

/** Of a total, up to 12 MC can be used at any time; whatever is left over is first-year units. */
export const ANYTIME_UNITS = 12;

/**
 * How many planner years count as the first-year window: the first two years from the AY2025/26 intake, the
 * first year before that. Accounts with no matriculation year yet get the current rule rather than being blocked.
 */
export function firstYearWindowYears(matriculationYear: number | null | undefined): 1 | 2 {
  return matriculationYear != null && matriculationYear < 2025 ? 1 : 2;
}

export type SuEntry = { academicYear: number; mc: number };

export type SuUsage = {
  /** All MC marked S/U. */
  usedMc: number;
  /** Of those, the MC in years after the first-year window (can only come out of the any-time units). */
  laterMc: number;
};

export function suUsage(entries: SuEntry[], windowYears: number): SuUsage {
  let usedMc = 0;
  let laterMc = 0;
  for (const e of entries) {
    usedMc += e.mc;
    if (e.academicYear > windowYears) laterMc += e.mc;
  }
  return { usedMc, laterMc };
}

/**
 * Whether S/U'd modules fit in the budget. First-year units only cover modules in the window, while any-time
 * units cover everything, so a set fits when it is within the total AND what falls after the window is within
 * the any-time units. Only the total is stored, and every scheme's any-time allowance is min(12, total).
 */
export function suFits(usage: SuUsage, totalMc: number): boolean {
  return usage.usedMc <= totalMc && usage.laterMc <= Math.min(ANYTIME_UNITS, totalMc);
}

/**
 * Can `candidate` be added to the modules already S/U'd? When it can't, the reason says what the user can act on:
 * how much budget is left, or that what's left is first-year units and the candidate is too late for them.
 */
export function canUseSu(
  existing: SuEntry[],
  candidate: SuEntry,
  totalMc: number,
  windowYears: number,
): { ok: true } | { ok: false; reason: string } {
  const before = suUsage(existing, windowYears);
  const after = suUsage([...existing, candidate], windowYears);
  if (suFits(after, totalMc)) return { ok: true };

  if (after.usedMc > totalMc) {
    const left = Math.max(0, totalMc - before.usedMc);
    return {
      ok: false,
      reason:
        left === 0
          ? `You've used all ${totalMc} MC of your S/U budget.`
          : `Only ${left} MC of S/U budget left, and this module is ${candidate.mc} MC.`,
    };
  }
  const laterLeft = Math.max(0, Math.min(ANYTIME_UNITS, totalMc) - before.laterMc);
  const window = windowYears === 1 ? "year 1" : `years 1-${windowYears}`;
  return {
    ok: false,
    reason: `Your first-year S/U units only cover ${window}; after that just ${laterLeft} MC of S/U is left.`,
  };
}

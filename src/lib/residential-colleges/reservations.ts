import type { AdmissionType, CollegeStructure, CollegeSlot } from "./types";

export type CollegeReservationPlan = {
  // Slots to actually create RESERVED PlannerEntry rows for. Empty when
  // the college's full course list can't be assumed (see `prorated`).
  slots: CollegeSlot[];
  // True when NUS doesn't publish a pro-rated course list for this
  // student's situation (late joiner) - see the Bulletin's own silence on
  // this in docs/nus-rc-programme-requirements-feature-spec.md §3. In that
  // case nothing is auto-reserved; the UI should ask the student to
  // confirm their actual requirement with their college office instead of
  // the tool guessing a number the Bulletin itself doesn't give.
  prorated: boolean;
  note?: string;
};

// The UTCP (and RVRC) curriculum dropped Digital Literacy from the
// RC-taught list partway through AY2021/22 (Feb 2022) - students who
// matriculated before that intake are on the older 5-course curriculum,
// where Digital Literacy was a required 5th slot rather than optional /
// absent. Gated on matriculation year since that's the only per-user
// signal this app tracks; see feature-spec.md §2.
const CURRICULUM_CHANGE_MATRICULATION_YEAR = 2021;

const LEGACY_DIGITAL_LITERACY_SLOT: CollegeSlot = {
  id: "digital-literacy",
  label: "Digital Literacy",
  count: 1,
  mc: 4,
  bucketId: "digital-literacy",
};

// The slots a student actually needs, accounting for the pre-/post-Feb
// 2022 curriculum split. Everyone else just gets `structure.slots` as
// defined; a pre-change matriculation year gets Digital Literacy folded
// in as a required 5th slot (Acacia's optional one becomes required
// instead of adding a duplicate).
function slotsForCohort(
  structure: CollegeStructure,
  matriculationYear: number | null | undefined
): CollegeSlot[] {
  if (matriculationYear == null || matriculationYear >= CURRICULUM_CHANGE_MATRICULATION_YEAR) {
    return structure.slots;
  }
  const hasDigitalLiteracy = structure.slots.some((s) => s.id === "digital-literacy");
  return structure.slots
    .map((s) => (s.id === "digital-literacy" ? { ...s, optional: false } : s))
    .concat(hasDigitalLiteracy ? [] : [LEGACY_DIGITAL_LITERACY_SLOT]);
}

// What to pre-reserve in a student's plan for their chosen residential
// college, based on when they joined and which curriculum they're on.
// Only the full-residency freshman case has a published, fixed course
// count - a later admission gets a shortened residency (1 year if
// admitted in Sem 1, 1 semester if admitted in Sem 2) with no published
// pro-rated course list, so this deliberately does not guess one.
export function planCollegeReservations(
  structure: CollegeStructure,
  admissionType: AdmissionType,
  matriculationYear?: number | null
): CollegeReservationPlan {
  if (admissionType !== "FRESHMAN_SEM1") {
    return {
      slots: [],
      prorated: true,
      note:
        "NUS doesn't publish a fixed course list for a shortened (late-joiner) residency — nothing has been auto-reserved for this. Confirm your actual requirement with your college office, then add the right number of RESERVED slots yourself from the planner.",
    };
  }

  return {
    slots: slotsForCohort(structure, matriculationYear).filter((s) => !s.optional),
    prorated: false,
  };
}

// Human-readable summary for the onboarding preview ("here's roughly what
// you'll be reserving") - deliberately doesn't name specific module codes,
// since the real list changes every semester (see each college's caveats).
export function summarizeSlots(slots: CollegeSlot[]): string {
  return slots.map((s) => (s.count > 1 ? `${s.count}× ${s.label}` : s.label)).join(" · ");
}

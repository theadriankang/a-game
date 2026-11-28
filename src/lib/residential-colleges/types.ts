// A residential college's requirement structure. Deliberately modeled as
// generic "slots" (a Junior Seminar, an Ideas & Exposition course, a Senior
// Seminar) rather than specific module codes — each college runs several
// interchangeable options per slot per semester (e.g. Acacia alone offers
// multiple Junior Seminars in parallel, "Machines That Learn" and "Artificial
// Truth" among them), and that list turns over every semester. Modeling
// exact codes would be wrong the following term. A slot just needs "1 of
// this kind, worth 4 MC, counting toward this Common Curriculum pillar."
export type CollegeSlot = {
  id: string;
  label: string; // e.g. "Junior Seminar"
  count: number; // how many of this slot the student takes
  mc: number; // MC per course in this slot (NUS RC courses are 4 MC each)
  // The bcomp-cs.ts (or other degree structure) bucket id this slot's
  // RESERVED planner entries get tagged with via requirementTag - see
  // src/lib/degree-requirements/bucket.ts's manual-tag override. Null for
  // a slot that doesn't map onto a Common Curriculum pillar (e.g. Acacia's
  // optional Digital Literacy offering, which most students already clear
  // via their faculty and shouldn't have auto-reserved).
  bucketId: string | null;
  // True if this slot isn't auto-reserved at onboarding (shown as an FYI
  // on the college's info page instead) — e.g. Acacia's Digital Literacy
  // offering, which is optional for most faculties.
  optional?: boolean;
};

export type CollegeStructure = {
  id: string;
  label: string;
  shortLabel: string; // e.g. "Acacia" — used in compact UI (onboarding chips)
  programme: "UTCP" | "RVRC";
  logo: string; // path under /public
  // Credited per the user's request - these are the college's own crests,
  // shown next to the college name so the source is clear at a glance.
  logoCredit: string;
  description: string;
  slots: CollegeSlot[];
  // Faculty-specific substitutions: completing this college's Ideas &
  // Exposition course can stand in for the named faculty writing
  // requirement instead of double-counting. Keyed by the faculty string
  // as stored on User.programme's suffix (see onboarding-form.tsx).
  writingSubstitutions: Record<string, string>;
  sourceUrl: string;
  sourceCheckedDate: string;
  caveats: string[];
};

export type AdmissionType = "FRESHMAN_SEM1" | "CONTINUING_SEM1" | "CONTINUING_SEM2";

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  FRESHMAN_SEM1: "Freshman intake (Semester 1)",
  CONTINUING_SEM1: "Joined later, from Semester 1",
  CONTINUING_SEM2: "Joined later, from Semester 2",
};

// The I&E-for-faculty-writing-requirement table is the same across every
// UTCP college and RVRC (it's a university-level substitution, not a
// college-specific one) - shared here rather than repeated per file.
// Source: NUS Bulletin AY2026/27, Residential College Programmes >
// University Town College Programme, checked 2026-11-27.
export const UTCP_WRITING_SUBSTITUTIONS: Record<string, string> = {
  "Faculty of Arts and Social Sciences": "FAS1101 (Writing Academically)",
  "School of Computing": "ES2660 (or its AY2026/27 SoC Critique & Expression equivalent)",
  "College of Design and Engineering": "ES2631 (ES2531 for AY2019/20–AY2022/23 cohorts)",
  // Science faculty substitutes SP1541, except Pharmacy and Environmental
  // Studies - not encoded as a separate key since those two programmes
  // need a manual check regardless (see each college file's caveats).
  "Faculty of Science": "SP1541 (not Pharmacy or Environmental Studies)",
};

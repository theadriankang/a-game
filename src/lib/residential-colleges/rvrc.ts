import type { CollegeStructure } from "./types";
import { UTCP_WRITING_SUBSTITUTIONS } from "./types";

// Ridge View Residential College (RVRC) — runs its own programme (not
// UTCP), on the main Kent Ridge campus rather than UTown. Same 4-pillar
// shape as UTCP (one course per pillar) but its own course codes and
// admissions process; historically leaned Science/sustainability-focused
// intake, though open faculty-wide.
// Source: nus.edu.sg/nusbulletin/ay202627/.../ridge-view-residential-college-programme/,
// checked 2026-11-27.
export const rvrc: CollegeStructure = {
  id: "rvrc",
  label: "Ridge View Residential College",
  shortLabel: "RVRC",
  programme: "RVRC",
  logo: "/logos/rvrc.png",
  logoCredit: "Crest: rvrc.nus.edu.sg",
  description:
    "Runs its own residential programme (not UTCP), centred on sustainability and outdoor learning, on the main Kent Ridge campus.",
  slots: [
    { id: "course-cc", label: "Course — Cultures & Connections", count: 1, mc: 4, bucketId: "cultures-connections" },
    { id: "course-ce-expr", label: "Course — Critique & Expression", count: 1, mc: 4, bucketId: "critique-expression" },
    { id: "course-ss", label: "Course — Singapore Studies", count: 1, mc: 4, bucketId: "singapore-studies" },
    { id: "course-comm-eng", label: "Course — Communities & Engagement", count: 1, mc: 4, bucketId: "communities-engagement" },
  ],
  writingSubstitutions: UTCP_WRITING_SUBSTITUTIONS,
  sourceUrl: "https://www.nus.edu.sg/nusbulletin/ay202627/programmes/residential-college-programmes/ridge-view-residential-college-programme/",
  sourceCheckedDate: "2026-11-27",
  caveats: [
    "RVRC publishes no fixed course-code-to-pillar table either — one course per pillar, picked from whatever RVRC offers that semester.",
    "This structure is modeled from the same general shape UTCP uses (4 courses, 4 pillars) — RVRC's own course codes haven't been individually verified the way the UTCP colleges' have. Treat as a strong starting point, not confirmed detail.",
    "Students who can't complete the programme can petition for exemption from the remaining pillar(s) based on courses completed so far — same discretionary process as UTCP, not something this tool can compute for you.",
  ],
};

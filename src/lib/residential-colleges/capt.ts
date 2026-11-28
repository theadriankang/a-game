import type { CollegeStructure } from "./types";
import { UTCP_WRITING_SUBSTITUTIONS } from "./types";

// College of Alice & Peter Tan (CAPT) — University Town College Programme
// (UTCP). Source: nus.edu.sg/nusbulletin/ay202627/.../university-town-college-programme/,
// capt.nus.edu.sg/current-students/utcp/junior-seminars, checked 2026-11-27.
export const capt: CollegeStructure = {
  id: "capt",
  label: "College of Alice & Peter Tan",
  shortLabel: "CAPT",
  programme: "UTCP",
  logo: "/logos/capt.png",
  logoCredit: "Crest: capt.nus.edu.sg",
  description:
    "Formerly Angsana College. Runs the standard UTCP curriculum with an emphasis on active citizenship.",
  slots: [
    { id: "junior-seminar", label: "Junior Seminar", count: 1, mc: 4, bucketId: "cultures-connections" },
    { id: "ideas-exposition", label: "Ideas & Exposition", count: 1, mc: 4, bucketId: "critique-expression" },
    { id: "senior-seminar-ss", label: "Senior Seminar (Singapore Studies)", count: 1, mc: 4, bucketId: "singapore-studies" },
    { id: "senior-seminar-ce", label: "Senior Seminar (Communities & Engagement)", count: 1, mc: 4, bucketId: "communities-engagement" },
  ],
  writingSubstitutions: UTCP_WRITING_SUBSTITUTIONS,
  sourceUrl: "https://www.nus.edu.sg/nusbulletin/ay202627/programmes/residential-college-programmes/university-town-college-programme/",
  sourceCheckedDate: "2026-11-27",
  caveats: [
    "Which specific seminar fulfils which pillar changes every semester (the Bulletin doesn't publish a fixed mapping) — check CAPT's own junior/senior seminar list each term rather than assuming a particular title.",
    "Students who can't complete all 4 courses can petition for exemption from the remaining pillar(s) based on courses completed so far, approved case-by-case by the GE Pillar Chief — not something this tool can compute for you.",
  ],
};

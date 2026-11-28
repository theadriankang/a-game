import type { CollegeStructure } from "./types";
import { UTCP_WRITING_SUBSTITUTIONS } from "./types";

// Tembusu College — University Town College Programme (UTCP). The oldest
// UTCP college (opened 2010, alongside Cinnamon College/USP).
// Source: nus.edu.sg/nusbulletin/ay202627/.../university-town-college-programme/,
// tembusu.nus.edu.sg/education/{junior-seminars,senior-seminars}, checked 2026-11-27.
export const tembusu: CollegeStructure = {
  id: "tembusu",
  label: "Tembusu College",
  shortLabel: "Tembusu",
  programme: "UTCP",
  logo: "/logos/tembusu.png",
  logoCredit: "Crest: tembusu.nus.edu.sg",
  description:
    "The oldest UTCP college. Runs the standard UTCP curriculum; students may apply for a 3rd (or rarely 4th) year of residency beyond the core 2-year UTCP commitment.",
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
    "Which specific seminar fulfils which pillar changes every semester (the Bulletin doesn't publish a fixed mapping) — check Tembusu's own junior/senior seminar list each term rather than assuming a particular title.",
    "A semester on student exchange (SEP) 'stops the clock' on the 2-year residency rather than counting against it, per Tembusu's own FAQ — not confirmed whether every UTCP college does this the same way.",
    "Students who can't complete all 4 courses can petition for exemption from the remaining pillar(s) based on courses completed so far, approved case-by-case by the GE Pillar Chief — not something this tool can compute for you.",
  ],
};

import type { CollegeStructure } from "./types";
import { UTCP_WRITING_SUBSTITUTIONS } from "./types";

// Residential College 4 (RC4) — University Town College Programme (UTCP).
// Source: nus.edu.sg/nusbulletin/ay202627/.../university-town-college-programme/
// (RC4-specific preclusion note), rc4.nus.edu.sg/academic-programme and
// rc4.nus.edu.sg/faq, checked 2026-11-27.
export const rc4: CollegeStructure = {
  id: "rc4",
  label: "Residential College 4",
  shortLabel: "RC4",
  programme: "UTCP",
  logo: "/logos/rc4.png",
  logoCredit: "Crest: rc4.nus.edu.sg",
  description:
    "Runs the standard UTCP curriculum. Has one college-specific quirk: its own Junior Seminar precludes IE2141 for CDE students (see caveats).",
  slots: [
    { id: "junior-seminar", label: "Junior Seminar (UTC1702x)", count: 1, mc: 4, bucketId: "cultures-connections" },
    { id: "ideas-exposition", label: "Ideas & Exposition", count: 1, mc: 4, bucketId: "critique-expression" },
    { id: "senior-seminar-ss", label: "Senior Seminar (Singapore Studies)", count: 1, mc: 4, bucketId: "singapore-studies" },
    { id: "senior-seminar-ce", label: "Senior Seminar (Communities & Engagement)", count: 1, mc: 4, bucketId: "communities-engagement" },
  ],
  writingSubstitutions: UTCP_WRITING_SUBSTITUTIONS,
  sourceUrl: "https://www.nus.edu.sg/nusbulletin/ay202627/programmes/residential-college-programmes/university-town-college-programme/",
  sourceCheckedDate: "2026-11-27",
  caveats: [
    "RC4's own Junior Seminar (UTC1702x) precludes IE2141. CDE students who take it are exempt from IE2141 but must pick up 4 *extra* Unrestricted Elective units elsewhere to still meet the graduation unit minimum — a net unit cost, not just a pillar swap. This tool doesn't auto-add that extra UE slot; add it yourself if it applies to you.",
    "Which specific seminar fulfils which pillar changes every semester (the Bulletin doesn't publish a fixed mapping) — check RC4's own course list each term rather than assuming a particular title.",
    "Students who can't complete all 4 courses can petition for exemption from the remaining pillar(s) based on courses completed so far, approved case-by-case by the GE Pillar Chief — not something this tool can compute for you.",
  ],
};

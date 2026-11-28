import type { CollegeStructure } from "./types";
import { UTCP_WRITING_SUBSTITUTIONS } from "./types";

// Acacia College — University Town College Programme (UTCP). NUS's newest
// residential college (opened AY2025/26, in Cinnamon Wing).
// Source: nus.edu.sg/nusbulletin/ay202627/.../university-town-college-programme/,
// acacia.nus.edu.sg/courses (seminar list, checked for shape not codes),
// checked 2026-11-27.
export const acacia: CollegeStructure = {
  id: "acacia",
  label: "Acacia College",
  shortLabel: "Acacia",
  programme: "UTCP",
  logo: "/logos/acacia.png",
  logoCredit: "Crest: acacia.nus.edu.sg",
  description:
    "NUS's fifth residential college, in Cinnamon Wing. Runs the standard UTCP curriculum, and is the only UTCP college that also offers its own Digital Literacy courses.",
  slots: [
    { id: "junior-seminar", label: "Junior Seminar", count: 1, mc: 4, bucketId: "cultures-connections" },
    { id: "ideas-exposition", label: "Ideas & Exposition", count: 1, mc: 4, bucketId: "critique-expression" },
    { id: "senior-seminar-ss", label: "Senior Seminar (Singapore Studies)", count: 1, mc: 4, bucketId: "singapore-studies" },
    { id: "senior-seminar-ce", label: "Senior Seminar (Communities & Engagement)", count: 1, mc: 4, bucketId: "communities-engagement" },
    {
      id: "digital-literacy",
      label: "Digital Literacy (Acacia-offered)",
      count: 1,
      mc: 4,
      bucketId: "digital-literacy",
      optional: true,
    },
  ],
  writingSubstitutions: UTCP_WRITING_SUBSTITUTIONS,
  sourceUrl: "https://www.nus.edu.sg/nusbulletin/ay202627/programmes/residential-college-programmes/university-town-college-programme/",
  sourceCheckedDate: "2026-11-27",
  caveats: [
    "Acacia is the only UTCP college offering its own Digital Literacy courses — but most faculties (including SoC, via CS1101S) already clear this pillar elsewhere, so it isn't auto-reserved. Only take it if your own Digital Literacy requirement is still open.",
    "Which specific seminar fulfils which pillar changes every semester (the Bulletin doesn't publish a fixed mapping) — check Acacia's own course list each term rather than assuming a particular title.",
    "Students who can't complete all 4 courses can petition for exemption from the remaining pillar(s) based on courses completed so far, approved case-by-case by the GE Pillar Chief — not something this tool can compute for you.",
  ],
};

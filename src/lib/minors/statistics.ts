import type { MinorStructure } from "./types";

// Dept of Data Science & Statistics, Minor in Statistics. Cohorts
// AY2021/2022 onwards. Source:
// stat.nus.edu.sg/wp-content/uploads/.../STMIN-AY21-22-after_updated-July-2026.pdf,
// checked 2026-11-23.
export const minorStatistics: MinorStructure = {
  id: "minor-statistics",
  label: "Minor in Statistics",
  department: "Data Science & Statistics",
  totalMcMin: 20,
  groups: [
    {
      id: "level-1000",
      label: "Level 1000 (required)",
      requiredMc: 4,
      moduleCodes: ["ST1131"],
    },
    {
      id: "calculus",
      label: "Calculus (choose one)",
      requiredMc: 4,
      moduleCodes: ["MA1312", "MA1505", "MA1511", "MA1512", "MA1521", "MA2002"],
    },
    {
      id: "probability",
      label: "Probability (choose one)",
      requiredMc: 4,
      moduleCodes: ["ST2131", "MA2116", "MA2116T", "ST2334"],
    },
    {
      id: "stats-methods",
      label: "Statistical methods (choose one)",
      requiredMc: 4,
      moduleCodes: ["ST2132", "ST2137"],
    },
    {
      id: "level-3000",
      label: "Level 3000 (choose one)",
      requiredMc: 4,
      moduleCodes: ["ST3131"],
      codePrefixes: ["ST32"],
      excludeCodes: ["ST3280", "ST3281", "ST3282", "ST3283", "ST3284", "ST3285", "ST3286", "ST3287", "ST3288", "ST3289"],
    },
  ],
  excludedProgrammePrefixes: [
    "Bachelor of Science in Statistics",
    "Bachelor of Science in Data Science and Analytics",
  ],
  sourceUrl: "https://www.stat.nus.edu.sg/wp-content/uploads/sites/8/2026/07/STMIN-AY21-22-after_updated-July-2026.pdf",
  sourceCheckedDate: "2026-11-23",
  caveats: [
    "MA1511/MA1512 (Engineering Calculus + Differential Equations) are only open to Engineering students - not a realistic option for most students, kept here only because the source PDF lists it.",
    "The source PDF's own \"22-24 units\" heading for the Level 2000 row doesn't match its cumulative-MC column (which implies 20 total) - used the consistent 20 MC total, but this is worth confirming with the department directly before declaring.",
    "The ST328x exclusion list (UROPS modules) is reproduced from a general NUS numbering convention, not read off a definitive code list - double check a specific ST32xx module isn't a UROPS course before counting it.",
  ],
};

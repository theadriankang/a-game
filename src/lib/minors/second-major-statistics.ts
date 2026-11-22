import type { MinorStructure } from "./types";

// Dept of Data Science & Statistics, Second Major in Statistics. Cohorts
// AY2021/2022 onward. Source:
// stat.nus.edu.sg/wp-content/uploads/.../ST2MJ-AY21-22-after_updated-July-2026.pdf,
// checked 2026-11-23. A much larger commitment than the minor (roughly
// double the MC) - same department, same style of requirements, just more
// of them.
export const secondMajorStatistics: MinorStructure = {
  id: "second-major-statistics",
  kind: "second-major",
  label: "Second Major in Statistics",
  department: "Data Science & Statistics",
  totalMcMin: 40,
  totalMcMax: 42,
  groups: [
    { id: "level-1000", label: "Level 1000 (required)", requiredMc: 4, moduleCodes: ["ST1131"] },
    {
      id: "linear-algebra",
      label: "Linear algebra (choose one)",
      requiredMc: 4,
      moduleCodes: ["MA1508E", "MA1513", "MA1522", "MA2001"],
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
      id: "math-stats",
      label: "Mathematical Statistics (required)",
      requiredMc: 4,
      moduleCodes: ["ST2132"],
    },
    {
      id: "stats-computing",
      label: "Statistical computing (choose one)",
      requiredMc: 4,
      moduleCodes: ["ST2137"],
      codePrefixes: ["ST32", "ST42"],
      excludeCodes: ["ST3280", "ST3281", "ST3282", "ST3283", "ST3284", "ST3285", "ST3286", "ST3287", "ST3288", "ST3289", "ST4288"],
    },
    {
      id: "level-3000-4000",
      label: "Level 3000/4000 (three courses)",
      requiredMc: 12,
      moduleCodes: ["ST3131"],
      codePrefixes: ["ST32", "ST42"],
      excludeCodes: ["ST3280", "ST3281", "ST3282", "ST3283", "ST3284", "ST3285", "ST3286", "ST3287", "ST3288", "ST3289", "ST4288"],
    },
    {
      id: "level-3000-4000-extra",
      label: "One additional course, same levels",
      requiredMc: 4,
      codePrefixes: ["ST32", "ST42"],
      excludeCodes: ["ST3280", "ST3281", "ST3282", "ST3283", "ST3284", "ST3285", "ST3286", "ST3287", "ST3288", "ST3289", "ST4288"],
    },
  ],
  excludedProgrammePrefixes: [
    "Bachelor of Science in Statistics",
    "Bachelor of Science in Data Science and Analytics",
  ],
  sourceUrl: "https://www.stat.nus.edu.sg/wp-content/uploads/sites/8/2026/07/ST2MJ-AY21-22-after_updated-July-2026.pdf",
  sourceCheckedDate: "2026-11-23",
  caveats: [
    "Also excluded for anyone already holding a Minor in Statistics (per the source page) - not encoded here since this model checks primary programme, not other minors/majors declared on the platform.",
    "This model's groups sum to about 44 MC, slightly above the stated 40-42 MC total - some \"choose one\" groups likely overlap in practice (e.g. the engineering-only MA1511+MA1512 pair is 2+2=4 MC, not a separate module). Treat the per-group breakdown as more reliable than the exact total.",
    "The page states no rule on double-counting with your primary major - confirm with the department before assuming any of your BComp CS modules count toward this.",
  ],
};

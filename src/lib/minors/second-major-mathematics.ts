import type { MinorStructure } from "./types";

// Dept of Mathematics, Second Major in Mathematics. Cohorts AY2021/2022
// onward. Source:
// math.nus.edu.sg/wp-content/uploads/.../MA2_2122_14102025.pdf plus the
// programme page at math.nus.edu.sg/ug/majmin/secmajors/ma2 for
// exclusions, both checked 2026-11-23.
export const secondMajorMathematics: MinorStructure = {
  id: "second-major-mathematics",
  kind: "second-major",
  label: "Second Major in Mathematics",
  department: "Mathematics",
  totalMcMin: 40,
  totalMcMax: 44,
  groups: [
    {
      id: "level-1000-a",
      label: "Level 1000 - Discrete Math (choose one)",
      requiredMc: 4,
      moduleCodes: ["MA1100", "MA1100T", "CS1231", "CS1231S"],
    },
    {
      id: "level-1000-b",
      label: "Level 1000/2000 (8 MC)",
      requiredMc: 8,
      codePrefixes: ["MA15", "MA20", "MA22"],
      excludeCodes: ["MA2288", "MA2289"],
    },
    {
      id: "linear-algebra-2",
      label: "Linear Algebra II (required)",
      requiredMc: 4,
      moduleCodes: ["MA2101", "MA2101S"],
    },
    {
      id: "level-2000-choice",
      label: "Multivariable calculus or MA22xx (choose one)",
      requiredMc: 4,
      moduleCodes: ["MA2104", "MA2311"],
      codePrefixes: ["MA22"],
      excludeCodes: ["MA2288", "MA2289"],
    },
    {
      id: "analysis",
      label: "Mathematical Analysis I (required)",
      requiredMc: 4,
      moduleCodes: ["MA2108", "MA2108S"],
    },
    {
      id: "probability",
      label: "Probability (choose one)",
      requiredMc: 4,
      moduleCodes: ["MA2116", "MA2116T", "MA2216", "ST2131", "ST2334"],
    },
    {
      id: "level-3000",
      label: "Level 3000 (three courses, 12 MC)",
      requiredMc: 12,
      moduleCodes: ["ST3236", "ST4238", "ME3291", "ME4291", "PC3274A"],
      codePrefixes: ["MA32", "MA42"],
      excludeCodes: ["MA3288", "MA3289", "MA4288", "MA4289"],
    },
  ],
  excludedProgrammePrefixes: [
    "Bachelor of Science in Mathematics",
    "Bachelor of Science in Data Science and Analytics",
  ],
  sourceUrl: "https://www.math.nus.edu.sg/wp-content/uploads/sites/4/2026/07/MA2_2122_14102025.pdf",
  sourceCheckedDate: "2026-11-23",
  caveats: [
    "Also excluded for anyone already holding a Minor in Mathematics (per the programme page) - not encoded here since this model checks primary programme, not other minors/majors declared on the platform. You can't actually take both the Minor and Second Major in Mathematics at the same time.",
    "The source PDF doesn't state a double-counting rule with your primary major - confirm with the department before assuming any BComp CS modules count toward this.",
  ],
};

import type { MinorStructure } from "./types";

// Dept of Mathematics, Minor in Mathematics. Cohorts AY2021/2022 onwards.
// Source: math.nus.edu.sg/wp-content/uploads/.../MAmin_2122_14102025.pdf,
// checked 2026-11-23.
export const minorMathematics: MinorStructure = {
  id: "minor-mathematics",
  label: "Minor in Mathematics",
  department: "Mathematics",
  totalMcMin: 20,
  totalMcMax: 23,
  groups: [
    {
      id: "level-1000",
      label: "Level 1000 (8 MC)",
      requiredMc: 8,
      moduleCodes: ["CS1231", "CS1231S"],
      codePrefixes: ["MA1", "MA20"],
      excludeCodes: ["MA1301", "MA1301X"],
    },
    {
      id: "level-2000",
      label: "Level 2000 (choose two, 8-10 MC)",
      requiredMc: 8,
      moduleCodes: [
        "MA2101",
        "MA2101S",
        "MA2104",
        "MA2311",
        "MA2108",
        "MA2108S",
        "MA2116",
        "MA2116T",
        "MA2216",
        "ST2131",
        "ST2334",
      ],
      codePrefixes: ["MA22"],
      excludeCodes: ["MA2288", "MA2289"],
    },
    {
      id: "level-3000",
      label: "Level 3000 (choose one, 4-5 MC)",
      requiredMc: 4,
      moduleCodes: ["ST3236", "PC3274A"],
      codePrefixes: ["MA32"],
      excludeCodes: ["MA3288", "MA3289"],
    },
  ],
  // The source page lists only "Second Major in Mathematics" as
  // incompatible - no undergraduate major is named as excluded, so this
  // minor appears open to BComp (Computer Science) students.
  excludedProgrammePrefixes: [],
  sourceUrl: "https://www.math.nus.edu.sg/wp-content/uploads/sites/4/2026/07/MAmin_2122_14102025.pdf",
  sourceCheckedDate: "2026-11-23",
  caveats: [
    "The source page doesn't explain what its \"Major Units\" column means, or state a double-counting rule explicitly - unlike the Financial Mathematics and Quantitative Finance minors on the same site, which spell out an 8 MC double-counting cap. Worth confirming whether the same cap applies here before relying on double-counted modules.",
    "\"Any MAxxxx course\" prefix groups are matched by code prefix only - a module could technically be excluded by the Bulletin for a reason this model doesn't know about (e.g. a defunct code).",
  ],
};

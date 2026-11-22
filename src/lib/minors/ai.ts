import type { MinorStructure } from "./types";

// NUS Computing, Minor in Artificial Intelligence. Cohorts 2026/27
// onwards. Source: comp.nus.edu.sg/programmes/ug/minorc/minor-in-ai,
// checked 2026-11-23.
export const minorAi: MinorStructure = {
  id: "minor-ai",
  label: "Minor in Artificial Intelligence",
  department: "NUS Computing",
  totalMcMin: 20,
  totalMcMax: 24,
  groups: [
    {
      id: "core",
      label: "Core (Discrete Structures, DSA, Intro to AI/ML)",
      requiredMc: 12,
      moduleCodes: ["CS1231", "CS1231S", "MA1100", "MA1100T", "CS2040", "CS2040S", "CS2109S"],
    },
    {
      id: "electives",
      label: "Electives (choose two)",
      requiredMc: 8,
      moduleCodes: [
        "CS3263",
        "CS3264",
        "IT3011",
        "ST3248",
        "ST4248",
        "CS3268",
        "CS4243",
        "EE4212",
        "CS4244",
        "CS4246",
        "CS4248",
        "CS4262",
      ],
    },
  ],
  // Confirmed directly from the Bulletin page's own exclusion list - this
  // minor is NOT open to BComp (Computer Science) students.
  excludedProgrammePrefixes: [
    "Bachelor of Computing in Computer Science",
    "Bachelor of Computing in Artificial Intelligence",
    "Bachelor of Computing in Business Artificial Intelligence Systems",
    "Bachelor of Computing in Information Systems",
    "Bachelor of Computing in Information Security",
    "Bachelor of Engineering (Computer Engineering)",
    "Bachelor of Engineering (Robotics and Machine Intelligence)",
    "Bachelor of Science in Business Analytics",
  ],
  sourceUrl: "https://www.comp.nus.edu.sg/programmes/ug/minorc/minor-in-ai",
  sourceCheckedDate: "2026-11-23",
  caveats: [
    "Excluded for BComp (Computer Science) students specifically - NUS Computing does not offer this minor to its own CS majors.",
    "The elective list mixes level-3000/4000 courses and some substitution rules (e.g. CS3264/IT3011 vs ST3248+ST4248) that this simplified model doesn't fully encode - treat the elective MC total as approximate.",
  ],
};

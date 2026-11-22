import type { DegreeStructure } from "./types";

// NUS BComp (Computer Science), AY2026/27 — 160 MC total, min GPA 2.00.
// Source: NUS Bulletin (School of Computing) AY2026/27, SoC faculty
// briefing slides (T2610), checked 2026-11-22. Module lists for Common
// Curriculum pillars and CS Foundation are fixed by the Bulletin; CS
// Breadth & Depth and Interdisciplinary/Cross-Disciplinary depend on a
// student's own focus-area and module choices, so those two buckets can't
// be matched from a module code alone — see `manualOnly` below.
export const bcompCs: DegreeStructure = {
  id: "bcomp-cs",
  label: "BComp (Computer Science)",
  totalMc: 160,
  fallbackBucketId: "unrestricted-electives",
  buckets: [
    // --- Common Curriculum (40 MC) ---
    {
      id: "digital-literacy",
      label: "Digital Literacy",
      group: "Common Curriculum",
      requiredMc: 4,
      moduleCodes: ["CS1101S", "UTC2851"],
    },
    {
      id: "critique-expression",
      label: "Critique and Expression",
      group: "Common Curriculum",
      requiredMc: 4,
      moduleCodes: ["ES2660"],
      codePrefixes: ["UTW", "RVX"],
    },
    {
      id: "cultures-connections",
      label: "Cultures and Connections",
      group: "Common Curriculum",
      requiredMc: 4,
      codePrefixes: ["GEC"],
    },
    {
      id: "data-literacy",
      label: "Data Literacy",
      group: "Common Curriculum",
      requiredMc: 4,
      moduleCodes: ["GEA1000", "BT1101", "ST1131", "DSA1101"],
    },
    {
      id: "singapore-studies",
      label: "Singapore Studies",
      group: "Common Curriculum",
      requiredMc: 4,
      codePrefixes: ["GES"],
    },
    {
      id: "communities-engagement",
      label: "Communities and Engagement",
      group: "Common Curriculum",
      requiredMc: 4,
      codePrefixes: ["GEN"],
    },
    {
      id: "computing-ethics",
      label: "Computing Ethics",
      group: "Common Curriculum",
      requiredMc: 4,
      moduleCodes: ["IS1108"],
    },
    {
      id: "id-cd",
      label: "Interdisciplinary & Cross-Disciplinary",
      group: "Common Curriculum",
      requiredMc: 12,
      manualOnly: true,
    },

    // --- Programme Requirements (80 MC) ---
    {
      id: "cs-foundation",
      label: "CS Foundation",
      group: "Programme Requirements",
      requiredMc: 36,
      moduleCodes: [
        "CS1231S",
        "CS2030S",
        "CS2040S",
        "CS2100",
        "CS2101",
        "CS2103T",
        "CS2106",
        "CS2109S",
        "CS3230",
      ],
    },
    {
      id: "cs-breadth-depth",
      label: "CS Breadth & Depth",
      group: "Programme Requirements",
      requiredMc: 32,
      manualOnly: true,
    },
    {
      id: "math-sciences",
      label: "Mathematics & Sciences",
      group: "Programme Requirements",
      requiredMc: 12,
      moduleCodes: ["MA1521", "MA1522", "ST2334"],
    },

    // --- Unrestricted Electives (40 MC) ---
    {
      id: "unrestricted-electives",
      label: "Unrestricted Electives",
      group: "Unrestricted Electives",
      requiredMc: 40,
    },
  ],
};

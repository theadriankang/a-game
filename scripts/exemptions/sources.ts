// The manifest of everything the pipeline reads. Adding a faculty/year = add
// a line here (and an adapter if the layout is new). Wayback windows are
// bounded by when each faculty rolls its page forward to the next intake;
// the resolver additionally checks the AY printed on the page itself, so a
// wrong window fails loudly instead of silently importing the wrong year.

import type { SourceSpec } from "./lib/types";

const COMP = "School of Computing";
const COMP_BASE = "https://www.comp.nus.edu.sg/programmes/ug/exemptions/";

const AYS = ["2023-24", "2024-25", "2025-26", "2026-27", "2027-28"] as const;
type Ay = (typeof AYS)[number];
const wb = (url: string, from: string, to: string) => ({ kind: "wayback" as const, url, from, to });

/** One source per academic year for a page that carries the same rule for several intakes. */
function sameRuleAcross(id: string, faculty: string, adapter: string, years: readonly Ay[], locator: SourceSpec["locator"]): SourceSpec[] {
  return years.map((ay) => ({ id: `${id}-${ay}`, academicYear: ay, faculty, adapter, locator }));
}

export const SOURCES: SourceSpec[] = [
  // --- School of Computing: polytechnic diploma tables ---
  // AY23/24 lived at /exemptions/polygrad/ before the site was reorganised.
  { id: "comp-poly-2023-24", academicYear: "2023-24", faculty: COMP, adapter: "comp-poly",
    locator: { kind: "wayback", url: `${COMP_BASE}polygrad/`, from: "20221101", to: "20231031" } },
  { id: "comp-poly-2024-25", academicYear: "2024-25", faculty: COMP, adapter: "comp-poly",
    locator: { kind: "wayback", url: COMP_BASE, from: "20231101", to: "20250114" } },
  { id: "comp-poly-2025-26", academicYear: "2025-26", faculty: COMP, adapter: "comp-poly",
    locator: { kind: "wayback", url: COMP_BASE, from: "20250115", to: "20251110" } },
  { id: "comp-poly-2026-27", academicYear: "2026-27", faculty: COMP, adapter: "comp-poly",
    locator: { kind: "wayback", url: COMP_BASE, from: "20251111", to: "20261031" } },
  { id: "comp-poly-2027-28", academicYear: "2027-28", faculty: COMP, adapter: "comp-poly",
    locator: { kind: "live", url: COMP_BASE } },

  // --- School of Computing: NOI / IOI olympiad medallists (table is not AY-labelled; windows are by capture date) ---
  { id: "comp-olympiad-2023-24", academicYear: "2023-24", faculty: COMP, adapter: "comp-olympiad", locator: wb(`${COMP_BASE}olympiad/`, "20230101", "20231031") },
  { id: "comp-olympiad-2024-25", academicYear: "2024-25", faculty: COMP, adapter: "comp-olympiad", locator: wb(`${COMP_BASE}olympiad/`, "20240101", "20241031") },
  { id: "comp-olympiad-2025-26", academicYear: "2025-26", faculty: COMP, adapter: "comp-olympiad", locator: wb(`${COMP_BASE}olympiad/`, "20250101", "20251031") },
  { id: "comp-olympiad-2026-27", academicYear: "2026-27", faculty: COMP, adapter: "comp-olympiad", locator: wb(`${COMP_BASE}olympiad/`, "20260101", "20261031") },
  { id: "comp-olympiad-2027-28", academicYear: "2027-28", faculty: COMP, adapter: "comp-olympiad", locator: { kind: "live", url: `${COMP_BASE}olympiad/` } },

  // --- Yong Loo Lin (Nursing): one table stated to apply to cohorts admitted AY2023 onwards ---
  ...sameRuleAcross("nursing-poly", "Yong Loo Lin School of Medicine", "nursing-poly", ["2023-24", "2024-25", "2025-26", "2026-27"],
    wb("https://medicine.nus.edu.sg/nursing/education-admissions/undergraduate/bachelor-of-science-nursing-bachelor-of-science-nursing-honours/advanced-placement-credits/", "20250101", "20261031")),
  { id: "nursing-poly-2027-28", academicYear: "2027-28", faculty: "Yong Loo Lin School of Medicine", adapter: "nursing-poly",
    locator: { kind: "live", url: "https://medicine.nus.edu.sg/nursing/education-admissions/undergraduate/bachelor-of-science-nursing-bachelor-of-science-nursing-honours/advanced-placement-credits/" } },

  // --- Rule-style faculties (flat 20-unit UE credit, no per-diploma table) ---
  // Science states it applies to everyone admitted from AY2015/16 on, so one capture backs every intake.
  ...sameRuleAcross("science-poly-ue", "Faculty of Science", "science-poly-ue", AYS,
    wb("https://www.science.nus.edu.sg/undergraduates/admissions/advanced-placement-credits-for-polytechnic-diploma-holders/", "20260101", "20261031")),
  ...sameRuleAcross("fass-poly-ue", "Faculty of Arts and Social Sciences", "fass-poly-ue", ["2023-24", "2024-25", "2025-26", "2026-27"],
    wb("https://fass.nus.edu.sg/current-students/academic-matters/polytechnic-transfer-h3-students/", "20260101", "20261031")),
  // Business only publishes its current policy PDF (no archived earlier version found), so only the current intake.
  { id: "bba-poly-ue-2026-27", academicYear: "2026-27", faculty: "NUS Business School", adapter: "bba-poly-ue",
    locator: { kind: "live", url: "https://bba.nus.edu.sg/wp-content/uploads/sites/51/2026/05/Advanced-Placement-Credits-Policy.pdf" } },

  // --- Science: International Mathematical Olympiad medallists (CHS freshmen) ---
  { id: "science-imo-2023-24", academicYear: "2023-24", faculty: "Faculty of Science", adapter: "science-imo", locator: wb("https://www.science.nus.edu.sg/undergraduates/admissions/advanced-placement-credits/", "20230101", "20230930") },
  { id: "science-imo-2024-25", academicYear: "2024-25", faculty: "Faculty of Science", adapter: "science-imo", locator: wb("https://www.science.nus.edu.sg/undergraduates/admissions/advanced-placement-credits/", "20231001", "20250131") },
  { id: "science-imo-2025-26", academicYear: "2025-26", faculty: "Faculty of Science", adapter: "science-imo", locator: wb("https://www.science.nus.edu.sg/undergraduates/admissions/advanced-placement-credits/", "20250201", "20251031") },
  { id: "science-imo-2026-27", academicYear: "2026-27", faculty: "Faculty of Science", adapter: "science-imo", locator: wb("https://www.science.nus.edu.sg/undergraduates/admissions/advanced-placement-credits/", "20251101", "20261031") },

  // --- College of Design and Engineering: one ENG-CEG and one Architecture/Design PDF per intake ---
  ...cdePair("2023-24", "2022/11/APCs-for-Accredited-Dip_CDE-ENG-CEG_AY23-24-1.pdf", "2023/11/APCs-for-Accredited-Dip_CDE-AKI-BLA-ID-PFM_AY23-24-rev-24-Nov-2023.pdf"),
  ...cdePair("2024-25", "2023/12/APCs-for-Accredited-Dip_CDE-ENG-CEG_AY24-25.pdf", "2025/04/APCs-for-Accredited-Dip_CDE-AKI-BLA-ID-PFM_AY24-25_v3.pdf"),
  ...cdePair("2025-26", "2025/05/APCs-for-Accredited-Dip_CDE-ENG-CEG_AY25-26-16-May-2025.pdf", "2025/05/APCs-for-Accredited-Dip_CDE-AKI-BLA-ID_AY25-26-16-May-2025.pdf"),
  ...cdePair("2026-27", "2025/12/APCs-for-Accredited-Dip_CDE-ENG-CEG_AY26-27-23-Dec-2025.pdf", "2025/12/APCs-for-Accredited-Dip_CDE-AKI-BLA-ID_AY26-27-23-Dec-2025.pdf"),
];

/** CDE links its PDFs from https://cde.nus.edu.sg/undergraduate/curriculum-structure/ ; AY27/28 isn't published yet. */
function cdePair(ay: Ay, eng: string, design: string): SourceSpec[] {
  const base = "https://cde.nus.edu.sg/wp-content/uploads/";
  const cde = "College of Design and Engineering";
  return [
    { id: `cde-eng-${ay}`, academicYear: ay, faculty: cde, adapter: "cde-eng", locator: { kind: "live", url: base + eng } },
    { id: `cde-design-${ay}`, academicYear: ay, faculty: cde, adapter: "cde-design", locator: { kind: "live", url: base + design } },
  ];
}

// The same COMP pages also state the automatic 20-unit elective credit; read it as a rule
// (wording verified per year) from the very same snapshot locations.
for (const s of SOURCES.filter((x) => x.adapter === "comp-poly")) {
  SOURCES.push({ ...s, id: s.id.replace("comp-poly-", "comp-poly-ue-"), adapter: "comp-poly-ue" });
}

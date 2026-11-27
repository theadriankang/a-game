// Faculties that state a flat rule instead of publishing a per-diploma table
// (e.g. "all polytechnic diploma holders get 20 units of unrestricted
// electives"). The rows are hand-reviewed constants, but each is tied to a
// stored snapshot and only emitted if the page still contains the wording it
// was reviewed against - so if the faculty changes its policy text, the build
// flags a GAP instead of silently publishing stale facts.

import type { Adapter, RuleRow, SourceSpec } from "../lib/types";
import { credentialKey } from "../../../src/lib/exemptions/normalize";
import { docText } from "../lib/text";

type Fixed = Omit<RuleRow, "academicYear" | "sourceUrl" | "snapshotAt" | "credentialKey">;

export function ruleAdapter(opts: {
  /** Phrases (case-insensitive) that must all appear in the source text. */
  requires: (string | RegExp)[];
  rows: (spec: SourceSpec) => Fixed[];
}): Adapter {
  const check = async (doc: Parameters<NonNullable<Adapter["detectAcademicYear"]>>[0]) => {
    const text = await docText(doc);
    return opts.requires.filter((r) => (typeof r === "string" ? !text.toLowerCase().includes(r.toLowerCase()) : !r.test(text)));
  };
  return {
    // The wording itself is the check, so the capture is accepted for the AY
    // being built iff all required phrases are present.
    async detectAcademicYear(doc, spec) {
      return (await check(doc)).length === 0 ? Number(spec.academicYear.slice(0, 4)) : null;
    },
    async parse(doc, spec) {
      const missing = await check(doc);
      if (missing.length) {
        return { rows: [], warnings: [`policy wording changed - missing: ${missing.map(String).join("; ")}. Re-review before trusting this rule.`] };
      }
      return {
        rows: opts.rows(spec).map((r) => ({
          ...r,
          academicYear: spec.academicYear,
          credentialKey: credentialKey(r.credential) || "*",
          sourceUrl: doc.url,
          snapshotAt: doc.snapshotAt,
        })),
        warnings: [],
      };
    },
  };
}

// Applies to every intake we cover (the option exists from AY2021/22).
const SU_SWAP_NOTE = "You can give these up in Year 1 for 12 extra S/U units (Registrar's Office exercise).";
const UE_LABEL = "Unrestricted electives (polytechnic APC)";

const POLY_ANY = { qualification: "POLYTECHNIC" as const, institution: null, credential: "*" };

export const sciencePolyUe = ruleAdapter({
  requires: ["POY1901", "POY1902", "POY1903", "POY1908", "POY1909", "automatically granted 20 units"],
  rows: () =>
    ["POY1901", "POY1902", "POY1903", "POY1908", "POY1909"].map((moduleCode) => ({
      faculty: "Faculty of Science",
      programmes: [],
      ...POLY_ANY,
      moduleCode,
      label: "Polytechnic APC (unrestricted elective)",
      mc: 4,
      kind: "UNRESTRICTED_ELECTIVE" as const,
      grant: "AUTOMATIC" as const,
      note: `Automatic for polytechnic diploma holders. ${SU_SWAP_NOTE}`,
    })),
});

export const fassPolyUe = ruleAdapter({
  requires: ["20 Units of Unrestricted Electives", "granted advanced placement", "automatically given"],
  rows: () => [
    {
      faculty: "Faculty of Arts and Social Sciences",
      programmes: [],
      ...POLY_ANY,
      moduleCode: null,
      label: UE_LABEL,
      mc: 20,
      kind: "UNRESTRICTED_ELECTIVE" as const,
      grant: "AUTOMATIC" as const,
      note: `Outside your major. Granted automatically (shows in EduRec around early September). ${SU_SWAP_NOTE}`,
    },
  ],
});

export const bbaPolyUe = ruleAdapter({
  requires: ["20 Units from", "Unrestricted Elective", "automatically granted", "Advanced Placement Tests"],
  rows: () => [
    {
      faculty: "NUS Business School",
      programmes: [],
      ...POLY_ANY,
      moduleCode: null,
      label: UE_LABEL,
      mc: 20,
      kind: "UNRESTRICTED_ELECTIVE" as const,
      grant: "AUTOMATIC" as const,
      note: "Automatic, but how much applies depends on your programme requirements and any 2nd major/minor. Up to 20 more units of programme-requirement credit are possible by passing Advanced Placement Tests set by the Business School after you accept your offer.",
    },
  ],
});

export const scienceImo = ruleAdapter({
  requires: ["International Mathematical Olympiad", "MA1100"],
  rows: () =>
    ["Faculty of Science", "Faculty of Arts and Social Sciences"].map((faculty) => ({
      faculty,
      programmes: [],
      qualification: "OLYMPIAD" as const,
      institution: null,
      credential: "International Mathematical Olympiad medallist",
      moduleCode: "MA1100",
      label: "MA1100 Basic Discrete Mathematics",
      mc: 4,
      kind: "PROGRAMME" as const,
      grant: "OPT_IN" as const,
      note: "For College of Humanities and Sciences freshmen who won an IMO medal within 5 years before admission. Not automatic: email the faculty by its stated deadline to be considered.",
    })),
});

export const compPolyUe = ruleAdapter({
  requires: [/20 units (?:of APCs? )?for UEM/i, /diploma holders of approved programmes/i],
  rows: () => [
    {
      faculty: "School of Computing",
      programmes: [],
      ...POLY_ANY,
      moduleCode: null,
      label: UE_LABEL,
      mc: 20,
      kind: "UNRESTRICTED_ELECTIVE" as const,
      grant: "AUTOMATIC" as const,
      note: `Automatic for approved polytechnic diplomas. ${SU_SWAP_NOTE}`,
    },
  ],
});

// How a student satisfies NUS's "good H2 pass (or equivalent) in Mathematics / Further Mathematics" condition.
//
// Sources: the Mathematics Department's "Candidates without H2 Maths" and "MA1301 Proficiency Test" pages, and
// NUS admissions' "Mathematics requirements for polytechnic applicants" (December 2024). NUS treats all of the
// answers below except NONE as meeting the condition, so the student doesn't read the bridging module MA1301.
//
// This is not an exemption in the APC sense: no credit is granted, the requirement just doesn't apply. It matters
// because many modules list "H2 Math OR MA1301", and NUSMods' parsed prerequisite tree keeps only the MA1301 branch.

export const MATH_BACKGROUNDS = [
  { value: "H2", label: "H2 Math or Further Math (A-level)" },
  { value: "IB_HL", label: "IB HL Math (Analysis & Approaches)" },
  { value: "POLY_CERT", label: "Polytechnic, with a recognised maths certificate" },
  { value: "PASSED_TEST", label: "I passed the MA1301 Proficiency Test" },
  { value: "NONE", label: "None of these (I'll read MA1301)" },
] as const;

export type MathBackground = (typeof MATH_BACKGROUNDS)[number]["value"];

export const MATH_BACKGROUND_VALUES = MATH_BACKGROUNDS.map((b) => b.value) as [MathBackground, ...MathBackground[]];

/** NUS deems every background except NONE to be a good H2 pass (or equivalent). Unknown/not asked counts as not covered. */
export function coversMath(background: string | null | undefined): boolean {
  return background === "H2" || background === "IB_HL" || background === "POLY_CERT" || background === "PASSED_TEST";
}

/** The bridging modules that stand in for the H2 condition inside NUSMods' prerequisite trees. */
export const MATH_BRIDGING_CODES: readonly string[] = ["MA1301", "MA1301X"];

/** Modules to treat as already satisfied when evaluating prerequisites for this student. */
export function assumedModulesFor(background: string | null | undefined): string[] {
  return coversMath(background) ? [...MATH_BRIDGING_CODES] : [];
}

export const POLYTECHNIC_MATH_CERTIFICATES_SOURCE = {
  label: "NUS admissions (December 2024) and the Mathematics Department",
  url: "https://nus.edu.sg/oam/docs/default-source/admissions/mathematics-requirements-for-polytechnic-applicants.pdf",
};

/**
 * Polytechnic maths certificates NUS recognises as a good H2 pass, by polytechnic name as the onboarding form
 * spells it. Merged from the two NUS lists above, which differ slightly (the Mathematics Department's was last
 * updated in 2019); some Singapore Polytechnic ones are listed for past graduates only. Re-check yearly.
 */
export const POLYTECHNIC_MATH_CERTIFICATES: Record<string, string[]> = {
  "Nanyang Polytechnic": ["Graduate DPP Transcript with all three Diploma Plus modules: Analytical Geometry, Applied Calculus and Advanced Calculus"],
  "Ngee Ann Polytechnic": [
    "Diploma Plus Programme: Certificate in Advanced Computing Mathematics",
    "Diploma Plus Programme: Certificate in Advanced Engineering Mathematics",
  ],
  "Republic Polytechnic": ["Diploma Plus Certificate in Mathematics", "University Mathematics Preparatory Course (Certificate in Mathematics)"],
  "Singapore Polytechnic": [
    "Certificate in Advanced Mathematics (Advanced Mathematics Programme)",
    "Certificate of Completion of the Higher Mathematics Programme",
    "Certificate in Engineering Mathematics",
    "Certificate in Engineering Mathematics & Science",
    "Certificate in Mathematics for Engineering",
    "Diploma Plus Certificate in Mathematics for the School of Digital Media and Infocomm Technology",
  ],
  "Temasek Polytechnic": ["Certificate in University Preparatory Mathematics"],
};

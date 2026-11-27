// Shared by the offline ingestion scripts and the runtime suggestion API so
// both sides agree on how a published diploma name maps onto the names in
// education-data/polytechnic-diplomas.ts.

/** "2026" -> "2026-27". Academic years are keyed by their intake (start) year. */
export function academicYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** "2026-27" | "2026-2027" | "2026/27" | "AY2026/2027" -> 2026, or null. */
export function parseAcademicYear(text: string): number | null {
  const m = text.match(/(20\d{2})\s*[-/–]\s*(?:20)?(\d{2})\b/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  return (start + 1) % 100 === end ? start : null;
}

/**
 * Normalise a diploma / medal-category name for matching: lower-case,
 * "&" -> "and", drop a leading "Diploma in", drop parenthetical qualifiers
 * (e.g. "(with Minor in Business Management)"), strip punctuation.
 */
export function credentialKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/^\s*(?:professional\s+)?diploma\s+(?:in|of)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The five local polytechnics, keyed so "NP"/"Nanyang Poly"/etc. all resolve. */
const POLYTECHNICS: Record<string, string> = {
  nanyang: "Nanyang Polytechnic",
  "ngee ann": "Ngee Ann Polytechnic",
  republic: "Republic Polytechnic",
  singapore: "Singapore Polytechnic",
  temasek: "Temasek Polytechnic",
};

export function canonicalPolytechnic(text: string): string | null {
  const t = text.toLowerCase();
  for (const [needle, name] of Object.entries(POLYTECHNICS)) {
    if (t.includes(needle)) return name;
  }
  return null;
}

/** NUS module codes: 2-4 letters, 4 digits, optional 1-2 letter suffix (CS1010, CP3200, EG3611P, PL1101E). */
export const MODULE_CODE_RE = /\b[A-Z]{2,4}\s?\d{4}[A-Z]{0,2}\b/g;

export function extractModuleCodes(text: string): string[] {
  return Array.from(text.matchAll(MODULE_CODE_RE), (m) => m[0].replace(/\s+/g, ""));
}

// Pure helpers for the module-code autocomplete, shared by the API route and the browser.

/** Don't search on one or two keystrokes: "c" or "cs" matches hundreds of modules and is just noise. */
export const MIN_QUERY_LENGTH = 3;

/** NUS module codes: 2-4 letters, 4 digits, optional 1-2 letter suffix (CS1010A, CP3200, GEA1000N). */
export const CODE_RE = /^[A-Z]{2,4}\d{4}[A-Z]{0,2}$/;

export type CatalogQuery =
  | { kind: "none" }
  /** Letters and/or digits from the start of a code: "cs1" -> CS1010, CS1010A, CS1101S ... */
  | { kind: "prefix"; q: string }
  /** Only digits: "1301" -> MA1301, ST1301 ... (matches the number part, whatever the faculty prefix) */
  | { kind: "digits"; q: string };

/** "cs 1101s" -> prefix CS1101S, "1301" -> digits, "c" -> none. Case, spaces and punctuation are ignored. */
export function parseCatalogQuery(raw: string): CatalogQuery {
  const q = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (q.length < MIN_QUERY_LENGTH) return { kind: "none" };
  if (/^\d+$/.test(q)) return q.length <= 4 ? { kind: "digits", q } : { kind: "none" };
  return { kind: "prefix", q };
}

/** Split pasted text ("CS1010, MA 1301\nCS2030 st2334") into distinct, normalised tokens. */
export function parseCodeList(raw: string): string[] {
  const joined = raw.toUpperCase().replace(/([A-Z]{2,4})\s+(\d{4}[A-Z]{0,2})/g, "$1$2"); // "MA 1301" -> "MA1301"
  return [...new Set(joined.split(/[^A-Z0-9]+/).filter(Boolean))];
}

/** The same query evaluated in memory, for the fallback path when the catalog table is empty. */
export function filterByQuery<T extends { code: string }>(items: T[], query: CatalogQuery, limit: number): T[] {
  if (query.kind === "none") return [];
  const numberPart = (code: string) => code.replace(/^[A-Z]+/, "");
  const hits =
    query.kind === "prefix"
      ? items.filter((m) => m.code.startsWith(query.q))
      : items.filter((m) => /^[A-Z]{2,4}$/.test(m.code.replace(/\d.*$/, "")) && numberPart(m.code).startsWith(query.q));
  return hits
    .sort((a, b) =>
      query.kind === "digits"
        ? numberPart(a.code).localeCompare(numberPart(b.code)) || a.code.localeCompare(b.code)
        : Number(b.code === query.q) - Number(a.code === query.q) || a.code.localeCompare(b.code)
    )
    .slice(0, limit);
}

export type CatalogHit = { code: string; title: string; mc: number | null };

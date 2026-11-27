import { z } from "zod";

export const RuleRowSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  faculty: z.string().min(1),
  programmes: z.array(z.string()),
  qualification: z.enum(["POLYTECHNIC", "H3", "OLYMPIAD"]),
  institution: z.string().nullable(),
  credential: z.string().min(1),
  credentialKey: z.string().min(1),
  moduleCode: z
    .string()
    .regex(/^[A-Z]{2,4}\d{4}[A-Z]{0,2}$/)
    .nullable(),
  label: z.string().min(1),
  mc: z.number().int().min(0).max(40),
  kind: z.enum(["PROGRAMME", "UNRESTRICTED_ELECTIVE"]),
  grant: z.enum(["AUTOMATIC", "OPT_IN"]),
  note: z.string().nullable(),
  sourceUrl: z.string().url(),
  snapshotAt: z.string().nullable(),
});
export type RuleRow = z.infer<typeof RuleRowSchema>;

/** One diploma/medal category's full set of grants - the unit stored in the DB and written to data/exemptions/rules. */
export const GrantSchema = z.object({
  moduleCode: RuleRowSchema.shape.moduleCode,
  label: z.string().min(1),
  mc: z.number().int().min(0).max(40),
  kind: RuleRowSchema.shape.kind,
  grant: RuleRowSchema.shape.grant,
  note: z.string().nullable(),
});
export type Grant = z.infer<typeof GrantSchema>;

export const RuleGroupSchema = z.object({
  academicYear: RuleRowSchema.shape.academicYear,
  faculty: z.string(),
  programmes: z.array(z.string()),
  qualification: RuleRowSchema.shape.qualification,
  institution: z.string().nullable(),
  credential: z.string(),
  credentialKey: z.string(),
  sourceUrl: z.string().url(),
  snapshotAt: z.string().nullable(),
  grants: z.array(GrantSchema).min(1),
});
export type RuleGroup = z.infer<typeof RuleGroupSchema>;

export function groupRows(rows: RuleRow[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();
  for (const r of rows) {
    const key = JSON.stringify([r.academicYear, r.faculty, r.programmes, r.qualification, r.institution, r.credentialKey, r.credential, r.sourceUrl, r.snapshotAt]);
    let g = groups.get(key);
    if (!g) {
      g = {
        academicYear: r.academicYear,
        faculty: r.faculty,
        programmes: r.programmes,
        qualification: r.qualification,
        institution: r.institution,
        credential: r.credential,
        credentialKey: r.credentialKey,
        sourceUrl: r.sourceUrl,
        snapshotAt: r.snapshotAt,
        grants: [],
      };
      groups.set(key, g);
    }
    const grant: Grant = { moduleCode: r.moduleCode, label: r.label, mc: r.mc, kind: r.kind, grant: r.grant, note: r.note };
    if (!g.grants.some((x) => JSON.stringify(x) === JSON.stringify(grant))) g.grants.push(grant);
  }
  return [...groups.values()];
}

export const AyFileSchema = z.object({
  academicYear: z.string(),
  sources: z.array(
    z.object({
      id: z.string(),
      faculty: z.string(),
      url: z.string(),
      snapshotAt: z.string().nullable(),
      sha256: z.string(),
    })
  ),
  rules: z.array(RuleGroupSchema),
});
export type AyFile = z.infer<typeof AyFileSchema>;

/** Where a source's raw bytes come from. */
export type Locator =
  /** Current page/PDF, fetched directly. */
  | { kind: "live"; url: string }
  /** Newest Wayback capture inside [from,to] (YYYYMMDD) whose detected AY matches. */
  | { kind: "wayback"; url: string; from: string; to: string }
  /** A page saved by a human into data/exemptions/manual/ (for bot-blocked sites). */
  | { kind: "manual"; file: string; url: string };

export type SourceSpec = {
  id: string;
  /** Intake academic year this source is published for, e.g. "2026-27". */
  academicYear: string;
  faculty: string;
  adapter: string;
  locator: Locator;
};

export type RawDoc = {
  id: string;
  url: string;
  snapshotAt: string | null; // ISO
  kind: "html" | "pdf";
  html?: string;
  pdf?: Uint8Array;
};

export type ParseResult = { rows: RuleRow[]; warnings: string[] };

export type Adapter = {
  /** Cheap check used to pick the right Wayback capture. Return the intake start year, or null. */
  detectAcademicYear?: (doc: RawDoc, spec: SourceSpec) => number | null | Promise<number | null>;
  parse: (doc: RawDoc, spec: SourceSpec) => ParseResult | Promise<ParseResult>;
};

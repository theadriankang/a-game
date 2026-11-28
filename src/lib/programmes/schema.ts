import { z } from "zod";

// The shape of one published minor / second major, shared by the app (src/lib/programmes/store.ts) and the
// pipeline scripts so both agree on what valid data is. The structured part (groups) is exactly what
// src/lib/minors/types.ts describes; the rest is provenance.

// "CS1231S", "MA1100T", "UTC2851": 2-4 letters, 4 digits, up to two suffix letters.
const MODULE_CODE = /^[A-Z]{2,4}\d{4}[A-Z]{0,2}$/;
// What a group's codePrefixes may be: "ST32", "MA", "CS3".
const CODE_PREFIX = /^[A-Z]{2,4}\d{0,3}$/;

export const ModuleCodeSchema = z.string().regex(MODULE_CODE, "not a module code like CS1231S");

export const RequirementGroupSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes only"),
    label: z.string().min(1),
    requiredMc: z.number().positive(),
    moduleCodes: z.array(ModuleCodeSchema).optional(),
    codePrefixes: z.array(z.string().regex(CODE_PREFIX, "not a code prefix like ST32")).optional(),
    excludeCodes: z.array(ModuleCodeSchema).optional(),
  })
  .refine((g) => (g.moduleCodes?.length ?? 0) + (g.codePrefixes?.length ?? 0) > 0, {
    message: "a group needs moduleCodes or codePrefixes, or nothing can ever count toward it",
  });

// How a student goes about getting the programme, as the source describes it. "apply" = the department approves
// (an application, usually with a window); "declare" = the student records it themselves (APAD). Left out entirely
// (null) when the source says nothing, rather than guessed: the nudge then just points at the source page.
export const ApplicationSchema = z.object({
  type: z.enum(["apply", "declare"]),
  // Short, ordered, in the source's terms. Anything a student should know before going ahead: where to apply, the
  // entry requirement, a grade needed to continue.
  steps: z.array(z.string().min(1)).min(1),
  // The cut-off as the source words it, e.g. "By the 4th semester of study".
  deadline: z.string().min(1).nullish(),
  // Where to apply or read more, when that differs from the programme's source page.
  url: z.string().url().nullish(),
});

export type ProgrammeApplication = z.infer<typeof ApplicationSchema>;

export const ProgrammeRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    // "specialisation" covers focus areas / specialisations inside a primary programme: no extra degree, and
    // usually open only to that programme's students (eligibleProgrammePrefixes).
    kind: z.enum(["minor", "second-major", "specialisation"]),
    label: z.string().min(1),
    department: z.string().min(1),
    totalMcMin: z.number().int().positive(),
    totalMcMax: z.number().int().positive().optional(),
    groups: z.array(RequirementGroupSchema).min(1),
    excludedProgrammePrefixes: z.array(z.string().min(1)),
    // When non-empty, ONLY students whose programme starts with one of these can take it (the inverse of the
    // exclusion list). Empty = open to everyone not excluded.
    eligibleProgrammePrefixes: z.array(z.string().min(1)).default([]),
    application: ApplicationSchema.nullish(),
    sourceUrl: z.string().url(),
    sourceCheckedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    caveats: z.array(z.string().min(1)).default([]),
    cohortNote: z.string().min(1).nullish(),
    // Intakes (matriculation years: AY2026/27 = 2026) that can take this record. null/absent = no limit on that side.
    cohortFrom: z.number().int().min(2000).max(2100).nullish(),
    cohortTo: z.number().int().min(2000).max(2100).nullish(),
  })
  .superRefine((p, ctx) => {
    if (p.cohortFrom != null && p.cohortTo != null && p.cohortFrom > p.cohortTo) {
      ctx.addIssue({ code: "custom", message: "cohortFrom is after cohortTo", path: ["cohortFrom"] });
    }
    if (p.totalMcMax !== undefined && p.totalMcMax < p.totalMcMin) {
      ctx.addIssue({ code: "custom", message: "totalMcMax is below totalMcMin", path: ["totalMcMax"] });
    }
    const seen = new Set<string>();
    p.groups.forEach((g, i) => {
      if (seen.has(g.id)) ctx.addIssue({ code: "custom", message: `duplicate group id ${g.id}`, path: ["groups", i, "id"] });
      seen.add(g.id);
    });
  });

export type ProgrammeRecord = z.infer<typeof ProgrammeRecordSchema>;

// data/programmes/programmes.json: everything published, sorted by id so diffs stay small.
export const ProgrammesFileSchema = z
  .object({ programmes: z.array(ProgrammeRecordSchema) })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.programmes.forEach((p, i) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", message: `duplicate programme id ${p.id}`, path: ["programmes", i, "id"] });
      seen.add(p.id);
    });
  });

export type ProgrammesFile = z.infer<typeof ProgrammesFileSchema>;

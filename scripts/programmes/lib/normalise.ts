// zod/v4, not "zod": the SDK's zodOutputFormat() builds the JSON schema with zod v4's toJSONSchema and fails on a
// v3 schema ("reading 'def'"). Everything else in the repo stays on zod v3; this one schema is the exception.
import { z } from "zod/v4";
import type { ProgrammeSource } from "../sources";

// What the model is asked to return. Deliberately only what can be read off the page: id, label, department and
// source URL come from sources.ts, so the model can't invent or mangle them. Every field is required (empty array
// or null when absent) because structured outputs work best that way; normaliseDraft tidies the result.
export const DraftOutSchema = z.object({
  totalMcMin: z.number(),
  totalMcMax: z.number().nullable(),
  groups: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      requiredMc: z.number(),
      moduleCodes: z.array(z.string()),
      codePrefixes: z.array(z.string()),
      excludeCodes: z.array(z.string()),
    })
  ),
  excludedProgrammePrefixes: z.array(z.string()),
  eligibleProgrammePrefixes: z.array(z.string()),
  application: z
    .object({
      type: z.enum(["apply", "declare"]),
      steps: z.array(z.string()),
      deadline: z.string().nullable(),
      url: z.string().nullable(),
    })
    .nullable(),
  caveats: z.array(z.string()),
  cohortNote: z.string().nullable(),
  cohortFrom: z.number().int().nullable(),
  cohortTo: z.number().int().nullable(),
});

export type DraftOut = z.infer<typeof DraftOutSchema>;

const cleanCode = (code: string) => code.replace(/\s+/g, "").toUpperCase();
const unique = <T>(items: T[]) => [...new Set(items)];
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function normaliseApplication(application: DraftOut["application"]) {
  if (!application) return null;
  const steps = application.steps.map((step) => step.trim()).filter(Boolean);
  if (steps.length === 0) return null; // an "application" with nothing to do is no application
  return {
    type: application.type,
    steps,
    ...(application.deadline?.trim() ? { deadline: application.deadline.trim() } : {}),
    ...(application.url?.trim() ? { url: application.url.trim() } : {}),
  };
}

/**
 * Model output -> a candidate programme record, still to be validated against ProgrammeRecordSchema. Tidies what a
 * model reliably gets slightly wrong (case and spacing of codes, repeated codes, empty arrays, group ids) and drops
 * groups with nothing that could ever match, saying so in `notes` instead of silently losing a requirement.
 */
export function normaliseDraft(
  out: DraftOut,
  source: ProgrammeSource,
  fetchedAt: string
): { candidate: unknown; notes: string[] } {
  const notes: string[] = [];
  const usedIds = new Set<string>();

  const groups = out.groups.flatMap((g, index) => {
    const moduleCodes = unique(g.moduleCodes.map(cleanCode).filter(Boolean));
    const codePrefixes = unique(g.codePrefixes.map(cleanCode).filter(Boolean));
    const excludeCodes = unique(g.excludeCodes.map(cleanCode).filter(Boolean));

    if (moduleCodes.length + codePrefixes.length === 0) {
      notes.push(`Group "${g.label}" (${g.requiredMc} MC) was dropped: the source gave no module codes or code pattern for it.`);
      return [];
    }

    let id = slug(g.id) || slug(g.label) || `group-${index + 1}`;
    for (let n = 2; usedIds.has(id); n++) id = `${slug(g.id) || `group-${index + 1}`}-${n}`;
    usedIds.add(id);

    return [
      {
        id,
        label: g.label.trim(),
        requiredMc: g.requiredMc,
        ...(moduleCodes.length ? { moduleCodes } : {}),
        ...(codePrefixes.length ? { codePrefixes } : {}),
        ...(excludeCodes.length ? { excludeCodes } : {}),
      },
    ];
  });

  return {
    candidate: {
      id: source.id,
      kind: source.kind,
      label: source.label,
      department: source.department,
      totalMcMin: out.totalMcMin,
      ...(out.totalMcMax !== null ? { totalMcMax: out.totalMcMax } : {}),
      groups,
      excludedProgrammePrefixes: unique(out.excludedProgrammePrefixes.map((p) => p.trim()).filter(Boolean)),
      eligibleProgrammePrefixes: unique(out.eligibleProgrammePrefixes.map((p) => p.trim()).filter(Boolean)),
      application: normaliseApplication(out.application),
      sourceUrl: source.url,
      sourceCheckedDate: fetchedAt.slice(0, 10),
      caveats: [...out.caveats.map((c) => c.trim()).filter(Boolean), ...notes],
      cohortNote: out.cohortNote?.trim() || null,
      ...(out.cohortFrom !== null ? { cohortFrom: out.cohortFrom } : {}),
      ...(out.cohortTo !== null ? { cohortTo: out.cohortTo } : {}),
    },
    notes,
  };
}

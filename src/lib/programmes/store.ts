import { prisma } from "@/lib/prisma";
import type { MinorStructure } from "@/lib/minors/types";
import bundled from "../../../data/programmes/programmes.json";
import { ProgrammeRecordSchema, ProgrammesFileSchema, type ProgrammeRecord } from "./schema";

export type ProgrammeSet = {
  minors: MinorStructure[];
  secondMajors: MinorStructure[];
  specialisations: MinorStructure[];
  // Where this came from, so a page (or a log line) can tell a loaded database from the bundled copy.
  source: "database" | "bundled";
};

// The copy that ships with the deploy: data/programmes/programmes.json. Parsed lazily and once, so a bad edit to
// that file fails loudly the first time it's used rather than at import time.
let bundledRecords: ProgrammeRecord[] | null = null;
function bundledProgrammes(): ProgrammeRecord[] {
  bundledRecords ??= ProgrammesFileSchema.parse(bundled).programmes;
  return bundledRecords;
}

const KIND_FROM_DB = { MINOR: "minor", SECOND_MAJOR: "second-major", SPECIALISATION: "specialisation" } as const;

// One database row as a validated record, or null (logged) when it doesn't pass the schema. A bad row is skipped,
// not allowed to take the planner down with it.
function rowToRecord(row: {
  id: string;
  kind: "MINOR" | "SECOND_MAJOR" | "SPECIALISATION";
  label: string;
  department: string;
  totalMcMin: number;
  totalMcMax: number | null;
  groups: unknown;
  excludedProgrammePrefixes: string[];
  eligibleProgrammePrefixes: string[];
  application: unknown;
  sourceUrl: string;
  sourceCheckedDate: string;
  caveats: string[];
  cohortNote: string | null;
  cohortFrom: number | null;
  cohortTo: number | null;
}): ProgrammeRecord | null {
  const parsed = ProgrammeRecordSchema.safeParse({
    id: row.id,
    kind: KIND_FROM_DB[row.kind],
    label: row.label,
    department: row.department,
    totalMcMin: row.totalMcMin,
    totalMcMax: row.totalMcMax ?? undefined,
    groups: row.groups,
    excludedProgrammePrefixes: row.excludedProgrammePrefixes,
    eligibleProgrammePrefixes: row.eligibleProgrammePrefixes,
    application: row.application ?? undefined,
    sourceUrl: row.sourceUrl,
    sourceCheckedDate: row.sourceCheckedDate,
    caveats: row.caveats,
    cohortNote: row.cohortNote,
    cohortFrom: row.cohortFrom,
    cohortTo: row.cohortTo,
  });
  if (!parsed.success) {
    console.error(`programmes: skipping row ${row.id}, it doesn't match the schema`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

function split(records: ProgrammeRecord[], source: ProgrammeSet["source"]): ProgrammeSet {
  return {
    minors: records.filter((r) => r.kind === "minor"),
    secondMajors: records.filter((r) => r.kind === "second-major"),
    specialisations: records.filter((r) => r.kind === "specialisation"),
    source,
  };
}

/**
 * Every published minor and second major. Reads the `programmes` table; when that is empty (the loader hasn't been
 * run), missing (schema not pushed yet) or unreachable, falls back to the JSON bundled with the deploy, so the
 * planner and Minors page work either way.
 */
export async function getProgrammes(): Promise<ProgrammeSet> {
  try {
    const rows = await prisma.programme.findMany({ orderBy: { id: "asc" } });
    const records = rows.map(rowToRecord).filter((r): r is ProgrammeRecord => r !== null);
    if (records.length > 0) return split(records, "database");
  } catch (error) {
    // Once per process: until the schema is pushed this fails on every request, and repeating it just buries the logs.
    if (!warnedAboutTable) {
      warnedAboutTable = true;
      if (isMissingTable(error)) {
        // Expected until `prisma db push` has run, and the bundled copy is a complete answer, so this is a warning:
        // a console.error here would also pop Next's dev error overlay for something that isn't broken.
        console.warn("programmes: the programmes table doesn't exist yet (npm run build runs prisma db push); using the bundled copy.");
      } else {
        console.error("programmes: couldn't read the programmes table, using the bundled copy", error);
      }
    }
  }
  return split(bundledProgrammes(), "bundled");
}

let warnedAboutTable = false;

// Prisma's "table does not exist" error (P2021), without importing Prisma's error classes into this file.
function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021";
}

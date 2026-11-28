import { nusFaculties } from "../../../src/lib/education-data/nus-programmes";
import type { ProgrammeRecord } from "../../../src/lib/programmes/schema";

// What User.programme looks like for each programme the onboarding form offers: "<programme> (<faculty>)".
const KNOWN_PROGRAMME_STRINGS = nusFaculties.flatMap((f) => f.programmes.map((p) => `${p} (${f.name})`));

/**
 * Sanity checks on a record that already passed the schema. Everything here is a warning for a reviewer, not a
 * hard failure: a retired module can legitimately be listed, and a requirement the source doesn't express as codes
 * leaves the groups short on purpose (it should be in the caveats).
 */
export function checkRecord(record: ProgrammeRecord, ctx: { catalog: Set<string> | null }): string[] {
  const warnings: string[] = [];

  const groupMc = record.groups.reduce((sum, g) => sum + g.requiredMc, 0);
  const ceiling = record.totalMcMax ?? record.totalMcMin;
  if (groupMc < record.totalMcMin) {
    warnings.push(
      `Groups add up to ${groupMc} MC but the programme needs ${record.totalMcMin}: part of the requirement isn't expressed as groups (is it in the caveats?).`
    );
  } else if (groupMc > ceiling) {
    warnings.push(`Groups add up to ${groupMc} MC, more than the programme's ${ceiling} MC ceiling: a group may be double-listed.`);
  }

  for (const prefix of record.excludedProgrammePrefixes) {
    if (!KNOWN_PROGRAMME_STRINGS.some((known) => known.startsWith(prefix))) {
      warnings.push(`Excluded programme "${prefix}" matches none of the programmes onboarding offers, so it can never apply to anyone.`);
    }
  }
  for (const prefix of record.eligibleProgrammePrefixes) {
    if (!KNOWN_PROGRAMME_STRINGS.some((known) => known.startsWith(prefix))) {
      warnings.push(`Eligible programme "${prefix}" matches none of the programmes onboarding offers, so nobody could ever take this.`);
    }
  }

  if (ctx.catalog) {
    const { catalog } = ctx;
    for (const group of record.groups) {
      const unknown = [...(group.moduleCodes ?? []), ...(group.excludeCodes ?? [])].filter((c) => !catalog.has(c));
      if (unknown.length) {
        warnings.push(`Group "${group.label}": ${unknown.join(", ")} not in NUSMods' recent module lists (retired, renamed or mistyped).`);
      }
      for (const prefix of group.codePrefixes ?? []) {
        if (![...catalog].some((c) => c.startsWith(prefix))) {
          warnings.push(`Group "${group.label}": no module starts with "${prefix}", so that pattern matches nothing.`);
        }
      }
    }
  } else {
    warnings.push("Module codes were not checked against NUSMods (no module list available; run once online).");
  }

  return warnings;
}

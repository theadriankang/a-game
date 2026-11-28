import type { ProgrammeRecord } from "../../../src/lib/programmes/schema";

const codesOf = (p: ProgrammeRecord, key: "moduleCodes" | "codePrefixes" | "excludeCodes") =>
  new Set(p.groups.flatMap((g) => g[key] ?? []));

function setDiff(label: string, draft: Set<string>, published: Set<string>): string[] {
  const onlyDraft = [...draft].filter((c) => !published.has(c)).sort();
  const onlyPublished = [...published].filter((c) => !draft.has(c)).sort();
  const lines: string[] = [];
  if (onlyDraft.length) lines.push(`${label} only in the draft: ${onlyDraft.join(", ")}`);
  if (onlyPublished.length) lines.push(`${label} only in the published record: ${onlyPublished.join(", ")}`);
  return lines;
}

/**
 * Where a fresh extraction differs from what's already published for the same programme, so a re-extract (page
 * changed? model drifted?) can be judged at a glance. Empty = the structured requirements agree. Compares the whole
 * programme's codes and totals rather than matching group to group, since two sources can split the same
 * requirement into different groups.
 */
export function compareToPublished(draft: ProgrammeRecord, published: ProgrammeRecord): string[] {
  const lines: string[] = [];
  if (draft.totalMcMin !== published.totalMcMin || draft.totalMcMax !== published.totalMcMax) {
    lines.push(
      `Total MC: draft ${draft.totalMcMin}${draft.totalMcMax ? `-${draft.totalMcMax}` : ""}, published ${published.totalMcMin}${published.totalMcMax ? `-${published.totalMcMax}` : ""}`
    );
  }
  const mcList = (p: ProgrammeRecord) => p.groups.map((g) => g.requiredMc).sort((a, b) => a - b).join(",");
  if (mcList(draft) !== mcList(published)) {
    lines.push(`Group sizes (MC): draft [${mcList(draft)}], published [${mcList(published)}]`);
  }
  lines.push(...setDiff("Module codes", codesOf(draft, "moduleCodes"), codesOf(published, "moduleCodes")));
  lines.push(...setDiff("Code prefixes", codesOf(draft, "codePrefixes"), codesOf(published, "codePrefixes")));
  lines.push(...setDiff("Excluded codes", codesOf(draft, "excludeCodes"), codesOf(published, "excludeCodes")));
  lines.push(
    ...setDiff(
      "Excluded programmes",
      new Set(draft.excludedProgrammePrefixes),
      new Set(published.excludedProgrammePrefixes)
    )
  );
  return lines;
}

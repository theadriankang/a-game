// Fetch (or reuse stored) raw snapshots, parse them with the per-layout
// adapters, validate, and write data/exemptions/rules/<AY>.json plus a
// human-readable REPORT.md. Nothing here touches the database - review the
// JSON diff first, then run load.ts.
//
//   npm run exemptions:build -- [--refresh] [--offline] [--verbose]
//   npm run exemptions:build -- --only id,id | --ay 2026-27     (dry run: prints, writes nothing)

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ADAPTERS } from "./adapters";
import { BlockedError, DATA_DIR, getRawDoc } from "./lib/fetch-raw";
import { SOURCES } from "./sources";
import { AyFileSchema, RuleRowSchema, groupRows, type AyFile, type RuleRow } from "./lib/types";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt("only")?.split(",");
const onlyAy = opt("ay");

const looksPolluted = (credential: string) =>
  credential.length > 90 || /polytechnic|\bunits?\b|\bMCs?\b|unrestricted/i.test(credential) || /^[-–—]/.test(credential);

type Outcome = { id: string; ay: string; faculty: string; rows: number; warnings: string[]; gap?: string };

async function main() {
  const byAy = new Map<string, { academicYear: string; sources: AyFile["sources"]; rows: RuleRow[] }>();
  const outcomes: Outcome[] = [];
  let hardFailures = 0;

  const ensureAy = (ay: string) => {
    if (!byAy.has(ay)) byAy.set(ay, { academicYear: ay, sources: [], rows: [] });
    return byAy.get(ay)!;
  };

  for (const spec of SOURCES) {
    if (only && !only.includes(spec.id)) continue;
    if (onlyAy && spec.academicYear !== onlyAy) continue;
    const adapter = ADAPTERS[spec.adapter];
    if (!adapter) throw new Error(`${spec.id}: unknown adapter "${spec.adapter}"`);
    try {
      const { doc, sha256 } = await getRawDoc(spec, adapter, { refresh: flag("refresh"), offline: flag("offline") });
      const parsed = await adapter.parse(doc, spec);
      const valid: RuleRow[] = [];
      const rejected = new Set<string>();
      for (const row of parsed.rows) {
        const r = RuleRowSchema.safeParse(row);
        if (!r.success) {
          parsed.warnings.push(`invalid row ${row.credential}/${row.moduleCode}: ${r.error.issues[0]?.message}`);
        } else if (r.data.qualification === "POLYTECHNIC" && looksPolluted(r.data.credential)) {
          // Several diplomas from one merged cell collapsed into one name (or table text leaked in):
          // better to store nothing than a wrong entry. Listed in the report for manual review.
          rejected.add(r.data.credential);
        } else {
          valid.push(r.data);
        }
      }
      for (const c of rejected) parsed.warnings.push(`NOT STORED (unreliable diploma name, needs manual review): "${c.slice(0, 160)}"`);
      const file = ensureAy(spec.academicYear);
      file.sources.push({ id: spec.id, faculty: spec.faculty, url: doc.url, snapshotAt: doc.snapshotAt, sha256 });
      file.rows.push(...valid);
      outcomes.push({ id: spec.id, ay: spec.academicYear, faculty: spec.faculty, rows: valid.length, warnings: parsed.warnings });
    } catch (e) {
      if (e instanceof BlockedError) {
        outcomes.push({ id: spec.id, ay: spec.academicYear, faculty: spec.faculty, rows: 0, warnings: [], gap: e.message });
      } else {
        hardFailures++;
        outcomes.push({ id: spec.id, ay: spec.academicYear, faculty: spec.faculty, rows: 0, warnings: [], gap: `ERROR ${(e as Error).message}` });
      }
    }
  }

  // A filtered run only sees some sources, so writing it would silently drop
  // everyone else's rows from the year file. Partial runs are dry runs.
  const partial = Boolean(only || onlyAy);
  await mkdir(path.join(DATA_DIR, "rules"), { recursive: true });
  for (const [ay, collected] of byAy) {
    // Stable ordering so JSON diffs between runs show only real changes.
    const rules = groupRows(collected.rows).sort((a, b) =>
      [a.faculty, a.qualification, a.institution ?? "", a.credentialKey, a.programmes.join()].join("|")
        .localeCompare([b.faculty, b.qualification, b.institution ?? "", b.credentialKey, b.programmes.join()].join("|"))
    );
    // Policy caps total APC at 40 units; a bigger total usually means a diploma was merged from two packages.
    for (const g of rules) {
      const total = g.grants.reduce((n, x) => n + x.mc, 0);
      if (g.qualification === "POLYTECHNIC" && total > 40) {
        console.warn(`! ${ay} ${g.faculty} / ${g.institution} / ${g.credential}: grants total ${total} units (> 40) - check for a merged package`);
      }
    }
    const file: AyFile = { academicYear: ay, sources: collected.sources.sort((a, b) => a.id.localeCompare(b.id)), rules };
    AyFileSchema.parse(file);
    // One rule per line so year-over-year git diffs show exactly which diplomas changed.
    const json = `{"academicYear":${JSON.stringify(ay)},\n"sources":${JSON.stringify(file.sources, null, 1)},\n"rules":[\n${rules.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`;
    if (!partial) await writeFile(path.join(DATA_DIR, "rules", `${ay}.json`), json);
  }

  const lines = ["# Exemption ingestion report", "", "| source | AY | faculty | rows | notes |", "|---|---|---|---|---|"];
  for (const o of outcomes.sort((a, b) => a.ay.localeCompare(b.ay) || a.id.localeCompare(b.id))) {
    const note = o.gap ? `**GAP** ${o.gap}` : o.warnings.length ? `${o.warnings.length} warning(s)` : "ok";
    lines.push(`| ${o.id} | ${o.ay} | ${o.faculty} | ${o.rows} | ${note} |`);
  }
  const detail = outcomes.filter((o) => o.warnings.length);
  if (detail.length) {
    lines.push("", "## Warnings");
    for (const o of detail) {
      lines.push("", `### ${o.id}`);
      for (const w of o.warnings.slice(0, 60)) lines.push(`- ${w}`);
      if (o.warnings.length > 60) lines.push(`- ...and ${o.warnings.length - 60} more`);
    }
  }
  if (!only && !onlyAy) await writeFile(path.join(DATA_DIR, "REPORT.md"), lines.join("\n") + "\n");
  console.log(lines.slice(0, 4 + outcomes.length).join("\n"));
  if (flag("verbose")) for (const o of detail) { console.log(`\n## ${o.id}`); o.warnings.forEach((w) => console.log(`- ${w}`)); }
  if (partial) console.log("\n(partial run: nothing written - run without --only/--ay to update data/exemptions)");
  const warnCount = detail.reduce((n, o) => n + o.warnings.length, 0);
  console.log(`\n${outcomes.length} sources, ${warnCount} warnings, ${hardFailures} hard failures`);
  if (hardFailures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

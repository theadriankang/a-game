// Move a reviewed draft into the published data (data/programmes/programmes.json).
//
//   npm run programmes:promote -- <id>
//
// Only edits files in git, so it's reviewed like any other change; nothing reaches the database until
// `npm run programmes:load -- --yes`. Refuses a draft with errors. Warnings are printed, not blocking: they're
// what the reviewer was meant to read before getting here.

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProgrammeRecordSchema, ProgrammesFileSchema, type ProgrammeRecord } from "../../src/lib/programmes/schema";
import type { Draft } from "./extract";
import { DRAFTS_DIR, PUBLISHED_FILE } from "./lib/paths";

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith("-")) throw new Error("Usage: npm run programmes:promote -- <id>   (a file name in data/programmes/drafts)");

  const draftFile = path.join(DRAFTS_DIR, `${id}.json`);
  const draft = JSON.parse(await readFile(draftFile, "utf8").catch(() => {
    throw new Error(`No draft at ${path.relative(process.cwd(), draftFile)}. Run programmes:extract -- --only ${id} first.`);
  })) as Draft;

  if (draft.errors.length || !draft.record) {
    throw new Error(`Refusing to promote ${id}: the draft has errors.\n  ${draft.errors.join("\n  ")}`);
  }
  // Parse again rather than trusting the file: a draft can be hand-edited during review.
  const record: ProgrammeRecord = ProgrammeRecordSchema.parse(draft.record);

  const current = ProgrammesFileSchema.parse(JSON.parse(await readFile(PUBLISHED_FILE, "utf8")));
  const replaced = current.programmes.some((p) => p.id === record.id);
  const programmes = [...current.programmes.filter((p) => p.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id));
  const next = ProgrammesFileSchema.parse({ programmes });

  await writeFile(PUBLISHED_FILE, JSON.stringify(next, null, 2) + "\n");
  await rm(draftFile);

  console.log(`${replaced ? "Replaced" : "Added"} ${record.id} (${record.label}) in ${path.relative(process.cwd(), PUBLISHED_FILE)}; draft removed.`);
  for (const w of draft.warnings) console.log(`  warning that was on the draft: ${w}`);
  if (draft.differences?.length) console.log(`  it differed from the previous record in ${draft.differences.length} way(s) - check the git diff.`);
  console.log("Next: review `git diff data/programmes`, then `npm run programmes:load -- --dry-run`.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

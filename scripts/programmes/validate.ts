// Check the published data: schema, group arithmetic, module codes against NUSMods, excluded-programme names.
//
//   npm run programmes:validate                 schema errors fail the run; warnings are listed
//   npm run programmes:validate -- --strict     warnings fail it too
//   npm run programmes:validate -- --offline    use the cached NUSMods module lists only

import { readFile } from "node:fs/promises";
import { ProgrammesFileSchema } from "../../src/lib/programmes/schema";
import { loadCatalogCodes } from "./lib/catalog";
import { checkRecord } from "./lib/check";
import { PUBLISHED_FILE } from "./lib/paths";

async function main() {
  const parsed = ProgrammesFileSchema.safeParse(JSON.parse(await readFile(PUBLISHED_FILE, "utf8")));
  if (!parsed.success) {
    console.error("programmes.json does not match the schema:");
    for (const i of parsed.error.issues) console.error(`  ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }

  const catalog = await loadCatalogCodes({ offline: process.argv.includes("--offline") });
  let warningCount = 0;
  for (const programme of parsed.data.programmes) {
    const warnings = checkRecord(programme, { catalog });
    warningCount += warnings.length;
    console.log(`${warnings.length ? "!" : "ok"} ${programme.id} (${programme.groups.length} groups, ${programme.totalMcMin} MC)`);
    for (const w of warnings) console.log(`    ${w}`);
  }
  console.log(`\n${parsed.data.programmes.length} programmes, ${warningCount} warning(s).`);
  if (warningCount && process.argv.includes("--strict")) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

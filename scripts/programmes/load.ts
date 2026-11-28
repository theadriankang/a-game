// Load data/programmes/programmes.json into Postgres, replacing the programmes table.
// Reference data only - never touches users or planner entries.
//
//   npm run programmes:load -- --dry-run       validate and list, connect to nothing
//   npm run programmes:load -- --yes           actually write (uses DATABASE_URL)
//
// Until this has been run against a database, the app serves the same JSON bundled with the deploy, so there is no
// window where the Minors page is empty - but a database that was loaded earlier keeps winning until it is
// reloaded, so run this after promoting a draft.

import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { ProgrammesFileSchema } from "../../src/lib/programmes/schema";
import { PUBLISHED_FILE } from "./lib/paths";

const KIND_TO_DB = { minor: "MINOR", "second-major": "SECOND_MAJOR", specialisation: "SPECIALISATION" } as const;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) throw new Error("DATABASE_URL is not set (put it in .env or the shell).");

  const { programmes } = ProgrammesFileSchema.parse(JSON.parse(await readFile(PUBLISHED_FILE, "utf8")));
  if (programmes.length === 0) throw new Error("programmes.json is empty; refusing to replace the table with nothing.");

  console.log(`Target database host: ${url ? new URL(url).host : "(none)"}`);
  for (const p of programmes) console.log(`  ${p.kind.padEnd(12)} ${p.id}  (${p.groups.length} groups)`);
  if (dryRun) return console.log("\nDry run: nothing written.");
  if (!confirmed) {
    console.log("\nRefusing to write without --yes (this replaces the programmes table).");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.programme.deleteMany();
      await tx.programme.createMany({
        data: programmes.map((p) => ({
          id: p.id,
          kind: KIND_TO_DB[p.kind],
          label: p.label,
          department: p.department,
          totalMcMin: p.totalMcMin,
          totalMcMax: p.totalMcMax ?? null,
          groups: p.groups as unknown as Prisma.InputJsonValue,
          excludedProgrammePrefixes: p.excludedProgrammePrefixes,
          eligibleProgrammePrefixes: p.eligibleProgrammePrefixes,
          application: p.application ? (p.application as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          sourceUrl: p.sourceUrl,
          sourceCheckedDate: p.sourceCheckedDate,
          caveats: p.caveats,
          cohortNote: p.cohortNote ?? null,
          cohortFrom: p.cohortFrom ?? null,
          cohortTo: p.cohortTo ?? null,
        })),
      });
    });
    console.log(`\nLoaded ${programmes.length} programmes.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

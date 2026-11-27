// Load data/exemptions/rules/<AY>.json into Postgres (replacing that AY's rows).
// Reference data only - never touches users or planner entries.
//
//   npm run exemptions:load -- --dry-run       show what would change
//   npm run exemptions:load -- --yes           actually write (uses DATABASE_URL)

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { AyFileSchema } from "./lib/types";
import { DATA_DIR } from "./lib/fetch-raw";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) throw new Error("DATABASE_URL is not set (put it in .env or the shell).");
  const host = url ? new URL(url).host : "(none)";

  const dir = path.join(DATA_DIR, "rules");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const parsed = [];
  for (const f of files) parsed.push(AyFileSchema.parse(JSON.parse(await readFile(path.join(dir, f), "utf8"))));

  console.log(`Target database host: ${host}`);
  for (const ay of parsed) console.log(`  AY${ay.academicYear}: ${ay.rules.length} rules`);
  if (dryRun) return console.log("\nDry run: nothing written.");
  if (!confirmed) {
    console.log("\nRefusing to write without --yes (this replaces exemption_rules for the years above).");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    for (const ay of parsed) {
      await prisma.$transaction(async (tx) => {
        await tx.exemptionRule.deleteMany({ where: { academicYear: ay.academicYear } });
        await tx.exemptionRule.createMany({
          data: ay.rules.map((r) => ({
            academicYear: r.academicYear,
            faculty: r.faculty,
            programmes: r.programmes,
            qualification: r.qualification,
            institution: r.institution,
            credential: r.credential,
            credentialKey: r.credentialKey,
            grants: r.grants as unknown as Prisma.InputJsonValue,
            sourceUrl: r.sourceUrl,
            snapshotAt: r.snapshotAt ? new Date(r.snapshotAt) : null,
          })),
        });
      });
      console.log(`Loaded AY${ay.academicYear}: ${ay.rules.length} rules`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

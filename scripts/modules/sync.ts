// Copy NUSMods' module lists into the catalog_modules table.
//
// NUSMods publishes a public JSON API (api.nusmods.com/v2) - no scraping.
// One small moduleList.json per academic year (~110 KB each) gives codes and
// titles; the current year's moduleInfo.json (~4 MB) adds module credits.
//
//   npm run modules:sync -- --dry-run     fetch and summarise, write nothing
//   npm run modules:sync -- --yes         replace the catalog (uses DATABASE_URL)

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const BASE = "https://api.nusmods.com/v2";
const UA = "a-game-module-sync/0.1 (occasional manual runs)";
const YEARS_BACK = 4; // current AY plus four earlier ones: covers every cohort still enrolled, plus renamed/retired modules
const MIN_EXPECTED = 5000; // a broken response must never wipe the catalog

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.status === 404) return null; // that AY isn't published (yet)
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (attempt === 4) throw new Error(`${url}: ${String(e)}`);
      await sleep(2000 * attempt);
    }
  }
  return null;
}

/** NUS academic years start in August. */
function currentIntakeYear(now = new Date()) {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}
const ayLabel = (y: number) => `${y}-${y + 1}`;

type Listed = { moduleCode: string; title: string };
type Info = { moduleCode: string; moduleCredit: string };

async function main() {
  const current = currentIntakeYear();
  const years = Array.from({ length: YEARS_BACK + 2 }, (_, i) => current - YEARS_BACK + i); // oldest .. next year

  const catalog = new Map<string, { title: string; academicYears: string[] }>();
  const fetched: string[] = [];
  for (const y of years) {
    const ay = ayLabel(y);
    const list = await getJson<Listed[]>(`${BASE}/${ay}/moduleList.json`);
    await sleep(500);
    if (!list) {
      console.log(`  AY${ay}: not published, skipped`);
      continue;
    }
    fetched.push(ay);
    for (const m of list) {
      const have = catalog.get(m.moduleCode);
      if (have) {
        have.title = m.title; // years run oldest -> newest, so the newest title wins
        have.academicYears.push(ay);
      } else {
        catalog.set(m.moduleCode, { title: m.title, academicYears: [ay] });
      }
    }
    console.log(`  AY${ay}: ${list.length} modules`);
  }
  if (fetched.length === 0) throw new Error("No academic year could be fetched.");

  // Module credits come only from moduleInfo.json, which is large, so read just the newest year.
  const newest = fetched[fetched.length - 1];
  const info = await getJson<Info[]>(`${BASE}/${newest}/moduleInfo.json`);
  const mcByCode = new Map<string, number>();
  for (const m of info ?? []) {
    const mc = parseFloat(m.moduleCredit);
    if (Number.isFinite(mc)) mcByCode.set(m.moduleCode, mc);
  }

  const rows = [...catalog.entries()].map(([code, v]) => ({
    code,
    title: v.title,
    mc: mcByCode.get(code) ?? null,
    academicYears: v.academicYears,
    lastListedAy: v.academicYears[v.academicYears.length - 1] as string | null, // years run oldest -> newest
  }));
  // Modules our exemption rules name but NUSMods doesn't list (retired ones like CS1020, APC placeholders like
  // POY1901, EG3611P): add them from the rule data so a student typing one is recognised, not told it's unknown.
  let addedFromRules: string[] = [];
  try {
    const dir = path.resolve(process.cwd(), "data/exemptions/rules");
    const named = new Map<string, { title: string; mc: number }>();
    for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json"))) {
      const j = JSON.parse(await readFile(path.join(dir, f), "utf8")) as {
        rules: { grants: { moduleCode: string | null; label: string; mc: number }[] }[];
      };
      for (const r of j.rules)
        for (const g of r.grants) {
          if (!g.moduleCode || named.has(g.moduleCode)) continue;
          const title = g.label.replace(g.moduleCode, "").trim();
          named.set(g.moduleCode, { title: title || "Listed in NUS exemption lists", mc: g.mc });
        }
    }
    for (const [code, v] of named) {
      if (catalog.has(code)) continue;
      rows.push({ code, title: v.title, mc: v.mc, academicYears: ["exemption-lists"], lastListedAy: null });
      addedFromRules.push(code);
    }
  } catch {
    // no rule files yet: nothing to add
  }
  addedFromRules = addedFromRules.sort();

  console.log(
    `\n${rows.length} modules (${rows.length - addedFromRules.length} from NUSMods across ${fetched.join(", ")}); ` +
      `${rows.filter((r) => r.mc !== null).length} with credits`
  );
  console.log(`added from exemption lists (not in NUSMods): ${addedFromRules.length ? addedFromRules.join(", ") : "none"}`);

  if (rows.length < MIN_EXPECTED) throw new Error(`Only ${rows.length} modules (< ${MIN_EXPECTED}); refusing to replace the catalog with that.`);
  if (dryRun) return console.log("\nDry run: nothing written.");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (put it in .env or the shell).");
  console.log(`\nTarget database host: ${new URL(url).host}`);
  if (!confirmed) {
    console.log("Refusing to write without --yes (this replaces catalog_modules).");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.catalogModule.deleteMany();
        for (let i = 0; i < rows.length; i += 2000) await tx.catalogModule.createMany({ data: rows.slice(i, i + 2000) });
      },
      { timeout: 120_000 }
    );
    console.log(`Loaded ${rows.length} modules.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

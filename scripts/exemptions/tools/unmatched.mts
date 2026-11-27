// Dev tool: published diplomas (per faculty rules) with no counterpart in the app's diploma list.
//   npx tsx scripts/exemptions/tools/unmatched.ts 2026-27
import { readFile } from "node:fs/promises";
import path from "node:path";
import { credentialKey } from "../../../src/lib/exemptions/normalize";
import { polytechnics } from "../../../src/lib/education-data/polytechnic-diplomas";
import { AyFileSchema } from "../lib/types";

const ay = process.argv[2] ?? "2026-27";
const file = AyFileSchema.parse(JSON.parse(await readFile(path.resolve(process.cwd(), `data/exemptions/rules/${ay}.json`), "utf8")));
const app = new Set(polytechnics.flatMap((p) => p.schools.flatMap((s) => s.diplomas.map((d) => `${p.name}|${credentialKey(d)}`))));
const published = new Map<string, { names: Set<string>; faculties: Set<string> }>();
for (const r of file.rules) {
  if (r.qualification !== "POLYTECHNIC" || r.credentialKey === "*") continue;
  const k = `${r.institution}|${r.credentialKey}`;
  const e = published.get(k) ?? { names: new Set(), faculties: new Set() };
  e.names.add(r.credential);
  e.faculties.add(r.faculty.split(" ").slice(-1)[0]);
  published.set(k, e);
}
const miss = [...published].filter(([k]) => !app.has(k));
console.log(`AY${ay}: ${published.size} published (institution, diploma) pairs; ${published.size - miss.length} match the app's list, ${miss.length} do not\n`);
for (const [k, v] of miss.sort()) console.log(`  ${k.split("|")[0].padEnd(22)} ${[...v.names][0]}  [${[...v.faculties].join("/")}]`);
const used = new Set(published.keys());
const appOnly = [...app].filter((k) => !used.has(k));
console.log(`\napp diplomas with no published list in any faculty: ${appOnly.length} of ${app.size} (expected: many are not accredited / not eligible for programme exemptions)`);

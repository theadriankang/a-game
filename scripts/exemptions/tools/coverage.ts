// Dev tool: run the runtime matcher over the generated rule files, without a database.
//   npx tsx scripts/exemptions/tools/coverage.ts            coverage of the app's diploma list per AY/programme
//   npx tsx scripts/exemptions/tools/coverage.ts sample     a few sample students
import { readFile } from "node:fs/promises";
import path from "node:path";
import { suggestFromRules, type RuleLike } from "../../../src/lib/exemptions/suggest";
import { polytechnics } from "../../../src/lib/education-data/polytechnic-diplomas";
import { nusFaculties } from "../../../src/lib/education-data/nus-programmes";
import { AyFileSchema } from "../lib/types";

const DIR = path.resolve(process.cwd(), "data/exemptions/rules");
async function load(ay: string): Promise<RuleLike[]> {
  const f = AyFileSchema.parse(JSON.parse(await readFile(path.join(DIR, `${ay}.json`), "utf8")));
  return f.rules.map((r) => ({ ...r }));
}

const AYS = ["2023-24", "2024-25", "2025-26", "2026-27"];

async function main() {
  if (process.argv[2] === "sample") {
    const rules = await load("2026-27");
    const cases = [
      { faculty: "School of Computing", programme: "Bachelor of Computing in Computer Science", institution: "Nanyang Polytechnic", credential: "Diploma in AI & Data Engineering" },
      { faculty: "School of Computing", programme: "Bachelor of Computing in Computer Science", institution: "Temasek Polytechnic", credential: "Diploma in Applied AI & Analytics" },
      { faculty: "College of Design and Engineering", programme: "Bachelor of Engineering (Mechanical Engineering)", institution: "Singapore Polytechnic", credential: "Diploma in Mechanical Engineering" },
      { faculty: "Faculty of Science", programme: "Bachelor of Science (Honours) - Mathematics", institution: "Ngee Ann Polytechnic", credential: "Diploma in Accountancy" },
      { faculty: "NUS Business School", programme: "Bachelor of Business Administration (Honours) - Finance", institution: "Republic Polytechnic", credential: "Diploma in Banking & Finance" },
    ];
    for (const c of cases) {
      const s = suggestFromRules(rules, { ...c, qualification: "POLYTECHNIC" });
      console.log(`\n${c.programme.slice(0, 55)} | ${c.institution} | ${c.credential}\n  coverage=${s.coverage}  modules=[${s.modules.map((m) => `${m.moduleCode}(${m.mc})`).join(", ")}]  generic=[${s.generic.map((g) => `${g.mc}MC`).join(", ")}]`);
    }
    return;
  }

  // For each AY and each (programme with a published list), how many of the app's diplomas match something?
  const probes = [
    ["School of Computing", "Bachelor of Computing in Computer Science"],
    ["College of Design and Engineering", "Bachelor of Engineering (Mechanical Engineering)"],
    ["College of Design and Engineering", "Bachelor of Arts (Architecture)"],
    ["Yong Loo Lin School of Medicine", "Bachelor of Science (Nursing)"],
  ];
  const allDiplomas = polytechnics.flatMap((p) => p.schools.flatMap((s) => s.diplomas.map((d) => ({ poly: p.name, d }))));
  console.log(`app lists ${allDiplomas.length} diplomas across ${polytechnics.length} polytechnics; ${nusFaculties.length} faculties\n`);
  for (const ay of AYS) {
    const rules = await load(ay);
    const line: string[] = [];
    for (const [faculty, programme] of probes) {
      const hit = allDiplomas.filter(({ poly, d }) => {
        const s = suggestFromRules(rules, { faculty, programme, qualification: "POLYTECHNIC", institution: poly, credential: d });
        return s.modules.length > 0;
      }).length;
      line.push(`${programme.replace(/Bachelor of (Engineering|Arts|Computing in|Science)\s*/, "").slice(0, 22)}=${hit}`);
    }
    console.log(`AY${ay}: diplomas with >=1 module suggestion -> ${line.join(" | ")}`);
  }

  // Published diplomas the app can't match (renamed/absent in the app's list): the gaps to review.
  const rules = await load("2026-27");
  const known = new Set(allDiplomas.map((x) => `${x.poly}|${suggestFromRules.name && x.d}`));
  void known;
}
main();

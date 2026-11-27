// Alice Lee Centre for Nursing Studies (under Yong Loo Lin School of
// Medicine): one table of  Polytechnic | Diploma | Course granted | Units,
// with merged cells for the polytechnic/diploma/total columns, so a row only
// carries the cells that start a new group.

import * as cheerio from "cheerio";
import type { Adapter, RuleRow } from "../lib/types";
import { canonicalPolytechnic, credentialKey } from "../../../src/lib/exemptions/normalize";
import { htmlText, squash } from "../lib/text";

const FACULTY = "Yong Loo Lin School of Medicine";
const PROGRAMMES = ["Bachelor of Science (Nursing)", "Bachelor of Science (Nursing) (Honours)"];
const MODULE_CELL = /^([A-Z]{2,4}\d{4}[A-Z]{0,2})\s+(.+)$/;

export const nursingPoly: Adapter = {
  // The page states one table "for cohort admitted in AY2023 onwards", so every
  // intake from AY2023/24 is covered by the same capture.
  detectAcademicYear(doc, spec) {
    const m = htmlText(doc.html ?? "").match(/cohort admitted in AY\s?(20\d{2}) onwards/i);
    const want = Number(spec.academicYear.slice(0, 4));
    return m && want >= Number(m[1]) ? want : null;
  },

  parse(doc, spec) {
    const $ = cheerio.load(doc.html ?? "");
    const rows: RuleRow[] = [];
    const warnings: string[] = [];
    const tables = $("table").toArray().filter((t) => /Courses Granted APC/i.test($(t).text()));
    if (tables.length !== 1) warnings.push(`expected 1 APC table, found ${tables.length}`);

    for (const table of tables.slice(0, 1)) {
      let poly: string | null = null;
      let diploma: string | null = null;
      for (const tr of $(table).find("tr").toArray()) {
        const cells = $(tr)
          .children("td,th")
          .toArray()
          .map((c) => squash($(c).text()))
          .filter(Boolean);
        let module: { code: string; title: string } | null = null;
        let units: number | null = null;
        for (const text of cells) {
          const m = text.match(MODULE_CELL);
          if (m && !module) {
            module = { code: m[1], title: m[2] };
          } else if (/^\d+$/.test(text)) {
            if (module && units === null) units = Number(text);
          } else if (!module) {
            const p = canonicalPolytechnic(text);
            if (p && text.length < 40) {
              poly = p;
              diploma = null;
            } else if (/^(polytechnic|diploma|courses granted apc|units)$/i.test(text) || /effective|advanced placement credits/i.test(text)) {
              // header cells
            } else {
              diploma = text;
            }
          }
        }
        if (!module) continue;
        if (!poly || !diploma || units === null) {
          warnings.push(`row for ${module.code} missing context (poly=${poly}, diploma=${diploma}, units=${units})`);
          continue;
        }
        rows.push({
          academicYear: spec.academicYear,
          faculty: FACULTY,
          programmes: PROGRAMMES,
          qualification: "POLYTECHNIC",
          institution: poly,
          credential: diploma,
          credentialKey: credentialKey(diploma),
          moduleCode: module.code,
          label: `${module.code} ${module.title}`,
          mc: units,
          kind: "PROGRAMME",
          grant: "AUTOMATIC",
          note: "Only for specified diplomas obtained within the last 5 years.",
          sourceUrl: doc.url,
          snapshotAt: doc.snapshotAt,
        });
      }
    }
    return { rows, warnings };
  },
};

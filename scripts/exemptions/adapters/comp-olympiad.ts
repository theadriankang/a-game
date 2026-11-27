// School of Computing: course exemptions for NOI / IOI medallists. A single
// small table of  Category | Computing course exemption. The exemption is an
// option (and credit only follows a passed placement test), so every row is
// OPT_IN. The page lists codes without units, so MC is assumed to be the
// standard 4 and flagged.

import * as cheerio from "cheerio";
import type { Adapter, RuleRow } from "../lib/types";
import { credentialKey, extractModuleCodes } from "../../../src/lib/exemptions/normalize";
import { htmlText, squash } from "../lib/text";

export const compOlympiad: Adapter = {
  detectAcademicYear(doc, spec) {
    const t = htmlText(doc.html ?? "");
    return /IOI/.test(t) && /NOI/.test(t) && /CS1010/.test(t) ? Number(spec.academicYear.slice(0, 4)) : null;
  },

  parse(doc, spec) {
    const $ = cheerio.load(doc.html ?? "");
    const rows: RuleRow[] = [];
    const warnings: string[] = [];
    const table = $("table").toArray().find((t) => /Computing Course exemption/i.test($(t).text()));
    if (!table) return { rows, warnings: ["exemption table not found"] };

    $(table).find("sup").remove(); // footnote markers sit inside the module cells
    for (const tr of $(table).find("tr").toArray()) {
      const cells = $(tr).children("td");
      if (cells.length < 2) continue; // header row
      // Category cells can hold lists ("...from the following countries: <li>China...</li>"), so join them.
      const category = squash($(cells[0]).clone().find("li,p").append(" ").end().text());
      const moduleCodes = extractModuleCodes($(cells[cells.length - 1]).text());
      if (moduleCodes.length === 0) {
        warnings.push(`no module codes in row "${category.slice(0, 60)}"`);
        continue;
      }
      for (const moduleCode of moduleCodes) {
        rows.push({
          academicYear: spec.academicYear,
          faculty: "School of Computing",
          programmes: [],
          qualification: "OLYMPIAD",
          institution: null,
          credential: category,
          credentialKey: credentialKey(category),
          moduleCode,
          label: moduleCode,
          mc: 4,
          kind: "PROGRAMME",
          grant: "OPT_IN",
          note: "Optional exemption; if you take it you must make up the units with other courses. Sit and pass the placement test to receive credit instead.",
          sourceUrl: doc.url,
          snapshotAt: doc.snapshotAt,
        });
      }
    }
    if (rows.length) warnings.push("info: MC not stated on the page; assumed 4 per module");
    return { rows, warnings };
  },
};

// School of Computing: "Exemption Scheme for Diplomas Awarded by Local
// Polytechnics". One HTML table per polytechnic; first column is the diploma,
// the remaining columns are the extra courses exempted for a group of
// programmes, written as `CP3200(6), CS1010(4)`.
//
// Layout notes (checked against captures AY2022/23 -> AY2027/28):
//  - AY23/24-24/25 columns: "CS BComp (CS, InfoSec)" | "IS" | "BA"
//  - AY25/26 onwards:       "CS BComp (CS, AI, InfoSec)" | "IS/BAIS/BZA"
//  - Renamed diplomas appear as "New name [Formerly known as Old name]".

import * as cheerio from "cheerio";
import type { Adapter, RuleRow } from "../lib/types";
import { canonicalPolytechnic, credentialKey, parseAcademicYear } from "../../../src/lib/exemptions/normalize";

const FACULTY = "School of Computing";
const CS = "Bachelor of Computing in Computer Science";
const AI = "Bachelor of Computing in Artificial Intelligence";
const INFOSEC = "Bachelor of Computing in Information Security";
const BAIS = "Bachelor of Computing in Business Artificial Intelligence Systems";
const BA = "Bachelor of Science in Business Analytics";

/** Column header -> app programme names it covers. "IS" (Information Systems) has no app programme. */
function programmesForColumn(label: string): string[] {
  const out = new Set<string>();
  if (/\bCS\b/.test(label)) out.add(CS);
  if (/\bAI\b/.test(label)) out.add(AI);
  if (/InfoSec/i.test(label)) out.add(INFOSEC);
  if (/\bBAIS\b/.test(label)) out.add(BAIS);
  if (/\bBZA\b|\bBA\b/.test(label)) out.add(BA);
  return [...out];
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function cellText($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  const c = $(el).clone();
  c.find("br").replaceWith(" ");
  c.find("p,div,li").each((_, n) => {
    $(n).append(" ");
  });
  return clean(c.text());
}

function splitDiplomaCell(text: string): { name: string; aliases: string[] } {
  const aliases: string[] = [];
  // Renames are written as "[Formerly known as X]" or "(formerly known as X / Y)".
  const name = clean(
    text.replace(/[\[(]\s*(?:formerly known as|predecessor:?|formerly)\s*([^\])]+)[\])]/gi, (_, inner: string) => {
      aliases.push(...inner.split(/\s*\/\s*/).map(clean).filter(Boolean));
      return " ";
    })
  );
  return { name, aliases };
}

const MODULE_MC_RE = /([A-Z]{2,4}\d{4}[A-Z]{0,2})\s*\(\s*(\d+)\s*\)/g;

export const compPoly: Adapter = {
  detectAcademicYear(doc) {
    const text = (doc.html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;|\s+/g, " ");
    const m = text.match(/admitting in AY\s?(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})/i);
    return m ? parseAcademicYear(`${m[1]}-${m[2]}`) : null;
  },

  parse(doc, spec) {
    const $ = cheerio.load(doc.html ?? "");
    const rows: RuleRow[] = [];
    const warnings: string[] = [];
    const droppedColumns = new Map<string, number>();
    let tables = 0;

    $("table").each((_, table) => {
      const trs = $(table).find("tr").toArray();
      const headerRows = trs.filter((tr) => $(tr).children("th").length > 0 && $(tr).children("td").length === 0);
      const dataRows = trs.filter((tr) => $(tr).children("td").length > 0);
      if (headerRows.length === 0 || dataRows.length === 0) return;

      const firstHeader = cellText($, $(headerRows[0]).children("th").first());
      const institution = canonicalPolytechnic(firstHeader);
      if (!institution) return; // not a polytechnic table
      tables++;

      const dataCols = $(dataRows[0]).children("td").length - 1;
      let labels = $(headerRows[headerRows.length - 1])
        .children("th")
        .toArray()
        .map((th) => cellText($, th));
      if (labels.length === dataCols + 1) labels = labels.slice(1);
      if (labels.length !== dataCols) {
        warnings.push(`${institution}: header has ${labels.length} columns but rows have ${dataCols}; table skipped`);
        return;
      }
      const colProgrammes = labels.map(programmesForColumn);

      for (const tr of dataRows) {
        const tds = $(tr).children("td").toArray();
        const { name, aliases } = splitDiplomaCell(cellText($, tds[0]));
        if (!name) continue;
        // Expand colspans so cell index == column index.
        const cells: string[] = [];
        for (const td of tds.slice(1)) {
          const span = Number($(td).attr("colspan") ?? 1) || 1;
          for (let i = 0; i < span; i++) cells.push(cellText($, td));
        }
        if (cells.length !== dataCols) warnings.push(`${institution} / ${name}: ${cells.length} cells, expected ${dataCols}`);

        cells.forEach((text, col) => {
          const modules = [...text.matchAll(MODULE_MC_RE)];
          const stray = text.replace(MODULE_MC_RE, "").replace(/[\s,;/&\-–—]|nil|n\.?a\.?|none/gi, "");
          if (stray) warnings.push(`${institution} / ${name} / col ${col}: unparsed text "${stray}"`);
          if (modules.length === 0) return;
          const programmes = colProgrammes[col] ?? [];
          if (programmes.length === 0) {
            droppedColumns.set(labels[col], (droppedColumns.get(labels[col]) ?? 0) + modules.length);
            return;
          }
          for (const credential of [name, ...aliases]) {
            for (const [, moduleCode, mc] of modules) {
              rows.push({
                academicYear: spec.academicYear,
                faculty: FACULTY,
                programmes,
                qualification: "POLYTECHNIC",
                institution,
                credential,
                credentialKey: credentialKey(credential),
                moduleCode,
                label: moduleCode,
                mc: Number(mc),
                kind: "PROGRAMME",
                grant: "AUTOMATIC",
                note: credential === name ? null : `Listed under the renamed diploma "${name}"`,
                sourceUrl: doc.url,
                snapshotAt: doc.snapshotAt,
              });
            }
          }
        });
      }
    });

    if (tables !== 5) warnings.push(`expected 5 polytechnic tables, found ${tables}`);
    for (const [label, n] of droppedColumns) {
      warnings.push(`info: column "${label}" has no matching app programme; ${n} grants not stored`);
    }
    return { rows, warnings };
  },
};

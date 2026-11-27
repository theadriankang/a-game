// College of Design and Engineering publishes two PDFs per intake.
//
//  ENG-CEG    Courses granted are defined once ("List N ... Total APCs
//             granted", or in AY23/24 by highlight colour: yellow / green /
//             everything else), then a table of  Polytechnic | Diplomas whose
//             polytechnic label is a vertically merged cell that can break
//             across pages. Two sections: engineering majors, Computer Eng.
//  AKI-BLA-ID One row per diploma:  Diploma (poly + name) | courses granted |
//             total, with a section per programme.
//
// Text alone can't say which merged polytechnic a bullet belongs to, so both
// parsers use the table border rules (lib/pdf-rules.ts) to split each page
// into row fragments, then read the label/bullets inside each fragment.

import { getDocumentProxy } from "unpdf";
import type { Adapter, RawDoc, RuleRow, SourceSpec } from "../lib/types";
import { credentialKey, parseAcademicYear } from "../../../src/lib/exemptions/normalize";
import { pdfItems, squash, type PdfItem } from "../lib/text";
import { colourClass, pdfFills, pdfRules, separatorYs } from "../lib/pdf-rules";
import { nusFaculties } from "../../../src/lib/education-data/nus-programmes";

const FACULTY = "College of Design and Engineering";
const POLY_LINE = /^(Nanyang|Ngee Ann|Republic|Singapore|Temasek) Polytechnic$/i;
const UNITS = "(?:units?|MCs?)";

type Line = { page: number; y: number; items: PdfItem[]; text: string };

function toLines(items: PdfItem[]): Line[] {
  const byPage = new Map<number, PdfItem[]>();
  for (const it of items) (byPage.get(it.page) ?? byPage.set(it.page, []).get(it.page)!).push(it);
  const lines: Line[] = [];
  for (const [page, its] of [...byPage].sort((a, b) => a[0] - b[0])) {
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur: PdfItem[] = [];
    let curY = Infinity;
    const flush = () => {
      if (cur.length) {
        cur.sort((a, b) => a.x - b.x);
        lines.push({ page, y: curY, items: cur, text: squash(cur.map((i) => i.text).join(" ")) });
      }
      cur = [];
    };
    for (const it of its) {
      if (Math.abs(it.y - curY) > 5) {
        flush();
        curY = it.y;
      }
      cur.push(it);
    }
    flush();
  }
  return lines;
}

const programmeByNorm = (() => {
  const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const map = new Map(nusFaculties.flatMap((f) => f.programmes).map((p) => [norm(p), p]));
  return { norm, map };
})();

// Programmes renamed since older PDFs were published (the app uses current names).
const RENAMED_MAJORS: Record<string, string> = {
  "Environmental Engineering": "Environmental and Sustainability Engineering",
};

function mapProgramme(name: string, warnings: string[]): string | null {
  const hit = programmeByNorm.map.get(programmeByNorm.norm(name));
  if (!hit) warnings.push(`info: programme "${name}" is not in the app's programme list; its rows are not stored`);
  return hit ?? null;
}

type Grant = { moduleCode: string | null; label: string; mc: number; kind: RuleRow["kind"] };

/** "EG3611P Industrial Attachment: 10 units" | "AR1101A Design 1 (8 units)*" | "5 Unrestricted Elective Courses (20 units)" | "... : 20 MCs". */
function parseGrant(text: string): Grant | null {
  const t = squash(text.replace(/^[••]\s*/, "")).replace(/\*+\s*$/, "").trim();
  const units = t.match(new RegExp(`(\\d+)\\s*${UNITS}\\)?\\s*$`, "i"));
  if (!units) return null;
  const mc = Number(units[1]);
  if (/unrestricted/i.test(t)) {
    return { moduleCode: null, label: "Unrestricted electives (polytechnic APC)", mc, kind: "UNRESTRICTED_ELECTIVE" };
  }
  const m = t.match(new RegExp(`^([A-Z]{2,4})\\s?(\\d{4}[A-Z]{0,2})\\s+(.+?)\\s*[:(]\\s*\\d+\\s*${UNITS}\\)?\\s*$`, "i"));
  if (!m) return null;
  const code = `${m[1]}${m[2]}`.toUpperCase();
  return { moduleCode: code, label: `${code} ${m[3]}`, mc, kind: "PROGRAMME" };
}

/**
 * "A / B (with Minor in X)" -> variants; "Name (Predecessor: Old)" -> name + old;
 * "(new diploma formed by the merger of Diploma in A & Diploma in B)" -> A, B.
 * The PDFs are hand-typed, so the wording and spacing around these notes vary
 * ("( predecessor is X)", "(P redecessor: X)", a missing closing bracket).
 */
function expandDiploma(raw: string): { name: string; aliases: string[] } {
  let text = squash(raw);
  const aliases: string[] = [];
  text = text.replace(/\(\s*(?:new diploma formed by\s+)?(?:the\s+)?merge(?:r)?\s+(?:of|between)\s+([^)]*)\)?/gi, (_, a: string) => {
    for (const part of a.split(/\s*(?:;\s*and|;|\band)\s+(?=Diploma in)/i)) {
      const cleaned = squash(part.replace(/^Diploma in\s+/i, ""));
      if (cleaned) aliases.push(cleaned);
    }
    return " ";
  });
  text = text.replace(/\(\s*(?:P\s*redecessor|Formerly known as)\s*(?:is|:)?\s*([^)]*)\)?/gi, (_, a: string) => {
    if (squash(a)) aliases.push(squash(a));
    return " ";
  });
  const variants = squash(text).split(/\s+\/\s+/).map(squash).filter(Boolean);
  const [name, ...rest] = variants;
  return { name: name ?? "", aliases: [...rest, ...aliases].filter(Boolean) };
}

function academicYearOf(text: string): number | null {
  const m = text.match(/(?:Academic Year|Cohort AY|AY)\s?(20\d{2}\s*\/\s*20\d{2})/i);
  return m ? parseAcademicYear(m[1].replace(/\s/g, "")) : null;
}

function canonical(label: string): string | null {
  const m = squash(label).match(POLY_LINE);
  if (!m) return null;
  const first = m[1].toLowerCase() === "ngee ann" ? "Ngee Ann" : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return `${first} Polytechnic`;
}

function rowsFor(spec: SourceSpec, doc: RawDoc, programmes: string[], poly: string, diplomaRaw: string, grants: Grant[]): RuleRow[] {
  const { name, aliases } = expandDiploma(diplomaRaw);
  if (!name) return [];
  const out: RuleRow[] = [];
  for (const credential of [name, ...aliases]) {
    for (const g of grants) {
      out.push({
        academicYear: spec.academicYear,
        faculty: FACULTY,
        programmes,
        qualification: "POLYTECHNIC",
        institution: poly,
        credential,
        credentialKey: credentialKey(credential) || "*",
        moduleCode: g.moduleCode,
        label: g.label,
        mc: g.mc,
        kind: g.kind,
        grant: "AUTOMATIC",
        note: credential === name ? null : `Listed under "${name}"`,
        sourceUrl: doc.url,
        snapshotAt: doc.snapshotAt,
      });
    }
  }
  return out;
}

const openPdf = (doc: RawDoc) => getDocumentProxy(new Uint8Array(doc.pdf!));
const headText = (lines: Line[]) => lines.slice(0, 12).map((l) => l.text).join(" ");

// ---------------------------------------------------------------- ENG-CEG

type Def = { total: number | null; grants: Grant[] };
const SECTION_HEADING = /^Acceptable Diplomas for (all Engineering Majors|Computer Engineering)/i;

export const cdeEng: Adapter = {
  async detectAcademicYear(doc) {
    return academicYearOf(headText(toLines(await pdfItems(doc))));
  },

  async parse(doc, spec) {
    const warnings: string[] = [];
    const rows: RuleRow[] = [];
    const pdf = await openPdf(doc);
    const lines = toLines(await pdfItems(doc));
    const gotAy = academicYearOf(headText(lines));
    if (gotAy !== Number(spec.academicYear.slice(0, 4))) {
      return { rows, warnings: [`PDF is labelled AY${gotAy}, expected ${spec.academicYear}; skipped`] };
    }

    type Section = "ENG" | "CEG";
    const sectionOf = (t: string): Section | null => {
      const m = t.match(SECTION_HEADING);
      return m ? (/computer engineering/i.test(m[1]) ? "CEG" : "ENG") : null;
    };

    const majors: string[] = [];
    const defs = new Map<string, Def>(); // `${section}:${list|yellow|green|other}`
    let section: Section = "ENG";
    let defKey: string | null = null;
    let inMajors = false;

    // Pass 1: section headings, majors, and the courses each package grants.
    for (const l of lines) {
      const t = l.text;
      const sec = sectionOf(t);
      if (sec) {
        section = sec;
        defKey = null;
        inMajors = false;
        continue;
      }
      if (/following majors/i.test(t)) {
        inMajors = true;
        continue;
      }
      const major = t.match(/^\d+\.\s*(.+)$/);
      if (inMajors && major) {
        majors.push(major[1]);
        continue;
      }
      let key: string | null = null;
      let total: number | null = null;
      const listDef = t.match(/^List (\d+)\s+Total\b.*?(\d+)\s*(?:units?|MCs?)/i);
      if (listDef) {
        key = `${section}:${listDef[1]}`;
        total = Number(listDef[2]);
      } else if (/highlighted in yellow/i.test(t)) key = `${section}:yellow`;
      else if (/highlighted in green/i.test(t)) key = `${section}:green`;
      else if (/for all other diplomas/i.test(t) || /APCs granted are:\s*$/i.test(t)) key = `${section}:other`;
      if (key) {
        inMajors = false;
        defKey = key;
        defs.set(key, { total, grants: [] });
        continue;
      }
      if (/^List \d+$/.test(t) || /^Polytechnic\b.*Acceptable Diplomas/i.test(t)) {
        defKey = null; // table heading, not a definition
        continue;
      }
      if (defKey && /^[••]/.test(t)) {
        const totalLine = t.match(new RegExp(`^[•\\u2022]\\s*Total\\s*:\\s*(\\d+)\\s*${UNITS}`, "i"));
        if (totalLine) {
          defs.get(defKey)!.total = Number(totalLine[1]);
          continue;
        }
        const g = parseGrant(t);
        if (g) defs.get(defKey)!.grants.push(g);
        else warnings.push(`unparsed grant line under ${defKey}: "${t}"`);
      }
    }

    for (const [key, d] of defs) {
      const sum = d.grants.reduce((n, g) => n + g.mc, 0);
      if (d.total !== null && sum !== d.total) warnings.push(`${key}: granted courses sum to ${sum} but the package states ${d.total}`);
      if (d.grants.length === 0) warnings.push(`${key}: no granted courses parsed`);
    }

    const engProgrammes = majors
      .map((m) => {
        if (RENAMED_MAJORS[m]) warnings.push(`info: "${m}" is read as the current programme "${RENAMED_MAJORS[m]}" (renamed)`);
        return mapProgramme(`Bachelor of Engineering (${RENAMED_MAJORS[m] ?? m})`, warnings);
      })
      .filter((x): x is string => !!x);
    const cegProgrammes = ["Bachelor of Engineering (Computer Engineering)", "Bachelor of Engineering in Computer Engineering"];
    if (engProgrammes.length === 0) warnings.push("no engineering majors found on the first page");
    const highlightScheme = [...defs.keys()].some((k) => k.endsWith(":yellow") || k.endsWith(":green"));

    // Pass 2: the diploma tables, page by page.
    section = "ENG";
    let tableList: string | null = null;
    let poly: string | null = null;
    const counts = new Map<string, Set<string>>();

    for (let p = 1; p <= pdf.numPages; p++) {
      const pageLines = lines.filter((l) => l.page === p);
      const { h } = await pdfRules(pdf, p);
      const ys = separatorYs(h.filter((r) => r.from <= 205 && r.to >= 500));
      const fills = highlightScheme ? await pdfFills(pdf, p) : [];
      const fragmentOf = (y: number) => {
        for (let i = 0; i < ys.length - 1; i++) if (y < ys[i] && y > ys[i + 1]) return i;
        return -1;
      };

      let lastFragment = -2;
      let fragmentPoly: string | null = null;
      let current: { text: string; ys: number[] } | null = null;

      const packageKey = (e: { ys: number[] }): string | null => {
        if (highlightScheme) {
          const hit = fills.find((f) => f.x1 > 223 && f.x0 < 500 && e.ys.some((y) => y >= f.y0 - 2 && y <= f.y1 + 2));
          const cls = hit ? colourClass(hit.color) : "other";
          return `${section}:${cls}`;
        }
        return tableList ? `${section}:${tableList}` : null;
      };
      const flushEntry = () => {
        if (current && fragmentPoly) {
          const key = packageKey(current);
          const def = key ? defs.get(key) : undefined;
          const programmes = section === "ENG" ? engProgrammes : cegProgrammes;
          if (!def) warnings.push(`no package definition for ${key} (${squash(current.text).slice(0, 40)})`);
          else if (programmes.length) {
            const { name } = expandDiploma(current.text);
            const ck = `${key}:${fragmentPoly}`;
            (counts.get(ck) ?? counts.set(ck, new Set()).get(ck)!).add(name);
            rows.push(...rowsFor(spec, doc, programmes, fragmentPoly, current.text, def.grants));
          }
        }
        current = null;
      };

      for (const l of pageLines) {
        const t = l.text;
        const sec = sectionOf(t);
        if (sec) section = sec;
        const listHeading = t.match(/^List (\d+)$/);
        if (listHeading) {
          flushEntry();
          tableList = listHeading[1];
          poly = null;
          continue;
        }
        const frag = fragmentOf(l.y);
        if (frag < 0) continue; // outside any table row (page furniture, definitions)
        if (/^Polytechnic\b.*Acceptable Diplomas/i.test(t)) {
          flushEntry();
          lastFragment = frag;
          continue; // repeated header row
        }
        if (frag !== lastFragment) {
          flushEntry();
          lastFragment = frag;
          // A label anywhere in this fragment names the polytechnic for every bullet in it.
          const label = pageLines
            .filter((x) => fragmentOf(x.y) === frag)
            .flatMap((x) => x.items)
            .find((i) => i.x < 199 && POLY_LINE.test(squash(i.text)));
          if (label) poly = canonical(label.text) ?? poly;
          fragmentPoly = poly;
        }
        const bullet = l.items.find((i) => /^[••]$/.test(i.text.trim()) && i.x < 215);
        const body = squash(l.items.filter((i) => i.x >= 215).map((i) => i.text).join(" "));
        if (bullet) {
          flushEntry();
          current = { text: body, ys: [l.y] };
        } else if (current && body) {
          current.text = `${current.text} ${body}`;
          current.ys.push(l.y);
        }
      }
      flushEntry();
    }

    if (counts.size === 0) warnings.push("no diploma entries found");
    for (const [k, v] of counts) warnings.push(`info: ${k} -> ${v.size} diplomas`);
    return { rows, warnings };
  },
};

// ---------------------------------------------------------------- AKI-BLA-ID

// Page headers/footers and page numbers that fall inside a table fragment.
const FURNITURE = /^(?:Correct as of\b.*|College of Design and Engineering|Dean.s Office.*|\d{1,2})$/i;
// Arts-academy diplomas share the merged cell but aren't one of the five polytechnics: keep them out of the previous diploma's name.
const OTHER_INSTITUTION = /^(?:Nanyang Academy|LASALLE|NAFA)\b/i;

const DESIGN_PROGRAMMES: [RegExp, string][] = [
  [/Architecture\s*\)\s*\(Hons|BA \(Architecture\)|Bachelor of Arts \(Architecture\)/i, "Bachelor of Arts (Architecture)"],
  [/Landscape Architecture/i, "Bachelor of Landscape Architecture"],
  [/Industrial Design/i, "Bachelor of Arts (Industrial Design)"],
];

export const cdeDesign: Adapter = {
  async detectAcademicYear(doc) {
    return academicYearOf(headText(toLines(await pdfItems(doc))));
  },

  async parse(doc, spec) {
    const warnings: string[] = [];
    const rows: RuleRow[] = [];
    const pdf = await openPdf(doc);
    const lines = toLines(await pdfItems(doc));
    const gotAy = academicYearOf(headText(lines));
    if (gotAy !== Number(spec.academicYear.slice(0, 4))) {
      return { rows, warnings: [`PDF is labelled AY${gotAy}, expected ${spec.academicYear}; skipped`] };
    }

    // Column geometry comes from the header row (it shifts a few points between years).
    const header = lines.find((l) => /^Diplomas\b/i.test(l.text) && /Placement/i.test(l.text));
    const col2Start = header?.items.find((i) => /^APCs/i.test(i.text))?.x ?? 225;
    const col3Start = header?.items.find((i) => /^(Units|MCs)$/i.test(i.text.trim()))?.x ?? 470;
    if (!header) warnings.push("table header row not found; using default column positions");

    let programmes: string[] = [];
    let sectionName = "";
    let diplomaCount = 0;

    // A table row can break across a page, so rows are assembled from fragments:
    // a fragment starting with a polytechnic name opens a new row, anything else
    // continues the previous one.
    type Pending = {
      programmes: string[];
      sectionName: string;
      pairs: { poly: string | null; name: string[] }[];
      grants: Grant[];
      buf: string;
      total: string;
    };
    let pending: Pending | null = null;
    const closes = new RegExp(`\\d+\\s*${UNITS}\\)?\\s*\\*?\\s*$`, "i");

    const commit = () => {
      const row = pending;
      pending = null;
      if (!row || row.programmes.length === 0 || row.pairs.length === 0 || row.grants.length === 0) return;
      if (row.buf) warnings.push(`dangling grant text "${row.buf}" (${row.sectionName})`);
      const sum = row.grants.reduce((n, g) => n + g.mc, 0);
      const total = row.total.match(/\b(\d{2})\b/);
      if (total && sum !== Number(total[1])) {
        warnings.push(`NOT STORED ${row.sectionName} / ${row.pairs.map((x) => x.name.join(" ")).join(" + ")}: granted courses sum to ${sum} but the row states ${total[1]}`);
        return;
      }
      for (const pair of row.pairs) {
        if (!pair.poly || pair.name.length === 0) continue;
        diplomaCount++;
        rows.push(...rowsFor(spec, doc, row.programmes, pair.poly, pair.name.join(" "), row.grants));
      }
    };

    for (let p = 1; p <= pdf.numPages; p++) {
      const pageLines = lines.filter((l) => l.page === p && !FURNITURE.test(l.text));
      const { h } = await pdfRules(pdf, p);
      const ys = separatorYs(h.filter((r) => r.to - r.from > 60));

      // A row belongs to the nearest section heading above it on this page,
      // or to the previous page's section when there isn't one.
      const headings = pageLines
        .filter((l) => /^[ivx]+\)\s*\S/i.test(l.text) && l.items[0].x < col2Start - 60)
        .map((l) => ({ y: l.y, name: l.text.replace(/^[ivx]+\)\s*/i, "").replace(/\*+/g, "").trim() }));
      const bindSection = (rowTop: number) => {
        const above = headings.filter((hd) => hd.y >= rowTop).sort((a, b) => a.y - b.y)[0];
        if (!above || above.name === sectionName) return;
        sectionName = above.name;
        const hit = DESIGN_PROGRAMMES.find(([re]) => re.test(sectionName));
        if (hit) {
          const mapped = mapProgramme(hit[1], warnings);
          programmes = mapped ? [mapped] : [];
        } else {
          programmes = [];
          warnings.push(`info: section "${sectionName}" has no matching app programme; its rows are not stored`);
        }
      };

      for (let i = 0; i < ys.length - 1; i++) {
        const top = ys[i];
        const bottom = ys[i + 1];
        const fragLines = pageLines.filter((l) => l.y < top && l.y > bottom);
        const items = fragLines.flatMap((l) => l.items);
        if (items.length === 0) continue;

        // Intro paragraphs / section headings / the header row are not data rows.
        const fragText = fragLines.map((l) => l.text).join(" ");
        if (/^Diplomas\b/i.test(fragText)) continue; // header row (repeats each page; does not end a row)
        if (fragLines.some((l) => /^[ivx]+\)\s*\S/i.test(l.text)) || /Placement Tests|APCs granted to|following polytechnic|^Note:/i.test(fragText)) {
          commit();
          continue;
        }

        const col1Lines = toLines(items.filter((it) => it.x < col2Start - 5));
        const col2Lines = toLines(items.filter((it) => it.x >= col2Start - 5 && it.x < col3Start - 5));
        const col3Text = squash(items.filter((it) => it.x >= col3Start - 5).map((it) => it.text).join(" "));

        if (col1Lines[0] && (POLY_LINE.test(col1Lines[0].text) || OTHER_INSTITUTION.test(col1Lines[0].text))) {
          commit();
          bindSection(top);
          pending = { programmes, sectionName, pairs: [], grants: [], buf: "", total: "" };
        }
        if (!pending) continue;
        const row: Pending = pending;

        // Column 1: alternating "<Polytechnic>" lines and diploma-name lines (possibly several pairs).
        // Institutions that aren't one of the five polytechnics (arts academies) never match POLY_LINE,
        // so their names attach to nothing and the row is dropped.
        for (const l of col1Lines) {
          if (POLY_LINE.test(l.text)) row.pairs.push({ poly: canonical(l.text), name: [] });
          else if (OTHER_INSTITUTION.test(l.text)) row.pairs.push({ poly: null, name: [l.text] });
          else if (row.pairs.length) row.pairs[row.pairs.length - 1].name.push(l.text);
        }

        // Column 2: granted courses; a title may wrap, so join lines until a "(N units)" closes it.
        for (const l of col2Lines) {
          row.buf = row.buf ? `${row.buf} ${l.text}` : l.text;
          if (closes.test(row.buf)) {
            const g = parseGrant(row.buf);
            if (g) row.grants.push(g);
            else warnings.push(`unparsed grant "${row.buf}" (${row.sectionName})`);
            row.buf = "";
          }
        }
        row.total = `${row.total} ${col3Text}`.trim();
      }
    }
    commit();
    if (diplomaCount === 0) warnings.push("no diploma rows found");
    warnings.push(`info: ${diplomaCount} polytechnic diploma rows`);
    return { rows, warnings };
  },
};

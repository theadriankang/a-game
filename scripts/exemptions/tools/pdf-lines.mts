// Dev tool: list the thin filled rectangles (table borders) drawn on a PDF page.
//   npx tsx scripts/exemptions/tools/pdf-lines.mts file.pdf 3
import { readFileSync } from "node:fs";
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { pdfRules } from "../lib/pdf-rules";

const [file, pageArg] = process.argv.slice(2);
const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
const rules = await pdfRules(pdf, Number(pageArg ?? 1));
console.log(`page ${pageArg}: ${rules.h.length} horizontal, ${rules.v.length} vertical rules`);
for (const s of rules.h) console.log(`H y=${s.pos.toFixed(1)}  x ${s.from.toFixed(0)}..${s.to.toFixed(0)}`);
for (const s of rules.v) console.log(`V x=${s.pos.toFixed(1)}  y ${s.from.toFixed(0)}..${s.to.toFixed(0)}`);
void getResolvedPDFJS;

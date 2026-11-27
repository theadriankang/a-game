import { readFileSync } from "node:fs";
import { getDocumentProxy } from "unpdf";
const file = process.argv[2];
const maxPages = Number(process.argv[3] ?? 2);
const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
console.log("pages:", pdf.numPages);
for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
  const page = await pdf.getPage(p);
  const tc = await page.getTextContent();
  // group by rounded y -> lines, sort by x
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of tc.items as any[]) {
    if (!it.str?.trim()) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    (rows.get(y) ?? rows.set(y, []).get(y)!).push({ x: Math.round(it.transform[4]), s: it.str });
  }
  console.log(`--- page ${p}`);
  [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([y, cells]) => {
    console.log(cells.sort((a, b) => a.x - b.x).map((c) => `${c.s}@${c.x}`).join(" | "));
  });
}

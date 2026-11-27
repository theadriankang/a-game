import type { getDocumentProxy } from "unpdf";
import { getResolvedPDFJS } from "unpdf";

export type Rule = { pos: number; from: number; to: number };
export type Fill = { color: string; x0: number; y0: number; x1: number; y1: number };
type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * Table borders on a page. Word-generated PDFs draw them either as hairline
 * filled rectangles or as stroked cell-sized rectangles; both are read from
 * the path bounding boxes so we can recover which row fragment a merged-cell
 * label belongs to. Horizontal edges only need their y; `from`/`to` say which
 * column they span.
 */
export async function pdfRules(pdf: Pdf, pageNumber: number): Promise<{ h: Rule[]; v: Rule[] }> {
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS as Record<string, number>;
  const ol = await (await pdf.getPage(pageNumber)).getOperatorList();
  const h: Rule[] = [];
  const v: Rule[] = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    if (ol.fnArray[i] !== OPS.constructPath) continue;
    const paint = ol.argsArray[i]?.[0] as number;
    const bbox = ol.argsArray[i]?.[2] as ArrayLike<number> | undefined;
    if (!bbox || bbox.length < 4) continue;
    const [x0, y0, x1, y1] = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const w = x1 - x0;
    const ht = y1 - y0;
    if (ht < 1.5 && w > 10) h.push({ pos: (y0 + y1) / 2, from: x0, to: x1 });
    else if (w < 1.5 && ht > 10) v.push({ pos: (x0 + x1) / 2, from: y0, to: y1 });
    else if (paint !== OPS.fill && paint !== OPS.eoFill && w > 60 && ht > 15) {
      // stroked cell rectangle: its top and bottom edges are row separators
      h.push({ pos: y1, from: x0, to: x1 }, { pos: y0, from: x0, to: x1 });
      v.push({ pos: x0, from: y0, to: y1 }, { pos: x1, from: y0, to: y1 });
    }
  }
  h.sort((a, b) => b.pos - a.pos);
  v.sort((a, b) => a.pos - b.pos);
  return { h, v };
}

/** Distinct y positions of row separators, merging edges within `tol` points of each other. */
export function separatorYs(rules: Rule[], tol = 2): number[] {
  const out: number[] = [];
  for (const r of [...rules].sort((a, b) => b.pos - a.pos)) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - r.pos) > tol) out.push(r.pos);
  }
  return out;
}

/** Filled coloured rectangles (e.g. yellow/green text highlights), excluding black/white fills. */
export async function pdfFills(pdf: Pdf, pageNumber: number): Promise<Fill[]> {
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS as Record<string, number>;
  const ol = await (await pdf.getPage(pageNumber)).getOperatorList();
  const fills: Fill[] = [];
  let color = "#000000";
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const args = ol.argsArray[i];
    if (fn === OPS.setFillRGBColor) color = String(args[0]);
    else if (fn === OPS.constructPath && (args[0] === OPS.fill || args[0] === OPS.eoFill)) {
      const bb = args[2] as ArrayLike<number>;
      if (!bb || bb.length < 4) continue;
      if (/^#(?:000000|ffffff)$/i.test(color)) continue;
      fills.push({ color, x0: bb[0], y0: bb[1], x1: bb[2], y1: bb[3] });
    }
  }
  return fills;
}

export function colourClass(hex: string): "yellow" | "green" | "other" {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "other";
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  if (r > 200 && g > 200 && b < 120) return "yellow";
  if (g > 140 && r < 170 && b < 170) return "green";
  return "other";
}

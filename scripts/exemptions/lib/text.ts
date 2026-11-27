import { getDocumentProxy } from "unpdf";
import type { RawDoc } from "./types";

export const squash = (s: string) =>
  s
    .replace(/&nbsp;|&#160;| /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

export function htmlText(html: string): string {
  return squash(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#8211;|&ndash;/g, "-")
  );
}

export type PdfItem = { page: number; x: number; y: number; text: string };

/** Positioned text items for every page, top-to-bottom within a page. */
export async function pdfItems(doc: RawDoc): Promise<PdfItem[]> {
  const pdf = await getDocumentProxy(new Uint8Array(doc.pdf!));
  const out: PdfItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!it.str.trim()) continue;
      out.push({ page: p, x: it.transform[4], y: it.transform[5], text: it.str });
    }
  }
  return out;
}

/** Plain text of a document, whichever kind it is. */
export async function docText(doc: RawDoc): Promise<string> {
  if (doc.kind === "html") return htmlText(doc.html ?? "");
  const items = await pdfItems(doc);
  return squash(items.map((i) => i.text).join(" "));
}

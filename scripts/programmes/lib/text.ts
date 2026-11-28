import * as cheerio from "cheerio";

// A page as plain text for the extractor: headings, list items and table rows keep their line structure (a
// requirements table flattened into one run of words is exactly what a model misreads), and page chrome (menus,
// scripts, footers) is dropped.
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, header, footer, aside, form, iframe").remove();

  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");

  root.find("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.slice(1));
    $(el).replaceWith(`\n\n${"#".repeat(level)} ${$(el).text().trim()}\n`);
  });
  root.find("li").each((_, el) => {
    $(el).replaceWith(`\n- ${$(el).text().replace(/\s+/g, " ").trim()}`);
  });
  root.find("tr").each((_, el) => {
    const cells = $(el)
      .find("th, td")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    $(el).replaceWith(`\n| ${cells.join(" | ")} |`);
  });
  root.find("p, div, br").each((_, el) => {
    $(el).append("\n");
  });

  return root
    .text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

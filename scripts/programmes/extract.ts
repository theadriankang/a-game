// Draft a programme's requirements from its source page/PDF with Claude. Writes data/programmes/drafts/<id>.json
// and never touches the published data - a person reviews the draft and promotes it.
//
//   npm run programmes:extract -- --fetch-only            fetch and store the sources, no model call
//   npm run programmes:extract -- --dry-run               also show what would be sent, no model call
//   npm run programmes:extract -- --only minor-ai,minor-statistics    just these ids (default: every source)
//   npm run programmes:extract -- --offline               use stored snapshots only (no fetching at all)
//   npm run programmes:extract -- --refresh               re-fetch even if a snapshot is stored
//   npm run programmes:extract -- --model <id>            override the model (default claude-opus-5-5)
//   npm run programmes:extract -- --from-file out.json    skip the model: use extractions read by hand (or by any
//                                                         other tool), as { "<source id>": <model-output JSON> }.
//                                                         Everything after the model call runs as normal.
//
// The model call needs ANTHROPIC_API_KEY (put it in .env) and costs real money: a few cents per source.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProgrammeRecordSchema, ProgrammesFileSchema, type ProgrammeRecord } from "../../src/lib/programmes/schema";
import { SOURCES } from "./sources";
import { BlockedError, getRawDoc } from "./lib/fetch-raw";
import { loadCatalogCodes } from "./lib/catalog";
import { checkRecord } from "./lib/check";
import { compareToPublished } from "./lib/compare";
import { buildContent, DEFAULT_MODEL, extractWithClaude } from "./lib/llm";
import { DraftOutSchema, normaliseDraft, type DraftOut } from "./lib/normalise";
import { DRAFTS_DIR, PUBLISHED_FILE } from "./lib/paths";

export type Draft = {
  record: ProgrammeRecord | null; // null when the model's output didn't pass the schema
  errors: string[]; // anything here blocks promotion
  warnings: string[]; // for the reviewer
  differences: string[] | null; // vs the published record of the same id; null when none is published
  rawOutput?: DraftOut; // kept only when record is null, so the failure can be read
  meta: {
    model: string;
    fellBack: boolean;
    sourceUrl: string;
    sourceSha256: string;
    fetchedAt: string;
    extractedAt: string;
    via: string;
    usage: { inputTokens: number; outputTokens: number };
  };
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function publishedRecords(): Promise<ProgrammeRecord[]> {
  try {
    return ProgrammesFileSchema.parse(JSON.parse(await readFile(PUBLISHED_FILE, "utf8"))).programmes;
  } catch {
    return [];
  }
}

async function main() {
  const fromFile = option("--from-file");
  const handRead: Record<string, unknown> | null = fromFile ? JSON.parse(await readFile(fromFile, "utf8")) : null;
  const only =
    option("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? (handRead ? Object.keys(handRead) : undefined);
  const unknown = (only ?? []).filter((id) => !SOURCES.some((s) => s.id === id));
  if (unknown.length) throw new Error(`Unknown source id(s): ${unknown.join(", ")}. Known: ${SOURCES.map((s) => s.id).join(", ")}`);
  const sources = only ? SOURCES.filter((s) => only.includes(s.id)) : SOURCES;
  const missing = handRead ? sources.filter((s) => !(s.id in handRead)).map((s) => s.id) : [];
  if (missing.length) throw new Error(`--from-file has no entry for: ${missing.join(", ")}`);

  const model = option("--model") ?? DEFAULT_MODEL;
  const fetchOnly = flag("--fetch-only");
  const dryRun = flag("--dry-run");
  const published = await publishedRecords();
  const catalog = fetchOnly || dryRun ? null : await loadCatalogCodes({ offline: flag("--offline") });

  await mkdir(DRAFTS_DIR, { recursive: true });
  let failed = 0;
  // Sources that share a page (the CS focus areas) fetch it once per run, even with --refresh.
  const fetchedThisRun = new Map<string, Awaited<ReturnType<typeof getRawDoc>>>();

  for (const source of sources) {
    console.log(`\n== ${source.id} (${source.label})`);
    try {
      // Pages that share a URL share one fetch, unless they were saved as different files (the Chinese Studies tabs).
      const shareKey = `${source.url}|${source.locator?.manual ?? ""}`;
      const shared = fetchedThisRun.get(shareKey);
      const doc = shared
        ? { ...shared, id: source.id }
        : await getRawDoc(source, { refresh: flag("--refresh"), offline: flag("--offline") });
      fetchedThisRun.set(shareKey, doc);
      console.log(`   ${doc.kind.toUpperCase()}, ${(doc.bytes.length / 1024).toFixed(0)} KB, via ${doc.via}, fetched ${doc.fetchedAt.slice(0, 10)}`);
      if (fetchOnly) continue;

      if (dryRun) {
        const blocks = buildContent(doc, source);
        const textChars = blocks.reduce((n, b) => n + (b.type === "text" ? b.text.length : 0), 0);
        console.log(`   would send ${blocks.length} blocks (${doc.kind === "pdf" ? "the PDF as a document block + " : ""}${textChars.toLocaleString()} chars of text) to ${model}; nothing sent`);
        continue;
      }

      const result = handRead
        ? {
            out: DraftOutSchema.parse({ cohortFrom: null, cohortTo: null, ...(handRead[source.id] as object) }),
            model: "hand-read (--from-file)",
            fellBack: false,
            usage: { inputTokens: 0, outputTokens: 0 },
          }
        : await extractWithClaude(doc, source, model);
      const { candidate, notes } = normaliseDraft(result.out, source, doc.fetchedAt);
      const parsed = ProgrammeRecordSchema.safeParse(candidate);

      const draft: Draft = {
        record: parsed.success ? parsed.data : null,
        errors: parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "(record)"}: ${i.message}`),
        warnings: [],
        differences: null,
        ...(parsed.success ? {} : { rawOutput: result.out }),
        meta: {
          model: result.model,
          fellBack: result.fellBack,
          sourceUrl: source.url,
          sourceSha256: doc.sha256,
          fetchedAt: doc.fetchedAt,
          extractedAt: new Date().toISOString(),
          via: doc.via,
          usage: result.usage,
        },
      };
      if (draft.record) {
        draft.warnings = [...checkRecord(draft.record, { catalog }), ...notes.map((n) => `Normaliser: ${n}`)];
        const existing = published.find((p) => p.id === source.id);
        if (existing) draft.differences = compareToPublished(draft.record, existing);
      }

      const file = path.join(DRAFTS_DIR, `${source.id}.json`);
      await writeFile(file, JSON.stringify(draft, null, 2) + "\n");

      console.log(`   ${draft.record ? `${draft.record.groups.length} groups, ${draft.record.totalMcMin} MC` : "schema FAILED"}  (${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens${result.fellBack ? ", served by the fallback model" : ""})`);
      for (const e of draft.errors) console.log(`   ERROR   ${e}`);
      for (const w of draft.warnings) console.log(`   warning ${w}`);
      if (draft.differences) {
        console.log(draft.differences.length ? "   differs from the published record:" : "   matches the published record");
        for (const d of draft.differences) console.log(`     - ${d}`);
      }
      console.log(`   wrote ${path.relative(process.cwd(), file)}`);
      if (draft.errors.length) failed++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`   FAILED  ${message}`);
      if (error instanceof BlockedError) continue;
      if (/api[_ ]?key|credential|authenticat/i.test(message)) {
        console.log("   hint    set ANTHROPIC_API_KEY in .env (the model call needs it); --fetch-only and --dry-run don't.");
      }
    }
  }

  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { looksBlocked } from "../../exemptions/lib/fetch-raw";
import type { ProgrammeSource } from "../sources";
import { MANIFEST, MANUAL_DIR, RAW_DIR } from "./paths";

// Same ground rules as the exemptions pipeline: a plain, honest client string, one request at a time with a pause
// between them, and a bot-protection challenge is a gap to fill by hand, never something to get around.
const UA = "a-game-programme-ingest/0.1 (low-rate, manual runs)";
const DELAY_MS = 1500;

export type RawDoc = {
  id: string;
  url: string;
  kind: "pdf" | "html";
  bytes: Buffer;
  sha256: string;
  fetchedAt: string;
  via: "live" | "manual";
};

type ManifestEntry = { url: string; sha256: string; via: RawDoc["via"]; fetchedAt: string; file: string };

export class BlockedError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadManifest(): Promise<Record<string, ManifestEntry>> {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

async function politeFetch(url: string, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      await sleep(3000 * (i + 1));
    }
  }
  throw new Error(`fetch failed after ${tries} tries: ${url} (${String(last)})`);
}

const isPdf = (url: string, type: string) => type.includes("pdf") || url.toLowerCase().split("?")[0].endsWith(".pdf");

/**
 * Resolves a source to its raw bytes. A stored snapshot wins (so a re-run is reproducible and offline); otherwise
 * it's fetched live, or read from the file a person saved by hand, and the result is stored.
 */
export async function getRawDoc(
  source: ProgrammeSource,
  opts: { refresh?: boolean; offline?: boolean } = {}
): Promise<RawDoc> {
  await mkdir(RAW_DIR, { recursive: true });
  const manifest = await loadManifest();
  // Several programmes can come from one page (the CS focus areas): they share the stored copy of that URL rather
  // than fetching it once each.
  const stored = manifest[source.id]?.url === source.url ? manifest[source.id] : Object.values(manifest).find((e) => e.url === source.url);

  if (stored && !opts.refresh) {
    const bytes = await readFile(path.join(RAW_DIR, stored.file));
    return {
      id: source.id,
      url: stored.url,
      kind: stored.file.endsWith(".pdf") ? "pdf" : "html",
      bytes,
      sha256: stored.sha256,
      fetchedAt: stored.fetchedAt,
      via: stored.via,
    };
  }
  if (opts.offline) throw new BlockedError(`${source.id}: no stored snapshot (run without --offline to fetch it)`);

  let bytes: Buffer;
  let kind: RawDoc["kind"];
  let via: RawDoc["via"] = "live";

  if (source.locator?.manual) {
    via = "manual";
    const file = path.join(MANUAL_DIR, source.locator.manual);
    bytes = await readFile(file).catch(() => {
      throw new BlockedError(
        `${source.id}: needs a hand-saved copy. Open ${source.url} in a normal browser and save the page/PDF as ${path.relative(process.cwd(), file)}`
      );
    });
    kind = source.locator.manual.toLowerCase().endsWith(".pdf") ? "pdf" : "html";
  } else {
    const res = await politeFetch(source.url);
    if (!res.ok) throw new Error(`${source.id}: HTTP ${res.status} from ${source.url}`);
    const type = res.headers.get("content-type") ?? "";
    if (isPdf(source.url, type)) {
      kind = "pdf";
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      const html = await res.text();
      if (looksBlocked(html)) {
        throw new BlockedError(
          `${source.id}: ${source.url} answered with a bot-protection challenge. Not working around it - save the page from a normal browser and point the source's locator at it (see sources.ts).`
        );
      }
      kind = "html";
      bytes = Buffer.from(html, "utf8");
    }
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fetchedAt = new Date().toISOString();
  const file = `${source.id}.${kind === "pdf" ? "pdf" : "html"}`;
  await writeFile(path.join(RAW_DIR, file), bytes);
  manifest[source.id] = { url: source.url, sha256, via, fetchedAt, file };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  return { id: source.id, url: source.url, kind, bytes, sha256, fetchedAt, via };
}

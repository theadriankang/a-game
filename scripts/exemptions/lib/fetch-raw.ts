import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Adapter, Locator, RawDoc, SourceSpec } from "./types";
import { parseAcademicYear } from "../../../src/lib/exemptions/normalize";

export const DATA_DIR = path.resolve(process.cwd(), "data/exemptions");
const RAW_DIR = path.join(DATA_DIR, "raw");
const MANUAL_DIR = path.join(DATA_DIR, "manual");
const MANIFEST = path.join(RAW_DIR, "manifest.json");

// A plain, honest client string. Wayback and NUS pages that don't sit behind
// bot protection are fetched at a low rate; anything that answers with a
// challenge page is treated as "blocked" and routed to the manual path
// rather than worked around.
const UA = "a-game-exemption-ingest/0.1 (low-rate, manual runs)";
const DELAY_MS = 1500;

export type RawManifestEntry = {
  url: string;
  snapshotAt: string | null;
  sha256: string;
  via: "live" | "wayback" | "manual";
  fetchedAt: string;
  file: string;
};
type RawManifest = Record<string, RawManifestEntry>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string, tries = 4): Promise<Response> {
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

/** Imperva/Incapsula & similar challenge pages: tiny body that mentions a challenge resource. */
export function looksBlocked(text: string): boolean {
  return text.length < 4000 && /_Incapsula_Resource|Request unsuccessful\. Incapsula|Additional security check/i.test(text);
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ");
}

async function loadManifest(): Promise<RawManifest> {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

async function cdx(url: string, from: string, to: string): Promise<{ ts: string; length: number }[]> {
  const q = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp,length",
    filter: "statuscode:200",
    from,
    to,
  });
  const res = await politeFetch(`https://web.archive.org/cdx/search/cdx?${q}`);
  const text = await res.text();
  let rows: string[][];
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error(`Wayback CDX returned non-JSON for ${url}: ${text.slice(0, 120)}`);
  }
  return rows
    .slice(1)
    .map(([ts, length]) => ({ ts, length: Number(length) }))
    .sort((a, b) => b.ts.localeCompare(a.ts)); // newest first
}

const tsToIso = (ts: string) =>
  `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;

async function toRawDoc(id: string, url: string, snapshotAt: string | null, res: Response): Promise<RawDoc | "blocked"> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    return { id, url, snapshotAt, kind: "pdf", pdf: new Uint8Array(await res.arrayBuffer()) };
  }
  const html = await res.text();
  if (looksBlocked(html)) return "blocked";
  return { id, url, snapshotAt, kind: "html", html };
}

export class BlockedError extends Error {}

/**
 * Resolve a source to raw bytes. Order: already-stored raw snapshot (so builds
 * are reproducible/offline) -> fetch per the locator and store it.
 */
export async function getRawDoc(
  spec: SourceSpec,
  adapter: Adapter,
  opts: { refresh?: boolean; offline?: boolean } = {}
): Promise<{ doc: RawDoc; sha256: string }> {
  await mkdir(RAW_DIR, { recursive: true });
  const manifest = await loadManifest();
  const existing = manifest[spec.id];

  if (existing && !opts.refresh) {
    const bytes = await readFile(path.join(RAW_DIR, existing.file));
    const isPdf = existing.file.endsWith(".pdf");
    const doc: RawDoc = isPdf
      ? { id: spec.id, url: existing.url, snapshotAt: existing.snapshotAt, kind: "pdf", pdf: new Uint8Array(bytes) }
      : { id: spec.id, url: existing.url, snapshotAt: existing.snapshotAt, kind: "html", html: bytes.toString("utf8") };
    return { doc, sha256: existing.sha256 };
  }
  if (opts.offline) throw new BlockedError(`${spec.id}: no stored raw snapshot (run without --offline to fetch it)`);

  const loc: Locator = spec.locator;
  let doc: RawDoc | "blocked" | null = null;
  let via: RawManifestEntry["via"] = "live";

  if (loc.kind === "manual") {
    via = "manual";
    const file = path.join(MANUAL_DIR, loc.file);
    const bytes = await readFile(file).catch(() => {
      throw new BlockedError(
        `${spec.id}: needs a manually saved copy. Open ${loc.url} in a normal browser and save the page/PDF as ${path.relative(process.cwd(), file)}`
      );
    });
    doc = loc.file.endsWith(".pdf")
      ? { id: spec.id, url: loc.url, snapshotAt: null, kind: "pdf", pdf: new Uint8Array(bytes) }
      : { id: spec.id, url: loc.url, snapshotAt: null, kind: "html", html: bytes.toString("utf8") };
  } else if (loc.kind === "live") {
    doc = await toRawDoc(spec.id, loc.url, new Date().toISOString(), await politeFetch(loc.url));
    if (doc === "blocked") {
      throw new BlockedError(`${spec.id}: ${loc.url} answered with a bot-protection challenge. Not working around it - use a manual copy or an archived capture.`);
    }
  } else {
    via = "wayback";
    const caps = await cdx(loc.url, loc.from, loc.to);
    const wantYear = Number(spec.academicYear.slice(0, 4));
    for (const cap of caps.slice(0, 15)) {
      const raw = await politeFetch(`https://web.archive.org/web/${cap.ts}id_/${loc.url}`);
      const candidate = await toRawDoc(spec.id, loc.url, tsToIso(cap.ts), raw);
      if (candidate === "blocked") continue; // Wayback stored a challenge page; try an older capture
      if (adapter.detectAcademicYear) {
        const got = await adapter.detectAcademicYear(candidate, spec);
        if (got !== wantYear) continue;
      }
      doc = candidate;
      break;
    }
    if (!doc) {
      throw new BlockedError(`${spec.id}: no usable Wayback capture of ${loc.url} in ${loc.from}-${loc.to} labelled AY${spec.academicYear}`);
    }
  }

  const bytes = doc.kind === "pdf" ? Buffer.from(doc.pdf!) : Buffer.from(stripNoise(doc.html!), "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = `${spec.id}.${doc.kind === "pdf" ? "pdf" : "html"}`;
  await writeFile(path.join(RAW_DIR, file), bytes);
  manifest[spec.id] = {
    url: doc.url,
    snapshotAt: doc.snapshotAt,
    sha256,
    via,
    fetchedAt: new Date().toISOString(),
    file,
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  if (doc.kind === "html") doc.html = bytes.toString("utf8");
  return { doc, sha256 };
}

export { parseAcademicYear };

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RAW_DIR } from "./paths";

// The module codes NUSMods lists for the last few academic years, used to catch codes a model (or a typo) made up.
// Public JSON API, ~110 KB a year (the same source `npm run modules:sync` uses); cached under data/programmes/raw
// so checks keep working offline after the first run.
const BASE = "https://api.nusmods.com/v2";
const UA = "a-game-programme-ingest/0.1 (low-rate, manual runs)";
const YEARS = 4;

function currentIntakeYear(now = new Date()) {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

async function codesForYear(ay: string, offline: boolean): Promise<string[] | null> {
  const cache = path.join(RAW_DIR, `catalog-${ay}.json`);
  try {
    return JSON.parse(await readFile(cache, "utf8"));
  } catch {
    // not cached yet
  }
  if (offline) return null;
  try {
    const res = await fetch(`${BASE}/${ay}/moduleList.json`, { headers: { "user-agent": UA } });
    if (!res.ok) return null; // that AY isn't published (yet)
    const codes = ((await res.json()) as { moduleCode: string }[]).map((m) => m.moduleCode);
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(cache, JSON.stringify(codes));
    return codes;
  } catch {
    return null;
  }
}

/** Every module code NUSMods has listed recently, or null when none could be read (offline, first run). */
export async function loadCatalogCodes(opts: { offline?: boolean } = {}): Promise<Set<string> | null> {
  const current = currentIntakeYear();
  const all = new Set<string>();
  for (let y = current - YEARS + 1; y <= current; y++) {
    const codes = await codesForYear(`${y}-${y + 1}`, opts.offline ?? false);
    codes?.forEach((c) => all.add(c));
  }
  return all.size > 0 ? all : null;
}

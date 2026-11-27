import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { getModuleList, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { CODE_RE, filterByQuery, parseCatalogQuery, parseCodeList, type CatalogHit } from "@/lib/modules/catalog-search";

// Backs the module-code input on onboarding. Reads our own catalog_modules table
// (filled by scripts/modules/sync.ts) instead of calling NUSMods per keystroke.
//   GET ?q=cs1            -> up to 8 suggestions (nothing below 3 characters)
//   GET ?codes=CS1010,MA 1301 -> which of these codes exist, and which don't
// If the table is still empty (first deploy, before the sync has been run) it falls back to NUSMods'
// current-year list so the form keeps working.

const LIMIT = 8;
const MAX_CODES = 60;

async function fallbackList(): Promise<CatalogHit[]> {
  const list = await getModuleList(NUSMODS_ACAD_YEAR);
  return list.map((m) => ({ code: m.moduleCode, title: m.title, mc: null }));
}

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;

  try {
    const codesParam = params.get("codes");
    if (codesParam !== null) {
      const tokens = parseCodeList(codesParam).slice(0, MAX_CODES);
      const wellFormed = tokens.filter((t) => CODE_RE.test(t));
      let found: CatalogHit[] = (
        await prisma.catalogModule.findMany({ where: { code: { in: wellFormed } }, select: { code: true, title: true, mc: true } })
      ).map((r) => ({ code: r.code, title: r.title, mc: r.mc }));
      if (found.length === 0 && wellFormed.length > 0 && (await prisma.catalogModule.count()) === 0) {
        const wanted = new Set(wellFormed);
        found = (await fallbackList()).filter((m) => wanted.has(m.code));
      }
      const have = new Set(found.map((f) => f.code));
      return NextResponse.json({ found, unknown: tokens.filter((t) => !have.has(t)) });
    }

    const query = parseCatalogQuery(params.get("q") ?? "");
    if (query.kind === "none") return NextResponse.json({ results: [] });

    // Exact code first, then modules NUSMods still lists (newest AY first), then alphabetical.
    const rows =
      query.kind === "prefix"
        ? await prisma.$queryRaw<CatalogHit[]>(Prisma.sql`
            SELECT code, title, mc FROM catalog_modules
            WHERE code LIKE ${query.q + "%"}
            ORDER BY (code = ${query.q}) DESC, "lastListedAy" DESC NULLS LAST, code
            LIMIT ${LIMIT}`)
        : await prisma.$queryRaw<CatalogHit[]>(Prisma.sql`
            SELECT code, title, mc FROM catalog_modules
            WHERE code ~ ${"^[A-Z]{2,4}" + query.q}
            ORDER BY regexp_replace(code, '^[A-Z]+', ''), "lastListedAy" DESC NULLS LAST, code
            LIMIT ${LIMIT}`);

    if (rows.length === 0 && (await prisma.catalogModule.count()) === 0) {
      return NextResponse.json({ results: filterByQuery(await fallbackList(), query, LIMIT), source: "nusmods-fallback" });
    }
    return NextResponse.json({ results: rows });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

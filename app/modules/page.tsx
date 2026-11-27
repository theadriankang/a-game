import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getModuleList, NUSMODS_ACAD_YEAR, type ModuleCondensed } from "@/lib/nusmods";

type SearchParams = Promise<{ q?: string; page?: string }>;

const PAGE_SIZE = 30;
const PREFIX_CHIPS = 24;
const SEM_LABEL: Record<number, string> = { 1: "Sem 1", 2: "Sem 2", 3: "ST I", 4: "ST II" };

// Search runs on the server against NUSMods' condensed module list (the same
// list that backs the planner's "Add module" autocomplete, cached for a day),
// so the page works without client JS and every row links to a module that
// /modules/[code] can actually load for NUSMODS_ACAD_YEAR.
//
// Ordering matches /api/modules/search: code-prefix hits first (what someone
// typing "CS21" wants), then title-substring hits.
//
// A query that is exactly a code prefix ("cs", "ma", "st") is matched against
// codes only - otherwise "cs" would trail off into titles like "Physics" and
// "Economics", which is never what someone browsing the CS modules wants.
function searchModules(modules: ModuleCondensed[], raw: string, prefixes: Map<string, number>): ModuleCondensed[] {
  const codeQuery = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const titleQuery = raw.toLowerCase();
  const codeOnly = prefixes.has(codeQuery);
  const byCode: ModuleCondensed[] = [];
  const byTitle: ModuleCondensed[] = [];
  for (const m of modules) {
    if (codeQuery && m.moduleCode.toUpperCase().startsWith(codeQuery)) byCode.push(m);
    else if (!codeOnly && m.title.toLowerCase().includes(titleQuery)) byTitle.push(m);
  }
  return [...byCode, ...byTitle];
}

// How many modules each code prefix (CS, MA, ...) has this academic year.
function prefixCounts(modules: ModuleCondensed[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of modules) {
    const prefix = m.moduleCode.match(/^[A-Za-z]+/)?.[0].toUpperCase();
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

// The most common prefixes, as one-click starting points for browsing when
// nothing has been searched yet.
function topPrefixes(counts: Map<string, number>): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PREFIX_CHIPS)
    .map(([prefix]) => prefix)
    .sort();
}

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/modules?${qs}` : "/modules";
}

export default async function ModulesPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80);

  let modules: ModuleCondensed[] | null = null;
  try {
    modules = await getModuleList(NUSMODS_ACAD_YEAR);
  } catch {
    modules = null;
  }

  const prefixes = modules ? prefixCounts(modules) : new Map<string, number>();
  const results = modules && q ? searchModules(modules, q, prefixes) : [];
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1), pageCount);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-page text-text0">
      <header className="border-b border-border bg-surface px-7 py-4">
        <Link
          href="/planner"
          className="text-[12.5px] font-medium text-text3 transition-colors hover:text-text1"
        >
          ← Back to planner
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Modules</h1>
        <p className="mt-0.5 text-[13px] text-text3">
          {modules
            ? `${modules.length.toLocaleString()} modules offered in AY ${NUSMODS_ACAD_YEAR}. Search by code or title.`
            : `Search by code or title.`}
        </p>
        <form action="/modules" method="get" className="mt-3 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="e.g. CS2030 or data structures"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-page px-3 py-2 text-[14px] text-text0 placeholder:text-text3 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Search
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-5xl px-7 py-6">
        {modules === null ? (
          <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-text2">
            Couldn&rsquo;t load the module list from NUSMods. Try again in a moment.
          </div>
        ) : !q ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text3">
              Browse by prefix
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {topPrefixes(prefixes).map((prefix) => (
                <Link
                  key={prefix}
                  href={`/modules?q=${prefix}`}
                  className="rounded-full border border-border bg-seg-bg px-3 py-1 text-[12.5px] font-semibold text-text2 transition-colors hover:text-text0"
                >
                  {prefix}
                </Link>
              ))}
            </div>
          </section>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-text2">
            No modules match &ldquo;{q}&rdquo; in AY {NUSMODS_ACAD_YEAR}.
          </div>
        ) : (
          <>
            <div className="mb-2 text-[12.5px] text-text3">
              {results.length.toLocaleString()} result{results.length === 1 ? "" : "s"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
            </div>
            <ul className="overflow-hidden rounded-xl border border-border bg-surface">
              {visible.map((m) => (
                <li key={m.moduleCode} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/modules/${m.moduleCode}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-seg-bg"
                  >
                    <span className="w-24 shrink-0 text-[13.5px] font-semibold text-text0">
                      {m.moduleCode}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text1">{m.title}</span>
                    <span className="hidden shrink-0 text-[11.5px] text-text3 sm:block">
                      {m.semesters.map((s) => SEM_LABEL[s] ?? `Sem ${s}`).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {pageCount > 1 ? (
              <nav className="mt-4 flex items-center justify-between text-[13px] font-semibold">
                {page > 1 ? (
                  <Link href={pageHref(q, page - 1)} className="text-accent hover:underline">
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                {page < pageCount ? (
                  <Link href={pageHref(q, page + 1)} className="text-accent hover:underline">
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

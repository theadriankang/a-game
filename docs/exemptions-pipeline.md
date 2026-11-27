# Exemption (APC) pipeline

Pre-fills a new student's exemptions during onboarding from the lists each NUS faculty publishes, instead of making them type module codes.

```
faculty pages / PDFs ──► scripts/exemptions ──► data/exemptions/rules/<AY>.json ──► Postgres ──► /api/exemptions/suggest ──► onboarding form
   (live or Wayback)      fetch · parse · check     reviewed in git (1 rule/line)    exemption_rules     matches diploma + programme
```

Scraping happens **offline, on a developer's machine**, never on Vercel and never at request time. The app only reads the `exemption_rules` table.

## Everyday commands

```bash
npm run exemptions:build                  # fetch anything missing, parse, validate, write data/exemptions/{rules,REPORT.md}
npm run exemptions:build -- --offline     # re-parse stored raw snapshots only (no network)
npm run exemptions:build -- --refresh     # re-fetch everything
npm run exemptions:build -- --only comp-poly-2026-27 --verbose   # dry run of one source (never writes)
npm run exemptions:load -- --dry-run      # what would be loaded
npm run exemptions:load -- --yes          # replace exemption_rules for the years in data/exemptions/rules (uses DATABASE_URL)
```

`exemptions:load` refuses to write without `--yes` and prints the target DB host first, so check it before pointing it at production. `prisma db push` (part of `npm run build`) creates the table on deploy; the table stays empty until you run the loader, and the form says "we don't hold a published list yet" until then.

Raw copies of NUS's pages/PDFs (`data/exemptions/raw/*`, `data/exemptions/manual/`) are git-ignored because this repo is public; `raw/manifest.json` (URL, capture time, SHA-256 per source) and the parsed `rules/*.json` are committed. A fresh clone re-fetches what it needs.

Review order: `exemptions:build` → read `data/exemptions/REPORT.md` and the `git diff` of `data/exemptions/rules` → `exemptions:load`.

## What is covered

| Faculty | Source | Shape | Years |
|---|---|---|---|
| School of Computing | HTML tables, one per polytechnic; olympiad table | per-diploma module lists + 20 MC elective credit | AY23/24 – AY27/28 (olympiad too) |
| College of Design & Engineering | two PDFs per intake (Engineering + Computer Eng.; Architecture/Landscape/Industrial Design) | per-diploma "packages" | AY23/24 – AY26/27 |
| Yong Loo Lin (Nursing) | one HTML table | per-diploma module lists | AY23/24 – AY26/27 |
| Faculty of Science | prose rule (POY1901 etc.) + IMO rule | flat | AY23/24 – AY27/28 (IMO: not AY24/25) |
| FASS | prose rule | flat 20 MC electives | AY23/24 – AY26/27 |
| NUS Business School | policy PDF | flat 20 MC electives | AY26/27 only (no earlier version is archived) |

Not covered by suggestions: **H3**. NUS's own "FAQ on H3 APC" shows H3 credit is per course taken (NUS H3 course at grade D or better, with grade transfer; NTU/SMU/A*STAR H3 at a pass plus NUS's minimum criteria, no grade transfer; MOE-set H3 not eligible), applied for by invitation at admission, so there is no table to ingest. The form explains the rules (`H3Guidance`) and H3 students enter their module codes by hand. Also not covered: faculties with no published polytechnic list (Law, Dentistry, Medicine/MBBS, Music), and the diplomas listed in `data/exemptions/REPORT.md` under "NOT STORED" (multi-diploma cells in the Architecture/Design PDFs and one COMP cell that couldn't be read reliably). Those are skipped rather than guessed.

## How the data is stored

One `ExemptionRule` row per diploma (or medal category) per intake year per programme group, with a `grants` JSON list (`moduleCode`, `label`, `mc`, `kind`, `grant`, `note`). `programmes` holds the app's own programme names (empty = whole faculty), resolved when parsing, so runtime matching is a plain lookup. Diploma names are matched through `credentialKey()` in `src/lib/exemptions/normalize.ts` ("Diploma in Banking & Finance" → `banking and finance`); renamed diplomas are stored under both the new and old name.

Conventions worth knowing:

- Module exemptions are saved to the planner with `mc: 0` in the year-0/sem-0 slot, exactly as before, so degree-requirement maths is unchanged. The real units are kept in the rule data.
- Generic credit with no module code ("20 MC of electives") is shown as a note and is **not** turned into a planner entry.
- Optional grants (olympiad exemptions, IMO) are unticked by default; automatic ones are ticked. Everything is labelled a suggestion to confirm against the student's Transfer Credit Report.
- Programme renames are mapped explicitly (`RENAMED_MAJORS` in `adapters/cde-poly.ts`); programmes with no counterpart in `nus-programmes.ts` (e.g. Information Systems) are dropped and noted in the report.

## Adding a year or a faculty

1. Add a line to `scripts/exemptions/sources.ts`. `live` for a current page/PDF, `wayback` with a date window for history (the resolver also checks the academic year printed on the page, so a wrong window fails loudly), or `manual` for a page a human saved from a bot-protected site into `data/exemptions/manual/`.
2. If the layout is new, add an adapter in `scripts/exemptions/adapters/` and register it in `adapters/index.ts`. For a flat policy statement use `ruleAdapter` in `rule-based.ts`: the constants are tied to a stored snapshot and only emitted while the page still contains the wording they were reviewed against.
3. Run the build, read the report, check the numbers against the source by eye (the CDE parser also asserts each package's units add up to the stated total).

`scripts/exemptions/tools/` has helpers for reading PDFs (`pdf-dump.mts`, `pdf-lines.mts`) and for checking name matching (`coverage.ts`, `unmatched.mts`).

## Bot protection

Several NUS sites (the admissions hub, FASS, Science, some Business URLs) answer automated requests with an Imperva challenge. The fetcher treats that as a gap: it does not solve the challenge or work around it. Use an archived capture or save the page yourself from a normal browser (`manual` locator). Requests are low-rate (1.5 s apart) and identify themselves as `a-game-exemption-ingest`. Check each site's terms before widening this.

## Gotchas found while building it

- Wayback captures of the same URL are a mix of real pages and block pages; always decode gzip and check the body, not just the status.
- Faculty pages roll forward to the *next* intake around November, so "the current page" is usually not the current cohort's list.
- COMP's AY23/24 table lived at `/exemptions/polygrad/`.
- CDE PDFs encode the polytechnic in a vertically merged cell that breaks across pages, and AY23/24 marks packages by highlight colour; the parser reads the PDF's border lines and fills for this.

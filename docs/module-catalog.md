# Module catalog

A copy of NUSMods' module lists in our own database, so module-code autocomplete and validation don't call NUSMods per keystroke and can recognise modules that have since been retired or renamed.

```
api.nusmods.com/v2/<AY>/moduleList.json (+ current AY moduleInfo.json for credits)
        └─► npm run modules:sync ─► catalog_modules ─► /api/modules/catalog ─► onboarding module input
```

NUSMods publishes a public JSON API, so nothing is scraped. A sync is about 5 MB (five ~110 KB lists plus one ~4 MB info file).

## Commands

```bash
npm run modules:sync -- --dry-run   # fetch and summarise, write nothing
npm run modules:sync -- --yes       # replace catalog_modules (uses DATABASE_URL, prints the host first)
```

It keeps the current academic year and four before it (about 10,600 modules). It also adds the few codes that only appear in our exemption lists (retired `CS1020`/`CS2010`, `EG3611P`, the `POY19xx` placeholders) so typing one is recognised. It refuses to replace the table if fewer than 5,000 modules come back. Re-run it each semester when NUSMods publishes the new year.

`prisma db push` (part of `npm run build`) creates the table on deploy. Until `modules:sync` has been run against that database, the API falls back to NUSMods' current-year list, so the form keeps working.

## Search rules (`src/lib/modules/catalog-search.ts`)

- Nothing is searched below 3 characters.
- Case, spaces and punctuation are ignored: `cs 1101s` = `CS1101S`.
- Letters/mixed (`cs1`, `ma1301`) match from the start of a code. Digits only (`1301`) match the number part of any code (`MA1301`, `LSM1301`, ...).
- An exact code comes first, then modules NUSMods still lists (newest year first), then alphabetical. Eight results at most.
- `GET /api/modules/catalog?codes=CS1010, MA 1301` reports which of a pasted list exist and which don't.

## The input (`app/onboarding/module-code-input.tsx`)

Chips for chosen modules (green = in the catalog, amber `?` = added anyway), keyboard navigation (up/down, Enter, Escape, Backspace removes the last chip), and paste of a whole list. A comma, semicolon or newline in the value commits what's before it; this is read from the input value, not key presses, because phone keyboards often don't say which key was pressed. Codes that aren't in the catalog are flagged, and only well-formed ones can be added anyway.

## Not changed

The planner's "Add module" box and the simulator still use `/api/modules/search`, which reads NUSMods' current-year list through Next's fetch cache. They could move to this table (using `lastListedAy` to hide modules that are no longer offered) as a follow-up.

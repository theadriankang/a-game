# Programme pipeline (minors and second majors)

Where the requirements behind "you're close to a minor" come from. The nudges on the planner and the Minors page only compare a student's modules to this data; getting the data right is the whole job.

```
department page / PDF ─► scripts/programmes ─► data/programmes/drafts/<id>.json ─► (a person reviews) ─► data/programmes/programmes.json ─► Postgres ─► planner nudges, /minors
   (live or hand-saved)    fetch · Claude · check      never loaded by itself           promote                reviewed in git            programmes     (falls back to the JSON)
```

Everything runs **offline, on a developer's machine**, never on Vercel and never at request time. The app only reads the `programmes` table (or, when that is empty or missing, the same JSON bundled with the deploy).

## Everyday commands

```bash
npm run programmes:extract -- --fetch-only            # fetch and store the sources, no model call, no cost
npm run programmes:extract -- --dry-run               # also show what would be sent to the model
npm run programmes:extract -- --only minor-ai         # draft one programme (needs ANTHROPIC_API_KEY, costs a few cents)
npm run programmes:extract                            # draft every source in scripts/programmes/sources.ts
npm run programmes:promote -- minor-ai                # move a reviewed draft into programmes.json
npm run programmes:validate                           # schema + sanity checks on the published data
npm run programmes:load -- --dry-run                  # validate and list what would be loaded
npm run programmes:load -- --yes                      # replace the programmes table (uses DATABASE_URL)
npm run programmes:selftest                           # engine + pipeline checks, no database or API key needed
```

Other flags for `extract`: `--offline` (stored snapshots only), `--refresh` (re-fetch), `--model <id>` (default `claude-opus-5-5`), and `--from-file out.json` (skip the model: use extractions read by hand or by another tool, as `{ "<source id>": <model-output JSON> }`; the fetch, normalise, schema, checks, comparison and draft steps all run as normal, and `meta.model` records that it was hand-read).

`programmes:load` refuses to write without `--yes` and prints the target database host first. `prisma db push` (part of `npm run build`) creates the table on deploy. A database that has been loaded keeps winning over the bundled JSON until it is reloaded, so **run the loader after promoting**. The local dev database (`agame_dev`) was created with `prisma db push` and loaded with all 198 programmes on 2026-11-28; the data layer reads it (`getProgrammes()` reports `source: database`) and every row matches `programmes.json`. A running `next dev` has to be restarted once after the table was added, because the Prisma client was regenerated. Production gets the table on its next deploy (the `build` script runs `prisma db push`), and then needs `programmes:load -- --yes` run once with the production `DATABASE_URL`.

## Adding a programme

1. Add a line to `scripts/programmes/sources.ts`: `id` (`minor-<subject>` / `second-major-<subject>`, permanent), `kind`, `label`, `department`, `url`. Use `locator: { manual: "file.pdf" }` for a page behind bot protection (below) and `hints` for a quirk the model would misread (say what the page means, never what the answer is).
2. `npm run programmes:extract -- --only <id>`. Read the output: the summary line, every `warning`, and, when the id is already published, the "differs from the published record" list.
3. Check the draft in `data/programmes/drafts/<id>.json` against the source by eye: group sizes, every module code, the excluded programmes, the caveats. Edit the draft file where it's wrong.
4. `npm run programmes:promote -- <id>`, read `git diff data/programmes`, run `programmes:validate` and `programmes:load -- --dry-run`, then `programmes:load -- --yes` when it should go live.

The extractor writes drafts only. Nothing it produces reaches students until step 4.

## What is stored

One record per programme (`src/lib/programmes/schema.ts`): `id`, `kind` (`minor`, `second-major`, or `specialisation` for a focus area inside a degree), `label`, `department`, `totalMcMin/Max`, `groups`, `excludedProgrammePrefixes`, `eligibleProgrammePrefixes`, `application`, `sourceUrl`, `sourceCheckedDate`, `caveats`, `cohortNote`. Each group is `{ id, label, requiredMc, moduleCodes?, codePrefixes?, excludeCodes? }`: a module counts toward the group when it is in `moduleCodes` or starts with a `codePrefixes` entry and is not in `excludeCodes`. A module counts toward at most one group of a programme (`allocateEntries` in `src/lib/minors/fit.ts`).

- `excludedProgrammePrefixes` are matched as a prefix of `User.programme`, which onboarding stores as `"<programme> (<faculty>)"`, e.g. `Bachelor of Science (Honours) - Statistics (Faculty of Science)`. Use the names in `src/lib/education-data/nus-programmes.ts`. `programmes:validate` warns about an exclusion that matches none of them (one that doesn't match can never apply to anyone).
- `eligibleProgrammePrefixes` is the inverse: when non-empty, **only** those programmes can take it (every CS focus area is `Bachelor of Computing in Computer Science` only). A student whose programme isn't known is treated as not eligible. Don't fill it from an exclusion list.
- `application` is how a student goes about getting it, as the source says: `type` `apply` (the department approves: an application, usually with a window) or `declare` (the student records it, e.g. in APAD), ordered `steps` (where and when, the entry requirement, a grade needed to continue), a `deadline` as the source words it, and an optional `url`. It is left `null` when the source says nothing, and the nudge then says so and points at the source page rather than guessing. This is what the planner's "How to go ahead" steps show next to what's still to take.
- Programme names that onboarding doesn't offer (for example Information Systems, which has no entry in `nus-programmes.ts`) are left out of exclusion lists: they could never apply to anyone.
- `label`, `department` and `sourceUrl` come from `sources.ts`, not the model, so it can't invent or mangle them.
- A requirement the page doesn't express as codes or a code pattern ("modules approved by the department") is left out of `groups` and written into `caveats` with its MC. The groups then add up to less than the headline total, and `validate` flags that on purpose.
- The database table is the same data (`prisma/schema.prisma`, `Programme`); `groups` is JSON.

## What the checks catch

`validate` and `extract` run the same checks (`scripts/programmes/lib/check.ts`), all warnings for a reviewer:

- groups that add up to less (or more) than the programme's MC;
- module codes NUSMods hasn't listed in the last four academic years (retired, renamed or mistyped; the public `api.nusmods.com` lists, cached in `data/programmes/raw`);
- code prefixes that match no module;
- excluded programmes that match nothing onboarding offers.

A retired module can legitimately appear in a requirement list, so these are for judgement, not automatic rejection. The schema itself rejects malformed codes, duplicate group ids and a group nothing could ever match.

## Cost and model

Extraction uses `claude-opus-5-5` at high effort because a silent mistake here (a missed module, a wrong MC figure) misleads a student about their degree. PDFs go to the model as document blocks (so table layout survives), pages as flattened text. Expect cents per programme; `--dry-run` shows what would be sent first. The request enables the API's server-side refusal fallback, so a safety-classifier decline re-runs on the default fallback model instead of failing (`meta.fellBack` in the draft says when that happened). Output is constrained to a JSON schema (structured outputs), then normalised and re-validated before it can become a draft.

## Bot protection

Several NUS sites sit behind Imperva. The **NUS Bulletin** (`nus.edu.sg/nusbulletin`) answered a plain request with a 212-byte challenge page on 2026-11-28, so nothing here reads it. The fetcher treats a challenge as a gap, not an obstacle: it does not solve or work around it. Open the page in a normal browser, save it as `data/programmes/manual/<file>`, and point the source's `locator` at it. The School of Computing's own pages and the department PDFs fetched fine, but the **HTML pages** of the Mathematics (`math.nus.edu.sg`) and Statistics (`stat.nus.edu.sg`) departments are behind the same challenge (their `wp-content` PDFs are not). Their requirements come from PDFs, which don't say how to declare, so their `application` comes from the Registrar's Open/Restricted list instead (see "How to apply" below). Requests are 1.5 s apart and identify as `a-game-programme-ingest`; check a site's terms before widening this.

`data/programmes/raw/` and `manual/` are git-ignored because this repo is public; `raw/manifest.json` (URL, capture time, SHA-256 per source), the drafts and `programmes.json` are committed.

## What is covered, and what is not

198 programmes are published:

| Kind | Programmes | Source |
|---|---|---|
| Minor (115) | **SoC (6):** Artificial Intelligence, Business Analytics, Business AI Systems, Computer Science, Information Systems, Information Security. **Science (24):** Mathematics, Statistics, Data Analytics, Quantitative Finance, Astronomy, Bioinformatics, Botany, Environmental Sustainability, Forensic Science, Geosciences, Aquatic Ecology, Medical Physics, Meteorology and Climate Science, Nanoscience, Nutrition, Pharmaceutical Science, Physics, Physics in Technology (closed to AY2025/26 onwards), and four more shared with other faculties. **CDE (20):** AI and Data Science for Materials, Applied AI, Architectural Studies, Biomedical Engineering, Cities, Computing, Data Engineering, Electrical Engineering, Hydrogen and Low Carbon Technology, Infrastructure Management and Finance, Innovation & Design, Landscape Architectural Studies, Management of Technology, Mechanical Engineering, Project Management, Sustainability Solutions, Systems Engineering, Visual Communication Design. **FASS and cross-faculty:** Anthropology, Art History, Asian Studies, Chinese Language, Chinese Languages and Cultures, Chinese Media, Chinese Studies, Chinese Studies (Bilingual), Chinese Translation, Communications and New Media, Criminal Justice, Cultural Studies, Economics, English Language and Linguistics, English Literature, English Studies, Film Studies, Gender Studies, Geographical Information Systems, Global Studies, Health and Social Sciences (closed to 2025 onwards), Health Well-being and Society, History, Human Services, Human-AI Systems, India Studies, Interactive Media Development, Interpreting, Japanese Studies, Language Science, Language Studies (12 languages), Malay Studies, Philosophy, Political Science, Psychology, Religious Studies, Science Technology & Society, Sociology, Southeast Asian Arts and Heritage, Southeast Asian Studies, Theatre and Performance Studies, Urban Studies, Visual Cultures. **Medicine, Music, others:** Integrative Health, Biomedical Informatics (MBBS only), Music and Society, Performing Arts (two pathways), Public Health, Community Development and Leadership. **Business:** Management and Entrepreneurship (for non-BBA students); Accountancy, Applied Business Analytics, Business Economics, Finance, Innovation & Entrepreneurship, Leadership & Human Capital Management, Marketing, Operations & Supply Chain Management and Real Estate (for BBA students) | SoC pages; department and CDE PDFs; pages saved by hand |
| Second major (60) | **SoC (4):** Artificial Intelligence (cohorts 2026/27 onwards), Business Analytics, Computer Science, Information Security. **Science (13):** Mathematics, Statistics, Data Analytics, Quantitative Finance (two records, by intake), Chemistry, Physics, Forensic Science, Food Science, Nutrition, Pharmaceutical Science, Marine & Freshwater Ecology. **CDE (5):** Applied AI, Computing, Innovation & Design, Systems Engineering, Sustainable Urban Development. **FASS (22):** Anthropology, Chinese Language, Chinese Languages and Cultures, Chinese Studies, Chinese Studies (Bilingual), Communications and New Media, Economics, English Language and Linguistics, English Literature, Environmental Science for Sustainability, Geography (cohorts 2026 onwards, and 2021 to 2025), History, Japanese Studies, Malay Studies, Philosophy, Political Science, Psychology, Social Work, Sociology, South Asian Studies, Southeast Asian Studies, Theatre and Performance Studies. **Music (5):** Audio Arts and Sciences, Music and Society, Music Collaboration and Production, Performing Arts (two pathways). **Others:** Public Health, Management (for non-BBA students), and for BBA students the same nine as the minors | as above |
| Specialisation (23) | The 11 BComp (CS) focus areas, from one page (`comp.nus.edu.sg/programmes/ug/focus`); the BBA Finance Specialisation in Sustainable Finance; three ECE specialisations (Advanced Electronics, Industry 4.0, Internet of Things); the four Engineering Science Programme specialisations (Nanoscience and Nanotechnology, Energy Systems and Technology, Computational Science, Engineering in Medicine), each as a 2025-onwards record and a 2021-2024 record | SoC page; BBA curriculum page; ECE and ESP pages saved by hand |

### How to apply

The Registrar's lists of minors and second majors (saved 2026-11-28) mark every programme **Open** or **Restricted**: an open one is declared by the student in the Academic Plan Declaration exercise (APAD) with no approval, a restricted one is applied for to the host and needs approval; the deadline for either is the end of the 5th semester. That is what `application` says for programmes whose own page doesn't:

- **Declare (Open):** every FASS programme above, all CDE programmes except the two below, and the Mathematics, Statistics, Data Analytics and AI and Data Science for Materials programmes.
- **Apply (Restricted):** Computing (Design and Engineering), minor and second major (EduRec, semester 2 of Year 2 or 3, fixed window) and Data Engineering (EduRec, semester 2 of Year 2), both from their own pages; every SoC minor and second major (EduRec by the 4th semester, entry requirements in the steps).
- **None:** the CS focus areas. The page doesn't say whether one is declared, and the caveat says so.

Where a programme page and the Registrar differ in detail, the page's own wording wins (Applied AI, Computing and Data Engineering all give their own steps).

### Who can take what

Eligibility is matched against the programme the student chose at onboarding, so it only knows their primary degree: "open to CDE students" is the four CDE prefixes (`Bachelor of Engineering`, `Bachelor of Arts (Architecture)`, `Bachelor of Arts (Industrial Design)`, `Bachelor of Landscape Architecture`), and a department's own major can't take that department's minor or second major (Psychology can't minor in Psychology). Rules about *other* programmes a student holds (no CS minor together with Computing (D&E); no SoC minor with Data Engineering; no Business/Management minor with Management of Technology) are in the caveats, not enforced.

### Provenance

The first five were hand-sourced earlier. The other 193 were read by hand on 2026-11-28 from SoC pages, two PDFs on department and CDE file hosts, and pages the project owner saved as PDFs in several rounds; all of them were brought in with `extract --from-file`, so they went through the same normaliser, schema and checks as a model result, but **not through the model call**. Every module code in the saved-page batches was checked against its page's text (about 1,150 references, none missing; the last, specialisation batch alone had 258), and the lists on the page were checked the other way too (a code on the page that no group uses is either a retired or older-cohort code, kept out on purpose, or noted in a caveat). Treat them like the first five: a strong starting point with the caveats shown to students, not a substitute for confirming with the department.

Decisions worth knowing about:

- **Language Studies is 12 programmes.** The Centre for Language Studies runs one minor per language (20 units in one language including a Level 6 course, or four courses plus one recognised course), so each language is its own record sharing one saved page. Courses from two languages don't add up. Courses marked `*` on the page are only offered to students who declared by January 2026, and that's in each record's caveats. The Minor in Multilingual Communication (two languages, 12 + 8 units) is not modelled: the group model can't say "two *different* languages", and pooling the courses would call a student done who had taken the wrong mix.
- **Requirements the page states as a pattern** (Philosophy, Political Science, Sociology, Anthropology, English Language and Linguistics) are `codePrefixes` with a digit ("PH3", "SC1") so "PH" can't catch an unrelated code.
- **Requirements the page doesn't list as modules** stay visible: the Second Major in Innovation & Design asks for 8 units from an "Innovation & Enterprise" basket the page doesn't list, so the groups add to 32 of 40 MC, a caveat says so, and the nudge shows the gap as its own line. The self-test allows a shortfall only when a caveat explains it.
- **Cohorts.** A record can carry `cohortFrom` and `cohortTo` (matriculation years: AY2026/27 is 2026), and the nudge, the Minors page and the programme page compare them with the student's `matriculationYear`. Outside the range, or with no intake year set, a programme is shown in the "not open to you" list with the reason ("Only open to students admitted AY2024/25 and earlier (it is closed to newer intakes)"). They are set where a programme is closed to newer intakes (Health and Social Sciences, from cohort 2025; Physics in Technology, to AY2024/25; the Chinese Studies and Chinese Language minors and second majors, to 2025) or exists only for some (Chinese Languages and Cultures and Chinese Studies (Bilingual), from 2026; Art History and Geography, which have a 2026 version and a 2021-2025 one; Nutrition, from AY2021/22; the Forensic Science second major, from AY2022/23). Everywhere else a record models the newest structure the page gives and says so in `cohortNote`, with older structures described in a caveat or left out, and it is shown to every intake.
- **Level requirements** ("at least 12 units at level 3000", "at least 16 units level 3000") and "at least N units outside your major" are not enforced; they're in the caveats.
- **Prerequisite chains.** "Close" counts remaining MC, not how long the path is: one course away from a Level 6 language course may be three semesters of prerequisites.

## What is still missing

Compiled on 2026-11-28 by checking the Registrar's lists of minors and second majors (and the Faculty of Science's list) against what is published. For each programme the Registrar marks Open (declared in APAD) or Restricted (apply to the host), and that decides the `application` once its page is in. To add one: save its page as a PDF (expand every collapsed section and every cohort tab first), add a line to `scripts/programmes/sources.ts`, put the PDF at `data/programmes/manual/<id>.pdf` and run the extractor.

### Minors with no usable page yet (9)

- **China Studies** (NUS College / FASS Office of Programmes): closed to cohort 2026 onwards, so it matters only to students from cohort 2025 and earlier. The saved page has the requirements (five courses, at least two from Group A History and Culture and two from Group B Society and Economy) but not the Courses Offered page that lists the groups.
- **Multilingual Communication** (Centre for Language Studies): saved, but the group model can't say "two different languages", and pooling the courses would call a student done who had taken the wrong mix.
- **Real Estate, for non-BBA students** (Department of Real Estate, restricted): the page saved for it was the Management and Entrepreneurship page again, so the Real Estate minor itself still needs its page. The BBA students' version is published.
- **Engineering Materials** (CDE and Science, open from AY2022/23): the saved document is the old 24-unit version for cohorts before AY2019/20.
- **Science:** Analytical Chemistry (the saved table of six modules and prerequisites is garbled and still says 24 units); Biophysics (the "criteria for completion" sections were collapsed); Chemistry; Computing (Sciences) (restricted); Life Sciences (the saved document is the 2021 version for cohorts AY2019/20 to AY2020/21).

### Second majors not published

- **Global Studies:** the saved "Graduation Requirements" page printed with no text (the requirements are probably an image or a collapsed section), so nothing could be read. It needs saving again, ideally with the page's sections expanded.
- **Computing (Sciences)** (Faculty of Science Dean's Office, restricted): no page saved. The matching minor is in the list above.
- **Life Sciences:** the saved document is the 2021 version for cohorts AY2019/20 to AY2020/21 (and an older one), not the requirements for current cohorts.
- **Music:** the Conservatory's per-instrument and voice second majors (violin, viola, cello, double bass, flute, oboe, clarinet, bassoon, French horn, trumpet, trombone, tuba, percussion, harp, piano, composition and voice) are described in an outline document with separate rules for cohorts 2020 and before and 2021 and after; they are audition-based and weren't modelled. Audio Arts and Sciences is published but can't reach "qualifies" (see below).
- **Not offered, so nothing to add:** Real Estate Finance (the Department's page says it is discontinued) and Biomedical Informatics (the Registrar lists a second major, but the Department of Biomedical Informatics shows only the minor, which is open to MBBS students only).

### Specialisations: saved but not modelled

The page for each of these was read and left out on purpose, because a wrong structure would tell a student they are closer (or further) than they are:

- **ECE Microelectronics & Quantum Materials, Robotics, Space Technology and Sustainable Electric Transportation.** Their pages don't separate core from elective courses cleanly, or give capstone variants (a project course or an alternative), so the units can't be assigned to groups without guessing. Each needs a person to read the page.
- **The BBA specialisation guides** (Accountancy, Business Analytics, Business Economics, Finance, Innovation & Entrepreneurship, Leadership & Human Capital Management, Marketing, Operations & Supply Chain Management, Real Estate) are unofficial student guides, not NUS pages, so they are not used. The BBA programme's own curriculum page supplies the Sustainable Finance specialisation, and the second majors and minors above.
- **CDE's 5 December 2025 specialisation table** lists about 40 specialisations across 13 degrees (for example Biomedical Materials, Tissue Engineering, Process Engineering, Analytics & Decision Intelligence, Aeronautical Engineering, Landscape Practice, Sustainable Green Buildings), but only their names: the saved text lost which degree each belongs to, and there is no requirements page for any of them. Each needs its own page saved before it can be modelled.

Advanced Electronics and Internet of Things name no eligible degrees on their pages, so they are shown to every student, with a caveat that says so.

### Specialisations: the full list isn't known

Published: the 11 CS focus areas, the BBA Specialisation in Sustainable Finance, three ECE specialisations and the Engineering Science set. No saved page lists every faculty's specialisations, so the rest can't be completed by name: the Economics specialisations in the B.Soc.Sci. (Hons), the Information Systems and other SoC degrees' tracks, the Science majors, and the CDE degrees beyond ECE and Engineering Science. The way to find them is each degree's own programme page (the Bulletin pages are bot-protected).

### Published, but incomplete

- **Astronomy:** one of the three essential courses (HSI2012) is no longer offered and the page names no replacement, so 4 of its 20 units are shown as unlisted.
- **Music, Collaboration and Production:** the page asks for 40 units but lists 36, so 4 are shown as unlisted.
- **Audio Arts and Sciences:** the page lists MUA2171 twice (almost certainly a typo for two different codes), so the courses it names add to fewer than 40 units and the record can't reach "qualifies".
- **Asian Studies:** the Chinese Studies list was in a collapsed section, and "three or more departments, at most 8 units from one" isn't checkable, so 16 units from one department would show as done.
- **BBA second majors and minors (for BBA students):** the page names "major elective courses" without listing them, so each discipline's own course code (FIN, MKT, DOS, and so on) stands in; Applied Business Analytics (DBA) and Business Economics (BSE) are the weakest guesses.
- **Artificial Intelligence second major:** the page nests CS3268, CS4243 and CS4248 under "one of the following two courses"; it is read as CS3268 compulsory plus one of the other two because the core is 20 units (five courses).
- **Theatre second major:** the saved page doesn't give the strands; the Theatre minor page does, so the strand rule could now be added.
- **Public Health, Management, Entrepreneurship and the BBA programmes:** only the newest structure. Cohort splits on the Chinese, Geography, Art History and Quantitative Finance programmes are separate records.

`npm run programmes:extract -- --fetch-only` is the checklist for sources that are already registered: for each one whose page is missing it prints the exact link to open and the file to save it as. A PDF that turns out to be a degree plan or a brochure with no module structure is not enough, and the programme goes back to waiting for its page. A page that is already there is read as normal, with no network request.

Deliberately not added:

- **Everything on a bot-protected site**: see "What is still missing" above.

Not modelled yet:

- **Primary majors.** `kind` covers minors, second majors and specialisations; changing or adding a degree isn't a "you're close" case.
- **Cohort versions.** A programme's rules change by intake; `cohortNote` records which one the source states and only one version per programme is kept. The AI minor and BAIS minor are for newer cohorts; the Information Systems minor page gives nothing after AY2024/25; the HCI focus area is CS cohort 2025 onward and the nudge doesn't check your cohort.
- **Double-counting limits** between a major and a minor (the SoC pages allow up to 8 MC for the AI minor and 16 MC for a second major; other programmes' rules aren't captured). They're in the caveats, not enforced.
- **Elective slack**: whether the missing modules fit in a student's free unrestricted electives.
- **Equivalents that exist only as prose** ("students precluded from CS2100 may take EE2028 and its prerequisite EE2026"): the single codes are included, combinations aren't.

## First-run checklist for the extractor

The model call is the one part that can't be tested without an API key. With `ANTHROPIC_API_KEY` in `.env`:

```bash
npm run programmes:extract -- --only minor-statistics    # smallest PDF; check cost and output first
npm run programmes:extract -- --only minor-business-analytics,focus-area-artificial-intelligence
```

Each draft for an already-published programme prints "matches the published record" or a list of differences. Those programmes were sourced by hand, so every difference is either an extractor error or a hand-sourcing error: decide which, and fix the draft's prompt/hints or the published data accordingly. Drafts of published ids are overwritten on every run and are never loaded.

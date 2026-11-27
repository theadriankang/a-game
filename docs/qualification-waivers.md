# Qualification-based waivers (H2 Math and similar)

Some requirements simply don't apply to students with the right background. This is different from an APC exemption: no credit is granted, and nothing needs applying for.

## The H2 Math case (`src/lib/qualifications.ts`)

`MA1301` Introductory Mathematics is a bridging module for students **without** a good H2 pass in Math or Further Math (NUS precludes it for anyone with A-level Math). NUS deems these backgrounds equivalent, so the student skips it:

| Background | Skips MA1301 |
|---|---|
| A-level H2 Math or Further Math | Yes |
| IB HL Math (Analysis & Approaches). IB SL, and HL Applications & Interpretation, do not | Yes |
| Polytechnic with a recognised maths certificate (list per polytechnic in `qualifications.ts`) | Yes |
| Passed the MA1301 Proficiency Test (held each July; no grade or units are given) | Yes |
| Anything else | No, read `MA1301` (or `MA1301X`) in Year 1 |

Sources: Mathematics Department ("Candidates without H2 Maths", "MA1301 Proficiency Test") and NUS admissions ("Mathematics requirements for polytechnic applicants", December 2024). The two certificate lists differ slightly; the newer admissions one wins. Re-check yearly.

## Why the planner needed this

Many modules list "H2 Math **or** MA1301" as a prerequisite (`CS1231S`, `MA1521`, `MA1522`, `DSA1101`, `ST1131` in the CS degree; 76 modules across NUS mix an A-level subject with module alternatives). NUSMods' parsed prerequisite tree keeps only the MA1301 branch, so a student with H2 Math was flagged for a prerequisite they had already met. The student's answer (`User.mathBackground`, asked in onboarding) now makes the checker treat `MA1301`/`MA1301X` as satisfied, the simulator stops treating them as prerequisites, and the module page says where the student stands. A student who answers "none" still gets the warning, which is correct for them. An H2 student who plans `MA1301` is told NUS precludes it.

## Similar cases (not built yet)

Found by reading the preclusion/prerequisite text of every module in NUSMods for AY2026/27, which encodes A-level subjects with NUS subject codes:

| Bridging module | Replaced by | Notes |
|---|---|---|
| `PC1201` Fundamentals of Physics | A-level, IB HL or NUSHS Physics | Engineering's rules vary by department and qualification |
| `CM1417` / `CM1417X` Fundamentals of Chemistry | A-level Chemistry (grade E or better) | |
| `LSM1301` General Biology | A-level Biology (grade E or better) | |
| Malay 1, Bahasa Indonesia 1, Hindi 1, Chinese Characters Writing | Prior O- or A-level language grades | |
| `ES1000` / `ES1103` English | Qualifying English Test (exempt by qualification, or by band) | Not in NUSMods data at all |

Another 28 modules require an A-level subject with no module alternative, and 137 need A-level Chinese. These cause no false warnings (the checker treats a missing tree as no constraint) but the app can't tell whether a student qualifies.

The same mechanism extends to these: map each bridging module to the qualification that replaces it, ask the question only where the faculty makes it matter, and add the codes to the "assumed satisfied" set.

## Not covered

- Whether `MA1301` counts as core or as an unrestricted elective differs by programme, so the app doesn't yet add it to the plan for students who need it. The simulator warns instead.
- Subject codes like `06 MATHEMATICS` don't say H1 or H2; they're read as H2 Math, which matches the Mathematics Department's wording.

# S/U budget

Onboarding works out the student's S/U ("grade-free scheme") total from what the form already knows, instead of asking for a number. The rules live in `src/lib/su-budget.ts`; the card is `app/onboarding/su-budget-card.tsx`. Only the total is stored (`User.suBudgetTotalMc`).

Source: NUS Registrar, *Continuation and Graduation Requirements* (Satisfactory/Unsatisfactory option), and the Science, FASS and CDE APC pages for the APC option. Re-check these when NUS changes the scheme; the AY2025/26 intake already did (first-year units stretched to two years).

| Situation | Total | Split |
|---|---|---|
| Standard | 32 MC | 20 first-year units + 12 any time |
| 20 or more APCs at admission (no prior university study) | 20 MC | 8 first-year units + 12 any time |
| ...and gives up the 20 elective APC units (APC option) | +12 MC | the extra 12 are first-year units |
| Prior university credits recognised | 12 MC | any time |
| Already holds a degree | 0 | not eligible |
| Law, Dentistry, Medicine (except Nursing) | 0 | scheme doesn't apply |

"First-year units" can only be used on courses finished in the first year, or in the first two years from the AY2025/26 intake.

## Where the inputs come from

- **Polytechnic vs everyone else.** The standard 32 MC is for students without 20 or more APCs (JC, IB, NUS High and so on). A polytechnic diploma holder always has the automatic 20 elective APC units, so they get 20 MC. This holds even when we have no exemption list for their faculty or year (`totalApcUnits` in `su-budget.ts` adds the 20 for any polytechnic diploma; a list that also states the 20, or module-coded elective credit like Science's `POY19xx`, is the same credit and isn't counted twice).
- **APC units** = that elective credit plus the credits of every module in the confirmed-exemptions list.
- **APC option** is only offered when the student has 20 elective APC units and 20 to 39 APC units in all (the faculty pages' condition). It's a choice, so it's off until ticked.
- **Prior university study** and a manual override sit under "Adjust" because the form can't know them.

## Using the budget in the planner

Each planner module that NUS lets you S/U gets an "S/U" button on its card. Pressing it sets `PlannerEntry.isSU`, and the planner's "S/U budget" bar is the sum of the MC of those modules (`suUsage` in `su-budget.ts`). `User.suBudgetUsedMc` is no longer read or written; the used total is always derived from the entries, so it can't drift.

**Which modules can be S/U'd.** NUSMods publishes the Registrar's per-module flag as `attributes.su` (`isSuEligible`). It is set on Level 1000 modules, Level 2000 modules with no NUS-module prerequisites, and a few language modules, so we read the flag instead of guessing from the level. The button is simply not shown for a module without it, and also not shown for placeholders (`RESERVED`), exempted modules (they're credited with no grade) or a module whose NUSMods data couldn't be fetched. A module already marked S/U keeps its button so it can always be undone.

**Whether it fits the budget.** First-year units only cover modules in the first-year window (planner year 1, or years 1-2 from the AY2025/26 intake, `firstYearWindowYears`), while the any-time units cover any year. So a set of S/U modules fits when it is within the total and the MC after the window is within the any-time units (`suFits`). Only the total is stored; every scheme's any-time allowance is `min(12, total)`, so the split is derived rather than stored.

**When it doesn't fit.** The S/U button is never refused. Pressing it (or dragging an S/U module into a later year) when that would bust the budget opens a picker (`app/planner/su-budget-dialog.tsx`) listing every module that would be on S/U, the one being changed included and ticked. It opens over budget, so "Done" is greyed out until enough modules are unticked to fit; "Cancel", Esc or clicking outside changes nothing. "Done" sends one `PATCH` that applies the change and takes the unticked modules off S/U (`offSU`), in a single transaction. The budget isn't offered at all when the student's total is 0 (the scheme doesn't apply).

**Where it's enforced.** `PATCH /api/planner/[id]` re-checks everything (eligibility, budget and window, counting the `offSU` modules as already dropped) whenever an entry is put on S/U, and also when one already on S/U is moved or resized, so a hand-made request can't get around the planner; a request that doesn't fit gets a 409 with the reason, shown in a banner. Turning an S/U module into a placeholder takes it off S/U.

## Not done yet

- The S/U outcome isn't modelled: a module marked S/U is assumed to earn an S, so it still counts toward the requirement buckets. A U wouldn't count, and couldn't satisfy a prerequisite.
- Only the Registrar's per-module flag is used. Faculty or programme-specific limits that aren't in that flag aren't checked.
- There's no settings page to change the budget after onboarding.

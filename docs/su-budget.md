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

## Not done yet

- **Usage isn't tracked.** `suBudgetUsedMc` is never written, so the planner's bar always shows 0 used. Tracking it means letting students mark modules S/U and checking NUS's eligibility rule (Level 1000, and Level 2000 with no NUS prerequisites, unless the faculty says otherwise).
- The first-year/any-time split isn't stored, only the total, so a future tracker would need it.
- There's no settings page to change the budget after onboarding.

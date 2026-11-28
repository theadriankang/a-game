// Checks that need no database and no API key: the closeness engine against the published programmes, and the
// pipeline's own parts (normaliser, HTML flattening, comparison, validity checks).
//
//   npm run programmes:selftest

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessCloseness } from "../../src/lib/minors/closeness";
import { closedReason, computeMinorFit, type MinorFitEntry } from "../../src/lib/minors/fit";
import { buildOverview } from "../../src/lib/minors/overview";
import { computeProgrammeNudges } from "../../src/lib/minors/nudges";
import { ProgrammeRecordSchema, ProgrammesFileSchema, type ProgrammeRecord } from "../../src/lib/programmes/schema";
import { checkRecord } from "./lib/check";
import { compareToPublished } from "./lib/compare";
import { PUBLISHED_FILE } from "./lib/paths";
import { normaliseDraft, type DraftOut } from "./lib/normalise";
import { htmlToText } from "./lib/text";
import type { ProgrammeSource } from "./sources";

const { programmes } = ProgrammesFileSchema.parse(JSON.parse(readFileSync(PUBLISHED_FILE, "utf8")));
const get = (id: string) => {
  const p = programmes.find((x) => x.id === id);
  assert.ok(p, `published data has no ${id}`);
  return p;
};

const CS = "Bachelor of Computing in Computer Science (School of Computing)";
const mod = (moduleCode: string, status: MinorFitEntry["status"] = "COMPLETED", mc = 4): MinorFitEntry => ({ moduleCode, mc, status });

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}\n     ${e instanceof Error ? e.message : e}`);
  }
}

// --- published data ---
test("published programmes parse and their groups cover the headline MC", () => {
  assert.ok(programmes.length >= 5);
  for (const p of programmes) {
    const sum = p.groups.reduce((s, g) => s + g.requiredMc, 0);
    // A source can ask for more than it lists as modules (an unlisted basket of electives); that gap must then be
    // explained in a caveat, because the nudge shows it as its own requirement.
    const explained = (p.caveats ?? []).some((c) => /unlisted|doesn't list/i.test(c));
    assert.ok(sum >= p.totalMcMin || explained, `${p.id}: groups add to ${sum}, headline ${p.totalMcMin}, and no caveat explains the gap`);
  }
});

// --- programmes from other faculties ---
const BENG_EE = "Bachelor of Engineering (Electrical Engineering) (College of Design and Engineering)";
const BENG_CEG = "Bachelor of Engineering (Computer Engineering) (College of Design and Engineering)";

test("CDE-only programmes are open to CDE degrees, closed to everyone else, and Computing (D&E) excludes Computer Engineering", () => {
  const ai = get("minor-applied-ai-design-and-engineering");
  assert.equal(computeMinorFit([], ai, BENG_EE).eligible, true);
  assert.equal(computeMinorFit([], ai, "Bachelor of Arts (Architecture) (College of Design and Engineering)").eligible, true);
  assert.equal(computeMinorFit([], ai, CS).eligible, false);
  const computing = get("minor-computing-design-and-engineering");
  assert.equal(computeMinorFit([], computing, BENG_EE).eligible, true);
  assert.equal(computeMinorFit([], computing, BENG_CEG).eligible, false);
});

test("a major's own department can't be its minor or second major", () => {
  for (const [id, programme] of [
    ["minor-psychology", "Psychology (Faculty of Arts and Social Sciences)"],
    ["second-major-philosophy", "Philosophy (Faculty of Arts and Social Sciences)"],
    ["minor-human-services", "Social Work (Faculty of Arts and Social Sciences)"],
  ] as const) {
    assert.equal(computeMinorFit([], get(id), programme).eligible, false, id);
    assert.equal(computeMinorFit([], get(id), CS).eligible, true, id);
  }
});

test("BBA programmes are for BBA students (not their own major); Management and Entrepreneurship are for everyone else", () => {
  const BBA_FIN = "Bachelor of Business Administration (Honours) - Finance (NUS Business School)";
  const BBA_MKT = "Bachelor of Business Administration (Honours) - Marketing (NUS Business School)";
  const finMinor = get("minor-bba-finance");
  assert.equal(computeMinorFit([], finMinor, BBA_MKT).eligible, true);
  assert.equal(computeMinorFit([], finMinor, BBA_FIN).eligible, false);
  assert.equal(computeMinorFit([], finMinor, CS).eligible, false);
  for (const id of ["minor-management", "second-major-management", "minor-entrepreneurship"]) {
    assert.equal(computeMinorFit([], get(id), CS).eligible, true, id);
    assert.equal(computeMinorFit([], get(id), BBA_FIN).eligible, false, id);
  }
  // "Any two of" the level 1000 list: two courses done, the rest of the minor still to take.
  const fit = computeMinorFit([mod("MKT1705X"), mod("BSP1702X")], get("minor-management"), CS);
  assert.equal(fit.totalCompletedMc, 8);
});

test("a programme closed to newer intakes is open only to the intakes that can still take it", () => {
  const hss = get("minor-health-and-social-sciences"); // discontinued for cohort 2025 onwards
  assert.equal(computeMinorFit([], hss, CS, 2024).eligible, true);
  const closed = computeMinorFit([], hss, CS, 2025);
  assert.equal(closed.eligible, false);
  assert.equal(closedReason(closed), "Only open to students admitted AY2024/25 and earlier (it is closed to newer intakes).");
  // an unknown intake is treated as closed rather than guessed
  assert.equal(computeMinorFit([], hss, CS, null).eligible, false);
  assert.match(closedReason(computeMinorFit([], hss, CS, undefined)) ?? "", /intake year isn't set/);

  const clc = get("minor-chinese-languages-and-cultures"); // new for cohort 2026
  assert.equal(computeMinorFit([], clc, CS, 2026).eligible, true);
  assert.equal(computeMinorFit([], clc, CS, 2025).eligible, false);
  assert.equal(closedReason(computeMinorFit([], clc, CS, 2025)), "Only open to students admitted AY2026/27 onwards.");
  const old = get("minor-chinese-studies"); // 2021 to 2025 only
  assert.equal(computeMinorFit([], old, CS, 2023).eligible, true);
  assert.equal(computeMinorFit([], old, CS, 2026).eligible, false);
  assert.equal(closedReason(computeMinorFit([], old, CS, 2026)), "Only open to students admitted AY2021/22 to AY2025/26.");

  // a programme with no limits ignores the intake entirely, even an unknown one
  assert.equal(computeMinorFit([], get("minor-bba-finance"), "Bachelor of Business Administration (Honours) - Marketing (NUS Business School)", null).eligible, true);
});

test("the Minors overview puts a cohort-closed programme in the not-open list with its reason", () => {
  const o2026 = buildOverview([], programmes, CS, 2026);
  const o2023 = buildOverview([], programmes, CS, 2023);
  const id = (f: { minor: { id: string } }) => f.minor.id;
  assert.ok(o2026.closed.map(id).includes("minor-health-and-social-sciences"));
  assert.ok(!o2026.closed.map(id).includes("minor-chinese-languages-and-cultures"));
  assert.ok(o2023.closed.map(id).includes("minor-chinese-languages-and-cultures"));
  assert.ok(o2023.minors.map(id).includes("minor-health-and-social-sciences"));
  assert.equal([...o2026.minors, ...o2026.secondMajors, ...o2026.specialisations].length + o2026.closed.length, programmes.length);
});

test("a language minor needs one language: courses from two languages don't add up", () => {
  const french = get("minor-language-studies-french");
  const german = get("minor-language-studies-german");
  const mixed = ["LAF1201", "LAF2201", "LAG1201", "LAG2201", "LAF3201"].map((c) => mod(c));
  assert.equal(computeMinorFit(mixed, french, CS).totalCompletedMc, 12);
  assert.equal(computeMinorFit(mixed, german, CS).totalCompletedMc, 8);
  const full = ["LAF1201", "LAF2201", "LAF3201", "LAF3202", "LAF4202"].map((c) => mod(c));
  assert.equal(assessCloseness(computeMinorFit(full, french, CS)).tier, "qualifies");
});

test("the Level 6 requirement of a language minor can't be met by lower levels", () => {
  const french = get("minor-language-studies-french");
  const lower = ["LAF1201", "LAF2201", "LAF3201", "LAF3202", "LAF4201"].map((c) => mod(c));
  const fit = computeMinorFit(lower, french, CS);
  assert.equal(fit.totalCompletedMc, 16);
  assert.notEqual(assessCloseness(fit).tier, "qualifies");
});

// --- engine ---
test("one module counts once inside a programme, even when two groups match it", () => {
  const fit = computeMinorFit([mod("MA2213")], get("second-major-mathematics"), CS);
  assert.equal(fit.totalCompletedMc, 4);
});

test("three MA22xx modules fill both overlapping groups", () => {
  const fit = computeMinorFit([mod("MA2213"), mod("MA2214"), mod("MA2216")], get("second-major-mathematics"), CS);
  assert.equal(fit.totalCompletedMc, 12);
});

test("a module that fits one group stays there (the most constrained group fills first)", () => {
  const fit = computeMinorFit([mod("MA2116"), mod("MA2213")], get("second-major-mathematics"), CS);
  assert.deepEqual(fit.groups.find((g) => g.groupId === "probability")?.matchedCodes, ["MA2116"]);
});

test("completed modules are used before planned ones for the same group", () => {
  const fit = computeMinorFit([mod("ST3131", "PLANNED"), mod("ST3236", "COMPLETED")], get("minor-statistics"), CS);
  const group = fit.groups.find((g) => g.groupId === "level-3000");
  assert.deepEqual(group?.matchedCodes, ["ST3236"]);
  assert.equal(group?.plannedMc, 0);
});

test("closeness tiers on the Minor in Statistics (20 MC)", () => {
  const stats = get("minor-statistics");
  const tier = (codes: [string, MinorFitEntry["status"]?][]) =>
    assessCloseness(computeMinorFit(codes.map(([c, s]) => mod(c, s)), stats, CS));
  assert.equal(tier([]).tier, "far");
  assert.equal(tier([["ST1131"]]).tier, "far");
  const close = tier([["ST1131"], ["MA1521"], ["ST2334"]]);
  assert.equal(close.tier, "close");
  assert.equal(close.remainingMc, 8);
  const planned = tier([["ST1131"], ["MA1521"], ["ST2334"], ["ST2132"], ["ST3131", "PLANNED"]]);
  assert.equal(planned.tier, "qualifies");
  assert.equal(planned.dependsOnPlanned, true);
  const done = tier([["ST1131"], ["MA1521"], ["ST2334"], ["ST2132"], ["ST3131"]]);
  assert.equal(done.tier, "qualifies");
  assert.equal(done.dependsOnPlanned, false);
});

test("a student whose programme is excluded is never nudged; surplus modules don't inflate progress", () => {
  const stats = get("minor-statistics");
  const all = ["ST1131", "MA1521", "ST2334", "ST2132", "ST3131"].map((c) => mod(c));
  assert.equal(assessCloseness(computeMinorFit(all, stats, "Bachelor of Science (Honours) - Statistics (Faculty of Science)")).tier, "ineligible");
  const surplus = assessCloseness(computeMinorFit([mod("ST1131"), mod("ST3131"), mod("ST3236"), mod("ST3239")], stats, CS));
  assert.equal(surplus.countedMc, 8);
});

test("nudges are ranked: plan-covers-it first, then fewest MC away", () => {
  const entries = ["ST1131", "MA1521", "ST2334", "ST2132", "MA1522", "MA2002", "MA2101", "CS1231S"].map((c) => mod(c));
  entries.push(mod("ST3131", "PLANNED"));
  const nudges = computeProgrammeNudges(entries, programmes, CS);
  assert.ok(nudges.length >= 2);
  assert.equal(nudges[0].tier, "qualifies");
  for (let i = 1; i < nudges.length; i++) assert.ok(nudges[i].tier === "close");
  assert.ok(!nudges.some((n) => n.id === "minor-ai"), "BComp CS students can't take the AI minor");
});

// --- specialisations, eligibility, steps ---
const BSC_STATS = "Bachelor of Science (Honours) - Statistics (Faculty of Science)";
const tierFor = (id: string, codes: [string, MinorFitEntry["status"]?][], programme: string | null = CS) =>
  assessCloseness(computeMinorFit(codes.map(([c, s]) => mod(c, s)), get(id), programme));

test("a focus area needs three Area Primaries with at least one at level 4000+", () => {
  const id = "focus-area-algorithms-theory";
  // Three level-3000 primaries: 8 MC count (the level-4000 slot is still empty), so one more is needed.
  const lacking4000 = tierFor(id, [["CS3230"], ["CS3231"], ["CS3236"]]);
  assert.equal(lacking4000.countedMc, 8);
  assert.equal(lacking4000.tier, "close");
  assert.match(lacking4000.unmetGroups[0].label, /level 4000/);
  // Add a level-4000 primary and it's done.
  assert.equal(tierFor(id, [["CS3230"], ["CS3231"], ["CS4231"]]).tier, "qualifies");
  // Two level-4000 primaries and nothing else is 8 MC: still one primary short.
  assert.equal(tierFor(id, [["CS4231"], ["CS4234"]]).remainingMc, 4);
});

test("a CS Foundation Course that is also an Area Primary counts toward the focus area", () => {
  assert.equal(tierFor("focus-area-artificial-intelligence", [["CS2109S"], ["CS3243"], ["CS4243"]]).tier, "qualifies");
});

test("a focus area is open to BComp (CS) students only", () => {
  const codes: [string, MinorFitEntry["status"]?][] = [["CS3230"], ["CS3231"], ["CS4231"]];
  assert.equal(tierFor("focus-area-algorithms-theory", codes, CS).tier, "qualifies");
  assert.equal(tierFor("focus-area-algorithms-theory", codes, BSC_STATS).tier, "ineligible");
  assert.equal(tierFor("focus-area-algorithms-theory", codes, null).tier, "ineligible");
  const fit = computeMinorFit(codes.map(([c]) => mod(c)), get("focus-area-algorithms-theory"), BSC_STATS);
  assert.ok(fit.onlyFor?.includes("Bachelor of Computing in Computer Science"));
});

test("every specialisation is restricted to a programme; every SoC minor and second major says how to apply", () => {
  for (const p of programmes.filter((x) => x.kind === "specialisation")) {
    // A specialisation is normally open to one degree; one whose page names no degrees is allowed only if a caveat says so.
    const saysUnstated = (p.caveats ?? []).some((c) => /doesn't say which degrees/i.test(c));
    assert.ok(p.eligibleProgrammePrefixes.length > 0 || saysUnstated, `${p.id} has no eligible programme`);
  }
  for (const p of programmes.filter((x) => x.kind !== "specialisation" && x.department === "NUS Computing")) {
    assert.equal(p.application?.type, "apply", `${p.id} should say it needs an application`);
    assert.match(p.application!.steps.join(" "), /EduRec/);
    assert.match(p.application!.deadline ?? "", /4th semester/);
  }
});

test("nudge steps list what's missing (minus what's in the plan), code patterns, and how to apply", () => {
  // A Faculty of Science student with the CS foundations but no level-3000/4000 CS course.
  const entries = ["CS1010S", "CS2030S", "CS2040S", "CS2100"].map((c) => mod(c));
  const nudge = computeProgrammeNudges(entries, programmes, BSC_STATS).find((n) => n.id === "minor-computer-science");
  assert.ok(nudge, "the Minor in Computer Science should be raised");
  assert.equal(nudge.tier, "close");
  assert.equal(nudge.kind, "minor");
  assert.equal(nudge.requirements.length, 1);
  assert.deepEqual(nudge.requirements[0].patterns, ["CS3xxx", "CS4xxx"]);
  assert.equal(nudge.requirements[0].remainingMc, 4);
  assert.equal(nudge.application?.type, "apply");
  assert.match(nudge.application!.steps[0], /EduRec/);

  // Options never include modules already in the plan, and are capped with a "+N more".
  const focus = computeProgrammeNudges(["CS3230", "CS3231"].map((c) => mod(c)), programmes, CS).find((n) => n.id === "focus-area-algorithms-theory");
  assert.ok(focus);
  const needed = focus.requirements[0];
  assert.deepEqual(needed.options, ["CS4231", "CS4234", "CS4330", "CS4430"]);
  assert.equal(needed.moreOptions, 0);
  assert.equal(focus.kind, "specialisation");
  assert.equal(focus.application, null);
  // Core done, 13 electives to choose two from: six are listed and the rest counted.
  const is = computeProgrammeNudges(["CS1010S", "CS2030", "IS1108"].map((c) => mod(c)), programmes, BSC_STATS).find((n) => n.id === "minor-information-systems");
  assert.ok(is, "the Minor in Information Systems should be raised");
  assert.equal(is.requirements.length, 1);
  assert.equal(is.requirements[0].remainingMc, 8);
  assert.equal(is.requirements[0].options.length, 6);
  assert.equal(is.requirements[0].moreOptions, 7);
});

test("the Minors page lists only what a student can take and accounts for every other programme, with a reason", () => {
  const countOpen = (o: ReturnType<typeof buildOverview>) => o.minors.length + o.secondMajors.length + o.specialisations.length;

  // A BComp (CS) student: all 11 focus areas are theirs; the AI minor is barred to them.
  const cs = buildOverview([], programmes, CS);
  assert.equal(countOpen(cs) + cs.closed.length, programmes.length, "open + closed must add up to everything tracked");
  assert.equal(cs.specialisations.filter((f) => f.minor.id.startsWith("focus-area-")).length, 11);
  assert.ok(cs.minors.some((f) => f.minor.id === "minor-statistics"));
  const ai = cs.closed.find((f) => f.minor.id === "minor-ai");
  assert.ok(ai, "the AI minor should be in the closed list");
  assert.equal(closedReason(ai), "Not open to Bachelor of Computing in Computer Science students.");

  // A BSc Statistics student: the focus areas are closed (one reason, listed once per group in the UI), and so is the
  // Statistics minor; the Computer Science minor is theirs.
  const stats = buildOverview([], programmes, BSC_STATS);
  assert.equal(countOpen(stats) + stats.closed.length, programmes.length);
  assert.equal(stats.specialisations.filter((f) => f.minor.id.startsWith("focus-area-")).length, 0);
  const focusClosed = stats.closed.filter((f) => f.minor.id.startsWith("focus-area-"));
  assert.equal(focusClosed.length, 11);
  assert.ok(focusClosed.every((f) => closedReason(f) === "Only open to Bachelor of Computing in Computer Science students."));
  assert.ok(stats.closed.some((f) => f.minor.id === "minor-statistics"));
  assert.ok(stats.minors.some((f) => f.minor.id === "minor-computer-science"));

  // Nothing is both open and closed, and every closed programme can say why.
  for (const o of [cs, stats]) {
    const open = new Set([...o.minors, ...o.secondMajors, ...o.specialisations].map((f) => f.minor.id));
    assert.ok(o.closed.every((f) => !open.has(f.minor.id) && closedReason(f) !== null));
    assert.ok([...o.minors, ...o.secondMajors, ...o.specialisations].every((f) => closedReason(f) === null));
  }

  // A student whose programme isn't known can't be told they're barred, but programmes open to one degree only stay closed.
  const unknown = buildOverview([], programmes, null);
  assert.equal(unknown.specialisations.filter((f) => f.minor.id.startsWith("focus-area-")).length, 0);
  assert.equal(countOpen(unknown) + unknown.closed.length, programmes.length);
});

test("MC a source asks for but doesn't list as modules is shown as a requirement, not reported as done", () => {
  // Groups add up to 12 MC of a 20 MC programme: the other 8 MC aren't expressed as modules.
  const partial: ProgrammeRecord = {
    ...get("minor-statistics"),
    id: "minor-partial",
    totalMcMin: 20,
    groups: [{ id: "known", label: "Known requirement", requiredMc: 12, moduleCodes: ["ST1131", "MA1521", "ST2334"] }],
  };
  const entries = ["ST1131", "MA1521", "ST2334"].map((c) => mod(c));
  const nudge = computeProgrammeNudges(entries, [partial], CS).find((n) => n.id === "minor-partial");
  assert.ok(nudge, "12 of 20 MC is close enough to raise");
  assert.equal(nudge.tier, "close");
  assert.equal(nudge.remainingMc, 8);
  assert.equal(nudge.requirements.length, 1);
  assert.equal(nudge.requirements[0].remainingMc, 8);
  assert.match(nudge.requirements[0].label, /official page/);
});

// --- pipeline parts ---
const source: ProgrammeSource = { id: "minor-test", kind: "minor", label: "Minor in Testing", department: "Test Dept", url: "https://example.edu/minor" };
const messy: DraftOut = {
  totalMcMin: 12,
  totalMcMax: null,
  groups: [
    { id: "Core Modules!", label: " Core (choose two) ", requiredMc: 8, moduleCodes: ["cs 1231s", "CS1231S", " ma1100 "], codePrefixes: [], excludeCodes: [] },
    { id: "Core Modules!", label: "Electives", requiredMc: 4, moduleCodes: [], codePrefixes: ["st32"], excludeCodes: ["st3280"] },
    { id: "approved", label: "Approved modules", requiredMc: 4, moduleCodes: [], codePrefixes: [], excludeCodes: [] },
  ],
  excludedProgrammePrefixes: ["Bachelor of Laws", "Bachelor of Laws", " "],
  eligibleProgrammePrefixes: [],
  application: null,
  caveats: ["  Check the elective list. "],
  cohortNote: "  AY2024/25 onwards ",
  cohortFrom: null,
  cohortTo: null,
};

test("normaliser tidies codes and ids, drops groups with nothing to match, and says so", () => {
  const { candidate, notes } = normaliseDraft(messy, source, "2026-11-28T03:00:00.000Z");
  const record = ProgrammeRecordSchema.parse(candidate);
  assert.deepEqual(record.groups[0].moduleCodes, ["CS1231S", "MA1100"]);
  assert.equal(record.groups[0].label, "Core (choose two)");
  assert.equal(record.groups.length, 2);
  assert.notEqual(record.groups[0].id, record.groups[1].id);
  assert.deepEqual(record.groups[1].codePrefixes, ["ST32"]);
  assert.deepEqual(record.groups[1].excludeCodes, ["ST3280"]);
  assert.deepEqual(record.excludedProgrammePrefixes, ["Bachelor of Laws"]);
  assert.equal(record.cohortNote, "AY2024/25 onwards");
  assert.equal(record.sourceCheckedDate, "2026-11-28");
  assert.equal(record.label, source.label);
  assert.equal(notes.length, 1);
  assert.ok(record.caveats.some((c) => c.includes("Approved modules")), "the dropped group is recorded in the caveats");
});

test("the schema rejects a group that nothing could ever match, and bad module codes", () => {
  const base = get("minor-statistics");
  const noCodes = { ...base, groups: [{ id: "x", label: "x", requiredMc: 4 }] };
  assert.equal(ProgrammeRecordSchema.safeParse(noCodes).success, false);
  const badCode = { ...base, groups: [{ id: "x", label: "x", requiredMc: 4, moduleCodes: ["not a code"] }] };
  assert.equal(ProgrammeRecordSchema.safeParse(badCode).success, false);
});

test("htmlToText keeps headings, list items and table rows on their own lines and drops page chrome", () => {
  const text = htmlToText(`<html><body><nav>Menu</nav><main><h2>Requirements</h2><ul><li>CS1231S</li><li>CS2040S</li></ul>
    <table><tr><th>Level</th><th>Module</th></tr><tr><td>1000</td><td>ST1131</td></tr></table><script>x()</script></main><footer>Contact</footer></body></html>`);
  assert.match(text, /## Requirements/);
  assert.match(text, /\n- CS1231S/);
  assert.match(text, /\| 1000 \| ST1131 \|/);
  assert.ok(!/Menu|Contact|x\(\)/.test(text));
});

test("compareToPublished: identical = no differences; a changed code or total is reported", () => {
  const a = get("minor-statistics");
  assert.deepEqual(compareToPublished(a, a), []);
  const changed: ProgrammeRecord = {
    ...a,
    totalMcMin: 24,
    groups: a.groups.map((g, i) => (i === 0 ? { ...g, moduleCodes: [...(g.moduleCodes ?? []), "ST9999"] } : g)),
  };
  const lines = compareToPublished(changed, a).join("\n");
  assert.match(lines, /Total MC/);
  assert.match(lines, /ST9999/);
});

test("checkRecord flags a short group total, unknown codes, dead prefixes and unreachable exclusions", () => {
  const base = get("minor-statistics");
  const record: ProgrammeRecord = {
    ...base,
    groups: [{ id: "g", label: "G", requiredMc: 4, moduleCodes: ["ST1131", "ZZ9999"], codePrefixes: ["QQ"] }],
    excludedProgrammePrefixes: ["Bachelor of Nothing"],
  };
  const text = checkRecord(record, { catalog: new Set(["ST1131", "ST2334"]) }).join("\n");
  assert.match(text, /add up to 4 MC/);
  assert.match(text, /ZZ9999/);
  assert.match(text, /"QQ"/);
  assert.match(text, /Bachelor of Nothing/);
  assert.match(checkRecord(base, { catalog: null }).join("\n"), /not checked against NUSMods/);
});

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);

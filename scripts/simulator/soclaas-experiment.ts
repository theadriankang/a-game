// Standalone experiment: compare SoCLaaS (NUS SoC's free LLM gateway)
// against the already-fixed deterministic buildAutoPlan() scheduler, on
// the same real BComp(CS) data. NOT wired into the live app - this prints
// both plans side by side so you can judge whether the LLM is actually
// better before touching /api/simulator/auto-plan at all.
//
// Suggested location: scripts/simulator/soclaas-experiment.ts (two levels
// under repo root, matching the scripts/modules/ and scripts/exemptions/
// convention already in this repo).
//
// Setup:
//   export SOCLAAS_API_KEY=...     # from soclaas-portal.comp.nus.edu.sg - never commit this
//   export SOCLAAS_MODEL=gpt-oss-120b   # optional, defaults below. Try "coder" too.
//
// Run:
//   npx tsx scripts/simulator/soclaas-experiment.ts [targetTotalSemesters] [existingEntriesJsonPath]
//
// Examples:
//   npx tsx scripts/simulator/soclaas-experiment.ts 8
//   npx tsx scripts/simulator/soclaas-experiment.ts 6 ./my-current-plan.json
//
// (Optional: add to package.json scripts as
//   "simulator:soclaas": "tsx scripts/simulator/soclaas-experiment.ts"
//  to match the modules:sync-style convention already in this repo.)

import { readFileSync } from "node:fs";
import { bcompCs } from "../../src/lib/degree-requirements/bcomp-cs";
import {
  buildAutoPlan,
  type AutoPlanCandidateModule,
  type AutoPlanExistingEntry,
} from "../../src/lib/degree-requirements/auto-plan";
import { getModuleInfo, flattenPrereqTree, NUSMODS_ACAD_YEAR, type PrereqTree } from "../../src/lib/nusmods";

const SOCLAAS_API_KEY = process.env.SOCLAAS_API_KEY;
const SOCLAAS_MODEL = process.env.SOCLAAS_MODEL ?? "gpt-oss-120b";
const SOCLAAS_BASE = "https://soclaas-api.comp.nus.edu.sg/v1";

if (!SOCLAAS_API_KEY) {
  console.error(
    "Set SOCLAAS_API_KEY in your environment first (mint one at soclaas-portal.comp.nus.edu.sg while on NUS wifi). Never commit it."
  );
  process.exit(1);
}

const targetTotalSemesters = Number(process.argv[2] ?? 8);
const existingEntriesPath = process.argv[3];

// Fresh-student scenario by default (empty plan). Pass a JSON file of your
// own real planner entries as the second CLI arg to test against your
// actual in-progress plan instead.
const existingEntries: AutoPlanExistingEntry[] = existingEntriesPath
  ? JSON.parse(readFileSync(existingEntriesPath, "utf8"))
  : [];

const SEMESTER_MC_CAP = 23;
const SEMESTER_MC_FLOOR = 15;

type AutoPlanAddedEntryLike = {
  moduleCode: string | null;
  label: string;
  mc: number;
  academicYear: number;
  semester: number;
  requirementTag: string | null;
};

// Same candidate-building logic as app/api/simulator/auto-plan/route.ts -
// kept duplicated here (rather than imported) since the route also reads
// the signed-in user's programme/exemptions from the DB, which this
// standalone script deliberately doesn't touch.
async function buildCandidateModules(): Promise<AutoPlanCandidateModule[]> {
  const existingCodes = new Set(
    existingEntries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
  );
  const codesToFetch = Array.from(
    new Set(
      bcompCs.buckets.flatMap((b) => b.moduleCodes ?? []).filter((c) => !existingCodes.has(c.toUpperCase()))
    )
  );

  const fetched = await Promise.all(
    codesToFetch.map(async (code) => {
      try {
        const info = await getModuleInfo(NUSMODS_ACAD_YEAR, code);
        return { code, info };
      } catch {
        return { code, info: null };
      }
    })
  );

  const candidateModules: AutoPlanCandidateModule[] = [];
  for (const bucket of bcompCs.buckets) {
    for (const code of bucket.moduleCodes ?? []) {
      if (existingCodes.has(code.toUpperCase())) continue;
      const found = fetched.find((f) => f.code === code)?.info;
      if (!found) continue;
      candidateModules.push({
        moduleCode: found.moduleCode,
        label: found.title,
        mc: Number(found.moduleCredit) || 4,
        bucketId: bucket.id,
        prereqCodes: flattenPrereqTree(found.prereqTree),
        // Real and/or tree - the deterministic buildAutoPlan() now uses this
        // (not the flattened list) to decide readiness; see auto-plan.ts.
        prereqTree: found.prereqTree,
      });
    }
  }
  return candidateModules;
}

function buildSystemPrompt(): string {
  return `You are drafting the remaining semesters of an NUS School of Computing
BComp (Computer Science) student's degree plan. You will receive the
student's existing planned/completed modules, the degree's requirement
buckets, a list of real candidate modules with NUSMods prerequisite data,
and a target total number of semesters (6 = 3 years, 7 = 3.5 years,
8 = 4 years).

Each candidate module has BOTH a prereqCodes array AND a prereqExpression
string. prereqCodes is a flattened reference list ONLY - it does NOT mean
every code in it is individually required. prereqExpression is the real
rule: a logical AND/OR expression over module codes, e.g.
"(CS1010 OR CS1010E OR CS1101S OR UTC2851) AND (CS1231S OR MA1100)". That
example means: the student needs ONE of the four codes in the first group
AND ONE of the two codes in the second group - NOT all six. Determine
readiness by evaluating prereqExpression, substituting true for any code
already scheduled in a STRICTLY earlier semester (or in existingEntries),
true for any code that does not appear anywhere in candidateModules or
existingEntries (it is outside this degree's own data - assume the
student already has it from elsewhere), and false otherwise. Do not
refuse to schedule a module just because some single code inside an OR
group is absent or unscheduled - only an AND group requires every member.

Hard constraints (never violate):
- Never schedule a module until its prereqExpression evaluates to true by
  the rule above.
- Never exceed constraints.semesterMcCap MC in a single semester.
- Never invent a moduleCode that isn't in candidateModules or
  existingEntries.
- Only add semesters after the latest semester already present in
  existingEntries.
- Once a requirement bucket's requiredMc is met (check the structure's
  buckets), do not schedule a further module whose bucketId is the same
  bucket, even if it's a different, unused moduleCode from that bucket's
  list - most buckets are "pick one of these" or "take exactly this much",
  not "take everything listed". Concretely: schedule at most ONE of
  CS1101S/UTC2851 (Digital Literacy), and at most ONE of
  GEA1000/BT1101/ST1131/DSA1101 (Data Literacy) - pick whichever one
  lets the rest of the plan proceed, never both.
- Some buckets in structure.buckets have NO moduleCodes list at all (or an
  empty one) - these are GE pillars, Interdisciplinary & Cross-Disciplinary,
  CS Breadth & Depth, and Unrestricted Electives. There is no real module to
  recommend for these, so they must still be filled, but ONLY with
  placeholder entries: {"moduleCode": null, "label": <the bucket's own
  label>, "mc": <any amount you choose>, "academicYear": ..., "semester":
  ..., "requirementTag": <that bucket's own id field, exactly>}. Each such
  bucket's placeholder entries must sum to exactly that bucket's requiredMc
  - never fewer, never more, and never credited to a DIFFERENT bucket's id.
  In particular, do not fold Cultures & Connections, Singapore Studies,
  Communities & Engagement, Interdisciplinary & Cross-Disciplinary, or CS
  Breadth & Depth into Unrestricted Electives just because both use
  placeholder entries - each is tracked separately by requirementTag and
  each has its own requiredMc that must be met on its own.

Sequencing preferences (follow unless they conflict with a hard
constraint or an existing entry):
- Clear 1000-level foundational modules first, including Mathematics &
  Sciences modules - MA1521 belongs in Year 1 Sem 1 or Sem 2, MA1522 the
  semester immediately after MA1521 (Year 2 Sem 1 at the very latest), and
  ST2334 after MA1521. Do not delay Math & Sciences modules into Year 2
  Sem 2 or later unless every earlier semester is already full.
- Spread CS2030S, CS2040S, and CS2100 across two semesters rather than
  stacking all three together, unless the student is explicitly
  accelerating.
- CS2101 and CS2103T must be scheduled in the same semester as each other
  when both are still needed.
- Treat GE pillars, Unrestricted Electives, and other placeholder/no-fixed-
  module buckets as flexible buffer credits: use them to round out
  whichever semester is under constraints.semesterMcFloor, rather than
  giving them a fixed position.
- Aim for each semester to land between constraints.semesterMcFloor and
  constraints.semesterMcCap MC.
- CS Foundation modules at level 3000+ (e.g. CS3230) commonly appear in
  Year 2 once their prereqs clear - this is normal.

Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:
{"addedEntries": [{"moduleCode": string|null, "label": string, "mc": number, "academicYear": number, "semester": number, "requirementTag": string|null}], "warnings": [string]}`;
}

// Renders a real and/or prereqTree as a readable logical expression, e.g.
// "(CS1010 OR CS1010E OR CS1101S OR UTC2851) AND (CS1231S OR MA1100)" -
// sent to the LLM alongside (not instead of) the flattened prereqCodes
// list, so it can tell an alternative (OR) apart from a co-requirement
// (AND) instead of guessing from a flat list, which is what caused it to
// treat an unresolved OR-alternative (e.g. MA1301) as a hard blocker.
function prereqTreeToExpr(tree: PrereqTree | undefined): string | null {
  if (!tree) return null;
  if (typeof tree === "string") return tree.split(":")[0];
  if ("and" in tree) {
    const parts = tree.and.map(prereqTreeToExpr).filter((p): p is string => !!p);
    return parts.length ? `(${parts.join(" AND ")})` : null;
  }
  if ("or" in tree) {
    const parts = tree.or.map(prereqTreeToExpr).filter((p): p is string => !!p);
    return parts.length ? `(${parts.join(" OR ")})` : null;
  }
  return null;
}

async function callSoclaas(input: unknown): Promise<{ addedEntries: AutoPlanAddedEntryLike[]; warnings: string[] }> {
  const res = await fetch(`${SOCLAAS_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SOCLAAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: SOCLAAS_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    throw new Error(`SoCLaaS returned ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Couldn't parse SoCLaaS output as JSON:\n${content}`);
  }
}

// Mirrors (and, after the first real run surfaced two gaps, extends) the
// validation checklist in claude/whatif-sandbox-llm-optimization-spec.md
// §4 - never trust an LLM's plan without re-checking it against the same
// hard constraints the deterministic scheduler already enforces.
//
// Two checks were added after the first SoCLaaS run exposed real gaps:
// 1. Prereq satisfaction used to let a same-semester module "count" as
//    already scheduled if it happened to appear earlier in the response
//    array - so e.g. CS2103T and its prereq CS2040S landing in the SAME
//    semester could slip through as valid. A prereq now only counts if
//    it's in a STRICTLY earlier semester (or existingEntries).
// 2. Nothing checked whether a bucket got over-filled - the first run
//    scheduled BOTH options of a pick-one requirement (e.g. CS1101S and
//    its alternative UTC2851; ST1131 and DSA1101 for Data Literacy),
//    wasting MC on a requirement that was already satisfied. That's not
//    a hallucination or a prereq violation, so the old checklist missed
//    it entirely - now flagged as a bucket over-fill.
// Evaluates a real and/or prereqTree the same way auto-plan.ts's
// isTreeSatisfied does, but "at a point in time" (myOrder) rather than
// against a fixed final state - a leaf counts as satisfied only if it's
// scheduled in a STRICTLY earlier semester than myOrder, is one of the
// student's existing entries, or isn't part of this degree's own
// candidate/existing data at all (assumed already satisfied elsewhere).
function isTreeSatisfiedAt(
  tree: PrereqTree,
  myOrder: number,
  scheduledAt: Map<string, number>,
  candidatesByCode: Map<string, AutoPlanCandidateModule>,
  existingCodes: Set<string>
): boolean {
  if (typeof tree === "string") {
    const code = tree.split(":")[0].toUpperCase();
    if (existingCodes.has(code)) return true;
    if (!candidatesByCode.has(code) && !scheduledAt.has(code)) return true;
    const order = scheduledAt.get(code);
    return order !== undefined && order < myOrder;
  }
  if ("and" in tree) {
    return tree.and.every((t) => isTreeSatisfiedAt(t, myOrder, scheduledAt, candidatesByCode, existingCodes));
  }
  if ("or" in tree) {
    return tree.or.some((t) => isTreeSatisfiedAt(t, myOrder, scheduledAt, candidatesByCode, existingCodes));
  }
  return true;
}

function validate(
  result: { addedEntries: AutoPlanAddedEntryLike[]; warnings: string[] },
  candidateModules: AutoPlanCandidateModule[],
  structure: typeof bcompCs,
  existingEntries: AutoPlanExistingEntry[]
): string[] {
  const problems: string[] = [];
  const candidatesByCode = new Map(candidateModules.map((m) => [m.moduleCode.toUpperCase(), m]));
  const existingCodes = new Set(
    existingEntries.map((e) => e.moduleCode?.toUpperCase()).filter((c): c is string => !!c)
  );
  const semesterOrder = (ay: number, sem: number) => ay * 2 + sem;

  // moduleCode -> the semesterOrder it's scheduled in. existingEntries
  // seed this first so new entries can correctly treat them as "earlier".
  const scheduledAt = new Map<string, number>();
  for (const e of existingEntries) {
    if (e.moduleCode) scheduledAt.set(e.moduleCode.toUpperCase(), semesterOrder(e.academicYear, e.semester));
  }
  for (const e of result.addedEntries) {
    if (!e.moduleCode) continue;
    const upper = e.moduleCode.toUpperCase();
    if (scheduledAt.has(upper)) {
      problems.push(`${e.moduleCode} scheduled more than once`);
    }
    scheduledAt.set(upper, semesterOrder(e.academicYear, e.semester));
  }

  const bySemesterMc = new Map<string, number>();
  const bucketMc = new Map<string, number>(); // bucketId -> MC this draft contributes to it

  for (const entry of result.addedEntries) {
    const key = `Y${entry.academicYear}S${entry.semester}`;
    bySemesterMc.set(key, (bySemesterMc.get(key) ?? 0) + entry.mc);

    if (entry.moduleCode) {
      const upper = entry.moduleCode.toUpperCase();
      const candidate = candidatesByCode.get(upper);
      if (!candidate) {
        problems.push(`Hallucinated module code not in candidate list: ${entry.moduleCode}`);
        continue;
      }
      const myOrder = semesterOrder(entry.academicYear, entry.semester);
      if (candidate.prereqTree) {
        if (!isTreeSatisfiedAt(candidate.prereqTree, myOrder, scheduledAt, candidatesByCode, existingCodes)) {
          problems.push(
            `${entry.moduleCode} (Y${entry.academicYear}S${entry.semester}) scheduled before its prerequisites are ` +
              `satisfied - needs ${prereqTreeToExpr(candidate.prereqTree)}`
          );
        }
      }
      bucketMc.set(candidate.bucketId, (bucketMc.get(candidate.bucketId) ?? 0) + entry.mc);
    } else if (entry.requirementTag) {
      bucketMc.set(entry.requirementTag, (bucketMc.get(entry.requirementTag) ?? 0) + entry.mc);
    }
  }

  for (const [key, mc] of bySemesterMc) {
    if (mc > SEMESTER_MC_CAP) problems.push(`${key} totals ${mc} MC, over the ${SEMESTER_MC_CAP} MC cap`);
  }

  // Note: this only checks what THIS draft contributes, not existing
  // completed/planned MC already in a bucket - fine for the empty-plan
  // scenario the script defaults to, an undercount if you test against a
  // real in-progress plan (existingEntriesJsonPath).
  for (const bucket of structure.buckets) {
    const mc = bucketMc.get(bucket.id) ?? 0;
    if (mc > bucket.requiredMc) {
      problems.push(
        `Bucket "${bucket.label}" over-filled: drafted ${mc} MC against a ${bucket.requiredMc} MC requirement ` +
          `(likely scheduled more than one option from a pick-one list)`
      );
    }
  }

  return problems;
}

function printPlan(label: string, addedEntries: AutoPlanAddedEntryLike[], warnings: string[]) {
  console.log(`\n=== ${label} ===`);
  const bySem = new Map<string, AutoPlanAddedEntryLike[]>();
  for (const e of addedEntries) {
    const key = `Y${e.academicYear}S${e.semester}`;
    if (!bySem.has(key)) bySem.set(key, []);
    bySem.get(key)!.push(e);
  }
  for (const [key, entries] of [...bySem.entries()].sort()) {
    const total = entries.reduce((s, e) => s + e.mc, 0);
    console.log(`${key} (${total} MC): ${entries.map((e) => e.moduleCode ?? e.label).join(", ")}`);
  }
  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log(` - ${w}`));
  }
}

async function main() {
  console.log(
    `Target: ${targetTotalSemesters} semesters. Existing entries: ${existingEntries.length}. Model: ${SOCLAAS_MODEL}`
  );

  const candidateModules = await buildCandidateModules();

  const deterministic = buildAutoPlan({
    existingEntries,
    structure: bcompCs,
    candidateModules,
    targetTotalSemesters,
  });
  printPlan("Deterministic scheduler (already fixed)", deterministic.addedEntries, deterministic.warnings);

  const llmCandidateModules = candidateModules.map((m) => ({
    ...m,
    // The real rule - see prereqTreeToExpr's doc comment and the system
    // prompt for why this (not prereqCodes alone) decides readiness.
    prereqExpression: prereqTreeToExpr(m.prereqTree),
  }));

  const llmInput = {
    existingEntries,
    structure: { id: bcompCs.id, totalMc: bcompCs.totalMc, buckets: bcompCs.buckets },
    candidateModules: llmCandidateModules,
    targetTotalSemesters,
    constraints: { semesterMcCap: SEMESTER_MC_CAP, semesterMcFloor: SEMESTER_MC_FLOOR, maxLevel1000Mc: 60 },
  };

  try {
    const llmResult = await callSoclaas(llmInput);
    printPlan(`SoCLaaS (${SOCLAAS_MODEL})`, llmResult.addedEntries ?? [], llmResult.warnings ?? []);

    const problems = validate(llmResult, candidateModules, bcompCs, existingEntries);
    console.log("\n=== Validation against hard constraints ===");
    if (problems.length === 0) {
      console.log(
        "Passed - no hallucinated codes, no prereq violations, no MC-cap overruns, no bucket over-fills found."
      );
    } else {
      problems.forEach((p) => console.log(` - FAIL: ${p}`));
    }
  } catch (err) {
    console.error("SoCLaaS call failed:", err);
  }
}

main();

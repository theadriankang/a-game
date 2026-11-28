import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { nusFaculties } from "../../../src/lib/education-data/nus-programmes";
import type { ProgrammeSource } from "../sources";
import type { RawDoc } from "./fetch-raw";
import { DraftOutSchema, type DraftOut } from "./normalise";
import { htmlToText } from "./text";

// Requirement extraction is where a silent mistake costs a student most (a missed module, a wrong MC figure), so
// this uses the most capable general model at high effort rather than the cheapest one; override with --model.
export const DEFAULT_MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You convert the published requirements of one NUS (National University of Singapore) minor or second major into a structured record for a module-planning app. The app counts the modules a student has completed or planned against each requirement group to show how close they are to qualifying, so a wrong module code or MC figure misleads a real student about their degree.

Read the source and report only what it states. Never add module codes from your own knowledge of NUS, even ones you are sure exist, and never guess at a requirement the source doesn't spell out.

GROUPS
- One group per requirement line or row in the source (for example "Level 1000 (required)" or "Calculus (choose one)"). Keep the source's own wording in the label, including how many modules to choose.
- requiredMc is the MC the source asks for from that group. Modules are 4 MC unless the source says otherwise: "choose one" of 4 MC modules is 4, "choose two" is 8, three courses is 12. For a range such as "8-10 MC", use the lower bound and keep the range in the label.
- moduleCodes: every module code the source lists for the group, including alternatives (both CS1231 and CS1231S if both appear). Copy codes exactly: uppercase, no spaces.
- codePrefixes: only when the source defines a group by pattern instead of a list, for example "any Level-3000 ST32xx module" becomes the prefix "ST32". excludeCodes lists codes the source says do not count even though they match the group.
- A group may have both a list and a pattern. Leave unused arrays empty.
- If the source describes a requirement but gives no codes and no pattern (for example "modules approved by the department"), leave it out of groups and describe it in caveats, including its MC. Do not invent codes for it.

TOTALS
- totalMcMin and totalMcMax are the headline MC the programme asks for: "20 MC" is 20 and null, "20-24 MC" is 20 and 24. Use the source's headline number even when its rows add up differently, and say so in a caveat.

EXCLUDED PROGRAMMES
- excludedProgrammePrefixes: the programmes whose students the source says cannot take this one. Use the exact names from the KNOWN PROGRAMMES list in the request, without the faculty in brackets. If the source names a programme that is not in the list, still include it as the source writes it and mention that in a caveat. If the source states no restrictions, return an empty list.

ELIGIBLE PROGRAMMES
- eligibleProgrammePrefixes: only when the source says the programme is open ONLY to students of certain programmes (for example a focus area of one degree). Use the exact names from the KNOWN PROGRAMMES list, without the faculty in brackets. Leave it empty when the programme is open to everyone not excluded; do not fill it from an exclusion list.

APPLICATION
- application: how a student gets onto the programme, in the source's own terms, or null when the source says nothing about it. Never invent a process.
- type is "apply" when the department has to approve (an application, an application window, a restricted programme) and "declare" when the student records it themselves (for example in APAD).
- steps: two to five short, ordered sentences covering what a student must do or know to go ahead: where and when to apply, the entry requirement, a grade needed to apply or to continue, a condition the source states. Only what the source says.
- deadline: the cut-off as the source words it (for example "By the 4th semester of study"), or null. url: only if the source gives a specific page to apply on, else null.

CAVEATS
- One short, specific sentence per thing a reviewer should check: ambiguous or contradictory wording, a rule the structure cannot express (substitutions, "at most N MC from", double-counting with a student's major, GPA conditions, department approval, cohort-dependent exceptions), or anything you were unsure about. Do not pad: return an empty list if the source is clear.

COHORT
- cohortNote: the intake the document says it applies to, in its words (for example "AY2021/22 onwards"), or null.
- cohortFrom, cohortTo: set only when the document says the programme can be taken by some intakes and not others: the first and last intake year that can take it (AY2026/27 is 2026), null on a side with no limit. A programme discontinued for new students ("only cohort 2025 and before can declare it") has cohortTo 2025. null for both when anyone can take it.`;

function userInstructions(source: ProgrammeSource): string {
  const known = nusFaculties.flatMap((f) => f.programmes);
  return [
    `Extract the requirements of: ${source.label} (${source.department}).`,
    `Source URL: ${source.url}`,
    ...(source.kind === "specialisation"
      ? ["This is a specialisation (focus area) inside a degree, not a separate award. A page may cover several: extract ONLY the one named above."]
      : []),
    ...(source.hints?.length ? ["Notes on this source:", ...source.hints.map((h) => `- ${h}`)] : []),
    "",
    "KNOWN PROGRAMMES (official names, for excludedProgrammePrefixes):",
    ...known.map((p) => `- ${p}`),
  ].join("\n");
}

/** The user turn: the document first (a PDF as a document block, a page as text), then the instructions. */
export function buildContent(doc: RawDoc, source: ProgrammeSource) {
  const instructions = { type: "text" as const, text: userInstructions(source) };
  if (doc.kind === "pdf") {
    return [
      {
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.bytes.toString("base64") },
      },
      instructions,
    ];
  }
  const text = htmlToText(doc.bytes.toString("utf8"));
  return [{ type: "text" as const, text: `<source_page url="${source.url}">\n${text}\n</source_page>` }, instructions];
}

export type ExtractionResult = {
  out: DraftOut;
  model: string;
  fellBack: boolean;
  usage: { inputTokens: number; outputTokens: number };
};

/** One extraction call. Throws with a readable reason on a refusal, truncation or output that misses the schema. */
export async function extractWithClaude(doc: RawDoc, source: ProgrammeSource, model: string): Promise<ExtractionResult> {
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    // If the safety classifiers decline this model, the API re-runs the request on its default fallback instead
    // of the extraction just failing; `fellBack` below says when that happened.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "high", format: zodOutputFormat(DraftOutSchema) },
    messages: [{ role: "user", content: buildContent(doc, source) }],
  });

  if (response.stop_reason === "refusal") {
    const d = response.stop_details;
    throw new Error(`the model declined (${d?.category ?? "no category given"}): ${d?.explanation ?? "no explanation"}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("the answer was cut off at max_tokens");
  if (!response.parsed_output) throw new Error("the answer didn't match the requested schema");

  return {
    out: response.parsed_output,
    model: response.model,
    fellBack: (response.usage.iterations ?? []).some((entry) => entry.type === "fallback_message"),
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}

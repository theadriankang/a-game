import OpenAI from "openai";

// Lazily constructed, same pattern as anthropic.ts - importing this module
// shouldn't throw just because SOCLAAS_API_KEY isn't set yet.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.SOCLAAS_API_KEY;
    const baseURL =
      process.env.SOCLAAS_BASE_URL ?? "https://soclaas-api.comp.nus.edu.sg/v1";
    if (!apiKey) {
      throw new Error(
        "SOCLAAS_API_KEY is not set - can't call the NUS SoC LLM gateway without it."
      );
    }
    client = new OpenAI({ apiKey, baseURL });
  }
  return client;
}

// SoCLaaS is a free, OpenAI-compatible gateway run by NUS School of
// Computing (https://soclaas.comp.nus.edu.sg). Call GET /v1/models with
// your key to see which model IDs it accepts; "default" is a reasonable
// starting point but check what your key actually has access to.
const MODEL = process.env.SOCLAAS_MODEL || "default";

// SoCLaaS is described as "free and virtually unlimited" for NUS SoC
// students - no published per-token pricing, so cost tracking here is
// always zero. If that changes, update this.
const COST_USD = 0;

export type ModuleResearchResult = {
  summary: string;
  tags: string[];
  tagWeights: number[];
  keywords: string[];
  keywordWeights: number[];
  sources: string[];
  thinData: boolean;
  tokensUsed: number;
  costUsd: number;
};

/**
 * Same contract and output shape as researchModule() in anthropic.ts, but
 * backed by SoCLaaS (NUS School of Computing's free LLM gateway) instead
 * of the Anthropic API.
 *
 * IMPORTANT LIMITATION: unlike the Anthropic path, this has no live web
 * search. Anthropic's version uses Claude's built-in web_search tool to
 * find what students are actually saying right now; SoCLaaS's gateway
 * doesn't expose an equivalent server-side browsing tool, so this version
 * can only draw on the model's own training data - it cannot look up
 * current Reddit/forum posts. Treat its output as a rough, possibly
 * outdated approximation, not a live "community signal". The prompt below
 * tells the model to say so plainly rather than invent sentiment, and
 * thinData should usually come back true unless the module is a very
 * well-known one the model would have seen discussed a lot in training.
 */
export async function researchModuleViaSoclaas(
  moduleCode: string,
  moduleTitle: string | null
): Promise<ModuleResearchResult> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You're being asked about the NUS module ${moduleCode}${
          moduleTitle ? ` (${moduleTitle})` : ""
        }. You do NOT have live web search here - base this only on what you
already know from training about how students have described this module
(workload, teaching quality, grading/bell curve, group projects, how
interesting or dry it is, and so on). If you don't have solid knowledge of
this specific module, say so plainly rather than guessing or generalizing
from the subject area alone.

Then respond in exactly this format and nothing else:

SUMMARY: <2-4 sentence neutral summary of what students commonly say, or a plain statement that you don't have reliable information on this module>
TAGS: <3-6 short phrase tags, each as "tag:weight" separated by commas - weight is 1-5, how confident/common that sentiment is in what you know. Example: Heavy workload:5, Team project:4, Bell curve:2, Great prof:1>
KEYWORDS: <8-15 short, 1-3 word keywords/sentiment terms for a word-cloud visual, each as "keyword:weight" (same 1-5 weighting scheme as TAGS). Include specific nouns, adjectives and sentiment words associated with this module (e.g. professor names if commonly praised/criticized, specific assessment types, adjectives like "dry", "fun", "manageable"). Example: workload:5, bell-curve:3, group-project:4, dry:3, manageable:4, Prof Tan:2, essays:3, interesting:2>
THIN_DATA: <true if you have little to no reliable knowledge of this specific module, false only if you're confident you've seen it discussed meaningfully>

Do not invent or guess at student sentiment if you're not confident - say so plainly in the summary and set THIN_DATA to true instead.`,
      },
    ],
  });

  const fullText = response.choices[0]?.message?.content ?? "";

  const summaryMatch = fullText.match(/SUMMARY:\s*([\s\S]*?)(?=\n *TAGS:|$)/i);
  const tagsMatch = fullText.match(/TAGS:\s*([\s\S]*?)(?=\n *KEYWORDS:|$)/i);
  const keywordsMatch = fullText.match(/KEYWORDS:\s*([\s\S]*?)(?=\n *THIN_DATA:|$)/i);
  const thinDataMatch = fullText.match(/THIN_DATA:\s*(true|false)/i);

  const summary =
    summaryMatch?.[1]?.trim() ||
    fullText.trim() ||
    "No summary could be generated for this module.";

  // Shared parsing logic with anthropic.ts - kept duplicated rather than
  // extracted to a shared util so each provider file stays self-contained
  // and easy to delete independently if one provider goes away.
  function parseWeightedList(raw: string | undefined): { labels: string[]; weights: number[] } {
    const labels: string[] = [];
    const weights: number[] = [];
    if (!raw) return { labels, weights };
    for (const entry of raw.split(",")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(":");
      const label = parts[0]?.trim();
      if (!label) continue;
      const parsedWeight = parts[1] ? parseInt(parts[1].trim(), 10) : NaN;
      const weight = Number.isFinite(parsedWeight)
        ? Math.min(5, Math.max(1, parsedWeight))
        : 3;
      labels.push(label);
      weights.push(weight);
    }
    return { labels, weights };
  }

  const { labels: tags, weights: tagWeights } = parseWeightedList(tagsMatch?.[1]);
  const { labels: keywords, weights: keywordWeights } = parseWeightedList(keywordsMatch?.[1]);

  // Default to true (thin data) when the model didn't follow the format -
  // safer to under-claim confidence than over-claim it, since this path
  // has no way to verify against real sources.
  const thinData = thinDataMatch ? thinDataMatch[1].toLowerCase() === "true" : true;

  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  return {
    summary,
    tags,
    tagWeights,
    keywords,
    keywordWeights,
    // No web_search tool here, so no real source URLs to report - leaving
    // this empty rather than fabricating sources is deliberate.
    sources: [],
    thinData,
    tokensUsed: inputTokens + outputTokens,
    costUsd: COST_USD,
  };
}

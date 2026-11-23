import Anthropic from "@anthropic-ai/sdk";

// Lazily constructed so the module can be imported (e.g. by route files
// during build/typecheck) even when ANTHROPIC_API_KEY isn't set yet - the
// error only surfaces if something actually tries to call researchModule().
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set - module analysis can't run without it."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Current-generation Sonnet model (see /docs for the published model list).
const MODEL = "claude-sonnet-5";

// Pricing per Anthropic's published API rates, checked 2026-11-22 (see the
// architecture doc): Sonnet 5 is $2/MTok input, $10/MTok output through
// 2026-08-31 (standard $3/$15 after that date); web search is $0.01/search.
// This is an estimate for the in-app "Usage & cost" page, not an invoice -
// update it here if pricing changes.
const INPUT_PRICE_PER_TOKEN = 2 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 10 / 1_000_000;
const PRICE_PER_SEARCH = 0.01;

export type ModuleResearchResult = {
  summary: string;
  tags: string[];
  // Parallel to tags - see the schema comment on ModuleAnalysis.tagWeights.
  tagWeights: number[];
  sources: string[];
  thinData: boolean;
  tokensUsed: number;
  costUsd: number;
};

/**
 * Asks Claude to research a module using the web search tool and come back
 * with a short, honest summary of what students publicly say about it.
 *
 * This is Claude-synthesized research, not a scrape of a reviews site -
 * NUSMods has no reviews layer. The prompt explicitly tells the model not
 * to fabricate sentiment when there's little public discussion to go on;
 * `thinData` reflects the model's own self-report of that.
 */
export async function researchModule(
  moduleCode: string,
  moduleTitle: string | null
): Promise<ModuleResearchResult> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Research the NUS module ${moduleCode}${
          moduleTitle ? ` (${moduleTitle})` : ""
        }. Search for what students have publicly said about it - workload, teaching quality, grading/bell curve, group projects, how interesting or dry it is, and so on - from sources like Reddit (r/nus), student blogs, or other public forums.

Then respond in exactly this format and nothing else:

SUMMARY: <2-4 sentence neutral summary of what students commonly say>
TAGS: <3-6 tags, each as "tag:weight" separated by commas - weight is 1-5, how often that sentiment showed up across the sources you found (5 = came up in most sources you read, 1 = only one source mentioned it). Example: Heavy workload:5, Team project:4, Bell curve:2, Great prof:1>
THIN_DATA: <true if you found little to no public discussion to go on, false otherwise>

Do not invent or guess at student sentiment if you can't find real discussion for it - say so plainly in the summary and set THIN_DATA to true instead. Base each weight on what you actually saw repeated across sources, not a guess.`,
      },
    ],
  });

  let fullText = "";
  const sources = new Set<string>();

  for (const block of response.content) {
    if (block.type === "text") {
      fullText += block.text;
    } else if (block.type === "web_search_tool_result") {
      if (Array.isArray(block.content)) {
        for (const result of block.content) {
          sources.add(result.url);
        }
      }
    }
  }

  const summaryMatch = fullText.match(/SUMMARY:\s*([\s\S]*?)(?=\n *TAGS:|$)/i);
  const tagsMatch = fullText.match(/TAGS:\s*(.*)/i);
  const thinDataMatch = fullText.match(/THIN_DATA:\s*(true|false)/i);

  const summary =
    summaryMatch?.[1]?.trim() ||
    fullText.trim() ||
    "No summary could be generated for this module.";

  // Each raw tag is "label:weight" (weight 1-5). A tag with no parseable
  // weight (model drifted from the format, or an older-style response)
  // still gets kept with weight 3 - a safe middle value - rather than
  // dropped, since the label itself is still useful even if the model
  // didn't rate it.
  const tags: string[] = [];
  const tagWeights: number[] = [];
  if (tagsMatch?.[1]) {
    for (const raw of tagsMatch[1].split(",")) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(":");
      const label = parts[0]?.trim();
      if (!label) continue;
      const parsedWeight = parts[1] ? parseInt(parts[1].trim(), 10) : NaN;
      const weight = Number.isFinite(parsedWeight)
        ? Math.min(5, Math.max(1, parsedWeight))
        : 3;
      tags.push(label);
      tagWeights.push(weight);
    }
  }

  const thinData = thinDataMatch?.[1]?.toLowerCase() === "true";

  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens;
  const searchCount = response.usage.server_tool_use?.web_search_requests ?? 0;
  const costUsd =
    inputTokens * INPUT_PRICE_PER_TOKEN +
    outputTokens * OUTPUT_PRICE_PER_TOKEN +
    searchCount * PRICE_PER_SEARCH;

  return {
    summary,
    tags,
    tagWeights,
    sources: Array.from(sources),
    thinData,
    tokensUsed: inputTokens + outputTokens,
    costUsd,
  };
}

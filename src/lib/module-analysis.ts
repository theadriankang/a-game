import { prisma } from "@/lib/prisma";
import { NUSMODS_ACAD_YEAR, getModuleInfo } from "@/lib/nusmods";
import { researchModule } from "@/lib/anthropic";
import { AnalysisStatus, AnalysisTrigger } from "@prisma/client";

/**
 * The shared, cached report for a module - same row read by every user,
 * keyed by module code + academic year so last year's report doesn't get
 * served for a module that's changed since.
 */
export async function getCachedAnalysis(moduleCode: string) {
  return prisma.moduleAnalysis.findUnique({
    where: { moduleCode_academicYear: { moduleCode, academicYear: NUSMODS_ACAD_YEAR } },
  });
}

/** Is there already a request in flight for this module (any requester)? */
export async function hasPendingRequest(moduleCode: string) {
  const existing = await prisma.analysisRequest.findFirst({
    where: { moduleCode, status: AnalysisStatus.PENDING },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Queues a module for research, unless it's already cached or already
 * queued. AUTO_* requests aren't tied to a specific user (per the schema,
 * userId is null for those) - they're generated from a module being
 * compulsory or added to someone's plan, not from a click, so there's no
 * one in particular to notify. ON_DEMAND requests carry the requesting
 * user's id, since that's who gets the Telegram ping when it's ready.
 */
export async function enqueueAnalysis(
  moduleCode: string,
  trigger: AnalysisTrigger,
  userId: string | null = null
) {
  const [cached, pending] = await Promise.all([
    getCachedAnalysis(moduleCode),
    hasPendingRequest(moduleCode),
  ]);
  if (cached || pending) return null;

  return prisma.analysisRequest.create({
    data: { moduleCode, trigger, userId },
  });
}

/**
 * Does the actual research + cache write for one module. This is the
 * slow, costly part - called from the on-demand route (synchronously,
 * while the requester waits), from processAnalysisRequest below (for
 * AUTO_* requests, via Next's after()), and from the cron route as a
 * backstop for anything that didn't get processed either of those ways.
 */
export async function runAndCacheAnalysis(
  moduleCode: string,
  moduleTitle: string | null
) {
  const result = await researchModule(moduleCode, moduleTitle);

  const analysis = await prisma.moduleAnalysis.upsert({
    where: { moduleCode_academicYear: { moduleCode, academicYear: NUSMODS_ACAD_YEAR } },
    create: {
      moduleCode,
      academicYear: NUSMODS_ACAD_YEAR,
      summary: result.summary,
      tags: result.tags,
      tagWeights: result.tagWeights,
      keywords: result.keywords,
      keywordWeights: result.keywordWeights,
      sources: result.sources,
      status: result.thinData ? AnalysisStatus.THIN_DATA : AnalysisStatus.COMPLETED,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
    },
    update: {
      summary: result.summary,
      tags: result.tags,
      tagWeights: result.tagWeights,
      keywords: result.keywords,
      keywordWeights: result.keywordWeights,
      sources: result.sources,
      status: result.thinData ? AnalysisStatus.THIN_DATA : AnalysisStatus.COMPLETED,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
    },
  });

  return { analysis, result };
}

/**
 * Takes one already-created AnalysisRequest through to a final status:
 * skip the research entirely if another request for the same module got
 * cached in the meantime, otherwise look up the module's title and run
 * the actual research, then write the request row's final status/cost.
 * Never throws - a failure here marks the request FAILED instead, since
 * callers (the planner route's after(), the cron loop) don't want an
 * analysis failure to surface as their own request's error.
 */
export async function processAnalysisRequest(requestId: string, moduleCode: string) {
  try {
    const alreadyCached = await getCachedAnalysis(moduleCode);

    let finalStatus: AnalysisStatus;
    let tokensUsed: number | null = null;
    let costUsd: number | null = null;

    if (alreadyCached) {
      finalStatus = alreadyCached.status;
    } else {
      let title: string | null = null;
      try {
        const info = await getModuleInfo(NUSMODS_ACAD_YEAR, moduleCode);
        title = info.title;
      } catch {
        // Module might not exist in the current AY's offering list -
        // research can still proceed on the code alone.
      }
      const { analysis, result } = await runAndCacheAnalysis(moduleCode, title);
      finalStatus = analysis.status;
      tokensUsed = result.tokensUsed;
      costUsd = result.costUsd;
    }

    await prisma.analysisRequest.update({
      where: { id: requestId },
      data: { status: finalStatus, tokensUsed, costUsd },
    });

    return finalStatus;
  } catch (error) {
    console.error(`Module analysis failed for ${moduleCode}:`, error);
    await prisma.analysisRequest.update({
      where: { id: requestId },
      data: { status: AnalysisStatus.FAILED },
    });
    return AnalysisStatus.FAILED;
  }
}

import { prisma } from "@/lib/prisma";
import { NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
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
 * Does the actual research + cache write for one module. Called from the
 * cron worker, never from a request path - this is the slow, costly part.
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

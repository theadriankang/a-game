import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { getCachedAnalysis, runAndCacheAnalysis } from "@/lib/module-analysis";
import { sendTelegramMessage } from "@/lib/telegram";
import { AnalysisStatus } from "@prisma/client";

// Vercel's Hobby plan only allows a cron job to fire once a day (Pro plans
// allow finer schedules) - see vercel.json. One run processes a small batch
// so a single invocation can't balloon in cost or run past the serverless
// function timeout; anything left over gets picked up next run.
//
// This previously had no maxDuration set, which meant the function ran
// under whatever Vercel's default timeout is (well under what researching
// even one module can take - each one can involve several sequential web
// searches). Every invocation was silently dying mid-loop before writing a
// single result, which is why requests were piling up as PENDING forever.
// 60s is the max Vercel allows on Hobby; BATCH_SIZE is kept modest so a
// batch has a real chance of finishing inside that window rather than
// racing it.
export const maxDuration = 60;
const BATCH_SIZE = 3;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.analysisRequest.findMany({
    where: { status: AnalysisStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  const results: { moduleCode: string; status: string }[] = [];

  for (const req of pending) {
    try {
      // Another request for the same module may have already been
      // processed in an earlier run of this same batch (or a prior run) -
      // don't pay for a second research pass if so.
      const alreadyCached = await getCachedAnalysis(req.moduleCode);

      let finalStatus: AnalysisStatus;
      let tokensUsed: number | null = null;
      let costUsd: number | null = null;

      if (alreadyCached) {
        finalStatus = alreadyCached.status;
      } else {
        let title: string | null = null;
        try {
          const info = await getModuleInfo(NUSMODS_ACAD_YEAR, req.moduleCode);
          title = info.title;
        } catch {
          // Module might not exist in the current AY's offering list -
          // research can still proceed on the code alone.
        }
        const { analysis, result } = await runAndCacheAnalysis(req.moduleCode, title);
        finalStatus = analysis.status;
        tokensUsed = result.tokensUsed;
        costUsd = result.costUsd;
      }

      await prisma.analysisRequest.update({
        where: { id: req.id },
        data: { status: finalStatus, tokensUsed, costUsd },
      });

      if (req.userId) {
        const link = await prisma.telegramLink.findUnique({
          where: { userId: req.userId },
        });
        if (link) {
          const message =
            finalStatus === AnalysisStatus.THIN_DATA
              ? `Your analysis for *${req.moduleCode}* is ready - heads up, there wasn't much public discussion to go on for this one.`
              : `Your analysis for *${req.moduleCode}* is ready. Check the module's "At a glance" panel in the planner.`;
          await sendTelegramMessage(link.chatId, message);
        }
      }

      results.push({ moduleCode: req.moduleCode, status: finalStatus });
    } catch (error) {
      console.error(`Module analysis failed for ${req.moduleCode}:`, error);
      await prisma.analysisRequest.update({
        where: { id: req.id },
        data: { status: AnalysisStatus.FAILED },
      });
      results.push({ moduleCode: req.moduleCode, status: "FAILED" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

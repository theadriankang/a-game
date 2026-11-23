import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { dbErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import {
  enqueueAnalysis,
  getCachedAnalysis,
  hasPendingRequest,
  runAndCacheAnalysis,
} from "@/lib/module-analysis";
import { AnalysisStatus, AnalysisTrigger } from "@prisma/client";

type RouteContext = { params: Promise<{ code: string }> };

// Research involves a handful of web searches plus synthesis - usually a
// few seconds, occasionally close to the Hobby-plan ceiling. 60s is the
// max Vercel allows on Hobby; Pro/Enterprise could raise this further.
export const maxDuration = 60;

// GET returns the current state for a module: a cached report if one
// exists, or just whether a request is already queued for it. The client
// uses this to decide what to show - the report, a "queued" state, or a
// "request analysis" button.
export async function GET(_request: Request, { params }: RouteContext) {
  const { code } = await params;
  const moduleCode = code.toUpperCase();

  try {
    const analysis = await getCachedAnalysis(moduleCode);
    const pending = analysis ? false : await hasPendingRequest(moduleCode);
    return NextResponse.json({ analysis, pending });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

// POST runs an on-demand request for a module not already in someone's
// plan. Unlike the AUTO_* backlog (compulsory/planned modules, nobody
// waiting on any one of them, fine to batch overnight via the cron
// sweep - see app/api/cron/analyze-modules), this one has a user sitting
// on the other end of the click, so it runs the research right here
// instead of queuing for the next cron tick. The request row is still
// written for history/cost tracking and so a second concurrent click on
// the same module doesn't pay for research twice.
export async function POST(_request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { code } = await params;
  const moduleCode = code.toUpperCase();

  try {
    const request_ = await enqueueAnalysis(moduleCode, AnalysisTrigger.ON_DEMAND, userId);
    if (!request_) {
      const analysis = await getCachedAnalysis(moduleCode);
      return NextResponse.json({
        queued: false,
        analysis,
        message: analysis ? "Already cached." : "Already in progress.",
      });
    }

    try {
      let title: string | null = null;
      try {
        const info = await getModuleInfo(NUSMODS_ACAD_YEAR, moduleCode);
        title = info.title;
      } catch {
        // Module might not exist in the current AY's offering list -
        // research can still proceed on the code alone.
      }

      const { analysis } = await runAndCacheAnalysis(moduleCode, title);
      await prisma.analysisRequest.update({
        where: { id: request_.id },
        data: {
          status: analysis.status,
          tokensUsed: analysis.tokensUsed,
          costUsd: analysis.costUsd,
        },
      });

      return NextResponse.json({ queued: false, analysis }, { status: 200 });
    } catch (error) {
      console.error(`On-demand analysis failed for ${moduleCode}:`, error);
      await prisma.analysisRequest.update({
        where: { id: request_.id },
        data: { status: AnalysisStatus.FAILED },
      });
      return NextResponse.json(
        { queued: false, error: "Analysis failed - try again shortly." },
        { status: 502 }
      );
    }
  } catch (error) {
    return dbErrorResponse(error);
  }
}

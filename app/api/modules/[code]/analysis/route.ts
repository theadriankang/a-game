import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { dbErrorResponse } from "@/lib/api-error";
import {
  enqueueAnalysis,
  getCachedAnalysis,
  hasPendingRequest,
} from "@/lib/module-analysis";
import { AnalysisTrigger } from "@prisma/client";

type RouteContext = { params: Promise<{ code: string }> };

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

// POST queues an on-demand request for a module not already in someone's
// plan. Per the architecture doc this is processed on a cadence by the
// cron worker, never run live here - the requesting user gets a Telegram
// ping when it's ready.
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
      return NextResponse.json({ queued: false, message: "Already cached or queued." });
    }
    return NextResponse.json({ queued: true }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

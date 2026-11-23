import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processAnalysisRequest } from "@/lib/module-analysis";
import { sendTelegramMessage } from "@/lib/telegram";
import { AnalysisStatus } from "@prisma/client";

// Backstop, not the primary path. AUTO_* requests (module added to a
// plan) now get processed right away via Next's after() in the planner
// route itself, and ON_DEMAND requests (the "Request analysis" button)
// run synchronously in their own route - neither waits on this anymore.
// This still exists for whatever falls through the cracks of those (a
// function that got torn down mid-after(), a request created some other
// way) so nothing is ever permanently stuck. On Vercel's Hobby plan this
// can only be scheduled once a day (Pro plans allow finer schedules) -
// see vercel.json - which is fine for a backstop, not fine as the only
// way requests ever get processed, which is why it no longer is one.
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
    const finalStatus = await processAnalysisRequest(req.id, req.moduleCode);

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
  }

  return NextResponse.json({ processed: results.length, results });
}

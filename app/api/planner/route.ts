import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { enqueueAnalysis, processAnalysisRequest } from "@/lib/module-analysis";
import { isCompulsoryModuleCode } from "@/lib/degree-requirements/bucket";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { AnalysisTrigger } from "@prisma/client";
import { duplicateMessage, findDuplicateEntry } from "@/lib/planner-duplicates";

// after() below keeps this function alive past the point the response is
// already sent back to the browser, so adding a module still feels
// instant - but the research itself needs real time to run (several
// sequential web searches), so this route needs the same budget as the
// on-demand/cron routes rather than whatever Vercel's default is.
export const maxDuration = 60;

const planStatusValues = ["COMPLETED", "PLANNED", "RESERVED"] as const;

// Where modules in the Reserved bin are stored (the same slot exemptions use; the status tells them apart).
const RESERVED_YEAR = 0;
const RESERVED_SEMESTER = 0;

const createEntrySchema = z.object({
  moduleCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(20)
    .optional()
    .or(z.literal("")),
  label: z.string().trim().min(1).max(120),
  mc: z.coerce.number().int().min(0).max(40),
  academicYear: z.coerce.number().int().min(0).max(10),
  semester: z.coerce.number().int().min(0).max(2),
  status: z.enum(planStatusValues),
  requirementTag: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const entries = await prisma.plannerEntry.findMany({
      where: { userId },
      orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { moduleCode, label, mc, academicYear, semester, status, requirementTag } =
    parsed.data;

  try {
    // The same module can't go in the plan twice (placeholders have no code and are exempt).
    if (moduleCode) {
      const existing = await findDuplicateEntry(userId, moduleCode);
      if (existing) {
        return NextResponse.json({ error: duplicateMessage(moduleCode, existing) }, { status: 409 });
      }
    }

    const entry = await prisma.plannerEntry.create({
      data: {
        userId,
        moduleCode: moduleCode || null,
        label,
        mc,
        // The Reserved bin has no semester: it's always stored in the 0/0 slot, whatever the request says.
        academicYear: status === "RESERVED" ? RESERVED_YEAR : academicYear,
        semester: status === "RESERVED" ? RESERVED_SEMESTER : semester,
        status,
        requirementTag: requirementTag || null,
      },
    });

    // Auto-queue the community-signal report for any module added to a
    // plan - compulsory modules and anything else both qualify for the
    // automatic, shared-cache tier (see architecture doc). Best-effort:
    // a failure here should never block the user from adding the module.
    if (moduleCode) {
      // Awaited (not fire-and-forget) - a serverless function can be torn
      // down right after the response is sent, which would kill a
      // detached promise before it finishes. This is just two fast DB
      // reads/writes (no Anthropic call), so the extra wait is negligible.
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const degreeStructure = getDegreeStructureForProgramme(user?.programme);
        const queued = await enqueueAnalysis(
          moduleCode,
          isCompulsoryModuleCode(moduleCode, degreeStructure)
            ? AnalysisTrigger.AUTO_COMPULSORY
            : AnalysisTrigger.AUTO_PLANNED
        );

        // enqueueAnalysis returns null when the module's already cached
        // or another request is already in flight for it - nothing to
        // kick off in that case. Otherwise, run the research ourselves
        // right after the response goes out, rather than leaving this
        // request to wait for the next cron tick (which on Vercel's
        // Hobby plan might not come for almost 24h - see the cron
        // route's own comment on why that's a backstop now, not the
        // primary path).
        if (queued) {
          after(() => processAnalysisRequest(queued.id, moduleCode, queued.userId));
        }
      } catch (error) {
        console.error(`Failed to enqueue analysis for ${moduleCode}:`, error);
      }
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

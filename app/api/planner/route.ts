import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { enqueueAnalysis } from "@/lib/module-analysis";
import { isCompulsoryModuleCode } from "@/lib/degree-requirements/bucket";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { AnalysisTrigger } from "@prisma/client";

const planStatusValues = ["COMPLETED", "PLANNED", "RESERVED"] as const;

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
    const entry = await prisma.plannerEntry.create({
      data: {
        userId,
        moduleCode: moduleCode || null,
        label,
        mc,
        academicYear,
        semester,
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
        await enqueueAnalysis(
          moduleCode,
          isCompulsoryModuleCode(moduleCode, degreeStructure)
            ? AnalysisTrigger.AUTO_COMPULSORY
            : AnalysisTrigger.AUTO_PLANNED
        );
      } catch (error) {
        console.error(`Failed to enqueue analysis for ${moduleCode}:`, error);
      }
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

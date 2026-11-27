import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { getModuleInfo, NUSMODS_ACAD_YEAR } from "@/lib/nusmods";
import { canUseSu, firstYearWindowYears, isSuEligible } from "@/lib/su-budget";
import { duplicateMessage, findDuplicateEntry } from "@/lib/planner-duplicates";

const planStatusValues = ["COMPLETED", "PLANNED", "RESERVED"] as const;

// Every field optional: this backs both "move to another semester" (drag-
// and-drop) and "change status" (e.g. mark as S/U candidate) with one route,
// rather than one endpoint per kind of edit.
const updateEntrySchema = z.object({
  moduleCode: z.string().trim().toUpperCase().min(1).max(20).nullable().optional(),
  label: z.string().trim().min(1).max(120).optional(),
  mc: z.coerce.number().int().min(0).max(40).optional(),
  academicYear: z.coerce.number().int().min(0).max(10).optional(),
  semester: z.coerce.number().int().min(0).max(2).optional(),
  status: z.enum(planStatusValues).optional(),
  requirementTag: z.string().trim().max(60).nullable().optional(),
  isSU: z.boolean().optional(),
  // Other entries to take off S/U in the same request. The planner sends this when putting this entry on S/U
  // (or moving it) would bust the budget and the student chose which modules to drop to make room.
  offSU: z.array(z.string()).max(200).optional(),
});

async function assertOwnership(id: string, userId: string) {
  const entry = await prisma.plannerEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) return null;
  return entry;
}

type SuCandidate = {
  moduleCode: string | null;
  academicYear: number;
  semester: number;
  mc: number;
};

// Why an entry can't be (or stay) on S/U, or null when it can. The same rules the planner uses to decide
// whether to offer the S/U button; checked here too so a hand-crafted request can't get around them.
async function suProblem(
  userId: string,
  before: SuCandidate & { isSU: boolean },
  after: SuCandidate & { id: string },
  offSU: string[]
): Promise<{ error: string; status: number } | null> {
  if (!after.moduleCode) {
    return { error: "Only real modules can use the S/U option.", status: 400 };
  }
  // Exempted modules (academic year 0) are already credited with no grade, so there's nothing to S/U.
  if (after.academicYear === 0 && after.semester === 0) {
    return { error: "Exempted modules are already credited, so they don't need S/U.", status: 400 };
  }

  // Eligibility only needs re-checking when the module is new to S/U.
  const newToSu = !before.isSU || before.moduleCode !== after.moduleCode;
  if (newToSu) {
    let info;
    try {
      info = await getModuleInfo(NUSMODS_ACAD_YEAR, after.moduleCode);
    } catch {
      return { error: `Couldn't check whether ${after.moduleCode} can be S/U'd. Try again in a moment.`, status: 502 };
    }
    if (!isSuEligible(info)) {
      return { error: `${after.moduleCode} can't be S/U'd - NUS doesn't offer the S/U option on it.`, status: 400 };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suBudgetTotalMc: true, matriculationYear: true },
  });
  if (!user) return { error: "Not found.", status: 404 };

  const others = await prisma.plannerEntry.findMany({
    where: { userId, isSU: true, id: { notIn: [after.id, ...offSU] } },
    select: { academicYear: true, mc: true },
  });
  const fit = canUseSu(others, after, user.suBudgetTotalMc, firstYearWindowYears(user.matriculationYear));
  return fit.ok ? null : { error: fit.reason, status: 409 };
}

// Next.js 15 passes dynamic route params as a Promise, not a plain object —
// this has to be awaited before use, not destructured directly.
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const existing = await assertOwnership(id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { offSU = [], ...fields } = parsed.data;

    // Pointing an entry at a different module can't land on one that's already in the plan.
    if (fields.moduleCode && fields.moduleCode.toUpperCase() !== existing.moduleCode?.toUpperCase()) {
      const duplicate = await findDuplicateEntry(userId, fields.moduleCode, id);
      if (duplicate) {
        return NextResponse.json(
          { error: duplicateMessage(fields.moduleCode, duplicate) },
          { status: 409 }
        );
      }
    }

    const data: typeof fields = { ...fields };

    // Moving a module in or out of the Reserved bin is what changes its status; for everything else the status
    // follows from the semester it's in and the date (src/lib/plan-status.ts), so only the bin is ever stored.
    if (fields.status === "RESERVED") {
      // The bin has no semester.
      data.academicYear = 0;
      data.semester = 0;
    } else if (existing.status === "RESERVED" && fields.academicYear !== undefined && fields.academicYear >= 1) {
      // Dragged out of the bin into a semester.
      data.status = "PLANNED";
    }

    const next = { ...existing, ...data };

    // A reserved module isn't in any semester yet, so it can't be on S/U: refuse a request to put one on S/U,
    // and quietly take an entry off S/U when it goes into the bin.
    if (next.status === "RESERVED") {
      if (fields.isSU === true) {
        return NextResponse.json(
          { error: "Only real modules can use the S/U option." },
          { status: 400 }
        );
      }
      data.isSU = false;
    }

    // Every change that leaves the entry on S/U (turning it on, or moving / resizing / renaming one that
    // already is) has to still fit what NUS allows. Turning it off needs no check.
    if (next.isSU && data.isSU !== false) {
      const problem = await suProblem(userId, existing, next, offSU);
      if (problem) {
        return NextResponse.json({ error: problem.error }, { status: problem.status });
      }
    }

    // Dropping the other modules and applying this change are one step, so a refused change can't leave the
    // student with fewer S/U modules than they started with.
    const [, entry] = await prisma.$transaction([
      prisma.plannerEntry.updateMany({
        where: { userId, isSU: true, id: { in: offSU, not: id } },
        data: { isSU: false },
      }),
      prisma.plannerEntry.update({ where: { id }, data }),
    ]);

    return NextResponse.json({ entry });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const existing = await assertOwnership(id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.plannerEntry.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

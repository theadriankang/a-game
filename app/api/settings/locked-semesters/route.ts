import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";

// Lets a signed-in student mark which semesters are already done, so the
// planner grid knows what it can't let them touch (src/lib/plan-status.ts
// isTermLocked) - independent of the calendar-only guess in currentTerm(),
// for when that guess is wrong (gap semester, exchange, deferred intake).
export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const indices = body?.lockedSemesterIndices;
  if (
    !Array.isArray(indices) ||
    indices.length > 40 ||
    !indices.every((n) => Number.isInteger(n) && n >= 1)
  ) {
    return NextResponse.json({ error: "Invalid semester list." }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedSemesterIndices: Array.from(new Set(indices)) },
    });
    return NextResponse.json({ ok: true, lockedSemesterIndices: indices });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

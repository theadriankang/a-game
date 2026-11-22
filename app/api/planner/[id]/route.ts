import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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
});

async function assertOwnership(id: string, userId: string) {
  const entry = await prisma.plannerEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) return null;
  return entry;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const existing = await assertOwnership(params.id, userId);
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

  const entry = await prisma.plannerEntry.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const existing = await assertOwnership(params.id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.plannerEntry.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

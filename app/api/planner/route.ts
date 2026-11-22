import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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

  const entries = await prisma.plannerEntry.findMany({
    where: { userId },
    orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ entries });
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

  return NextResponse.json({ entry }, { status: 201 });
}

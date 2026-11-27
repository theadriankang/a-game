// A module can only be in a student's plan once. Nothing in the database enforces that (existing plans may
// already hold duplicates, and a unique index would fail to build on them), so the planner routes check here.

import { prisma } from "@/lib/prisma";

/**
 * The entry that already holds `moduleCode` in this user's plan (exempted modules included), if any.
 * `excludeId` skips the entry being edited, so changing an entry never conflicts with itself.
 */
export async function findDuplicateEntry(userId: string, moduleCode: string, excludeId?: string) {
  return prisma.plannerEntry.findFirst({
    where: {
      userId,
      moduleCode: { equals: moduleCode, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { academicYear: true, semester: true },
  });
}

export function duplicateMessage(
  moduleCode: string,
  existing: { academicYear: number; semester: number }
): string {
  // Year 0 / semester 0 is the slot exempted modules live in, outside the semester grid.
  const where =
    existing.academicYear === 0 && existing.semester === 0
      ? "your exempted modules"
      : `your plan (Year ${existing.academicYear} · Sem ${existing.semester})`;
  return `${moduleCode} is already in ${where}.`;
}

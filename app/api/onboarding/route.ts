import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { MATH_BACKGROUND_VALUES } from "@/lib/qualifications";
import { ALL_COLLEGES, getCollege } from "@/lib/residential-colleges/registry";
import { planCollegeReservations } from "@/lib/residential-colleges/reservations";
import type { AdmissionType } from "@/lib/residential-colleges/types";

const RC_IDS = ALL_COLLEGES.map((c) => c.id) as [string, ...string[]];
const ADMISSION_TYPES: [AdmissionType, ...AdmissionType[]] = [
  "FRESHMAN_SEM1",
  "CONTINUING_SEM1",
  "CONTINUING_SEM2",
];

const onboardingSchema = z.object({
  programme: z.string().trim().min(1).max(100),
  priorDiploma: z.string().trim().max(150).optional().or(z.literal("")),
  suBudgetTotalMc: z.coerce.number().int().min(0).max(60).multipleOf(2),
  // Start year of the intake AY (2026 for AY2026/27); selects which year's exemption lists apply.
  matriculationYear: z.coerce.number().int().min(2015).max(2040).optional(),
  // How they meet NUS's H2 Math condition (optional; see src/lib/qualifications.ts).
  mathBackground: z.enum(MATH_BACKGROUND_VALUES).optional(),
  // Module codes the user already has an approved credit transfer / exemption
  // for, e.g. ["CS2101", "IS1108"]. Free-typed, so normalize loosely.
  exemptions: z.array(z.string().trim().toUpperCase().min(1)).max(30),
  // Residential college context (src/lib/residential-colleges). Null/omitted
  // means not staying on campus in an RC — nothing is assumed either way.
  residentialCollege: z.enum(RC_IDS).nullable().optional(),
  rcAdmissionType: z.enum(ADMISSION_TYPES).optional(),
});

// A fixed placeholder slot (year 0, sem 0) for exemption/APC rows: they
// happened before matriculation, not in any real semester, but still need
// to count toward degree-requirement buckets once that logic reads them.
// A residential college's auto-reserved slots live in the same slot (as
// RESERVED rows, not COMPLETED) — see rcSlotId below.
const EXEMPTION_YEAR = 0;
const EXEMPTION_SEMESTER = 0;

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    programme,
    priorDiploma,
    suBudgetTotalMc,
    matriculationYear,
    mathBackground,
    exemptions,
    residentialCollege,
    rcAdmissionType,
  } = parsed.data;

  const college = residentialCollege ? getCollege(residentialCollege) : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          programme,
          priorDiploma: priorDiploma || null,
          suBudgetTotalMc,
          ...(matriculationYear !== undefined ? { matriculationYear } : {}),
          ...(mathBackground !== undefined ? { mathBackground } : {}),
          residentialCollege: residentialCollege ?? null,
          rcAdmissionType: residentialCollege ? rcAdmissionType ?? "FRESHMAN_SEM1" : null,
        },
      });

      // Re-running onboarding shouldn't duplicate exemption rows: clear the
      // placeholder slot and re-create from the submitted list. The Reserved
      // bin holds anything the student added by hand in the same slot, so
      // only touch COMPLETED rows here (exemptions) — rcSlotId rows are
      // handled separately below, and anything else the student reserved
      // manually (rcSlotId null, status RESERVED) is left alone either way.
      await tx.plannerEntry.deleteMany({
        where: {
          userId,
          academicYear: EXEMPTION_YEAR,
          semester: EXEMPTION_SEMESTER,
          status: { not: "RESERVED" },
        },
      });

      if (exemptions.length > 0) {
        await tx.plannerEntry.createMany({
          data: exemptions.map((moduleCode) => ({
            userId,
            moduleCode,
            label: moduleCode,
            mc: 0, // exemptions don't consume MC the user needs to plan for
            academicYear: EXEMPTION_YEAR,
            semester: EXEMPTION_SEMESTER,
            status: "COMPLETED" as const,
          })),
        });
      }

      // Replace this user's college-generated reservations (rcSlotId set)
      // with a fresh set for whatever college/admission type was just
      // submitted — picking a different college, or clearing it, shouldn't
      // leave stale slots behind. Anything the student reserved by hand
      // (rcSlotId null) is untouched.
      await tx.plannerEntry.deleteMany({
        where: { userId, rcSlotId: { not: null } },
      });

      if (college) {
        const plan = planCollegeReservations(
          college,
          rcAdmissionType ?? "FRESHMAN_SEM1",
          matriculationYear ?? null
        );
        if (plan.slots.length > 0) {
          await tx.plannerEntry.createMany({
            data: plan.slots.map((slot) => ({
              userId,
              moduleCode: null,
              label: slot.label,
              mc: slot.mc,
              academicYear: EXEMPTION_YEAR,
              semester: EXEMPTION_SEMESTER,
              status: "RESERVED" as const,
              requirementTag: slot.bucketId,
              rcSlotId: `${college.id}:${slot.id}`,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

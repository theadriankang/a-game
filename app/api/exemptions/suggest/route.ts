import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";
import { academicYearLabel } from "@/lib/exemptions/normalize";
import { credentialOptions, suggestFromRules, type RuleLike, type StoredGrant } from "@/lib/exemptions/suggest";

// Read-only: looks up the exemption rules loaded by scripts/exemptions for the
// student's intake year and returns what they're likely to be credited with.
// Everything returned is a suggestion to confirm against their own Transfer
// Credit Report, not an entitlement.

const querySchema = z.object({
  matriculationYear: z.coerce.number().int().min(2015).max(2040),
  faculty: z.string().trim().min(1).max(100),
  programme: z.string().trim().min(1).max(150),
  qualification: z.enum(["POLYTECHNIC", "H3", "OLYMPIAD"]),
  institution: z.string().trim().max(100).optional(),
  credential: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const q = parsed.data;
  const academicYear = academicYearLabel(q.matriculationYear);

  try {
    const rows = await prisma.exemptionRule.findMany({
      where: { academicYear, qualification: q.qualification },
    });
    const rules: RuleLike[] = rows.map((r) => ({
      faculty: r.faculty,
      programmes: r.programmes,
      qualification: r.qualification,
      institution: r.institution,
      credential: r.credential,
      credentialKey: r.credentialKey,
      grants: r.grants as unknown as StoredGrant[],
      sourceUrl: r.sourceUrl,
    }));

    return NextResponse.json({
      academicYear,
      ...suggestFromRules(rules, q),
      // Olympiad medal categories to pick from; empty for other qualifications.
      options: q.qualification === "OLYMPIAD" ? credentialOptions(rules, q) : [],
    });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

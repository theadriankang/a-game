import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProgrammes } from "@/lib/programmes/store";
import { computeMinorFit } from "@/lib/minors/fit";
import { getCurrentModuleTitles } from "@/lib/modules/titles";
import { currentTerm, withDerivedStatus } from "@/lib/plan-status";
import { trackSilently } from "@/lib/track";
import { ProgrammeDetail } from "./programme-detail";

type RouteParams = { params: Promise<{ id: string }> };

// One minor, second major or specialisation in full: reached from the nudge on the planner and from each card on the
// Minors page, with a button back to /minors.
export default async function ProgrammePage({ params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const programmes = await getProgrammes();
  const programme = [...programmes.minors, ...programmes.secondMajors, ...programmes.specialisations].find((p) => p.id === id);
  if (!programme) {
    notFound();
  }

  await trackSilently(userId, "minors");

  // Same inputs as the Minors page and the planner nudge, so all three agree about progress.
  const entries = withDerivedStatus(
    await prisma.plannerEntry.findMany({ where: { userId } }),
    currentTerm(user.matriculationYear)
  );
  const fit = computeMinorFit(
    entries.map((e) => ({ moduleCode: e.moduleCode, mc: e.mc, status: e.status })),
    programme,
    user.programme,
    user.matriculationYear
  );

  const statusByCode: Record<string, "COMPLETED" | "PLANNED" | "RESERVED"> = {};
  for (const e of entries) if (e.moduleCode) statusByCode[e.moduleCode.toUpperCase()] = e.status;

  const titles = await getCurrentModuleTitles([
    ...programme.groups.flatMap((g) => g.moduleCodes ?? []),
    ...fit.groups.flatMap((g) => g.matchedCodes),
  ]);

  return <ProgrammeDetail fit={fit} statusByCode={statusByCode} titles={titles} />;
}

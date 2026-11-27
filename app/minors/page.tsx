import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALL_MINORS, ALL_SECOND_MAJORS } from "@/lib/minors/registry";
import { computeMinorFit } from "@/lib/minors/fit";
import { currentTerm, withDerivedStatus } from "@/lib/plan-status";
import { MinorsPanel } from "./minors-panel";

export default async function MinorsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  // Every entry counts here, including the exemption-slot placeholders -
  // an exemption/APC still represents credit the student actually holds,
  // which can count toward a minor just like any other completed module.
  const entries = withDerivedStatus(
    await prisma.plannerEntry.findMany({ where: { userId } }),
    currentTerm(user.matriculationYear)
  );

  const simpleEntries = entries.map((e) => ({ moduleCode: e.moduleCode, mc: e.mc, status: e.status }));
  const minorFits = ALL_MINORS.map((minor) => computeMinorFit(simpleEntries, minor, user.programme));
  const secondMajorFits = ALL_SECOND_MAJORS.map((structure) =>
    computeMinorFit(simpleEntries, structure, user.programme)
  );

  return <MinorsPanel minorFits={minorFits} secondMajorFits={secondMajorFits} />;
}

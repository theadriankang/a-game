import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProgrammes } from "@/lib/programmes/store";
import { buildOverview } from "@/lib/minors/overview";
import { currentTerm, withDerivedStatus } from "@/lib/plan-status";
import { MinorsPanel } from "./minors-panel";
import { trackSilently } from "@/lib/track";

export default async function MinorsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  await trackSilently(userId, "minors");

  // Every entry counts here, including the exemption-slot placeholders -
  // an exemption/APC still represents credit the student actually holds,
  // which can count toward a minor just like any other completed module.
  const entries = withDerivedStatus(
    await prisma.plannerEntry.findMany({ where: { userId } }),
    currentTerm(user.matriculationYear)
  );

  const simpleEntries = entries.map((e) => ({ moduleCode: e.moduleCode, mc: e.mc, status: e.status }));
  const programmes = await getProgrammes();
  // Only what this student can actually do is listed (nearest first, so what the planner nudges about leads here
  // too); the rest is gathered at the bottom with the reason, so nothing looks missing.
  const overview = buildOverview(
    simpleEntries,
    [...programmes.minors, ...programmes.secondMajors, ...programmes.specialisations],
    user.programme,
    user.matriculationYear
  );

  return <MinorsPanel overview={overview} />;
}

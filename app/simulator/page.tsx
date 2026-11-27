import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDegreeStructureForProgramme } from "@/lib/degree-requirements/registry";
import { currentTerm, withDerivedStatus } from "@/lib/plan-status";
import { SimulatorPanel } from "./simulator-panel";
import { trackSilently } from "@/lib/track";

const EXEMPTION_YEAR = 0;
const EXEMPTION_SEMESTER = 0;

export default async function SimulatorPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  await trackSilently(userId, "simulator");

  // The 0/0 slot holds exemptions and the planner's Reserved bin (modules with no semester yet); neither
  // belongs in a semester grid.
  const entries = withDerivedStatus(
    await prisma.plannerEntry.findMany({
      where: {
        userId,
        NOT: { academicYear: EXEMPTION_YEAR, semester: EXEMPTION_SEMESTER },
      },
      orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
    }),
    currentTerm(user.matriculationYear)
  );

  const initialEntries = entries.map((e) => ({
    id: e.id,
    moduleCode: e.moduleCode,
    label: e.label,
    mc: e.mc,
    academicYear: e.academicYear,
    semester: e.semester,
    status: e.status,
    requirementTag: e.requirementTag,
  }));

  const degreeStructure = getDegreeStructureForProgramme(user.programme);

  return <SimulatorPanel initialEntries={initialEntries} degreeStructure={degreeStructure} />;
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bucketPlannerEntries } from "@/lib/degree-requirements/bucket";
import { bcompCs } from "@/lib/degree-requirements/bcomp-cs";
import { PlannerBoard } from "./planner-board";

// The onboarding placeholder slot for exemptions (see app/api/onboarding) —
// kept out of the semester grid and shown separately instead.
const EXEMPTION_YEAR = 0;
const EXEMPTION_SEMESTER = 0;

export default async function PlannerPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/sign-in");
  }

  if (!user.programme) {
    redirect("/onboarding");
  }

  const entries = await prisma.plannerEntry.findMany({
    where: { userId },
    orderBy: [{ academicYear: "asc" }, { semester: "asc" }, { createdAt: "asc" }],
  });

  const semesterEntries = entries.filter(
    (e) => !(e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER)
  );
  const exemptionEntries = entries.filter(
    (e) => e.academicYear === EXEMPTION_YEAR && e.semester === EXEMPTION_SEMESTER
  );

  const buckets = bucketPlannerEntries(entries, bcompCs);

  return (
    <PlannerBoard
      userName={user.name}
      suBudgetTotalMc={user.suBudgetTotalMc}
      suBudgetUsedMc={user.suBudgetUsedMc}
      semesterEntries={semesterEntries}
      exemptionEntries={exemptionEntries}
      buckets={buckets}
      degreeLabel={bcompCs.label}
      degreeTotalMc={bcompCs.totalMc}
    />
  );
}

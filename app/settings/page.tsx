import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentTerm, termIndex, termPhase } from "@/lib/plan-status";
import { SettingsPanel } from "./settings-panel";

const BASE_YEARS = 4;

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLlmProvider: true, matriculationYear: true, lockedSemesterIndices: true },
  });

  // Matches the planner grid's own "standard 4 years, plus whatever the student has already used" extension
  // (app/planner/planner-board.tsx buildColumns), so the checklist here never falls short of what's on the
  // board.
  const plannerYears = await prisma.plannerEntry.findMany({
    where: { userId },
    select: { academicYear: true },
    distinct: ["academicYear"],
  });
  const totalYears = Math.max(BASE_YEARS, ...plannerYears.map((e: { academicYear: number }) => e.academicYear));

  // First-time suggestion only - once the student has saved a selection, that's the source of truth and this
  // is never consulted again. Pre-ticks whatever the calendar guess (src/lib/plan-status.ts) already treats as
  // done or in progress, since that's usually right and saves re-ticking semesters by hand.
  const term = currentTerm(user?.matriculationYear);
  const suggestedLockedSemesterIndices: number[] = [];
  for (let year = 1; year <= totalYears; year++) {
    for (const semester of [1, 2]) {
      if (termPhase(year, semester, term) !== "future") {
        suggestedLockedSemesterIndices.push(termIndex(year, semester));
      }
    }
  }

  return (
    <SettingsPanel
      initialLlmProvider={user?.preferredLlmProvider ?? "ANTHROPIC"}
      totalYears={totalYears}
      initialLockedSemesterIndices={user?.lockedSemesterIndices ?? []}
      suggestedLockedSemesterIndices={suggestedLockedSemesterIndices}
    />
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getModuleInfo,
  flattenPrereqTree,
  formatPrereqTree,
  NUSMODS_ACAD_YEAR,
} from "@/lib/nusmods";
import { getCachedAnalysis, hasPendingRequest } from "@/lib/module-analysis";
import { ModuleDetailView } from "./module-detail-view";

type RouteParams = { params: Promise<{ code: string }> };

// A dedicated "whole module" page - everything we know about one module in
// one place (NUSMods data + the AI community-signal synthesis), reached by
// clicking into a module from the planner card. Kept server-rendered for
// the real NUSMods data (no client-side loading flash on first open); the
// "Request analysis" interaction lives in the client child component.
export default async function ModulePage({ params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { code } = await params;
  const moduleCode = code.toUpperCase();

  let info;
  try {
    info = await getModuleInfo(NUSMODS_ACAD_YEAR, moduleCode);
  } catch {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page text-text0">
        <div className="text-lg font-bold">Couldn&rsquo;t find {moduleCode}</div>
        <p className="text-[13px] text-text2">
          NUSMods doesn&rsquo;t have data for this module in {NUSMODS_ACAD_YEAR}.
        </p>
        <a href="/planner" className="text-[13px] font-semibold text-accent hover:underline">
          Back to planner
        </a>
      </div>
    );
  }

  const [analysis, pending] = await Promise.all([
    getCachedAnalysis(moduleCode),
    getCachedAnalysis(moduleCode).then((a) => (a ? false : hasPendingRequest(moduleCode))),
  ]);

  return (
    <ModuleDetailView
      moduleCode={info.moduleCode}
      title={info.title}
      mc={Number(info.moduleCredit) || 4}
      department={info.department ?? null}
      faculty={info.faculty ?? null}
      description={info.description ?? null}
      workload={Array.isArray(info.workload) ? info.workload : null}
      semesterData={(info.semesterData ?? []).map((s) => ({
        semester: s.semester,
        examDate: s.examDate ?? null,
        examDuration: s.examDuration ?? null,
      }))}
      prereqCodes={flattenPrereqTree(info.prereqTree)}
      prereqSummary={formatPrereqTree(info.prereqTree)}
      preclusion={info.preclusion ?? null}
      corequisite={info.corequisite ?? null}
      analysis={
        analysis
          ? {
              summary: analysis.summary,
              tags: analysis.tags,
              sources: analysis.sources,
              status: analysis.status,
            }
          : null
      }
      pending={pending}
    />
  );
}

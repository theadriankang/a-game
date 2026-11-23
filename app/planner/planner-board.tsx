"use client";

import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { describeBucketMatch, type BucketProgress } from "@/lib/degree-requirements/bucket";
import type { RequirementBucketDef } from "@/lib/degree-requirements/types";
import type { PrereqViolation } from "@/lib/prereq-check";

type Entry = {
  id: string;
  moduleCode: string | null;
  label: string;
  mc: number;
  academicYear: number;
  semester: number;
  status: "COMPLETED" | "PLANNED" | "RESERVED";
  requirementTag: string | null;
};

type ModuleAnalysisData = {
  summary: string;
  tags: string[];
  sources: string[];
  status: "PENDING" | "COMPLETED" | "FAILED" | "THIN_DATA";
};

type ModuleGlanceData = {
  moduleCode: string;
  title: string;
  mc: number;
  department: string | null;
  faculty: string | null;
  workload: number[] | null;
  semestersOffered: number[];
  prereqCodes: string[];
  preclusion: string | null;
  description: string | null;
};

const WORKLOAD_LABELS = ["Lecture", "Tutorial", "Lab", "Project", "Self-study"];

type Props = {
  userName: string | null;
  suBudgetTotalMc: number;
  suBudgetUsedMc: number;
  semesterEntries: Entry[];
  exemptionEntries: Entry[];
  buckets: BucketProgress<Entry>[];
  bucketDefs: RequirementBucketDef[];
  degreeLabel: string;
  degreeTotalMc: number;
  violationsByEntryId: Record<string, PrereqViolation[]>;
  analysisByCode: Record<string, ModuleAnalysisData>;
  pendingAnalysisCodes: string[];
};

const STATUS_LABEL: Record<Entry["status"], string> = {
  COMPLETED: "Done",
  PLANNED: "Planned",
  RESERVED: "Reserved",
};

const STATUS_CLASS: Record<Entry["status"], string> = {
  COMPLETED: "bg-green-bg text-green border border-green-border",
  PLANNED: "bg-amber-bg text-amber border border-amber-border",
  RESERVED: "bg-seg-bg text-text2 border border-border",
};

// The grid always shows the standard 4 years x 2 semesters, whether or
// not a column has any modules in it yet - so creating a "semester" isn't
// a step on its own, you just add modules straight into whichever column
// you want. `extraYears` (years a user has explicitly added beyond the
// standard 4, e.g. for an overrun year) and any entry that happens to
// already live beyond year 4 both extend the grid too.
const BASE_YEARS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];

function buildColumns(entries: Entry[], extraYears: number[]) {
  const years = Array.from(
    new Set([...BASE_YEARS, ...extraYears, ...entries.map((e) => e.academicYear)])
  ).sort((a, b) => a - b);

  const columns: { academicYear: number; semester: number; entries: Entry[] }[] = [];
  for (const year of years) {
    for (const sem of SEMESTERS) {
      columns.push({
        academicYear: year,
        semester: sem,
        entries: entries.filter((e) => e.academicYear === year && e.semester === sem),
      });
    }
  }
  return columns;
}

export function PlannerBoard({
  userName,
  suBudgetTotalMc,
  suBudgetUsedMc,
  semesterEntries,
  exemptionEntries,
  buckets,
  bucketDefs,
  degreeLabel,
  degreeTotalMc,
  violationsByEntryId,
  analysisByCode,
  pendingAnalysisCodes,
}: Props) {
  const router = useRouter();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [extraYears, setExtraYears] = useState<number[]>([]);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [view, setView] = useState<"semester" | "requirement">("semester");
  const [requestingCode, setRequestingCode] = useState<string | null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const gridRowRef = useRef<HTMLDivElement>(null);

  async function requestAnalysis(moduleCode: string) {
    setRequestingCode(moduleCode);
    await fetch(`/api/modules/${moduleCode}/analysis`, { method: "POST" });
    setRequestingCode(null);
    router.refresh();
  }

  const semesters = buildColumns(semesterEntries, extraYears);
  const groupOrder = ["Common Curriculum", "Programme Requirements", "Unrestricted Electives"];
  const bucketsByGroup = groupOrder.map((group) => ({
    group,
    buckets: buckets.filter((b) => b.group === group),
  }));

  async function deleteEntry(id: string) {
    await fetch(`/api/planner/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function changeStatus(id: string, status: Entry["status"]) {
    await fetch(`/api/planner/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  // Drag-and-drop between semester columns reuses the same PATCH endpoint
  // that handles status changes - moving a module is just updating which
  // year/semester it belongs to.
  async function moveEntry(id: string, academicYear: number, semester: number) {
    await fetch(`/api/planner/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear, semester }),
    });
    router.refresh();
  }

  async function addEntry(form: {
    academicYear: number;
    semester: number;
    moduleCode: string;
    label: string;
    mc: number;
    status: Entry["status"];
  }) {
    await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAddingTo(null);
    router.refresh();
  }

  const totalRequired = buckets.reduce((sum, b) => sum + b.requiredMc, 0);
  const totalCompleted = buckets.reduce((sum, b) => sum + b.completedMc, 0);

  return (
    <div className="min-h-screen bg-page text-text0">
      <header className="flex items-center justify-between border-b border-border bg-surface px-7 py-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text3">
            {degreeLabel}
          </div>
          <div className="text-lg font-bold tracking-tight">
            {userName ? `Good to see you, ${userName}` : "Your plan"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/simulator"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            What-if
          </Link>
          <Link
            href="/timetable"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Timetable
          </Link>
          <Link
            href="/minors"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Minors
          </Link>
          <Link
            href="/usage"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Usage
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex items-start gap-0">
        <aside className="min-h-[calc(100vh-73px)] w-[280px] shrink-0 border-r border-border p-5">
          <div className="mb-4">
            <div className="flex items-baseline justify-between text-[13px] font-semibold">
              <span>Overall</span>
              <span className="tabular-nums text-text2">
                {totalCompleted}/{totalRequired} MC
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${Math.min(100, (totalCompleted / Math.max(1, totalRequired)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 text-[11px] text-text3">
              {degreeTotalMc} MC total for the degree
            </div>
          </div>

          {bucketsByGroup.map(({ group, buckets: groupBuckets }) => (
            <div key={group} className="mb-4">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text3">
                {group}
              </div>
              <div className="flex flex-col gap-2.5">
                {groupBuckets.map((bucket) => {
                  const def = bucketDefs.find((b) => b.id === bucket.bucketId);
                  return (
                    <div key={bucket.bucketId}>
                      <div className="flex items-baseline justify-between text-[12.5px]">
                        <span className="text-text1">{bucket.label}</span>
                        <span className="tabular-nums text-text3">
                          {bucket.completedMc}/{bucket.requiredMc}
                        </span>
                      </div>
                      {def ? (
                        <div className="mt-0.5 text-[10.5px] leading-snug text-text3">
                          {describeBucketMatch(def)}
                        </div>
                      ) : null}
                      <div className="mt-1 h-[5px] rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-green transition-[width] duration-300"
                          style={{
                            width: `${Math.min(100, (bucket.completedMc / Math.max(1, bucket.requiredMc)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mb-4 border-t border-border pt-4">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-text1">S/U budget</span>
              <span className="tabular-nums text-text3">
                {suBudgetUsedMc}/{suBudgetTotalMc} MC
              </span>
            </div>
            <div className="mt-1 h-[5px] rounded-full bg-border">
              <div
                className="h-full rounded-full bg-amber"
                style={{
                  width: `${Math.min(100, (suBudgetUsedMc / Math.max(1, suBudgetTotalMc)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {exemptionEntries.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text3">
                Exempted (APC)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exemptionEntries.map((entry) => (
                  <span
                    key={entry.id}
                    className="rounded-full border border-green-border bg-green-bg px-2 py-0.5 text-[11px] font-semibold text-green"
                  >
                    {entry.moduleCode}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="flex flex-1 flex-col overflow-x-auto p-5">
          <div className="mb-4 inline-flex w-fit gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {(["semester", "requirement"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors duration-150 ${
                  view === v ? "bg-accent text-white" : "text-text2 hover:text-text1"
                }`}
              >
                {v === "semester" ? "By semester" : "By requirement"}
              </button>
            ))}
          </div>

          {view === "requirement" ? (
            <div className="flex max-w-3xl flex-col gap-5">
              {bucketsByGroup.map(({ group, buckets: groupBuckets }) => (
                <div key={group}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text3">
                    {group}
                  </div>
                  <div className="flex flex-col gap-3">
                    {groupBuckets.map((bucket) => (
                      <div
                        key={bucket.bucketId}
                        className="rounded-xl border border-border bg-surface p-3"
                      >
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="text-[13px] font-semibold text-text1">{bucket.label}</span>
                          <span className="tabular-nums text-[11.5px] text-text3">
                            {bucket.completedMc}/{bucket.requiredMc} MC
                          </span>
                        </div>
                        {bucket.entries.length === 0 ? (
                          <div className="text-[11.5px] text-text3">No modules assigned yet.</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {bucket.entries.map((entry) => (
                              <EntryCard
                                key={entry.id}
                                entry={entry}
                                draggable={false}
                                isDragging={false}
                                violations={violationsByEntryId[entry.id]}
                                analysis={entry.moduleCode ? analysisByCode[entry.moduleCode] : undefined}
                                pending={
                                  entry.moduleCode
                                    ? pendingAnalysisCodes.includes(entry.moduleCode)
                                    : false
                                }
                                expanded={expandedCode === entry.moduleCode}
                                onToggleExpand={() =>
                                  setExpandedCode((c) => (c === entry.moduleCode ? null : entry.moduleCode))
                                }
                                requesting={requestingCode === entry.moduleCode}
                                onRequestAnalysis={() =>
                                  entry.moduleCode && requestAnalysis(entry.moduleCode)
                                }
                                onDelete={() => deleteEntry(entry.id)}
                                onStatusChange={(status) => changeStatus(entry.id, status)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="relative">
          <PrereqConnectorOverlay
            containerRef={gridRowRef}
            hoveredEntryId={hoveredEntryId}
            entries={semesterEntries}
          />
          <div className="flex gap-4" ref={gridRowRef}>
          {semesters.map((col) => {
            const colKey = `${col.academicYear}-${col.semester}`;
            return (
            <div
              key={colKey}
              onDragOver={(e) => {
                if (!draggingEntryId) return;
                e.preventDefault();
                setDragOverKey(colKey);
              }}
              onDragLeave={() =>
                setDragOverKey((k) => (k === colKey ? null : k))
              }
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOverKey(null);
                setDraggingEntryId(null);
                if (id) moveEntry(id, col.academicYear, col.semester);
              }}
              className={`w-[220px] shrink-0 rounded-xl border p-3 transition-colors ${
                dragOverKey === colKey
                  ? "border-accent bg-accent/5"
                  : "border-border bg-surface"
              }`}
            >
              {(() => {
                const totalMc = col.entries.reduce((sum, e) => sum + e.mc, 0);
                const isLight = col.entries.length > 0 && totalMc < 18;
                const isHeavy = totalMc > 23;
                return (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-semibold text-text1">
                      Year {col.academicYear} · Sem {col.semester}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        isLight
                          ? "text-amber-600"
                          : isHeavy
                            ? "text-red-500"
                            : "text-text3"
                      }`}
                      title={
                        isLight
                          ? "Under the usual 18 MC full-time minimum"
                          : isHeavy
                            ? "Over 23 MC — usually needs faculty approval"
                            : undefined
                      }
                    >
                      {totalMc} MC
                    </div>
                  </div>
                );
              })()}
              <div className="flex flex-col gap-2">
                {col.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    draggable
                    isDragging={draggingEntryId === entry.id}
                    onDragStart={(e) => {
                      setDraggingEntryId(entry.id);
                      e.dataTransfer.setData("text/plain", entry.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingEntryId(null);
                      setDragOverKey(null);
                    }}
                    violations={violationsByEntryId[entry.id]}
                    analysis={entry.moduleCode ? analysisByCode[entry.moduleCode] : undefined}
                    pending={entry.moduleCode ? pendingAnalysisCodes.includes(entry.moduleCode) : false}
                    expanded={expandedCode === entry.moduleCode}
                    onToggleExpand={() =>
                      setExpandedCode((c) => (c === entry.moduleCode ? null : entry.moduleCode))
                    }
                    requesting={requestingCode === entry.moduleCode}
                    onRequestAnalysis={() => entry.moduleCode && requestAnalysis(entry.moduleCode)}
                    onDelete={() => deleteEntry(entry.id)}
                    onStatusChange={(status) => changeStatus(entry.id, status)}
                    onHoverStart={() => setHoveredEntryId(entry.id)}
                    onHoverEnd={() => setHoveredEntryId((id) => (id === entry.id ? null : id))}
                  />
                ))}
              </div>

              {addingTo === colKey ? (
                <AddEntryForm
                  academicYear={col.academicYear}
                  semester={col.semester}
                  onSubmit={addEntry}
                  onCancel={() => setAddingTo(null)}
                />
              ) : (
                <button
                  onClick={() => setAddingTo(colKey)}
                  className="mt-2 w-full rounded-lg border border-dashed border-border py-1.5 text-[12px] font-medium text-text2 transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  + Add module
                </button>
              )}
            </div>
            );
          })}

          <button
            onClick={() => {
              const maxYear = Math.max(
                4,
                ...extraYears,
                ...semesterEntries.map((e) => e.academicYear)
              );
              setExtraYears((prev) => [...prev, maxYear + 1]);
            }}
            className="h-full min-h-[120px] w-[220px] shrink-0 rounded-xl border border-dashed border-border text-[12.5px] font-medium text-text2 transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            + Add another year
          </button>
          </div>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Draws faint curved "cable" connectors from a hovered module card back to
// whichever of its NUSMods prerequisites already have a card in this plan -
// hidden by default, revealed only while hovering, so it never competes
// with the grid itself. Scoped to direct prerequisites of the hovered
// module (not the reverse "what this unlocks" direction, which would need
// fetching every other card's prereqs up front) - a worthwhile v1 limit
// rather than a cost paid on every page load.
function PrereqConnectorOverlay({
  containerRef,
  hoveredEntryId,
  entries,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  hoveredEntryId: string | null;
  entries: Entry[];
}) {
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const prereqCache = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hoveredEntryId) {
      setPaths([]);
      return;
    }
    const hovered = entries.find((e) => e.id === hoveredEntryId);
    if (!hovered?.moduleCode) {
      setPaths([]);
      return;
    }

    let cancelled = false;

    async function resolvePrereqCodes(moduleCode: string): Promise<string[]> {
      const cached = prereqCache.current.get(moduleCode);
      if (cached) return cached;
      try {
        const res = await fetch(`/api/modules/${moduleCode}/info`);
        if (!res.ok) return [];
        const data: { prereqCodes?: string[] } = await res.json();
        const codes = (data.prereqCodes ?? []).map((c) => c.toUpperCase());
        prereqCache.current.set(moduleCode, codes);
        return codes;
      } catch {
        return [];
      }
    }

    function draw(prereqCodes: string[]) {
      if (cancelled || !container) return;
      const containerRect = container.getBoundingClientRect();
      setSize({ width: container.scrollWidth, height: container.scrollHeight });

      const targetEl = document.getElementById(`entry-card-${hoveredEntryId}`);
      if (!targetEl) {
        setPaths([]);
        return;
      }
      const targetRect = targetEl.getBoundingClientRect();
      const targetPoint = {
        x: targetRect.left - containerRect.left,
        y: targetRect.top + targetRect.height / 2 - containerRect.top,
      };

      const prereqSet = new Set(prereqCodes);
      const next: { id: string; d: string }[] = [];
      for (const entry of entries) {
        if (entry.id === hoveredEntryId) continue;
        if (!entry.moduleCode || !prereqSet.has(entry.moduleCode.toUpperCase())) continue;
        const sourceEl = document.getElementById(`entry-card-${entry.id}`);
        if (!sourceEl) continue;
        const sourceRect = sourceEl.getBoundingClientRect();
        const sourcePoint = {
          x: sourceRect.right - containerRect.left,
          y: sourceRect.top + sourceRect.height / 2 - containerRect.top,
        };
        const midX = (sourcePoint.x + targetPoint.x) / 2;
        next.push({
          id: entry.id,
          d: `M ${sourcePoint.x} ${sourcePoint.y} C ${midX} ${sourcePoint.y}, ${midX} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`,
        });
      }
      setPaths(next);
    }

    resolvePrereqCodes(hovered.moduleCode).then(draw);
    const onResize = () => resolvePrereqCodes(hovered.moduleCode!).then(draw);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [hoveredEntryId, entries, containerRef]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-10"
      width={size.width}
      height={size.height}
      style={{ width: size.width, height: size.height }}
    >
      {paths.map((p) => (
        <g key={p.id}>
          <path d={p.d} fill="none" stroke="var(--accent)" strokeWidth={4} strokeOpacity={0.15} strokeLinecap="round" />
          <path d={p.d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.9} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}


// Shared card used by both the "by semester" and "by requirement" views -
// same module info, status control and community-signal panel either way;
// only the semester view makes it draggable.
function EntryCard({
  entry,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  violations,
  analysis,
  pending,
  expanded,
  onToggleExpand,
  requesting,
  onRequestAnalysis,
  onDelete,
  onStatusChange,
  onHoverStart,
  onHoverEnd,
}: {
  entry: Entry;
  draggable: boolean;
  isDragging: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  violations: PrereqViolation[] | undefined;
  analysis: ModuleAnalysisData | undefined;
  pending: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  requesting: boolean;
  onRequestAnalysis: () => void;
  onDelete: () => void;
  onStatusChange: (status: Entry["status"]) => void;
  // Only wired up from the "by semester" grid - used to drive the
  // hover-to-reveal prerequisite connector overlay, not needed where the
  // card isn't laid out spatially (the "by requirement" view).
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const showTitle = Boolean(entry.label && entry.label !== entry.moduleCode);
  const [glanceOpen, setGlanceOpen] = useState(false);
  const [glanceLoading, setGlanceLoading] = useState(false);
  const [glanceData, setGlanceData] = useState<ModuleGlanceData | null>(null);

  async function toggleGlance() {
    if (glanceOpen) {
      setGlanceOpen(false);
      return;
    }
    setGlanceOpen(true);
    if (!glanceData && entry.moduleCode) {
      setGlanceLoading(true);
      try {
        const res = await fetch(`/api/modules/${entry.moduleCode}/info`);
        if (res.ok) setGlanceData(await res.json());
      } finally {
        setGlanceLoading(false);
      }
    }
  }

  return (
    <div
      id={`entry-card-${entry.id}`}
      data-module-code={entry.moduleCode ?? undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`animate-fade-slide-in rounded-lg border border-border bg-page p-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{entry.moduleCode ?? entry.label}</div>
          {showTitle ? <div className="truncate text-[11px] text-text3">{entry.label}</div> : null}
          <div className="text-[11px] text-text3">{entry.mc} MC</div>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Remove ${entry.label}`}
          className="shrink-0 text-[11px] text-text3 transition-colors duration-150 hover:text-red"
        >
          ✕
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <select
          value={entry.status}
          onChange={(e) => onStatusChange(e.target.value as Entry["status"])}
          className={`rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold outline-none transition-colors ${STATUS_CLASS[entry.status]}`}
        >
          <option value="PLANNED">{STATUS_LABEL.PLANNED}</option>
          <option value="COMPLETED">{STATUS_LABEL.COMPLETED}</option>
          <option value="RESERVED">{STATUS_LABEL.RESERVED}</option>
        </select>
        {violations?.length ? (
          <span
            title={violations.map((v) => v.message).join(" ")}
            className="inline-flex cursor-help items-center rounded-full border border-red-border bg-red-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-red"
          >
            ⚠ Check
          </span>
        ) : null}
      </div>

      {entry.moduleCode ? (
        <div className="mt-1.5">
          <button
            onClick={toggleGlance}
            className="text-[10.5px] font-medium text-text3 hover:text-text2 hover:underline"
          >
            {glanceOpen ? "Hide at a glance" : "At a glance"}
          </button>
          {glanceOpen ? (
            <div className="mt-1 rounded-md border border-border bg-seg-bg p-1.5 text-[11px] text-text2">
              {glanceLoading ? (
                <p>Loading…</p>
              ) : glanceData ? (
                <div className="flex flex-col gap-1">
                  {glanceData.department ? (
                    <p>
                      {glanceData.department}
                      {glanceData.faculty ? ` · ${glanceData.faculty}` : ""}
                    </p>
                  ) : null}
                  {glanceData.workload ? (
                    <p>
                      {glanceData.workload
                        .map((hrs, i) => `${WORKLOAD_LABELS[i] ?? "Other"} ${hrs}h`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {glanceData.semestersOffered.length > 0 ? (
                    <p>Offered: Sem {glanceData.semestersOffered.join(", ")}</p>
                  ) : (
                    <p className="italic text-text3">Not offered this academic year.</p>
                  )}
                  {glanceData.prereqCodes.length > 0 ? (
                    <p>Prereqs: {glanceData.prereqCodes.join(", ")}</p>
                  ) : null}
                  {glanceData.preclusion ? <p>Preclusion: {glanceData.preclusion}</p> : null}
                </div>
              ) : (
                <p className="italic text-text3">Couldn&rsquo;t load NUSMods data for this module.</p>
              )}
            </div>
          ) : null}

          <button
            onClick={onToggleExpand}
            className="mt-1 text-[10.5px] font-medium text-text3 hover:text-text2 hover:underline"
          >
            {expanded ? "Hide community signal" : "Community signal"}
          </button>
          {expanded ? (
            <div className="mt-1 rounded-md border border-border bg-seg-bg p-1.5 text-[11px] text-text2">
              {analysis ? (
                <>
                  <p>{analysis.summary}</p>
                  {analysis.status === "THIN_DATA" ? (
                    <p className="mt-1 italic text-text3">
                      Not much public discussion found for this one.
                    </p>
                  ) : null}
                  {analysis.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {analysis.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-page px-1.5 py-0.5 text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-[10px] text-text3">
                    AI-synthesized from public discussion, not an official rating.
                  </p>
                </>
              ) : pending ? (
                <p>Analysis queued - check back soon.</p>
              ) : (
                <button
                  onClick={onRequestAnalysis}
                  disabled={requesting}
                  className="font-medium text-accent disabled:opacity-50"
                >
                  {requesting ? "Queuing…" : "Request analysis"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type ModuleSearchResult = { moduleCode: string; title: string };

function ModuleCodeField({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (mod: ModuleSearchResult) => void;
}) {
  const [results, setResults] = useState<ModuleSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/modules/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (!cancelled) {
          const found: ModuleSearchResult[] = data.results ?? [];
          setResults(found);
          setOpen(found.length > 0);
          setHighlighted(0);
          // Warm the per-module MC lookup for every result shown, while the
          // person is still reading the dropdown - by the time they click
          // one, it typically resolves from cache instead of making them
          // wait through a fresh NUSMods round trip after selecting.
          for (const r of found) {
            fetch(`/api/modules/${r.moduleCode}`).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value]);

  function selectResult(result: ModuleSearchResult) {
    onChange(result.moduleCode);
    onSelect(result);
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[highlighted]) {
            e.preventDefault();
            selectResult(results[highlighted]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Module code or title"
        className="w-full rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none transition-colors focus-visible:border-accent"
      />
      {open ? (
        <div className="absolute z-10 mt-1 w-full animate-fade-slide-in overflow-hidden rounded-lg border border-border bg-surface shadow-md">
          {results.map((r, i) => (
            <button
              key={r.moduleCode}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectResult(r)}
              className={`block w-full px-2 py-1.5 text-left text-[12px] transition-colors duration-100 ${
                i === highlighted ? "bg-seg-bg" : "hover:bg-seg-bg"
              }`}
            >
              <span className="font-semibold text-text1">{r.moduleCode}</span>
              <span className="ml-1.5 text-text3">{r.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddEntryForm({
  academicYear,
  semester,
  onSubmit,
  onCancel,
}: {
  academicYear: number;
  semester: number;
  onSubmit: (form: {
    academicYear: number;
    semester: number;
    moduleCode: string;
    label: string;
    mc: number;
    status: Entry["status"];
  }) => void;
  onCancel: () => void;
}) {
  const [moduleCode, setModuleCode] = useState("");
  const [title, setTitle] = useState("");
  const [mc, setMc] = useState(4);
  const [status, setStatus] = useState<Entry["status"]>("PLANNED");
  const [resolving, setResolving] = useState(false);

  async function handleSelect(mod: ModuleSearchResult) {
    setTitle(mod.title);
    setResolving(true);
    try {
      const res = await fetch(`/api/modules/${mod.moduleCode}`);
      if (res.ok) {
        const data = await res.json();
        setMc(data.mc);
      }
    } finally {
      setResolving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!moduleCode.trim()) return;
        onSubmit({
          academicYear,
          semester,
          moduleCode: moduleCode.trim().toUpperCase(),
          label: (title || moduleCode).trim(),
          mc,
          status,
        });
      }}
      className="mt-2 flex animate-fade-slide-in flex-col gap-1.5 rounded-lg border border-border bg-page p-2"
    >
      <ModuleCodeField
        value={moduleCode}
        onChange={(v) => {
          setModuleCode(v);
          setTitle("");
        }}
        onSelect={handleSelect}
      />
      {title ? (
        <div className="px-0.5 text-[11px] leading-snug text-text3">
          {title}
          {resolving ? " · loading…" : ""}
        </div>
      ) : null}
      <div className="flex gap-1.5">
        <input
          type="number"
          min={0}
          max={40}
          value={mc}
          onChange={(e) => setMc(Number(e.target.value))}
          className="w-16 rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none transition-colors focus-visible:border-accent"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Entry["status"])}
          className="flex-1 rounded border border-border bg-surface px-1 py-1 text-[12.5px] outline-none"
        >
          <option value="PLANNED">Planned</option>
          <option value="COMPLETED">Done</option>
          <option value="RESERVED">Reserved</option>
        </select>
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          className="flex-1 rounded bg-accent py-1 text-[12px] font-semibold text-white transition-transform duration-100 active:scale-[0.98]"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-1 text-[12px] text-text2 transition-colors duration-150 hover:bg-seg-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

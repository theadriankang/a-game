"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { BucketProgress } from "@/lib/degree-requirements/bucket";
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

type Props = {
  userName: string | null;
  suBudgetTotalMc: number;
  suBudgetUsedMc: number;
  semesterEntries: Entry[];
  exemptionEntries: Entry[];
  buckets: BucketProgress[];
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

function groupBySemester(entries: Entry[]) {
  const map = new Map<string, { academicYear: number; semester: number; entries: Entry[] }>();
  for (const entry of entries) {
    const key = `${entry.academicYear}-${entry.semester}`;
    if (!map.has(key)) {
      map.set(key, {
        academicYear: entry.academicYear,
        semester: entry.semester,
        entries: [],
      });
    }
    map.get(key)!.entries.push(entry);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.academicYear - b.academicYear || a.semester - b.semester
  );
}

export function PlannerBoard({
  userName,
  suBudgetTotalMc,
  suBudgetUsedMc,
  semesterEntries,
  exemptionEntries,
  buckets,
  degreeLabel,
  degreeTotalMc,
  violationsByEntryId,
  analysisByCode,
  pendingAnalysisCodes,
}: Props) {
  const router = useRouter();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newSemesterOpen, setNewSemesterOpen] = useState(false);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState<string | null>(null);

  async function requestAnalysis(moduleCode: string) {
    setRequestingCode(moduleCode);
    await fetch(`/api/modules/${moduleCode}/analysis`, { method: "POST" });
    setRequestingCode(null);
    router.refresh();
  }

  const semesters = groupBySemester(semesterEntries);
  const groupOrder = ["Common Curriculum", "Programme Requirements", "Unrestricted Electives"];
  const bucketsByGroup = groupOrder.map((group) => ({
    group,
    buckets: buckets.filter((b) => b.group === group),
  }));

  async function deleteEntry(id: string) {
    await fetch(`/api/planner/${id}`, { method: "DELETE" });
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
    setNewSemesterOpen(false);
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
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1"
        >
          Sign out
        </button>
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
                {groupBuckets.map((bucket) => (
                  <div key={bucket.bucketId}>
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="text-text1">{bucket.label}</span>
                      <span className="tabular-nums text-text3">
                        {bucket.completedMc}/{bucket.requiredMc}
                      </span>
                    </div>
                    <div className="mt-1 h-[5px] rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-green"
                        style={{
                          width: `${Math.min(100, (bucket.completedMc / Math.max(1, bucket.requiredMc)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
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

        <main className="flex flex-1 gap-4 overflow-x-auto p-5">
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
              <div className="mb-2 text-[12.5px] font-semibold text-text1">
                Year {col.academicYear} · Sem {col.semester}
              </div>
              <div className="flex flex-col gap-2">
                {col.entries.map((entry) => (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingEntryId(entry.id);
                      e.dataTransfer.setData("text/plain", entry.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingEntryId(null);
                      setDragOverKey(null);
                    }}
                    className={`cursor-grab rounded-lg border border-border bg-page p-2 active:cursor-grabbing ${
                      draggingEntryId === entry.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-semibold">
                          {entry.moduleCode ?? entry.label}
                        </div>
                        <div className="text-[11px] text-text3">
                          {entry.mc} MC
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        aria-label={`Remove ${entry.label}`}
                        className="text-[11px] text-text3 hover:text-red"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[entry.status]}`}
                      >
                        {STATUS_LABEL[entry.status]}
                      </span>
                      {violationsByEntryId[entry.id]?.length ? (
                        <span
                          title={violationsByEntryId[entry.id].map((v) => v.message).join(" ")}
                          className="inline-flex cursor-help items-center rounded-full border border-red-border bg-red-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-red"
                        >
                          ⚠ Check
                        </span>
                      ) : null}
                    </div>

                    {entry.moduleCode ? (
                      <div className="mt-1.5">
                        <button
                          onClick={() =>
                            setExpandedCode((c) => (c === entry.moduleCode ? null : entry.moduleCode))
                          }
                          className="text-[10.5px] font-medium text-text3 hover:text-text2 hover:underline"
                        >
                          {expandedCode === entry.moduleCode ? "Hide community signal" : "Community signal"}
                        </button>
                        {expandedCode === entry.moduleCode ? (
                          <div className="mt-1 rounded-md border border-border bg-seg-bg p-1.5 text-[11px] text-text2">
                            {analysisByCode[entry.moduleCode] ? (
                              <>
                                <p>{analysisByCode[entry.moduleCode].summary}</p>
                                {analysisByCode[entry.moduleCode].status === "THIN_DATA" ? (
                                  <p className="mt-1 italic text-text3">
                                    Not much public discussion found for this one.
                                  </p>
                                ) : null}
                                {analysisByCode[entry.moduleCode].tags.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {analysisByCode[entry.moduleCode].tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="rounded-full bg-page px-1.5 py-0.5 text-[10px]"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <p className="mt-1 text-[10px] text-text3">
                                  AI-synthesized from public discussion, not an official rating.
                                </p>
                              </>
                            ) : pendingAnalysisCodes.includes(entry.moduleCode) ? (
                              <p>Analysis queued - check back soon.</p>
                            ) : (
                              <button
                                onClick={() => requestAnalysis(entry.moduleCode!)}
                                disabled={requestingCode === entry.moduleCode}
                                className="font-medium text-accent disabled:opacity-50"
                              >
                                {requestingCode === entry.moduleCode ? "Queuing…" : "Request analysis"}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
                  className="mt-2 w-full rounded-lg border border-dashed border-border py-1.5 text-[12px] font-medium text-text2"
                >
                  + Add module
                </button>
              )}
            </div>
            );
          })}

          <div className="w-[220px] shrink-0">
            {newSemesterOpen ? (
              <NewSemesterForm onSubmit={addEntry} onCancel={() => setNewSemesterOpen(false)} />
            ) : (
              <button
                onClick={() => setNewSemesterOpen(true)}
                className="h-full min-h-[120px] w-full rounded-xl border border-dashed border-border text-[12.5px] font-medium text-text2"
              >
                + Add semester
              </button>
            )}
          </div>
        </main>
      </div>
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
  const [mc, setMc] = useState(4);
  const [status, setStatus] = useState<Entry["status"]>("PLANNED");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!moduleCode.trim()) return;
        onSubmit({
          academicYear,
          semester,
          moduleCode: moduleCode.trim().toUpperCase(),
          label: moduleCode.trim().toUpperCase(),
          mc,
          status,
        });
      }}
      className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-page p-2"
    >
      <input
        autoFocus
        value={moduleCode}
        onChange={(e) => setModuleCode(e.target.value)}
        placeholder="Module code"
        className="rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus-visible:border-accent"
      />
      <div className="flex gap-1.5">
        <input
          type="number"
          min={0}
          max={40}
          value={mc}
          onChange={(e) => setMc(Number(e.target.value))}
          className="w-16 rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus-visible:border-accent"
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
          className="flex-1 rounded bg-accent py-1 text-[12px] font-semibold text-white"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-1 text-[12px] text-text2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewSemesterForm({
  onSubmit,
  onCancel,
}: {
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
  const [academicYear, setAcademicYear] = useState(1);
  const [semester, setSemester] = useState(1);
  const [moduleCode, setModuleCode] = useState("");
  const [mc, setMc] = useState(4);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!moduleCode.trim()) return;
        onSubmit({
          academicYear,
          semester,
          moduleCode: moduleCode.trim().toUpperCase(),
          label: moduleCode.trim().toUpperCase(),
          mc,
          status: "PLANNED",
        });
      }}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3"
    >
      <div className="text-[12.5px] font-semibold text-text1">New semester</div>
      <div className="flex gap-1.5">
        <label className="flex-1 text-[11px] text-text3">
          Year
          <input
            type="number"
            min={1}
            max={6}
            value={academicYear}
            onChange={(e) => setAcademicYear(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-border bg-page px-2 py-1 text-[12.5px] outline-none"
          />
        </label>
        <label className="flex-1 text-[11px] text-text3">
          Sem
          <input
            type="number"
            min={1}
            max={2}
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-border bg-page px-2 py-1 text-[12.5px] outline-none"
          />
        </label>
      </div>
      <input
        value={moduleCode}
        onChange={(e) => setModuleCode(e.target.value)}
        placeholder="First module code"
        className="rounded border border-border bg-page px-2 py-1 text-[12.5px] outline-none"
      />
      <input
        type="number"
        min={0}
        max={40}
        value={mc}
        onChange={(e) => setMc(Number(e.target.value))}
        className="w-16 rounded border border-border bg-page px-2 py-1 text-[12.5px] outline-none"
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          className="flex-1 rounded bg-accent py-1 text-[12px] font-semibold text-white"
        >
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-1 text-[12px] text-text2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

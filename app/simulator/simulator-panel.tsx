"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { bucketPlannerEntries } from "@/lib/degree-requirements/bucket";
import type { DegreeStructure } from "@/lib/degree-requirements/types";

type Status = "COMPLETED" | "PLANNED" | "RESERVED";

type SimEntry = {
  id: string;
  moduleCode: string | null;
  label: string;
  mc: number;
  academicYear: number;
  semester: number;
  status: Status;
  requirementTag: string | null;
};

const BASE_YEARS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];
// Rough planning assumption only, used purely to project a graduation
// semester in this sandbox - not a real academic-load rule.
const ASSUMED_MC_PER_SEMESTER = 20;

function buildColumns(entries: SimEntry[], extraYears: number[]) {
  const years = Array.from(
    new Set([...BASE_YEARS, ...extraYears, ...entries.map((e) => e.academicYear)])
  ).sort((a, b) => a - b);
  const columns: { academicYear: number; semester: number; entries: SimEntry[] }[] = [];
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

let nextLocalId = 1;
function makeLocalId(): string {
  nextLocalId += 1;
  return `sandbox-${nextLocalId}`;
}

type ModuleSearchResult = { moduleCode: string; title: string };

function ModuleCodeField({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (result: ModuleSearchResult) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ModuleSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  let debounceTimer: ReturnType<typeof setTimeout>;

  async function search(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/modules/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    setResults(await res.json());
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => search(e.target.value), 200);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Module code or title"
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-text1 outline-none focus:border-accent"
      />
      {open && results.length > 0 ? (
        <div className="absolute z-10 mt-1 w-full animate-fade-slide-in rounded-lg border border-border bg-surface shadow-sm">
          {results.map((r) => (
            <button
              key={r.moduleCode}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(r.moduleCode);
                setOpen(false);
                onSelect(r);
              }}
              className="block w-full px-2.5 py-1.5 text-left text-[12px] text-text1 hover:bg-seg-bg"
            >
              <span className="font-semibold">{r.moduleCode}</span>{" "}
              <span className="text-text3">{r.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SimulatorPanel({
  initialEntries,
  degreeStructure,
}: {
  initialEntries: SimEntry[];
  degreeStructure: DegreeStructure;
}) {
  const [entries, setEntries] = useState<SimEntry[]>(initialEntries);
  const [extraYears, setExtraYears] = useState<number[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const columns = buildColumns(entries, extraYears);
  const buckets = useMemo(
    () => bucketPlannerEntries(entries, degreeStructure),
    [entries, degreeStructure]
  );

  const accountedMc = entries.reduce((sum, e) => sum + e.mc, 0);
  const remainingMc = Math.max(degreeStructure.totalMc - accountedMc, 0);
  const extraSemestersNeeded = Math.ceil(remainingMc / ASSUMED_MC_PER_SEMESTER);
  const furthest = columns.reduce(
    (max, col) =>
      col.entries.length > 0 &&
      (col.academicYear > max.academicYear ||
        (col.academicYear === max.academicYear && col.semester > max.semester))
        ? { academicYear: col.academicYear, semester: col.semester }
        : max,
    { academicYear: 1, semester: 0 }
  );
  let projYear = furthest.academicYear;
  let projSem = furthest.semester;
  for (let i = 0; i < extraSemestersNeeded; i++) {
    if (projSem === 2) {
      projSem = 1;
      projYear += 1;
    } else {
      projSem = 2;
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function changeStatus(id: string, status: Status) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  function moveEntry(id: string, academicYear: number, semester: number) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, academicYear, semester } : e))
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-text1">What-if sandbox</h1>
          <p className="mt-0.5 text-[13px] text-text3">
            Starts from your current plan. Nothing here is saved - rearrange
            freely, reset anytime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEntries(initialEntries);
              setExtraYears([]);
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Reset to current plan
          </button>
          <Link
            href="/planner"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Back to planner
          </Link>
        </div>
      </header>

      <div className="flex items-start gap-0">
        <aside className="min-h-[calc(100vh-73px)] w-[300px] shrink-0 border-r border-border p-5">
          <div className="mb-4 rounded-xl border border-border bg-surface p-3">
            <div className="text-[12px] text-text3">Projected graduation</div>
            <div className="mt-1 text-[16px] font-semibold text-text1">
              Year {projYear} · Sem {projSem}
            </div>
            <div className="mt-1 text-[11.5px] text-text3">
              {accountedMc} / {degreeStructure.totalMc} MC accounted for - rough
              estimate at ~{ASSUMED_MC_PER_SEMESTER} MC/semester, not a real
              academic-load rule.
            </div>
          </div>

          <div className="text-[13px] font-semibold text-text1">
            {degreeStructure.label} progress
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {buckets.map((b) => {
              const done = b.completedMc + b.plannedMc + b.reservedMc;
              const pct = b.requiredMc > 0 ? Math.min(100, (done / b.requiredMc) * 100) : 0;
              return (
                <div key={b.bucketId}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-text2">{b.label}</span>
                    <span className="text-text3">
                      {done}/{b.requiredMc} MC
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-seg-bg">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-x-auto p-5">
          <div className="flex gap-4">
            {columns.map((col) => {
              const colKey = `${col.academicYear}-${col.semester}`;
              const totalMc = col.entries.reduce((sum, e) => sum + e.mc, 0);
              return (
                <div
                  key={colKey}
                  onDragOver={(e: DragEvent) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    setDragOverKey(colKey);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === colKey ? null : k))}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setDragOverKey(null);
                    setDraggingId(null);
                    if (id) moveEntry(id, col.academicYear, col.semester);
                  }}
                  className={`w-[220px] shrink-0 rounded-xl border p-3 transition-colors ${
                    dragOverKey === colKey ? "border-accent bg-accent/5" : "border-border bg-surface"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-semibold text-text1">
                      Year {col.academicYear} · Sem {col.semester}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        col.entries.length > 0 && totalMc < 18
                          ? "text-amber-600"
                          : totalMc > 23
                            ? "text-red-500"
                            : "text-text3"
                      }`}
                    >
                      {totalMc} MC
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {col.entries.map((entry) => (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={(e: DragEvent) => {
                          e.dataTransfer.setData("text/plain", entry.id);
                          setDraggingId(entry.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={`animate-fade-slide-in cursor-grab rounded-lg border border-border bg-bg p-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
                          draggingId === entry.id ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] font-semibold text-text1">
                              {entry.moduleCode ?? entry.label}
                            </div>
                            {entry.label && entry.label !== entry.moduleCode ? (
                              <div className="truncate text-[11px] text-text3">{entry.label}</div>
                            ) : null}
                          </div>
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className="shrink-0 text-[11px] text-text3 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="text-[11px] text-text3">{entry.mc} MC</span>
                          <select
                            value={entry.status}
                            onChange={(e) =>
                              changeStatus(entry.id, e.target.value as Status)
                            }
                            className="rounded-full border-0 bg-seg-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-text2 outline-none"
                          >
                            <option value="PLANNED">Planned</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="RESERVED">Reserved</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {addingTo === colKey ? (
                    <SandboxAddForm
                      academicYear={col.academicYear}
                      semester={col.semester}
                      onCancel={() => setAddingTo(null)}
                      onAdd={(e) => {
                        setEntries((prev) => [...prev, e]);
                        setAddingTo(null);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingTo(colKey)}
                      className="mt-2 w-full rounded-lg border border-dashed border-border py-1.5 text-[12px] text-text3 transition-colors duration-150 hover:bg-seg-bg"
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
                  ...entries.map((e) => e.academicYear)
                );
                setExtraYears((prev) => [...prev, maxYear + 1]);
              }}
              className="h-fit shrink-0 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-text3 transition-colors duration-150 hover:bg-seg-bg"
            >
              + Add another year
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function SandboxAddForm({
  academicYear,
  semester,
  onAdd,
  onCancel,
}: {
  academicYear: number;
  semester: number;
  onAdd: (entry: SimEntry) => void;
  onCancel: () => void;
}) {
  const [moduleCode, setModuleCode] = useState("");
  const [label, setLabel] = useState("");
  const [mc, setMc] = useState(4);
  const [status, setStatus] = useState<Status>("PLANNED");

  return (
    <div className="mt-2 animate-fade-slide-in rounded-lg border border-border bg-bg p-2">
      <ModuleCodeField
        value={moduleCode}
        onSelect={async (r) => {
          setModuleCode(r.moduleCode);
          setLabel(r.title);
          try {
            const res = await fetch(`/api/modules/${r.moduleCode}`);
            if (res.ok) {
              const info = await res.json();
              setMc(info.mc ?? 4);
            }
          } catch {
            // Keep the default MC guess if the lookup fails - this is a
            // sandbox, not worth blocking on.
          }
        }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          value={mc}
          onChange={(e) => setMc(Number(e.target.value))}
          className="w-14 rounded-lg border border-border bg-surface px-1.5 py-1 text-[12px] text-text1 outline-none focus:border-accent"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="flex-1 rounded-lg border border-border bg-surface px-1.5 py-1 text-[12px] text-text1 outline-none focus:border-accent"
        >
          <option value="PLANNED">Planned</option>
          <option value="COMPLETED">Completed</option>
          <option value="RESERVED">Reserved</option>
        </select>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          disabled={!moduleCode.trim()}
          onClick={() =>
            onAdd({
              id: makeLocalId(),
              moduleCode: moduleCode.trim().toUpperCase(),
              label: label || moduleCode.trim().toUpperCase(),
              mc,
              academicYear,
              semester,
              status,
              requirementTag: null,
            })
          }
          className="flex-1 rounded-lg bg-accent py-1 text-[12px] font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-2 py-1 text-[12px] text-text2 hover:bg-seg-bg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

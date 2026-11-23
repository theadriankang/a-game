"use client";

import { useState } from "react";
import Link from "next/link";

type AnalysisData = {
  summary: string;
  tags: string[];
  sources: string[];
  status: "PENDING" | "COMPLETED" | "FAILED" | "THIN_DATA";
};

type SemesterInfo = {
  semester: number;
  examDate: string | null;
  examDuration: number | null;
};

type Props = {
  moduleCode: string;
  title: string;
  mc: number;
  department: string | null;
  faculty: string | null;
  description: string | null;
  workload: number[] | null;
  semesterData: SemesterInfo[];
  prereqCodes: string[];
  prereqSummary: string | null;
  preclusion: string | null;
  corequisite: string | null;
  analysis: AnalysisData | null;
  pending: boolean;
};

const WORKLOAD_LABELS = ["Lecture", "Tutorial", "Lab", "Project", "Self-study"];
const SEM_LABEL: Record<number, string> = { 1: "Semester 1", 2: "Semester 2", 3: "Special Term I", 4: "Special Term II" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text3">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ModuleDetailView(props: Props) {
  const {
    moduleCode,
    title,
    mc,
    department,
    faculty,
    description,
    workload,
    semesterData,
    prereqCodes,
    prereqSummary,
    preclusion,
    corequisite,
    analysis,
    pending: initialPending,
  } = props;

  const [pending, setPending] = useState(initialPending);
  const [requesting, setRequesting] = useState(false);

  async function requestAnalysis() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/modules/${moduleCode}/analysis`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.queued) setPending(true);
      }
    } finally {
      setRequesting(false);
    }
  }

  const maxWorkload = workload ? Math.max(...workload, 1) : 1;

  return (
    <div className="min-h-screen bg-page text-text0">
      <header className="border-b border-border bg-surface px-7 py-4">
        <Link
          href="/planner"
          className="text-[12.5px] font-medium text-text3 transition-colors hover:text-text1"
        >
          ← Back to planner
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{moduleCode}</h1>
          <span className="rounded-full border border-border bg-seg-bg px-2.5 py-0.5 text-[12px] font-semibold text-text2">
            {mc} MC
          </span>
        </div>
        <div className="mt-0.5 text-[15px] text-text1">{title}</div>
        {department ? (
          <div className="mt-1 text-[12.5px] text-text3">
            {department}
            {faculty ? ` · ${faculty}` : ""}
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 p-7 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card title="Overview">
            {description ? (
              <p className="text-[13.5px] leading-relaxed text-text1">{description}</p>
            ) : (
              <p className="text-[13px] italic text-text3">
                No description published for this module.
              </p>
            )}
          </Card>

          <Card title="Requirements">
            <dl className="flex flex-col gap-3 text-[13px]">
              <div>
                <dt className="font-semibold text-text2">Prerequisites</dt>
                <dd className="mt-1 text-text1">
                  {prereqSummary ?? <span className="italic text-text3">None</span>}
                </dd>
                {prereqCodes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prereqCodes.map((code) => (
                      <Link
                        key={code}
                        href={`/modules/${code}`}
                        className="rounded-full border border-border bg-seg-bg px-2.5 py-1 text-[12px] font-semibold text-text1 transition-colors hover:border-accent hover:text-accent"
                      >
                        {code}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              {corequisite ? (
                <div>
                  <dt className="font-semibold text-text2">Corequisite</dt>
                  <dd className="mt-1 text-text1">{corequisite}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-text2">Preclusion</dt>
                <dd className="mt-1 text-text1">
                  {preclusion ?? <span className="italic text-text3">None</span>}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Workload">
            {workload ? (
              <div className="flex flex-col gap-2.5">
                {workload.map((hrs, i) =>
                  hrs > 0 || WORKLOAD_LABELS[i] ? (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-20 shrink-0 text-[12.5px] text-text2">
                        {WORKLOAD_LABELS[i] ?? "Other"}
                      </div>
                      <div className="h-2 flex-1 rounded-full bg-seg-bg">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(hrs / maxWorkload) * 100}%` }}
                        />
                      </div>
                      <div className="w-10 shrink-0 text-right text-[12.5px] tabular-nums text-text2">
                        {hrs}h
                      </div>
                    </div>
                  ) : null
                )}
                <p className="mt-1 text-[11.5px] text-text3">Hours per week, as published by NUSMods.</p>
              </div>
            ) : (
              <p className="text-[13px] italic text-text3">No workload breakdown published.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Availability">
            {semesterData.length > 0 ? (
              <div className="flex flex-col gap-3">
                {semesterData.map((s) => (
                  <div key={s.semester} className="rounded-lg border border-border bg-seg-bg p-3">
                    <div className="text-[13px] font-semibold">
                      {SEM_LABEL[s.semester] ?? `Semester ${s.semester}`}
                    </div>
                    {s.examDate ? (
                      <div className="mt-1 text-[12px] text-text2">
                        Exam: {new Date(s.examDate).toLocaleString("en-SG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {s.examDuration ? ` · ${s.examDuration} min` : ""}
                      </div>
                    ) : (
                      <div className="mt-1 text-[12px] italic text-text3">No exam, or not yet set.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] italic text-text3">Not offered this academic year.</p>
            )}
          </Card>

          <Card title="Community signal">
            {analysis ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] leading-relaxed text-text1">{analysis.summary}</p>
                {analysis.status === "THIN_DATA" ? (
                  <p className="italic text-text3 text-[12px]">
                    Not much public discussion found for this one.
                  </p>
                ) : null}
                {analysis.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-seg-bg px-2.5 py-1 text-[11.5px] font-medium text-text2"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {analysis.sources.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {analysis.sources.map((src) => (
                      <span key={src} className="truncate text-[11px] text-text3">
                        {src}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1 text-[11px] text-text3">
                  AI-synthesized from public discussion, not an official rating.
                </p>
              </div>
            ) : pending ? (
              <p className="text-[13px] text-text2">Analysis queued - check back soon.</p>
            ) : (
              <button
                onClick={requestAnalysis}
                disabled={requesting}
                className="text-[13px] font-semibold text-accent hover:underline disabled:opacity-50"
              >
                {requesting ? "Queuing…" : "Request analysis"}
              </button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TagCloud } from "@/components/tag-cloud";

type AnalysisData = {
  summary: string;
  tags: string[];
  tagWeights?: number[];
  keywords?: string[];
  keywordWeights?: number[];
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
  // Which of prereqCodes are already somewhere in the signed-in user's own
  // plan (not necessarily completed yet) - drives the filled/muted state
  // of each prereq node in the flow diagram.
  inPlanPrereqCodes: string[];
  // Other modules in the user's plan whose own prereq tree includes this
  // module - i.e. what taking this unlocks, scoped to their plan rather
  // than the entire NUSMods catalogue (see page.tsx for why).
  unlocks: { moduleCode: string; label: string }[];
  prereqSummary: string | null;
  // Student-specific context for the prerequisites above (e.g. covered by H2 Math), or null.
  prereqNote: string | null;
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
    inPlanPrereqCodes,
    unlocks,
    prereqSummary,
    prereqNote,
    preclusion,
    corequisite,
    analysis: initialAnalysis,
    pending: initialPending,
  } = props;

  // The POST below now runs the research synchronously (see the route's
  // own comment for why) rather than just flipping a "queued" flag, so the
  // finished report comes back in the same response - track it as local
  // state, seeded from the server-rendered prop, so a successful call can
  // replace it directly instead of needing a full page refresh.
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [pending, setPending] = useState(initialPending);
  const [requesting, setRequesting] = useState(false);

  async function requestAnalysis() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/modules/${moduleCode}/analysis`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAnalysis(data.analysis);
          setPending(false);
        } else if (data.queued) {
          setPending(true);
        }
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

      <div className="mx-auto max-w-5xl px-7 pt-7">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text3">
            Prerequisite path
          </h2>
          <div className="mt-4">
            <PrereqFlowDiagram
              moduleCode={moduleCode}
              prereqCodes={prereqCodes}
              inPlanPrereqCodes={inPlanPrereqCodes}
              unlocks={unlocks}
            />
          </div>
        </section>
      </div>

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
                {prereqNote ? <p className="mt-1 text-[12px] leading-snug text-text3">{prereqNote}</p> : null}
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
                {/* Prefer the larger, more granular keyword set for the
                    cloud; fall back to the curated tags for reports made
                    before KEYWORDS existed. */}
                {(analysis.keywords?.length ?? 0) > 0 || analysis.tags.length > 0 ? (
                  <div className="rounded-lg border border-border bg-page/60">
                    <TagCloud
                      words={
                        analysis.keywords && analysis.keywords.length > 0
                          ? analysis.keywords
                          : analysis.tags
                      }
                      weights={
                        analysis.keywords && analysis.keywords.length > 0
                          ? analysis.keywordWeights
                          : analysis.tagWeights
                      }
                    />
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

// A clean, static node-and-line diagram: this module's real prerequisites
// feeding into it on the left, and whatever in the user's own plan depends
// on it feeding out on the right - the same hover-connector idea from the
// planner grid, but laid out as a permanent flow since there's no card
// layout to hover here. Positions are measured off the actual rendered
// chips (same technique as the planner's PrereqConnectorOverlay) so the
// curves stay correct regardless of how many codes wrap to a second line.
function PrereqFlowDiagram({
  moduleCode,
  prereqCodes,
  inPlanPrereqCodes,
  unlocks,
}: {
  moduleCode: string;
  prereqCodes: string[];
  inPlanPrereqCodes: string[];
  unlocks: { moduleCode: string; label: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const rightRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const inPlanSet = new Set(inPlanPrereqCodes);

  useEffect(() => {
    function measure() {
      const container = containerRef.current;
      const center = centerRef.current;
      if (!container || !center) return;

      const containerRect = container.getBoundingClientRect();
      setSize({ width: container.scrollWidth, height: container.scrollHeight });

      const centerRect = center.getBoundingClientRect();
      const centerY = centerRect.top + centerRect.height / 2 - containerRect.top;
      const centerLeftX = centerRect.left - containerRect.left;
      const centerRightX = centerRect.right - containerRect.left;

      const next: { id: string; d: string }[] = [];

      leftRefs.current.forEach((el, code) => {
        const r = el.getBoundingClientRect();
        const fromX = r.right - containerRect.left;
        const fromY = r.top + r.height / 2 - containerRect.top;
        const midX = (fromX + centerLeftX) / 2;
        next.push({
          id: `l-${code}`,
          d: `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${centerY}, ${centerLeftX} ${centerY}`,
        });
      });

      rightRefs.current.forEach((el, code) => {
        const r = el.getBoundingClientRect();
        const toX = r.left - containerRect.left;
        const toY = r.top + r.height / 2 - containerRect.top;
        const midX = (centerRightX + toX) / 2;
        next.push({
          id: `r-${code}`,
          d: `M ${centerRightX} ${centerY} C ${midX} ${centerY}, ${midX} ${toY}, ${toX} ${toY}`,
        });
      });

      setPaths(next);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [prereqCodes, unlocks]);

  if (prereqCodes.length === 0 && unlocks.length === 0) {
    return (
      <p className="text-[13px] italic text-text3">
        No prerequisites, and nothing in your plan depends on this module yet.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      >
        {paths.map((p) => (
          <g key={p.id}>
            <path d={p.d} fill="none" stroke="var(--accent)" strokeWidth={4} strokeOpacity={0.12} strokeLinecap="round" />
            <path d={p.d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.8} strokeLinecap="round" />
          </g>
        ))}
      </svg>

      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-end justify-center gap-2.5">
          {prereqCodes.length === 0 ? (
            <div className="text-[11.5px] italic text-text3">No prerequisites</div>
          ) : (
            prereqCodes.map((code) => (
              <Link
                key={code}
                href={`/modules/${code}`}
                ref={(el) => {
                  if (el) leftRefs.current.set(code, el);
                  else leftRefs.current.delete(code);
                }}
                title={inPlanSet.has(code) ? "Already in your plan" : "Not yet in your plan"}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  inPlanSet.has(code)
                    ? "border-accent bg-page text-accent"
                    : "border-border bg-seg-bg text-text2 hover:border-accent hover:text-accent"
                }`}
              >
                {code}
              </Link>
            ))
          )}
        </div>

        <div
          ref={centerRef}
          className="whitespace-nowrap rounded-xl border-2 border-accent bg-accent px-5 py-3 text-center text-[14px] font-bold text-white"
        >
          {moduleCode}
        </div>

        <div className="flex flex-col items-start justify-center gap-2.5">
          {unlocks.length === 0 ? (
            <div className="text-[11.5px] italic text-text3">
              Nothing in your plan depends on this yet
            </div>
          ) : (
            unlocks.map((u) => (
              <Link
                key={u.moduleCode}
                href={`/modules/${u.moduleCode}`}
                ref={(el) => {
                  if (el) rightRefs.current.set(u.moduleCode, el);
                  else rightRefs.current.delete(u.moduleCode);
                }}
                title={u.label}
                className="rounded-full border border-border bg-seg-bg px-3 py-1.5 text-[12px] font-semibold text-text2 transition-colors hover:border-accent hover:text-accent"
              >
                {u.moduleCode}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

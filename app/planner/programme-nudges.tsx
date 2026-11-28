"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ProgrammeNudge, UnmetRequirement } from "@/lib/minors/nudges";

// Dismissals live in this browser only for now. They're keyed by programme AND
// tier, so a nudge the student waved away as "close" comes back on its own once
// their plan actually covers it - that's new information, not a repeat. A
// dismissed nudge isn't gone: it stays readable, steps and all, under
// "N dismissed".
const STORAGE_KEY = "a-game:dismissed-programme-nudges";
const MAX_SHOWN = 2;

const KIND_LABEL: Record<ProgrammeNudge["kind"], string> = {
  minor: "Minor",
  "second-major": "Second major",
  specialisation: "Specialisation",
};

const keyOf = (n: ProgrammeNudge) => `${n.id}:${n.tier}`;

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage blocked (private window etc.): the dismissal just lasts until reload.
  }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Headline({ nudge }: { nudge: ProgrammeNudge }) {
  if (nudge.tier === "qualifies") {
    return <>Your plan already covers the {nudge.label}</>;
  }
  return (
    <>
      You&rsquo;re about {plural(nudge.modulesAway, "module")} from the {nudge.label}
    </>
  );
}

function Detail({ nudge }: { nudge: ProgrammeNudge }) {
  if (nudge.tier === "qualifies") {
    return (
      <>
        {nudge.countedMc}/{nudge.requiredMc} MC across what you&rsquo;ve completed and planned
        {nudge.dependsOnPlanned ? ", some of it still planned" : ""}.
      </>
    );
  }
  return (
    <>
      {nudge.countedMc}/{nudge.requiredMc} MC so far. Still needs {nudge.requiredMc - nudge.countedMc} MC.
    </>
  );
}

function RequirementLine({ requirement }: { requirement: UnmetRequirement }) {
  const { options, moreOptions, patterns } = requirement;
  const parts: string[] = [];
  if (options.length > 0) parts.push(options.join(", ") + (moreOptions > 0 ? ` +${moreOptions} more` : ""));
  if (patterns.length > 0) parts.push(`any ${patterns.join(" or ")} module`);
  return (
    <li className="mt-0.5">
      <span className="font-medium text-text1">{requirement.label}</span>
      <span className="text-text3"> &middot; {requirement.remainingMc} MC more</span>
      {parts.length > 0 ? <span>: {parts.join(", or ")}</span> : null}
    </li>
  );
}

function Step({ children }: { children: ReactNode }) {
  return <li className="mt-1.5">{children}</li>;
}

// What a student can do to go ahead with the programme: finish the requirements, apply or declare, confirm details.
function Steps({ nudge }: { nudge: ProgrammeNudge }) {
  const { application } = nudge;
  const needsModules = nudge.requirements.length > 0;

  return (
    <ol className="mt-1.5 list-decimal pl-4 text-[12px] leading-snug text-text2">
      <Step>
        {needsModules ? (
          <>
            <span className="font-semibold text-text1">Take what&rsquo;s still missing.</span>
            <ul className="mt-0.5 list-disc pl-4">
              {nudge.requirements.map((r) => (
                <RequirementLine key={r.label} requirement={r} />
              ))}
            </ul>
          </>
        ) : nudge.dependsOnPlanned ? (
          <>
            <span className="font-semibold text-text1">Complete the modules you&rsquo;ve planned toward it.</span> They only
            count once taken, so keep them in the semesters you&rsquo;ve set.
          </>
        ) : (
          <>
            <span className="font-semibold text-text1">The requirements are done.</span> There&rsquo;s nothing left to take.
          </>
        )}
      </Step>

      {application ? (
        <Step>
          <span className="font-semibold text-text1">{application.type === "apply" ? "Apply for it." : "Declare it."}</span>
          {application.deadline ? (
            <span className="ml-1 rounded bg-amber-bg px-1.5 py-0.5 text-[11px] font-semibold text-amber">
              {application.deadline}
            </span>
          ) : null}
          <ul className="mt-0.5 list-disc pl-4">
            {application.steps.map((step) => (
              <li key={step} className="mt-0.5">
                {step}
              </li>
            ))}
          </ul>
          {application.url ? (
            <a href={application.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block font-semibold text-accent hover:underline">
              Where to apply
            </a>
          ) : null}
        </Step>
      ) : (
        <Step>
          <span className="font-semibold text-text1">Check how to apply.</span> The source doesn&rsquo;t spell out the process, so
          read the programme&rsquo;s own page or ask the department.
        </Step>
      )}

      <Step>
        <span className="font-semibold text-text1">Confirm the details.</span>{" "}
        {nudge.caveatCount > 0 ? `${plural(nudge.caveatCount, "thing")} to double-check. ` : ""}
        <a href={nudge.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
          Official page
        </a>
        {" · "}
        <Link href={`/minors/${nudge.id}`} className="font-semibold text-accent hover:underline">
          Full requirements
        </Link>
      </Step>
    </ol>
  );
}

// One nudge. An active one carries a dismiss button (`onDismiss`); one in the "dismissed" list has none and isn't
// tinted green, so it reads as set aside rather than as news.
function NudgeCard({ nudge, open, onDismiss }: { nudge: ProgrammeNudge; open: boolean; onDismiss?: () => void }) {
  const done = nudge.tier === "qualifies" && !!onDismiss;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${done ? "border-green-border bg-green-bg" : "border-border bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full border border-border bg-seg-bg px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-text2">
              {KIND_LABEL[nudge.kind]}
            </span>
            <span className={`text-[13px] font-semibold ${done ? "text-green" : "text-text1"}`}>
              <Headline nudge={nudge} />
            </span>
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-text2">
            <Detail nudge={nudge} />
          </div>
        </div>
        {onDismiss ? (
          <button
            onClick={onDismiss}
            aria-label={`Dismiss ${nudge.label}`}
            title="Dismiss. You can still see it under “dismissed” below."
            className="shrink-0 text-text3 opacity-60 transition-opacity hover:opacity-100"
          >
            ✕
          </button>
        ) : null}
      </div>
      <details className="mt-1.5" open={open}>
        <summary className="cursor-pointer text-[12px] font-semibold text-accent">How to go ahead</summary>
        <Steps nudge={nudge} />
      </details>
    </div>
  );
}

export function ProgrammeNudges({ nudges }: { nudges: ProgrammeNudge[] }) {
  // null until the browser has been read, so a nudge the student already dismissed doesn't flash up first.
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  useEffect(() => setDismissed(loadDismissed()), []);

  const visible = nudges.filter((n) => !(dismissed ?? []).includes(keyOf(n)));
  const hidden = nudges.filter((n) => (dismissed ?? []).includes(keyOf(n)));

  // If nothing is dismissed any more (a dismissed nudge changed state and came back on its own), close the list so the
  // next dismissal starts collapsed instead of reopening it.
  useEffect(() => {
    if (hidden.length === 0) setShowDismissed(false);
  }, [hidden.length]);

  if (dismissed === null || nudges.length === 0) return null;

  const shown = visible.slice(0, MAX_SHOWN);
  const moreCount = visible.length - shown.length;

  function dismiss(nudge: ProgrammeNudge) {
    const next = [...(dismissed ?? []), keyOf(nudge)];
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className="mb-4 flex max-w-3xl flex-col gap-2" aria-label="Programmes you're close to">
      {shown.map((nudge, index) => (
        <NudgeCard key={nudge.id} nudge={nudge} open={index === 0} onDismiss={() => dismiss(nudge)} />
      ))}
      {moreCount > 0 ? (
        <Link href="/minors" className="text-[12px] font-semibold text-accent hover:underline">
          {moreCount} more within reach
        </Link>
      ) : null}

      {/* Stays even when every nudge is dismissed, so they can always be looked at again. */}
      {hidden.length > 0 ? (
        <div>
          <button
            onClick={() => setShowDismissed((v) => !v)}
            aria-expanded={showDismissed}
            className="text-[12px] font-semibold text-text2 transition-colors duration-150 hover:text-accent"
          >
            {showDismissed ? "Hide" : "Show"} {hidden.length} dismissed
          </button>
          {showDismissed ? (
            <div className="mt-2 flex flex-col gap-2">
              {hidden.map((nudge) => (
                <NudgeCard key={nudge.id} nudge={nudge} open={false} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

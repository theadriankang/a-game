import Link from "next/link";
import { assessCloseness } from "@/lib/minors/closeness";
import { closedReason, type GroupFit, type MinorFit } from "@/lib/minors/fit";
import { prefixPattern } from "@/lib/minors/nudges";
import type { MinorRequirementGroup } from "@/lib/minors/types";
import { ProgressBar } from "../progress-bar";

type PlanStatus = "COMPLETED" | "PLANNED" | "RESERVED";
type ModuleState = "done" | "planned" | "elsewhere" | "none";

const KIND_LABEL = { minor: "Minor", "second-major": "Second major", specialisation: "Specialisation" } as const;

// The page is a wide two-column layout: the requirements take the main column and everything about getting in sits in
// a side column that stays in view while you scroll. It uses the full width of the window; to cap it on huge screens,
// swap this for something like "mx-auto max-w-[1600px]".
const PAGE_WIDTH = "w-full";

// The most columns the requirement cards may flow into (fewer when there are fewer cards or the window is narrower), so
// that a wide window gives each card room instead of squeezing in more, narrower ones.
const MAX_CARD_COLUMNS = 4;

function BackButton() {
  return (
    <Link
      href="/minors"
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
    >
      Back to minors
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-semibold text-text1">{children}</h2>;
}

// One module a requirement accepts: its code and title (linked to its module page when NUSMods lists it this year),
// and where it stands in the student's plan.
function ModuleRow({ code, title, state }: { code: string; title?: string; state: ModuleState }) {
  const label = (
    <>
      <span className="font-semibold text-text1">{code}</span>
      {title ? <span className="text-text3"> {title}</span> : null}
    </>
  );
  return (
    <li className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="min-w-0" title={title ? undefined : "Not in NUSMods' list for this academic year"}>
        {title ? (
          <Link href={`/modules/${code}`} className="hover:text-accent hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </span>
      {state === "done" ? (
        <span className="shrink-0 font-semibold text-green">Done</span>
      ) : state === "planned" ? (
        <span className="shrink-0 font-semibold text-accent">Planned</span>
      ) : state === "elsewhere" ? (
        <span className="shrink-0 text-text3" title="In your plan, but counted toward another requirement of this programme">
          In your plan
        </span>
      ) : null}
    </li>
  );
}

function Requirement({
  group,
  progress,
  statusByCode,
  titles,
}: {
  group: MinorRequirementGroup;
  progress: GroupFit;
  statusByCode: Record<string, PlanStatus>;
  titles: Record<string, string>;
}) {
  const counted = new Set(progress.matchedCodes.map((c) => c.toUpperCase()));
  const listed = group.moduleCodes ?? [];
  const patterns = (group.codePrefixes ?? []).map(prefixPattern);
  // Modules from the student's plan that count only because they fit a code pattern, so aren't in the list above.
  const fromPattern = progress.matchedCodes.filter((c) => !listed.includes(c.toUpperCase()));
  const total = progress.completedMc + progress.plannedMc;
  const met = total >= group.requiredMc;

  const stateOf = (code: string): ModuleState => {
    const status = statusByCode[code];
    if (!status) return "none";
    if (!counted.has(code)) return "elsewhere";
    return status === "COMPLETED" ? "done" : "planned";
  };

  return (
    <section className="mb-3 break-inside-avoid rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13.5px] font-semibold text-text1">{group.label}</h3>
        <span className={`shrink-0 text-[12px] ${met ? "font-semibold text-green" : "text-text3"}`}>
          {met ? "✓ " : ""}
          {total}/{group.requiredMc} MC
        </span>
      </div>

      {listed.length > 0 ? (
        <>
          <div className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-text3">Modules that count</div>
          {/* As many columns as the card is wide enough for, so a long list fills a wide card instead of running down it. */}
          <ul className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-x-6 gap-y-1">
            {listed.map((code) => (
              <ModuleRow key={code} code={code} title={titles[code]} state={stateOf(code)} />
            ))}
          </ul>
        </>
      ) : null}

      {patterns.length > 0 ? (
        <p className="mt-2 text-[12px] text-text2">
          {listed.length > 0 ? "Also any " : "Any "}
          <span className="font-semibold text-text1">{patterns.join(" or ")}</span> module.
        </p>
      ) : null}

      {fromPattern.length > 0 ? (
        <p className="mt-1 text-[12px] text-text2">
          Counted from your plan: <span className="font-semibold text-text1">{fromPattern.join(", ")}</span>
        </p>
      ) : null}

      {group.excludeCodes && group.excludeCodes.length > 0 ? (
        <p className="mt-2 text-[11.5px] text-text3">Doesn&rsquo;t count: {group.excludeCodes.join(", ")}</p>
      ) : null}
    </section>
  );
}

// Everything one programme asks for, exactly as modelled from its source: each requirement with every module that counts
// (and where each stands in the student's plan), who can take it, how to apply, and what the source left unclear.
export function ProgrammeDetail({
  fit,
  statusByCode,
  titles,
}: {
  fit: MinorFit;
  statusByCode: Record<string, PlanStatus>;
  titles: Record<string, string>;
}) {
  const programme = fit.minor;
  const closeness = assessCloseness(fit);
  const kind = programme.kind ?? "minor";
  const reason = closedReason(fit);
  const done = fit.totalCompletedMc;
  const planned = fit.totalPlannedMc;
  const totalText =
    programme.totalMcMax && programme.totalMcMax !== programme.totalMcMin
      ? `${programme.totalMcMin}–${programme.totalMcMax} MC`
      : `${programme.totalMcMin} MC`;
  const only = programme.eligibleProgrammePrefixes ?? [];
  const excluded = programme.excludedProgrammePrefixes;
  const application = programme.application;
  const caveats = programme.caveats ?? [];

  return (
    <div className="min-h-screen bg-bg">
      <div className="screen-scale">
        <header className="border-b border-border">
          <div className={`${PAGE_WIDTH} flex items-start justify-between gap-4 px-6 py-4`}>
            <div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="rounded-full border border-border bg-seg-bg px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-text2">
                  {KIND_LABEL[kind]}
                </span>
                <h1 className="text-[18px] font-semibold text-text1">{programme.label}</h1>
              </div>
              <p className="mt-0.5 text-[13px] text-text3">
                {programme.department} &middot; {totalText}
                {programme.cohortNote ? ` · ${programme.cohortNote}` : ""}
              </p>
            </div>
            <BackButton />
          </div>
        </header>

        <main className={`${PAGE_WIDTH} animate-fade-in p-6`}>
          {/* Where the student stands, across the full width: a strip rather than a card in a column. */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="shrink-0">
                <div className="text-[13px] font-semibold text-text1">Where you stand</div>
                {closeness.tier === "qualifies" ? (
                  <span className="mt-1.5 inline-block rounded-full border border-green-border bg-green-bg px-2 py-0.5 text-[11px] font-semibold text-green">
                    Your plan covers this
                  </span>
                ) : closeness.tier === "close" ? (
                  <span className="mt-1.5 inline-block rounded-full border border-accent bg-page px-2 py-0.5 text-[11px] font-semibold text-accent">
                    About {closeness.modulesAway} module{closeness.modulesAway === 1 ? "" : "s"} away
                  </span>
                ) : null}
              </div>
              <div className="min-w-[14rem] flex-1">
                <div className="flex items-baseline justify-between gap-3 text-[12px] text-text3">
                  <span>
                    {done} completed &middot; {planned} planned
                  </span>
                  <span className="font-semibold text-text1">
                    {done + planned}/{fit.totalRequiredMc} MC
                  </span>
                </div>
                <ProgressBar completed={done} planned={planned} required={fit.totalRequiredMc} />
              </div>
            </div>
            {reason ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
                You can&rsquo;t take this one. {reason}
              </div>
            ) : null}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start 2xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div>
              <SectionTitle>
                What it requires
                <span className="ml-2 text-[11px] font-normal text-text3">
                  Done = completed, Planned = in a semester still to come. Each module counts toward one requirement only.
                </span>
              </SectionTitle>
              {/* One card per requirement, flowing into as many columns as the width allows (each at least 26rem), but never
                  more columns than cards or MAX_CARD_COLUMNS: so a few requirements share the whole row rather than bunching
                  on the left. Cards keep their natural height. */}
              <div
                className="mt-2 gap-x-3"
                style={{ columnWidth: "26rem", columnCount: Math.min(programme.groups.length, MAX_CARD_COLUMNS) }}
              >
                {programme.groups.map((group) => {
                  const progress = fit.groups.find((g) => g.groupId === group.id);
                  return progress ? (
                    <Requirement key={group.id} group={group} progress={progress} statusByCode={statusByCode} titles={titles} />
                  ) : null;
                })}
              </div>
            </div>

            {/* Getting in: stays in view beside the requirements, and scrolls on its own if it's taller than the screen. */}
            <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc((100vh_-_3rem)_/_var(--screen-scale))] lg:overflow-y-auto">
              <div>
                <SectionTitle>Who can take it</SectionTitle>
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 text-[12px] text-text2">
                  {only.length > 0 ? (
                    <>
                      <div className="font-semibold text-text1">Only open to students of:</div>
                      <ul className="mt-1 list-disc pl-5">
                        {only.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {excluded.length > 0 ? (
                    <div className={only.length > 0 ? "mt-3" : ""}>
                      <div className="font-semibold text-text1">Not open to students of:</div>
                      <ul className="mt-1 grid list-disc gap-x-6 pl-5 sm:grid-cols-2 lg:grid-cols-1">
                        {excluded.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {only.length === 0 && excluded.length === 0 ? <p>Open to every programme.</p> : null}
                </div>
              </div>

              <div>
                <SectionTitle>
                  {application ? (application.type === "apply" ? "How to apply" : "How to declare") : "How to apply"}
                  {application?.deadline ? (
                    <span className="ml-2 inline-block rounded bg-amber-bg px-1.5 py-0.5 text-[11px] font-semibold text-amber">
                      {application.deadline}
                    </span>
                  ) : null}
                </SectionTitle>
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 text-[12px] text-text2">
                  {application ? (
                    <>
                      <ol className="list-decimal pl-5">
                        {application.steps.map((step) => (
                          <li key={step} className="mt-1 first:mt-0">
                            {step}
                          </li>
                        ))}
                      </ol>
                      {application.url ? (
                        <a href={application.url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-accent hover:underline">
                          Where to apply
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p>
                      The source doesn&rsquo;t spell out the process. Read the official page below or ask the department how to
                      apply or declare it.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <SectionTitle>Things to double-check</SectionTitle>
                <div className="mt-2 rounded-xl border border-border bg-surface p-4 text-[12px] text-text2">
                  {caveats.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {caveats.map((c) => (
                        <li key={c} className="mt-1 first:mt-0">
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Nothing flagged. Still confirm with the department before declaring.</p>
                  )}
                </div>
              </div>

              <p className="text-[11.5px] text-text3">
                Read from{" "}
                <a href={programme.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  the official page
                </a>{" "}
                on {programme.sourceCheckedDate}. This hasn&rsquo;t been confirmed by the department, so check it before you
                declare.
              </p>
            </aside>
          </div>

          <div className="mt-8">
            <BackButton />
          </div>
        </main>
      </div>
    </div>
  );
}

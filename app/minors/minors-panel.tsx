import Link from "next/link";
import { closedReason, type MinorFit } from "@/lib/minors/fit";
import { assessCloseness } from "@/lib/minors/closeness";
import type { ProgrammeOverview } from "@/lib/minors/overview";
import { ProgressBar } from "./progress-bar";

function FitCard({ fit }: { fit: MinorFit }) {
  const done = fit.totalCompletedMc;
  const planned = fit.totalPlannedMc;
  const required = fit.totalRequiredMc;
  const closeness = assessCloseness(fit);
  return (
    <div className="animate-fade-slide-in rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-text1">{fit.minor.label}</div>
          <div className="text-[12px] text-text3">{fit.minor.department}</div>
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
        <div className="shrink-0 text-right text-[12px] text-text3">
          {done + planned}/{required} MC
        </div>
      </div>

      <ProgressBar completed={done} planned={planned} required={required} />

      <div className="mt-3 flex flex-col gap-2">
        {fit.groups.map((g) => {
          const total = g.completedMc + g.plannedMc;
          const met = total >= g.requiredMc;
          return (
            <div key={g.groupId} className="text-[12px]">
              <div className="flex items-baseline justify-between">
                <span className={met ? "text-text1" : "text-text2"}>{g.label}</span>
                <span className={met ? "font-semibold text-accent" : "text-text3"}>
                  {total}/{g.requiredMc} MC
                </span>
              </div>
              {g.matchedCodes.length > 0 ? (
                <div className="mt-0.5 text-[11px] text-text3">{g.matchedCodes.join(", ")}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {fit.minor.application ? (
        <details className="mt-3 rounded-md border border-border bg-page px-2.5 py-1.5">
          <summary className="cursor-pointer text-[12px] font-semibold text-text1">
            {fit.minor.application.type === "apply" ? "How to apply" : "How to declare"}
            {fit.minor.application.deadline ? (
              <span className="ml-1.5 font-normal text-amber">{fit.minor.application.deadline}</span>
            ) : null}
          </summary>
          <ol className="mt-1.5 list-decimal pl-4 text-[11.5px] leading-snug text-text2">
            {fit.minor.application.steps.map((step) => (
              <li key={step} className="mt-1">
                {step}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="mt-3 border-t border-border pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <a
            href={fit.minor.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-text3 hover:text-accent hover:underline"
          >
            Source (checked {fit.minor.sourceCheckedDate})
          </a>
          <Link href={`/minors/${fit.minor.id}`} className="text-[11.5px] font-semibold text-accent hover:underline">
            Full requirements
          </Link>
        </div>
        {fit.minor.caveats && fit.minor.caveats.length > 0 ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-amber-700">
              {fit.minor.caveats.length} thing{fit.minor.caveats.length > 1 ? "s" : ""} to double-check
            </summary>
            <ul className="mt-1 list-disc pl-4 text-[11px] text-text3">
              {fit.minor.caveats.map((c) => (
                <li key={c} className="mt-0.5">
                  {c}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}

const KINDS: { kind: "minor" | "second-major" | "specialisation"; title: string }[] = [
  { kind: "minor", title: "Minors" },
  { kind: "second-major", title: "Second majors" },
  { kind: "specialisation", title: "Specialisations" },
];

// The programmes this student can't take, grouped by kind and then by reason ("Only open to BComp (CS) students"
// once for eleven focus areas rather than eleven times). Behind a dropdown so it's there to check without taking
// over the page.
function ClosedPrograms({ closed, openCount }: { closed: MinorFit[]; openCount: number }) {
  const total = openCount + closed.length;
  if (closed.length === 0) {
    return (
      <p className="mt-10 border-t border-border pt-4 text-[13px] text-text3">
        We track {total} programmes and every one is open to you.
      </p>
    );
  }
  return (
    <section className="mt-10 border-t border-border pt-4">
      <p className="text-[13px] text-text2">
        We track {total} programmes. {openCount} {openCount === 1 ? "is" : "are"} open to you and listed above; the other{" "}
        {closed.length} {closed.length === 1 ? "isn't" : "aren't"} open to your programme.
      </p>
      <details className="mt-2 rounded-xl border border-border bg-surface px-4 py-2.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-text1">
          Show the {closed.length} that {closed.length === 1 ? "isn't" : "aren't"} open to you
        </summary>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(18rem,100%),1fr))] gap-x-8 gap-y-4">
          {KINDS.map(({ kind, title }) => {
            const ofKind = closed.filter((fit) => (fit.minor.kind ?? "minor") === kind);
            if (ofKind.length === 0) return null;
            const byReason = new Map<string, MinorFit[]>();
            for (const fit of ofKind) {
              const reason = closedReason(fit) ?? "Not open to your programme.";
              byReason.set(reason, [...(byReason.get(reason) ?? []), fit]);
            }
            return (
              <div key={kind}>
                <div className="text-[12px] font-semibold text-text1">
                  {title} <span className="font-normal text-text3">({ofKind.length})</span>
                </div>
                {[...byReason].map(([reason, fits]) => (
                  <div key={reason} className="mt-1.5">
                    <div className="text-[11.5px] text-text3">{reason}</div>
                    <ul className="mt-0.5 list-disc pl-5 text-[12px] text-text2">
                      {fits.map((fit) => (
                        <li key={fit.minor.id}>{fit.minor.label}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

// One kind of programme: its heading and a grid of cards, as many columns as fit (each at least 22rem) so a wide window
// gets cards of a sensible width rather than a few stretched ones, with label and MC count close together.
function Section({ kind, title, fits }: { kind: (typeof KINDS)[number]["kind"]; title: string; fits: MinorFit[] }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-text1">
        {title}
        {kind === "second-major" ? (
          <span className="ml-2 text-[11px] font-normal text-text3">roughly double the commitment of a minor</span>
        ) : null}
        {kind === "specialisation" ? (
          <span className="ml-2 text-[11px] font-normal text-text3">inside your degree: no extra programme to add</span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(min(22rem,100%),1fr))] items-start gap-4">
        {fits.map((fit) => (
          <FitCard key={fit.minor.id} fit={fit} />
        ))}
      </div>
    </div>
  );
}

export function MinorsPanel({ overview }: { overview: ProgrammeOverview }) {
  const lists = {
    minor: overview.minors,
    "second-major": overview.secondMajors,
    specialisation: overview.specialisations,
  };
  const openCount = overview.minors.length + overview.secondMajors.length + overview.specialisations.length;
  // Minors and second majors are usually a handful each, so on a wide window they sit side by side (each with its own
  // columns of cards) instead of leaving half the page empty; specialisations are many, so they get the full width below.
  const sideBySide = KINDS.filter(({ kind }) => kind !== "specialisation" && lists[kind].length > 0);
  const specialisations = KINDS.find(({ kind }) => kind === "specialisation")!;

  return (
    <div className="min-h-screen bg-bg">
      <div className="screen-scale">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border px-6 py-4">
          <div className="min-w-[16rem] flex-1">
            <h1 className="text-[18px] font-semibold text-text1">Minors, second majors & specialisations</h1>
            {/* Spreads across the header, wrapping only where it meets the button. */}
            <p className="mt-0.5 text-[13px] text-text3">
              How close your planned and completed modules already get you to
              each minor, second major or specialisation open for your major. A module that counts toward
              your degree can count toward one of these too, its shown here
              automatically.
            </p>
          </div>
          <Link
            href="/planner"
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
          >
            Back to planner
          </Link>
        </header>

        <main className="animate-fade-in p-6">
          {openCount === 0 ? (
            <p className="text-[13px] text-text2">None of the programmes we track are open to your programme.</p>
          ) : null}

          {sideBySide.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(44rem,100%),1fr))] items-start gap-x-6 gap-y-8">
              {sideBySide.map(({ kind, title }) => (
                <Section key={kind} kind={kind} title={title} fits={lists[kind]} />
              ))}
            </div>
          ) : null}

          {lists.specialisation.length > 0 ? (
            <div className={sideBySide.length > 0 ? "mt-8" : ""}>
              <Section kind="specialisation" title={specialisations.title} fits={lists.specialisation} />
            </div>
          ) : null}

          <ClosedPrograms closed={overview.closed} openCount={openCount} />
        </main>
      </div>
    </div>
  );
}

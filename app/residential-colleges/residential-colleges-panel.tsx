import Image from "next/image";
import Link from "next/link";
import type { CollegeStructure } from "@/lib/residential-colleges/types";

function CollegeCard({ college, isMine }: { college: CollegeStructure; isMine: boolean }) {
  return (
    <div
      className={`animate-fade-slide-in rounded-xl border p-4 ${
        isMine ? "border-accent bg-accent/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-page p-1.5">
          <Image
            src={college.logo}
            alt={`${college.label} crest`}
            width={80}
            height={80}
            className="h-full w-full object-contain"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[14px] font-semibold text-text1">{college.label}</div>
            {isMine ? (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                Your college
              </span>
            ) : null}
          </div>
          <div className="text-[12px] text-text3">{college.programme} programme</div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-snug text-text2">{college.description}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        {college.slots.map((slot) => (
          <div key={slot.id} className="flex items-baseline justify-between text-[12px]">
            <span className="text-text1">
              {slot.label}
              {slot.optional ? <span className="ml-1 text-text3">(optional)</span> : null}
            </span>
            <span className="text-text3">{slot.mc} MC</span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text3">
          <a href={college.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
            Source (checked {college.sourceCheckedDate})
          </a>
          <span>{college.logoCredit}</span>
        </div>
        {college.caveats.length > 0 ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-amber-700">
              {college.caveats.length} thing{college.caveats.length > 1 ? "s" : ""} to double-check
            </summary>
            <ul className="mt-1 list-disc pl-4 text-[11px] text-text3">
              {college.caveats.map((c) => (
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

export function ResidentialCollegesPanel({
  colleges,
  currentCollegeId,
}: {
  colleges: CollegeStructure[];
  currentCollegeId: string | null;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-text1">Residential Colleges</h1>
          <p className="mt-0.5 max-w-xl text-[13px] text-text3">
            NUS's University Town residential colleges (and RVRC) each run their own course
            requirement on top of your degree. Pick yours during onboarding and we&apos;ll reserve
            the right number of generic slots for you — the exact courses still rotate every
            semester, so you choose those yourself once they&apos;re offered.
          </p>
        </div>
        <Link
          href="/planner"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-text1 transition-colors duration-150 hover:bg-seg-bg"
        >
          Back to planner
        </Link>
      </header>

      <main className="animate-fade-in p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {colleges.map((college) => (
            <CollegeCard key={college.id} college={college} isMine={college.id === currentCollegeId} />
          ))}
        </div>

        <p className="mt-6 text-[11.5px] leading-snug text-text3">
          College crests above belong to their respective colleges and are shown here for
          identification only, each credited to its source. If you&apos;re not in any of these
          (or you're not staying on campus), nothing here applies to you.
        </p>
      </main>
    </div>
  );
}

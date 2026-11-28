"use client";

import Image from "next/image";
import { ALL_COLLEGES } from "@/lib/residential-colleges/registry";
import { ADMISSION_TYPE_LABELS, type AdmissionType } from "@/lib/residential-colleges/types";
import { planCollegeReservations, summarizeSlots } from "@/lib/residential-colleges/reservations";
import { collegeNudgesFor } from "@/lib/residential-colleges/college-nudges";

const ADMISSION_TYPES = Object.keys(ADMISSION_TYPE_LABELS) as AdmissionType[];

/**
 * Asks whether the student is staying on campus in a residential college, and if so which one — then previews
 * roughly what will be reserved for it. Doesn't try to guess specific modules (each RC runs several
 * interchangeable options per slot, and the list turns over every semester) — see each college's own caveats.
 */
export function ResidentialCollegeField({
  onCampus,
  onOnCampusChange,
  collegeId,
  onCollegeChange,
  admissionType,
  onAdmissionTypeChange,
  matriculationYear,
  faculty,
}: {
  onCampus: boolean;
  onOnCampusChange: (v: boolean) => void;
  collegeId: string | null;
  onCollegeChange: (v: string | null) => void;
  admissionType: AdmissionType;
  onAdmissionTypeChange: (v: AdmissionType) => void;
  /** feeds the Digital Literacy legacy-curriculum check (src/lib/residential-colleges/reservations.ts) */
  matriculationYear: number | undefined;
  /** feeds the RC4/CHS nudges (src/lib/residential-colleges/college-nudges.ts) */
  faculty: string;
}) {
  const college = collegeId ? ALL_COLLEGES.find((c) => c.id === collegeId) : undefined;
  const plan = college ? planCollegeReservations(college, admissionType, matriculationYear ?? null) : null;
  const nudges = college ? collegeNudgesFor(college, faculty) : [];

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={onCampus}
          onChange={(e) => {
            onOnCampusChange(e.target.checked);
            if (!e.target.checked) onCollegeChange(null);
          }}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-[13px] font-medium text-text1">I&apos;m staying on campus</span>
      </label>

      {onCampus && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-page p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={collegeId !== null}
              onChange={(e) => onCollegeChange(e.target.checked ? ALL_COLLEGES[0].id : null)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-[13px] font-medium text-text1">I&apos;m in a Residential College</span>
          </label>

          {collegeId !== null && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_COLLEGES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCollegeChange(c.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-colors duration-150 ${
                      collegeId === c.id
                        ? "border-accent bg-accent/5"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <div className="flex h-10 items-center justify-center">
                      <Image
                        src={c.logo}
                        alt={`${c.label} crest`}
                        width={96}
                        height={40}
                        className="max-h-10 w-auto object-contain"
                        unoptimized
                      />
                    </div>
                    <span className="text-center text-[11.5px] font-medium leading-tight text-text1">
                      {c.shortLabel}
                    </span>
                  </button>
                ))}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-text1">When did you join?</span>
                <select
                  value={admissionType}
                  onChange={(e) => onAdmissionTypeChange(e.target.value as AdmissionType)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
                >
                  {ADMISSION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ADMISSION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              {college && plan && (
                <div className="rounded-lg border border-border bg-surface p-3">
                  {plan.prorated ? (
                    <p className="text-[12px] leading-snug text-amber-700">{plan.note}</p>
                  ) : (
                    <>
                      <p className="text-[12.5px] font-medium text-text1">
                        You&apos;ll likely be reserving:
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-text2">
                        {summarizeSlots(plan.slots)}
                      </p>
                      <p className="mt-1.5 text-[11.5px] leading-snug text-text3">
                        It doesn&apos;t have to be the exact courses yet — {college.label} offers several options for
                        each (e.g. multiple Junior Seminars a semester); just pick one per slot later. We&apos;ll
                        reserve these spots now and you can fill in the real course once you&apos;ve chosen.
                      </p>
                    </>
                  )}
                </div>
              )}

              {nudges.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-[12px] leading-snug ${
                    n.tone === "warning"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-border bg-page text-text2"
                  }`}
                >
                  {n.message}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

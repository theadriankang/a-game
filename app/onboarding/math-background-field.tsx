"use client";

import {
  MATH_BACKGROUNDS,
  POLYTECHNIC_MATH_CERTIFICATES,
  POLYTECHNIC_MATH_CERTIFICATES_SOURCE,
  type MathBackground,
} from "@/lib/qualifications";

/**
 * Asks how the student meets NUS's "good H2 pass in Maths (or equivalent)" condition. Optional, but answering
 * stops the planner wrongly warning about modules that list "H2 Math or MA1301" as a prerequisite.
 */
export function MathBackgroundField({
  value,
  onChange,
  polytechnic,
}: {
  value: MathBackground | "";
  onChange: (v: MathBackground | "") => void;
  /** the polytechnic chosen above, if any, so we can show that school's recognised certificates */
  polytechnic: string;
}) {
  const certificates = polytechnic ? POLYTECHNIC_MATH_CERTIFICATES[polytechnic] : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="math-background" className="text-[13px] font-medium text-text1">
        Maths background
      </label>
      <select
        id="math-background"
        value={value}
        onChange={(e) => onChange(e.target.value as MathBackground | "")}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent ${
          value ? "text-text0" : "text-text3"
        }`}
      >
        <option value="">Select… (optional)</option>
        {MATH_BACKGROUNDS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <span className="text-[12px] text-text3">
        NUS lets students with H2 Math (or an equivalent) skip the bridging module MA1301, and many first-year modules
        accept H2 Math in its place. Answering stops us wrongly warning you about their prerequisites.
      </span>

      {value === "POLY_CERT" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-page p-3">
          <span className="text-[12.5px] font-medium text-text1">
            {certificates ? `Recognised certificates at ${polytechnic}` : "Recognised certificates"}
          </span>
          {certificates ? (
            <ul className="flex flex-col gap-1">
              {certificates.map((c) => (
                <li key={c} className="text-[12px] leading-snug text-text2">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-text3">Choose your polytechnic above to see which certificates NUS recognises.</p>
          )}
          <p className="text-[11.5px] leading-snug text-text3">
            From{" "}
            <a href={POLYTECHNIC_MATH_CERTIFICATES_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
              {POLYTECHNIC_MATH_CERTIFICATES_SOURCE.label}
            </a>
            . Some Singapore Polytechnic ones are for past graduates only. If yours isn&apos;t listed, check with your
            polytechnic; you can also sit the MA1301 Proficiency Test.
          </p>
        </div>
      )}

      {value === "NONE" && (
        <p className="text-[12px] leading-snug text-text3">
          You&apos;ll need MA1301 (or MA1301X) before modules like CS1231S, MA1521 and MA1522. You can instead sit the MA1301
          Proficiency Test each July; passing it counts as H2 Math.
        </p>
      )}
    </div>
  );
}

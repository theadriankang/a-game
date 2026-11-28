"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nusFaculties } from "@/lib/education-data/nus-programmes";
import { polytechnics } from "@/lib/education-data/polytechnic-diplomas";
import { H3Guidance, SuggestionList, useSuggestions, type SuggestedModule } from "./exemption-suggestions";
import { ModuleCodeInput, type ChosenModule } from "./module-code-input";
import { SuBudgetCard } from "./su-budget-card";
import { MathBackgroundField } from "./math-background-field";
import { ResidentialCollegeField } from "./residential-college-field";
import type { AdmissionType } from "@/lib/residential-colleges/types";
import type { MathBackground } from "@/lib/qualifications";
import { computeSuBudget, totalApcUnits, type PriorUniversity } from "@/lib/su-budget";

// Exemption lists are published per intake year, so we need the year they matriculated in. NUS's
// academic year starts in August; offer the current intake and the three before it (Y1-Y4).
function currentIntakeYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

function suggestedChip(m: SuggestedModule): ChosenModule {
  return {
    code: m.moduleCode,
    title: m.label.replace(m.moduleCode, "").trim() || null,
    verified: true,
    source: "suggested",
    mc: m.mc,
    kind: m.kind,
  };
}

const DEFAULT_FACULTY = "School of Computing";
const DEFAULT_PROGRAMME = "Bachelor of Computing in Computer Science";

export function OnboardingForm() {
  const router = useRouter();
  const [faculty, setFaculty] = useState(DEFAULT_FACULTY);
  const [programme, setProgramme] = useState(DEFAULT_PROGRAMME);

  const [hasDiploma, setHasDiploma] = useState(false);
  const [polytechnic, setPolytechnic] = useState("");
  const [diploma, setDiploma] = useState("");

  const intakeYears = useMemo(() => {
    const y = currentIntakeYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);
  const [matriculationYear, setMatriculationYear] = useState(() => currentIntakeYear());

  const [isOlympiad, setIsOlympiad] = useState(false);
  const [olympiadCategory, setOlympiadCategory] = useState("");
  const [tookH3, setTookH3] = useState(false);
  const [mathBackground, setMathBackground] = useState<MathBackground | "">("");
  const [onCampus, setOnCampus] = useState(false);
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [admissionType, setAdmissionType] = useState<AdmissionType>("FRESHMAN_SEM1");
  // S/U budget is worked out from the rest of the form; these cover what the form can't know, plus an override.
  const [priorUniversity, setPriorUniversity] = useState<PriorUniversity>("none");
  const [takesApcOption, setTakesApcOption] = useState(false);
  const [suOverride, setSuOverride] = useState<number | null>(null);
  // The one list of confirmed exemptions: suggestions the student has ticked plus anything they add by hand.
  const [confirmed, setConfirmed] = useState<ChosenModule[]>([]);
  // Suggested modules the student has taken out, so a refreshed suggestion doesn't put them back.
  const dismissed = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const programmesForFaculty = useMemo(
    () => nusFaculties.find((f) => f.name === faculty)?.programmes ?? [],
    [faculty]
  );

  const schoolsForPolytechnic = useMemo(
    () => polytechnics.find((p) => p.name === polytechnic)?.schools ?? [],
    [polytechnic]
  );

  const polySuggestions = useSuggestions(
    hasDiploma && polytechnic && diploma
      ? { matriculationYear, faculty, programme, qualification: "POLYTECHNIC", institution: polytechnic, credential: diploma }
      : null
  );
  // Medal categories come from the same API; the first call (no category yet) just lists them.
  const olympiadOptions = useSuggestions(
    isOlympiad ? { matriculationYear, faculty, programme, qualification: "OLYMPIAD" } : null
  );
  const olympiadSuggestions = useSuggestions(
    isOlympiad && olympiadCategory
      ? { matriculationYear, faculty, programme, qualification: "OLYMPIAD", credential: olympiadCategory }
      : null
  );
  const categories = useMemo(() => olympiadOptions.data?.options ?? [], [olympiadOptions.data]);
  useEffect(() => {
    if (isOlympiad && !categories.includes(olympiadCategory)) setOlympiadCategory("");
  }, [isOlympiad, categories, olympiadCategory]);

  // When suggestions change: automatic ones join the confirmed list (unless the student removed them) and
  // suggested ones that no longer apply (e.g. a different diploma) leave it. Optional ones wait to be ticked,
  // and anything the student added by hand is never touched.
  useEffect(() => {
    const current = [...(polySuggestions.data?.modules ?? []), ...(olympiadSuggestions.data?.modules ?? [])];
    const currentCodes = new Set(current.map((m) => m.moduleCode));
    setConfirmed((prev) => {
      const next = prev.filter((c) => c.source !== "suggested" || currentCodes.has(c.code));
      for (const m of current) {
        if (m.grant !== "AUTOMATIC" || dismissed.current.has(m.moduleCode)) continue;
        if (next.some((c) => c.code === m.moduleCode)) continue;
        next.push(suggestedChip(m));
      }
      return next;
    });
  }, [polySuggestions.data, olympiadSuggestions.data]);

  const picked = useMemo(() => Object.fromEntries(confirmed.map((c) => [c.code, true])), [confirmed]);

  // Total APCs drive the S/U scheme (20 or more changes it). A polytechnic diploma always carries the automatic 20
  // elective units, even where we hold no exemption list for their faculty.
  const { apcUnits, ueApcUnits } = totalApcUnits({
    polytechnicDiploma: hasDiploma,
    genericUeUnits: (polySuggestions.data?.generic ?? []).reduce((n, g) => n + g.mc, 0),
    modules: confirmed,
  });
  const suBudget = computeSuBudget({
    faculty,
    programme,
    matriculationYear,
    apcUnits,
    ueApcUnits,
    priorUniversity,
    takesApcOption,
  });
  const suBudgetTotalMc = suOverride ?? suBudget.total;

  /** Change the list, remembering which suggested modules the student took out. */
  function changeConfirmed(next: ChosenModule[]) {
    const kept = new Set(next.map((c) => c.code));
    for (const c of confirmed) if (c.source === "suggested" && !kept.has(c.code)) dismissed.current.add(c.code);
    setConfirmed(next);
  }

  function toggleSuggestion(m: SuggestedModule, on: boolean) {
    if (on) {
      dismissed.current.delete(m.moduleCode);
      if (!confirmed.some((c) => c.code === m.moduleCode)) setConfirmed([...confirmed, suggestedChip(m)]);
    } else {
      changeConfirmed(confirmed.filter((c) => c.code !== m.moduleCode));
    }
  }

  function handleFacultyChange(name: string) {
    setFaculty(name);
    const first = nusFaculties.find((f) => f.name === name)?.programmes[0];
    if (first) setProgramme(first);
  }

  function handlePolytechnicChange(name: string) {
    setPolytechnic(name);
    setDiploma(""); // diplomas differ by polytechnic, so the old choice no longer applies
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const exemptions = Array.from(new Set(confirmed.map((c) => c.code)));

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme: `${programme} (${faculty})`,
          priorDiploma: hasDiploma ? `${diploma}, ${polytechnic}` : "",
          suBudgetTotalMc,
          matriculationYear,
          mathBackground: mathBackground || undefined,
          exemptions,
          residentialCollege: collegeId,
          rcAdmissionType: collegeId ? admissionType : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/planner");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Faculty</span>
        <select
          value={faculty}
          onChange={(e) => handleFacultyChange(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {nusFaculties.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Programme</span>
        <select
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {programmesForFaculty.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text1">Year you started at NUS</span>
        <select
          value={matriculationYear}
          onChange={(e) => setMatriculationYear(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text0 outline-none focus-visible:border-accent"
        >
          {intakeYears.map((y) => (
            <option key={y} value={y}>
              AY{y}/{String((y + 1) % 100).padStart(2, "0")}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-text3">
          Faculties publish exemption lists per intake year, so we use this to find yours.
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hasDiploma}
          onChange={(e) => setHasDiploma(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-[13px] font-medium text-text1">
          I have a diploma from a Polytechnic
        </span>
      </label>

      {hasDiploma && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-page p-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text1">
              Polytechnic
            </span>
            <select
              value={polytechnic}
              onChange={(e) => handlePolytechnicChange(e.target.value)}
              required
              className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent ${
                polytechnic ? "text-text0" : "text-text3"
              }`}
            >
              <option value="" disabled>
                Select your polytechnic…
              </option>
              {polytechnics.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text1">
              Diploma course
            </span>
            <select
              value={diploma}
              onChange={(e) => setDiploma(e.target.value)}
              required
              disabled={!polytechnic}
              className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent disabled:opacity-60 ${
                diploma ? "text-text0" : "text-text3"
              }`}
            >
              <option value="" disabled>
                {polytechnic ? "Select your diploma course…" : "Choose a polytechnic first"}
              </option>
              {schoolsForPolytechnic.map((s) => (
                <optgroup key={s.school} label={s.school}>
                  {s.diplomas.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      )}

      {hasDiploma && !(polytechnic && diploma) && (
        <p className="text-[12px] text-text3">Choose your polytechnic and diploma course to see suggested exemptions.</p>
      )}

      {hasDiploma && polytechnic && diploma && (
        <SuggestionList
          title="Suggested exemptions for your diploma"
          data={polySuggestions.data}
          loading={polySuggestions.loading}
          error={polySuggestions.error}
          picked={picked}
          onToggle={toggleSuggestion}
          emptyHint="You can still add exemptions from your Transfer Credit Report below."
        />
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isOlympiad}
          onChange={(e) => setIsOlympiad(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-[13px] font-medium text-text1">I&apos;m an olympiad medallist</span>
      </label>

      {isOlympiad && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-page p-3">
          {olympiadOptions.loading ? (
            <p className="text-[12px] text-text3">Looking up medal categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-[12px] text-text3">
              We don&apos;t hold a published olympiad exemption list for your faculty and intake year yet. Add anything
              you&apos;ve been credited with below.
            </p>
          ) : (
            // Categories are published as full sentences (one names eight countries), which a native
            // <select> can't wrap or show in full, so they're a radio list whose labels wrap.
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-medium text-text1">Medal category</legend>
              {categories.map((c) => (
                <label key={c} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="olympiad-category"
                    value={c}
                    checked={olympiadCategory === c}
                    onChange={() => setOlympiadCategory(c)}
                    className="mt-0.5 h-4 w-4 border-border"
                  />
                  <span className="text-[13px] leading-snug text-text1">{c}</span>
                </label>
              ))}
            </fieldset>
          )}
          {olympiadCategory && (
            <SuggestionList
              title="Olympiad exemptions"
              data={olympiadSuggestions.data}
              loading={olympiadSuggestions.loading}
              error={olympiadSuggestions.error}
              picked={picked}
              onToggle={toggleSuggestion}
              emptyHint=""
            />
          )}
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={tookH3}
          onChange={(e) => setTookH3(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-[13px] font-medium text-text1">I took a H3 subject in JC</span>
      </label>

      {tookH3 && <H3Guidance />}

      <MathBackgroundField value={mathBackground} onChange={setMathBackground} polytechnic={hasDiploma ? polytechnic : ""} />

      <ResidentialCollegeField
        onCampus={onCampus}
        onOnCampusChange={setOnCampus}
        collegeId={collegeId}
        onCollegeChange={setCollegeId}
        admissionType={admissionType}
        onAdmissionTypeChange={setAdmissionType}
        matriculationYear={matriculationYear}
        faculty={faculty}
      />

      <SuBudgetCard
        budget={suBudget}
        apcUnits={apcUnits}
        override={suOverride}
        onOverride={setSuOverride}
        priorUniversity={priorUniversity}
        onPriorUniversity={setPriorUniversity}
        takesApcOption={takesApcOption}
        onTakesApcOption={setTakesApcOption}
        polytechnic={hasDiploma}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmed-modules" className="text-[13px] font-medium text-text1">
          Confirmed exemptions{confirmed.length > 0 ? ` (${confirmed.length})` : " (optional)"}
        </label>
        <ModuleCodeInput
          id="confirmed-modules"
          value={confirmed}
          onChange={changeConfirmed}
          placeholder={confirmed.length > 0 ? "Add another module, e.g. MA1301" : "e.g. MA1301 or CS1010"}
        />
        <span className="text-[12px] text-text3">
          Everything you tick above is listed here. Add any others from your Transfer Credit Report by module code, or
          paste a whole list. Leave blank if you don&apos;t have any yet — you can add these later.
        </span>
      </div>

      {error && <p className="text-[13px] text-red">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

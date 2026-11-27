"use client";

import { useEffect, useState } from "react";

export type SuggestedModule = {
  moduleCode: string;
  label: string;
  mc: number;
  kind: "PROGRAMME" | "UNRESTRICTED_ELECTIVE";
  grant: "AUTOMATIC" | "OPT_IN";
  notes: string[];
};

export type SuggestResponse = {
  academicYear: string;
  coverage: "none" | "unlisted" | "matched";
  modules: SuggestedModule[];
  generic: { label: string; mc: number; notes: string[] }[];
  sources: string[];
  options: string[];
};

export type SuggestParams = {
  matriculationYear: number;
  faculty: string;
  programme: string;
  qualification: "POLYTECHNIC" | "OLYMPIAD";
  institution?: string;
  credential?: string;
};

/** Fetch suggestions for the given selection; pass null to clear. Re-runs whenever the selection changes. */
export function useSuggestions(params: SuggestParams | null) {
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = params ? JSON.stringify(params) : null;
  useEffect(() => {
    if (!key) {
      setData(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams(
      Object.entries(JSON.parse(key) as SuggestParams).map(([k, v]) => [k, String(v)])
    );
    setLoading(true);
    setError(null);
    fetch(`/api/exemptions/suggest?${qs}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Couldn't look up exemptions.");
        setData(body as SuggestResponse);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setData(null);
        setError(e instanceof Error ? e.message : "Couldn't look up exemptions.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key]);

  return { data, loading, error };
}

/** Notes carried by every module in the list (e.g. "optional exemption; you must make up the units"). Shown once, not per row. */
function sharedNotes(modules: SuggestedModule[]): string[] {
  if (modules.length < 2) return [];
  return modules[0].notes.filter((n) => modules.every((m) => m.notes.includes(n)));
}

export function SuggestionList({
  title,
  data,
  loading,
  error,
  picked,
  onToggle,
  emptyHint,
}: {
  title: string;
  data: SuggestResponse | null;
  loading: boolean;
  error: string | null;
  picked: Record<string, boolean>;
  onToggle: (module: SuggestedModule, on: boolean) => void;
  emptyHint: string;
}) {
  const shared = data ? sharedNotes(data.modules) : [];
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-text1">{title}</span>
        {data && <span className="shrink-0 whitespace-nowrap text-[11px] text-text3">AY{data.academicYear.replace("-", "/")} intake</span>}
      </div>

      {loading && <p className="text-[12px] text-text3">Looking up published exemption lists…</p>}
      {error && <p className="text-[12px] text-red">{error}</p>}

      {!loading && !error && data?.coverage === "none" && (
        <p className="text-[12px] text-text3">
          We don&apos;t hold a published list for this faculty and intake year yet. {emptyHint}
        </p>
      )}
      {!loading && !error && data?.coverage === "unlisted" && (
        <p className="text-[12px] text-text3">
          Nothing is listed for this one. It may not be an accredited diploma for your programme. {emptyHint}
        </p>
      )}

      {!loading && data && data.modules.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {data.modules.map((m) => (
            <li key={m.moduleCode}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!picked[m.moduleCode]}
                  onChange={(e) => onToggle(m, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span className="text-[13px] text-text1">
                  <span className="font-semibold">{m.moduleCode}</span>{" "}
                  <span className="text-text2">
                    {m.label.replace(m.moduleCode, "").trim() || ""} · {m.mc} MC
                  </span>
                  {m.grant === "OPT_IN" && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-border bg-amber-bg px-1.5 py-0.5 align-middle text-[10.5px] font-semibold text-amber">
                      optional
                    </span>
                  )}
                  {m.notes.filter((n) => !shared.includes(n)).length > 0 && (
                    <span className="block text-[11.5px] text-text3">
                      {m.notes.filter((n) => !shared.includes(n)).join(" ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {!loading && shared.length > 0 && <p className="text-[11.5px] leading-snug text-text3">{shared.join(" ")}</p>}

      {!loading && data && data.generic.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-2">
          {data.generic.map((g) => (
            <li key={`${g.label}-${g.mc}`} className="text-[12px] text-text2">
              + {g.mc} MC · {g.label}
              {g.notes.length > 0 && <span className="block text-[11.5px] text-text3">{g.notes.join(" ")}</span>}
            </li>
          ))}
        </ul>
      )}

      {data && data.coverage === "matched" && (
        <p className="text-[11.5px] leading-snug text-text3">
          From your faculty&apos;s published lists. Your Transfer Credit Report (EduRec → Academic → Academic Records)
          is the final word, so untick anything that isn&apos;t on it.{" "}
          {data.sources.slice(0, 2).map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="underline">
              source{data.sources.length > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * H3 credit isn't a lookup: it follows the specific course a student took, and the Registrar invites
 * them to apply at admission (per NUS's "FAQ on H3 APC"). So there's nothing to suggest, only the rules to explain.
 */
export function H3Guidance() {
  const rows: [string, string][] = [
    ["An NUS-taught H3 course (grade D or better).", "APCs for that course, with your NUS grade transferred."],
    [
      "A H3 subject at NTU, SMU or A*STAR (a pass).",
      "APCs if it meets NUS's minimum criteria for that subject, with no grade transfer.",
    ],
    ["H3 subjects set by MOE.", "Not eligible."],
  ];
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-page p-3">
      <span className="text-[13px] font-medium text-text1">How H3 credit works</span>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([who, what]) => (
          <li key={who} className="text-[12.5px] leading-snug text-text2">
            <span className="font-semibold text-text1">{who}</span> {what}
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] leading-snug text-text3">
        There&apos;s no fixed list to look up, because credit follows the course you took. The Registrar emails you an
        invitation to apply when you&apos;re admitted; you can&apos;t apply later, and can&apos;t withdraw once you do.
        A transferred grade counts toward your GPA unless you change it to S in the S/U exercise at the end of Semester
        1 (if your faculty allows). Add the module code(s) from your Transfer Credit Report in the box below.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import {
  CODE_RE,
  MIN_QUERY_LENGTH,
  parseCatalogQuery,
  parseCodeList,
  type CatalogHit,
} from "@/lib/modules/catalog-search";

export type ChosenModule = {
  code: string;
  title: string | null;
  /** false when the code isn't in our module list and the student chose to add it anyway */
  verified: boolean;
  /** where it came from: ticked from a faculty-list suggestion, or added by the student by hand */
  source: "suggested" | "manual";
  /** module credits, used to total the student's APCs (e.g. for their S/U budget); null when unknown */
  mc: number | null;
  /** elective credit vs a programme-requirement exemption, when a faculty list said so */
  kind: "PROGRAMME" | "UNRESTRICTED_ELECTIVE" | null;
};

/**
 * Pick module codes from the module catalog instead of typing a comma-separated list: suggestions appear
 * from 3 characters ("cs1", "1301", "ma 1301"), chips show what's been added, and anything not in the
 * catalog is flagged rather than silently accepted. Pasting a list ("CS1010, MA1301 ...") adds them all.
 */
export function ModuleCodeInput({
  id,
  value,
  onChange,
  placeholder = "e.g. MA1301 or CS1010",
}: {
  id?: string;
  /** the whole list: chips for every module already chosen, wherever it came from */
  value: ChosenModule[];
  onChange: (next: ChosenModule[]) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [results, setResults] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [unknown, setUnknown] = useState<string[]>([]);

  const taken = (code: string) => value.some((v) => v.code === code);
  const visible = results.filter((r) => !taken(r.code));
  const query = parseCatalogQuery(text);
  const tooShort = text.replace(/[^A-Za-z0-9]/g, "").length > 0 && query.kind === "none" && !/^\d{5,}$/.test(text.trim());

  useEffect(() => {
    if (parseCatalogQuery(text).kind === "none") {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/modules/catalog?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(res.ok ? ((data.results ?? []) as CatalogHit[]) : []);
        setHighlighted(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  function addOne(hit: Pick<CatalogHit, "code" | "title" | "mc">, verified: boolean) {
    if (taken(hit.code)) return;
    onChange([...value, { code: hit.code, title: verified ? hit.title : null, verified, source: "manual", mc: verified ? hit.mc : null, kind: null }]);
    setText("");
    setResults([]);
    setOpen(false);
    setUnknown([]);
  }

  /** Look up one or many typed/pasted codes and add the ones that exist; flag the rest. */
  async function commitTokens(raw: string) {
    const tokens = parseCodeList(raw).filter((t) => !taken(t));
    if (tokens.length === 0) return;
    try {
      const res = await fetch(`/api/modules/catalog?codes=${encodeURIComponent(tokens.join(","))}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      const found = (data.found ?? []) as CatalogHit[];
      const missing = ((data.unknown ?? []) as string[]).filter((t) => /\d/.test(t)); // ignore stray words like "and"
      if (found.length > 0) {
        onChange([...value, ...found.map((f) => ({ code: f.code, title: f.title, verified: true, source: "manual" as const, mc: f.mc, kind: null }))]);
        setText("");
      } else {
        setText(tokens.join(" ")); // keep what they typed (minus the separator) so a typo can be fixed in place
      }
      setResults([]);
      setOpen(false);
      setUnknown(missing);
    } catch {
      setUnknown(tokens);
    }
  }

  function addUnverified() {
    const additions = unknown.filter((u) => CODE_RE.test(u) && !taken(u)).map((code) => ({ code, title: null, verified: false, source: "manual" as const, mc: null, kind: null }));
    if (additions.length > 0) onChange([...value, ...additions]);
    setUnknown([]);
    setText("");
  }

  // The red "isn't in our module list" notice already says this once a code has been committed, and the popup would sit on top of it.
  const showEmpty = open && !loading && query.kind !== "none" && visible.length === 0 && unknown.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m) => (
            <span
              key={m.code}
              title={m.verified ? (m.title ?? undefined) : "Not in our module list: double-check this code"}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                m.verified
                  ? "border-green-border bg-green-bg text-green"
                  : "border-amber-border bg-amber-bg text-amber"
              }`}
            >
              {m.code}
              {!m.verified && <span aria-hidden>?</span>}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.code !== m.code))}
                aria-label={`Remove ${m.code}`}
                className="opacity-60 transition-opacity hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            // A separator typed, pasted or inserted by a phone keyboard commits what's before it. Checked on the
            // value rather than on keydown because virtual keyboards often don't report which key was pressed.
            if (/[,;\n]/.test(next)) {
              void commitTokens(next);
              return;
            }
            setText(next);
            setUnknown([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && visible.length > 0) {
              e.preventDefault();
              setOpen(true);
              setHighlighted((i) => Math.min(i + 1, visible.length - 1));
            } else if (e.key === "ArrowUp" && visible.length > 0) {
              e.preventDefault();
              setHighlighted((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault(); // never submit the whole form from here
              if (open && visible[highlighted]) addOne(visible[highlighted], true);
              else if (text.trim()) void commitTokens(text);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && text === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (parseCodeList(pasted).length >= 2 || /[,;\n]/.test(pasted)) {
              e.preventDefault();
              void commitTokens(pasted);
            }
          }}
          onFocus={() => {
            if (visible.length > 0) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[highlighted] ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase text-text0 outline-none placeholder:normal-case focus-visible:border-accent"
        />

        {open && visible.length > 0 && (
          <div
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 w-full animate-fade-slide-in overflow-hidden rounded-lg border border-border bg-surface shadow-md"
          >
            {visible.map((r, i) => (
              <button
                key={r.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlighted}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => addOne(r, true)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] transition-colors duration-100 ${
                  i === highlighted ? "bg-seg-bg" : "hover:bg-seg-bg"
                }`}
              >
                <span className="shrink-0 font-semibold text-text1">{r.code}</span>
                <span className="min-w-0 flex-1 truncate text-text3">{r.title}</span>
                {r.mc !== null && <span className="shrink-0 text-[11.5px] text-text3">{r.mc} MC</span>}
              </button>
            ))}
          </div>
        )}

        {showEmpty && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-text3 shadow-md">
            No module matches &ldquo;{text.trim()}&rdquo;.
          </div>
        )}
      </div>

      {tooShort && <p className="text-[12px] text-text3">Keep typing: suggestions start at {MIN_QUERY_LENGTH} characters.</p>}

      {unknown.length > 0 && (
        <p className="text-[12px] text-red">
          {unknown.join(", ")} {unknown.length === 1 ? "isn't" : "aren't"} in our module list.{" "}
          {unknown.some((u) => CODE_RE.test(u)) && (
            <button type="button" onClick={addUnverified} className="font-semibold underline">
              Add anyway
            </button>
          )}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Layout = "vertical" | "horizontal";

type ResolvedLesson = {
  moduleCode: string;
  moduleTitle: string;
  lessonType: string;
  classNo: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  weeks: number[] | { weekInterval?: number };
};

type SavedSlot = {
  academicYear: number;
  semester: number;
  shareUrl: string;
  updatedAt: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Half-hour grid from 8am to 10pm, matching the usual NUS teaching hours.
const START_MIN = 8 * 60;
const END_MIN = 22 * 60;
const PX_PER_MIN = 1.1;

// The same Year 1-4 / Semester 1-2 slots the planner's own semester grid
// uses, so a saved timetable lines up with the plan it belongs to.
const SLOTS: { academicYear: number; semester: number }[] = [1, 2, 3, 4].flatMap((year) =>
  [1, 2].map((sem) => ({ academicYear: year, semester: sem }))
);

function slotKey(academicYear: number, semester: number): string {
  return `${academicYear}-${semester}`;
}

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2));
}

function describeWeeksClient(weeks: ResolvedLesson["weeks"]): string {
  if (Array.isArray(weeks)) {
    if (weeks.length >= 12) return "Every week";
    const allOdd = weeks.every((w) => w % 2 === 1);
    const allEven = weeks.every((w) => w % 2 === 0);
    if (allOdd && weeks.length > 1) return "Odd weeks";
    if (allEven && weeks.length > 1) return "Even weeks";
    return `Weeks ${weeks.join(", ")}`;
  }
  return weeks.weekInterval === 2 ? "Alternating weeks" : "Every week";
}

const LESSON_COLORS: Record<string, string> = {};
const PALETTE = [
  "bg-sky-50 border-sky-200 text-sky-900",
  "bg-violet-50 border-violet-200 text-violet-900",
  "bg-emerald-50 border-emerald-200 text-emerald-900",
  "bg-amber-50 border-amber-200 text-amber-900",
  "bg-rose-50 border-rose-200 text-rose-900",
  "bg-cyan-50 border-cyan-200 text-cyan-900",
];

function colorFor(moduleCode: string): string {
  if (!LESSON_COLORS[moduleCode]) {
    const used = Object.keys(LESSON_COLORS).length;
    LESSON_COLORS[moduleCode] = PALETTE[used % PALETTE.length];
  }
  return LESSON_COLORS[moduleCode];
}

export function TimetablePanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [lessons, setLessons] = useState<ResolvedLesson[] | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout>("vertical");

  const [savedBySlot, setSavedBySlot] = useState<Record<string, SavedSlot>>({});
  const [selectedSlot, setSelectedSlot] = useState<{ academicYear: number; semester: number } | null>(
    null
  );
  const [savingSlot, setSavingSlot] = useState<{ academicYear: number; semester: number } | null>(
    null
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  async function load(rawUrl: string) {
    setLoading(true);
    setError(null);
    setProblems([]);
    setSaveState("idle");
    try {
      const res = await fetch("/api/timetable/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load that timetable.");
        setLessons(null);
        return;
      }
      setLessons(data.lessons);
      setSemester(data.semester);
      setProblems(data.problems ?? []);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // On first load, fetch whichever slots this user has already saved, and
  // auto-show the most recently saved one so the page isn't blank by
  // default.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/timetable/saved");
        if (!res.ok) return;
        const data = (await res.json()) as { saved: SavedSlot[] };
        const bySlot: Record<string, SavedSlot> = {};
        for (const s of data.saved) bySlot[slotKey(s.academicYear, s.semester)] = s;
        setSavedBySlot(bySlot);

        if (data.saved.length > 0) {
          const mostRecent = data.saved[0]; // API already orders by updatedAt desc
          setSelectedSlot({ academicYear: mostRecent.academicYear, semester: mostRecent.semester });
          setUrl(mostRecent.shareUrl);
          await load(mostRecent.shareUrl);
        }
      } catch {
        // Best-effort - the page still works for a fresh paste either way.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSlot(academicYear: number, semester: number) {
    setSelectedSlot({ academicYear, semester });
    const existing = savedBySlot[slotKey(academicYear, semester)];
    if (existing) {
      setUrl(existing.shareUrl);
      load(existing.shareUrl);
    } else {
      setUrl("");
      setLessons(null);
      setError(null);
      setProblems([]);
      setSaveState("idle");
    }
  }

  async function saveTimetable(academicYear: number, semester: number) {
    setSavingSlot({ academicYear, semester });
    setSaveState("saving");
    try {
      const res = await fetch("/api/timetable/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear, semester, shareUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveState("idle");
        return;
      }
      setSavedBySlot((prev) => ({ ...prev, [slotKey(academicYear, semester)]: data }));
      setSelectedSlot({ academicYear, semester });
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    } finally {
      setSavingSlot(null);
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, ResolvedLesson[]>();
    for (const day of DAYS) map.set(day, []);
    for (const lesson of lessons ?? []) {
      if (!map.has(lesson.day)) continue;
      map.get(lesson.day)!.push(lesson);
    }
    return map;
  }, [lessons]);

  const gridHeight = (END_MIN - START_MIN) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let m = START_MIN; m <= END_MIN; m += 60) hourMarks.push(m);

  // Show the save prompt whenever a timetable is loaded and it doesn't
  // already exactly match what's saved for the currently selected slot -
  // saving is always a deliberate click, never automatic.
  const matchesSavedSelectedSlot =
    selectedSlot &&
    savedBySlot[slotKey(selectedSlot.academicYear, selectedSlot.semester)]?.shareUrl === url;
  const showSavePrompt = Boolean(lessons && lessons.length > 0 && !matchesSavedSelectedSlot);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-text1">Timetable</h1>
          <p className="mt-0.5 text-[13px] text-text3">
            Paste your NUSMods Share/Sync link to see your actual class
            schedule here.
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
        <div className="max-w-2xl">
          <div className="text-[12px] font-semibold text-text2">Saved timetables</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SLOTS.map((slot) => {
              const key = slotKey(slot.academicYear, slot.semester);
              const isSaved = Boolean(savedBySlot[key]);
              const isSelected =
                selectedSlot?.academicYear === slot.academicYear &&
                selectedSlot?.semester === slot.semester;
              return (
                <button
                  key={key}
                  onClick={() => selectSlot(slot.academicYear, slot.semester)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 ${
                    isSelected
                      ? "border-accent bg-accent text-white"
                      : isSaved
                        ? "border-border bg-seg-bg text-text1 hover:bg-border"
                        : "border-dashed border-border text-text3 hover:text-text2"
                  }`}
                >
                  Year {slot.academicYear} · Sem {slot.semester}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex max-w-2xl gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              selectedSlot
                ? `Paste your NUSMods link for Year ${selectedSlot.academicYear} Sem ${selectedSlot.semester}`
                : "https://nusmods.com/timetable/sem-1/share?CS1010S=LEC:1,TUT:3&..."
            }
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text1 outline-none focus:border-accent"
          />
          <button
            onClick={() => load(url)}
            disabled={loading || !url.trim()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-text3">
          On nusmods.com, open your timetable and use the Share/Sync button to
          copy this link - nothing is uploaded, it&rsquo;s just read here.
        </p>

        {error ? (
          <div className="mt-3 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}
        {problems.length > 0 ? (
          <div className="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
            {problems.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
        ) : null}

        {showSavePrompt ? (
          <div className="mt-3 flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-border bg-seg-bg px-3 py-2 text-[12.5px] text-text2">
            <span>Save this timetable for future reference?</span>
            <div className="flex flex-wrap gap-1">
              {SLOTS.map((slot) => {
                const key = slotKey(slot.academicYear, slot.semester);
                const isTarget =
                  savingSlot?.academicYear === slot.academicYear &&
                  savingSlot?.semester === slot.semester;
                return (
                  <button
                    key={key}
                    onClick={() => saveTimetable(slot.academicYear, slot.semester)}
                    disabled={saveState === "saving"}
                    className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-text1 transition-colors duration-150 hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    {isTarget && saveState === "saving" ? "Saving…" : `Y${slot.academicYear} S${slot.semester}`}
                  </button>
                );
              })}
            </div>
          </div>
        ) : saveState === "saved" && selectedSlot ? (
          <div className="mt-3 max-w-2xl rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
            Saved to Year {selectedSlot.academicYear} · Sem {selectedSlot.semester}.
          </div>
        ) : null}

        {lessons && lessons.length > 0 ? (
          <div className="mt-6 animate-fade-slide-in">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-text1">
                Semester {semester}
              </div>
              <div className="inline-flex w-fit gap-0.5 rounded-lg border border-border bg-surface p-0.5">
                {(["vertical", "horizontal"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLayout(l)}
                    className={`rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors duration-150 ${
                      layout === l ? "bg-accent text-white" : "text-text2 hover:text-text1"
                    }`}
                  >
                    {l === "vertical" ? "Vertical" : "Horizontal"}
                  </button>
                ))}
              </div>
            </div>

            {layout === "vertical" ? (
              <div className="flex w-full rounded-xl border border-border bg-surface">
                <div className="w-14 shrink-0 border-r border-border">
                  <div className="h-8 border-b border-border" />
                  <div className="relative" style={{ height: gridHeight }}>
                    {hourMarks.map((m) => (
                      <div
                        key={m}
                        className="absolute right-1.5 -translate-y-1/2 text-[10.5px] text-text3"
                        style={{ top: (m - START_MIN) * PX_PER_MIN }}
                      >
                        {String(Math.floor(m / 60)).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                </div>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="min-w-0 flex-1 border-r border-border last:border-r-0"
                  >
                    <div className="flex h-8 items-center justify-center border-b border-border text-[12px] font-semibold text-text2">
                      {day.slice(0, 3)}
                    </div>
                    <div className="relative" style={{ height: gridHeight }}>
                      {hourMarks.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-border/60"
                          style={{ top: (m - START_MIN) * PX_PER_MIN }}
                        />
                      ))}
                      {(byDay.get(day) ?? []).map((lesson, i) => {
                        const top = (toMinutes(lesson.startTime) - START_MIN) * PX_PER_MIN;
                        const height =
                          (toMinutes(lesson.endTime) - toMinutes(lesson.startTime)) * PX_PER_MIN;
                        return (
                          <div
                            key={`${lesson.moduleCode}-${lesson.lessonType}-${lesson.classNo}-${i}`}
                            className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[10.5px] leading-tight ${colorFor(
                              lesson.moduleCode
                            )}`}
                            style={{ top, height: Math.max(height, 20) }}
                            title={`${lesson.moduleCode} ${lesson.lessonType} [${lesson.classNo}] - ${lesson.venue} - ${describeWeeksClient(
                              lesson.weeks
                            )}`}
                          >
                            <div className="font-semibold">{lesson.moduleCode}</div>
                            <div className="truncate">
                              {lesson.lessonType} · {lesson.venue}
                            </div>
                            <div className="truncate opacity-70">
                              {describeWeeksClient(lesson.weeks)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex border-b border-border">
                  <div className="w-16 shrink-0 border-r border-border" />
                  <div className="relative h-8 flex-1">
                    {hourMarks.map((m) => (
                      <div
                        key={m}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10.5px] text-text3"
                        style={{ left: `${((m - START_MIN) / (END_MIN - START_MIN)) * 100}%` }}
                      >
                        {String(Math.floor(m / 60)).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="flex border-b border-border last:border-b-0">
                    <div className="flex w-16 shrink-0 items-center border-r border-border px-2 text-[12px] font-semibold text-text2">
                      {day.slice(0, 3)}
                    </div>
                    <div className="relative flex-1" style={{ height: 68 }}>
                      {hourMarks.map((m) => (
                        <div
                          key={m}
                          className="absolute top-0 bottom-0 border-l border-border/60"
                          style={{ left: `${((m - START_MIN) / (END_MIN - START_MIN)) * 100}%` }}
                        />
                      ))}
                      {(byDay.get(day) ?? []).map((lesson, i) => {
                        const left =
                          ((toMinutes(lesson.startTime) - START_MIN) / (END_MIN - START_MIN)) * 100;
                        const width =
                          ((toMinutes(lesson.endTime) - toMinutes(lesson.startTime)) /
                            (END_MIN - START_MIN)) *
                          100;
                        return (
                          <div
                            key={`${lesson.moduleCode}-${lesson.lessonType}-${lesson.classNo}-${i}`}
                            className={`absolute top-1 bottom-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-[10.5px] leading-tight ${colorFor(
                              lesson.moduleCode
                            )}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${lesson.moduleCode} ${lesson.lessonType} [${lesson.classNo}] - ${lesson.venue} - ${describeWeeksClient(
                              lesson.weeks
                            )}`}
                          >
                            <div className="truncate font-semibold">
                              {lesson.moduleCode} · {lesson.lessonType}
                            </div>
                            <div className="truncate opacity-80">{lesson.venue}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

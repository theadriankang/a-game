// A module's status in the plan isn't something the student picks: it follows from where they put it.
//   - in a semester that is over            -> done
//   - in the semester they're in right now  -> in progress
//   - in a later semester                   -> planned
//   - in the Reserved bin (no semester yet) -> reserved
// Only "reserved" is stored (PlannerEntry.status = RESERVED, slot 0/0). Everything else is worked out from the
// date every time the plan is read, so a module moves from planned to in progress to done by itself as the
// semesters go by, with nothing to keep in sync.

export type StoredStatus = "COMPLETED" | "PLANNED" | "RESERVED";

/** Where a slot sits relative to today. */
export type TermPhase = "past" | "current" | "future";

/** What a module on the plan shows as. */
export type EntryPhase = TermPhase | "reserved";

/**
 * Where the student is in their degree. `index` counts semesters from the start of Year 1 Sem 1 (= 1), and may
 * be zero or negative before they've started. `inProgress` is false between semesters (the June-July break):
 * then `index` is the semester that just finished.
 */
export type CurrentTerm = { index: number; inProgress: boolean };

const SINGAPORE = "Asia/Singapore";

/** The calendar date in Singapore, since that's the clock NUS's semesters run on (servers usually run on UTC). */
function singaporeDate(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SINGAPORE, year: "numeric", month: "numeric" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

/** Position of a planner slot in `CurrentTerm.index` terms. Year 1 Sem 1 is 1; the exemption slot (0/0) is -2. */
export function termIndex(academicYear: number, semester: number): number {
  return (academicYear - 1) * 2 + semester;
}

/**
 * The semester the student is in on `now`, or null when we can't tell (accounts from before the matriculation
 * year was collected), in which case nothing is treated as done or in progress.
 *
 * The academic year starts in August: Aug-Dec is Sem 1, Jan-May is Sem 2, and June-July is the break between
 * them. That's a calendar approximation, not the Registrar's exact dates, which is plenty to say which side of
 * "now" a semester falls on.
 */
export function currentTerm(matriculationYear: number | null | undefined, now: Date = new Date()): CurrentTerm | null {
  if (matriculationYear == null) return null;
  const { year, month } = singaporeDate(now);
  const yearsIn = (month >= 8 ? year : year - 1) - matriculationYear;
  if (month >= 8) return { index: yearsIn * 2 + 1, inProgress: true };
  if (month <= 5) return { index: yearsIn * 2 + 2, inProgress: true };
  return { index: yearsIn * 2 + 2, inProgress: false };
}

export function termPhase(academicYear: number, semester: number, current: CurrentTerm | null): TermPhase {
  // The exemption slot holds credit already granted.
  if (academicYear < 1) return "past";
  if (!current) return "future";
  const index = termIndex(academicYear, semester);
  if (index < current.index) return "past";
  if (index === current.index) return current.inProgress ? "current" : "past";
  return "future";
}

/**
 * True when `lockedIndices` (User.lockedSemesterIndices, set in Settings) marks this semester as already done
 * and not to be touched - independent of `currentTerm`'s calendar guess, since that's exactly the point: this
 * is what the student confirmed by hand, for when the calendar guess is wrong (gap semester, exchange,
 * deferred intake). The exemption/Reserved slot (academicYear 0) is never locked.
 */
export function isTermLocked(
  academicYear: number,
  semester: number,
  lockedIndices: number[] | null | undefined
): boolean {
  if (academicYear < 1) return false;
  if (!lockedIndices || lockedIndices.length === 0) return false;
  return lockedIndices.includes(termIndex(academicYear, semester));
}

type Placed = { status: StoredStatus; academicYear: number; semester: number };

export function entryPhase(entry: Placed, current: CurrentTerm | null): EntryPhase {
  if (entry.status === "RESERVED") return "reserved";
  return termPhase(entry.academicYear, entry.semester, current);
}

/**
 * The same entries with `status` replaced by what the placement says, for everything that counts progress
 * (degree buckets, minors, prerequisites). The semester in progress counts as planned: it isn't finished yet.
 */
export function withDerivedStatus<T extends Placed>(entries: T[], current: CurrentTerm | null): T[] {
  return entries.map((entry) => {
    const phase = entryPhase(entry, current);
    const status: StoredStatus = phase === "reserved" ? "RESERVED" : phase === "past" ? "COMPLETED" : "PLANNED";
    return status === entry.status ? entry : { ...entry, status };
  });
}

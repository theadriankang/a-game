// Parses an NUSMods "share timetable" link
// (https://nusmods.com/timetable/sem-<N>/share?MODULE=TYPE:classNo,...)
// into the semester number and the specific lesson selections it encodes,
// so we can fetch exactly those lessons from the NUSMods API and render
// them as a read-only timetable. This does not need an NUSMods API key or
// scraping — it is just decoding the same query string NUSMods itself
// builds when a student clicks "Share/Sync" on their timetable.

// Maps NUSMods' short lesson-type codes (used in share-link query values)
// to the full lesson-type names the API itself returns in `timetable[].lessonType`.
// Source: NUSMods frontend's LESSON_TYPE_ABBREV table.
const LESSON_ABBREV_TO_TYPE: Record<string, string> = {
  DLEC: "Design Lecture",
  LAB: "Laboratory",
  LEC: "Lecture",
  PLEC: "Packaged Lecture",
  PTUT: "Packaged Tutorial",
  REC: "Recitation",
  SEC: "Sectional Teaching",
  SEM: "Seminar-Style Module Class",
  TUT: "Tutorial",
  TUT2: "Tutorial Type 2",
  TUT3: "Tutorial Type 3",
  WS: "Workshop",
};

export type ParsedTimetableLink = {
  semester: number;
  // moduleCode -> lessonType (full name) -> classNo
  selections: Record<string, Record<string, string>>;
};

export function parseNusmodsShareLink(rawUrl: string): ParsedTimetableLink {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error(
      "That doesn't look like a URL. Copy the link from NUSMods' Share/Sync button."
    );
  }

  if (!/nusmods\.com$/i.test(url.hostname)) {
    throw new Error("That link isn't from nusmods.com.");
  }

  const semMatch = url.pathname.match(/\/timetable\/sem-(\d+)/i);
  if (!semMatch) {
    throw new Error(
      "Couldn't find a semester in that link (expected something like /timetable/sem-1/share?...)."
    );
  }
  const semester = Number(semMatch[1]);

  const selections: Record<string, Record<string, string>> = {};
  for (const [key, value] of url.searchParams.entries()) {
    // NUSMods module codes are uppercase letters/digits (e.g. CS1010S);
    // other query params (if any get added later) are skipped rather than
    // misread as a module.
    if (!/^[A-Z]{2,4}\d{4}[A-Z]?$/i.test(key)) continue;
    const moduleCode = key.toUpperCase();
    const lessonSelections: Record<string, string> = {};
    for (const part of value.split(",")) {
      const [abbrev, classNo] = part.split(":");
      if (!abbrev || !classNo) continue;
      const lessonType = LESSON_ABBREV_TO_TYPE[abbrev.toUpperCase()];
      if (!lessonType) continue;
      lessonSelections[lessonType] = classNo;
    }
    if (Object.keys(lessonSelections).length > 0) {
      selections[moduleCode] = lessonSelections;
    }
  }

  if (Object.keys(selections).length === 0) {
    throw new Error(
      "Couldn't find any modules in that link. Make sure you copied the full URL, including everything after the \"?\"."
    );
  }

  return { semester, selections };
}

// A lesson's `weeks` field is either a flat number array or a {start,end,
// weekInterval} range. This reduces either shape to a short display label:
// "Every week", "Odd weeks", "Even weeks", or a literal week list as a
// fallback for anything less regular.
export function describeWeeks(weeks: number[] | { weekInterval?: number }): string {
  if (Array.isArray(weeks)) {
    if (weeks.length >= 12) return "Every week";
    const allOdd = weeks.every((w) => w % 2 === 1);
    const allEven = weeks.every((w) => w % 2 === 0);
    if (allOdd && weeks.length > 1) return "Odd weeks";
    if (allEven && weeks.length > 1) return "Even weeks";
    return `Weeks ${weeks.join(", ")}`;
  }
  if (weeks.weekInterval === 2) return "Alternating weeks";
  return "Every week";
}

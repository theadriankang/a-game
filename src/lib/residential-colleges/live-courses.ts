import { getModuleList, NUSMODS_ACAD_YEAR, type ModuleCondensed } from "@/lib/nusmods";

export type LiveCourseSuggestion = { moduleCode: string; title: string };

export type LiveCourseGroup = {
  label: string;
  suggestions: LiveCourseSuggestion[];
};

// Titles that are administrative/research slots rather than an actual
// seminar a student picks for credit - excluded even when their code
// matches a slot's prefix (e.g. "UTC3102: Tembusu UROP" would otherwise
// show up as a false "Senior Seminar option").
const EXCLUDE_TITLE =
  /UROP|Internship|Independent Study|Teaching Opportunities|Senior (Learning Experience|Projects?|Programme)|Mentoring Programme/i;

const MAX_SUGGESTIONS = 8;

type SlotGroup = {
  slotIds: string[];
  label: string;
  patterns: RegExp[];
};

// Which live NUSMods code prefixes plausibly fill each college's slot.
// Evidence-based: checked against api.nusmods.com's 2025-2026 module list
// directly (2026-11-28) rather than assumed, but still a heuristic
// grouping by code pattern, not an official per-pillar table - NUS
// doesn't publish one (see each college's own caveats, and the feature
// spec's §7 open item). RC4's Junior Seminar (UTC1702x) and Acacia's
// Digital Literacy offering (UTC285x) are the two cases with a confirmed,
// distinct code range; both Senior Seminar slots at a UTCP college draw
// from the same UTC2xxx/UTS2xxx pool (the code doesn't say which pillar a
// given title satisfies in a given semester), so they're grouped together
// rather than shown as two separate - but actually identical - lists.
const GROUPS: Record<string, SlotGroup[]> = {
  acacia: [
    { slotIds: ["junior-seminar"], label: "Junior Seminar", patterns: [/^UTC1(?!702)/] },
    { slotIds: ["ideas-exposition"], label: "Ideas & Exposition", patterns: [/^UTW1/] },
    {
      // Excludes UTC285x so Acacia's own Digital Literacy courses don't
      // also show up as generic Senior Seminar options (see that slot
      // below) - Acacia is the one college where these two code ranges
      // would otherwise overlap.
      slotIds: ["senior-seminar-ss", "senior-seminar-ce"],
      label: "Senior Seminar (either pillar)",
      patterns: [/^UTC2(?!851|852)/, /^UTS2/],
    },
    { slotIds: ["digital-literacy"], label: "Digital Literacy (Acacia-offered)", patterns: [/^UTC285/] },
  ],
  capt: [
    { slotIds: ["junior-seminar"], label: "Junior Seminar", patterns: [/^UTC1(?!702)/] },
    { slotIds: ["ideas-exposition"], label: "Ideas & Exposition", patterns: [/^UTW1/] },
    {
      slotIds: ["senior-seminar-ss", "senior-seminar-ce"],
      label: "Senior Seminar (either pillar)",
      patterns: [/^UTC2/, /^UTS2/],
    },
  ],
  rc4: [
    { slotIds: ["junior-seminar"], label: "Junior Seminar (RC4's own)", patterns: [/^UTC1702/] },
    { slotIds: ["ideas-exposition"], label: "Ideas & Exposition", patterns: [/^UTW1/] },
    {
      slotIds: ["senior-seminar-ss", "senior-seminar-ce"],
      label: "Senior Seminar (either pillar)",
      patterns: [/^UTC2/, /^UTS2/],
    },
  ],
  tembusu: [
    { slotIds: ["junior-seminar"], label: "Junior Seminar", patterns: [/^UTC1(?!702)/] },
    { slotIds: ["ideas-exposition"], label: "Ideas & Exposition", patterns: [/^UTW1/] },
    {
      slotIds: ["senior-seminar-ss", "senior-seminar-ce"],
      label: "Senior Seminar (either pillar)",
      patterns: [/^UTC2/, /^UTS2/],
    },
  ],
  rvrc: [
    { slotIds: ["course-cc"], label: "Cultures & Connections", patterns: [/^RVC/] },
    { slotIds: ["course-ce-expr"], label: "Critique & Expression", patterns: [/^RVX/] },
    { slotIds: ["course-ss"], label: "Singapore Studies", patterns: [/^RVSS/] },
    { slotIds: ["course-comm-eng"], label: "Communities & Engagement", patterns: [/^RVN/] },
  ],
};

/**
 * Real, currently-listed NUSMods modules that plausibly fill each of a
 * college's slots - a starting shortlist to search from in the planner's
 * own module picker, not a confirmed "this satisfies this pillar" table
 * (NUS doesn't publish one, and the list turns over every semester - see
 * each college's caveats). Returns [] if NUSMods can't be reached; the
 * static generic slot labels are shown either way, so this is additive.
 */
export async function getLiveGroupsForCollege(collegeId: string): Promise<LiveCourseGroup[]> {
  const groups = GROUPS[collegeId];
  if (!groups) return [];

  let modules: ModuleCondensed[];
  try {
    modules = await getModuleList(NUSMODS_ACAD_YEAR);
  } catch {
    return [];
  }

  return groups.map((g) => ({
    label: g.label,
    suggestions: modules
      .filter((m) => g.patterns.some((p) => p.test(m.moduleCode)) && !EXCLUDE_TITLE.test(m.title))
      .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode))
      .slice(0, MAX_SUGGESTIONS)
      .map((m) => ({ moduleCode: m.moduleCode, title: m.title })),
  }));
}

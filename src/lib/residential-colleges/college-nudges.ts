import type { CollegeStructure } from "./types";

export type CollegeNudge = {
  id: string;
  tone: "info" | "warning";
  message: string;
};

// Faculty strings exactly as stored on User.programme's "(<faculty>)"
// suffix - see app/onboarding/onboarding-form.tsx and
// src/lib/education-data/nus-programmes.ts's nusFaculties.
const CDE_FACULTY = "College of Design and Engineering";
const CHS_FACULTIES = ["Faculty of Arts and Social Sciences", "Faculty of Science"];

const CHS_EXEMPT_COURSES = [
  "Communities and Engagement",
  "Writing",
  "Interdisciplinary I",
  "Interdisciplinary II",
];

// User.programme is stored as "<degree> (<faculty>)" (see
// onboarding-form.tsx's submit payload) - this just reads the faculty
// back out of that string. Returns null for anything that doesn't match
// the expected shape (e.g. a programme saved before this convention, or
// no programme at all).
export function facultyFromProgramme(programme: string | null | undefined): string | null {
  if (!programme) return null;
  const match = programme.match(/\(([^()]+)\)\s*$/);
  return match ? match[1] : null;
}

/**
 * College + faculty specific nudges that change what a student actually
 * needs to do, not just "double check this" - surfaced prominently rather
 * than buried in the general caveats list. See feature-spec.md §3.
 */
export function collegeNudgesFor(
  college: CollegeStructure,
  faculty: string | null | undefined
): CollegeNudge[] {
  const nudges: CollegeNudge[] = [];

  if (college.id === "rc4" && faculty === CDE_FACULTY) {
    nudges.push({
      id: "rc4-cde-extra-ue",
      tone: "warning",
      message:
        "RC4's own Junior Seminar (UTC1702x) precludes IE2141. As a CDE student, taking it exempts you from IE2141 — but you'll need to pick up 4 extra Unrestricted Elective units elsewhere to still hit your graduation unit minimum. This isn't auto-added to your plan; add a 4 MC UE slot yourself once you register for the seminar.",
    });
  }

  if (faculty && CHS_FACULTIES.includes(faculty)) {
    nudges.push({
      id: "chs-exemption",
      tone: "info",
      message: `Completing all 4 of ${college.label}'s courses exempts CHS students from 4 named CHS Common Curriculum courses: ${CHS_EXEMPT_COURSES.join(", ")}. This app doesn't model CHS's own degree-requirement buckets yet, so it can't tick these off your plan automatically — but you shouldn't need to register for them once your college requirement is done.`,
    });
  }

  return nudges;
}

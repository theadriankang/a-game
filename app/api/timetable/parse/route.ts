import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getModuleInfo, NUSMODS_ACAD_YEAR, type Lesson } from "@/lib/nusmods";
import { parseNusmodsShareLink } from "@/lib/nusmods-timetable";

export type ResolvedLesson = Lesson & {
  moduleCode: string;
  moduleTitle: string;
};

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: "Missing a timetable link to parse." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseNusmodsShareLink(body.url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't parse that link." },
      { status: 400 }
    );
  }

  const lessons: ResolvedLesson[] = [];
  const problems: string[] = [];

  await Promise.all(
    Object.entries(parsed.selections).map(async ([moduleCode, lessonTypeToClassNo]) => {
      let info;
      try {
        info = await getModuleInfo(NUSMODS_ACAD_YEAR, moduleCode);
      } catch {
        problems.push(`${moduleCode}: couldn't load this module from NUSMods.`);
        return;
      }

      const semData = info.semesterData?.find((s) => s.semester === parsed.semester);
      if (!semData?.timetable) {
        problems.push(`${moduleCode}: no timetable data for Semester ${parsed.semester}.`);
        return;
      }

      for (const [lessonType, classNo] of Object.entries(lessonTypeToClassNo)) {
        const matches = semData.timetable.filter(
          (l) => l.lessonType === lessonType && l.classNo === classNo
        );
        if (matches.length === 0) {
          problems.push(`${moduleCode}: couldn't find ${lessonType} ${classNo}.`);
          continue;
        }
        for (const lesson of matches) {
          lessons.push({ ...lesson, moduleCode, moduleTitle: info.title });
        }
      }
    })
  );

  return NextResponse.json({ semester: parsed.semester, lessons, problems });
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Saved NUSMods share links, one per Year/Semester slot the user has
// chosen to keep. Saving is opt-in (see app/timetable/timetable-panel.tsx)
// - this route never writes anything the user didn't explicitly ask to
// save.

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const saved = await prisma.savedTimetable.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    saved: saved.map(
      (s: { academicYear: number; semester: number; shareUrl: string; updatedAt: Date }) => ({
        academicYear: s.academicYear,
        semester: s.semester,
        shareUrl: s.shareUrl,
        updatedAt: s.updatedAt,
      })
    ),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    academicYear?: number;
    semester?: number;
    shareUrl?: string;
  } | null;

  if (
    !body?.shareUrl ||
    typeof body.academicYear !== "number" ||
    typeof body.semester !== "number"
  ) {
    return NextResponse.json({ error: "Missing academicYear, semester or shareUrl." }, { status: 400 });
  }

  const saved = await prisma.savedTimetable.upsert({
    where: {
      userId_academicYear_semester: {
        userId,
        academicYear: body.academicYear,
        semester: body.semester,
      },
    },
    update: { shareUrl: body.shareUrl },
    create: {
      userId,
      academicYear: body.academicYear,
      semester: body.semester,
      shareUrl: body.shareUrl,
    },
  });

  return NextResponse.json({
    academicYear: saved.academicYear,
    semester: saved.semester,
    shareUrl: saved.shareUrl,
    updatedAt: saved.updatedAt,
  });
}

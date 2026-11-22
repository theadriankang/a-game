import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const link = await prisma.telegramLink.findUnique({ where: { userId } });
    return NextResponse.json({ connected: !!link });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

// Unlinks this user's Telegram chat - they'll stop getting notifications
// until they connect again.
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    await prisma.telegramLink.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

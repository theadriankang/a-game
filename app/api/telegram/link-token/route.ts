import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dbErrorResponse } from "@/lib/api-error";

const TOKEN_TTL_MINUTES = 15;

// Generates a one-time token and the Telegram deep link that carries it as
// the /start payload. The webhook route (see app/api/telegram/webhook)
// reads that payload back out and uses it to look up which app account to
// link the resulting chat id to - this is the only thing connecting "the
// person who just tapped Start in Telegram" to "the signed-in user who
// clicked Connect a moment ago".
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json(
      { error: "Telegram isn't configured for this deployment yet." },
      { status: 503 }
    );
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramLinkToken: token, telegramLinkTokenExpiresAt: expiresAt },
    });

    return NextResponse.json({
      deepLink: `https://t.me/${botUsername}?start=${token}`,
    });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { setTelegramWebhook } from "@/lib/telegram";

// One-time (and safely repeatable) admin action: points Telegram's webhook
// at this deployment. Any signed-in user can trigger it - it doesn't touch
// anyone's data, just tells Telegram where to send bot messages, so there's
// no real risk in it being unrestricted beyond "must be logged in".
// Needs to be re-run if the deployment's domain ever changes.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    return NextResponse.json(
      { error: "NEXTAUTH_URL and TELEGRAM_WEBHOOK_SECRET must both be set first." },
      { status: 503 }
    );
  }

  try {
    const result = await setTelegramWebhook(`${baseUrl}/api/telegram/webhook`, secret);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "setWebhook failed." },
      { status: 500 }
    );
  }
}

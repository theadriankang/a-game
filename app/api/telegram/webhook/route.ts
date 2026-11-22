import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

// Telegram POSTs every update (message, etc.) sent to the bot here, once
// the webhook is registered (see /api/telegram/setup-webhook). We only
// care about one thing: a /start <token> command, which completes the
// account-linking flow that /api/telegram/link-token started.
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    // Telegram always includes this header once secret_token is set on
    // setWebhook - anything else POSTing here without it isn't Telegram.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId: number | undefined = message?.chat?.id;

  if (!text || chatId === undefined) {
    return NextResponse.json({ ok: true });
  }

  const match = text.match(/^\/start\s+(\S+)/);
  if (!match) {
    // Someone messaged the bot without a valid link - nothing to do but
    // not leave them hanging either.
    await sendTelegramMessage(
      String(chatId),
      "Open the \"Connect Telegram\" link from inside the app to link your account - this chat alone doesn't do anything."
    );
    return NextResponse.json({ ok: true });
  }

  const token = match[1];

  try {
    const user = await prisma.user.findUnique({ where: { telegramLinkToken: token } });

    if (!user || !user.telegramLinkTokenExpiresAt || user.telegramLinkTokenExpiresAt < new Date()) {
      await sendTelegramMessage(
        String(chatId),
        "That connection link has expired or was already used - go back to the app and tap \"Connect Telegram\" again."
      );
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction([
      prisma.telegramLink.upsert({
        where: { userId: user.id },
        create: { userId: user.id, chatId: String(chatId) },
        update: { chatId: String(chatId) },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { telegramLinkToken: null, telegramLinkTokenExpiresAt: null },
      }),
    ]);

    await sendTelegramMessage(
      String(chatId),
      `You're connected${user.name ? `, ${user.name}` : ""}. You'll get a message here whenever a module analysis you requested is ready.`
    );
  } catch (error) {
    console.error("Telegram webhook failed:", error);
  }

  return NextResponse.json({ ok: true });
}

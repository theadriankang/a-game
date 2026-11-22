/**
 * Minimal Telegram Bot API wrapper - just enough to push a text notification
 * to a user's linked chat when their requested module analysis is ready.
 * No bot framework needed for a single outgoing message type.
 */
export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set - skipping notification.");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Telegram send failed (${res.status}): ${body}`);
  }
}

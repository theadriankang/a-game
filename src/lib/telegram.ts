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

/**
 * Registers this deployment's webhook URL with Telegram, so messages sent
 * to the bot (like the /start command from an account-linking deep link)
 * get POSTed to our own /api/telegram/webhook route. Idempotent - safe to
 * call repeatedly (e.g. once per deploy), since it just overwrites
 * whatever URL was previously registered.
 */
export async function setTelegramWebhook(webhookUrl: string, secretToken: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`setWebhook failed: ${JSON.stringify(data)}`);
  }
  return data;
}

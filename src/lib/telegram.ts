/**
 * Thin wrapper around the Telegram Bot API, matching the pattern already used
 * by the agency's n8n "1 Post Everywhere" workflow (bot @sharkyangelsbot).
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the environment;
 * TELEGRAM_MESSAGE_THREAD_ID is optional (targets a specific topic in a group).
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured.");
  }

  const threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

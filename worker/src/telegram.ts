export interface TelegramDraft {
  id: string;
  title: string;
  body: string;
  tags: string[];
  estimatedCostCny: number;
  review: { score: number; approved: boolean };
  topic: { localSignals: string[] };
}

export function formatTelegramDraftMessage(post: TelegramDraft, dashboardUrl?: string): string {
  const tags = post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const signals = post.topic.localSignals.slice(0, 4).join(" / ");
  const lines = [
    "NTU CBA 小红书每日草稿",
    "状态：待人工审核，尚未发布",
    "",
    `标题：${post.title}`,
    "",
    post.body,
    "",
    tags ? `标签：${tags}` : "",
    signals ? `选题参考：${signals}` : "",
    `审核分：${post.review.score} | 预估模型成本：¥${post.estimatedCostCny.toFixed(2)}`,
    dashboardUrl ? `审核入口：${dashboardUrl}` : ""
  ].filter(Boolean);
  const message = lines.join("\n");
  return message.length <= 3900 ? message : `${message.slice(0, 3860)}\n\n[内容已截断，请在运营台审核全文]`;
}

export async function sendTelegramDraft(options: {
  botToken?: string;
  chatId?: string;
  dashboardUrl?: string;
  post: TelegramDraft;
  coverSvg?: string;
  fetcher?: typeof fetch;
}): Promise<{ configured: boolean; delivered: boolean; detail: string }> {
  const { botToken, chatId, dashboardUrl, post, coverSvg, fetcher = fetch } = options;
  if (!botToken || !chatId) return { configured: false, delivered: false, detail: "Telegram is not configured." };

  const response = await fetcher(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: formatTelegramDraftMessage(post, dashboardUrl), disable_web_page_preview: true })
  });
  if (!response.ok) return { configured: true, delivered: false, detail: `Telegram API returned HTTP ${response.status}.` };
  const payload = await response.json().catch(() => undefined) as { ok?: boolean; description?: string } | undefined;
  if (!payload?.ok) return { configured: true, delivered: false, detail: payload?.description || "Telegram rejected the message." };
  if (!coverSvg) return { configured: true, delivered: true, detail: "Telegram notification delivered." };

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", "自动生成的便利贴封面，请在运营台审核后使用。");
  form.set("document", new Blob([coverSvg], { type: "image/svg+xml" }), "ntu-cba-draft-cover.svg");
  const documentResponse = await fetcher(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form });
  const documentPayload = await documentResponse.json().catch(() => undefined) as { ok?: boolean; description?: string } | undefined;
  if (!documentResponse.ok || !documentPayload?.ok) {
    return { configured: true, delivered: true, detail: documentPayload?.description || `Telegram text delivered, but the cover attachment returned HTTP ${documentResponse.status}.` };
  }
  return { configured: true, delivered: true, detail: "Telegram draft and cover attachment delivered." };
}

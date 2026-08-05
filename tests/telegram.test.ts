import assert from "node:assert/strict";
import test from "node:test";
import { formatTelegramDraftMessage, sendTelegramDraft } from "../worker/src/telegram.js";

const draft = {
  id: "draft-1",
  title: "选课前先看这三件事",
  body: "开学前先把时间冲突和资格条件分开核对。\n1. 对照官方页面。\n2. 写下自己的限制。\n3. 最后再确认变动。",
  tags: ["NTU", "选课"],
  estimatedCostCny: 0.12,
  review: { score: 82, approved: false },
  topic: { localSignals: ["社区洞察 1：选课与学业决策"] }
};

test("formats a clearly review-only Telegram draft notification", () => {
  const message = formatTelegramDraftMessage(draft, "https://ntu-cba-rednote.web.app/#make");
  assert.match(message, /待人工审核/);
  assert.match(message, /#NTU #选课/);
  assert.match(message, /审核入口/);
});

test("does not send when Telegram secrets are absent", async () => {
  const result = await sendTelegramDraft({ post: draft, fetcher: async () => { throw new Error("should not fetch"); } });
  assert.deepEqual(result, { configured: false, delivered: false, detail: "Telegram is not configured." });
});

test("sends a draft through Telegram when configured", async () => {
  let request: Request | undefined;
  const result = await sendTelegramDraft({
    botToken: "token",
    chatId: "chat",
    post: draft,
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });
  assert.equal(result.delivered, true);
  assert.match(request?.url ?? "", /bottoken\/sendMessage/);
  assert.match(await request?.text() ?? "", /待人工审核/);
});

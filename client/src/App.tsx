import { useEffect, useMemo, useState } from "react";
import {
  generatePost,
  getStatus,
  getPublishPackage,
  listPosts,
  type ContentStrategySummary,
  type MarketingPost,
  updatePost
} from "./api.js";

const statusLabels: Record<MarketingPost["status"], string> = {
  draft: "草稿",
  approved: "待发布",
  published: "已发布",
  archived: "归档"
};

const metricLabels: Array<[keyof MarketingPost["metrics"], string]> = [
  ["views", "曝光"],
  ["likes", "点赞"],
  ["saves", "收藏"],
  ["comments", "评论"],
  ["follows", "关注"],
  ["inquiries", "咨询"]
];

function App() {
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publishHint, setPublishHint] = useState("");
  const [visualBrief, setVisualBrief] = useState("");
  const [strategy, setStrategy] = useState<ContentStrategySummary>();

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? posts[0],
    [posts, selectedId]
  );

  const performance = useMemo(() => {
    const views = posts.reduce((sum, post) => sum + (post.metrics?.views ?? 0), 0);
    const inquiries = posts.reduce((sum, post) => sum + (post.metrics?.inquiries ?? 0), 0);
    const interactions = posts.reduce(
      (sum, post) =>
        sum +
        (post.metrics?.likes ?? 0) +
        (post.metrics?.saves ?? 0) +
        (post.metrics?.comments ?? 0) +
        (post.metrics?.follows ?? 0),
      0
    );
    const bestPost = [...posts].sort((a, b) => (b.metrics?.inquiries ?? 0) - (a.metrics?.inquiries ?? 0))[0];

    return {
      views,
      inquiries,
      interactions,
      inquiryRate: views ? ((inquiries / views) * 100).toFixed(2) : "0.00",
      interactionRate: views ? ((interactions / views) * 100).toFixed(2) : "0.00",
      bestPost
    };
  }, [posts]);

  async function refresh() {
    setError("");
    try {
      const nextPosts = await listPosts();
      const status = await getStatus();
      setPosts(nextPosts);
      setStrategy(status.strategy);
      if (!selectedId && nextPosts[0]) setSelectedId(nextPosts[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const post = await generatePost();
      await refresh();
      setSelectedId(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handlePatch(patch: Partial<MarketingPost>) {
    if (!selected) return;
    const updated = await updatePost(selected.id, patch);
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  }

  async function handleCopyPublishText() {
    if (!selected) return;
    const publishPackage = await getPublishPackage(selected.id);
    await navigator.clipboard.writeText([publishPackage.title, "", publishPackage.fullText].join("\n"));
    setPublishHint("已复制发布文本，可以直接粘贴到小红书编辑器。");
    setVisualBrief(publishPackage.visualBrief);
  }

  async function handleCopyVisualBrief() {
    if (!selected) return;
    const publishPackage = await getPublishPackage(selected.id);
    const brief = [
      publishPackage.visualBrief,
      "",
      "AI 出图 prompt:",
      publishPackage.imagePrompt,
      "",
      "素材清单:",
      ...publishPackage.assetChecklist.map((item) => `- ${item}`)
    ].join("\n");
    await navigator.clipboard.writeText(brief);
    setVisualBrief(publishPackage.visualBrief);
    setPublishHint("已复制图片 brief，可以发给拍摄/设计/AI 出图。");
  }

  function updateMetric(name: keyof MarketingPost["metrics"], value: string) {
    if (!selected) return;
    const numericValue = Math.max(0, Number.parseInt(value || "0", 10));
    void handlePatch({
      metrics: {
        ...selected.metrics,
        [name]: Number.isNaN(numericValue) ? 0 : numericValue
      }
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Singapore Mini Storage</p>
          <h1>小红书运营台</h1>
        </div>
        <button className="primary-button" onClick={handleGenerate} disabled={loading}>
          {loading ? "生成中..." : "生成今日文案"}
        </button>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="scoreboard">
        <div>
          <span>总曝光</span>
          <strong>{performance.views}</strong>
        </div>
        <div>
          <span>互动率</span>
          <strong>{performance.interactionRate}%</strong>
        </div>
        <div>
          <span>咨询率</span>
          <strong>{performance.inquiryRate}%</strong>
        </div>
        <div>
          <span>最强选题</span>
          <strong>{performance.bestPost?.topic.style ?? "暂无"}</strong>
        </div>
      </section>

      {strategy && (
        <section className="strategy-panel">
          <div>
            <span>策略建议</span>
            <strong>{strategy.recommendation}</strong>
          </div>
          <div>
            <span>已回填样本</span>
            <strong>
              {strategy.measuredPosts}/{strategy.sampleSize}
            </strong>
          </div>
          <div>
            <span>最佳风格</span>
            <strong>{strategy.bestStyle?.key ?? "暂无"}</strong>
          </div>
          <div>
            <span>最佳人群</span>
            <strong>{strategy.bestSegment?.key ?? "暂无"}</strong>
          </div>
        </section>
      )}

      <section className="workspace">
        <aside className="post-list">
          <div className="panel-title">内容池</div>
          {posts.length === 0 && <p className="empty">还没有草稿，先生成一条。</p>}
          {posts.map((post) => (
            <button
              className={`post-item ${post.id === selected?.id ? "active" : ""}`}
              key={post.id}
              onClick={() => setSelectedId(post.id)}
            >
              <span>{post.title}</span>
              <small>
                {statusLabels[post.status]} · {post.topic.style} · ¥{post.estimatedCostCny.toFixed(2)}
              </small>
            </button>
          ))}
        </aside>

        {selected && (
          <section className="editor">
            <div className="meta-row">
              <span>{statusLabels[selected.status]}</span>
              <span>{selected.topic.targetSegment}</span>
              <span>评分 {selected.review.score}</span>
              <span>{selected.generator}</span>
            </div>

            <label>
              标题
              <input
                value={selected.title}
                onChange={(event) => handlePatch({ title: event.target.value })}
              />
            </label>

            <label>
              正文
              <textarea
                value={selected.body}
                rows={14}
                onChange={(event) => handlePatch({ body: event.target.value })}
              />
            </label>

            <label>
              标签
              <input
                value={selected.tags.join(" ")}
                onChange={(event) =>
                  handlePatch({ tags: event.target.value.split(/\s+/).filter(Boolean) })
                }
              />
            </label>

            <label>
              图片建议
              <textarea
                value={selected.imageIdeas.join("\n")}
                rows={4}
                onChange={(event) =>
                  handlePatch({ imageIdeas: event.target.value.split("\n").filter(Boolean) })
                }
              />
            </label>

            <label>
              行动引导
              <input
                value={selected.callToAction}
                onChange={(event) => handlePatch({ callToAction: event.target.value })}
              />
            </label>

            <div className="metrics-editor">
              <div className="panel-title">发布效果</div>
              <div className="metric-grid">
                {metricLabels.map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      inputMode="numeric"
                      min="0"
                      type="number"
                      value={selected.metrics?.[name] ?? 0}
                      onChange={(event) => updateMetric(name, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="actions">
              <button onClick={() => handlePatch({ status: "approved" })}>设为待发布</button>
              <button onClick={() => handlePatch({ status: "published" })}>标记已发布</button>
              <button onClick={() => handlePatch({ status: "archived" })}>归档</button>
            </div>
          </section>
        )}

        {selected && (
          <aside className="insights">
            <div className="panel-title">选题逻辑</div>
            <p>{selected.topic.scene}</p>
            <dl>
              <dt>角度</dt>
              <dd>{selected.topic.angle}</dd>
              <dt>本地信号</dt>
              <dd>{selected.topic.localSignals.join(" / ")}</dd>
              <dt>审核备注</dt>
              <dd>{selected.review.notes.join("；")}</dd>
            </dl>
            <div className="preview">
              <strong>发布预览</strong>
              <h2>{selected.title}</h2>
              <p>{selected.body}</p>
              <p className="tags">{selected.tags.map((tag) => `#${tag}`).join(" ")}</p>
            </div>
            <div className="publish-helper">
              <strong>发布助手</strong>
              <button onClick={handleCopyPublishText}>复制发布文本</button>
              <button onClick={handleCopyVisualBrief}>复制图片 brief</button>
              <code>npm.cmd run publish -- --post {selected.id}</code>
              {publishHint && <p>{publishHint}</p>}
              {visualBrief && <pre>{visualBrief}</pre>}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}

export default App;

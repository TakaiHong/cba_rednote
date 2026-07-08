import { useEffect, useMemo, useState } from "react";
import {
  generatePost,
  generatePostBatch,
  generateCoverImage,
  getContentCalendar,
  getGoLiveStatus,
  getStatus,
  getPublishPackage,
  listPosts,
  type CalendarItem,
  type ContentStrategySummary,
  type GoLiveCheckResult,
  type MarketingPost,
  type SystemStatus,
  updatePost
} from "./api.js";

const statusLabels: Record<MarketingPost["status"], string> = {
  draft: "草稿",
  approved: "待发布",
  published: "已发布",
  archived: "归档"
};

const statusFilters = ["all", "draft", "approved", "published", "archived"] as const;
type StatusFilter = (typeof statusFilters)[number];

const metricLabels: Array<[keyof MarketingPost["metrics"], string]> = [
  ["views", "曝光"],
  ["likes", "点赞"],
  ["saves", "收藏"],
  ["comments", "评论"],
  ["follows", "关注"],
  ["inquiries", "咨询"]
];

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function App() {
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchHint, setBatchHint] = useState("");
  const [publishHint, setPublishHint] = useState("");
  const [visualBrief, setVisualBrief] = useState("");
  const [coverLoading, setCoverLoading] = useState(false);
  const [strategy, setStrategy] = useState<ContentStrategySummary>();
  const [goLive, setGoLive] = useState<GoLiveCheckResult>();
  const [cost, setCost] = useState<SystemStatus["cost"]>();
  const [recentRuns, setRecentRuns] = useState<SystemStatus["recentRuns"]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      const searchable = [post.title, post.body, post.topic.scene, post.topic.angle, post.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [posts, searchQuery, statusFilter]);

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
      const nextGoLive = await getGoLiveStatus();
      const nextCalendar = await getContentCalendar(7);
      setPosts(nextPosts);
      setStrategy(status.strategy);
      setGoLive(nextGoLive);
      setCost(status.cost);
      setRecentRuns(status.recentRuns ?? []);
      setCalendar(nextCalendar);
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

  async function handleGenerateBatch() {
    setLoading(true);
    setError("");
    setBatchHint("");
    try {
      const result = await generatePostBatch(7, 1);
      await refresh();
      if (result.posts[0]) setSelectedId(result.posts[0].id);
      setBatchHint(
        `已生成 ${result.posts.length} 条草稿，最高模型成本约 ${result.plan.estimatedMaxCostCny.toFixed(2)} 元。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handlePatch(patch: Partial<MarketingPost>) {
    if (!selected) return;
    setError("");
    try {
      const updated = await updatePost(selected.id, patch);
      setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  function handleMarkPublished() {
    if (!selected) return;
    const normalizedUrl = selected.publishedUrl?.trim();
    if (!normalizedUrl || !/^https?:\/\//i.test(normalizedUrl)) {
      setError("标记已发布前，请先填写有效的小红书笔记链接。");
      return;
    }
    void handlePatch({ status: "published", publishedUrl: normalizedUrl });
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
      "已绑定图片素材:",
      ...(publishPackage.imageAssets.length > 0
        ? publishPackage.imageAssets.map((item) => `- ${item}`)
        : ["- 暂无"]),
      "",
      "素材清单:",
      ...publishPackage.assetChecklist.map((item) => `- ${item}`)
    ].join("\n");
    await navigator.clipboard.writeText(brief);
    setVisualBrief(publishPackage.visualBrief);
    setPublishHint("已复制图片 brief，可以发给拍摄/设计/AI 出图。");
  }

  async function handleGenerateCoverImage() {
    if (!selected) return;
    setCoverLoading(true);
    setError("");
    try {
      const result = await generateCoverImage(selected.id);
      if (result.post) {
        setPosts((current) => current.map((post) => (post.id === result.post?.id ? result.post : post)));
      } else {
        await refresh();
      }
      setPublishHint(`已生成并绑定模板封面：${result.outputPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成封面失败");
    } finally {
      setCoverLoading(false);
    }
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

  useEffect(() => {
    if (filteredPosts.length === 0) return;
    if (!filteredPosts.some((post) => post.id === selectedId)) {
      setSelectedId(filteredPosts[0].id);
    }
  }, [filteredPosts, selectedId]);

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Singapore Mini Storage</p>
          <h1>小红书运营台</h1>
        </div>
        <div className="topbar-actions">
          <button className="primary-button" onClick={handleGenerate} disabled={loading}>
            {loading ? "生成中..." : "生成今日文案"}
          </button>
          <button className="secondary-button" onClick={handleGenerateBatch} disabled={loading}>
            批量准备 7 条
          </button>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {batchHint && <div className="notice">{batchHint}</div>}

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
        <div>
          <span>累计成本</span>
          <strong>¥{(cost?.totalEstimatedCostCny ?? 0).toFixed(2)}</strong>
        </div>
        <div>
          <span>平均成本</span>
          <strong>¥{(cost?.averageEstimatedCostCny ?? 0).toFixed(2)}</strong>
        </div>
        <div>
          <span>付费生成</span>
          <strong>{cost?.paidModelPosts ?? 0} 条</strong>
        </div>
        <div>
          <span>预算状态</span>
          <strong>{cost?.withinPerPostBudget === false ? "超预算" : "正常"}</strong>
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

      {goLive && (
        <section className={`go-live-panel ${goLive.ok ? "ready" : "blocked"}`}>
          <div>
            <span>正式上线状态</span>
            <strong>{goLive.ok ? "可上线" : "待补证据"}</strong>
          </div>
          <div>
            <span>真实账号证据</span>
            <strong>
              {goLive.missingExternalEvidence.length === 0
                ? "已齐全"
                : goLive.missingExternalEvidence.join(" / ")}
            </strong>
          </div>
          <div>
            <span>下一步</span>
            <strong>{goLive.nextSteps[0] ?? "无阻塞项"}</strong>
          </div>
          <code>npm.cmd run go-live:check</code>
        </section>
      )}

      <section className="calendar-panel">
        <div className="calendar-header">
          <div>
            <span>内容排期</span>
            <strong>未来 7 天选题方向</strong>
          </div>
          <code>npm.cmd run calendar -- --days 7</code>
        </div>
        <div className="calendar-grid">
          {calendar.map((item) => (
            <article className="calendar-item" key={`${item.date}-${item.slot}`}>
              <div className="calendar-date">
                <strong>{item.date.slice(5)}</strong>
                <span>Day {item.slot}</span>
              </div>
              <p>{item.topic.hook}</p>
              <small>
                {item.topic.style} / {item.topic.targetSegment}
              </small>
              <em>{item.objective}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="run-log-panel">
        <div className="panel-title">最近运行</div>
        {recentRuns.length === 0 && <p className="empty">暂无运行记录。</p>}
        {recentRuns.map((run) => (
          <div className="run-log-item" key={run.id}>
            <strong>{run.action}</strong>
            <span>{run.message}</span>
            <small>
              {run.status} / {new Date(run.createdAt).toLocaleString()}
            </small>
          </div>
        ))}
      </section>

      <section className="workspace">
        <aside className="post-list">
          <div className="panel-title">内容池</div>
          <div className="list-tools">
            <input
              aria-label="搜索内容"
              placeholder="搜索标题、正文、标签"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="status-filters" aria-label="内容状态筛选">
              {statusFilters.map((status) => (
                <button
                  className={statusFilter === status ? "active" : ""}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "全部" : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
          {posts.length === 0 && <p className="empty">还没有草稿，先生成一条。</p>}
          {posts.length > 0 && filteredPosts.length === 0 && <p className="empty">没有符合条件的内容。</p>}
          {filteredPosts.map((post) => (
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
                  handlePatch({ imageIdeas: splitLines(event.target.value) })
                }
              />
            </label>

            <label>
              图片素材路径
              <textarea
                placeholder="每行一个本地图片路径，例如 C:\\assets\\cover.png"
                value={(selected.imageAssets ?? []).join("\n")}
                rows={3}
                onChange={(event) =>
                  handlePatch({ imageAssets: splitLines(event.target.value) })
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
              <label>
                小红书链接
                <input
                  placeholder="发布后粘贴笔记链接"
                  value={selected.publishedUrl ?? ""}
                  onChange={(event) => handlePatch({ publishedUrl: event.target.value })}
                />
              </label>
            </div>

            <div className="actions">
              <button onClick={() => handlePatch({ status: "approved" })}>设为待发布</button>
              <button onClick={handleMarkPublished}>标记已发布</button>
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
              <button onClick={handleGenerateCoverImage} disabled={coverLoading}>
                {coverLoading ? "生成封面中..." : "生成模板封面"}
              </button>
              <span>{selected.imageAssets?.length ?? 0} 张图片素材已绑定</span>
              <code>npm.cmd run publish -- --post {selected.id}</code>
              {selected.publishedUrl && (
                <a href={selected.publishedUrl} rel="noreferrer" target="_blank">
                  打开已发布笔记
                </a>
              )}
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

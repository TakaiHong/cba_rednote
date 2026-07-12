import { useEffect, useMemo, useState } from "react";
import {
  backupRuntimeData,
  exportMarkdownPackage,
  exportPerformanceReport,
  generatePost,
  generatePostBatch,
  generateCoverImage,
  generateHandoffPackage,
  getContentCalendar,
  getDailyTaskStatus,
  getImageAssetUrl,
  getGoLiveStatus,
  getPreflightEvidence,
  getStatus,
  getPublishPackage,
  listPosts,
  startAssistedPublish,
  type CalendarItem,
  type ContentStrategySummary,
  type DailyTaskStatus,
  type GoLiveCheckResult,
  type MarketingPost,
  type PreflightEvidenceResult,
  type SystemStatus,
  type XhsPublishPackage,
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

const handoffCommandKeys = [
  ["verify", "完整验证"],
  ["handoff", "导出交接包"],
  ["publishPreflight", "账号预检"],
  ["publishPreflightManual", "手动预检"],
  ["scheduleStatus", "定时状态"],
  ["scheduleInstall", "安装定时任务"]
] as const;

const preflightGroupLabels: Record<"title" | "body" | "upload" | "publishButton", string> = {
  title: "标题",
  body: "正文",
  upload: "图片上传",
  publishButton: "发布按钮"
};

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
  const [exportLoading, setExportLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [strategy, setStrategy] = useState<ContentStrategySummary>();
  const [goLive, setGoLive] = useState<GoLiveCheckResult>();
  const [preflight, setPreflight] = useState<PreflightEvidenceResult>();
  const [dailyTask, setDailyTask] = useState<DailyTaskStatus>();
  const [cost, setCost] = useState<SystemStatus["cost"]>();
  const [commands, setCommands] = useState<SystemStatus["commands"]>({});
  const [recentRuns, setRecentRuns] = useState<SystemStatus["recentRuns"]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [publishPreview, setPublishPreview] = useState<XhsPublishPackage>();
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

  const previewImage = publishPreview?.imageAssets[0] ?? selected?.imageAssets?.[0];
  const approvedCount = posts.filter((post) => post.status === "approved").length;
  const publishedCount = posts.filter((post) => post.status === "published").length;
  const selectedPublishCommand = selected ? `npm.cmd run publish -- --post ${selected.id}` : "";
  const goLiveGap =
    goLive?.missingExternalEvidence.length
      ? `还缺：${goLive.missingExternalEvidence.join(" / ")}`
      : "上线证据已齐";

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
      const nextPreflight = await getPreflightEvidence();
      const nextCalendar = await getContentCalendar(7);
      setPosts(nextPosts);
      setStrategy(status.strategy);
      setGoLive(nextGoLive);
      setPreflight(nextPreflight);
      setCost(status.cost);
      setCommands(status.commands ?? {});
      setRecentRuns(status.recentRuns ?? []);
      setCalendar(nextCalendar);
      if (!selectedId && nextPosts[0]) setSelectedId(nextPosts[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function refreshDailyTaskStatus() {
    try {
      setDailyTask(await getDailyTaskStatus());
    } catch {
      setDailyTask({
        ok: false,
        installed: false,
        taskName: "XHS Mini Storage Daily Draft",
        detail: "每日任务状态暂时无法读取，请运行 npm.cmd run schedule:status。",
        checkedAt: new Date().toISOString(),
        command: "npm.cmd run schedule:status",
        rawOutput: []
      });
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

  async function handleExportMarkdownPackage() {
    if (!selected) return;
    setExportLoading(true);
    setError("");
    try {
      const result = await exportMarkdownPackage(selected.id);
      await refresh();
      setPublishHint(`已导出 Markdown 发布包：${result.outputPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出发布包失败");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleCopyCommand(command: string) {
    await navigator.clipboard.writeText(command);
    setPublishHint(`已复制命令：${command}`);
  }

  async function handleGenerateHandoffPackage() {
    setHandoffLoading(true);
    setError("");
    try {
      const result = await generateHandoffPackage();
      await refresh();
      setPublishHint(
        `已生成交接包：${result.outDir}；首发清单：${result.files.firstPublishChecklist}；复盘报告：${result.files.performanceReport}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成交接包失败");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function handleBackupRuntimeData() {
    setBackupLoading(true);
    setError("");
    try {
      const result = await backupRuntimeData();
      await refresh();
      setPublishHint(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "备份失败");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleExportPerformanceReport() {
    setReportLoading(true);
    setError("");
    try {
      const result = await exportPerformanceReport();
      await refresh();
      setPublishHint(`已导出复盘报告：${result.outputPath}；已回填指标 ${result.measuredPosts}/${result.postCount} 条`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出复盘报告失败");
    } finally {
      setReportLoading(false);
    }
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

  async function handleStartAssistedPublish() {
    if (!selected) return;
    setPublishLoading(true);
    setError("");
    try {
      const result = await startAssistedPublish(selected.id);
      await refresh();
      setPublishHint(`已打开小红书辅助发布窗口：${result.command}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开小红书发布失败");
    } finally {
      setPublishLoading(false);
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
    const timer = window.setTimeout(() => {
      void refreshDailyTaskStatus();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (filteredPosts.length === 0) return;
    if (!filteredPosts.some((post) => post.id === selectedId)) {
      setSelectedId(filteredPosts[0].id);
    }
  }, [filteredPosts, selectedId]);

  useEffect(() => {
    if (!selected?.id) {
      setPublishPreview(undefined);
      return;
    }

    let cancelled = false;
    getPublishPackage(selected.id)
      .then((pkg) => {
        if (!cancelled) setPublishPreview(pkg);
      })
      .catch(() => {
        if (!cancelled) setPublishPreview(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.title, selected?.body, selected?.tags, selected?.imageAssets]);

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

      {selected && (
        <section className="operator-focus">
          <div className="focus-summary">
            <span>今日发布工作台</span>
            <h2>{publishPreview?.title ?? selected.title}</h2>
            <p>
              {approvedCount} 条待发布 / {publishedCount} 条已发布 / {goLiveGap}
            </p>
            <div className="focus-actions">
              <button className="primary-button" onClick={handleGenerateCoverImage} disabled={coverLoading}>
                {coverLoading ? "生成封面中..." : "生成便利贴封面"}
              </button>
              <button onClick={handleCopyPublishText}>复制发布文案</button>
              <button onClick={handleStartAssistedPublish} disabled={publishLoading}>
                {publishLoading ? "打开中..." : "打开小红书发布"}
              </button>
            </div>
          </div>
          <div className="focus-preview">
            {previewImage ? (
              <img alt="当前封面预览" src={getImageAssetUrl(previewImage)} />
            ) : (
              <div>暂无封面</div>
            )}
          </div>
          <div className="focus-checklist">
            <strong>发布前确认</strong>
            <span className={previewImage ? "ok" : "todo"}>{previewImage ? "封面已绑定" : "先生成便利贴封面"}</span>
            <span className={preflight?.ok ? "ok" : "todo"}>{preflight?.ok ? "账号预检通过" : "需跑账号预检"}</span>
            <span className={selected.publishedUrl ? "ok" : "todo"}>
              {selected.publishedUrl ? "已回填发布链接" : "发布后回填链接"}
            </span>
          </div>
        </section>
      )}

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

      {preflight && (
        <section className={`go-live-panel ${preflight.ok ? "ready" : "blocked"}`}>
          <div>
            <span>账号预检</span>
            <strong>{preflight.ok ? "选择器已命中" : "等待真实账号证据"}</strong>
          </div>
          <div>
            <span>报告路径</span>
            <strong>{preflight.path}</strong>
          </div>
          <div>
            <span>缺失项</span>
            <strong>{preflight.missingGroups.length ? preflight.missingGroups.join(" / ") : "无"}</strong>
          </div>
          <code>npm.cmd run publish:preflight</code>
          <div className="preflight-groups">
            {Object.entries(preflight.groups).map(([group, evidence]) => (
              <span className={evidence.ok ? "ready" : "blocked"} key={group}>
                {preflightGroupLabels[group as keyof typeof preflightGroupLabels]}: {evidence.ok ? "OK" : "缺失"}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={`automation-panel ${dailyTask?.installed ? "ready" : "blocked"}`}>
        {dailyTask ? (
          <>
            <div>
              <span>每日自动化</span>
              <strong>{dailyTask.installed ? "已安装" : "未安装"}</strong>
            </div>
            <div>
              <span>任务状态</span>
              <strong>{dailyTask.state ?? dailyTask.detail ?? "等待安装"}</strong>
            </div>
            <div>
              <span>下次运行</span>
              <strong>{dailyTask.nextRunTime ?? "安装后显示"}</strong>
            </div>
            <code>{dailyTask.command}</code>
          </>
        ) : (
          <>
            <div>
              <span>每日自动化</span>
              <strong>检查中</strong>
            </div>
            <div>
              <span>任务状态</span>
              <strong>后台读取中</strong>
            </div>
            <div>
              <span>下次运行</span>
              <strong>稍后显示</strong>
            </div>
            <code>npm.cmd run schedule:status</code>
          </>
        )}
      </section>

      <section className="handoff-command-panel">
        <div className="calendar-header">
          <div>
            <span>交接命令</span>
            <strong>复制后在 PowerShell 里执行</strong>
          </div>
          <code>README / docs/operations-runbook.md</code>
        </div>
        <div className="command-grid">
          <button className="command-action" disabled={handoffLoading} onClick={handleGenerateHandoffPackage}>
            <span>{handoffLoading ? "生成中" : "生成交接包"}</span>
            <code>.tmp/handoff</code>
          </button>
          <button className="command-action" disabled={backupLoading} onClick={handleBackupRuntimeData}>
            <span>{backupLoading ? "备份中" : "备份数据"}</span>
            <code>backups/</code>
          </button>
          <button className="command-action" disabled={reportLoading} onClick={handleExportPerformanceReport}>
            <span>{reportLoading ? "导出中" : "导出复盘"}</span>
            <code>exports/performance-report.md</code>
          </button>
          {handoffCommandKeys.map(([key, label]) => {
            const command = commands[key];
            return (
              <button disabled={!command} key={key} onClick={() => command && void handleCopyCommand(command)}>
                <span>{label}</span>
                <code>{command ?? "加载中"}</code>
              </button>
            );
          })}
        </div>
      </section>

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
              <div className="xhs-preview-card">
                {previewImage ? (
                  <img alt="Xiaohongshu cover preview" src={getImageAssetUrl(previewImage)} />
                ) : (
                  <div className="preview-image-empty">No image</div>
                )}
                <div className="xhs-preview-copy">
                  <h2>{publishPreview?.title ?? selected.title}</h2>
                  <p>{publishPreview?.fullText ?? selected.body}</p>
                  <p className="tags">
                    {publishPreview?.tagsLine || selected.tags.map((tag) => `#${tag}`).join(" ")}
                  </p>
                </div>
              </div>
            </div>
            <div className="publish-helper">
              <strong>发布助手</strong>
              <button onClick={handleCopyPublishText}>复制发布文本</button>
              <button onClick={handleCopyVisualBrief}>复制图片 brief</button>
              <button onClick={handleExportMarkdownPackage} disabled={exportLoading}>
                {exportLoading ? "导出中..." : "导出 Markdown"}
              </button>
              <button onClick={handleGenerateCoverImage} disabled={coverLoading}>
                {coverLoading ? "生成封面中..." : "生成模板封面"}
              </button>
              <button onClick={handleStartAssistedPublish} disabled={publishLoading}>
                {publishLoading ? "打开中..." : "打开小红书发布"}
              </button>
              <span>{selected.imageAssets?.length ?? 0} 张图片素材已绑定</span>
              <code>{selectedPublishCommand}</code>
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

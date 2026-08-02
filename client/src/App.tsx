import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, PenLine, Settings2, Upload } from "lucide-react";
import {
  addResearchSignal,
  approveResearchSignal,
  backupRuntimeData,
  deleteResearchSignal,
  exportMarkdownPackage,
  exportPerformanceReport,
  generatePost,
  importLocalCorpusSignals,
  regeneratePost,
  queueResearchSignals,
  generateCoverImage,
  generateHandoffPackage,
  getContentCalendar,
  getDailyTaskStatus,
  getImageAssetUrl,
  getGoLiveStatus,
  getKnowledgeBase,
  getPreflightEvidence,
  getPublishJob,
  getStatus,
  getPublishPackage,
  installDailyTask,
  listPosts,
  startAssistedPublish,
  startFinalPublish,
  startPublishPreflight,
  syncRedditSignals,
  uninstallDailyTask,
  uploadImageAsset,
  type CalendarItem,
  type ContentStrategySummary,
  type DailyTaskStatus,
  type GoLiveCheckResult,
  type KnowledgeBase,
  type MarketingPost,
  type PreflightEvidenceResult,
  type ResearchSignal,
  type SystemStatus,
  type XhsPublishPackage,
  updatePost
} from "./api.js";
import { parseLocalCorpusSignals } from "./redditTaxonomy.js";

const statusLabels: Record<MarketingPost["status"], string> = {
  draft: "草稿",
  approved: "待发布",
  published: "已发布",
  archived: "归档"
};

type WorkspaceTab = "guide" | "knowledge" | "make" | "publish" | "calendar" | "operations";

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
  const [publishHint, setPublishHint] = useState("");
  const [visualBrief, setVisualBrief] = useState("");
  const [coverLoading, setCoverLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [finalPublishLoading, setFinalPublishLoading] = useState(false);
  const [publishSubmittedPostId, setPublishSubmittedPostId] = useState("");
  const [urlBackfillLoading, setUrlBackfillLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState<"install" | "uninstall" | "">("");
  const [strategy, setStrategy] = useState<ContentStrategySummary>();
  const [goLive, setGoLive] = useState<GoLiveCheckResult>();
  const [preflight, setPreflight] = useState<PreflightEvidenceResult>();
  const [dailyTask, setDailyTask] = useState<DailyTaskStatus>();
  const [cost, setCost] = useState<SystemStatus["cost"]>();
  const [commands, setCommands] = useState<SystemStatus["commands"]>({});
  const [recentRuns, setRecentRuns] = useState<SystemStatus["recentRuns"]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [publishPreview, setPublishPreview] = useState<XhsPublishPackage>();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("guide");
  const [revisionNote, setRevisionNote] = useState("");
  const [regeneratingCopy, setRegeneratingCopy] = useState(false);
  const [makeStage, setMakeStage] = useState<1 | 2 | 3>(1);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [publishUrlDrafts, setPublishUrlDrafts] = useState<Record<string, string>>({});
  const [knowledge, setKnowledge] = useState<KnowledgeBase>();
  const [researchLoading, setResearchLoading] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, Pick<ResearchSignal, "theme" | "audience" | "insight">>>({});
  const [redditSyncLoading, setRedditSyncLoading] = useState(false);
  const [corpusImportLoading, setCorpusImportLoading] = useState(false);
  const [knowledgeTagFilter, setKnowledgeTagFilter] = useState("all");
  const [researchForm, setResearchForm] = useState({ sourceUrl: "", theme: "", audience: "NTU 中国学生", insight: "" });

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? posts[0],
    [posts, selectedId]
  );

  const previewImage = publishPreview?.imageAssets[0] ?? selected?.imageAssets?.[0];
  const knowledgeTags = useMemo(
    () => [...new Set((knowledge?.researchSignals ?? []).flatMap((signal) => signal.tags ?? []))].sort(),
    [knowledge]
  );
  const visibleResearchSignals = useMemo(
    () => (knowledge?.researchSignals ?? []).filter((signal) => knowledgeTagFilter === "all" || signal.tags?.includes(knowledgeTagFilter)),
    [knowledge, knowledgeTagFilter]
  );
  const approvedCount = posts.filter((post) => post.status === "approved").length;
  const publishedCount = posts.filter((post) => post.status === "published").length;
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
      const nextKnowledge = await getKnowledgeBase().catch(() => undefined);
      setPosts(nextPosts);
      setStrategy(status.strategy);
      setGoLive(nextGoLive);
      setPreflight(nextPreflight);
      setCost(status.cost);
      setCommands(status.commands ?? {});
      setRecentRuns(status.recentRuns ?? []);
      setCalendar(nextCalendar);
      setKnowledge(nextKnowledge);
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
        taskName: "NTU CBA Daily Draft",
        detail: "每日任务状态暂时无法读取，请运行 npm.cmd run schedule:status。",
        checkedAt: new Date().toISOString(),
        command: "npm.cmd run schedule:status",
        rawOutput: []
      });
    }
  }

  async function handleDailyTaskOperation(mode: "install" | "uninstall") {
    setScheduleLoading(mode);
    setError("");
    try {
      const result = mode === "install" ? await installDailyTask() : await uninstallDailyTask();
      setDailyTask(result.status);
      setPublishHint(mode === "install" ? "已安装每日自动生成任务。" : "已卸载每日自动生成任务。");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "install" ? "安装每日任务失败" : "卸载每日任务失败");
    } finally {
      setScheduleLoading("");
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const post = await generatePost();
      await refresh();
      setSelectedId(post.id);
      setActiveTab("make");
      setMakeStage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveResearchSignal() {
    setResearchLoading(true);
    setError("");
    try {
      const saved = await addResearchSignal(researchForm);
      setKnowledge((current) => current ? { ...current, researchSignals: [saved, ...current.researchSignals] } : current);
      setResearchForm({ sourceUrl: "", theme: "", audience: "NTU 中国学生", insight: "" });
      setPublishHint("公开参考洞察已进入知识库。之后 AI 会把它当作选题与表达灵感，不会把它当事实或照抄原文。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存公开参考洞察失败");
    } finally {
      setResearchLoading(false);
    }
  }

  async function handleQueueResearchSignals() {
    const sourceUrls = batchUrls.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
    setBatchLoading(true);
    setError("");
    try {
      const result = await queueResearchSignals(sourceUrls);
      setKnowledge((current) => current ? { ...current, researchSignals: [...result.added, ...current.researchSignals] } : current);
      setBatchUrls("");
      setPublishHint(`已放入 ${result.added.length} 条待审核链接${result.skipped ? `，跳过 ${result.skipped} 条重复或非 Reddit 链接` : ""}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量整理链接失败");
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleUploadPublicLink() {
    const sourceUrl = researchForm.sourceUrl.trim();
    if (!sourceUrl) return;
    setResearchLoading(true);
    setError("");
    try {
      const result = await queueResearchSignals([sourceUrl]);
      setKnowledge((current) => current ? { ...current, researchSignals: [...result.added, ...current.researchSignals] } : current);
      setResearchForm((form) => ({ ...form, sourceUrl: "" }));
      setPublishHint(result.added.length ? "公开链接已加入社区洞察，等待后续整理；它暂不会用于 AI 生成。" : "该链接已存在、不是支持的公开 Reddit 贴文，或无法加入。" );
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传公开链接失败");
    } finally {
      setResearchLoading(false);
    }
  }

  async function handleLocalCorpusImport(file: File | undefined) {
    if (!file) return;
    setCorpusImportLoading(true);
    setError("");
    try {
      const signals = parseLocalCorpusSignals(await file.text());
      if (!signals.length) throw new Error("No readable Reddit records were found in this local corpus file.");
      let added = 0;
      let skipped = 0;
      for (let index = 0; index < signals.length; index += 100) {
        const result = await importLocalCorpusSignals(signals.slice(index, index + 100));
        added += result.added.length;
        skipped += result.skipped;
      }
      await refresh();
      setPublishHint(`已导入 ${added} 条本地 Reddit 主题信号${skipped ? `，跳过 ${skipped} 条重复记录` : ""}。原贴正文和评论仍只保留在本机。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import local Reddit corpus");
    } finally {
      setCorpusImportLoading(false);
    }
  }

  async function handleApproveResearchSignal(signal: ResearchSignal) {
    const draft = reviewDrafts[signal.id] ?? { theme: signal.theme, audience: signal.audience, insight: signal.insight };
    setResearchLoading(true);
    setError("");
    try {
      const approved = await approveResearchSignal(signal.id, draft);
      setKnowledge((current) => current ? { ...current, researchSignals: current.researchSignals.map((item) => item.id === approved.id ? approved : item) } : current);
      setReviewDrafts((current) => {
        const next = { ...current };
        delete next[signal.id];
        return next;
      });
      setPublishHint("这条公开讨论已核准入库，只会作为选题灵感，不会被当成学校事实。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "核准公开洞察失败");
    } finally {
      setResearchLoading(false);
    }
  }

  async function handleDeleteResearchSignal(id: string) {
    setError("");
    try {
      await deleteResearchSignal(id);
      setKnowledge((current) => current ? { ...current, researchSignals: current.researchSignals.filter((signal) => signal.id !== id) } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除公开参考洞察失败");
    }
  }

  async function handleRedditSync() {
    setRedditSyncLoading(true);
    setError("");
    try {
      const result = await syncRedditSignals();
      await refresh();
      setPublishHint(`Reddit 趋势同步完成：读取 ${result.scanned} 条候选，筛选 ${result.selected} 条高相关信号，新增 ${result.added} 条。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddit 趋势同步失败");
    } finally {
      setRedditSyncLoading(false);
    }
  }

  async function handlePostPatch(id: string, patch: Partial<MarketingPost>) {
    setError("");
    try {
      const updated = await updatePost(id, patch);
      setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      return undefined;
    }
  }

  async function handlePatch(patch: Partial<MarketingPost>) {
    if (!selected) return;
    const contentFields: Array<keyof MarketingPost> = ["title", "body", "tags", "imageIdeas", "callToAction"];
    const changedContent = contentFields.some((field) => patch[field] !== undefined);
    const nextPatch =
      changedContent && selected.factCheck?.status === "verified"
        ? {
            ...patch,
            factCheck: {
              status: "needs_review" as const,
              notes: [...selected.factCheck.notes, "Content edited after verification; source review is required again."]
            }
          }
        : patch;
    return handlePostPatch(selected.id, nextPatch);
  }

  async function handleUploadCover(file?: File) {
    if (!selected || !file) return;
    setUploadingImage(true);
    setError("");
    try {
      const result = await uploadImageAsset(selected.id, file);
      setPosts((current) => current.map((post) => (post.id === result.post.id ? result.post : post)));
      setPublishHint("已上传并绑定自有封面图片。");
      setMakeStage(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveRevisionNote() {
    if (!selected || !revisionNote.trim()) return;
    const updated = await handlePatch({ revisionNotes: [...(selected.revisionNotes ?? []), revisionNote.trim()] });
    if (updated) {
      setRevisionNote("");
      setPublishHint("审核意见已保存，可据此继续修改文案或封面。");
    }
  }

  async function handleVerifySources() {
    if (!selected?.sourceReferences?.length) {
      setError("当前笔记没有可核验的官方来源，请先按来源重新生成文案。");
      return;
    }
    if (selected.factCheck?.status === "blocked") {
      setError("系统已拦截未获来源支持的具体信息，请修改或按来源重新生成后再核验。");
      return;
    }
    const updated = await handlePatch({
      factCheck: {
        status: "verified",
        checkedAt: new Date().toISOString(),
        notes: [...(selected.factCheck?.notes ?? []), "Operator confirmed the attached official sources were checked."]
      }
    });
    if (updated) setPublishHint("官方来源已人工核验；仍请在发布前检查具体表述与链接。 ");
  }

  async function handleRegenerateFromFeedback() {
    if (!selected || !revisionNote.trim()) return;
    setRegeneratingCopy(true);
    setError("");
    try {
      const updated = await regeneratePost(selected.id, revisionNote.trim());
      setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
      setRevisionNote("");
      setMakeStage(1);
      setPublishHint("已按审核意见重新生成文案，请重新审核后再制作封面。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "按意见重新生成失败");
    } finally {
      setRegeneratingCopy(false);
    }
  }

  async function handleSaveToPublish(post = selected) {
    if (!post) return;
    if (!(post.imageAssets?.length)) {
      setError("请先生成或上传至少一张封面图片，再保存到发布列表。");
      return;
    }
    if (!post.sourceReferences?.length || post.factCheck?.status !== "verified") {
      setError("请先在第 1 步核验官方来源，未核验的内容不能进入发布列表。");
      return;
    }
    const updated = await handlePostPatch(post.id, { status: "approved" });
    if (updated) {
      setSelectedId(updated.id);
      setActiveTab("publish");
      setPublishHint("已保存到发布列表，等待人工在小红书发布。");
    }
  }

  async function handlePublishBoardMark(post: MarketingPost) {
    const url = (publishUrlDrafts[post.id] ?? post.publishedUrl ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("标记已发布前，请填写有效的小红书笔记链接。");
      return;
    }
    const updated = await handlePostPatch(post.id, { status: "published", publishedUrl: url });
    if (updated) {
      setPublishUrlDrafts((current) => ({ ...current, [post.id]: updated.publishedUrl ?? url }));
      setPublishHint("已标记发布并回填笔记链接。");
    }
  }

  async function markSelectedPublishedWithUrl(url: string) {
    if (!selected) return;
    const normalizedUrl = url.trim();
    if (!normalizedUrl || !/^https?:\/\//i.test(normalizedUrl)) {
      setError("标记已发布前，请先填写有效的小红书笔记链接。");
      return;
    }
    const updated = await handlePatch({ status: "published", publishedUrl: normalizedUrl });
    if (updated) {
      setPublishSubmittedPostId("");
      setPublishHint("已回填小红书链接并标记为已发布。");
      await refresh();
    }
  }

  function handleMarkPublished() {
    void markSelectedPublishedWithUrl(selected?.publishedUrl ?? "");
  }

  async function handlePastePublishedUrlAndMark() {
    if (!selected) return;
    setUrlBackfillLoading(true);
    setError("");
    try {
      const clipboardText = await navigator.clipboard.readText();
      const match = clipboardText.match(/https?:\/\/\S+/i);
      const pastedUrl = match?.[0]?.replace(/[),，。；;\]]+$/g, "") ?? "";
      await markSelectedPublishedWithUrl(pastedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取剪贴板失败，请手动粘贴链接。");
    } finally {
      setUrlBackfillLoading(false);
    }
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
      setMakeStage(3);
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

  async function handleStartPublishPreflight() {
    if (!selected) return;
    setPreflightLoading(true);
    setError("");
    try {
      const previousGeneratedAt = preflight?.generatedAt;
      await startPublishPreflight(selected.id);
      setPublishHint("已启动账号预检。窗口会自动上传并填写测试内容，记录证据后自动关闭；无需按 Enter。运营台稍后自动刷新结果。");
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const nextPreflight = await getPreflightEvidence();
        if (nextPreflight.generatedAt && nextPreflight.generatedAt !== previousGeneratedAt) {
          setPreflight(nextPreflight);
          setGoLive(await getGoLiveStatus());
          setPublishHint(
            nextPreflight.ok
              ? "账号预检通过。现在可以点击“确认并发布”。"
              : `账号预检完成，但还缺：${nextPreflight.missingGroups.join(" / ") || "有效的新报告"}。可查看下方页面按钮候选。`
          );
          return;
        }
      }
      setPublishHint("账号预检仍在等待登录或页面加载。请在弹出的窗口完成登录，再重新点击账号预检。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动账号预检失败");
    } finally {
      setPreflightLoading(false);
    }
  }

  async function handlePrimaryPublishAction() {
    if (!selected) return;
    if (!previewImage) {
      await handleGenerateCoverImage();
      setPublishHint("封面已准备。请检查预览，随后复制图文并由账号管理员在小红书内人工发布。");
      return;
    }
    await handleCopyPublishText();
    setPublishHint("图文已复制。请在小红书创作中心上传封面、粘贴文案并由账号管理员人工点击发布；发布后回到这里粘贴笔记链接。");
  }

  const primaryPublishLabel = !previewImage
    ? "1. 生成封面"
    : "2. 复制图文，人工发布";

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
      <aside className="app-nav" aria-label="运营导航">
        <div className="nav-brand">
          <GraduationCap aria-hidden="true" size={22} strokeWidth={1.8} />
          <div>
            <strong>NTU CBA</strong>
            <span>华商会运营</span>
          </div>
        </div>
        <nav className="nav-links" aria-label="工作区">
          <button className={activeTab === "guide" ? "active" : ""} data-testid="nav-guide" onClick={() => setActiveTab("guide")} type="button"><ClipboardCheck aria-hidden="true" size={17} />流程</button>
          <button className={activeTab === "knowledge" ? "active" : ""} data-testid="nav-knowledge" onClick={() => setActiveTab("knowledge")} type="button"><BookOpen aria-hidden="true" size={17} />知识库</button>
          <button className={activeTab === "make" ? "active" : ""} data-testid="nav-make" onClick={() => setActiveTab("make")} type="button"><LayoutDashboard aria-hidden="true" size={17} />制作</button>
          <button className={activeTab === "publish" ? "active" : ""} data-testid="nav-publish" onClick={() => setActiveTab("publish")} type="button"><ClipboardCheck aria-hidden="true" size={17} />发布</button>
          <button className={activeTab === "calendar" ? "active" : ""} data-testid="nav-calendar" onClick={() => setActiveTab("calendar")} type="button"><CalendarDays aria-hidden="true" size={17} />内容日历</button>
          <button className={activeTab === "operations" ? "active" : ""} data-testid="nav-operations" onClick={() => setActiveTab("operations")} type="button"><Settings2 aria-hidden="true" size={17} />运营设置</button>
        </nav>
        <p className="nav-note">每天自动备稿，发布由账号管理员完成。</p>
      </aside>
      <div className="dashboard-main">
      <section className="topbar">
        <div>
          <p className="eyebrow">NTU CBA CHINESE BUSINESS ASSOCIATION</p>
          <h1>小红书运营台</h1>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {selected && false && activeTab === "publish" && (
        <section className="workflow-guide" aria-labelledby="workflow-heading">
          <div>
            <p className="eyebrow">TODAY'S RELEASE</p>
            <h2 id="workflow-heading">每天按这 5 步完成一篇</h2>
            <p>系统只负责备稿和整理，最后一步始终由账号管理员在小红书人工发布。</p>
          </div>
          <ol>
            <li><span>1</span><strong>选草稿<small>在内容工作台确认标题、正文和标签</small></strong></li>
            <li><span>2</span><strong>生成封面<small>使用平台生成的便利贴信息封面</small></strong></li>
            <li><span>3</span><strong>复制图文<small>把标题和正文复制到小红书创作中心</small></strong></li>
            <li><span>4</span><strong>人工发布<small>由已登录账号确认最终发布</small></strong></li>
            <li><span>5</span><strong>回填链接<small>粘贴笔记链接，之后补录数据</small></strong></li>
          </ol>
        </section>
      )}

      {selected && false && activeTab === "publish" && (
        <section className="operator-focus" id="today-workspace">
          <div className="focus-summary">
            <span>今日发布工作台</span>
            <h2>{publishPreview?.title ?? selected.title}</h2>
            <p>
              {approvedCount} 条待发布 / {publishedCount} 条已发布 / {goLiveGap}
            </p>
            <div className="focus-actions">
              <button
                className="primary-button publish-primary"
                onClick={handlePrimaryPublishAction}
                disabled={
                  coverLoading ||
                  preflightLoading
                }
              >
                {coverLoading
                  ? "生成封面中..."
                    : preflightLoading
                      ? "预检中..."
                      : primaryPublishLabel}
              </button>
              <button onClick={handleCopyPublishText}>复制发布文案</button>
            </div>
          </div>
          <div className="focus-preview">
            {previewImage ? (
              <img alt="当前封面预览" src={getImageAssetUrl(previewImage ?? "")} />
            ) : (
              <div>暂无封面</div>
            )}
          </div>
          <div className="focus-checklist">
            <strong>发布前确认</strong>
            <span className={previewImage ? "ok" : "todo"}>{previewImage ? "封面已绑定" : "先生成便利贴封面"}</span>
            <span className="ok">最终发布由账号管理员人工完成</span>
            <span className={selected.publishedUrl ? "ok" : "todo"}>
              {selected.publishedUrl ? "已回填发布链接" : "发布后回填链接"}
            </span>
          </div>
        </section>
      )}

      {activeTab === "publish" && (
        <section className="publish-board" aria-labelledby="publish-board-heading">
          <div className="publish-board-header">
            <div>
              <p className="eyebrow">PUBLISH QUEUE</p>
              <h2 id="publish-board-heading">发布管理</h2>
              <p>在小红书人工发布后，在这里回填链接并更新帖子状态。</p>
            </div>
            <div className="publish-counts"><strong>{approvedCount}</strong><span>待发布</span><strong>{publishedCount}</strong><span>已发布</span></div>
          </div>
          <div className="publish-posts">
            {posts.map((post) => {
              const url = publishUrlDrafts[post.id] ?? post.publishedUrl ?? "";
              return (
                <article className="publish-post" key={post.id}>
                  <div>
                    <span className={`status-pill ${post.status}`}>{statusLabels[post.status]}</span>
                    <h3>{post.title}</h3>
                    <p>{post.imageAssets?.length ? "封面已准备" : "缺少封面"} · {post.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}</p>
                  </div>
                  <div className="publish-post-actions">
                    <button onClick={() => { setSelectedId(post.id); setActiveTab("make"); }} type="button">继续制作</button>
                    {post.status !== "published" && <button onClick={() => void handlePostPatch(post.id, { status: "approved" })} type="button">设为待发布</button>}
                    <input aria-label={`${post.title} 发布链接`} onChange={(event) => setPublishUrlDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="粘贴发布后的笔记链接" value={url} />
                    {post.status === "published" ? (
                      post.publishedUrl && <a href={post.publishedUrl} rel="noreferrer" target="_blank">打开笔记</a>
                    ) : (
                      <button className="publish-mark" onClick={() => void handlePublishBoardMark(post)} type="button">标记已发布</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "operations" && (
      <details className="operations-drawer" open>
        <summary>
          <span>运营数据与设置</span>
          <small>排期、数据、自动化和交接工具</small>
        </summary>
        <div className="operations-content">
          <div className="operations-utilities">
            <span>账号辅助</span>
            <button data-testid="assisted-publish" onClick={handleStartAssistedPublish} disabled={publishLoading}>
              {publishLoading ? "打开中..." : "辅助填充（可选）"}
            </button>
          </div>
      <section className="scoreboard" id="performance-summary">
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
            <strong>{preflight.ok ? "选择器已命中" : preflight.stale ? "报告已过期" : "等待真实账号证据"}</strong>
          </div>
          <div>
            <span>报告路径</span>
            <strong>{preflight.path}</strong>
          </div>
          <div>
            <span>缺失项</span>
            <strong>{preflight.missingGroups.length ? preflight.missingGroups.join(" / ") : "无"}</strong>
          </div>
          <button onClick={handleStartPublishPreflight} disabled={preflightLoading}>
            {preflightLoading ? "预检中..." : "从前端启动账号预检"}
          </button>
          <div className="preflight-groups">
            {Object.entries(preflight.groups).map(([group, evidence]) => (
              <span className={evidence.ok ? "ready" : "blocked"} key={group}>
                {preflightGroupLabels[group as keyof typeof preflightGroupLabels]}: {evidence.ok ? "OK" : "缺失"}
              </span>
            ))}
          </div>
          {preflight.diagnostics.visibleButtons.length > 0 && (
            <div className="preflight-diagnostics">
              <strong>页面按钮候选</strong>
              {preflight.diagnostics.visibleButtons.slice(0, 8).map((button, index) => (
                <span key={`${button.text}-${button.ariaLabel}-${index}`}>
                  {button.text || button.ariaLabel}
                </span>
              ))}
            </div>
          )}
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
            <div className="automation-actions">
              <button
                onClick={() => handleDailyTaskOperation("install")}
                disabled={scheduleLoading !== "" || dailyTask.installed}
              >
                {scheduleLoading === "install" ? "安装中..." : "安装每日任务"}
              </button>
              <button onClick={refreshDailyTaskStatus} disabled={scheduleLoading !== ""}>
                刷新状态
              </button>
              <button
                onClick={() => handleDailyTaskOperation("uninstall")}
                disabled={scheduleLoading !== "" || !dailyTask.installed}
              >
                {scheduleLoading === "uninstall" ? "卸载中..." : "卸载任务"}
              </button>
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
        </div>
      </details>
      )}

      {activeTab === "calendar" && (
        <section className="calendar-panel calendar-view" id="content-calendar">
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
      )}

      {activeTab === "guide" && (
        <section className="make-guide" aria-labelledby="make-guide-heading">
          <div>
            <p className="eyebrow">MAKE A POST</p>
            <h2 id="make-guide-heading">制作一篇可发布的笔记</h2>
            <p>按照下方 3 步完成审核、封面和最终预览；保存后才会进入发布列表。</p>
          </div>
          <ol>
            <li className={makeStage === 1 ? "active" : ""}><button onClick={() => { setMakeStage(1); setActiveTab("make"); }} type="button"><span>1</span><strong>生成与审核<small>生成文案和标签，修改后保存审核意见</small></strong></button></li>
            <li className={makeStage === 2 ? "active" : ""}><button onClick={() => { setMakeStage(2); setActiveTab("make"); }} type="button"><span>2</span><strong>制作封面<small>生成模板封面，或上传自己的图片</small></strong></button></li>
            <li className={makeStage === 3 ? "active" : ""}><button onClick={() => { setMakeStage(3); setActiveTab("make"); }} type="button"><span>3</span><strong>预览并保存<small>确认图文无误，保存到发布列表</small></strong></button></li>
          </ol>
        </section>
      )}

      {activeTab === "knowledge" && (
        <section className="knowledge-workspace" aria-labelledby="knowledge-heading">
          <header className="knowledge-header">
            <div>
              <p className="eyebrow">SOURCE LIBRARY</p>
              <h2 id="knowledge-heading">NTU 内容知识库</h2>
              <p>Reddit 优先提供本地学生正在讨论的话题、痛点和叙事角度；官方来源只负责核验可写的事实。社区内容不会被逐句改写，也不会被当成学校事实。</p>
            </div>
            <div className="knowledge-counts">
              <strong>{knowledge?.officialSources.length ?? 0}</strong><span>官方来源</span>
              <strong>{knowledge?.researchSignals.length ?? 0}</strong><span>社区洞察</span>
            </div>
          </header>

          <section className="knowledge-link-card">
            <div>
              <p className="eyebrow">IMPORT</p>
              <h3>导入公开链接</h3>
              <p>粘贴一条公开 Reddit 或小红书链接，系统只保留脱敏选题信号；不会把社区内容当作事实。</p>
            </div>
            <div className="knowledge-link-actions">
              <input aria-label="公开链接" placeholder="https://www.reddit.com/..." value={researchForm.sourceUrl} onChange={(event) => setResearchForm((form) => ({ ...form, sourceUrl: event.target.value }))} />
              <button className="primary-button" disabled={researchLoading || !researchForm.sourceUrl.trim()} onClick={() => void handleUploadPublicLink()} type="button">
                <Upload aria-hidden="true" size={16} />{researchLoading ? "正在收录..." : "收录链接"}
              </button>
            </div>
            <label className="corpus-upload-control compact-corpus-upload">
              <Upload aria-hidden="true" size={15} />
              <span>{corpusImportLoading ? "正在导入本地采集包..." : "导入本地 Reddit 采集包 (.jsonl)"}</span>
              <input accept=".jsonl,application/json" disabled={corpusImportLoading} onChange={(event) => void handleLocalCorpusImport(event.target.files?.[0])} type="file" />
            </label>
          </section>

          <section className="knowledge-import-card">
            <div className="make-step-heading">
              <div>
                <span>本地采集包</span>
                <h3>导入已下载的 Reddit 主题分类</h3>
                <p>选择本机的 <code>.tmp/reddit-ntu-content-corpus.jsonl</code>。浏览器会先在本机分类，只同步链接、主题标签和去标识化摘要。</p>
              </div>
            </div>
            <label className="corpus-upload-control">
              <Upload aria-hidden="true" size={16} />
              <span>{corpusImportLoading ? "正在本地分类并导入..." : "选择本地采集包"}</span>
              <input accept=".jsonl,application/json" disabled={corpusImportLoading} onChange={(event) => void handleLocalCorpusImport(event.target.files?.[0])} type="file" />
            </label>
            <small>原贴正文、评论、用户资料与账号标识不会上传到知识库。</small>
          </section>

          <section className="knowledge-batch-card">
            <div className="make-step-heading">
              <div>
                <span>第一步：整理链接</span>
                <h3>批量放入待审核队列</h3>
                <p>从 Reddit 搜索结果复制公开帖子链接，每行一条。系统只校验、去重和保存链接，不会读取或保存帖子正文。</p>
              </div>
            </div>
            <textarea aria-label="Reddit 公开链接列表" className="batch-url-input" placeholder={"https://www.reddit.com/r/NTU/comments/...\nhttps://www.reddit.com/r/SGExams/comments/..."} rows={5} value={batchUrls} onChange={(event) => setBatchUrls(event.target.value)} />
            <button className="primary-button" disabled={batchLoading || !batchUrls.trim()} onClick={() => void handleQueueResearchSignals()} type="button">
              <BookOpen aria-hidden="true" size={16} />{batchLoading ? "正在整理..." : "整理为待审核链接"}
            </button>
          </section>

          {(knowledge?.researchSignals ?? []).some((signal) => signal.status === "pending_review") && (
            <section className="knowledge-pending-card">
              <div className="knowledge-section-heading"><h3>第二步：人工提炼并核准</h3><span>待审核条目不会用于生成文案</span></div>
              <div className="pending-signal-grid">
                {(knowledge?.researchSignals ?? []).filter((signal) => signal.status === "pending_review").map((signal) => {
                  const draft = reviewDrafts[signal.id] ?? { theme: signal.theme, audience: signal.audience, insight: signal.insight };
                  return (
                    <article className="pending-signal-card" key={signal.id}>
                      <a href={signal.sourceUrl} rel="noreferrer" target="_blank">打开公开链接</a>
                      <label>选题主题<input value={draft.theme} onChange={(event) => setReviewDrafts((current) => ({ ...current, [signal.id]: { ...draft, theme: event.target.value } }))} /></label>
                      <label>适合谁看<input value={draft.audience} onChange={(event) => setReviewDrafts((current) => ({ ...current, [signal.id]: { ...draft, audience: event.target.value } }))} /></label>
                      <label>你的概述<textarea rows={3} value={draft.insight} onChange={(event) => setReviewDrafts((current) => ({ ...current, [signal.id]: { ...draft, insight: event.target.value } }))} /></label>
                      <div className="pending-signal-actions">
                        <button disabled={researchLoading} onClick={() => void handleApproveResearchSignal(signal)} type="button">核准入库</button>
                        <button disabled={researchLoading} onClick={() => void handleDeleteResearchSignal(signal.id)} type="button">移除</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="knowledge-add-card">
            <div className="make-step-heading">
              <div>
                <span>收录公开参考</span>
                <h3>把一篇公开笔记转成可复用洞察</h3>
                <p>支持小红书或 Reddit 公开链接。只填写链接和你的概括，不要粘贴正文、截图、作者昵称或私人信息。</p>
              </div>
            </div>
            <div className="knowledge-form-grid">
              <label>公开链接<input placeholder="https://www.reddit.com/... 或 https://www.xiaohongshu.com/..." value={researchForm.sourceUrl} onChange={(event) => setResearchForm((form) => ({ ...form, sourceUrl: event.target.value }))} /></label>
              <label>选题主题<input placeholder="例如：刚入学的信息过载" value={researchForm.theme} onChange={(event) => setResearchForm((form) => ({ ...form, theme: event.target.value }))} /></label>
              <label>适合谁看<input value={researchForm.audience} onChange={(event) => setResearchForm((form) => ({ ...form, audience: event.target.value }))} /></label>
              <label className="knowledge-insight">你提炼的洞察<textarea placeholder="例如：新生更需要一个按时间顺序的行动清单，而不是泛泛的校园介绍。请用自己的话概括，不要复制原笔记。" rows={4} value={researchForm.insight} onChange={(event) => setResearchForm((form) => ({ ...form, insight: event.target.value }))} /></label>
            </div>
            <button className="primary-button" disabled={researchLoading || !researchForm.sourceUrl.trim() || !researchForm.insight.trim()} onClick={() => void handleSaveResearchSignal()} type="button">
              <BookOpen aria-hidden="true" size={16} />{researchLoading ? "正在收录..." : "收录为公开洞察"}
            </button>
          </section>

          <section className="reddit-sync-card">
            <div>
              <span>REDDIT TREND SYNC</span>
              <h3>同步 r/NTU 的匿名化选题信号</h3>
              <p>{knowledge?.reddit.scope ?? "仅收录经人工确认的公开帖子元数据，不保存作者、标题正文或评论。"}</p>
              <small>范围：{knowledge?.reddit.communities.join("、") ?? "r/NTU、r/SGExams（仅 NTU 搜索）"}。浏览器采集与 API 信号均在 {knowledge?.reddit.retentionDays ?? 30} 天后自动清理。</small>
            </div>
            <button className="primary-button" disabled={redditSyncLoading || !knowledge?.reddit.configured} onClick={() => void handleRedditSync()} type="button">
              <BookOpen aria-hidden="true" size={16} />{redditSyncLoading ? "正在同步..." : knowledge?.reddit.configured ? "同步 Reddit 趋势" : "当前使用浏览器采集样本"}
            </button>
          </section>

          <section className="knowledge-section">
            <div className="knowledge-section-heading">
              <h3>公开社区洞察</h3>
              <label className="knowledge-tag-filter">主题筛选
                <select onChange={(event) => setKnowledgeTagFilter(event.target.value)} value={knowledgeTagFilter}>
                  <option value="all">全部主题</option>
                  {knowledgeTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </label>
            </div>
            {visibleResearchSignals.length ? (
              <div className="research-signal-grid">
                {visibleResearchSignals.map((signal) => (
                  <article className="research-signal-card" key={signal.id}>
                    <div><span>{signal.sourceType === "reddit" ? `Reddit · ${signal.collectionMethod === "browser-curated" ? "浏览器采集" : signal.collectionMethod === "api" ? "API 同步" : "人工收录"} · ${signal.audience}${signal.interactionCount !== undefined ? ` · ${signal.interactionCount} 互动` : ""}` : `小红书 · ${signal.audience}`}</span>{!signal.readOnly && <button aria-label="删除该公开洞察" onClick={() => void handleDeleteResearchSignal(signal.id)} type="button">删除</button>}</div>
                    <h4>{signal.theme}</h4>
                    {signal.tags?.length ? <div className="research-signal-tags">{signal.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                    <p>{signal.insight}</p>
                    <a href={signal.sourceUrl} rel="noreferrer" target="_blank">打开公开参考</a>
                  </article>
                ))}
              </div>
            ) : <p className="empty">{knowledge ? "还没有社区洞察。可以手动收录经确认的 Reddit 链接；完成 Reddit API 配置后，也可同步匿名化选题信号。" : "知识库服务尚未更新。完成 Cloudflare Worker 更新后会显示浏览器采集样本并可收录社区洞察。"}</p>}
          </section>

          <section className="knowledge-section">
            <div className="knowledge-section-heading"><h3>官方事实来源</h3><span>生成可发布内容时的唯一事实依据</span></div>
            <div className="official-source-grid">
              {(knowledge?.officialSources ?? []).map((source) => <a className="official-source-card" href={source.url} key={source.id} rel="noreferrer" target="_blank"><strong>{source.title}</strong><span>{source.publisher}</span><small>{source.claims[0]}</small></a>)}
            </div>
          </section>
        </section>
      )}

      {activeTab === "make" && !selected && (
        <section className="editor make-step-card empty-make-state" aria-labelledby="empty-make-heading">
          <div className="make-step-heading">
            <div>
              <span>第一步</span>
              <h2 id="empty-make-heading">开始制作第一篇笔记</h2>
              <p>当前发布库为空。先由 AI 生成一篇基于 NTU 官方来源的草稿，随后再审核文案、制作封面并保存到发布列表。</p>
            </div>
            <button className="primary-button" onClick={handleGenerate} disabled={loading} type="button">
              <PenLine aria-hidden="true" size={16} />
              {loading ? "正在生成..." : "AI 生成首篇文案"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "make" && selected && (
      <section className="workspace" id="content-library">
        <header className="make-toolbar">
          <div>
            <p className="eyebrow">MAKE</p>
            <h2>制作笔记</h2>
            <p>按顺序完成文案、封面和预览；当前笔记始终在同一页完成。</p>
          </div>
        </header>

        {selected && (
          <section className="editor make-step-card">
            <div className="make-step-heading">
              <div>
                <span>第 1 步</span>
                <h3>AI 生成与审核文案</h3>
                <p>生成标题、正文和标签后，在这里直接修改或提交审核意见。</p>
              </div>
              <button className="primary-button" onClick={handleGenerate} disabled={loading} type="button">
                <PenLine aria-hidden="true" size={16} />
                {loading ? "生成中" : "AI 生成新文案"}
              </button>
            </div>
            <div className="meta-row">
              <span>{statusLabels[selected.status]}</span>
              <span>{selected.topic.targetSegment}</span>
              <span>评分 {selected.review.score}</span>
              <span>{selected.generator}</span>
            </div>

            <section className="draft-provenance" aria-label="本篇取材说明">
              <strong>本篇取材说明</strong>
              <p>
                {selected.generator === "deepseek-source-constrained"
                  ? `AI 已使用 ${selected.topic.localSignals.filter((signal) => signal.startsWith("社区洞察")).length} 条脱敏社区洞察确定选题与结构，并匹配 ${selected.sourceReferences?.length ?? 0} 个官方事实来源。社区内容不作为事实依据。`
                  : "这是模板或未成功调用模型的兜底稿，尚未完成社区洞察取材，不能直接进入发布列表。"}
              </p>
              {selected.generator === "deepseek-source-constrained" && selected.topic.localSignals.length > 0 && (
                <div className="provenance-signals">{selected.topic.localSignals.map((signal) => <span key={signal}>{signal}</span>)}</div>
              )}
            </section>

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

            <section className="revision-step">
              <strong>审核意见</strong>
              <textarea onChange={(event) => setRevisionNote(event.target.value)} placeholder="例如：标题更口语一点；内容增加一个真实的校园场景。" rows={3} value={revisionNote} />
              <div className="revision-actions">
                <button disabled={!revisionNote.trim()} onClick={() => void handleSaveRevisionNote()} type="button">只保存意见</button>
                <button className="regenerate-copy" disabled={!revisionNote.trim() || regeneratingCopy} onClick={() => void handleRegenerateFromFeedback()} type="button">
                  {regeneratingCopy ? "AI 重写中..." : "按意见 AI 重新生成"}
                </button>
              </div>
              {(selected.revisionNotes?.length ?? 0) > 0 && <small>最近意见：{selected.revisionNotes?.at(-1)}</small>}
            </section>
            <section className="source-check">
              <div>
                <strong>来源与事实核验</strong>
                <span className={`fact-status ${selected.factCheck?.status ?? "blocked"}`}>
                  {selected.factCheck?.status === "verified" ? "已人工核验" : selected.factCheck?.status === "blocked" ? "已拦截，需改写" : "待人工核验"}
                </span>
              </div>
              <p>AI 只能使用下列官方来源中的事实；具体日期、规则与活动信息仍需逐条打开链接确认。</p>
              {(selected.sourceReferences ?? []).length > 0 ? (
                <ul>
                  {(selected.sourceReferences ?? []).map((source) => (
                    <li key={source.id}>
                      <a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>
                      <small>{source.publisher} · 已访问 {source.accessedAt}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <small>此旧草稿没有来源记录。请用 AI 重新生成后再继续。</small>
              )}
              {selected.factCheck?.status === "blocked" && selected.factCheck.notes.length > 0 && (
                <small>拦截原因：{selected.factCheck.notes.slice(1).join("；") || selected.factCheck.notes[0]}</small>
              )}
              <button disabled={selected.factCheck?.status === "verified" || selected.factCheck?.status === "blocked" || !(selected.sourceReferences?.length)} onClick={() => void handleVerifySources()} type="button">
                {selected.factCheck?.status === "verified" ? "来源已核验" : selected.factCheck?.status === "blocked" ? "请先改写受限内容" : "我已逐条核验来源"}
              </button>
            </section>
            <button className="advance-step" disabled={makeStage !== 1} onClick={() => setMakeStage(2)} type="button">文案审核通过，进入第 2 步制作封面</button>

            <details className="editor-details">
              <summary>发布数据与回填</summary>
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
              <div className="url-backfill-actions">
                <button onClick={handlePastePublishedUrlAndMark} type="button" disabled={urlBackfillLoading}>
                  {urlBackfillLoading ? "读取中..." : "粘贴链接并标记已发布"}
                </button>
                {selected.publishedUrl && (
                  <a href={selected.publishedUrl} rel="noreferrer" target="_blank">
                    打开笔记
                  </a>
                )}
              </div>
            </div>

            <div className="actions">
              <button onClick={() => handlePatch({ status: "approved" })}>设为待发布</button>
              <button onClick={handleMarkPublished}>标记已发布</button>
              <button onClick={() => handlePatch({ status: "archived" })}>归档</button>
            </div>
            </details>
          </section>
        )}

        {selected && (
          <section className="make-actions" id="publish-checklist">
            <section className="make-cover-step make-step-card">
              <div className="make-step-heading">
                <div>
                  <span>第 2 步</span>
                  <h3>制作封面图片</h3>
                  <p>{previewImage ? "已绑定封面；可以重新生成，也可以换成自己上传的图片。" : "使用 AI 生成一张模板封面，或上传自己的图片。"}</p>
                </div>
              </div>
              <div className="cover-actions">
                <button className="ai-cover-button" onClick={handleGenerateCoverImage} disabled={coverLoading} type="button">{coverLoading ? "AI 制图中..." : "AI 生成封面"}</button>
                <label className="image-upload-control">上传图片<input accept="image/png,image/jpeg,image/webp" disabled={uploadingImage} onChange={(event) => void handleUploadCover(event.target.files?.[0])} type="file" /></label>
              </div>
            <button className="advance-step" disabled={!previewImage || makeStage > 2} onClick={() => setMakeStage(3)} type="button">封面完成，进入第 3 步预览</button>
            <details className="side-details">
              <summary>选题信息</summary>
              <dl>
                <dt>角度</dt>
                <dd>{selected.topic.angle}</dd>
                <dt>本地信号</dt>
                <dd>{selected.topic.localSignals.join(" / ")}</dd>
                <dt>审核备注</dt>
                <dd>{selected.review.notes.join("；")}</dd>
              </dl>
            </details>
            </section>
            <section className="preview-step make-step-card">
              <div className="make-step-heading">
                <div>
                  <span>第 3 步</span>
                  <h3>预览并保存</h3>
                  <p>确认标题、正文、标签和封面无误后，保存到发布列表。</p>
                </div>
              </div>
              <div className="preview">
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
            <details className="side-details">
              <summary>更多发布工具</summary>
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
              <button onClick={handleStartPublishPreflight} disabled={preflightLoading}>
                {preflightLoading ? "预检中..." : "账号预检"}
              </button>
              <button onClick={handleStartAssistedPublish} disabled={publishLoading}>
                {publishLoading ? "打开中..." : "只填充，不发布"}
              </button>
              <span>{selected.imageAssets?.length ?? 0} 张图片素材已绑定</span>
              {selected.publishedUrl && (
                <a href={selected.publishedUrl} rel="noreferrer" target="_blank">
                  打开已发布笔记
                </a>
              )}
              {publishHint && <p>{publishHint}</p>}
              {visualBrief && <pre>{visualBrief}</pre>}
              </div>
            </details>
            <button className="save-to-publish" disabled={!previewImage} onClick={() => void handleSaveToPublish()} type="button">确认无误，保存到发布列表</button>
            </section>
          </section>
        )}
      </section>
      )}
      </div>
    </main>
  );
}

export default App;

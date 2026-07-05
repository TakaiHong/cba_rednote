import { useEffect, useMemo, useState } from "react";
import {
  generatePost,
  getPublishPackage,
  listPosts,
  type MarketingPost,
  updatePost
} from "./api.js";

const statusLabels: Record<MarketingPost["status"], string> = {
  draft: "草稿",
  approved: "待发布",
  published: "已发布",
  archived: "归档"
};

function App() {
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publishHint, setPublishHint] = useState("");

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? posts[0],
    [posts, selectedId]
  );

  async function refresh() {
    setError("");
    try {
      const nextPosts = await listPosts();
      setPosts(nextPosts);
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
              <code>npm.cmd run publish -- --post {selected.id}</code>
              {publishHint && <p>{publishHint}</p>}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}

export default App;

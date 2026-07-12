# 运营手册

## 每日流程

启动本地平台：

```powershell
npm.cmd run local:start
npm.cmd run health
```

如果后台启动没有保持在线，直接保留一个 PowerShell 窗口运行：

```powershell
npm.cmd run dev
```

打开运营台：`http://127.0.0.1:5173`

后端 API：`http://127.0.0.1:8787`

停止本地后台服务：

```powershell
npm.cmd run local:stop
```

1. 生成草稿。

生成单条草稿：

```powershell
npm.cmd run generate
```

一次准备多条草稿：

```powershell
npm.cmd run generate:batch -- --count 7 --dry-run
npm.cmd run generate:batch -- --count 7 --max-model-posts 1
```

运营台里的“批量准备 7 条”按钮使用同一套批量生成逻辑。`--max-model-posts` 用来限制本次批量任务里最多多少条可以调用 DeepSeek 等付费模型；测试时建议保持较低。

如果生成内容被标记为 `draft`，并且审核备注里出现相似度提示，需要人工确认是否与历史内容过近，再改成待发布状态。

2. 在运营台审核和编辑。

用内容池搜索框和状态筛选查看草稿、待发布、已发布或归档内容。审核时重点看标题是否像真人写的、正文是否自然、标签是否贴合新加坡场景、CTA 是否过硬。

3. 规划未来选题。

```powershell
npm.cmd run calendar -- --days 7 --out .tmp/content-calendar.md
```

内容日历用于检查人群和内容形式是否足够分散，避免连续几天都写同一种“搬家断档”硬广。

4. 导出交接包。

如果发布由另一个人执行，先导出 Markdown：

```powershell
npm.cmd run export -- --post latest
```

如需一次性打包当前状态、最近草稿和发布材料：

```powershell
npm.cmd run handoff -- --out .tmp/handoff
```

handoff 包会包含 `status.json`、`readiness-checks.json`、`go-live-check.json`、7 天内容日历、批量生成 dry-run、最新发布包和 `image-assets/` 图片素材包。`go-live-check.json` 会把真实账号 preflight、已发布链接回填证据和下一步命令一起列出来。

5. 校验发布包。

```powershell
npm.cmd run publish -- --post latest --dry-run
```

dry-run 会输出标题、正文、标签、封面文字、图片 brief、AI 出图 prompt 和素材清单，不打开浏览器。

6. 使用半自动浏览器发布。

```powershell
npm.cmd run publish -- --post latest
```

运营人员优先在运营台顶部“今日发布工作台”或右侧“发布助手”点击“账号预检”，确认选择器命中后再点“打开小红书发布”。后端会启动本地 Playwright 浏览器，复用登录态，直达小红书“上传图文”页，上传绑定封面并填写标题、正文和标签。默认不点击最终发布按钮，发布前必须人工检查页面。上面的 CLI 命令保留为兜底。

带本地图片：

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

脚本会直达小红书“上传图文”发布页，复用本地登录态，复制内容并尽量填充标题、正文和图片。默认不点击最终发布按钮，发布前必须人工检查页面。

7. 发布后回写链接和状态。

在小红书复制已发布笔记链接，回到运营台“发布效果”区点击“粘贴链接并标记已发布”。运营台会从剪贴板读取第一个 `http` 或 `https` 链接，回填小红书链接，并把当前笔记标记为已发布。

CLI 兜底：

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

CLI 回写要求 `--published-url` 是合法的 `http` 或 `https` 链接，避免产生“已发布但没有证据”的记录。也可以手动把小红书笔记链接粘贴到“发布链接”字段，再点“标记已发布”。

8. 回填效果数据。

在运营台录入曝光、点赞、收藏、评论、关注和咨询数。至少积累 3 条有指标的内容后，再看系统给出的下一步内容建议。

## 状态检查

常用检查命令：

```powershell
npm.cmd run status
npm.cmd run readiness
npm.cmd run go-live:check
npm.cmd run ui:smoke
npm.cmd run verify
```

- `status` 展示内容数量、最新草稿、模型配置、成本汇总、常用命令、最近运行记录和内容策略建议。
- `readiness` 检查交付必备项，把 required failure 和 warning 分开。
- `go-live:check` 用正式上线口径检查真实账号 preflight 和至少一条已发布 URL；缺少任一项都会失败。
- `ui:smoke` 用本机 Chrome 检查运营台是否能正常渲染、标题是否正确、中文是否无乱码、控制台是否无错误。
- `verify` 运行密钥扫描、类型检查、测试、生产构建、状态输出、readiness、批量生成 dry-run、发布 dry-run、导出、图片素材包导出、handoff、备份 dry-run、定时任务 dry-run 和定时任务状态检查。

用 `npm.cmd run health` 检查前端、后端端口和 `/api/health`、`/api/status` 是否正常。

## 模型成本

默认本地模板生成不产生 API 成本。要使用 DeepSeek，把 `DEEPSEEK_API_KEY` 写到 `.env` 或当前 shell 环境变量里，不要提交到 Git。

建议配置：

```powershell
DEEPSEEK_MODEL=deepseek-v4-flash
MODEL_COST_CNY_PER_POST_ESTIMATE=0.12
MAX_COST_CNY_PER_POST=0.5
```

首次测试 DeepSeek 时只生成 1 条；批量准备内容时用 `--max-model-posts 1` 控制预算。

## 数据备份

较大改动或交接前先备份运行数据：

```powershell
npm.cmd run backup
```

只预览备份目标：

```powershell
npm.cmd run backup:dry-run
```

备份写入 `backups/`，该目录不会提交到 Git。

## 每日自动化

优先在运营台“每日自动化”卡片点击“安装每日任务”。安装后点击“刷新状态”，确认任务状态和下次运行时间。

CLI 兜底安装 Windows 任务计划程序：

```powershell
npm.cmd run schedule:install
```

只检查安装计划：

```powershell
npm.cmd run schedule:dry-run
```

检查任务是否已安装、上次运行结果和下次运行时间：

```powershell
npm.cmd run schedule:status
```

优先在运营台“每日自动化”卡片点击“卸载任务”。CLI 兜底卸载任务：

```powershell
npm.cmd run schedule:uninstall
```

默认每日时间由 `.env` 的 `DAILY_CRON` 控制。

## 小红书账号验证

第一次真实发布前先做预检：

1. 在运营台顶部“今日发布工作台”或右侧“发布助手”点击“账号预检”。
2. 在打开的浏览器里登录或扫码。
3. 等待运营台自动刷新，确认标题、正文、上传和发布按钮选择器有命中。
4. `.tmp/xhs-preflight-report.json` 会作为真实账号页面的选择器证据。
5. 如果选择器没有命中，更新 `config/xhs-selectors.json`。
6. 再次点击“账号预检”，确认通过后再执行真实辅助发布。

CLI 兜底命令：

```powershell
npm.cmd run publish:preflight
```

最终发布点击默认关闭。只有当账号登录态稳定、preflight 报告显示 `publishButton` 可用，并且人工确认过页面内容后，才设置 `XHS_ALLOW_FINAL_PUBLISH=true` 并使用：

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs --click-publish
```

## 交接前证据

交接给运营或发布人员前，建议保留这些输出：

- `npm.cmd run verify` 通过记录。
- `npm.cmd run health` 通过记录。
- `npm.cmd run readiness` 输出，required failure 必须为 0。
- `.tmp/content-calendar.md`。
- `.tmp/handoff`。
- 最新导出的 Markdown 发布包。
- 真实账号的 `.tmp/xhs-preflight-report.json`。
- 至少一条已经发布并回填链接的内容。

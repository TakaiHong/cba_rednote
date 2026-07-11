# Code Map

## Root

- `package.json`：脚本、依赖和项目入口。
- `tsconfig.json`：TypeScript 配置。
- `.env.example`：本地环境变量模板。
- `config/xhs-selectors.json`：小红书创作者中心页面选择器配置。
- `tests/`：生成器、发布包和存储层的自动化测试。

## Server

- `server/src/index.ts`：Express 服务入口，挂载 API 和定时任务。
- `server/src/app.ts`：创建 Express app，供生产入口和路由测试复用，并暴露状态、go-live、每日任务和 handoff 生成 API。
- `server/src/analytics/contentStrategy.ts`：按内容风格和目标人群汇总效果，并生成下一条内容建议。
- `server/src/config.ts`：环境变量和成本配置。
- `server/src/modelConfig.ts`：模型供应商、DeepSeek alias、base URL、模型名和单条成本估算解析。
- `server/src/status.ts`：系统状态汇总，供 API 和 CLI 使用。
- `server/src/analytics/performanceReport.ts`：生成发布后复盘 Markdown，汇总曝光、互动、咨询和回填清单。
- `server/src/analytics/exportPerformanceReport.ts`：导出独立 `performance-report.md`，供 CLI 和运营台复用。
- `server/src/backup.ts`：备份运行数据，供运营台和备份 API 使用。
- `server/src/scheduleStatus.ts`：解析 Windows 每日生成任务状态，供运营台状态 API 使用。
- `server/src/types.ts`：帖子、状态、agent 输出等共享类型。
- `server/src/storage/postStore.ts`：JSON 文件存储。
- `server/src/generation/agents.ts`：选题、文案、审核和成本 agent。
- `server/src/generation/contentCalendar.ts`：生成未来 1 到 30 天的小红书选题排期。
- `server/src/generation/generator.ts`：生成流程编排。
- `server/src/generation/qualityGuard.ts`：标题和正文相似度检查，降低重复内容风险。
- `server/src/publishing/xhsPackage.ts`：小红书发布包格式化，供 API、前端和脚本共用，包含正文、标签、封面文字、图片 brief 和已绑定图片素材。
- `server/src/publishing/exportPackage.ts`：把单条内容导出为 Markdown 发布包，供 CLI 和运营台共用。
- `server/src/publishing/finalPublish.ts`：最终发布点击的双保险开关，要求命令参数和环境变量同时开启。
- `server/src/publishing/selectorConfig.ts`：读取和校验小红书页面选择器配置。
- `server/src/publishing/imageInputs.ts`：解析发布脚本的本地图片输入，并和草稿绑定的图片素材一起用于上传。
- `server/src/routes/posts.ts`：草稿列表、创建、编辑、生成接口。
- `server/src/scheduler.ts`：每日生成定时任务。
- `server/src/cli/generate.ts`：命令行生成入口。
- `server/src/cli/status.ts`：命令行状态输出入口。

## Client

- `client/index.html`：Vite HTML 入口。
- `client/src/main.tsx`：React 入口。
- `client/src/App.tsx`：运营台主界面，含草稿编辑、图片素材路径维护、单条/批量生成、内容排期、每日自动化状态、go-live 状态、交接包生成、运行数据备份、交接命令复制区、Markdown 导出、发布助手和效果指标录入。
- `client/src/api.ts`：前端 API 客户端。
- `client/src/styles.css`：界面样式。

## Scripts

- `scripts/export-xhs.ts`：导出小红书 Markdown 图文交接包。
- `scripts/export-performance-report.ts`：导出独立发布效果复盘报告。
- `scripts/plan-calendar.ts`：导出未来内容排期，支持 Markdown 或 JSON。
- `scripts/generate-batch.ts`：批量生成草稿，支持 dry-run 和付费模型条数上限。
- `scripts/go-live-check.ts`：正式上线检查，把真实账号 preflight 和已发布 URL 证据作为硬门槛。
- `scripts/handoff-package.ts`：集中导出交付状态、go-live 状态、内容排期、批量生成 dry-run、最新发布包、first-publish-checklist.md 首发清单、performance-report.md 复盘报告和图片素材包。
- `scripts/prepare-image-assets.ts`：导出图片素材交接包，包含封面文字、图片 brief、AI 出图 prompt、素材清单和上传命令。
- `scripts/generate-cover-image.ts`：用草稿内容生成低成本 3:4 PNG 模板封面，并可把图片路径绑定回草稿。
- `scripts/publish-xhs.ts`：小红书半自动发布脚本，支持 dry-run、登录态复用、辅助填充和发布后状态回写。
- `scripts/install-daily-task.ps1`：Windows 任务计划程序安装器，用于每天自动生成小红书草稿。
- `scripts/check-daily-task.ps1`：查询 Windows 每日生成任务是否已安装、上次运行结果和下次运行时间。
- `scripts/start-local.ps1`：后台启动本地前后端服务。
- `scripts/stop-local.ps1`：停止监听本地前后端端口的服务进程。
- `scripts/health-check.ps1`：检查本地端口、健康接口和状态接口。
- `scripts/ui-smoke.ts`：用本机 Chrome 检查运营台页面渲染、标题、乱码和控制台错误。
- `scripts/backup-data.ps1`：备份运行时草稿数据。
- `scripts/check-secrets.ts`：扫描 Git 跟踪文件中的 API key 形状文本，避免 DeepSeek 或 OpenAI-compatible key 被提交。
- `scripts/readiness.ts`：交接前 readiness 检查，汇总前后端、生成、预算、发布和文档状态。

## Docs

- `docs/requirements.md`：需求文档。
- `docs/architecture.md`：架构文档。
- `docs/code-map.md`：代码地图。
- `docs/xiaohongshu-publishing.md`：发布流程和风控说明。
- `docs/operations-runbook.md`：日常运营、验收和账号验证手册。
- `docs/model-config.md`：DeepSeek 和 OpenAI-compatible 低成本模型配置说明。
- `docs/acceptance-checklist.md`：本地验收、DeepSeek、真实账号发布验证和交接证据清单。

## Verification

- `npm.cmd run lint`：TypeScript 类型检查。
- `npm.cmd run test`：Node test runner 单元测试。
- `npm.cmd run build`：生产构建。
- `npm.cmd run status`：输出内容池、预算和常用命令状态。
- `npm.cmd run readiness`：输出交接前验收清单。
- `npm.cmd run go-live:check`：检查真实小红书账号 preflight 和已发布 URL 是否满足正式上线门槛。
- `npm.cmd run calendar -- --days 7`：输出未来 7 天内容排期。
- `npm.cmd run generate:batch -- --count 7 --dry-run`：预估批量生成数量和最高模型成本。
- `npm.cmd run handoff -- --out .tmp/handoff`：导出交付包，包含最新发布包、`go-live-check.json`、`first-publish-checklist.md`、`performance-report.md` 和 `image-assets/` 图片素材包。
- `npm.cmd run image:brief -- --post latest --out .tmp/image-assets`：导出最新草稿的图片素材交接包。
- `npm.cmd run image:cover -- --post latest --attach`：生成最新草稿的模板封面 PNG 并绑定到草稿图片素材。
- `npm.cmd run local:start`：后台启动前后端。
- `npm.cmd run local:stop`：停止本地前后端。
- `npm.cmd run health`：检查本地运行状态。
- `npm.cmd run ui:smoke`：检查前端运营台页面是否正常渲染。
- `npm.cmd run backup`：备份 `data/posts.json` 到 `backups/`。
- `npm.cmd run secrets:scan`：扫描 Git 跟踪文件，确认没有提交真实模型 API key。
- `npm.cmd run export -- --post latest`：导出最新待发布内容的 Markdown 交接包。
- `npm.cmd run report -- --out exports`：导出独立 `performance-report.md` 复盘报告。
- `npm.cmd run schedule:dry-run`：检查 Windows 每日生成任务安装计划。
- `npm.cmd run schedule:status`：检查 Windows 每日生成任务当前安装和运行状态。
- `npm.cmd run verify`：完整本地验收，包括密钥扫描、测试、构建、发布包 dry-run、图片素材导出、handoff、备份 dry-run、定时任务 dry-run 和定时任务状态检查。

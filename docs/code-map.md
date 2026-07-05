# Code Map

## Root

- `package.json`：脚本、依赖和项目入口。
- `tsconfig.json`：TypeScript 配置。
- `.env.example`：本地环境变量模板。
- `config/xhs-selectors.json`：小红书创作者中心页面选择器配置。
- `tests/`：生成器、发布包和存储层的自动化测试。

## Server

- `server/src/index.ts`：Express 服务入口，挂载 API 和定时任务。
- `server/src/analytics/contentStrategy.ts`：按内容风格和目标人群汇总效果，并生成下一条内容建议。
- `server/src/config.ts`：环境变量和成本配置。
- `server/src/status.ts`：系统状态汇总，供 API 和 CLI 使用。
- `server/src/types.ts`：帖子、状态、agent 输出等共享类型。
- `server/src/storage/postStore.ts`：JSON 文件存储。
- `server/src/generation/agents.ts`：选题、文案、审核和成本 agent。
- `server/src/generation/generator.ts`：生成流程编排。
- `server/src/generation/qualityGuard.ts`：标题和正文相似度检查，降低重复内容风险。
- `server/src/publishing/xhsPackage.ts`：小红书发布包格式化，供 API、前端和脚本共用，包含正文、标签、封面文字和图片 brief。
- `server/src/publishing/selectorConfig.ts`：读取和校验小红书页面选择器配置。
- `server/src/publishing/imageInputs.ts`：解析发布脚本的本地图片输入。
- `server/src/routes/posts.ts`：草稿列表、创建、编辑、生成接口。
- `server/src/scheduler.ts`：每日生成定时任务。
- `server/src/cli/generate.ts`：命令行生成入口。
- `server/src/cli/status.ts`：命令行状态输出入口。

## Client

- `client/index.html`：Vite HTML 入口。
- `client/src/main.tsx`：React 入口。
- `client/src/App.tsx`：运营台主界面，含草稿编辑、发布助手和效果指标录入。
- `client/src/api.ts`：前端 API 客户端。
- `client/src/styles.css`：界面样式。

## Scripts

- `scripts/export-xhs.ts`：导出小红书 Markdown 图文交接包。
- `scripts/publish-xhs.ts`：小红书半自动发布脚本，支持 dry-run、登录态复用、辅助填充和发布后状态回写。
- `scripts/install-daily-task.ps1`：Windows 任务计划程序安装器，用于每天自动生成小红书草稿。

## Docs

- `docs/requirements.md`：需求文档。
- `docs/architecture.md`：架构文档。
- `docs/code-map.md`：代码地图。
- `docs/xiaohongshu-publishing.md`：发布流程和风控说明。
- `docs/operations-runbook.md`：日常运营、验收和账号验证手册。

## Verification

- `npm.cmd run lint`：TypeScript 类型检查。
- `npm.cmd run test`：Node test runner 单元测试。
- `npm.cmd run build`：生产构建。
- `npm.cmd run status`：输出内容池、预算和常用命令状态。
- `npm.cmd run export -- --post latest`：导出最新待发布内容的 Markdown 交接包。
- `npm.cmd run schedule:dry-run`：检查 Windows 每日生成任务安装计划。
- `npm.cmd run verify`：完整本地验收，包括发布包 dry-run 和定时任务 dry-run。

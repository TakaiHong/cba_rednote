# Code Map

## Root

- `package.json`：脚本、依赖和项目入口。
- `tsconfig.json`：TypeScript 配置。
- `.env.example`：本地环境变量模板。

## Server

- `server/src/index.ts`：Express 服务入口，挂载 API 和定时任务。
- `server/src/config.ts`：环境变量和成本配置。
- `server/src/types.ts`：帖子、状态、agent 输出等共享类型。
- `server/src/storage/postStore.ts`：JSON 文件存储。
- `server/src/generation/agents.ts`：选题、文案、审核和成本 agent。
- `server/src/generation/generator.ts`：生成流程编排。
- `server/src/publishing/xhsPackage.ts`：小红书发布包格式化，供 API、前端和脚本共用。
- `server/src/routes/posts.ts`：草稿列表、创建、编辑、生成接口。
- `server/src/scheduler.ts`：每日生成定时任务。
- `server/src/cli/generate.ts`：命令行生成入口。

## Client

- `client/index.html`：Vite HTML 入口。
- `client/src/main.tsx`：React 入口。
- `client/src/App.tsx`：运营台主界面。
- `client/src/api.ts`：前端 API 客户端。
- `client/src/styles.css`：界面样式。

## Scripts

- `scripts/publish-xhs.ts`：小红书半自动发布脚本，支持登录态复用、辅助填充和发布后状态回写。

## Docs

- `docs/requirements.md`：需求文档。
- `docs/architecture.md`：架构文档。
- `docs/code-map.md`：代码地图。
- `docs/xiaohongshu-publishing.md`：发布流程和风控说明。

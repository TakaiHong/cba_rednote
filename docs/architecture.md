# Architecture

## Overview

平台采用轻量 TypeScript 全栈结构：

- `server/`：Express API、内容生成、多 agent 编排、定时任务、JSON 数据存储。
- `client/`：React + Vite 运营台。
- `scripts/`：小红书发布自动化脚本。
- `docs/`：工程和运营文档。
- `data/`：运行时数据，默认不提交 Git。

`/api/status` 和 `npm.cmd run status` 提供当前内容池、预算、模型配置和常用命令的机器可读状态，方便本地验收和运营交接。

## Content Generation Flow

1. Topic agent 选择目标人群、场景和内容角度。
2. Copy agent 生成标题、正文、标签和图片建议。
3. Review agent 检查是否自然、重复、过度硬广。
4. Cost guard 估算成本，超过预算则降级到本地模板或更短输出。
5. Similarity guard 将候选文案与历史草稿比较，尽量避免连续发布相似标题或正文。
6. Draft store 保存草稿和成本记录。

如果多次生成都与历史内容相似，系统会保留相似度最低的一条并标记为 `draft`，要求人工检查后再发布。

`server/src/generation/contentCalendar.ts` 复用 Topic agent 生成未来 1 到 30 天的内容排期。运营可以通过 `npm.cmd run calendar -- --days 7` 导出 Markdown 或 JSON，用来提前检查人群、场景和内容形式是否足够分散。

## Daily Automation

系统有两种每日生成方式：

- 后端服务运行时，`server/src/scheduler.ts` 使用 `DAILY_CRON` 定时生成。
- Windows 本地任务计划程序可通过 `npm.cmd run schedule:install` 安装，即使不打开前端，也会每天执行 `npm.cmd run generate`。

定时任务日志写入 `.tmp/daily-generate.out.log` 和 `.tmp/daily-generate.err.log`，卸载命令为 `npm.cmd run schedule:uninstall`。

## Storage

当前版本使用 JSON 文件存储，便于本地运行和 Git 之外的数据备份：

- `data/posts.json`：草稿、编辑内容、状态。
- 帖子记录内含 `metrics` 字段，用来保存人工回填的小红书曝光、互动和咨询数据。
- `data/run-log.json`：定时任务和发布脚本记录。

关键动作会追加 `data/run-log.json`，包括运营台/API 生成、批量生成、发布回写、CLI 生成、定时生成、图片 brief 导出和 handoff 导出。`/api/status`、运营台和 handoff 包都会展示最近运行记录，方便确认每日任务是否执行。

后续可替换为 SQLite、Postgres 或 Supabase，不影响 API 形状。

测试时可以通过 `DATA_DIR` 指向临时目录，避免污染真实运营数据。

## Experiment Loop

每条帖子都保留内容风格、目标人群、本地信号和发布指标。运营人员发帖后从小红书后台回填曝光、点赞、收藏、评论、关注和咨询数，运营台会计算整体互动率和咨询率。后续可以据此提高故事型、攻略型或避坑型内容的生成权重。

`server/src/analytics/contentStrategy.ts` 会按内容风格和目标人群汇总曝光、互动和咨询，输出下一条内容建议。样本少于 3 条时会提示先继续积累数据，避免过早判断。

## Publishing Flow

发布脚本读取后端草稿 API 或本地数据，启动 Playwright 浏览器，打开小红书创作者中心。默认模式只辅助填充和预览，最终发布由人工确认。

## Cost Control

默认模板生成器成本为 0。配置 `OPENAI_API_KEY` 后，后端会调用 OpenAI-compatible Chat Completions 接口；如果 `OPENAI_MODEL_COST_CNY_PER_POST_ESTIMATE` 超过 `MAX_COST_CNY_PER_POST`，或模型调用失败，系统会自动回落到本地模板生成器。

也可以直接配置 `DEEPSEEK_API_KEY` 使用 DeepSeek 的 OpenAI-compatible 接口。未显式配置 `OPENAI_BASE_URL` 时，DeepSeek alias 默认使用 `https://api.deepseek.com`；未显式配置模型时，默认使用 `deepseek-v4-flash`。具体环境变量见 `docs/model-config.md`。

`/api/status` 会汇总累计成本、平均成本、付费模型生成条数，以及历史帖子是否都低于 `MAX_COST_CNY_PER_POST`。运营台和 handoff 包都会展示这些预算指标。

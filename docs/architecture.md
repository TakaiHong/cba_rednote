# Architecture

## Overview

平台采用轻量 TypeScript 全栈结构：

- `server/`：Express API、内容生成、多 agent 编排、定时任务、JSON 数据存储。
- `client/`：React + Vite 运营台。
- `scripts/`：小红书发布自动化脚本。
- `docs/`：工程和运营文档。
- `data/`：运行时数据，默认不提交 Git。

## Content Generation Flow

1. Topic agent 选择目标人群、场景和内容角度。
2. Copy agent 生成标题、正文、标签和图片建议。
3. Review agent 检查是否自然、重复、过度硬广。
4. Cost guard 估算成本，超过预算则降级到本地模板或更短输出。
5. Draft store 保存草稿和成本记录。

## Storage

当前版本使用 JSON 文件存储，便于本地运行和 Git 之外的数据备份：

- `data/posts.json`：草稿、编辑内容、状态。
- `data/run-log.json`：定时任务和发布脚本记录。

后续可替换为 SQLite、Postgres 或 Supabase，不影响 API 形状。

## Publishing Flow

发布脚本读取后端草稿 API 或本地数据，启动 Playwright 浏览器，打开小红书创作者中心。默认模式只辅助填充和预览，最终发布由人工确认。

## Cost Control

默认模板生成器成本为 0。配置 `OPENAI_API_KEY` 后，后端会调用 OpenAI-compatible Chat Completions 接口；如果 `OPENAI_MODEL_COST_CNY_PER_POST_ESTIMATE` 超过 `MAX_COST_CNY_PER_POST`，或模型调用失败，系统会自动回落到本地模板生成器。

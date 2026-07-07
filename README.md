# Singapore Mini Storage XHS Platform

新加坡迷你仓小红书营销平台：每天自动生成自然、多样的标题、正文、标签和图片建议，并提供后台编辑、状态管理和半自动发布脚本。

## 快速启动

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

打开运营台：`http://127.0.0.1:5173`

后端 API：`http://127.0.0.1:8787`

也可以后台启动并检查端口：

```powershell
npm.cmd run local:start
npm.cmd run health
```

如果后台启动被本机权限或终端环境拦住，直接保留一个 PowerShell 窗口运行 `npm.cmd run dev`；这是最稳的前台启动方式。

## 常用命令

```powershell
npm.cmd run generate
npm.cmd run generate:batch -- --count 7 --dry-run
npm.cmd run generate:batch -- --count 7 --max-model-posts 1
npm.cmd run local:start
npm.cmd run local:stop
npm.cmd run health
npm.cmd run ui:smoke
npm.cmd run backup
npm.cmd run backup:dry-run
npm.cmd run status
npm.cmd run readiness
npm.cmd run go-live:check
npm.cmd run calendar -- --days 7 --out .tmp/content-calendar.md
npm.cmd run handoff -- --out .tmp/handoff
npm.cmd run export -- --post latest
npm.cmd run image:brief -- --post latest --out .tmp/image-assets
npm.cmd run publish -- --post latest --dry-run
npm.cmd run publish -- --post latest --image .\assets\cover.png
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
npm.cmd run publish:preflight
npm.cmd run publish -- --post latest
npm.cmd run publish -- --post latest --click-publish
npm.cmd run publish -- --post latest --mode clipboard
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
npm.cmd run schedule:dry-run
npm.cmd run schedule:install
npm.cmd run schedule:uninstall
npm.cmd run lint
npm.cmd run test
npm.cmd run verify
npm.cmd run build
```

## 模型配置

- 不配置 key 时，平台使用本地模板生成器，单条成本为 0 元。
- 使用 DeepSeek 时，填写 `DEEPSEEK_API_KEY`，可选填写 `DEEPSEEK_MODEL=deepseek-v4-flash`。
- 使用其他 OpenAI-compatible 模型时，填写 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_MODEL`。
- 单条预算继续由 `MAX_COST_CNY_PER_POST=0.5` 控制，估算成本超出时自动回落本地模板。
- 详细说明见 [模型配置](docs/model-config.md)。

## 当前策略

- 默认使用本地低成本模板生成器，保证没有 API key 也能跑通。
- 配置 `OPENAI_API_KEY` 后，可以切换到低成本模型生成更自然的版本。
- 每条帖子预算上限通过 `MAX_COST_CNY_PER_POST` 控制，默认 0.5 元人民币。
- 小红书发布优先采用半自动 Playwright：复用本地登录态、打开创作者中心、复制并尝试填充内容、由人工最后确认发布，降低账号风控风险；账号和选择器验证稳定后，可通过 `XHS_ALLOW_FINAL_PUBLISH=true` 搭配 `--click-publish` 显式启用最终发布点击。
- 运营台支持录入曝光、点赞、收藏、评论、关注和咨询数，用来比较不同内容角度的实际效果。
- 运营台和 `npm.cmd run status` 会汇总累计成本、平均成本、付费生成条数和预算状态。
- 关键动作会写入 `data/run-log.json`，包括运营台生成/批量生成/发布回写、CLI 生成、定时生成、图片 brief 导出和 handoff 导出。
- 内容池支持按状态筛选和关键词搜索，适合长期积累草稿后运营查找。
- `npm.cmd run calendar -- --days 7` 可规划未来 7 天选题，帮助每日生成保持人群和内容形式多样。
- 运营台和 `npm.cmd run generate:batch -- --count 7 --max-model-posts 1` 都可一次准备一周草稿，并限制最多 1 条走付费模型。
- Windows 本地定时任务可通过 `npm.cmd run schedule:install` 安装，每天自动生成一条草稿。
- `npm.cmd run export -- --post latest` 可导出 Markdown 图文交接包。
- `npm.cmd run image:brief -- --post latest --out .tmp/image-assets` 可导出封面文字、图片 brief、AI 出图 prompt 和素材清单。
- `npm.cmd run handoff -- --out .tmp/handoff` 可集中导出交付状态、排期、批量生成 dry-run、最新发布包和 `image-assets/` 图片素材包。
- `npm.cmd run go-live:check` 会把真实账号 preflight 和至少一条已发布 URL 当成正式上线硬门槛。
- `npm.cmd run ui:smoke` 会用本机 Chrome 检查运营台标题、主界面、中文乱码和控制台错误。
- `npm.cmd run backup` 可备份运行数据到 `backups/`。
- `npm.cmd run readiness` 可输出交接前验收清单。

## 文档

- [需求文档](docs/requirements.md)
- [架构说明](docs/architecture.md)
- [代码地图](docs/code-map.md)
- [运营手册](docs/operations-runbook.md)
- [小红书发布说明](docs/xiaohongshu-publishing.md)
- [验收清单](docs/acceptance-checklist.md)

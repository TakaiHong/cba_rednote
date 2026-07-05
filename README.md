# Singapore Mini Storage XHS Platform

新加坡迷你仓小红书营销平台：每天自动生成自然、多样的标题、正文、标签和图片建议，并提供后台编辑、状态管理和半自动发布脚本。

## 快速启动

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

前端默认运行在 `http://127.0.0.1:5173`，后端默认运行在 `http://127.0.0.1:8787`。

## 常用命令

```powershell
npm.cmd run generate
npm.cmd run publish -- --post latest --dry-run
npm.cmd run publish -- --post latest
npm.cmd run publish -- --post latest --mode clipboard
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
npm.cmd run lint
npm.cmd run test
npm.cmd run verify
npm.cmd run build
```

## 当前策略

- 默认使用本地低成本模板生成器，保证没有 API key 也能跑通。
- 配置 `OPENAI_API_KEY` 后，可以切换到低成本模型生成更自然的版本。
- 每条帖子预算上限通过 `MAX_COST_CNY_PER_POST` 控制，默认 0.5 元人民币。
- 小红书发布优先采用半自动 Playwright：复用本地登录态、打开创作者中心、复制并尝试填充内容、由人工最后确认发布，降低账号风控风险。
- 运营台支持录入曝光、点赞、收藏、评论、关注和咨询数，用来比较不同内容角度的实际效果。

## 文档

- [需求文档](docs/requirements.md)
- [架构说明](docs/architecture.md)
- [代码地图](docs/code-map.md)
- [小红书发布说明](docs/xiaohongshu-publishing.md)

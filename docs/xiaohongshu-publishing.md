# Xiaohongshu Publishing

## Recommended First Version

小红书没有稳定公开的普通账号发帖 API，因此第一版采用半自动发布：

1. 运营台生成并审核草稿。
2. 执行 `npm.cmd run publish -- --post latest`。
3. 脚本使用 `playwright/.auth/xhs-profile` 复用本地登录态，并打开小红书创作者中心。
4. 用户第一次运行时完成登录或扫码。
5. 脚本复制标题、正文、标签到浏览器剪贴板，并在 `assist` 模式下尝试填充页面字段。
6. 运营台或 dry-run 输出图片 brief，用于拍摄封面图、仓储空间图或 AI 出图。
7. 用户检查内容并手动点击发布。
8. 发布成功后执行 `npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>` 回写状态。

## Commands

默认辅助填充：

```powershell
npm.cmd run publish -- --post latest
```

账号登录态、图片上传、标题/正文选择器和发布按钮选择器都验证稳定后，可以显式启用最终发布点击：

```powershell
npm.cmd run publish -- --post latest --click-publish
```

该命令还要求 `.env` 中设置 `XHS_ALLOW_FINAL_PUBLISH=true`。如果只传 `--click-publish` 但没有环境变量，脚本会照常填充内容，但不会点击最终发布按钮。

带本地图片辅助上传：

```powershell
npm.cmd run publish -- --post latest --image .\assets\cover.png --image .\assets\detail.png
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

`--image` 可重复传入。`--images-dir` 会读取 `.jpg`、`.jpeg`、`.png`、`.webp` 文件。脚本会先尝试 `config/xhs-selectors.json` 里的上传选择器，找不到时仍保留剪贴板/手动上传兜底。

只校验发布包，不打开浏览器：

```powershell
npm.cmd run publish -- --post latest --dry-run
```

dry-run 会输出标题、正文、标签、图片建议、封面文字、图片 brief、AI 出图 prompt 和素材清单。
如果传入 `--image` 或 `--images-dir`，dry-run 也会列出计划上传的绝对路径。

导出运营交接包：

```powershell
npm.cmd run export -- --post latest
```

导出文件会写入 `exports/`，包含发布正文、标签、图片 brief、AI 出图 prompt 和素材清单。

只打开页面和复制内容，不尝试填充字段：

```powershell
npm.cmd run publish -- --post latest --mode clipboard
```

检查真实创作者中心页面选择器命中情况：

```powershell
npm.cmd run publish:preflight
```

默认会写入 `.tmp/xhs-preflight-report.json`，用于记录真实账号页面里 `title`、`body`、`upload` 和 `publishButton` 选择器的命中情况。也可以自定义路径：

```powershell
npm.cmd run publish -- --post latest --preflight --no-pause --preflight-report .tmp/xhs-preflight-report.json
```

如果 preflight 显示标题或正文选择器都没有命中，优先更新 `config/xhs-selectors.json`，再运行辅助发布。

发布后回写状态：

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

## Why Semi-automatic

- 降低账号异常和验证码风险。
- 页面结构变化时仍然可以使用剪贴板模式，不影响内容生成和运营台。
- 页面结构变化时可以用 `publish:preflight` 检查并更新选择器配置。
- 保留人工确认，避免不合规或重复内容误发。

如果确实要进入一键最终发布模式，先完成 `publish:preflight`，确认 `title`、`body`、`upload` 和 `publishButton` 至少命中一次，再打开 `XHS_ALLOW_FINAL_PUBLISH=true` 并使用 `--click-publish`。

## Future Full Automation

如果账号、浏览器状态和页面结构稳定，可以继续补充：

- 登录态持久化。
- 自动上传图片。
- 自动填充标题、正文、话题。
- 发布前截图和二次确认。
- 发布后抓取链接并回写状态。

## Risk Notes

- 避免高频发布和重复文案。
- 不要批量新号硬发广告。
- 每天建议先 1 到 3 条，观察阅读和互动。
- 内容中少用夸张承诺，重点讲真实场景和解决方案。

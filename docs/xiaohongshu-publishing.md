# 小红书发布流程

## 第一版推荐方式

小红书没有稳定公开的普通账号发帖 API，因此第一版采用半自动发布：

1. 在运营台生成并审核草稿。
2. 执行 `npm.cmd run publish -- --post latest`。
3. 脚本用 `playwright/.auth/xhs-profile` 复用本地浏览器登录态，并打开小红书创作者中心。
4. 第一次运行时，运营人员在浏览器里完成登录或扫码。
5. 脚本把标题、正文和标签复制到浏览器剪贴板，并在 `assist` 模式下尝试填充页面字段。
6. 如果传入图片，脚本会尝试上传；如果页面结构变化导致上传失败，仍保留人工上传兜底。
7. 运营人员检查内容、图片、封面和话题后，手动点击发布。
8. 发布成功后，把小红书链接回写到系统。

这种方式把重复劳动交给脚本，把账号风控、最终内容确认和页面异常判断留给人工。

## 常用命令

默认辅助填充：

```powershell
npm.cmd run publish -- --post latest
```

只打开页面和复制内容，不尝试填充字段：

```powershell
npm.cmd run publish -- --post latest --mode clipboard
```

校验发布包，不打开浏览器：

```powershell
npm.cmd run publish -- --post latest --dry-run
```

dry-run 会输出标题、正文、标签、图片建议、封面文字、图片 brief、AI 出图 prompt、素材清单、计划上传的图片路径，以及最终点击发布是否已同时满足环境变量和 preflight 证据。

带本地图片辅助上传：

```powershell
npm.cmd run publish -- --post latest --image .\assets\cover.png --image .\assets\detail.png
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

`--image` 可以重复传入。`--images-dir` 会读取 `.jpg`、`.jpeg`、`.png`、`.webp` 文件。运营台里“图片素材路径”字段保存的本地图片也会自动并入上传队列，适合把 AI 出图或实拍图固定到某一条草稿上。

生成一张零模型成本的模板封面并绑定到草稿：

```powershell
npm.cmd run image:cover -- --post latest --attach
```

该命令输出 3:4 PNG，适合做封面占位或轻量运营图；如果需要真实仓储空间、人物或产品质感，仍建议使用实拍图或专门的图片生成模型。

导出运营交接包：

```powershell
npm.cmd run export -- --post latest
```

导出文件写入 `exports/`，包含发布正文、标签、图片 brief、AI 出图 prompt 和素材清单。

## 真实账号预检

正式依赖辅助发布前，先检查真实创作者中心页面里的选择器：

```powershell
npm.cmd run image:cover -- --post latest --attach
npm.cmd run publish:preflight
```

图文发布页通常会在上传图片后才显示标题、正文和发布按钮。`publish:preflight` 会优先使用草稿已绑定的图片素材并先尝试上传；如果草稿还没有图片，先运行 `image:cover -- --post latest --attach` 生成一个模板封面，或在运营台绑定真实图片路径。

如果需要先人工登录或手动切到“上传图文”页，使用：

```powershell
npm.cmd run publish:preflight:manual
```

浏览器打开后，登录账号并切到“上传图文”页，再回到 PowerShell 按 Enter，脚本才会上传图片并生成预检报告。

默认报告路径：

```text
.tmp/xhs-preflight-report.json
```

报告会记录 `title`、`body`、`upload` 和 `publishButton` 四组选项的命中数量与可见性。也可以自定义路径：

```powershell
npm.cmd run publish -- --post latest --preflight --no-pause --preflight-report .tmp/xhs-preflight-report.json
```

如果标题、正文或上传选择器没有命中，优先更新 `config/xhs-selectors.json`，再重新运行 preflight。

## 发布后回写

发布成功后标记为已发布：

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

`--published-url` 必须是合法的 `http` 或 `https` 链接。也可以在运营台中粘贴小红书笔记链接，再标记为已发布。回写后，运行日志会记录这次发布回写动作。

## 最终点击发布

最终点击发布默认关闭。即使传入 `--click-publish`，如果没有环境变量允许，脚本也只会辅助填充，不会点击最终发布按钮。

只有在满足以下条件后，才考虑一键最终发布：

- 已经在真实账号中完成 `publish:preflight`。
- 报告显示 `title`、`body` 和 `publishButton` 至少有可用命中。
- 账号登录态稳定，没有频繁要求扫码或验证码。
- 运营人员已经确认该内容可以发布。
- `.env` 或当前 shell 中显式设置 `XHS_ALLOW_FINAL_PUBLISH=true`。

启用后命令：

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs --click-publish
```

如果标题或正文自动填充失败，脚本会阻止最终点击。

## 为什么不默认全自动

- 降低账号异常、验证码和风控风险。
- 小红书页面结构会变化，半自动模式更容易恢复。
- 剪贴板模式可以在选择器失效时继续使用，不影响内容生产。
- 保留人工确认，避免重复内容、不合规表达或图片错误直接发出。

## 未来可扩展方向

账号、浏览器状态和页面结构稳定后，可以继续补：

- 登录态健康检查。
- 发布前截图和人工确认记录。
- 自动识别发布成功后的笔记链接。
- 自动回写已发布链接。
- 针对不同账号的发布频率限制。

## 风险备注

- 不要高频批量硬发广告。
- 每天建议先发布 1 到 3 条，观察曝光和互动。
- 内容尽量讲真实场景和解决方案，少用夸张承诺。
- 不要把最终发布点击作为默认行为。
- 小红书页面变化后，先跑 `publish:preflight`，再更新选择器配置。

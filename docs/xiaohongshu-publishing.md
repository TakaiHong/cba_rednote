# 小红书发布流程

## 运营台推荐方式

小红书没有稳定公开的普通账号发帖 API，因此平台通过本地浏览器复用登录态。日常业务不需要运行 CLI：

1. 在运营台生成并审核草稿。
2. 在运营台顶部按主按钮提示依次生成封面、运行账号预检。
3. 脚本用 `playwright/.auth/xhs-profile` 复用本地浏览器登录态，并默认直达小红书“上传图文”发布页。
4. 第一次运行时，运营人员在浏览器里完成登录或扫码。
5. 脚本把标题、正文和标签复制到浏览器剪贴板，并在 `assist` 模式下尝试填充页面字段。
6. 如果传入图片，脚本会尝试上传；如果页面结构变化导致上传失败，仍保留人工上传兜底。
7. 预检通过后点击“确认并发布”，在浏览器确认框中再次确认；后台会自动上传、填充并点击发布。
8. 发布成功后，把小红书链接回写到系统。

8. 如需先看页面而不真正发布，点击“只填充，不发布”；准备好的浏览器会保持打开，关闭浏览器即可结束，不用按 Enter。
9. 发布成功后，把小红书链接回写到系统。

账号预检证据有效期为 24 小时。旧报告即使选择器全部命中，也不能授权前端最终发布。

## 常用命令

默认辅助填充：

```powershell
npm.cmd run publish -- --post latest
```

正式辅助发布会先等待“上传图文”页和上传控件就绪，再上传图片和填写标题正文；默认最多等待 120 秒，可用 `--page-wait-ms` 调整。

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

正式依赖辅助发布前，先检查真实创作者中心页面里的选择器。运营人员优先在前端运营台点击“账号预检”；后端会按当前选中的笔记启动预检并把结果写到 `.tmp/xhs-preflight-report.json`。

CLI 兜底：

```powershell
npm.cmd run image:cover -- --post latest --attach
npm.cmd run publish:preflight
```

图文发布页通常会在上传图片后才显示标题、正文和发布按钮。`publish:preflight` 会优先使用草稿已绑定的图片素材并先尝试上传；如果草稿还没有图片，先运行 `image:cover -- --post latest --attach` 生成一个模板封面，或在运营台绑定真实图片路径。

前端“账号预检”和 `publish:preflight` 都会自动等待登录和“上传图文”页就绪；如果登录后落到创作者首页，脚本会重新跳到图文发布地址再继续。默认最多等待 120 秒，也可以用 `--preflight-wait-ms` 调整。前端预检完成后浏览器会自动关闭，这是正常取证流程，不需要按 Enter。

如果需要先人工登录、等待自动跳转或手动确认“上传图文”页，使用：

```powershell
npm.cmd run publish:preflight:manual
```

浏览器打开后，登录账号；如果没有自动进入“上传图文”页，再手动切过去。确认页面正确后回到 PowerShell 按 Enter，脚本才会上传图片并生成预检报告。

默认报告路径：

```text
.tmp/xhs-preflight-report.json
```

报告会记录 `title`、`body`、`upload` 和 `publishButton` 四组选项的命中数量与可见性，并附带页面上可见按钮的候选文本，方便排查小红书改版后的发布按钮文案。也可以自定义路径：

```powershell
npm.cmd run publish -- --post latest --preflight --no-pause --preflight-report .tmp/xhs-preflight-report.json
```

如果标题、正文、上传或发布按钮选择器没有命中，先看运营台账号预检卡片里的“页面按钮候选”，再更新 `config/xhs-selectors.json`，然后从运营台重新点击“账号预检”。

## 发布后回写

发布成功后，优先在小红书复制笔记链接，回到运营台“发布效果”区点击“粘贴链接并标记已发布”。运营台会从剪贴板读取第一个 `http` 或 `https` 链接，回填小红书链接，并把当前笔记标记为已发布。

CLI 兜底：

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

`--published-url` 必须是合法的 `http` 或 `https` 链接。也可以在运营台中手动粘贴小红书笔记链接，再标记为已发布。回写后，运行日志会记录这次发布回写动作。

## 最终点击发布

CLI 最终点击发布默认关闭。运营台则提供带前置检查和二次确认的“确认并发布”：只有已审核内容、至少一张绑定图片，以及 24 小时内通过的账号预检同时满足时，后端才接受请求。

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

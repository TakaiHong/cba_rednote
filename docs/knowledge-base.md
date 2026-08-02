# NTU CBA 内容知识库

## 目的

知识库让文案既保持 NTU 校园语境，也不把个别经验、过期信息或小红书原文误写成事实。

它分为两层：

1. **官方事实层**：由 Worker 内置的 NTU / NBS 官方页面白名单组成。可发布笔记中的日期、资格、服务、活动或政策类描述，只能来自这一层，并且仍须由运营人员在发布前打开链接复核。
2. **公开参考洞察层**：运营人员从公开小红书笔记或公开社区中自行概括的选题、痛点、受众和叙事结构。它只帮助 AI 选择更贴近学生的切入点，不是事实证据。

## Reddit 趋势同步

## 批量链接整理

运营人员可以从 Reddit 搜索结果复制公开帖子链接，在知识库的“批量放入待审核队列”中一次粘贴最多 100 条。系统只校验 Reddit 链接格式、去重并保存链接，不主动访问、下载或保存帖子正文。

每条新链接默认是“待审核”，不会传给文案模型。运营人员必须打开公开链接、用自己的话填写主题、受众和概述后点击“核准入库”；只有核准后的条目才会作为选题灵感。重复、非 Reddit 或空白链接会被跳过。

### 受控链接收集脚本

运行 `npm.cmd run reddit:collect-links -- --query NTU --limit 50` 会打开可见 Chrome 窗口。运营人员在 45 秒内自行处理正常登录或验证码，保持 Reddit 搜索页打开；脚本随后自动开始。可用 `--wait-seconds 90` 延长等待时间。脚本最多滚动 50 次，间隔至少 2.2 秒，只提取 Reddit 帖子链接并写入 `.tmp/reddit-ntu-links.txt`。已收集链接会记录在 `.tmp/reddit-ntu-link-history.txt`，下次运行会自动跳过它们，输出只包含新链接；最终累计链接写入 `.tmp/reddit-ntu-corpus-links.txt`。它不自动登录、不点击互动按钮，也不会读取用户主页或资料；遇到验证码会停止。

运行 `npm.cmd run reddit:collect-content -- --limit 20 --target-posts 10000 --max-bytes 1gb` 会从累计链接中继续处理未读贴文。每个语料单元只保留原帖链接、来源社区、标题、贴文正文和当前页面可见的公开评论正文，写入 `.tmp/reddit-ntu-content-corpus.jsonl`；进度写入 `.tmp/reddit-ntu-content-state.json`，所以可安全重跑并自动跳过已处理贴文。`r/NTU` 的内容可直接作为校园讨论样本；其他社区的条目必须在标题、正文或可见评论中出现 `NTU`、`Nanyang Technological`、`Nanyang Business School` 或 `NBS` 才会入库。写盘前会移除用户名、个人主页资料、链接、邮箱和电话号码；不保存头像、karma、发帖历史或媒体。达到 10,000 篇贴文或正文语料达到 1 GB 时自动停止。社区内容仅是选题信号，不能作为 NTU 官方事实，也不应原样复制到对外文案。

如需按当前相关性规则复查既有本地语料，可运行 `npm.cmd run reddit:prune-content`。它只重写本地 `.tmp` 语料文件，不会访问 Reddit，也不会把已移除的链接重新加入待采集队列。

### 浏览器人工采集

当 Reddit API 尚未获批或不可用时，运营人员可在已授权且登录的浏览器会话中确认搜索结果。系统仅收录：原帖链接、主题、目标受众、经过改写的洞察和可见互动合计；不收录用户身份、标题、正文、评论或截图。浏览器采集样本默认为只读，并在 30 天后失效。

浏览器采集的 Reddit 信号是内容选题层的优先输入：它帮助判断本地学生正在讨论什么；任何日期、资格、费用、政策或学校服务相关陈述仍必须由 NTU/NBS 官方来源核验。

Reddit 仅作为选题趋势来源，不是 NTU 信息源。同步范围为 `r/NTU` 的最新和年度高互动帖子，以及 `r/SGExams`、`r/asksingapore`、`r/singapore` 的 NTU 搜索结果；Worker 只在内存中读取标题以归类和筛选，持久化数据只包含公开链接、互动合计、主题标签和匿名化趋势说明。

- 不保存作者、标题、正文、评论、截图或用户画像；
- 不把 Reddit 内容发送到文案模型；
- 每次同步最多读取 500 条 API 候选帖子，按 NTU 相关度、互动量与新鲜度筛选，最多保留 400 条信号；
- Reddit 信号保存 30 天后自动删除；
- Cloudflare 每日生成草稿前会自动同步一次；
- 使用前需在 Cloudflare Worker Secrets 中配置 `REDDIT_CLIENT_ID` 与 `REDDIT_CLIENT_SECRET`，并设置可识别的 `REDDIT_USER_AGENT`；
- 同步按钮只有在凭据存在时可用，失败时不会回退到网页抓取。

## 收录公开参考

在运营台的“知识库”页粘贴公开小红书链接，并写一段自己的概括。建议每条只保留：

- 一个主题，例如“刚入学的信息过载”或“找实习时的作品集焦虑”；
- 一个明确受众；
- 一句可复用洞察，例如“读者需要可执行的顺序，而非泛泛介绍”。

不要存储或粘贴以下内容：

- 笔记正文、长段逐字摘录或截图；
- 作者昵称、头像、评论区身份或其他个人信息；
- 未经官方来源验证的日期、费用、资格、地点、名额或规则。

## 生成约束

DeepSeek 会同时看到官方来源和已收录的公开洞察。系统提示明确要求：

- 官方来源是唯一可用的事实依据；
- 公开洞察不能被引用、归因、逐句改写或作为事实陈述；
- 不确定的信息应改写为一般建议，并提示读者查看官方链接；
- 标题维持在 20 个汉字以内。

公开洞察数据保存在 Cloudflare D1 的 `knowledge_entries` 表，和帖子数据一起由 Worker 管理。删除洞察不会影响已经保存的历史笔记。

## 每日自动采集

`npm.cmd run reddit:schedule:install` 会在这台 Windows 电脑上安装一个独立任务，默认每天运行 4 次，从 10:00 起每 6 小时一次：每次最多收集 100 个未进入历史记录的新链接，并从累计链接中补最多 25 篇匿名化的贴文和评论正文；正文页之间默认等待 5 秒，以避免对公开社区造成连续访问压力。任务只会在当前 Windows 用户已登录时运行，因此可以使用同一个可见 Chrome 资料夹；它不会在 Cloudflare Worker 内运行，也不会绕过登录或验证码。默认等待时间为 0 秒，若 Reddit 出现验证码，任务会停止并将错误写入 `.tmp/reddit-collector.err.log`，下一次由运营人员正常完成验证后再运行即可。可通过 `-RunsPerDay 1`、`2`、`3`、`4` 或 `6` 调整每日批次数，也可在安装命令中使用 `-Limit`、`-ContentLimit` 或 `-RequestDelaySeconds` 调整工作量。

```powershell
npm.cmd run reddit:schedule:dry-run
npm.cmd run reddit:schedule:install
npm.cmd run reddit:schedule:status
npm.cmd run reddit:schedule:uninstall
```

需要改执行时间、关键词或数量时，直接运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-reddit-collector-task.ps1 -Time "10:00" -Query "NTU" -Limit 50
```

全站搜索中的 `NTU` 可能指向同名机构或无关词。采集器会分别浏览 `r/NTU` 的最新帖子，并在 `r/SGExams`、`r/asksingapore`、`r/singapore`、`r/SIT_Singapore` 内限制搜索 `NTU`；它默认只保留这些社区的帖子链接，不读取帖子正文。除基础 `NTU` 搜索外，默认还会加上学生关心的 `course registration`、`exchange`、`help`、`internship`、`hall`、`housing` 主题。单次运行最多可收集 300 条新链接，需要调整范围时可增加 `--subreddits NTU,SGExams,asksingapore` 或 `--topics "course registration,exchange,help"`；链接进入待审核库前仍需人工逐条核对。

每次运行的新增链接写入 `.tmp/reddit-ntu-links.txt`，同时累计到 `.tmp/reddit-ntu-corpus-links.txt`。采集器会继续越过已见链接，以便在同一来源中寻找更早的未见帖子；链接库最多保留 100,000 条。正文采集受 10,000 篇和 1 GB 的双重上限约束。覆盖度取决于 Reddit 搜索页可见结果与正常验证，不宣称网页端采集能穷尽全站内容。

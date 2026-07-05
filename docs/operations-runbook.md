# Operations Runbook

## Daily Flow

Start the local platform:

```powershell
npm.cmd run local:start
npm.cmd run health
```

Stop local background services:

```powershell
npm.cmd run local:stop
```

1. Generate one draft:

```powershell
npm.cmd run generate
```

Prepare several drafts in one run:

```powershell
npm.cmd run generate:batch -- --count 7 --dry-run
npm.cmd run generate:batch -- --count 7 --max-model-posts 1
```

`--max-model-posts` limits how many drafts may use a paid OpenAI-compatible provider such as DeepSeek. Keep it low when testing.

如果生成内容被标记为 `draft` 且审核备注包含 similarity，需要人工确认是否与历史内容过近，再设为待发布。

2. Review and edit in the运营台:

```powershell
npm.cmd run dev
```

Use the content pool search box and status filters to find draft, approved, published or archived posts.

Plan upcoming topics:

```powershell
npm.cmd run calendar -- --days 7 --out .tmp/content-calendar.md
```

3. Export a handoff package if another person will publish:

```powershell
npm.cmd run export -- --post latest
```

4. Validate the publish package:

```powershell
npm.cmd run publish -- --post latest --dry-run
```

5. Publish with assisted browser flow:

```powershell
npm.cmd run publish -- --post latest
```

With prepared images:

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

After account validation, final-click publishing can be enabled explicitly:

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs --click-publish
```

This final-click mode also requires `XHS_ALLOW_FINAL_PUBLISH=true` in `.env`.

6. After publishing, write the result back:

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

7. Fill in exposure, likes, saves, comments, follows and inquiries in the运营台.

8. Check the strategy recommendation in the运营台 or `npm.cmd run status`. Treat it as directional until at least 3 posts have performance data.

## Status Checks

```powershell
npm.cmd run status
npm.cmd run readiness
npm.cmd run verify
```

`status` shows content counts, latest post, model provider, budget configuration and common commands. `readiness` summarizes handoff checks and separates required failures from warnings. `verify` runs type checks, tests, production build, status, readiness, publish dry-run, export smoke test and scheduler dry-run.

Use `local:start` to open backend/frontend in hidden background processes and `health` to check ports plus `/api/health` and `/api/status`.

## Model Provider

Use the local template generator when you want zero API cost. To use DeepSeek, set `DEEPSEEK_API_KEY` in `.env`; the default DeepSeek model is `deepseek-v4-flash`, with `https://api.deepseek.com` as the base URL. Keep `MAX_COST_CNY_PER_POST=0.5` and adjust `MODEL_COST_CNY_PER_POST_ESTIMATE` if pricing assumptions change.

Full setup notes are in `docs/model-config.md`.

## Data Backup

Back up local runtime data before larger edits or handoff:

```powershell
npm.cmd run backup
```

Preview the backup target without writing:

```powershell
npm.cmd run backup:dry-run
```

Backups are written to `backups/`, which is ignored by Git.

## Daily Automation

Install the Windows scheduled task:

```powershell
npm.cmd run schedule:install
```

Check the task plan without installing:

```powershell
npm.cmd run schedule:dry-run
```

Uninstall:

```powershell
npm.cmd run schedule:uninstall
```

## Xiaohongshu Account Validation

Before relying on assisted publishing for a real account:

1. Run `npm.cmd run publish:preflight`.
2. Log in or scan QR code in the opened browser.
3. Confirm title/body/upload/publish selectors are detected.
4. Review `.tmp/xhs-preflight-report.json` as the saved selector evidence.
5. If selectors miss, update `config/xhs-selectors.json`.
6. Re-run preflight before using `npm.cmd run publish -- --post latest`.

The script does not click the final publish button by default. Keep manual confirmation until the account has stable login state and the page selectors have been verified.

When stable, run `publish:preflight`, confirm `publishButton` is detected, then set `XHS_ALLOW_FINAL_PUBLISH=true` and use `--click-publish` for explicit one-command final publishing.

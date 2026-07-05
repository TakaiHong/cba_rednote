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

如果生成内容被标记为 `draft` 且审核备注包含 similarity，需要人工确认是否与历史内容过近，再设为待发布。

2. Review and edit in the运营台:

```powershell
npm.cmd run dev
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

6. After publishing, write the result back:

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

7. Fill in exposure, likes, saves, comments, follows and inquiries in the运营台.

8. Check the strategy recommendation in the运营台 or `npm.cmd run status`. Treat it as directional until at least 3 posts have performance data.

## Status Checks

```powershell
npm.cmd run status
npm.cmd run verify
```

`status` shows content counts, latest post, budget configuration and common commands. `verify` runs type checks, tests, production build, publish dry-run, export smoke test and scheduler dry-run.

Use `local:start` to open backend/frontend in hidden background processes and `health` to check ports plus `/api/health` and `/api/status`.

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
4. If selectors miss, update `config/xhs-selectors.json`.
5. Re-run preflight before using `npm.cmd run publish -- --post latest`.

The script does not click the final publish button by default. Keep manual confirmation until the account has stable login state and the page selectors have been verified.

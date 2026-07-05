# Operations Runbook

## Daily Flow

1. Generate one draft:

```powershell
npm.cmd run generate
```

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

## Status Checks

```powershell
npm.cmd run status
npm.cmd run verify
```

`status` shows content counts, latest post, budget configuration and common commands. `verify` runs type checks, tests, production build, publish dry-run, export smoke test and scheduler dry-run.

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

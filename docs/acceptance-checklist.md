# Acceptance Checklist

Use this checklist before handing the platform to an operator.

## Local Readiness

Run:

```powershell
npm.cmd run readiness
```

The command checks:

- frontend and backend npm scripts
- daily generation command and Windows scheduler installer
- batch draft generation with paid-model limit
- content calendar planning command
- publish script and selector configuration
- final publish double opt-in
- model budget guard
- required docs
- current content pool status
- model provider status
- handoff package command

Required failures should be fixed before handoff. Warnings can be acceptable, but they need an explicit owner.

## Full Verification

Run:

```powershell
npm.cmd run verify
```

This runs type checks, unit tests, production build, status output, readiness, publish dry-run, export smoke test, backup dry-run, and scheduler dry-run.

## DeepSeek

Do not commit real API keys. Keep keys in `.env` or the current shell only.

Recommended config:

```powershell
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
MODEL_COST_CNY_PER_POST_ESTIMATE=0.12
MAX_COST_CNY_PER_POST=0.5
```

Use a single generated draft to validate the paid model path, then continue with dry-runs unless more quality samples are needed.

## Xiaohongshu Account Validation

Before enabling final-click publishing:

1. Run `npm.cmd run publish:preflight`.
2. Log in to the creator center in the opened browser.
3. Confirm `title`, `body`, `upload`, and `publishButton` selectors are visible.
4. Save or review `.tmp/xhs-preflight-report.json` as the selector evidence.
5. Run a normal assisted publish with `npm.cmd run publish -- --post latest --images-dir .\assets\xhs`.
6. Only after a stable manual review, set `XHS_ALLOW_FINAL_PUBLISH=true`.
7. Use `npm.cmd run publish -- --post latest --images-dir .\assets\xhs --click-publish`.

The final-click mode is intentionally disabled by default.

`npm.cmd run readiness` reads `.tmp/xhs-preflight-report.json` by default and turns the preflight warning into OK only when `title`, `body`, `upload`, and `publishButton` all have visible selector hits. To use a custom report path, set `XHS_PREFLIGHT_REPORT`.

The published URL warning turns into OK after at least one reviewed post is marked `published` with a Xiaohongshu URL, either through the dashboard or:

```powershell
npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>
```

## Handoff Evidence

Capture these before considering the first version ready:

- `npm.cmd run verify` output with all checks passing
- `npm.cmd run health` output with backend and frontend online
- `npm.cmd run readiness` output with no required failures
- one 7-day content calendar from `npm.cmd run calendar -- --days 7 --out .tmp/content-calendar.md`
- one batch-generation dry-run from `npm.cmd run generate:batch -- --count 7 --dry-run`
- one handoff package from `npm.cmd run handoff -- --out .tmp/handoff`
- one exported Markdown handoff package from `npm.cmd run export -- --post latest`
- one Xiaohongshu `publish:preflight` report from the real account, defaulting to `.tmp/xhs-preflight-report.json`
- at least one manually reviewed published URL, then recorded through the dashboard or `--mark-published`

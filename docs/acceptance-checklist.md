# Acceptance Checklist

Use this checklist before handing the platform to an operator.

## Local Readiness

Run:

```powershell
npm.cmd run readiness
```

The command checks:

- frontend and backend npm scripts
- daily generation command plus Windows scheduler status/install commands
- batch draft generation with paid-model limit
- content calendar planning command
- publish script and selector configuration
- final publish double opt-in
- model budget guard
- tracked-file secret scan command
- image asset brief export and template cover generation commands
- required docs
- current content pool status
- model provider status
- handoff package command

After the local app is running, run:

```powershell
npm.cmd run ui:smoke
```

This checks that the operator dashboard renders in Chrome, has the expected title, contains no mojibake-like text, and has no console errors.

Required failures should be fixed before handoff. Warnings can be acceptable, but they need an explicit owner.

## Full Verification

Run:

```powershell
npm.cmd run verify
```

This runs the tracked-file secret scan, type checks, unit tests, production build, status output, readiness, publish dry-run, export smoke test, image brief export, handoff export, backup dry-run, scheduler dry-run, and scheduler status check.

## Go-Live Check

Run this only when the real Xiaohongshu account validation is supposed to be complete:

```powershell
npm.cmd run go-live:check
```

Unlike `readiness`, this treats the real-account preflight report and at least one recorded published Xiaohongshu URL as required. It should fail until `publish:preflight` has produced a usable report and one reviewed note has been marked published with its Xiaohongshu URL.

When it fails, the JSON output includes `nextSteps` with the exact follow-up commands for missing real-account evidence.

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

Before committing model configuration changes, run:

```powershell
npm.cmd run secrets:scan
```

This checks Git-tracked files for real-looking `DEEPSEEK_API_KEY` or OpenAI-compatible API key values. Keep real keys in `.env` or the current shell only.

## Image Assets / 图片素材

The platform currently generates image ideas, cover text, `visualBrief`, `imagePrompt`, and an asset checklist for each post. It can generate a template PNG cover by itself, but it does not generate realistic photo-style image assets without a separate image provider.

It can also generate a zero-model-cost 3:4 template cover PNG from the post fields:

```powershell
npm.cmd run image:cover -- --post latest --attach
```

This is a lightweight operational cover, not a realistic photo generator. Use it when speed matters; use real photos or a dedicated image model for higher-fidelity visuals.

Use those prompts with a dedicated image tool or real photos, save the final images locally, then pass them to the publishing script / 发布脚本:

```powershell
npm.cmd run image:brief -- --post latest --out .tmp/image-assets
```

This exports `image-asset-brief.md`, `image-prompt.txt`, and `image-asset-brief.json` for the selected post.

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

If native image generation is added later, use a separate image provider rather than DeepSeek text generation, and keep generated assets in ignored folders such as `assets/`, `exports/`, or `.tmp/`.

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
- `npm.cmd run go-live:check` output passing after real account validation
- `npm.cmd run secrets:scan` output showing no tracked API secrets
- `npm.cmd run health` output with backend and frontend online
- `npm.cmd run ui:smoke` output with `ok: true`
- `npm.cmd run readiness` output with no required failures
- `npm.cmd run schedule:status` output showing whether the daily draft task is installed
- one 7-day content calendar from `npm.cmd run calendar -- --days 7 --out .tmp/content-calendar.md`
- one batch-generation dry-run from `npm.cmd run generate:batch -- --count 7 --dry-run`
- one handoff package from `npm.cmd run handoff -- --out .tmp/handoff`, including `readiness-checks.json`, `go-live-check.json`, and `image-assets/`
- the `first-publish-checklist.md` file inside the handoff package, used as the first real-account publish run sheet
- the `performance-report.md` file inside the handoff package, used for first-post metrics backfill and content review
- one image asset brief from `npm.cmd run image:brief -- --post latest --out .tmp/image-assets`
- one template cover PNG generated from `npm.cmd run image:cover -- --post latest --attach`
- one exported Markdown handoff package from `npm.cmd run export -- --post latest`
- one Xiaohongshu `publish:preflight` report from the real account, defaulting to `.tmp/xhs-preflight-report.json`
- at least one manually reviewed published URL, then recorded through the dashboard or `--mark-published`

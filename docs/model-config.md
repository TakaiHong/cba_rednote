# Model Config

The generator can run without any model key. In that mode it uses the local template and costs 0 CNY per post.

## DeepSeek

DeepSeek is supported through its OpenAI-compatible Chat Completions API. Add these values to `.env`:

```powershell
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_MODEL=deepseek-v4-flash
MODEL_COST_CNY_PER_POST_ESTIMATE=0.12
MAX_COST_CNY_PER_POST=0.5
```

When `OPENAI_API_KEY` is empty and `DEEPSEEK_API_KEY` is present, the backend uses:

- provider: `deepseek`
- base URL: `https://api.deepseek.com`
- default model: `deepseek-v4-flash`

If `MODEL_COST_CNY_PER_POST_ESTIMATE` is higher than `MAX_COST_CNY_PER_POST`, the platform falls back to the local template generator.

## Generic OpenAI-compatible Provider

For any other OpenAI-compatible model provider, configure:

```powershell
OPENAI_API_KEY=your-compatible-key
OPENAI_BASE_URL=https://provider.example.com/v1
OPENAI_MODEL=cheap-compatible-model
MODEL_COST_CNY_PER_POST_ESTIMATE=0.12
MAX_COST_CNY_PER_POST=0.5
```

Explicit `OPENAI_*` settings take priority over `DEEPSEEK_*` aliases. This makes it easy to swap providers while keeping the publishing and review workflow unchanged.

## Image Generation

The current platform generates image ideas, cover text, visual briefs, AI image prompts, and asset checklists for every post. These are included in dry-runs, Markdown exports, and handoff packages. Operators can also attach local image asset paths to a post in the dashboard; the publish script will include those paths automatically.

It does not generate image files by itself yet. DeepSeek is used here as a low-cost text model and should not be treated as the image-generation provider. To generate images inside the platform, add a separate image model provider and save generated assets under an ignored local folder such as `assets/` or `exports/`, then pass that folder to:

```powershell
npm.cmd run publish -- --post latest --images-dir .\assets\xhs
```

Recommended low-cost first step: use the generated `visualBrief` and `imagePrompt` with a dedicated image tool, then upload the resulting local images through the existing publish script.

For a zero-model-cost cover placeholder, generate a template PNG from the selected post:

```powershell
npm.cmd run image:cover -- --post latest --attach
```

This creates a 3:4 Xiaohongshu-style cover image using the post title, scene, first image idea, and tags, then attaches the PNG path to the post when `--attach` is present. Use real photos or a dedicated image model when the post needs realistic product/place imagery.

To export a ready-to-share image brief for the latest approved draft:

```powershell
npm.cmd run image:brief -- --post latest --out .tmp/image-assets
```

The command writes Markdown, plain prompt text, and JSON files for design, AI image generation, or real-photo shooting handoff.

## Safety

- Never commit `.env` or real API keys.
- Keep `MAX_COST_CNY_PER_POST=0.5` unless you intentionally raise the per-post budget.
- Use `npm.cmd run status` to confirm `modelProvider`, `modelConfigured`, `model`, and budget settings.
- Use `npm.cmd run secrets:scan` before committing if you changed model or environment configuration.
- Use `npm.cmd run verify` after changing model settings.

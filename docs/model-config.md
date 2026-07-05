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

## Safety

- Never commit `.env` or real API keys.
- Keep `MAX_COST_CNY_PER_POST=0.5` unless you intentionally raise the per-post budget.
- Use `npm.cmd run status` to confirm `modelProvider`, `modelConfigured`, `model`, and budget settings.
- Use `npm.cmd run verify` after changing model settings.

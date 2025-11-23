# contextcode

CLI helpers for generating repository context, planning features, and coordinating AI agents on your codebase.

## Supported AI providers

| Provider   | Auth method            | Default model          |
| ---------- | ---------------------- | ---------------------- |
| Anthropic  | OAuth (Claude Pro/MAX) | `claude-3-7-sonnet-20250219` |
| Gemini     | API key                | `gemini-1.5-pro`       |

Run `contextcode auth login` to configure a provider. The login flow guides you through either the Anthropic OAuth steps or the Gemini API key prompt.

## Gemini setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.
2. Run `contextcode auth login`, choose **Google Gemini**, and paste the API key (it begins with `AI`).
3. The CLI stores the key inside `~/.contextcode/credentials.json` and mirrors it in `~/.contextcode/config.json` so non-interactive scripts can pass it to the provider factory.
4. Optionally edit `~/.contextcode/config.json` to set `"defaultProvider": "gemini"` and `"defaultModel": "gemini-1.5-pro"`, or provide `--provider` / `--model` flags per command.

You can also run the CLI with environment overrides:

```bash
export CONTEXTCODE_PROVIDER=gemini
export CONTEXTCODE_MODEL=gemini-1.5-pro
export GEMINI_API_KEY="AI..."
```

## Usage

- `contextcode init` — index the repo and generate context docs (`context.md`, `features.md`, `architecture.md`, `implementation-guide.md`). Use `--provider gemini --model gemini-1.5-pro` to render the docs with Gemini.
- `contextcode generate task` — interactively ask an AI agent (Anthropic or Gemini) to plan work items rooted in your existing context docs.
- `contextcode auth login` — configure credentials for the supported providers.

See `contextcode --help` for the full list of commands and flags.

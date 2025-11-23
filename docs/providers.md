# Provider setup

## Anthropic (Claude)
- Run `contextcode auth login` and pick **Anthropic Claude**.
- Complete the OAuth flow in your browser and paste the code fragment back into the CLI.
- Tokens are stored in `~/.contextcode/credentials.json` and refreshed automatically.
- Run `contextcode set provider` to make Claude the default provider (the CLI will also set the matching model, `claude-sonnet-4-5`).

## Google Gemini
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key (looks like `AIxxxx`).
- Run `contextcode auth login`, choose **Google Gemini**, and paste the API key when prompted.
- The CLI saves the key in `~/.contextcode/credentials.json` and also writes it into `~/.contextcode/config.json` as `geminiApiKey`.
- Use `contextcode set provider` after logging in so the CLI stores Gemini as the default provider and pins its default model (`gemini-3-pro-preview`).
- Configure defaults either via environment variables (`CONTEXTCODE_PROVIDER`, `CONTEXTCODE_MODEL`, `GEMINI_API_KEY`) or by editing the config file so long-running commands can run non-interactively.

## Example configuration snippet

```json
{
  "defaultProvider": "gemini",
  "defaultModel": "gemini-3-pro-preview",
  "geminiApiKey": "AIxyz...",
  "geminiTemperature": 0.3,
  "geminiMaxOutputTokens": 2048
}
```

## Available models (single source of truth)

| Provider  | Label                                   | Model ID                         | Notes                              |
| --------- | --------------------------------------- | -------------------------------- | ---------------------------------- |
| Anthropic | Claude Sonnet 4 (May 14 '25)            | `claude-sonnet-4-20250514`       | Pinned GA release                  |
| Anthropic | Claude Sonnet 4 (latest)                | `claude-sonnet-4-0`              | Rolling channel                    |
| Anthropic | Claude Sonnet 4.5 (Sep 29 '25)          | `claude-sonnet-4-5-20250929`     | Pinned GA release                  |
| Anthropic | Claude Sonnet 4.5 (latest)              | `claude-sonnet-4-5`              | **Default** for Anthropic          |
| Gemini    | Gemini 2.0 Flash                        | `gemini-2.0-flash`               | Fastest Flash tier                 |
| Gemini    | Gemini 2.0 Flash Lite                   | `gemini-2.0-flash-lite`          | Cost-optimized Flash tier          |
| Gemini    | Gemini 2.5 Flash                        | `gemini-2.5-flash`               | Latest Flash model                 |
| Gemini    | Gemini 2.5 Pro                          | `gemini-2.5-pro`                 | Stable Pro release                 |
| Gemini    | Gemini 2.5 Pro Preview (2025-05-06)     | `gemini-2.5-pro-preview-05-06`   | Preview snapshot (May 6, 2025)     |
| Gemini    | Gemini 2.5 Pro Preview (2025-06-05)     | `gemini-2.5-pro-preview-06-05`   | Preview snapshot (June 5, 2025)    |
| Gemini    | Gemini 3 Pro Preview                    | `gemini-3-pro-preview`           | **Default** for Google Gemini      |

## Environment variables

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `CONTEXTCODE_PROVIDER`| Preferred provider (`anthropic` or `gemini`).     |
| `CONTEXTCODE_MODEL`   | Default model name passed to the provider.       |
| `GEMINI_API_KEY`      | Inline Gemini API key (fallback if no credential).|
| `GEMINI_MODEL`        | Override default Gemini model globally.          |
| `GEMINI_API_BASE`     | Custom Gemini endpoint (advanced usage).         |

After at least one provider credential exists you can always run `contextcode set provider` to re-open the TUI picker. The CLI ensures the stored `defaultModel` always belongs to the selected provider.

Set these before invoking `contextcode` to override anything stored in the config file.
